import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { harness, permissiveEntry } from './helpers/fakes'

function conflictEntry(port: number) {
  const state = { enabled: true, server: '127.0.0.1', port }
  return { service: 'Wi-Fi', web: { ...state }, secure: { ...state } }
}

test('a proxy used by something else refuses the start without touching the OS', async () => {
  const h = harness()
  h.systemProxy.entries = [conflictEntry(7890)]

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'error')
  assert.equal(status.error?.code, 'PROXY_CONFLICT')
  assert.equal(status.error?.message, '检测到系统代理已启用。请先关闭 Clash / mihomo / 其它 VPN 的系统代理后再试。')
  assert.equal(h.calls.includes('proxy.enable'), false)
  assert.equal(h.sidecars.length, 0)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('preconditions are checked in a fixed order: login → allowlist → CA → proxy', async () => {
  const notLoggedIn = harness()
  notLoggedIn.session.loggedIn = false
  notLoggedIn.certManager.status = { installed: false, trusted: false }
  notLoggedIn.systemProxy.entries = [conflictEntry(7890)]
  assert.equal((await notLoggedIn.orchestrator.start()).error?.code, 'NOT_LOGGED_IN')

  const emptyAllowlist = harness()
  emptyAllowlist.store.setAllowlist({ hosts: [], includeSwufeWildcard: false })
  emptyAllowlist.certManager.status = { installed: false, trusted: false }
  emptyAllowlist.systemProxy.entries = [conflictEntry(7890)]
  assert.equal((await emptyAllowlist.orchestrator.start()).error?.code, 'ALLOWLIST_EMPTY')

  const noCa = harness()
  noCa.certManager.status = { installed: true, trusted: false }
  noCa.systemProxy.entries = [conflictEntry(7890)]
  assert.equal((await noCa.orchestrator.start()).error?.code, 'CA_MISSING')
  assert.equal(noCa.calls.includes('proxy.enable'), false)
})

test('a wildcard allowlist with no explicit hosts is accepted', async () => {
  const h = harness()
  h.store.setAllowlist({ hosts: [], includeSwufeWildcard: true })

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'running')
})

test('an occupied bridge port fails as BRIDGE_CRASH before any OS change', async () => {
  const h = harness({ portProbe: async () => false })

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'error')
  assert.equal(status.error?.code, 'BRIDGE_CRASH')
  assert.match(status.error?.message ?? '', /8080 已被占用/)
  assert.equal(h.calls.includes('proxy.enable'), false)
  assert.equal(h.sidecars.length, 0)
})

test('a successful start writes the runtime config, enables the proxy and reports running', async () => {
  const h = harness()
  h.store.updateSettings({ debugLogging: true })

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'running')
  assert.equal(status.loggedIn, true)
  assert.equal(status.systemProxyEnabled, true)
  assert.equal(status.localCaptureEnabled, false)
  assert.equal(status.bridgePort, 8080)
  assert.equal(h.systemProxy.enabledPort, 8080)
  assert.equal(h.session.monitoring, true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)

  const runtimeConfigPath = join(h.userDataDir, 'bridge-config.json')
  const payload = JSON.parse(readFileSync(runtimeConfigPath, 'utf-8')) as Record<string, any>
  assert.deepEqual(payload.allowlist.hosts, ['jwxt.swufe.edu.cn'])
  assert.equal(payload.debug, true)
  assert.deepEqual(payload.cookies, [
    { name: 'wrdvpn_session', value: 'STUB-SESSION', domain: 'webvpn.swufe.edu.cn', path: '/' },
  ])
  // NFR-003: the file carries session cookies, so it must stay owner-only.
  assert.equal(statSync(runtimeConfigPath).mode & 0o777, 0o600)
})

test('starting twice is idempotent', async () => {
  const h = harness()

  const first = await h.orchestrator.start()
  const second = await h.orchestrator.start()

  assert.equal(first.state, 'running')
  assert.equal(second.state, 'running')
  assert.equal(h.sidecars.length, 1)
  assert.equal(h.calls.filter((call) => call === 'proxy.enable').length, 1)
})

test('the runtime config is re-pushed while running (hot reload, no restart)', async () => {
  const h = harness()
  await h.orchestrator.start()

  h.store.updateSettings({ debugLogging: true })
  h.orchestrator.refreshRuntimeConfig()

  const payload = JSON.parse(readFileSync(join(h.userDataDir, 'bridge-config.json'), 'utf-8')) as {
    debug: boolean
  }
  assert.equal(payload.debug, true)
  assert.equal(h.sidecars.length, 1)
})

test('stopping clears the proxy before killing the sidecar and leaves no marker', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.calls.length = 0

  const status = await h.orchestrator.stop()

  assert.equal(status.state, 'idle')
  assert.equal(status.systemProxyEnabled, false)
  assert.deepEqual(h.calls.filter((call) => call === 'proxy.disable' || call === 'sidecar.stop'), [
    'proxy.disable',
    'sidecar.stop',
  ])
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
  assert.equal(h.session.monitoring, false)
})

test('stopping an idle bridge is a no-op', async () => {
  const h = harness()

  const status = await h.orchestrator.stop()

  assert.equal(status.state, 'idle')
  assert.equal(h.calls.includes('proxy.disable'), false)
  assert.equal(h.calls.includes('sidecar.stop'), false)
  assert.equal(h.sidecars.length, 0)
})

test('a sidecar crash clears the proxy and reports BRIDGE_CRASH without restarting', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.calls.length = 0

  h.sidecars[0]?.crash()
  await new Promise((resolve) => setImmediate(resolve))

  const status = await h.orchestrator.status()
  assert.equal(status.state, 'error')
  assert.equal(status.error?.code, 'BRIDGE_CRASH')
  assert.equal(status.error?.message, '桥接进程异常退出：请查看日志后重新开启桥接。')
  assert.equal(h.calls.includes('proxy.disable'), true)
  assert.equal(h.calls.includes('sidecar.start'), false)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('a sidecar that fails to become ready rolls back the start', async () => {
  const h = harness({}, (sidecar) => {
    sidecar.startFailure = new Error('桥接进程未在 30 秒内就绪。')
  })

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'error')
  assert.equal(status.error?.code, 'BRIDGE_CRASH')
  assert.equal(status.error?.message, '桥接进程未在 30 秒内就绪。')
  assert.equal(h.calls.includes('proxy.enable'), false)
  assert.equal(h.calls.includes('sidecar.stop'), true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('a proxy failure rolls back the proxy and stops the sidecar', async () => {
  const h = harness()
  h.systemProxy.enableFailure = new Error('networksetup -setwebproxy Wi-Fi 失败：permission denied')

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'error')
  assert.equal(status.error?.code, 'BRIDGE_CRASH')
  assert.match(status.error?.message ?? '', /permission denied/)
  assert.deepEqual(h.calls.filter((call) => call === 'proxy.enable' || call === 'proxy.disable' || call === 'sidecar.stop'), [
    'proxy.enable',
    'proxy.disable',
    'sidecar.stop',
  ])
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('session expiry cascades: proxy → sidecar → session → SESSION_EXPIRED', async () => {
  const h = harness()
  const events: string[] = []
  h.orchestrator.onSessionExpired(() => events.push('session-expired'))
  await h.orchestrator.start()
  h.calls.length = 0

  await h.orchestrator.handleSessionExpired()

  assert.deepEqual(
    h.calls.filter((call) => call === 'proxy.disable' || call === 'sidecar.stop' || call === 'session.clear'),
    ['proxy.disable', 'sidecar.stop', 'session.clear'],
  )
  assert.deepEqual(events, ['session-expired'])
  const status = await h.orchestrator.status()
  assert.equal(status.state, 'error')
  assert.equal(status.error?.code, 'SESSION_EXPIRED')
  assert.equal(status.error?.message, 'WebVPN 会话已失效。桥接已停止并已清除系统代理。')
  assert.equal(status.loggedIn, false)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('an expired session re-login clears the stale notice', async () => {
  const h = harness()
  await h.orchestrator.handleSessionExpired()
  assert.equal((await h.orchestrator.status()).error?.code, 'SESSION_EXPIRED')

  h.orchestrator.clearSessionExpiredNotice()

  const status = await h.orchestrator.status()
  assert.equal(status.state, 'idle')
  assert.equal(status.error, undefined)
})

test('launch recovery clears a leftover marker from a previous crash', async () => {
  const h = harness()
  h.store.updateSettings({ systemProxyManagedByApp: true })

  await h.orchestrator.recoverOnLaunch()

  assert.equal(h.calls.includes('proxy.disable'), true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('launch recovery leaves a clean state alone', async () => {
  const h = harness()

  await h.orchestrator.recoverOnLaunch()

  assert.deepEqual(h.calls, [])
})

test('logout stops the bridge before dropping the session', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.calls.length = 0

  await h.orchestrator.logout()

  assert.deepEqual(
    h.calls.filter((call) => call === 'proxy.disable' || call === 'sidecar.stop' || call === 'session.clear'),
    ['proxy.disable', 'sidecar.stop', 'session.clear'],
  )
  assert.equal((await h.orchestrator.status()).loggedIn, false)
})

test('stopping after a failed start cleans up instead of throwing', async () => {
  // Regression: the error state used to be reset to idle and then transitioned to
  // stopping, which the state machine rejects (idle → stopping).
  const h = harness()
  h.systemProxy.entries = [conflictEntry(7890)]
  const failed = await h.orchestrator.start()
  assert.equal(failed.state, 'error')
  h.calls.length = 0

  const status = await h.orchestrator.stop()

  assert.equal(status.state, 'idle')
  assert.equal(status.error, undefined)
  assert.equal(h.calls.includes('proxy.disable'), true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('stopping while the bridge is still starting still cleans everything up', async () => {
  const gate = Promise.withResolvers<void>()
  const h = harness({}, (sidecar) => {
    sidecar.startGate = gate.promise
  })
  const starting = Promise.withResolvers<void>()
  h.orchestrator.onStatus((status) => {
    if (status.state === 'starting') starting.resolve()
  })

  const started = h.orchestrator.start()
  await starting.promise
  const stopped = h.orchestrator.stop()
  gate.resolve()
  const status = await stopped
  await started

  assert.equal(status.state, 'idle')
  assert.equal(h.calls.includes('proxy.disable'), true)
  assert.equal(h.calls.includes('sidecar.stop'), true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
  assert.equal(h.sidecars.length, 1)
})

test('a status listener sees running after start', async () => {
  const h = harness()
  const seen: string[] = []
  h.orchestrator.onStatus((status) => seen.push(`${status.state}:${status.loggedIn}`))
  await h.orchestrator.start()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(seen.includes('starting:true'), true)
  assert.equal(seen.includes('running:true'), true)
})

test('an unmanaged leftover proxy is not reported as ours', async () => {
  const h = harness()
  h.systemProxy.entries = [permissiveEntry()]

  const status = await h.orchestrator.status()

  assert.equal(status.systemProxyEnabled, false)
  assert.equal(status.localCaptureEnabled, false)
})
