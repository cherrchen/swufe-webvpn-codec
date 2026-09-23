/**
 * macOS trust-store adapter: `security`. Root is needed only to write the system keychain;
 * the trust settings themselves are written by this app's own process so macOS can raise the
 * authorization inside its GUI session (ADR-0008).
 */

import { existsSync } from 'node:fs'

import { CA_BASENAME, PRIVILEGE_PROMPT_TIMEOUT_MS, SYSTEM_KEYCHAIN } from '../../constants'
import { run, runPrivilegedDarwin, type RunResult } from '../../exec'
import { parseFindCertificateHashes } from '../parse'
import type { CertManager } from '../types'
import { caFingerprint, caPaths, ensureCaFiles } from '../ca-files'

const SECURITY = '/usr/bin/security'

/**
 * Trust settings for the local admin domain (REQ-010); `-d` selects that domain.
 * No `-k`: the certificate is put into the system keychain separately, because only root can write
 * there and the authorization for it must not be requested by the same process that writes trust
 * settings (ADR-0008). Used for the argv and the manual-hint text so the two cannot drift apart.
 */
const CA_TRUST_FLAGS: readonly string[] = ['add-trusted-cert', '-d', '-r', 'trustRoot']

// `-Z` is required: without it macOS prints only the attributes dump and no
// `SHA-1 hash:` line, so the fingerprint for `delete-certificate` is unobtainable.
const CERT_SELECTOR = ['find-certificate', '-a', '-c', CA_BASENAME, '-Z', SYSTEM_KEYCHAIN]

function describeFailure(command: string, result: RunResult): string {
  const reason = result.stderr.trim().split('\n').filter(Boolean).at(-1) ?? `退出码 ${result.code}`
  if (/no user interaction was possible/i.test(result.stderr)) {
    return `${reason}。系统授权窗口未能弹出：请把本应用窗口置于前台后重试。`
  }
  if (/user cancel|已取消授权/i.test(result.stderr)) return '已取消系统授权，未做任何更改。'
  return `${reason}。可手动执行：sudo ${command}`
}

export class DarwinCertManager implements CertManager {
  constructor(
    private readonly confdir: string,
    private readonly bridgeRoot: string,
    private readonly execute: typeof run = run,
    private readonly executePrivileged: typeof runPrivilegedDarwin = runPrivilegedDarwin,
  ) {}

  async getStatus(): Promise<{ installed: boolean; trusted: boolean }> {
    const { caCert } = caPaths(this.confdir)
    if (!existsSync(caCert)) return { installed: false, trusted: false }
    const fingerprint = caFingerprint(caCert)
    const found = await this.execute(SECURITY, CERT_SELECTOR)
    const verify = await this.execute(SECURITY, ['verify-cert', '-c', caCert, '-p', 'ssl'])
    return {
      installed: found.code === 0 && parseFindCertificateHashes(found.stdout).includes(fingerprint),
      trusted: verify.code === 0,
    }
  }

  async install(): Promise<{ ok: boolean; message?: string }> {
    let caCert: string
    try {
      caCert = await ensureCaFiles(this.confdir, this.bridgeRoot)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    // Step 1: only root can write the system keychain, so this goes through the administrator
    // dialog of `runPrivilegedDarwin`. Keychain-only: it never touches trust settings (ADR-0008).
    const addCommand = `${SECURITY} add-certificates -k ${SYSTEM_KEYCHAIN} "${caCert}"`
    const added = await this.executePrivileged(addCommand)
    if (added.code !== 0 && !/already in/i.test(added.stderr)) {
      return { ok: false, message: describeFailure(addCommand, added) }
    }
    // Step 2: trust settings, written by this app's own process. An osascript-administered child
    // never runs in the GUI session macOS needs to raise that authorization (KI-007, ADR-0008).
    const args = [...CA_TRUST_FLAGS, caCert]
    const result = await this.execute(SECURITY, args, { timeoutMs: PRIVILEGE_PROMPT_TIMEOUT_MS })
    if (result.code !== 0) {
      return { ok: false, message: describeFailure(`${SECURITY} ${CA_TRUST_FLAGS.join(' ')} "${caCert}"`, result) }
    }
    const status = await this.getStatus()
    if (!status.installed || !status.trusted) {
      return { ok: false, message: '证书已写入，但系统信任库仍未信任该证书。' }
    }
    return { ok: true }
  }

  async uninstall(): Promise<{ ok: boolean; message?: string }> {
    if (!(await this.getStatus()).installed) return { ok: true }
    const { caCert } = caPaths(this.confdir)
    const command = `${SECURITY} delete-certificate -Z "${caFingerprint(caCert)}" ${SYSTEM_KEYCHAIN}`
    const result = await this.executePrivileged(command)
    if (result.code !== 0) return { ok: false, message: describeFailure(command, result) }
    if ((await this.getStatus()).installed) {
      return { ok: false, message: '证书仍在系统信任库中，请手动确认。' }
    }
    return { ok: true }
  }
}
