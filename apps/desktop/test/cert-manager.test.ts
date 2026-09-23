import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import type { RunResult } from '../src/main/exec'
import { caFingerprint, caPaths } from '../src/main/platform/ca-files'
import { DarwinCertManager } from '../src/main/platform/darwin/cert'
import { Win32CertManager } from '../src/main/platform/win32/cert'

const ok = (stdout = ''): RunResult => ({ code: 0, stdout, stderr: '' })
const other = 'A'.repeat(40)

function localCa(): { dir: string; fingerprint: string } {
  const dir = mkdtempSync(join(tmpdir(), 'swufe-ca-test-'))
  const path = caPaths(dir).caCert
  copyFileSync(join(process.cwd(), 'test', 'fixtures', 'ca-cert.pem'), path)
  return { dir, fingerprint: caFingerprint(path) }
}

test('macOS uninstall deletes this CA even when another mitmproxy certificate is listed first', async () => {
  const { dir, fingerprint } = localCa()
  let installed = true
  const commands: string[] = []
  const manager = new DarwinCertManager(
    dir,
    '',
    async (_command, args) => args[0] === 'find-certificate'
      ? ok(`SHA-1 hash: ${other}\n${installed ? `SHA-1 hash: ${fingerprint}\n` : ''}`)
      : ok(),
    async (command) => {
      commands.push(command)
      installed = false
      return ok()
    },
  )

  assert.deepEqual(await manager.getStatus(), { installed: true, trusted: true })
  assert.deepEqual(await manager.uninstall(), { ok: true })
  assert.equal(commands.length, 1)
  assert.match(commands[0] ?? '', new RegExp(`-Z "${fingerprint}"`))
  assert.equal((commands[0] ?? '').includes(other), false)
  assert.deepEqual(await manager.getStatus(), { installed: false, trusted: true })
})

test('macOS ignores a same-name CA when this app certificate is absent', async () => {
  const { dir } = localCa()
  let privileged = false
  const manager = new DarwinCertManager(
    dir,
    '',
    async (_command, args) => args[0] === 'find-certificate' ? ok(`SHA-1 hash: ${other}\n`) : ok(),
    async () => { privileged = true; return ok() },
  )

  assert.equal((await manager.getStatus()).installed, false)
  assert.deepEqual(await manager.uninstall(), { ok: true })
  assert.equal(privileged, false)
})

test('Windows reads CA status from the Root store and deletes the exact fingerprint', async () => {
  const { dir, fingerprint } = localCa()
  let stored = false
  const calls: string[] = []
  const manager = new Win32CertManager(dir, '', async (command, args) => {
    calls.push([command, ...args].join(' '))
    if (args.includes('-delstore')) {
      stored = false
      return ok()
    }
    // Store lookup by thumbprint: the key is either there or the command fails.
    return stored
      ? ok('HKEY_CURRENT_USER\\Software\\Microsoft\\SystemCertificates\\Root\\Certificates')
      : { code: 1, stdout: '', stderr: '错误: 系统找不到指定的注册表项。' }
  })

  assert.deepEqual(await manager.getStatus(), { installed: false, trusted: false })

  stored = true // what `certutil -user -addstore` leaves behind
  assert.deepEqual(await manager.getStatus(), { installed: true, trusted: true })

  assert.deepEqual(await manager.uninstall(), { ok: true })

  assert.deepEqual(await manager.getStatus(), { installed: false, trusted: false })
  // Identity, not a shared subject name: every lookup and the delete name this CA's fingerprint.
  assert.equal(calls.every((call) => call.includes(fingerprint)), true)
})
