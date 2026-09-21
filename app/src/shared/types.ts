/** Shared Main ↔ Preload ↔ Renderer contract (source of truth: docs/api/electron-ipc.md). */

export type BridgeState = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

export type BridgeErrorCode =
  | 'PROXY_CONFLICT'
  | 'CA_MISSING'
  | 'NOT_LOGGED_IN'
  | 'SESSION_EXPIRED'
  | 'BRIDGE_CRASH'
  | 'ALLOWLIST_EMPTY'

export interface BridgeStatus {
  state: BridgeState
  loggedIn: boolean
  systemProxyEnabled: boolean
  localCaptureEnabled: boolean
  bridgePort?: number
  error?: { code: string; message: string }
}

export interface AllowlistConfig {
  hosts: string[]
  includeSwufeWildcard: boolean
}

export interface CaStatus {
  installed: boolean
  trusted: boolean
}

export interface DebugLogEvent {
  ts: string
  host: string
  rewritten: boolean
  direction: 'request' | 'response'
  detail?: string
}

export interface SessionInfo {
  loggedIn: boolean
  expiresAt?: string | null
}

export interface CaptureCandidate {
  pid: number
  name: string
}

/** Renderer-visible subset of AppSettings (WRD key/IV never cross the IPC boundary). */
export interface AppSettingsView {
  bridgePort: number
  debugLogging: boolean
  capturePids: number[]
  webvpnBase: string
}

export interface CaOperationResult {
  ok: boolean
  message?: string
}

export interface SwufeBridgeApi {
  login(): Promise<void>
  logout(): Promise<void>
  getSession(): Promise<SessionInfo>
  startBridge(): Promise<BridgeStatus>
  stopBridge(): Promise<BridgeStatus>
  getStatus(): Promise<BridgeStatus>
  getAllowlist(): Promise<AllowlistConfig>
  setAllowlist(cfg: AllowlistConfig): Promise<void>
  getSettings(): Promise<AppSettingsView>
  installCa(): Promise<CaOperationResult>
  uninstallCa(): Promise<CaOperationResult>
  getCaStatus(): Promise<CaStatus>
  listCaptureCandidates(): Promise<CaptureCandidate[]>
  setCapturePids(pids: number[]): Promise<void>
  setDebugLogging(enabled: boolean): Promise<void>
  onDebugLog(cb: (e: DebugLogEvent) => void): () => void
  /** Main → Renderer status pushes (see docs/api/electron-ipc.md § `onStatus`). */
  onStatus(cb: (status: BridgeStatus) => void): () => void
  /** Main → Renderer session-expiry notification (drives the re-login modal). */
  onSessionExpired(cb: () => void): () => void
}
