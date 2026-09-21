/** Proxy Orchestrator: the app's bridge lifecycle.
 *
 * Deliberately Electron-free (only `node:*` + injected adapters) so it can be
 * unit-tested with fakes; the Electron wiring lives in index.ts/ipc.ts.
 * Invariants: never touch OS state before every precondition passes (ADR-0004) and
 * only ever clear a proxy this app installed (INV-002 / NFR-004).
 */

import { chmodSync, closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'

import type { BridgeStatus, DebugLogEvent } from '../shared/types'
import {
  ERROR_MESSAGES,
  RUNTIME_CONFIG_FILENAME,
  STATUS_CACHE_TTL_MS,
} from './constants'
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
  now?: () => number
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
  private inflightStart: Promise<BridgeStatus> | null = null
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
    // A quit can arrive while `starting`; finishing that attempt first keeps the
    // state machine's documented transitions intact.
    if (this.inflightStart) await this.inflightStart.catch(() => undefined)
    const from = this.machine.state
    if (from === 'idle') return this.status()
    // `running → stopping` is the documented path; `error` (the previous cleanup
    // failed) and `stopping` (a second call) go straight to the cleanup itself.
    if (from === 'running') this.machine.transition('stopping')
    this.emitStatus()

    const port = this.activePort ?? this.settings().bridgePort
    let cleanupFailure: string | null = null
    try {
      await this.deps.systemProxy.disable(port)
    } catch (error) {
      cleanupFailure = describe(error)
    }
    this.deps.store.updateSettings({ systemProxyManagedByApp: false })
    this.invalidateProxyCache()
    try {
      await this.sidecar?.stop()
    } catch (error) {
      cleanupFailure ??= describe(error)
    }
    this.sidecar = null
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
    this.deps.session.stopMonitor()
    try {
      await this.deps.systemProxy.disable(this.activePort ?? this.settings().bridgePort)
    } catch (error) {
      console.warn(`swufe-proxy 桥接异常退出后清除代理失败：${describe(error)}`)
    }
    this.deps.store.updateSettings({ systemProxyManagedByApp: false })
    this.invalidateProxyCache()
    this.activePort = null
    this.machine.fail(mapSidecarError(null), ERROR_MESSAGES.BRIDGE_CRASH)
    this.emitStatus()
  }

  /** Session expiry cascade: stop proxy → stop sidecar → drop session → notify (EC-007). */
  async handleSessionExpired(): Promise<void> {
    console.log('swufe-session WebVPN 会话已失效：停止桥接并清除系统代理')
    const previous = this.machine.state
    if (previous === 'error') this.machine.reset()
    if (this.machine.state !== 'idle') this.machine.transition('stopping')

    try {
      await this.deps.systemProxy.disable(this.activePort ?? this.settings().bridgePort)
    } catch (error) {
      console.warn(`swufe-proxy 会话过期后清除代理失败：${describe(error)}`)
    }
    try {
      await this.sidecar?.stop()
    } catch (error) {
      console.warn(`swufe-sidecar 会话过期后停止失败：${describe(error)}`)
    }
    this.sidecar = null
    this.activePort = null
    this.deps.session.stopMonitor()
    this.deps.store.updateSettings({ systemProxyManagedByApp: false })
    this.invalidateProxyCache()
    await this.deps.session.clear()
    if (this.machine.state === 'stopping') this.machine.transition('idle')
    this.machine.fail('SESSION_EXPIRED', ERROR_MESSAGES.SESSION_EXPIRED)
    this.emitStatus()
    for (const listener of this.sessionExpiredListeners) listener()
  }

  /** Crash self-healing: a leftover "managed by app" flag is cleared on launch. */
  async recoverOnLaunch(): Promise<void> {
    if (!this.settings().systemProxyManagedByApp) return
    console.warn('swufe-proxy 检测到上次运行残留的代理标记：清除本桥代理设置')
    try {
      await this.deps.systemProxy.disable(this.settings().bridgePort)
    } catch (error) {
      console.warn(`swufe-proxy 启动自愈清除代理失败：${describe(error)}`)
    }
    this.deps.store.updateSettings({ systemProxyManagedByApp: false })
    this.invalidateProxyCache()
  }

  /** A fresh session clears a stale SESSION_EXPIRED notice (its cause is gone). */
  clearSessionExpiredNotice(): void {
    if (this.machine.error?.code !== 'SESSION_EXPIRED') return
    this.machine.reset()
    this.emitStatus()
  }

  async logout(): Promise<void> {
    if (this.machine.state === 'running' || this.machine.state === 'starting') await this.stop()
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

  async status(): Promise<BridgeStatus> {
    const status: BridgeStatus = {
      state: this.machine.state,
      loggedIn: this.deps.session.loggedIn,
      systemProxyEnabled: await this.systemProxyEnabled(),
      localCaptureEnabled: false,
      bridgePort: this.settings().bridgePort,
    }
    const error = this.machine.error
    if (error) status.error = { code: error.code, message: error.message }
    return status
  }

  private async runStart(): Promise<BridgeStatus> {
    if (this.machine.state === 'error') this.machine.reset()
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

    const portProbe = this.deps.portProbe ?? defaultPortProbe
    if (!(await portProbe(port))) {
      return this.fail(
        'BRIDGE_CRASH',
        `本机桥端口 ${port} 已被占用：请关闭占用该端口的程序，或修改 bridgePort 后重试。`,
      )
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

    try {
      await this.deps.systemProxy.enable(port)
    } catch (error) {
      await this.deps.systemProxy.disable(port).catch(() => undefined)
      await sidecar.stop().catch(() => undefined)
      this.sidecar = null
      this.activePort = null
      this.deps.store.updateSettings({ systemProxyManagedByApp: false })
      this.invalidateProxyCache()
      this.machine.fail('BRIDGE_CRASH', describe(error))
      this.emitStatus()
      return this.status()
    }

    this.deps.store.updateSettings({ systemProxyManagedByApp: true })
    this.invalidateProxyCache()
    this.machine.transition('running')
    this.deps.session.startMonitor(() => {
      void this.handleSessionExpired()
    })
    this.emitStatus()
    return this.status()
  }

  private fail(code: string, message: string): Promise<BridgeStatus> {
    this.machine.fail(code, message)
    this.emitStatus()
    return this.status()
  }

  private settings(): AppSettings {
    return this.deps.store.getSettings()
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
