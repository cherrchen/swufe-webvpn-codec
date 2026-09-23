import assert from 'node:assert/strict'
import { test } from 'node:test'

import { run } from '../src/main/exec'

// KI-017: `certutil -user -addstore Root` (the Windows CA install) drains stdin before it
// exits. The runner used to hand it a pipe nobody closes, so the command hung until the
// 10s timeout and every CA install failed on Windows.
test('a command that drains stdin still finishes', async () => {
  const result = await run(process.execPath, ['-e', 'process.stdin.resume()'], { timeoutMs: 5000 })

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
})

test('a non-zero exit code is reported instead of thrown', async () => {
  const result = await run(process.execPath, ['-e', 'process.stderr.write("boom"); process.exit(3)'])

  assert.equal(result.code, 3)
  assert.equal(result.stderr, 'boom')
})

test('output is captured from stdout', async () => {
  const result = await run(process.execPath, ['-e', 'process.stdout.write("hello")'])

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'hello')
})
