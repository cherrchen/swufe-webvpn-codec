/** Windows trust-store adapter: `certutil` against the per-user Root store. */

import { existsSync } from 'node:fs'

import { run } from '../../exec'
import { parseCertutilHashes } from '../parse'
import type { CertManager } from '../types'
import { caFingerprint, caPaths, ensureCaFiles } from '../ca-files'

export class Win32CertManager implements CertManager {
  constructor(
    private readonly confdir: string,
    private readonly bridgeRoot: string,
    private readonly execute: typeof run = run,
  ) {}

  async getStatus(): Promise<{ installed: boolean; trusted: boolean }> {
    const { caCert } = caPaths(this.confdir)
    if (!existsSync(caCert)) return { installed: false, trusted: false }
    const fingerprint = caFingerprint(caCert)
    const result = await this.execute('certutil', ['-user', '-store', 'Root', fingerprint])
    const installed = result.code === 0 && parseCertutilHashes(result.stdout).includes(fingerprint)
    // The per-user Root store is itself the trust decision on Windows.
    return { installed, trusted: installed }
  }

  async install(): Promise<{ ok: boolean; message?: string }> {
    let caCert: string
    try {
      caCert = await ensureCaFiles(this.confdir, this.bridgeRoot)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    const result = await this.execute('certutil', ['-user', '-addstore', 'Root', caCert])
    if (result.code !== 0) {
      const reason = result.stderr.trim().split('\n').filter(Boolean).at(-1) ?? `退出码 ${result.code}`
      return { ok: false, message: `${reason}。可手动执行：certutil -user -addstore Root "${caCert}"` }
    }
    if (!(await this.getStatus()).installed) {
      return { ok: false, message: '证书已导入，但当前用户根存储中仍查不到该证书。' }
    }
    return { ok: true }
  }

  async uninstall(): Promise<{ ok: boolean; message?: string }> {
    if (!(await this.getStatus()).installed) return { ok: true }
    const { caCert } = caPaths(this.confdir)
    const fingerprint = caFingerprint(caCert)
    const result = await this.execute('certutil', ['-user', '-delstore', 'Root', fingerprint])
    if (result.code !== 0) {
      const reason = result.stderr.trim().split('\n').filter(Boolean).at(-1) ?? `退出码 ${result.code}`
      return { ok: false, message: `${reason}。可手动执行：certutil -user -delstore Root ${fingerprint}` }
    }
    if ((await this.getStatus()).installed) {
      return { ok: false, message: '证书仍在当前用户根存储中，请手动确认。' }
    }
    return { ok: true }
  }
}
