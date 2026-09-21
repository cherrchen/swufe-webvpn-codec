import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { DebugLogEvent } from '../src/shared/types'
import { harness } from './helpers/fakes'

test('debug events relay to listeners unmangled and land on stdout', async () => {
  const h = harness()
  const received: DebugLogEvent[] = []
  const logged: string[] = []
  const original = console.log
  console.log = (...args: unknown[]) => {
    logged.push(args.join(' '))
  }
  try {
    h.orchestrator.onDebug((event) => received.push(event))
    await h.orchestrator.start()

    const event: DebugLogEvent = {
      ts: '2026-09-21T10:00:00+00:00',
      host: 'jwxt.swufe.edu.cn',
      rewritten: true,
      direction: 'response',
      detail: 'location',
    }
    h.sidecars[0]?.debugHandler?.(event)

    assert.deepEqual(received, [event])
    assert.deepEqual(logged, [`swufe-debug ${JSON.stringify(event)}`])
    // The relay must not add fields (no cookies/body can slip into the log line).
    assert.deepEqual(Object.keys(received[0] ?? {}).sort(), ['detail', 'direction', 'host', 'rewritten', 'ts'])
  } finally {
    console.log = original
  }
})
