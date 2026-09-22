/**
 * Window registry: the single place that creates, reuses, sizes and closes windows,
 * and the single broadcast surface for Main → Renderer events.
 *
 * Every window shares the same preload and isolation settings; each window kind is a
 * single instance (SNFR-002). Secondary windows are independent (no `parent`), so the
 * main window stays usable while they are open (US-202).
 */

import { join } from 'node:path'

import { BrowserWindow, screen } from 'electron'

import {
  WINDOW_SPECS,
  ZOOM_STEP,
  clampZoomFactor,
  decideWindowAction,
  mainWindowSize,
  type WindowKind,
} from './window-policy'

export interface WindowRegistry {
  openMain(): BrowserWindow
  open(kind: 'capture' | 'log' | 'allowlist'): BrowserWindow
  close(kind: WindowKind): void
  closeAll(): void
  broadcast(channel: string, payload?: unknown): void
  count(kind: WindowKind): number
  mainWindow(): BrowserWindow | null
}

export interface WindowRegistryOptions {
  appRoot: string
  /** Vite dev server origin (`SWUFE_RENDERER_URL`); production loads `dist/renderer/`. */
  devServerUrl?: string
  onMainClosed: () => void
}

/** No menu and no user resize: these keys are the only content-zoom entry. */
const ZOOM_KEYS = ['=', '+', '-', '_', '0']

function rendererTarget(
  options: WindowRegistryOptions,
  entry: string,
): { url: string } | { file: string } {
  return options.devServerUrl
    ? { url: `${options.devServerUrl.replace(/\/$/, '')}/${entry}` }
    : { file: join(options.appRoot, 'dist', 'renderer', entry) }
}

export function createWindowRegistry(options: WindowRegistryOptions): WindowRegistry {
  const windows = new Map<WindowKind, BrowserWindow>()

  function live(kind: WindowKind): BrowserWindow | null {
    const window = windows.get(kind)
    if (!window || window.isDestroyed()) return null
    return window
  }

  function applyMainSize(window: BrowserWindow, factor: number): void {
    const workArea = screen.getDisplayMatching(window.getBounds()).workAreaSize
    const { width, height } = mainWindowSize(factor, workArea)
    window.setSize(width, height)
    console.log(`swufe-window 内容缩放 zoomFactor=${factor} 主窗口=${width}×${height}`)
  }

  /** Cmd/Ctrl + `=`/`+`/`-`/`_`/`0`, plus trackpad/menu zoom, keep the window size in step. */
  function installMainZoom(window: BrowserWindow): void {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      const modifier = process.platform === 'darwin' ? input.meta : input.control
      if (!modifier || !ZOOM_KEYS.includes(input.key)) return
      event.preventDefault()
      const current = window.webContents.getZoomFactor()
      const next =
        input.key === '0'
          ? 1
          : clampZoomFactor(
              current + (input.key === '-' || input.key === '_' ? -ZOOM_STEP : ZOOM_STEP),
            )
      window.webContents.setZoomFactor(next)
      applyMainSize(window, next)
    })
    window.webContents.on('zoom-changed', () => {
      setTimeout(() => applyMainSize(window, window.webContents.getZoomFactor()), 0)
    })
  }

  function create(kind: WindowKind): BrowserWindow {
    const spec = WINDOW_SPECS[kind]
    const window = new BrowserWindow({
      width: spec.width,
      height: spec.height,
      minWidth: spec.minWidth,
      minHeight: spec.minHeight,
      title: spec.title,
      resizable: spec.resizable,
      show: false,
      webPreferences: {
        preload: join(options.appRoot, 'dist', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    windows.set(kind, window)
    window.setMenuBarVisibility(false)
    window.once('ready-to-show', () => window.show())
    window.webContents.on('did-fail-load', (_event, code, description) => {
      console.error(`swufe-window ${spec.title} 加载失败 code=${code} ${description}`)
    })
    window.on('closed', () => {
      if (windows.get(kind) === window) windows.delete(kind)
      if (kind === 'main') options.onMainClosed()
    })

    const target = rendererTarget(options, spec.entry)
    if ('url' in target) void window.loadURL(target.url)
    else void window.loadFile(target.file)

    if (kind === 'main') {
      // Chromium remembers the zoom factor per origin and replays it during load, so the
      // baseline is restored (and the window re-fitted) once each load settles.
      window.webContents.on('did-finish-load', () => {
        window.webContents.setZoomFactor(1)
        applyMainSize(window, 1)
      })
      installMainZoom(window)
    }
    return window
  }

  function open(kind: WindowKind): BrowserWindow {
    const existing = live(kind)
    const action = decideWindowAction(
      existing ? { exists: true, minimized: existing.isMinimized() } : null,
    )
    if (action === 'focus' && existing) {
      if (existing.isMinimized()) existing.restore()
      existing.show()
      existing.focus()
      return existing
    }
    return create(kind)
  }

  return {
    openMain: () => open('main'),
    open: (kind) => open(kind),
    close(kind) {
      const window = live(kind)
      if (window) window.close()
    },
    closeAll() {
      for (const [kind, window] of [...windows]) {
        if (kind === 'main') continue
        if (!window.isDestroyed()) window.close()
      }
    },
    broadcast(channel, payload) {
      for (const window of windows.values()) {
        if (!window.isDestroyed()) window.webContents.send(channel, payload)
      }
    },
    count: (kind) => (live(kind) ? 1 : 0),
    mainWindow: () => live('main'),
  }
}
