/** macOS trust-store adapter: `security` + an osascript-administered write. */

import { existsSync } from 'node:fs'

import { CA_BASENAME, SYSTEM_KEYCHAIN } from '../../constants'
import { run, runPrivilegedDarwin, type RunResult } from '../../exec'
import { parseFindCertificate } from '../parse'
import type { CertManager } from '../types'
import { caPaths, ensureCaFiles } from '../ca-files'

// `-Z` is required: without it macOS prints only the attributes dump and no
// `SHA-1 hash:` line, so the fingerprint for `delete-certificate` is unobtainable.
const CERT_SELECTOR = ['find-certificate', '-a', '-c', CA_BASENAME, '-Z', SYSTEM_KEYCHAIN]

function manualHint(command: string, result: RunResult): string {
  const reason = result.stderr.trim().split('\n').filter(Boolean).at(-1) ?? `退出码 ${result.code}`
  return `${reason}。可手动执行：sudo ${command}`
}

export class DarwinCertManager implements CertManager {
  constructor(
    private readonly confdir: string,
    private readonly repoRoot: string,
  ) {}

  async getStatus(): Promise<{ installed: boolean; trusted: boolean }> {
    const { caCert } = caPaths(this.confdir)
    if (!existsSync(caCert)) return { installed: false, trusted: false }
    const found = parseFindCertificate((await run('/usr/bin/security', CERT_SELECTOR)).stdout)
    const verify = await run('/usr/bin/security', ['verify-cert', '-c', caCert, '-p', 'ssl'])
    return { installed: found.found, trusted: verify.code === 0 }
  }

  async install(): Promise<{ ok: boolean; message?: string }> {
    let caCert: string
    try {
      caCert = await ensureCaFiles(this.confdir, this.repoRoot)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    const command = `/usr/bin/security add-trusted-cert -d -r trustRoot -k ${SYSTEM_KEYCHAIN} "${caCert}"`
    const result = await runPrivilegedDarwin(command)
    if (result.code !== 0) return { ok: false, message: manualHint(command, result) }
    const status = await this.getStatus()
    if (!status.installed || !status.trusted) {
      return { ok: false, message: '证书已写入，但系统信任库仍未信任该证书。' }
    }
    return { ok: true }
  }

  async uninstall(): Promise<{ ok: boolean; message?: string }> {
    if (!(await this.getStatus()).installed) return { ok: true }
    const found = parseFindCertificate((await run('/usr/bin/security', CERT_SELECTOR)).stdout)
    if (!found.sha1) return { ok: false, message: '未能取得系统信任库中的证书指纹。' }
    const command = `/usr/bin/security delete-certificate -Z "${found.sha1}" ${SYSTEM_KEYCHAIN}`
    const result = await runPrivilegedDarwin(command)
    if (result.code !== 0) return { ok: false, message: manualHint(command, result) }
    if ((await this.getStatus()).installed) {
      return { ok: false, message: '证书仍在系统信任库中，请手动确认。' }
    }
    return { ok: true }
  }
}
