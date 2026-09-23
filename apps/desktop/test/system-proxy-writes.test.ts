import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { RunResult } from '../src/main/exec'
import { DarwinSystemProxy } from '../src/main/platform/darwin/system-proxy'
import { Win32SystemProxy } from '../src/main/platform/win32/system-proxy'

const ok = (stdout = ''): RunResult => ({ code: 0, stdout, stderr: '' })
const denied = (): RunResult => ({ code: 1, stdout: '', stderr: 'permission denied' })

test('macOS rolls back a web proxy enabled before the secure-proxy command fails', async () => {
  let webEnabled = false
  let secureEnabled = false
  let webServer = ''
  let secureServer = ''
  const commands: string[] = []
  const proxy = new DarwinSystemProxy(async (_command, args) => {
    const [verb, service, value] = args
    commands.push(`${verb} ${service ?? ''} ${value ?? ''}`)
    if (verb === '-listallnetworkservices') return ok('An asterisk (*) denotes that a network service is disabled.\nWi-Fi\n')
    if (verb === '-getwebproxy') return ok(`Enabled: ${webEnabled ? 'Yes' : 'No'}\nServer: ${webServer}\nPort: 8080\n`)
    if (verb === '-getsecurewebproxy') return ok(`Enabled: ${secureEnabled ? 'Yes' : 'No'}\nServer: ${secureServer}\nPort: 8080\n`)
    if (verb === '-setwebproxy') webServer = '127.0.0.1'
    if (verb === '-setsecurewebproxy') secureServer = '127.0.0.1'
    if (verb === '-setwebproxystate') webEnabled = value === 'on'
    if (verb === '-setsecurewebproxystate') {
      if (value === 'on') return denied()
      secureEnabled = false
    }
    return ok()
  })

  await assert.rejects(proxy.enable(8080), /permission denied/)
  assert.equal(webEnabled, true)
  await proxy.disable(8080)
  assert.equal(webEnabled, false)
  assert.equal(secureEnabled, false)
  assert.equal(commands.some((command) => command.startsWith('-setwebproxystate Wi-Fi off')), true)
})

test('Windows writes the target before enabling and can clear a partially successful enable', async () => {
  let enabled = false
  let server = 'stale.example:7890'
  const writes: Array<{ name: string; enabled: boolean; server: string }> = []
  const proxy = new Win32SystemProxy(async (_command, args) => {
    if (args[0] === 'query') {
      const name = args[3]
      return name === 'ProxyEnable'
        ? ok(`ProxyEnable    REG_DWORD    ${enabled ? '0x1' : '0x0'}\n`)
        : ok(`ProxyServer    REG_SZ    ${server}\n`)
    }
    const name = args[3] ?? ''
    const value = args[7] ?? ''
    if (name === 'ProxyServer') server = value
    if (name === 'ProxyEnable') enabled = value === '1'
    writes.push({ name, enabled, server })
    // Simulate `reg add` changing the registry but returning a failure.
    return name === 'ProxyEnable' && value === '1' ? denied() : ok()
  })

  await assert.rejects(proxy.enable(8080), /permission denied/)
  assert.deepEqual(writes[0], { name: 'ProxyServer', enabled: false, server: '127.0.0.1:8080' })
  assert.equal(enabled, true)
  await proxy.disable(8080)
  assert.equal(enabled, false)
})
