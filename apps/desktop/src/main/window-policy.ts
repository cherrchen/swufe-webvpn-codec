/**
 * Window policy as pure functions (no Electron import, so it is unit-testable):
 * which windows exist, how they are sized, and whether a click creates or focuses.
 */

export type WindowKind = 'main' | 'capture' | 'log' | 'allowlist'

export interface WindowSpec {
  kind: WindowKind
  /** Entry HTML under `dist/renderer/`. */
  entry: string
  title: string
  width: number
  height: number
  resizable: boolean
  minWidth?: number
  minHeight?: number
}

/** Baseline (DIP) main-window layout; secondary windows are independently resizable. */
export const MAIN_BASE = { width: 720, height: 560 }

export const WINDOW_SPECS: Readonly<Record<WindowKind, WindowSpec>> = {
  main: {
    kind: 'main',
    entry: 'main.html',
    title: 'SWUFE WebVPN Bridge',
    width: MAIN_BASE.width,
    height: MAIN_BASE.height,
    resizable: false,
  },
  capture: {
    kind: 'capture',
    entry: 'capture.html',
    title: '进程捕获 — 应用选择',
    width: 560,
    height: 480,
    resizable: true,
    minWidth: 560,
    minHeight: 480,
  },
  log: {
    kind: 'log',
    entry: 'logs.html',
    title: '调试日志',
    width: 720,
    height: 420,
    resizable: true,
    minWidth: 720,
    minHeight: 420,
  },
  allowlist: {
    kind: 'allowlist',
    entry: 'allowlist.html',
    title: 'Allowlist',
    width: 480,
    height: 400,
    resizable: true,
    minWidth: 480,
    minHeight: 400,
  },
}

export const ZOOM_STEP = 0.25
export const MIN_ZOOM_FACTOR = 0.5
export const MAX_ZOOM_FACTOR = 2

/** Clamp margins keep an enlarged main window inside the display's work area. */
export const WORK_AREA_MARGIN_X = 80
export const WORK_AREA_MARGIN_Y = 120

export interface WindowState {
  exists: boolean
  minimized: boolean
}

/** A second click on an entry focuses the existing window instead of opening another (SNFR-002). */
export function decideWindowAction(state: WindowState | null): 'create' | 'focus' {
  return state?.exists ? 'focus' : 'create'
}

/** Two decimals keep `zoomFactor` in the logs exact (1.25 + 0.25 stays `1.5`, not `1.4999…`). */
export function clampZoomFactor(factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0) return 1
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, Math.round(factor * 100) / 100))
}

/**
 * Main-window size = baseline × content zoom, clamped to the work area and never
 * below the baseline (spec 002 SC2-001 / EC2-009).
 */
export function mainWindowSize(
  zoomFactor: number,
  workArea: { width: number; height: number },
): { width: number; height: number } {
  const factor = clampZoomFactor(zoomFactor)
  return {
    width: Math.min(
      Math.round(MAIN_BASE.width * factor),
      Math.max(workArea.width - WORK_AREA_MARGIN_X, MAIN_BASE.width),
    ),
    height: Math.min(
      Math.round(MAIN_BASE.height * factor),
      Math.max(workArea.height - WORK_AREA_MARGIN_Y, MAIN_BASE.height),
    ),
  }
}
