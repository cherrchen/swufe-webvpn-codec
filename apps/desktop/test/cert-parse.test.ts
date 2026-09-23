import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import { test } from 'node:test'

import { parseFindCertificateHashes } from '../src/main/platform/parse'
import { caFingerprint, caPaths } from '../src/main/platform/ca-files'

const caCert = join(process.cwd(), 'test', 'fixtures', 'ca-cert.pem')

test('find-certificate with no match prints nothing and must not be read as installed', () => {
  // Measured on macOS 15.8: exit code 0 with zero bytes of output.
  assert.deepEqual(parseFindCertificateHashes(''), [])
  assert.deepEqual(parseFindCertificateHashes('\n'), [])
})

test('find-certificate lists every same-name certificate so only our fingerprint matches', () => {
  // Measured on macOS 15.6 with `-Z`: the hash lines precede the attributes dump.
  const ours = caFingerprint(caCert)
  const other = 'A'.repeat(40)
  const stdout = `SHA-1 hash: ${other}
keychain: "/Library/Keychains/System.keychain"
version: 256
class: 0x80001000
attributes:
    "labl"<blob>="mitmproxy"
SHA-1 hash: ${ours.toLowerCase()}
keychain: "/Library/Keychains/System.keychain"
attributes:
    "labl"<blob>="mitmproxy"
`

  assert.deepEqual(parseFindCertificateHashes(stdout), [other, ours])
  assert.notEqual(parseFindCertificateHashes(stdout)[0], ours)
})

test('find-certificate without -Z prints no hash line, so no fingerprint is available', () => {
  // Measured on macOS 15.6: the same command without `-Z` prints only the dump.
  const stdout = `keychain: "/Library/Keychains/System.keychain"
version: 256
class: 0x80001000
attributes:
    "labl"<blob>="mitmproxy"
`

  assert.deepEqual(parseFindCertificateHashes(stdout), [])
})

test('CA files follow the mitmproxy basename inside the confdir', () => {
  const confdir = join('tmp', 'conf')
  const paths = caPaths(confdir)

  assert.equal(basename(paths.caPem), 'mitmproxy-ca.pem')
  assert.equal(basename(paths.caCert), 'mitmproxy-ca-cert.pem')
  assert.equal(basename(paths.caCer), 'mitmproxy-ca-cert.cer')
  assert.equal(dirname(paths.caPem), confdir)
  assert.equal(dirname(paths.caCert), confdir)
  assert.equal(dirname(paths.caCer), confdir)
})
