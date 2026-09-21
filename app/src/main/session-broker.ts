/** Session Broker: the single reader of the login partition's cookies (see components.md).
 *
 * Storage is the Electron persistent partition itself (`persist:swufe-login`); no
 * `session.bin` is written. The login WebView is pinned to a direct proxy so the
 * system proxy (which points at our own bridge) can never be used for the login
 * flow (INV-004 / EC-005).
 */

import { BrowserWindow, net, session, type Session } from 'electron'

import type { SessionInfo } from '../shared/types'
import { LOGIN_PARTITION, SESSION_PROBE_INTERVAL_MS, SESSION_PROBE_TIMEOUT_MS } from './constants'
import { classifyProbe } from './session-probe'
import type { ProbeResult, SessionCookie } from './session-types'

export class SessionBroker {
  private readonly webvpnHost: string
  private partition: Session | null = null
  private capturedCookies: SessionCookie[] = []
  private capturedAt: string | null = null
  private lastValidatedAt: string | null = null
  private expiresAtIso: string | null = null
  private capturedLoggedIn = false
  private loginWindow: BrowserWindow | null = null
  private closedAfterLogin = false
  private monitor: NodeJS.Timeout | null = null
  private readonly changeListeners: Array<() => void> = []

  constructor(private readonly webvpnBase: string) {
    this.webvpnHost = new URL(webvpnBase).hostname
  }

  get loggedIn(): boolean {
    return this.capturedLoggedIn
  }

  /** Sidecar payload projection (name/value/domain/path only). */
  get cookies(): SessionCookie[] {
    return this.capturedCookies.map((cookie) => ({ ...cookie }))
  }

  get capturedAtIso(): string | null {
    return this.capturedAt
  }

  /** Last successful `probe()` (data-model.md SessionState.lastValidatedAt). */
  get lastValidatedAtIso(): string | null {
    return this.lastValidatedAt
  }

  onChange(cb: () => void): void {
    this.changeListeners.push(cb)
  }

  /** Must run before any window opens: the login partition never uses our bridge. */
  async prepare(): Promise<void> {
    const partition = session.fromPartition(LOGIN_PARTITION)
    await partition.setProxy({ mode: 'direct' })
    this.partition = partition
  }

  getSession(): SessionInfo {
    return { loggedIn: this.capturedLoggedIn, expiresAt: this.expiresAtIso }
  }

  /** Open the official portal; login is detected from the navigation that leaves /login. */
  async openLogin(): Promise<void> {
    const partition = this.requirePartition()
    if (this.loginWindow) {
      this.loginWindow.focus()
      return
    }
    const resolved = await partition.resolveProxy(this.webvpnBase)
    console.log(`swufe-session 登录窗口 resolveProxy(${this.webvpnBase}) = ${resolved}`)
    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      title: '登录 WebVPN',
      webPreferences: {
        partition: LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    this.loginWindow = win
    win.on('closed', () => {
      this.loginWindow = null
      // The user may have finished while the final navigation was not observed.
      void this.capture()
    })
    win.webContents.on('did-navigate', (_event, url) => void this.handleNavigation(url))
    win.webContents.on('did-redirect-navigation', (_event, url) => void this.handleNavigation(url))
    this.closedAfterLogin = false
    try {
      await win.loadURL(this.webvpnBase)
    } catch (error) {
      // A successful login closes the window while the initial load is still
      // pending, which rejects that load; any other failure is real.
      if (!this.closedAfterLogin) throw error
    }
  }

  async capture(): Promise<void> {
    const cookies = await this.requirePartition().cookies.get({ url: this.webvpnBase })
    const captured: SessionCookie[] = []
    const expiries: number[] = []
    for (const cookie of cookies) {
      if (!cookie.value) continue
      captured.push({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain ?? this.webvpnHost,
        path: cookie.path ?? '/',
      })
      if (typeof cookie.expirationDate === 'number') expiries.push(cookie.expirationDate)
    }
    this.capturedCookies = captured
    this.capturedAt = new Date().toISOString()
    this.expiresAtIso = expiries.length > 0 ? new Date(Math.min(...expiries) * 1000).toISOString() : null
    this.setLoggedIn(captured.length > 0)
  }

  async probe(): Promise<ProbeResult> {
    const partition = this.requirePartition()
    const { promise, resolve } = Promise.withResolvers<ProbeResult>()
    let settled = false
    const finish = (result: ProbeResult, reason: string): void => {
      if (settled) return
      settled = true
      if (result !== 'valid') console.log(`swufe-session 会话探测：${reason} → ${result}`)
      resolve(result)
    }
    const request = net.request({ url: this.webvpnBase, session: partition, redirect: 'manual' })
    const timer = setTimeout(() => {
      request.abort()
      finish('unknown', '超时')
    }, SESSION_PROBE_TIMEOUT_MS)
    request.on('response', (response) => {
      clearTimeout(timer)
      const raw = response.headers.location
      const location = Array.isArray(raw) ? raw.at(-1) : raw
      const target = location ? new URL(location, this.webvpnBase) : null
      response.on('data', () => undefined)
      response.on('end', () => undefined)
      finish(
        classifyProbe(response.statusCode, target?.hostname ?? null, target?.pathname ?? null, this.webvpnHost),
        `status=${response.statusCode} location=${location ?? '(none)'}`,
      )
    })
    // With redirect:'manual' Chromium reports the target and then cancels the
    // request ("Redirect was cancelled"), so the redirect event *is* the response
    // for a 3xx — there is no statusCode-only path to classify.
    request.on('redirect', (statusCode, _method, redirectUrl) => {
      clearTimeout(timer)
      const target = new URL(redirectUrl, this.webvpnBase)
      finish(
        classifyProbe(statusCode, target.hostname, target.pathname, this.webvpnHost),
        `status=${statusCode} location=${redirectUrl}`,
      )
    })
    request.on('error', (error) => {
      clearTimeout(timer)
      finish('unknown', `失败 ${String(error)}`)
    })
    request.end()
    const result = await promise
    if (result === 'valid') this.lastValidatedAt = new Date().toISOString()
    if (result === 'expired') this.setLoggedIn(false)
    return result
  }

  startMonitor(onExpired: () => void): void {
    if (this.monitor) return
    const configured = Number.parseInt(process.env.SWUFE_PROBE_INTERVAL_MS ?? '', 10)
    const interval = Number.isFinite(configured) && configured > 0 ? configured : SESSION_PROBE_INTERVAL_MS
    this.monitor = setInterval(() => {
      void this.tick(onExpired)
    }, interval)
  }

  stopMonitor(): void {
    if (!this.monitor) return
    clearInterval(this.monitor)
    this.monitor = null
  }

  async clear(): Promise<void> {
    this.stopMonitor()
    this.capturedCookies = []
    this.capturedAt = null
    this.lastValidatedAt = null
    await this.requirePartition().clearStorageData({ storages: ['cookies'] })
    this.setLoggedIn(false)
  }

  private async tick(onExpired: () => void): Promise<void> {
    if (!this.capturedLoggedIn) return
    if ((await this.probe()) === 'expired') onExpired()
  }

  private async handleNavigation(url: string): Promise<void> {
    const target = new URL(url)
    if (target.hostname !== this.webvpnHost || target.pathname.startsWith('/login')) return
    await this.capture()
    this.closedAfterLogin = true
    this.loginWindow?.close()
  }

  private setLoggedIn(value: boolean): void {
    if (this.capturedLoggedIn === value) return
    this.capturedLoggedIn = value
    for (const listener of this.changeListeners) listener()
  }

  private requirePartition(): Session {
    if (!this.partition) throw new Error('Session Broker 尚未初始化（prepare() 未调用）')
    return this.partition
  }
}
