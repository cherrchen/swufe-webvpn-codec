import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mapSidecarError, parseSidecarLine } from '../src/main/sidecar'

test('ready lines carry the effective listener summary', () => {
  const event = parseSidecarLine(
    'swufe-ready {"listen_host":"127.0.0.1","listen_port":8080,"allowlist":["jwxt.swufe.edu.cn"],"cookies":1}',
  )

  assert.deepEqual(event, {
    kind: 'ready',
    payload: {
      listen_host: '127.0.0.1',
      listen_port: 8080,
      allowlist: ['jwxt.swufe.edu.cn'],
      cookies: 1,
    },
  })
})

test('error lines keep code and message', () => {
  assert.deepEqual(parseSidecarLine('swufe-error CONFIG_INVALID config file is not valid JSON'), {
    kind: 'error',
    code: 'CONFIG_INVALID',
    message: 'config file is not valid JSON',
  })
  assert.deepEqual(parseSidecarLine('swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn'), {
    kind: 'error',
    code: 'ALLOWLIST_EMPTY',
    message: 'allowlist 为空：请添加主机或启用 *.swufe.edu.cn',
  })
})

test('debug lines are reduced to the five documented keys', () => {
  const event = parseSidecarLine(
    'swufe-debug {"ts":"2026-09-21T10:00:00+00:00","host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"request","detail":null,"cookie":"wrdvpn_session=SECRET","body":"<html>page</html>"}',
  )

  assert.deepEqual(event, {
    kind: 'debug',
    event: {
      ts: '2026-09-21T10:00:00+00:00',
      host: 'jwxt.swufe.edu.cn',
      rewritten: true,
      direction: 'request',
    },
  })
  assert.equal(JSON.stringify(event).includes('SECRET'), false)
  assert.equal(JSON.stringify(event).includes('<html>'), false)
})

test('capture lines are reduced to the three documented keys', () => {
  const event = parseSidecarLine(
    'swufe-capture {"enabled":true,"processes":["/Applications/Google Chrome.app/"],"error":null,"extra":"x","cookies":[{"value":"SECRET"}]}',
  )

  assert.deepEqual(event, {
    kind: 'capture',
    report: {
      enabled: true,
      processes: ['/Applications/Google Chrome.app/'],
      error: null,
    },
  })
  assert.equal(JSON.stringify(event).includes('SECRET'), false)
})

test('capture line edge cases default instead of throwing', () => {
  assert.deepEqual(parseSidecarLine('swufe-capture {"enabled":true}'), {
    kind: 'capture',
    report: { enabled: true, processes: [], error: null },
  })
  assert.deepEqual(parseSidecarLine('swufe-capture {"enabled":false,"processes":[1,"a"],"error":"boom"}'), {
    kind: 'capture',
    report: { enabled: false, processes: ['a'], error: 'boom' },
  })
  assert.equal(parseSidecarLine('swufe-capture {not json'), null)
  assert.equal(parseSidecarLine('swufe-capture [1,2]'), null)
})

test('unrelated and malformed lines are ignored', () => {
  assert.equal(parseSidecarLine('some mitmproxy log line'), null)
  assert.equal(parseSidecarLine('swufe-ready {not json'), null)
  assert.equal(parseSidecarLine('swufe-debug [1,2]'), null)
  assert.equal(parseSidecarLine('swufe-error '), null)
  assert.deepEqual(parseSidecarLine('swufe-session expired'), { kind: 'session-expired' })
})

test('sidecar failures map onto the two UI error codes', () => {
  assert.equal(mapSidecarError('ALLOWLIST_EMPTY'), 'ALLOWLIST_EMPTY')
  assert.equal(mapSidecarError('CONFIG_INVALID'), 'BRIDGE_CRASH')
  assert.equal(mapSidecarError('LISTEN_NOT_LOOPBACK'), 'BRIDGE_CRASH')
  // Plain crash / exit code 2 without a reported code.
  assert.equal(mapSidecarError(null), 'BRIDGE_CRASH')
})
