/** Proxy Orchestrator: the app's bridge lifecycle.
 *
 * Deliberately Electron-free (only `node:*` + injected adapters) so it can be
 * unit-tested with fakes; the Electron wiring lives in index.ts/ipc.ts.
 * Invariants: never touch OS state before every precondition passes (ADR-0004) and
 * only ever clear a proxy this app installed (INV-002 / NFR-004).
 */

import { chmodSync, closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'

import type { BridgeStatus, CaptureMode, CaptureReport, DebugLogEvent } from '../shared/types'
import {
  ERROR_MESSAGES,
  RUNTIME_CONFIG_FILENAME,
  STATUS_CACHE_TTL_MS,
} from './constants'
import { isFakeIpAddress } from './fake-ip'
import { isConflict, shouldClear } from './platform/parse'
import type { CertManager, SystemProxy } from './platform/types'
import { mapSidecarError, type Sidecar } from './sidecar'
import type { AppSettings, AppStore } from './store'
import { BridgeStateMachine } from './state-machine'
import type { SessionLike } from './session-types'

export type { SessionLike } from './session-types'

export interface OrchestratorDeps {
  store: AppStore
  session: SessionLike
  systemProxy: SystemProxy
  certManager: CertManager
  sidecarFactory: (options: { port: number }) => Sidecar
  userDataDir: string
  /** Returns true when the port is free (default: bind test on 127.0.0.1). */
  portProbe?: (port: number) => Promise<boolean>
  /** IPv4 addresses of a host (default: the OS resolver via `dns.lookup`). */
  resolveUpstream?: (host: string) => Promise<string[]>
  now?: () => number
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function defaultResolveUpstream(host: string): Promise<string[]> {
  const addresses = await lookup(host, { all: true, family: 4 })
  return addresses.map((entry) => entry.address)
}

function defaultPortProbe(port: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const server = createServer()
  server.once('error', () => resolve(false))
  server.once('listening', () => {
    server.close(() => resolve(true))
  })
  server.listen({ host: '127.0.0.1', port })
  return promise
}

export class ProxyOrchestrator {
  private readonly machine = new BridgeStateMachine()
  private sidecar: Sidecar | null = null
  private activePort: number | null = null
  private proxyCache: { at: number; enabled: boolean } | null = null
  private captureReport: CaptureReport | null = null
  private inflightStart: Promise<BridgeStatus> | null = null
  private inflightExpiry: Promise<void> | null = null
  private readonly statusListeners: Array<(status: BridgeStatus) => void> = []
  private readonly sessionExpiredListeners: Array<() => void> = []
  private readonly debugListeners: Array<(event: DebugLogEvent) => void> = []

  constructor(private readonly deps: OrchestratorDeps) {}

  onStatus(cb: (status: BridgeStatus) => void): void {
    this.statusListeners.push(cb)
  }

  onSessionExpired(cb: () => void): void {
    this.sessionExpiredListeners.push(cb)
  }

  onDebug(cb: (event: DebugLogEvent) => void): void {
    this.debugListeners.push(cb)
  }

  async start(): Promise<BridgeStatus> {
    if (this.machine.state === 'running') return this.status()
    if (this.inflightStart) return this.inflightStart
    this.inflightStart = this.runStart()
    try {
      return await this.inflightStart
    } finally {
      this.inflightStart = null
    }
  }

  async stop(): Promise<BridgeStatus> {
    if (this.inflightExpiry) {
      await this.inflightExpiry
      return this.status()
    }
    // A quit can arrive while `starting`; finishing that attempt first keeps the
    // state machine's documented transitions intact.
    if (this.inflightStart) await this.inflightStart.catch(() => undefined)
    const from = this.machine.state
    if (from === 'idle') return this.status()
    this.deps.session.stopMonitor()
    // `running → stopping` is the documented path; `error` (the previous cleanup
    // failed) and `stopping` (a second call) go straight to the cleanup itself.
    if (from === 'running') this.machine.transition('stopping')
    this.emitStatus()

    const port = this.activePort ?? this.settings().bridgePort
    let cleanupFailure: string | null = null
    try {
      await this.disableSystemProxy(port)
    } catch (error) {
      cleanupFailure = describe(error)
    }
    try {
      await this.sidecar?.stop()
    } catch (error) {
      cleanupFailure ??= describe(error)
    }
    this.sidecar = null
    this.captureReport = null
    this.activePort = null
    this.deps.session.stopMonitor()
    if (this.machine.state === 'stopping') this.machine.transition('idle')
    else this.machine.reset()
    if (cleanupFailure) {
      console.warn(`swufe-proxy 停止时清理失败：${cleanupFailure}`)
      this.machine.fail('BRIDGE_CRASH', cleanupFailure)
    }
    this.emitStatus()
    return this.status()
  }

  /** Sidecar died on its own: clear our proxy and park in `error` (no auto restart). */
  async handleSidecarExit(code: number | null, signal: string | null): Promise<void> {
    if (this.machine.state !== 'running' && this.machine.state !== 'starting') return
    console.warn(`swufe-sidecar 桥接进程退出：code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    this.sidecar = null
    this.captureReport = null
    this.deps.session.stopMonitor()
    try {
      await this.disableSystemProxy(this.activePort ?? this.settings().bridgePort)
    } catch (error) {
      console.warn(`swufe-proxy 桥接异常退出后清除代理失败：${describe(error)}`)
    }
    this.activePort = null
    this.machine.fail(mapSidecarError(null), ERROR_MESSAGES.BRIDGE_CRASH)
    this.emitStatus()
  }

  /** Session expiry cascade: stop proxy → stop sidecar → drop session → notify (EC-007). */
  async handleSessionExpired(): Promise<void> {
    if (this.inflightExpiry) return this.inflightExpiry
    this.inflightExpiry = this.runSessionExpiry()
    try {
      await this.inflightExpiry
    } finally {
      this.inflightExpiry = null
    }
  }

  private async runSessionExpiry(): Promise<void> {
    console.log('swufe-session WebVPN 会话已失效：停止桥接并清除系统代理')
    this.deps.session.stopMonitor()
    const previous = this.machine.state
    if (previous === 'error') this.machine.reset()
    if (this.machine.state === 'running') this.machine.transition('stopping')

    let proxyFailure: string | null = null
    try {
      await this.disableSystemProxy(this.activePort ?? this.settings().bridgePort)
    } catch (error) {
      proxyFailure = describe(error)
      console.warn(`swufe-proxy 会话过期后清除代理失败：${describe(error)}`)
    }
    try {
      await this.sidecar?.stop()
    } catch (error) {
      console.warn(`swufe-sidecar 会话过期后停止失败：${describe(error)}`)
    }
    this.sidecar = null
    this.captureReport = null
    this.activePort = null
    this.deps.session.stopMonitor()
    await this.deps.session.clear()
    if (this.machine.state === 'stopping') this.machine.transition('idle')
    this.machine.fail(
      'SESSION_EXPIRED',
      proxyFailure
        ? `WebVPN 会话已失效，桥接已停止，但系统代理清理失败：${proxyFailure}`
        : ERROR_MESSAGES.SESSION_EXPIRED,
    )
    this.emitStatus()
    for (const listener of this.sessionExpiredListeners) listener()
  }

  /** Crash self-healing: a leftover "managed by app" flag is cleared on launch. */
  async recoverOnLaunch(): Promise<void> {
    if (!this.settings().systemProxyManagedByApp) return
    console.warn('swufe-proxy 检测到上次运行残留的代理标记：清除本桥代理设置')
    try {
      await this.disableSystemProxy(this.settings().bridgePort)
    } catch (error) {
      console.warn(`swufe-proxy 启动自愈清除代理失败：${describe(error)}`)
    }
  }

  /** A fresh session clears the notice it invalidated (its cause is gone): `SESSION_EXPIRED`
   * (the session had expired) and `NOT_LOGGED_IN` (there was no session yet). */
  clearStaleSessionNotice(): void {
    const code = this.machine.error?.code
    if (code !== 'SESSION_EXPIRED' && code !== 'NOT_LOGGED_IN') return
    this.machine.reset()
    this.emitStatus()
  }

  async logout(): Promise<void> {
    if (this.machine.state !== 'idle') await this.stop()
    await this.deps.session.clear()
    this.emitStatus()
  }

  /** Re-push the runtime config while the bridge runs (config file hot reload). */
  refreshRuntimeConfig(): void {
    if (this.machine.state !== 'running' && this.machine.state !== 'starting') return
    try {
      this.writeRuntimeConfig()
    } catch (error) {
      console.warn(`swufe-config 运行时配置写入失败：${describe(error)}`)
    }
  }

  /**
   * Switch capture mode (REQ-003). The two modes are mutually exclusive (ADR-0006):
   * selecting apps revokes our system proxy, going back installs it again — each via
   * the sidecar config, which the addon hot-reloads.
   */
  async setCaptureMode(mode: CaptureMode): Promise<void> {
    if (mode === 'selected-apps') await this.assertNoForeignProxy()
    if (mode === this.settings().captureMode) {
      // The UI's retry action re-sends the same mode after a capture failure.
      this.captureReport = null
      this.refreshRuntimeConfig()
      this.emitStatus()
      return
    }
    if (this.machine.state === 'running' || this.machine.state === 'starting') {
      const port = this.activePort ?? this.settings().bridgePort
      if (mode === 'selected-apps') await this.disableSystemProxyIfManaged(port)
      else if (!this.settings().systemProxyManagedByApp) {
        try {
          await this.enableSystemProxy(port)
        } catch (error) {
          // If rollback also failed, stop local capture before a residual system
          // proxy can route the same process through both capture mechanisms.
          if (this.settings().systemProxyManagedByApp) await this.stop()
          throw error
        }
      }
    }
    this.deps.store.updateSettings({ captureMode: mode })
    this.captureReport = null
    this.refreshRuntimeConfig()
    this.emitStatus()
  }

  async setCaptureProcesses(patterns: string[]): Promise<void> {
    this.deps.store.updateSettings({ captureProcesses: patterns })
    this.captureReport = null
    this.refreshRuntimeConfig()
    this.emitStatus()
  }

  async status(): Promise<BridgeStatus> {
    const settings = this.settings()
    const status: BridgeStatus = {
      state: this.machine.state,
      loggedIn: this.deps.session.loggedIn,
      systemProxyEnabled: await this.systemProxyEnabled(),
      localCaptureEnabled:
        this.machine.state === 'running' &&
        settings.captureMode === 'selected-apps' &&
        this.captureReport?.enabled === true,
      bridgePort: settings.bridgePort,
    }
    const error = this.machine.error
    if (error) status.error = { code: error.code, message: error.message }
    if (this.captureReport?.error) status.captureError = this.captureReport.error
    return status
  }

  private async runStart(): Promise<BridgeStatus> {
    if (this.machine.state === 'error') this.machine.reset()
    if (this.settings().systemProxyManagedByApp) {
      await this.recoverOnLaunch()
      if (this.settings().systemProxyManagedByApp) {
        return this.fail('BRIDGE_CRASH', '上次运行残留的系统代理未能清理，请检查系统代理设置。')
      }
    }
    const settings = this.settings()
    const port = settings.bridgePort

    if (!this.deps.session.loggedIn) return this.fail('NOT_LOGGED_IN', ERROR_MESSAGES.NOT_LOGGED_IN)

    const allowlist = this.deps.store.getAllowlist()
    if (allowlist.hosts.length === 0 && !allowlist.includeSwufeWildcard) {
      return this.fail('ALLOWLIST_EMPTY', ERROR_MESSAGES.ALLOWLIST_EMPTY)
    }

    try {
      const ca = await this.deps.certManager.getStatus()
      if (!ca.installed || !ca.trusted) return this.fail('CA_MISSING', ERROR_MESSAGES.CA_MISSING)
    } catch (error) {
      return this.fail('BRIDGE_CRASH', describe(error))
    }

    try {
      const entries = await this.deps.systemProxy.read()
      if (entries.length === 0) {
        return this.fail('BRIDGE_CRASH', '未找到可用的系统网络服务：无法设置系统代理。')
      }
      const conflict = entries.some(
        (entry) => isConflict(entry.web, port) || isConflict(entry.secure, port),
      )
      if (conflict) return this.fail('PROXY_CONFLICT', ERROR_MESSAGES.PROXY_CONFLICT)
    } catch (error) {
      return this.fail('BRIDGE_CRASH', describe(error))
    }

    // Fake-ip DNS (Clash / mihomo TUN, `198.18.0.0/15`) never reaches the gateway:
    // the upstream connection hangs instead of failing, so refuse it up front with
    // the same conflict semantics as an occupied system proxy (KI-013).
    const upstreamHost = this.upstreamHost()
    if (upstreamHost) {
      const resolveUpstream = this.deps.resolveUpstream ?? defaultResolveUpstream
      try {
        if ((await resolveUpstream(upstreamHost)).some(isFakeIpAddress)) {
          console.warn(`swufe-proxy ${upstreamHost} 解析到 fake-ip 地址（198.18.0.0/15）：拒绝开桥`)
          return this.fail('PROXY_CONFLICT', ERROR_MESSAGES.PROXY_CONFLICT)
        }
      } catch (error) {
        // Best effort: a resolver hiccup must not block an otherwise valid start.
        console.warn(`swufe-proxy ${upstreamHost} 解析失败，跳过 fake-ip 预检：${describe(error)}`)
      }
    }

    const portProbe = this.deps.portProbe ?? defaultPortProbe
    if (!(await portProbe(port))) {
      return this.fail(
        'BRIDGE_CRASH',
        `本机桥端口 ${port} 已被占用：请关闭占用该端口的程序，或修改 bridgePort 后重试。`,
      )
    }

    // Capture mode and system proxy are mutually exclusive (ADR-0006): a captured
    // process pointing at the system proxy would reach mitmproxy through the
    // transparent layer and hard-fail, so we never install both.
    const captureSelected = settings.captureMode === 'selected-apps'
    if (captureSelected) {
      try {
        await this.disableSystemProxyIfManaged(port)
      } catch (error) {
        return this.fail('BRIDGE_CRASH', describe(error))
      }
    }

    try {
      this.writeRuntimeConfig()
    } catch (error) {
      return this.fail('BRIDGE_CRASH', `运行时配置写入失败：${describe(error)}`)
    }

    this.machine.transition('starting')
    this.emitStatus()

    const sidecar = this.deps.sidecarFactory({ port })
    this.sidecar = sidecar
    this.activePort = port
    sidecar.onExit((code, signal) => {
      void this.handleSidecarExit(code, signal)
    })
    sidecar.onDebug((event) => this.emitDebug(event))
    sidecar.onCapture((report) => this.handleCaptureReport(report))

    try {
      await sidecar.start()
    } catch (error) {
      await sidecar.stop().catch(() => undefined)
      this.sidecar = null
      this.activePort = null
      this.machine.fail('BRIDGE_CRASH', describe(error))
      this.emitStatus()
      return this.status()
    }

    if (!captureSelected) {
      try {
        await this.enableSystemProxy(port)
      } catch (error) {
        await sidecar.stop().catch(() => undefined)
        this.sidecar = null
        this.activePort = null
        this.machine.fail('BRIDGE_CRASH', describe(error))
        this.emitStatus()
        return this.status()
      }
    }

    this.machine.transition('running')
    this.deps.session.startMonitor(() => {
      void this.handleSessionExpired()
    })
    this.emitStatus()
    return this.status()
  }

  /** Capture is optional (REQ-003): its state shows up as a status field, not a failure. */
  private handleCaptureReport(report: CaptureReport): void {
    this.captureReport = report
    this.emitStatus()
  }

  /** Revoke the system proxy this app installed, if any (INV-002). */
  private async disableSystemProxyIfManaged(port: number): Promise<void> {
    if (!this.settings().systemProxyManagedByApp) return
    await this.disableSystemProxy(port)
  }

  /** Persist ownership before the first OS write, including partially successful commands. */
  private async enableSystemProxy(port: number): Promise<void> {
    this.deps.store.updateSettings({ systemProxyManagedByApp: true })
    this.invalidateProxyCache()
    try {
      await this.deps.systemProxy.enable(port)
      this.invalidateProxyCache()
    } catch (error) {
      try {
        await this.disableSystemProxy(port)
      } catch (cleanupError) {
        throw new Error(`${describe(error)}；代理回滚失败：${describe(cleanupError)}`)
      }
      throw error
    }
  }

  /** A failed OS cleanup must leave the marker for a later retry. */
  private async disableSystemProxy(port: number): Promise<void> {
    await this.deps.systemProxy.disable(port)
    this.deps.store.updateSettings({ systemProxyManagedByApp: false })
    this.invalidateProxyCache()
  }

  /** Selecting apps fails fast when another tool owns the system proxy (ADR-0004/0006). */
  private async assertNoForeignProxy(): Promise<void> {
    const port = this.activePort ?? this.settings().bridgePort
    const entries = await this.deps.systemProxy.read()
    if (entries.length === 0) {
      throw Object.assign(
        new Error('未找到可用的系统网络服务：无法检查系统代理占用情况。'),
        { code: 'BRIDGE_CRASH' },
      )
    }
    if (entries.some((entry) => isConflict(entry.web, port) || isConflict(entry.secure, port))) {
      throw Object.assign(new Error(ERROR_MESSAGES.PROXY_CONFLICT), { code: 'PROXY_CONFLICT' })
    }
  }

  private fail(code: string, message: string): Promise<BridgeStatus> {
    this.machine.fail(code, message)
    this.emitStatus()
    return this.status()
  }

  private settings(): AppSettings {
    return this.deps.store.getSettings()
  }

  /** Host of the configured gateway; `null` when the setting is not a usable URL. */
  private upstreamHost(): string | null {
    try {
      const host = new URL(this.settings().webvpnBase).hostname
      return host || null
    } catch {
      return null
    }
  }

  private async systemProxyEnabled(): Promise<boolean> {
    const now = this.now()
    if (this.proxyCache && now - this.proxyCache.at < STATUS_CACHE_TTL_MS) return this.proxyCache.enabled
    const port = this.activePort ?? this.settings().bridgePort
    let enabled = false
    try {
      const entries = await this.deps.systemProxy.read()
      enabled = entries.some(
        (entry) => shouldClear(entry.web, port) || shouldClear(entry.secure, port),
      )
    } catch (error) {
      console.warn(`swufe-proxy 读取系统代理失败：${describe(error)}`)
    }
    this.proxyCache = { at: now, enabled }
    return enabled
  }

  private invalidateProxyCache(): void {
    this.proxyCache = null
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now()
  }

  private writeRuntimeConfig(): void {
    const settings = this.settings()
    const allowlist = this.deps.store.getAllowlist()
    const payload = {
      allowlist: {
        hosts: allowlist.hosts,
        includeSwufeWildcard: allowlist.includeSwufeWildcard,
        updatedAt: new Date().toISOString(),
      },
      cookies: this.deps.session.cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
      })),
      debug: settings.debugLogging,
      webvpnBase: settings.webvpnBase,
      wrdKey: settings.wrdKey,
      wrdIv: settings.wrdIv,
      // Empty in system-proxy mode: capture is opt-in and the two are exclusive.
      capture: {
        processes: settings.captureMode === 'selected-apps' ? settings.captureProcesses : [],
      },
    }
    const path = join(this.deps.userDataDir, RUNTIME_CONFIG_FILENAME)
    mkdirSync(dirname(path), { recursive: true })
    const fd = openSync(path, 'w', 0o600)
    try {
      writeSync(fd, `${JSON.stringify(payload, null, 2)}\n`)
    } finally {
      closeSync(fd)
    }
    chmodSync(path, 0o600)
  }

  private emitDebug(event: DebugLogEvent): void {
    console.log(`swufe-debug ${JSON.stringify(event)}`)
    for (const listener of this.debugListeners) listener(event)
  }

  private emitStatus(): void {
    void this.status().then((status) => {
      for (const listener of this.statusListeners) listener(status)
    })
  }
}
