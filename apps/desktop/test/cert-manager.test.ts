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

test('Windows queries and deletes the exact CA fingerprint', async () => {
  const { dir, fingerprint } = localCa()
  let installed = true
  const calls: string[][] = []
  const manager = new Win32CertManager(dir, '', async (_command, args) => {
    calls.push(args)
    if (args[1] === '-store') {
      return ok(`Cert Hash(sha1): ${other}\n${installed ? `Cert Hash(sha1): ${fingerprint}\n` : ''}`)
    }
    if (args[1] === '-delstore') installed = false
    return ok()
  })

  assert.deepEqual(await manager.getStatus(), { installed: true, trusted: true })
  assert.deepEqual(await manager.uninstall(), { ok: true })
  assert.equal(calls.every((args) => args[3] === fingerprint), true)
  assert.equal((await manager.getStatus()).installed, false)
})
