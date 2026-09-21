import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyProbe } from '../src/main/session-probe'

const WEBVPN = 'webvpn.swufe.edu.cn'

test('a 2xx portal response keeps the session valid', () => {
  assert.equal(classifyProbe(200, null, null, WEBVPN), 'valid')
  assert.equal(classifyProbe(204, null, null, WEBVPN), 'valid')
})

test('a redirect to the WebVPN login page means the session expired', () => {
  // M1 measured exactly this on an unauthenticated upstream: 302 → https://webvpn.swufe.edu.cn/login
  assert.equal(classifyProbe(302, WEBVPN, '/login', WEBVPN), 'expired')
  assert.equal(classifyProbe(302, WEBVPN, '/login?service=x', WEBVPN), 'expired')
})

test('a redirect to CAS means the session expired', () => {
  assert.equal(classifyProbe(302, 'authserver.swufe.edu.cn', '/authserver/login', WEBVPN), 'expired')
})

test('unrelated redirects, errors and network failures never change the state', () => {
  assert.equal(classifyProbe(302, WEBVPN, '/https/77726476706e/sso/jziotlogin', WEBVPN), 'unknown')
  assert.equal(classifyProbe(302, 'example.com', '/', WEBVPN), 'unknown')
  assert.equal(classifyProbe(401, null, null, WEBVPN), 'unknown')
  assert.equal(classifyProbe(500, null, null, WEBVPN), 'unknown')
  assert.equal(classifyProbe(0, null, null, WEBVPN), 'unknown')
  assert.equal(classifyProbe(302, null, null, WEBVPN), 'unknown')
})
