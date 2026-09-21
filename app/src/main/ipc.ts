/** IPC surface: registers all 15 documented methods and wires Main → Renderer events. */

import { ipcMain } from 'electron'

import type { AllowlistConfig } from '../shared/types'
import { CHANNEL_DEBUG_LOG, CHANNEL_SESSION_EXPIRED, CHANNEL_STATUS } from './constants'
import type { ProxyOrchestrator } from './orchestrator'
import { listCaptureCandidates } from './platform'
import type { CertManager } from './platform/types'
import type { SessionBroker } from './session-broker'
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

function requirePids(raw: unknown): number[] {
  if (!Array.isArray(raw)) throw new Error('setCapturePids 参数不合法')
  return raw.map((pid) => {
    const value = Number(pid)
    if (!Number.isInteger(value) || value <= 0) throw new Error(`进程 PID 不合法：${String(pid)}`)
    return value
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
      capturePids: settings.capturePids,
      webvpnBase: settings.webvpnBase,
    }
  })
  handle('installCa', () => ctx.certManager.install())
  handle('uninstallCa', () => ctx.certManager.uninstall())
  handle('getCaStatus', () => ctx.certManager.getStatus())
  handle('listCaptureCandidates', () => listCaptureCandidates())
  handle('setCapturePids', (raw) => {
    ctx.store.updateSettings({ capturePids: requirePids(raw) })
  })
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
