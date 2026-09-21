/** Window factory (the login WebView lives in session-broker.ts). */

import { join } from 'node:path'

import { BrowserWindow } from 'electron'

export function createMainWindow(appRoot: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 720,
    height: 640,
    minWidth: 560,
    minHeight: 520,
    title: 'SWUFE WebVPN Bridge',
    webPreferences: {
      preload: join(appRoot, 'dist', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.setMenuBarVisibility(false)
  void window.loadFile(join(appRoot, 'static', 'index.html'))
  return window
}
