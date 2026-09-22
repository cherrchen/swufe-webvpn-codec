/** Log merge windows: 100ms normally, 250ms while saturated and streaming (Q2-004). */

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createLogBatcher } from '../../src/renderer/lib/log-batch'
import type { DebugLogEvent } from '../../src/shared/types'

function event(index: number): DebugLogEvent {
  return {
    ts: new Date(Date.UTC(2026, 8, 23, 12, 0, 0) + index * 1000).toISOString(),
    host: `host-${index}.swufe.edu.cn`,
    rewritten: true,
    direction: 'request',
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('a burst is handed over once, in arrival order, after the normal merge window', () => {
  const flushed: DebugLogEvent[][] = []
  const batcher = createLogBatcher((events) => flushed.push(events), { isSaturated: () => false })

  batcher.push(event(0))
  batcher.push(event(1))
  batcher.push(event(2))
  vi.advanceTimersByTime(99)
  expect(flushed).toEqual([])

  vi.advanceTimersByTime(1)
  expect(flushed).toHaveLength(1)
  expect(flushed[0]?.map((entry) => entry.host)).toEqual([
    'host-0.swufe.edu.cn',
    'host-1.swufe.edu.cn',
    'host-2.swufe.edu.cn',
  ])
  batcher.dispose()
})

test('a saturated window streaming faster than 50 events/second slows to 250ms', () => {
  const flushed: DebugLogEvent[][] = []
  const batcher = createLogBatcher((events) => flushed.push(events), { isSaturated: () => true })

  for (let index = 0; index < 51; index += 1) batcher.push(event(index))
  vi.advanceTimersByTime(100)
  expect(flushed).toEqual([])

  vi.advanceTimersByTime(150)
  expect(flushed).toHaveLength(1)
  expect(flushed[0]).toHaveLength(51)
  batcher.dispose()
})

test('a saturated but idle window keeps the normal merge window', () => {
  const flushed: DebugLogEvent[][] = []
  const batcher = createLogBatcher((events) => flushed.push(events), { isSaturated: () => true })

  batcher.push(event(0))
  vi.advanceTimersByTime(100)
  expect(flushed).toHaveLength(1)
  batcher.dispose()
})

test('flush hands over immediately and dispose drops what is still pending', () => {
  const flushed: DebugLogEvent[][] = []
  const batcher = createLogBatcher((events) => flushed.push(events), { isSaturated: () => false })

  batcher.push(event(0))
  batcher.flush()
  expect(flushed).toHaveLength(1)

  batcher.push(event(1))
  batcher.dispose()
  vi.advanceTimersByTime(1_000)
  expect(flushed).toHaveLength(1)
})
