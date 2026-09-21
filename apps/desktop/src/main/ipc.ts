/** IPC surface: registers all 15 documented methods and wires Main → Renderer events. */

import { ipcMain } from 'electron'

import type { AllowlistConfig, CaptureMode } from '../shared/types'
import {
  CHANNEL_DEBUG_LOG,
  CHANNEL_SESSION_EXPIRED,
  CHANNEL_STATUS,
  MAX_CAPTURE_PROCESSES,
} from './constants'
import type { ProxyOrchestrator } from './orchestrator'
import { listCaptureCandidates } from './platform'
import type { CertManager } from './platform/types'
import type { SessionBroker } from './session-broker'
import { isCaptureMode, normalizeCapturePatterns } from './store'
import type { AppStore } from './store'

export interface IpcContext {
  store: AppStore
  session: SessionBroker
  orchestrator: ProxyOrchestrator
  certManager: CertManager
  /** `webContents.send` on the main window. */
  broadcast: (channel: string, payload?: unknown) => void
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
    ctx.store.updateSettings({ debugLogging: raw === true })
    ctx.orchestrator.refreshRuntimeConfig()
  })

  // Main → Renderer events.
  ctx.orchestrator.onStatus((status) => ctx.broadcast(CHANNEL_STATUS, status))
  ctx.orchestrator.onDebug((event) => ctx.broadcast(CHANNEL_DEBUG_LOG, event))
  ctx.orchestrator.onSessionExpired(() => ctx.broadcast(CHANNEL_SESSION_EXPIRED))
  ctx.session.onChange(() => {
    // A fresh capture must reach a running sidecar without a restart.
    ctx.orchestrator.refreshRuntimeConfig()
    if (ctx.session.loggedIn) ctx.orchestrator.clearSessionExpiredNotice()
    void ctx.orchestrator.status().then((status) => ctx.broadcast(CHANNEL_STATUS, status))
  })
}
