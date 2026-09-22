/** IPC surface: the 16 documented commands, 5 window/log additions, and Main → Renderer events. */

import { ipcMain } from 'electron'

import type { AllowlistConfig, CaptureMode } from '../shared/types'
import {
  CHANNEL_DEBUG_LOG,
  CHANNEL_SESSION_EXPIRED,
  CHANNEL_STATUS,
} from './constants'
import { MAX_CAPTURE_PROCESSES } from '../shared/limits'
import type { DebugLogBuffer } from './debug-log-buffer'
import type { ProxyOrchestrator } from './orchestrator'
import { listCaptureCandidates } from './platform'
import type { CertManager } from './platform/types'
import type { SessionBroker } from './session-broker'
import { isCaptureMode, normalizeCapturePatterns } from './store'
import type { AppStore } from './store'
import type { WindowRegistry } from './window-registry'

export interface IpcContext {
  store: AppStore
  session: SessionBroker
  orchestrator: ProxyOrchestrator
  certManager: CertManager
  windows: WindowRegistry
  debugLogs: DebugLogBuffer
}

function requireAllowlist(raw: unknown): AllowlistConfig {
  const candidate = raw as Partial<AllowlistConfig> | null
  if (!candidate || !Array.isArray(candidate.hosts) || typeof candidate.includeSwufeWildcard !== 'boolean') {
    throw new Error('setAllowlist 参数不合法')
  }
  return { hosts: candidate.hosts.map(String), includeSwufeWildcard: candidate.includeSwufeWildcard }
}

function requireCaptureMode(raw: unknown): CaptureMode {
  if (!isCaptureMode(raw)) throw new Error(`捕获方式不合法：${String(raw)}`)
  return raw
}

function requirePatterns(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error('setCaptureProcesses 参数不合法')
  const patterns = normalizeCapturePatterns(raw)
  if (patterns.length !== raw.length) {
    throw new Error('捕获进程列表不合法：每一项必须是非空且不含逗号的路径，且不能重复')
  }
  if (patterns.length > MAX_CAPTURE_PROCESSES) {
    throw new Error(`最多只能选择 ${MAX_CAPTURE_PROCESSES} 个应用`)
  }
  return patterns
}

/**
 * Capture failures carry a code (e.g. `PROXY_CONFLICT`) that the renderer needs to
 * pick the right modal. Electron keeps only `message`/`stack` of a rejected
 * `invoke`, so the code is prefixed onto the message and parsed back in the
 * renderer (docs/api/electron-ipc.md § 错误模型).
 */
function withCaptureCode(run: Promise<void>): Promise<void> {
  return run.catch((error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${typeof code === 'string' && code ? code : 'BRIDGE_CRASH'}：${message}`)
  })
}

export function registerIpc(ctx: IpcContext): void {
  const handle = (method: string, fn: (...args: unknown[]) => unknown): void => {
    ipcMain.handle(`swufe:${method}`, (_event, ...args: unknown[]) => fn(...args))
  }

  handle('login', () => ctx.session.openLogin())
  handle('logout', () => ctx.orchestrator.logout())
  handle('getSession', () => ctx.session.getSession())
  handle('startBridge', () => ctx.orchestrator.start())
  handle('stopBridge', () => ctx.orchestrator.stop())
  handle('getStatus', () => ctx.orchestrator.status())
  handle('getAllowlist', () => ctx.store.getAllowlist())
  handle('setAllowlist', (raw) => {
    ctx.store.setAllowlist(requireAllowlist(raw))
    ctx.orchestrator.refreshRuntimeConfig()
    // The allowlist summary lives in the main window while edits happen in the
    // allowlist window; the status event is the only push channel, so Main
    // re-broadcasts it after a config change and every window re-reads (AC2-007).
    void ctx.orchestrator
      .status()
      .then((status) => ctx.windows.broadcast(CHANNEL_STATUS, status))
      .catch((error: unknown) =>
        console.warn(`swufe-ui allowlist 变更后广播状态失败：${String(error)}`),
      )
  })
  handle('getSettings', () => {
    const settings = ctx.store.getSettings()
    return {
      bridgePort: settings.bridgePort,
      debugLogging: settings.debugLogging,
      captureMode: settings.captureMode,
      captureProcesses: settings.captureProcesses,
      webvpnBase: settings.webvpnBase,
    }
  })
  handle('installCa', () => ctx.certManager.install())
  handle('uninstallCa', () => ctx.certManager.uninstall())
  handle('getCaStatus', () => ctx.certManager.getStatus())
  handle('listCaptureCandidates', () => listCaptureCandidates())
  handle('setCaptureMode', (raw) =>
    withCaptureCode(ctx.orchestrator.setCaptureMode(requireCaptureMode(raw))),
  )
  handle('setCaptureProcesses', (raw) =>
    withCaptureCode(ctx.orchestrator.setCaptureProcesses(requirePatterns(raw))),
  )
  handle('setDebugLogging', (raw) => {
    const enabled = raw === true
    ctx.store.updateSettings({ debugLogging: enabled })
    ctx.orchestrator.refreshRuntimeConfig()
    if (!enabled) {
      // Logging off means "no history": the buffer and the window both go away (EC2-002).
      ctx.debugLogs.clear()
      ctx.windows.close('log')
    }
  })

  // Window control (each kind is a single instance; the registry focuses the live one).
  handle('openCaptureWindow', () => {
    ctx.windows.open('capture')
  })
  handle('openLogWindow', () => {
    ctx.windows.open('log')
  })
  handle('openAllowlistWindow', () => {
    ctx.windows.open('allowlist')
  })
  handle('getDebugLogs', () => ctx.debugLogs.snapshot())
  handle('clearDebugLogs', () => ctx.debugLogs.clear())

  // Main → Renderer events (broadcast to every live window).
  ctx.orchestrator.onStatus((status) => ctx.windows.broadcast(CHANNEL_STATUS, status))
  ctx.orchestrator.onDebug((event) => {
    // Buffer first: the log window must be able to restore history after a reopen.
    ctx.debugLogs.push(event)
    ctx.windows.broadcast(CHANNEL_DEBUG_LOG, event)
  })
  ctx.orchestrator.onSessionExpired(() => ctx.windows.broadcast(CHANNEL_SESSION_EXPIRED))
  ctx.session.onChange(() => {
    // A fresh capture must reach a running sidecar without a restart.
    ctx.orchestrator.refreshRuntimeConfig()
    if (ctx.session.loggedIn) ctx.orchestrator.clearSessionExpiredNotice()
    void ctx.orchestrator
      .status()
      .then((status) => ctx.windows.broadcast(CHANNEL_STATUS, status))
      .catch((error: unknown) =>
        console.warn(`swufe-ui allowlist 变更后广播状态失败：${String(error)}`),
      )
  })
}
