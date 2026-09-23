import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SessionProbeGuard, validateCapturedSession } from '../src/main/session-guard'
import type { ProbeResult } from '../src/main/session-types'

test('pre-login cookies alone never establish a usable session', async () => {
  assert.equal(await validateCapturedSession(1, async () => 'expired'), false)
  assert.equal(await validateCapturedSession(1, async () => 'unknown'), false)
  assert.equal(await validateCapturedSession(1, async () => 'valid'), true)
  assert.equal(await validateCapturedSession(0, async () => { throw new Error('must not probe') }), false)
})

test('a probe resolving after monitoring stops cannot expire the session', async () => {
  const guard = new SessionProbeGuard()
  const pending = Promise.withResolvers<ProbeResult>()
  const events: string[] = []
  guard.startMonitor()
  const tick = guard.runMonitorProbe(() => pending.promise, () => events.push('valid'), () => events.push('expired'))
  guard.stopMonitor()
  pending.resolve('expired')
  await tick
  assert.deepEqual(events, [])
})

test('an old probe cannot clear a newly captured login', async () => {
  const guard = new SessionProbeGuard()
  const pending = Promise.withResolvers<ProbeResult>()
  const events: string[] = []
  guard.startMonitor()
  const tick = guard.runMonitorProbe(() => pending.promise, () => events.push('valid'), () => events.push('expired'))
  const revision = guard.changeSession()
  assert.equal(guard.isCurrentSession(revision), true)
  pending.resolve('expired')
  await tick
  assert.deepEqual(events, [])
})

test('overlapping expired probes notify once and a superseded capture is ignored', async () => {
  const guard = new SessionProbeGuard()
  const pending = Promise.withResolvers<ProbeResult>()
  const events: string[] = []
  guard.startMonitor()
  const first = guard.runMonitorProbe(() => pending.promise, () => {}, () => events.push('expired'))
  const second = guard.runMonitorProbe(() => pending.promise, () => {}, () => events.push('expired'))
  const staleCapture = guard.changeSession()
  const currentCapture = guard.changeSession()
  assert.equal(guard.isCurrentSession(staleCapture), false)
  assert.equal(guard.isCurrentSession(currentCapture), true)
  pending.resolve('expired')
  await Promise.all([first, second])
  assert.deepEqual(events, [])

  const immediate = async (): Promise<ProbeResult> => 'expired'
  await Promise.all([
    guard.runMonitorProbe(immediate, () => {}, () => events.push('expired')),
    guard.runMonitorProbe(immediate, () => {}, () => events.push('expired')),
  ])
  assert.deepEqual(events, ['expired'])
})
