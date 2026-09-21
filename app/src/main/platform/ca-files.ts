/** mitmproxy CA file locations plus the "generate if missing" call into Python. */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { CA_BASENAME } from '../constants'
import { run } from '../exec'
import { resolvePythonCommand } from '../python'

export interface CaFiles {
  caPem: string
  caCert: string
  caCer: string
}

export function caPaths(confdir: string): CaFiles {
  const base = join(confdir, CA_BASENAME)
  return {
    caPem: `${base}-ca.pem`,
    caCert: `${base}-ca-cert.pem`,
    caCer: `${base}-ca-cert.cer`,
  }
}

/** Idempotent: `python -m swufe_bridge.ca --confdir <dir>`; returns the PEM cert path. */
export async function ensureCaFiles(confdir: string, repoRoot: string): Promise<string> {
  const python = resolvePythonCommand(repoRoot)
  const result = await run(python.command, [...python.args, '-m', 'swufe_bridge.ca', '--confdir', confdir])
  if (result.code !== 0) {
    const reason = result.stderr.trim().split('\n').filter(Boolean).at(-1) ?? `退出码 ${result.code}`
    throw new Error(`CA 生成失败：${reason}`)
  }
  const payload = JSON.parse(result.stdout.trim()) as { caCert?: unknown }
  if (typeof payload.caCert !== 'string' || !existsSync(payload.caCert)) {
    throw new Error('CA 生成失败：未返回可用的证书路径')
  }
  return payload.caCert
}
