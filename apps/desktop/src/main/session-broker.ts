/** Session Broker: the single reader of the login partition's cookies (see components.md).
 *
 * Storage is the Electron persistent partition itself (`persist:swufe-login`); no
 * `session.bin` is written. The login WebView is pinned to a direct proxy so the
 * system proxy (which points at our own bridge) can never be used for the login
 * flow (INV-004 / EC-005).
 */

import { BrowserWindow, session, type Session } from 'electron'

import type { SessionInfo } from '../shared/types'
import { LOGIN_PARTITION, TICKET_COOKIE_NAME } from './constants'
import { SessionProbeGuard } from './session-guard'
import type { SessionCookie } from './session-types'

/** Chromium's "navigation was superseded/cancelled" error (`net::ERR_ABORTED`). */
function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ERR_ABORTED'
}

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
  private readonly probeGuard = new SessionProbeGuard()
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

  /** Last capture that accepted the ticket (data-model.md SessionState.lastValidatedAt). */
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
      if (!this.closedAfterLogin) void this.capture()
    })
    win.webContents.on('did-navigate', (_event, url) => void this.handleNavigation(url))
    win.webContents.on('did-redirect-navigation', (_event, url) => void this.handleNavigation(url))
    this.closedAfterLogin = false
    try {
      await win.loadURL(this.webvpnBase)
    } catch (error) {
      // A successful login closes the window while the initial load is still
      // pending, and the portal's cross-origin redirect to CAS aborts that
      // pending `loadURL` (ERR_ABORTED) even though the window did navigate.
      // Login detection rides on the window's own navigation handlers, so both
      // are non-fatal; anything else is a real failure.
      if (!this.closedAfterLogin && !isAbortError(error)) throw error
      console.log(`swufe-session 登录窗口初始加载被中断（非致命）：${String(error)}`)
    }
  }

  async capture(): Promise<boolean> {
    const revision = this.probeGuard.changeSession()
    const cookies = await this.requirePartition().cookies.get({ url: this.webvpnBase })
    const captured: SessionCookie[] = []
    let ticketExpires: number | null = null
    let hasTicket = false
    for (const cookie of cookies) {
      if (!cookie.value) continue
      captured.push({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain ?? this.webvpnHost,
        path: cookie.path ?? '/',
      })
      if (cookie.name !== TICKET_COOKIE_NAME) continue
      hasTicket = true
      ticketExpires = typeof cookie.expirationDate === 'number' ? cookie.expirationDate : null
    }
    if (!this.probeGuard.isCurrentSession(revision)) return false
    if (!hasTicket) return false
    if (ticketExpires !== null && ticketExpires * 1000 <= Date.now()) return false
    this.capturedCookies = captured
    this.capturedAt = new Date().toISOString()
    this.expiresAtIso = ticketExpires === null ? null : new Date(ticketExpires * 1000).toISOString()
    this.lastValidatedAt = this.capturedAt
    this.setLoggedIn(true)
    return true
  }

  /** Local timer until the ticket `expiresAt`. A missing expiry does not probe. */
  startMonitor(onExpired: () => void): void {
    this.stopMonitor()
    this.probeGuard.startMonitor()
    if (!this.capturedLoggedIn || !this.expiresAtIso) return
    const delay = Date.parse(this.expiresAtIso) - Date.now()
    const revision = this.probeGuard.changeSession()
    const fire = (): void => {
      if (!this.probeGuard.isCurrentSession(revision) || !this.capturedLoggedIn) return
      this.expiresAtIso = null
      this.setLoggedIn(false)
      onExpired()
    }
    if (!Number.isFinite(delay) || delay <= 0) {
      fire()
      return
    }
    this.monitor = setTimeout(fire, delay)
  }

  stopMonitor(): void {
    this.probeGuard.stopMonitor()
    if (!this.monitor) return
    clearTimeout(this.monitor)
    this.monitor = null
  }

  async clear(): Promise<void> {
    this.probeGuard.changeSession()
    this.stopMonitor()
    this.capturedCookies = []
    this.capturedAt = null
    this.lastValidatedAt = null
    this.expiresAtIso = null
    await this.requirePartition().clearStorageData({ storages: ['cookies'] })
    this.setLoggedIn(false)
  }

  private async handleNavigation(url: string): Promise<void> {
    const target = new URL(url)
    if (target.hostname !== this.webvpnHost || target.pathname.startsWith('/login')) return
    if (!(await this.capture())) return
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
