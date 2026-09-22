import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MAIN_BASE,
  WINDOW_SPECS,
  clampZoomFactor,
  decideWindowAction,
  mainWindowSize,
  type WindowKind,
} from '../src/main/window-policy'

/** A work area large enough that no clamp applies. */
const ROOMY = { width: 1920, height: 1400 }

test('the four windows carry the documented entry, title and size', () => {
  const kinds: WindowKind[] = ['main', 'capture', 'log', 'allowlist']
  assert.deepEqual(
    kinds.map((kind) => {
      const spec = WINDOW_SPECS[kind]
      return [kind, spec.entry, spec.title, spec.width, spec.height, spec.resizable]
    }),
    [
      ['main', 'main.html', 'SWUFE WebVPN Bridge', 720, 560, false],
      ['capture', 'capture.html', '进程捕获 — 应用选择', 560, 480, true],
      ['log', 'logs.html', '调试日志', 720, 420, true],
      ['allowlist', 'allowlist.html', 'Allowlist', 480, 400, true],
    ],
  )
  // Secondary windows can never be shrunk below their default size (Q2-001).
  for (const kind of ['capture', 'log', 'allowlist'] as const) {
    const spec = WINDOW_SPECS[kind]
    assert.equal(spec.minWidth, spec.width)
    assert.equal(spec.minHeight, spec.height)
  }
})

test('a missing or closed window is created, an existing one is focused', () => {
  for (const kind of ['main', 'capture', 'log', 'allowlist'] as const) {
    assert.equal(decideWindowAction(null), 'create', kind)
    assert.equal(decideWindowAction({ exists: false, minimized: false }), 'create', kind)
    assert.equal(decideWindowAction({ exists: true, minimized: false }), 'focus', kind)
    // A minimized window is still one instance: focus restores it, it is not recreated.
    assert.equal(decideWindowAction({ exists: true, minimized: true }), 'focus', kind)
  }
})

test('the main window grows with the content zoom factor', () => {
  assert.deepEqual(mainWindowSize(1, ROOMY), { width: 720, height: 560 })
  assert.deepEqual(mainWindowSize(1.25, ROOMY), { width: 900, height: 700 })
  assert.deepEqual(mainWindowSize(1.5, ROOMY), { width: 1080, height: 840 })
  assert.deepEqual(mainWindowSize(2, ROOMY), { width: 1440, height: 1120 })
  assert.deepEqual(mainWindowSize(0.5, ROOMY), { width: 360, height: 280 })
})

test('the main window is clamped to the work area, but never below the baseline', () => {
  // 1000×800 work area: the 900-wide window fits, the 700-tall one does not (800 - 120).
  assert.deepEqual(mainWindowSize(1.25, { width: 1000, height: 800 }), { width: 900, height: 680 })
  // Tight work area: clamping falls back to the baseline, not to a smaller window.
  assert.deepEqual(mainWindowSize(2, { width: 800, height: 600 }), { width: 720, height: 560 })
  assert.deepEqual(mainWindowSize(1, { width: 0, height: 0 }), MAIN_BASE)
})

test('an unusable zoom factor falls back to the baseline size', () => {
  for (const factor of [Number.NaN, 0, -1, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(mainWindowSize(factor, ROOMY), { width: 720, height: 560 }, String(factor))
  }
  assert.equal(clampZoomFactor(3), 2)
  assert.equal(clampZoomFactor(0.1), 0.5)
  assert.equal(clampZoomFactor(1.75 + 0.25), 2)
})
