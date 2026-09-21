/** Fakes for the Electron-free units (see orchestrator.ts injection seams). */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ProxyOrchestrator, type OrchestratorDeps } from '../../src/main/orchestrator'
import type { ProxyEntry, CertManager, SystemProxy } from '../../src/main/platform/types'
import type { DebugLogEvent } from '../../src/shared/types'
import type { Sidecar } from '../../src/main/sidecar'
import type { ProbeResult, SessionCookie, SessionLike } from '../../src/main/session-types'
import { AppStore } from '../../src/main/store'

export function tempUserDataDir(): string {
  return mkdtempSync(join(tmpdir(), 'swufe-app-test-'))
}

export function permissiveEntry(): ProxyEntry {
  const state = { enabled: false, server: '127.0.0.1', port: 7890 }
  return { service: 'Wi-Fi', web: { ...state }, secure: { ...state } }
}

export class FakeSession implements SessionLike {
  loggedIn = true
  cookies: SessionCookie[] = [
    { name: 'wrdvpn_session', value: 'STUB-SESSION', domain: 'webvpn.swufe.edu.cn', path: '/' },
  ]
  expiresAt: string | null = null
  probeResult: ProbeResult = 'valid'
  monitorCallback: (() => void) | null = null
  monitoring = false

  constructor(private readonly calls: string[]) {}

  getSession(): { loggedIn: boolean; expiresAt?: string | null } {
    return { loggedIn: this.loggedIn, expiresAt: this.expiresAt }
  }

  async probe(): Promise<ProbeResult> {
    this.calls.push('session.probe')
    return this.probeResult
  }

  async clear(): Promise<void> {
    this.calls.push('session.clear')
    this.cookies = []
    this.loggedIn = false
  }

  startMonitor(onExpired: () => void): void {
    this.monitoring = true
    this.monitorCallback = onExpired
  }

  stopMonitor(): void {
    this.monitoring = false
  }
}

export class FakeSystemProxy implements SystemProxy {
  entries: ProxyEntry[] = [permissiveEntry()]
  enableFailure: Error | null = null
  disableFailure: Error | null = null
  enabledPort: number | null = null

  constructor(private readonly calls: string[]) {}

  async read(): Promise<ProxyEntry[]> {
    this.calls.push('proxy.read')
    return this.entries.map((entry) => ({ ...entry }))
  }

  async enable(port: number): Promise<void> {
    this.calls.push('proxy.enable')
    if (this.enableFailure) throw this.enableFailure
    this.enabledPort = port
    this.entries = this.entries.map((entry) => ({
      ...entry,
      web: { enabled: true, server: '127.0.0.1', port },
      secure: { enabled: true, server: '127.0.0.1', port },
    }))
  }

  async disable(port: number): Promise<void> {
    this.calls.push('proxy.disable')
    if (this.disableFailure) throw this.disableFailure
    this.enabledPort = null
    // macOS keeps Server/Port populated when a proxy is switched off.
    this.entries = this.entries.map((entry) => ({
      ...entry,
      web: { ...entry.web, enabled: false },
      secure: { ...entry.secure, enabled: false },
    }))
  }
}

export class FakeCertManager implements CertManager {
  status = { installed: true, trusted: true }

  async getStatus(): Promise<{ installed: boolean; trusted: boolean }> {
    return { ...this.status }
  }

  async install(): Promise<{ ok: boolean }> {
    return { ok: true }
  }

  async uninstall(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
}

export class FakeSidecar implements Sidecar {
  startFailure: Error | null = null
  /** Resolves `start()` when the test releases it (null = start immediately). */
  startGate: Promise<void> | null = null
  exitHandler: ((code: number | null, signal: string | null) => void) | null = null
  debugHandler: ((event: DebugLogEvent) => void) | null = null

  constructor(private readonly calls: string[]) {}

  async start(): Promise<void> {
    this.calls.push('sidecar.start')
    if (this.startGate) await this.startGate
    if (this.startFailure) throw this.startFailure
  }

  async stop(): Promise<void> {
    this.calls.push('sidecar.stop')
  }

  onExit(cb: (code: number | null, signal: string | null) => void): void {
    this.exitHandler = cb
  }

  onDebug(cb: (event: DebugLogEvent) => void): void {
    this.debugHandler = cb
  }

  crash(): void {
    this.exitHandler?.(9, null)
  }
}

export interface Harness {
  calls: string[]
  store: AppStore
  session: FakeSession
  systemProxy: FakeSystemProxy
  certManager: FakeCertManager
  sidecars: FakeSidecar[]
  orchestrator: ProxyOrchestrator
  userDataDir: string
}

export function harness(
  overrides: Partial<OrchestratorDeps> = {},
  sidecarSetup?: (sidecar: FakeSidecar) => void,
): Harness {
  const calls: string[] = []
  const userDataDir = tempUserDataDir()
  const store = new AppStore(userDataDir)
  store.load()
  const session = new FakeSession(calls)
  const systemProxy = new FakeSystemProxy(calls)
  const certManager = new FakeCertManager()
  const sidecars: FakeSidecar[] = []
  const deps: OrchestratorDeps = {
    store,
    session,
    systemProxy,
    certManager,
    sidecarFactory: () => {
      const sidecar = new FakeSidecar(calls)
      sidecarSetup?.(sidecar)
      sidecars.push(sidecar)
      return sidecar
    },
    userDataDir,
    portProbe: async () => true,
    ...overrides,
  }
  return {
    calls,
    store,
    session,
    systemProxy,
    certManager,
    sidecars,
    userDataDir,
    orchestrator: new ProxyOrchestrator(deps),
  }
}
