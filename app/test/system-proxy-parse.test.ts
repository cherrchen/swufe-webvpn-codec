import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isConflict,
  parseNetworkServices,
  parseNetworksetupProxy,
  parsePsOutput,
  parseTasklistOutput,
  parseWinInetValue,
  shouldClear,
  winInetState,
} from '../src/main/platform/parse'

// Captured on macOS 15.8 (2026-09-21).
const LIST_SERVICES = `An asterisk (*) denotes that a network service is disabled.
Ethernet
USB 10/100/1000 LAN
Thunderbolt Bridge
Wi-Fi
iPhone USB
Stash
`

const WEB_PROXY_DISABLED = `Enabled: No
Server: 127.0.0.1
Port: 7890
Authenticated Proxy Enabled: 0
`

const WEB_PROXY_ENABLED = `Enabled: Yes
Server: 127.0.0.1
Port: 8080
Authenticated Proxy Enabled: 0
`

test('service list skips the header and marks disabled services', () => {
  const services = parseNetworkServices(LIST_SERVICES)

  assert.deepEqual(
    services.map((service) => service.name),
    ['Ethernet', 'USB 10/100/1000 LAN', 'Thunderbolt Bridge', 'Wi-Fi', 'iPhone USB', 'Stash'],
  )
  assert.equal(services.every((service) => !service.disabled), true)
  assert.deepEqual(parseNetworkServices('An asterisk (*) denotes that a network service is disabled.\n*Bluetooth PAN\nWi-Fi\n'), [
    { name: 'Bluetooth PAN', disabled: true },
    { name: 'Wi-Fi', disabled: false },
  ])
})

test('networksetup proxy output is parsed into host and port', () => {
  assert.deepEqual(parseNetworksetupProxy(WEB_PROXY_ENABLED), {
    enabled: true,
    server: '127.0.0.1',
    port: 8080,
  })
  assert.deepEqual(parseNetworksetupProxy(WEB_PROXY_DISABLED), {
    enabled: false,
    server: '127.0.0.1',
    port: 7890,
  })
  assert.deepEqual(parseNetworksetupProxy('Enabled: No\nServer: \nPort: 0\n'), {
    enabled: false,
    server: null,
    port: 0,
  })
})

test('a disabled leftover proxy is neither a conflict nor ours to clear', () => {
  const leftover = parseNetworksetupProxy(WEB_PROXY_DISABLED)

  assert.equal(isConflict(leftover, 8080), false)
  assert.equal(shouldClear(leftover, 8080), false)
  assert.equal(shouldClear(leftover, 7890), false)
})

test('a proxy pointing elsewhere is a conflict and is never cleared', () => {
  const other = { enabled: true, server: '127.0.0.1', port: 7890 }

  assert.equal(isConflict(other, 8080), true)
  assert.equal(shouldClear(other, 8080), false)
})

test('our own proxy is not a conflict and is what gets cleared', () => {
  const ours = parseNetworksetupProxy(WEB_PROXY_ENABLED)

  assert.equal(isConflict(ours, 8080), false)
  assert.equal(shouldClear(ours, 8080), true)
})

test('reg query output yields ProxyEnable and ProxyServer', () => {
  const dword = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings
    ProxyEnable    REG_DWORD    0x1
`
  const string = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings
    ProxyServer    REG_SZ    127.0.0.1:8080
`

  assert.deepEqual(parseWinInetValue(dword), { enable: true, server: null })
  assert.deepEqual(parseWinInetValue(string), { enable: null, server: '127.0.0.1:8080' })
  assert.deepEqual(winInetState(true, '127.0.0.1:8080'), { enabled: true, server: '127.0.0.1', port: 8080 })
  assert.equal(isConflict(winInetState(true, '127.0.0.1:8080'), 8080), false)
  assert.equal(shouldClear(winInetState(true, '127.0.0.1:8080'), 8080), true)
})

test('windows per-protocol proxy values conflict unless every entry is ours', () => {
  const ours = winInetState(true, 'http=127.0.0.1:8080;https=127.0.0.1:8080')
  const mixed = winInetState(true, 'http=127.0.0.1:8080;https=127.0.0.1:7890')
  const disabled = winInetState(false, '127.0.0.1:7890')

  assert.deepEqual(ours, { enabled: true, server: '127.0.0.1', port: 8080 })
  assert.equal(isConflict(ours, 8080), false)
  assert.equal(isConflict(mixed, 8080), true)
  assert.equal(shouldClear(mixed, 8080), false)
  assert.equal(isConflict(disabled, 8080), false)
  assert.equal(shouldClear(disabled, 8080), false)
})

test('process listings map onto pid/name pairs', () => {
  const ps = `    1 /sbin/launchd
  622 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 3312 (sh)
`
  assert.deepEqual(parsePsOutput(ps), [
    { pid: 1, name: '/sbin/launchd' },
    { pid: 622, name: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    { pid: 3312, name: '(sh)' },
  ])

  const tasklist = `"chrome.exe","622","Console","1","123,456 K"\r
"tasklist.exe","3312","Console","1","9,000 K"\r
`
  assert.deepEqual(parseTasklistOutput(tasklist), [
    { pid: 622, name: 'chrome.exe' },
    { pid: 3312, name: 'tasklist.exe' },
  ])
})
