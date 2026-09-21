import assert from 'node:assert/strict'
import { test } from 'node:test'

import { certutilHasCert, parseFindCertificate } from '../src/main/platform/parse'
import { caPaths } from '../src/main/platform/ca-files'

test('find-certificate with no match prints nothing and must not be read as installed', () => {
  // Measured on macOS 15.8: exit code 0 with zero bytes of output.
  assert.deepEqual(parseFindCertificate(''), { found: false, sha1: null })
  assert.deepEqual(parseFindCertificate('\n'), { found: false, sha1: null })
})

test('find-certificate output yields the SHA-1 fingerprint', () => {
  const stdout = `keychain: "/Library/Keychains/System.keychain"
class: 0x80001000
attributes:
    "labl"<blob>="mitmproxy"
SHA-1 hash: 1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d
`

  assert.deepEqual(parseFindCertificate(stdout), {
    found: true,
    sha1: '1A2B3C4D5E6F708192A3B4C5D6E7F8091A2B3C4D',
  })
})

test('certutil store listing decides presence on Windows', () => {
  assert.equal(
    certutilHasCert(`
================ Certificate 0 ================
Serial Number: 1234
Cert Hash(sha1): 1a2b3c
`),
    true,
  )
  assert.equal(certutilHasCert('Root "Certificates"\n----------------\nCertUtil: -store command completed successfully.\n'), false)
})

test('CA files follow the mitmproxy basename inside the confdir', () => {
  const paths = caPaths('/tmp/conf')

  assert.equal(paths.caPem, '/tmp/conf/mitmproxy-ca.pem')
  assert.equal(paths.caCert, '/tmp/conf/mitmproxy-ca-cert.pem')
  assert.equal(paths.caCer, '/tmp/conf/mitmproxy-ca-cert.cer')
})
