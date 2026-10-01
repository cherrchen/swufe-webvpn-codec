import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Session } from 'electron'

import { SessionBroker } from '../src/main/session-broker'
import { TICKET_COOKIE_NAME } from '../src/main/constants'
import { harness } from './helpers/fakes'

function brokerHarness() {
  let ticket = 'STUB-FIRST'
  let expires = Date.now() / 1000 + 1
  const broker = new SessionBroker('https://webvpn.swufe.edu.cn', {
    fromPartition: () => ({
      setProxy: async () => undefined,
      cookies: { get: async () => ticket ? [{ name: TICKET_COOKIE_NAME, value: ticket, expirationDate: expires }] : [] },
      clearStorageData: async () => undefined,
    }) as unknown as Session,
    createWindow: () => { throw new Error('no window in unit tests') },
  })
  return { broker, update: (value: string, expiry: number) => { ticket = value; expires = expiry } }
}

test('re-login refreshes sidecar cookies and replaces the old expiry timer', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-10-02T00:00:00Z') })
  const { broker, update } = brokerHarness()
  await broker.prepare()
  const h = harness({ session: broker })
  let updates = 0
  broker.onUpdate(() => { updates++; h.orchestrator.refreshRuntimeConfig() })
  await broker.capture()
  await h.orchestrator.start()
  t.mock.timers.tick(500)
  update('STUB-SECOND', Date.now() / 1000 + 2)
  await broker.capture()
  assert.equal(updates, 2)
  const payload = JSON.parse(readFileSync(join(h.userDataDir, 'bridge-config.json'), 'utf8'))
  assert.equal(payload.cookies[0].value, 'STUB-SECOND')
  t.mock.timers.tick(500)
  assert.equal(broker.loggedIn, true)
  t.mock.timers.tick(1500)
  // Timer expiry queues the orchestrator's cascade.
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(broker.loggedIn, false)
  assert.equal((await h.orchestrator.status()).error?.code, 'SESSION_EXPIRED')
})

test('an unsuccessful recapture preserves the active session expiry', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-10-02T00:00:00Z') })
  const { broker, update } = brokerHarness()
  await broker.prepare()
  await broker.capture()
  let expirations = 0
  broker.startMonitor(() => { expirations++ })
  update('', 0)
  assert.equal(await broker.capture(), false)
  t.mock.timers.tick(1000)
  assert.equal(expirations, 1)
  assert.equal(broker.loggedIn, false)
})

test('stopping a monitor prevents expiry after another capture', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-10-02T00:00:00Z') })
  const { broker, update } = brokerHarness()
  await broker.prepare()
  await broker.capture()
  let expirations = 0
  broker.startMonitor(() => { expirations++ })
  broker.stopMonitor()
  update('STUB-SECOND', Date.now() / 1000 + 2)
  await broker.capture()
  t.mock.timers.tick(3000)
  assert.equal(expirations, 0)
  assert.equal(broker.loggedIn, true)
})
