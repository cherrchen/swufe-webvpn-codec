/** Windows trust-store adapter: `certutil` against the per-user Root store. */

import { existsSync } from 'node:fs'

import { PRIVILEGE_PROMPT_TIMEOUT_MS } from '../../constants'
import { run, type RunResult } from '../../exec'
import type { CertManager } from '../types'
import { caFingerprint, caPaths, ensureCaFiles } from '../ca-files'

/** Per-user Root store backing; one key per certificate thumbprint (uppercase, no separators). */
const USER_ROOT_CERTIFICATES = 'HKCU\\Software\\Microsoft\\SystemCertificates\\Root\\Certificates'

export class Win32CertManager implements CertManager {
  constructor(
    private readonly confdir: string,
    private readonly bridgeRoot: string,
    private readonly execute: typeof run = run,
    /** The Python CA entry point; injectable so the install path stays unit-testable. */
    private readonly ensureCa: typeof ensureCaFiles = ensureCaFiles,
  ) {}

  async getStatus(): Promise<{ installed: boolean; trusted: boolean }> {
    const { caCert } = caPaths(this.confdir)
    if (!existsSync(caCert)) return { installed: false, trusted: false }
    const fingerprint = caFingerprint(caCert)
    // `certutil -user -store Root <id>` ignores the id, prints every certificate and exits 0
    // even when the id matches nothing, and its hash label is localized (`证书哈希(sha1):` on
    // Chinese Windows) — so identity is read from the store's own registry backing instead,
    // which holds exactly one key per thumbprint (KI-016).
    const result = await this.execute('reg', ['query', `${USER_ROOT_CERTIFICATES}\\${fingerprint}`])
    const installed = result.code === 0
    // The per-user Root store is itself the trust decision on Windows.
    return { installed, trusted: installed }
  }

  async install(): Promise<{ ok: boolean; message?: string }> {
    let caCert: string
    try {
      caCert = await this.ensureCa(this.confdir, this.bridgeRoot)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    const manual = `可手动执行：certutil -user -addstore Root "${caCert}"`
    let result: RunResult
    try {
      // Windows raises a "security warning" dialog before a root certificate is written and
      // `certutil` blocks on the user's click: that is a human step, so this one command gets
      // the dialog timeout instead of the default one (KI-021).
      result = await this.execute('certutil', ['-user', '-addstore', 'Root', caCert], {
        timeoutMs: PRIVILEGE_PROMPT_TIMEOUT_MS,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        message: `${reason}。请确认已在系统「安全警告」对话框中点「是(Y)」。${manual}`,
      }
    }
    if (result.code !== 0) {
      const reason = result.stderr.trim().split('\n').filter(Boolean).at(-1) ?? `退出码 ${result.code}`
      return { ok: false, message: `${reason}。${manual}` }
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
    const manual = `可手动执行：certutil -user -delstore Root ${fingerprint}`
    let result: RunResult
    try {
      // Same human step as the install: Windows asks "你想将下列证书从根存储区中删除吗?" in its
      // own dialog and `certutil` waits for the answer (KI-021).
      result = await this.execute('certutil', ['-user', '-delstore', 'Root', fingerprint], {
        timeoutMs: PRIVILEGE_PROMPT_TIMEOUT_MS,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        message: `${reason}。请确认已在系统「根证书存储」对话框中点「是(Y)」。${manual}`,
      }
    }
    if (result.code !== 0) {
      const reason = result.stderr.trim().split('\n').filter(Boolean).at(-1) ?? `退出码 ${result.code}`
      return { ok: false, message: `${reason}。${manual}` }
    }
    if ((await this.getStatus()).installed) {
      return { ok: false, message: '证书仍在当前用户根存储中，请手动确认。' }
    }
    return { ok: true }
  }
}
