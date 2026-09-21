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
  // Measured on macOS 15.6 with `-Z`: the hash lines precede the attributes dump.
  const stdout = `SHA-256 hash: B85643D1C7F3328FBA9BE128A19C68A8B334045CD156427FC2ADD3B142BE858A
SHA-1 hash: 09C58DE3212EC3B26CC1CA355B66D813044A447B
keychain: "/Library/Keychains/System.keychain"
version: 256
class: 0x80001000
attributes:
    "labl"<blob>="mitmproxy"
`

  assert.deepEqual(parseFindCertificate(stdout), {
    found: true,
    sha1: '09C58DE3212EC3B26CC1CA355B66D813044A447B',
  })
})

test('find-certificate without -Z prints no hash line, so no fingerprint is available', () => {
  // Measured on macOS 15.6: the same command without `-Z` prints only the dump.
  const stdout = `keychain: "/Library/Keychains/System.keychain"
version: 256
class: 0x80001000
attributes:
    "labl"<blob>="mitmproxy"
`

  assert.deepEqual(parseFindCertificate(stdout), { found: true, sha1: null })
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
