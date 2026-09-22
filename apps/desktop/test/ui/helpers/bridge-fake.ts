/**
 * Controllable `window.swufeBridge` double: every call (and its arguments) is
 * recorded and every subscription can be driven from the test.
 */

import type {
  AllowlistConfig,
  AppSettingsView,
  BridgeStatus,
  CaStatus,
  DebugLogEvent,
  SwufeBridgeApi,
} from '../../../src/shared/types'

export interface BridgeFake {
  api: SwufeBridgeApi
  /** Method names in call order (e.g. `setCaptureProcesses`). */
  calls: string[]
  /** Arguments of each call, aligned with `calls`. */
  args: unknown[][]
  /** Live subscriber count for one event channel (asserts unsubscription). */
  listenerCount(kind: 'status' | 'debug' | 'expired'): number
  emitStatus(status: BridgeStatus): void
  emitDebugLog(event: DebugLogEvent): void
  emitSessionExpired(): void
}

const IDLE_STATUS: BridgeStatus = {
  state: 'idle',
  loggedIn: false,
  systemProxyEnabled: false,
  localCaptureEnabled: false,
  bridgePort: 8080,
}

const DEFAULT_SETTINGS: AppSettingsView = {
  bridgePort: 8080,
  debugLogging: false,
  captureMode: 'system-proxy',
  captureProcesses: [],
  webvpnBase: 'https://webvpn.swufe.edu.cn',
}

const DEFAULT_ALLOWLIST: AllowlistConfig = {
  hosts: ['jwxt.swufe.edu.cn'],
  includeSwufeWildcard: false,
}

const DEFAULT_CA_STATUS: CaStatus = { installed: false, trusted: false }

export function installBridgeFake(overrides: Partial<SwufeBridgeApi> = {}): BridgeFake {
  const calls: string[] = []
  const args: unknown[][] = []
  const statusListeners = new Set<(status: BridgeStatus) => void>()
  const debugListeners = new Set<(event: DebugLogEvent) => void>()
  const expiredListeners = new Set<() => void>()

  const stub =
    <T>(name: string, value: T) =>
    (...values: unknown[]): Promise<T> => {
      calls.push(name)
      args.push(values)
      return Promise.resolve(value)
    }

  const api: SwufeBridgeApi = {
    login: stub('login', undefined),
    logout: stub('logout', undefined),
    getSession: stub('getSession', { loggedIn: false }),
    startBridge: stub('startBridge', IDLE_STATUS),
    stopBridge: stub('stopBridge', IDLE_STATUS),
    getStatus: stub('getStatus', IDLE_STATUS),
    getAllowlist: stub('getAllowlist', DEFAULT_ALLOWLIST),
    setAllowlist: stub('setAllowlist', undefined),
    getSettings: stub('getSettings', DEFAULT_SETTINGS),
    installCa: stub('installCa', { ok: true }),
    uninstallCa: stub('uninstallCa', { ok: true }),
    getCaStatus: stub('getCaStatus', DEFAULT_CA_STATUS),
    listCaptureCandidates: stub('listCaptureCandidates', []),
    setCaptureMode: stub('setCaptureMode', undefined),
    setCaptureProcesses: stub('setCaptureProcesses', undefined),
    setDebugLogging: stub('setDebugLogging', undefined),
    openCaptureWindow: stub('openCaptureWindow', undefined),
    openLogWindow: stub('openLogWindow', undefined),
    openAllowlistWindow: stub('openAllowlistWindow', undefined),
    getDebugLogs: stub('getDebugLogs', []),
    clearDebugLogs: stub('clearDebugLogs', undefined),
    onDebugLog: (cb) => {
      debugListeners.add(cb)
      return () => debugListeners.delete(cb)
    },
    onStatus: (cb) => {
      statusListeners.add(cb)
      return () => statusListeners.delete(cb)
    },
    onSessionExpired: (cb) => {
      expiredListeners.add(cb)
      return () => expiredListeners.delete(cb)
    },
    ...overrides,
  }

  window.swufeBridge = api

  return {
    api,
    calls,
    args,
    listenerCount: (kind) =>
      kind === 'status'
        ? statusListeners.size
        : kind === 'debug'
          ? debugListeners.size
          : expiredListeners.size,
    emitStatus: (status) => {
      for (const listener of statusListeners) listener(status)
    },
    emitDebugLog: (event) => {
      for (const listener of debugListeners) listener(event)
    },
    emitSessionExpired: () => {
      for (const listener of expiredListeners) listener()
    },
  }
}
