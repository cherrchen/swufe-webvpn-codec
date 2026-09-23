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
  assert.equal(
    status.error?.message,
    '检测到代理环境冲突：系统代理已启用，或存在 VPN / 代理工具的 TUN（虚拟网卡）模式。请先关闭 Clash / mihomo / 其它 VPN 的系统代理与 TUN 模式后再试。',
  )
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

test('a fake-ip upstream refuses the start so the bridge cannot hang', async () => {
  const h = harness({ resolveUpstream: async () => ['198.18.0.12'] })

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'error')
  assert.equal(status.error?.code, 'PROXY_CONFLICT')
  assert.match(status.error?.message ?? '', /TUN/)
  assert.equal(h.calls.includes('proxy.enable'), false)
  assert.equal(h.sidecars.length, 0)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('the fake-ip preflight runs after the proxy conflict and before the port probe', async () => {
  const h = harness({
    resolveUpstream: async () => ['198.18.0.12'],
    portProbe: async () => false,
  })

  // A busy port would be BRIDGE_CRASH: the conflict check wins because it comes first.
  assert.equal((await h.orchestrator.start()).error?.code, 'PROXY_CONFLICT')
})

test('a resolver failure never blocks an otherwise valid start', async () => {
  const h = harness({
    resolveUpstream: async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    },
  })

  assert.equal((await h.orchestrator.start()).state, 'running')
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

test('a partially successful system command is rolled back before start fails', async () => {
  const h = harness()
  h.systemProxy.enableFailureAfterWeb = new Error('secure proxy write denied')

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'error')
  assert.match(status.error?.message ?? '', /secure proxy write denied/)
  assert.equal(h.systemProxy.entries[0]?.web.enabled, false)
  assert.equal(h.systemProxy.entries[0]?.secure.enabled, false)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
  assert.equal(h.calls.includes('sidecar.stop'), true)
})

test('a failed rollback retains proxy ownership until a later recovery succeeds', async () => {
  const h = harness()
  h.systemProxy.enableFailureAfterWeb = new Error('secure proxy write denied')
  h.systemProxy.disableFailure = new Error('rollback denied')

  const status = await h.orchestrator.start()

  assert.match(status.error?.message ?? '', /代理回滚失败：rollback denied/)
  assert.equal(h.systemProxy.entries[0]?.web.enabled, true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)
  await h.orchestrator.recoverOnLaunch()
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)

  h.systemProxy.disableFailure = null
  await h.orchestrator.recoverOnLaunch()
  assert.equal(h.systemProxy.entries[0]?.web.enabled, false)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
})

test('partial cleanup on stop keeps the recovery marker and retries the remaining proxy', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.systemProxy.disableFailureAfterWeb = new Error('secure proxy disable denied')

  const status = await h.orchestrator.stop()

  assert.equal(status.state, 'error')
  assert.equal(h.systemProxy.entries[0]?.web.enabled, false)
  assert.equal(h.systemProxy.entries[0]?.secure.enabled, true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)
  h.systemProxy.disableFailureAfterWeb = null
  await h.orchestrator.recoverOnLaunch()
  assert.equal(h.systemProxy.entries[0]?.secure.enabled, false)
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

test('session expiry reports a cleanup failure and retains the recovery marker', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.systemProxy.disableFailure = new Error('permission denied')

  await h.orchestrator.handleSessionExpired()

  const status = await h.orchestrator.status()
  assert.equal(status.error?.code, 'SESSION_EXPIRED')
  assert.match(status.error?.message ?? '', /系统代理清理失败：permission denied/)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)
  assert.equal(h.calls.includes('sidecar.stop'), true)
  assert.equal(h.calls.includes('session.clear'), true)
})

test('overlapping expiry and stop requests share one cleanup', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.calls.length = 0

  await Promise.all([
    h.orchestrator.handleSessionExpired(),
    h.orchestrator.handleSessionExpired(),
    h.orchestrator.stop(),
  ])

  assert.equal(h.calls.filter((call) => call === 'proxy.disable').length, 1)
  assert.equal(h.calls.filter((call) => call === 'sidecar.stop').length, 1)
  assert.equal(h.calls.filter((call) => call === 'session.clear').length, 1)
  assert.equal((await h.orchestrator.status()).error?.code, 'SESSION_EXPIRED')
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

function runtimeCapture(userDataDir: string): unknown {
  const payload = JSON.parse(readFileSync(join(userDataDir, 'bridge-config.json'), 'utf-8')) as {
    capture: unknown
  }
  return payload.capture
}

test('starting in selected-apps mode captures apps instead of setting a system proxy', async () => {
  const h = harness()
  h.store.updateSettings({
    captureMode: 'selected-apps',
    captureProcesses: ['/Applications/Google Chrome.app/'],
  })

  const status = await h.orchestrator.start()

  assert.equal(status.state, 'running')
  assert.equal(status.systemProxyEnabled, false)
  assert.equal(status.localCaptureEnabled, false)
  assert.equal(h.calls.includes('proxy.enable'), false)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
  assert.deepEqual(runtimeCapture(h.userDataDir), {
    processes: ['/Applications/Google Chrome.app/'],
  })
})

test('system-proxy mode never writes capture patterns to the sidecar', async () => {
  const h = harness()
  h.store.updateSettings({ captureProcesses: ['/usr/bin/curl'] })

  await h.orchestrator.start()

  assert.deepEqual(runtimeCapture(h.userDataDir), { processes: [] })
})

test('switching to selected-apps while running revokes the system proxy', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.calls.length = 0

  await h.orchestrator.setCaptureMode('selected-apps')

  assert.equal(h.calls.includes('proxy.disable'), true)
  assert.equal(h.calls.includes('proxy.enable'), false)
  assert.equal(h.store.getSettings().captureMode, 'selected-apps')
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
  const before = await h.orchestrator.status()
  assert.equal(before.systemProxyEnabled, false)
  assert.equal(before.localCaptureEnabled, false)

  h.sidecars[0]?.reportCapture({
    enabled: true,
    processes: ['/Applications/Google Chrome.app/'],
    error: null,
  })

  const after = await h.orchestrator.status()
  assert.equal(after.localCaptureEnabled, true)
  assert.equal(after.captureError, undefined)
})

test('switching back to system-proxy restores the proxy and the marker', async () => {
  const h = harness()
  h.store.updateSettings({ captureMode: 'selected-apps' })
  await h.orchestrator.start()
  h.calls.length = 0

  await h.orchestrator.setCaptureMode('system-proxy')

  assert.equal(h.calls.includes('proxy.enable'), true)
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)
  assert.equal((await h.orchestrator.status()).systemProxyEnabled, true)
  assert.deepEqual(runtimeCapture(h.userDataDir), { processes: [] })
})

test('a failed switch to system-proxy leaves selected-apps persisted and active', async () => {
  const h = harness()
  h.store.updateSettings({ captureMode: 'selected-apps', captureProcesses: ['/usr/bin/curl'] })
  await h.orchestrator.start()
  h.systemProxy.enableFailureAfterWeb = new Error('secure proxy write denied')

  await assert.rejects(h.orchestrator.setCaptureMode('system-proxy'), /secure proxy write denied/)

  assert.equal(h.store.getSettings().captureMode, 'selected-apps')
  assert.equal(h.store.getSettings().systemProxyManagedByApp, false)
  assert.deepEqual(runtimeCapture(h.userDataDir), { processes: ['/usr/bin/curl'] })
  assert.equal(h.systemProxy.entries[0]?.web.enabled, false)
  assert.equal((await h.orchestrator.status()).state, 'running')
})

test('failed proxy rollback stops local capture instead of running both modes', async () => {
  const h = harness()
  h.store.updateSettings({ captureMode: 'selected-apps', captureProcesses: ['/usr/bin/curl'] })
  await h.orchestrator.start()
  h.systemProxy.enableFailureAfterWeb = new Error('secure proxy write denied')
  h.systemProxy.disableFailure = new Error('rollback denied')

  await assert.rejects(h.orchestrator.setCaptureMode('system-proxy'), /代理回滚失败/)

  assert.equal(h.store.getSettings().captureMode, 'selected-apps')
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)
  assert.equal((await h.orchestrator.status()).state, 'error')
  assert.equal(h.calls.includes('sidecar.stop'), true)
})

test('a failed switch to selected-apps preserves system-proxy mode and ownership', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.systemProxy.disableFailureAfterWeb = new Error('secure proxy disable denied')

  await assert.rejects(h.orchestrator.setCaptureMode('selected-apps'), /secure proxy disable denied/)

  assert.equal(h.store.getSettings().captureMode, 'system-proxy')
  assert.equal(h.store.getSettings().systemProxyManagedByApp, true)
  assert.deepEqual(runtimeCapture(h.userDataDir), { processes: [] })
  assert.equal(h.systemProxy.entries[0]?.secure.enabled, true)
})

test('selecting apps is refused while another tool owns the system proxy', async () => {
  const h = harness()
  await h.orchestrator.start()
  h.systemProxy.entries = [conflictEntry(7890)]
  h.calls.length = 0

  let failure: { code?: string; message?: string } | null = null
  try {
    await h.orchestrator.setCaptureMode('selected-apps')
  } catch (error) {
    failure = error as { code?: string; message?: string }
  }

  assert.equal(failure?.code, 'PROXY_CONFLICT')
  assert.match(failure?.message ?? '', /^检测到代理环境冲突：.*TUN/)
  assert.equal(h.store.getSettings().captureMode, 'system-proxy')
  assert.equal(h.calls.includes('proxy.disable'), false)
  assert.deepEqual(runtimeCapture(h.userDataDir), { processes: [] })
})

test('a capture failure is reported as a status field, not a bridge error', async () => {
  const h = harness()
  h.store.updateSettings({ captureMode: 'selected-apps', captureProcesses: ['/usr/bin/curl'] })
  await h.orchestrator.start()

  h.sidecars[0]?.reportCapture({ enabled: false, processes: [], error: 'macOS 系统扩展未授权' })

  const status = await h.orchestrator.status()
  assert.equal(status.state, 'running')
  assert.equal(status.localCaptureEnabled, false)
  assert.equal(status.captureError, 'macOS 系统扩展未授权')
  assert.equal(status.error, undefined)
})

test('retrying the same capture mode still re-sends the runtime config', async () => {
  const h = harness()
  h.store.updateSettings({ captureMode: 'selected-apps', captureProcesses: ['/usr/bin/curl'] })
  await h.orchestrator.start()
  h.sidecars[0]?.reportCapture({ enabled: false, processes: [], error: 'capture failed' })
  assert.equal((await h.orchestrator.status()).captureError, 'capture failed')

  await h.orchestrator.setCaptureMode('selected-apps')

  assert.equal((await h.orchestrator.status()).captureError, undefined)
  assert.deepEqual(runtimeCapture(h.userDataDir), { processes: ['/usr/bin/curl'] })
})

test('a capture failure is cleared by the next stop', async () => {
  const h = harness()
  h.store.updateSettings({ captureMode: 'selected-apps', captureProcesses: ['/usr/bin/curl'] })
  await h.orchestrator.start()
  h.sidecars[0]?.reportCapture({ enabled: false, processes: [], error: 'boom' })

  await h.orchestrator.stop()

  assert.equal((await h.orchestrator.status()).captureError, undefined)
})
