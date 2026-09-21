/** Preload: exposes `window.swufeBridge` (docs/api/electron-ipc.md) over contextBridge. */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type { SwufeBridgeApi } from '../shared/types'
import { CHANNEL_DEBUG_LOG, CHANNEL_SESSION_EXPIRED, CHANNEL_STATUS } from '../main/constants'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: SwufeBridgeApi = {
  login: () => ipcRenderer.invoke('swufe:login'),
  logout: () => ipcRenderer.invoke('swufe:logout'),
  getSession: () => ipcRenderer.invoke('swufe:getSession'),
  startBridge: () => ipcRenderer.invoke('swufe:startBridge'),
  stopBridge: () => ipcRenderer.invoke('swufe:stopBridge'),
  getStatus: () => ipcRenderer.invoke('swufe:getStatus'),
  getAllowlist: () => ipcRenderer.invoke('swufe:getAllowlist'),
  setAllowlist: (cfg) => ipcRenderer.invoke('swufe:setAllowlist', cfg),
  getSettings: () => ipcRenderer.invoke('swufe:getSettings'),
  installCa: () => ipcRenderer.invoke('swufe:installCa'),
  uninstallCa: () => ipcRenderer.invoke('swufe:uninstallCa'),
  getCaStatus: () => ipcRenderer.invoke('swufe:getCaStatus'),
  listCaptureCandidates: () => ipcRenderer.invoke('swufe:listCaptureCandidates'),
  setCapturePids: (pids) => ipcRenderer.invoke('swufe:setCapturePids', pids),
  setDebugLogging: (enabled) => ipcRenderer.invoke('swufe:setDebugLogging', enabled),
  onDebugLog: (cb) => subscribe(CHANNEL_DEBUG_LOG, cb),
  onStatus: (cb) => subscribe(CHANNEL_STATUS, cb),
  onSessionExpired: (cb) => subscribe(CHANNEL_SESSION_EXPIRED, cb),
}

contextBridge.exposeInMainWorld('swufeBridge', api)
