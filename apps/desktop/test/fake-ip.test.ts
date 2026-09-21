import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isFakeIpAddress } from '../src/main/fake-ip'

test('the fake-ip range is 198.18.0.0/15 and nothing else', () => {
  assert.equal(isFakeIpAddress('198.18.0.0'), true)
  assert.equal(isFakeIpAddress('198.18.255.255'), true)
  assert.equal(isFakeIpAddress('198.19.0.1'), true)
  assert.equal(isFakeIpAddress('198.19.255.254'), true)

  assert.equal(isFakeIpAddress('198.17.255.255'), false)
  assert.equal(isFakeIpAddress('198.20.0.0'), false)
  assert.equal(isFakeIpAddress('125.69.85.81'), false)
  assert.equal(isFakeIpAddress('127.0.0.1'), false)
})

test('anything that is not a dotted-quad IPv4 address is not a fake-ip address', () => {
  assert.equal(isFakeIpAddress('198.18.0'), false)
  assert.equal(isFakeIpAddress('198.18.0.1.1'), false)
  assert.equal(isFakeIpAddress('198.18.0.256'), false)
  assert.equal(isFakeIpAddress('198.18.0.-1'), false)
  assert.equal(isFakeIpAddress('198.18.0.'), false)
  assert.equal(isFakeIpAddress('fe80::1'), false)
  assert.equal(isFakeIpAddress(''), false)
})
