import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'

import { AppStore, normalizeCapturePatterns, normalizeHost } from '../src/main/store'
import { tempUserDataDir } from './helpers/fakes'

test('first run writes the documented defaults with a settings sibling key', () => {
  const dir = tempUserDataDir()
  const store = new AppStore(dir)

  store.load()

  const raw = JSON.parse(readFileSync(store.path, 'utf-8')) as Record<string, unknown>
  assert.deepEqual(raw.hosts, ['jwxt.swufe.edu.cn'])
  assert.equal(raw.includeSwufeWildcard, false)
  assert.equal(typeof raw.updatedAt, 'string')
  assert.deepEqual(raw.settings, {
    bridgePort: 8080,
    debugLogging: false,
    captureMode: 'system-proxy',
    captureProcesses: [],
    webvpnBase: 'https://webvpn.swufe.edu.cn',
    wrdKey: 'wrdvpnisthebest!',
    wrdIv: 'wrdvpnisthebest!',
    systemProxyManagedByApp: false,
  })
  assert.deepEqual(store.getAllowlist(), { hosts: ['jwxt.swufe.edu.cn'], includeSwufeWildcard: false })
})

test('allowlist and settings round-trip through the same file', () => {
  const dir = tempUserDataDir()
  const store = new AppStore(dir)
  store.load()

  store.setAllowlist({ hosts: ['Jwxt.SWUFE.edu.cn', 'portal.swufe.edu.cn', 'jwxt.swufe.edu.cn'], includeSwufeWildcard: true })
  store.updateSettings({
    debugLogging: true,
    systemProxyManagedByApp: true,
    captureMode: 'selected-apps',
    captureProcesses: ['/usr/bin/curl', '/Applications/Google Chrome.app/'],
  })

  const reloaded = new AppStore(dir)
  reloaded.load()
  assert.deepEqual(reloaded.getAllowlist(), {
    hosts: ['jwxt.swufe.edu.cn', 'portal.swufe.edu.cn'],
    includeSwufeWildcard: true,
  })
  const settings = reloaded.getSettings()
  assert.equal(settings.debugLogging, true)
  assert.equal(settings.systemProxyManagedByApp, true)
  assert.equal(settings.captureMode, 'selected-apps')
  assert.deepEqual(settings.captureProcesses, ['/usr/bin/curl', '/Applications/Google Chrome.app/'])
})

test('capture settings fall back to defaults when the file is invalid', () => {
  const dir = tempUserDataDir()
  const store = new AppStore(dir)
  writeFileSync(
    store.path,
    JSON.stringify({
      hosts: ['jwxt.swufe.edu.cn'],
      includeSwufeWildcard: false,
      settings: {
        captureMode: 'everything',
        captureProcesses: ['/usr/bin/curl', '/bin/a,b', '', 7, '/usr/bin/curl'],
      },
    }),
  )

  store.load()

  const settings = store.getSettings()
  assert.equal(settings.captureMode, 'system-proxy')
  assert.deepEqual(settings.captureProcesses, ['/usr/bin/curl'])
})

test('invalid capture patches are rejected and the file is left untouched', () => {
  const store = new AppStore(tempUserDataDir())
  store.load()
  const before = readFileSync(store.path, 'utf-8')

  assert.throws(() => store.updateSettings({ captureMode: 'everything' as never }), /捕获方式不合法/)
  assert.throws(() => store.updateSettings({ captureProcesses: ['/bin/a,b'] }), /捕获进程列表不合法/)
  assert.throws(() => store.updateSettings({ captureProcesses: [''] }), /捕获进程列表不合法/)
  assert.throws(
    () => store.updateSettings({ captureProcesses: ['/usr/bin/curl', '/usr/bin/curl'] }),
    /捕获进程列表不合法/,
  )
  assert.throws(
    () =>
      store.updateSettings({
        captureProcesses: Array.from({ length: 33 }, (_, index) => `/usr/bin/app-${index}`),
      }),
    /最多只能选择 32 个应用/,
  )

  assert.equal(readFileSync(store.path, 'utf-8'), before)
})

test('capture patterns are trimmed and deduplicated by one rule', () => {
  assert.deepEqual(normalizeCapturePatterns(['  /usr/bin/curl ', '/usr/bin/curl', '', 5, 'a,b']), [
    '/usr/bin/curl',
  ])
  assert.deepEqual(normalizeCapturePatterns('not an array'), [])
})

test('invalid hosts are rejected and the file is left untouched', () => {
  const store = new AppStore(tempUserDataDir())
  store.load()
  const before = readFileSync(store.path, 'utf-8')

  for (const host of ['http://jwxt.swufe.edu.cn', 'jwxt.swufe.edu.cn:443', '*.swufe.edu.cn', 'a_b.c', '', '-bad.example.com', 'x'.repeat(64) + '.com']) {
    assert.throws(() => store.setAllowlist({ hosts: [host], includeSwufeWildcard: false }), /主机名不合法/)
  }
  assert.equal(readFileSync(store.path, 'utf-8'), before)
})

test('hostnames are lowercased and trailing dots drop', () => {
  assert.equal(normalizeHost('Example.com '), 'example.com')
  assert.equal(normalizeHost('PORTAL.swufe.edu.cn.'), 'portal.swufe.edu.cn')
})

test('an unparsable file is preserved as config.json.bad and replaced by defaults', () => {
  const dir = tempUserDataDir()
  const store = new AppStore(dir)
  store.load()
  const broken = '{ not json'
  writeFileSync(store.path, broken)

  const reloaded = new AppStore(dir)
  reloaded.load()

  assert.equal(readFileSync(`${store.path}.bad`, 'utf-8'), broken)
  assert.deepEqual(reloaded.getAllowlist(), { hosts: ['jwxt.swufe.edu.cn'], includeSwufeWildcard: false })
  assert.equal(existsSync(store.path), true)
})

test('a semantically invalid host in the file is backed up rather than silently dropped', () => {
  const dir = tempUserDataDir()
  const store = new AppStore(dir)
  writeFileSync(store.path, JSON.stringify({ hosts: ['not a host'], includeSwufeWildcard: false }))

  store.load()

  assert.equal(existsSync(`${store.path}.bad`), true)
  assert.deepEqual(store.getAllowlist(), { hosts: ['jwxt.swufe.edu.cn'], includeSwufeWildcard: false })
})

test('an empty allowlist survives a reload (it drives ALLOWLIST_EMPTY)', () => {
  const dir = tempUserDataDir()
  const store = new AppStore(dir)
  store.load()

  store.setAllowlist({ hosts: [], includeSwufeWildcard: false })

  assert.deepEqual(new AppStore(dir).getAllowlist(), { hosts: [], includeSwufeWildcard: false })
})

test('invalid settings patches are rejected', () => {
  const store = new AppStore(tempUserDataDir())
  store.load()

  assert.throws(() => store.updateSettings({ bridgePort: 70000 }), /端口不合法/)
  assert.throws(() => store.updateSettings({ wrdKey: 'short' }), /必须为 16 字节/)
})
