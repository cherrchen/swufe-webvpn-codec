import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createDebugLogBuffer } from '../src/main/debug-log-buffer'
import type { DebugLogEvent } from '../src/shared/types'

function event(index: number): DebugLogEvent {
  return {
    ts: new Date(Date.UTC(2026, 8, 23, 12, 0, 0) + index * 1000).toISOString(),
    host: `host-${index}.swufe.edu.cn`,
    rewritten: index % 2 === 0,
    direction: index % 2 === 0 ? 'request' : 'response',
  }
}

test('the buffer keeps at most 200 entries with the newest first', () => {
  const buffer = createDebugLogBuffer()
  for (let index = 0; index < 201; index += 1) buffer.push(event(index))

  assert.equal(buffer.size(), 200)
  const entries = buffer.snapshot()
  assert.equal(entries[0]?.host, 'host-200.swufe.edu.cn')
  assert.equal(entries[199]?.host, 'host-1.swufe.edu.cn')
  // host-0 was the oldest and fell out of the ring.
  assert.equal(entries.some((entry) => entry.host === 'host-0.swufe.edu.cn'), false)
})

test('the buffer remembers only the documented event keys', () => {
  const buffer = createDebugLogBuffer()
  buffer.push({ ...event(0), detail: '非 allowlist' })

  assert.deepEqual(Object.keys(buffer.snapshot()[0] ?? {}).sort(), [
    'detail',
    'direction',
    'host',
    'rewritten',
    'ts',
  ])
})

test('clear empties the buffer and snapshots are copies', () => {
  const buffer = createDebugLogBuffer()
  buffer.push(event(0))
  const copy = buffer.snapshot()
  copy.push(event(1))

  assert.equal(buffer.size(), 1)
  buffer.clear()
  assert.deepEqual(buffer.snapshot(), [])
  assert.equal(buffer.size(), 0)
})

test('the capacity is configurable and honours the limit', () => {
  const buffer = createDebugLogBuffer(2)
  buffer.push(event(0))
  buffer.push(event(1))
  buffer.push(event(2))

  assert.deepEqual(
    buffer.snapshot().map((entry) => entry.host),
    ['host-2.swufe.edu.cn', 'host-1.swufe.edu.cn'],
  )
})
