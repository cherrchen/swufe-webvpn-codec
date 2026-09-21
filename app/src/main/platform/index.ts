/** Platform composition root: the only place that branches on `process.platform`. */

import { run } from '../exec'
import type { CaptureCandidate } from '../../shared/types'
import { DarwinCertManager } from './darwin/cert'
import { DarwinSystemProxy } from './darwin/system-proxy'
import { parsePsOutput, parseTasklistOutput } from './parse'
import type { CertManager, SystemProxy } from './types'
import { Win32CertManager } from './win32/cert'
import { Win32SystemProxy } from './win32/system-proxy'

export type { CertManager, ProxyEntry, SystemProxy } from './types'

class UnsupportedPlatform implements SystemProxy, CertManager {
  constructor(private readonly platform: string) {}

  read(): Promise<never> {
    return this.fail()
  }

  enable(): Promise<never> {
    return this.fail()
  }

  disable(): Promise<never> {
    return this.fail()
  }

  getStatus(): Promise<never> {
    return this.fail()
  }

  install(): Promise<never> {
    return this.fail()
  }

  uninstall(): Promise<never> {
    return this.fail()
  }

  private fail(): Promise<never> {
    return Promise.reject(new Error(`不支持的平台：${this.platform}`))
  }
}

export function createSystemProxy(): SystemProxy {
  if (process.platform === 'darwin') return new DarwinSystemProxy()
  if (process.platform === 'win32') return new Win32SystemProxy()
  return new UnsupportedPlatform(process.platform)
}

export function createCertManager(confdir: string, repoRoot: string): CertManager {
  if (process.platform === 'darwin') return new DarwinCertManager(confdir, repoRoot)
  if (process.platform === 'win32') return new Win32CertManager(confdir, repoRoot)
  return new UnsupportedPlatform(process.platform)
}

/**
 * Read-only process enumeration for the capture picker (M2: enumeration +
 * persistence; actual mitmproxy local-mode capture is M3).
 */
export async function listCaptureCandidates(): Promise<CaptureCandidate[]> {
  if (process.platform === 'darwin') {
    const result = await run('ps', ['-Ao', 'pid=,comm='])
    if (result.code !== 0) throw new Error(`无法枚举进程：${result.stderr.trim()}`)
    return parsePsOutput(result.stdout).filter((candidate) => candidate.pid !== process.pid)
  }
  if (process.platform === 'win32') {
    const result = await run('tasklist', ['/fo', 'csv', '/nh'])
    if (result.code !== 0) throw new Error(`无法枚举进程：${result.stderr.trim()}`)
    return parseTasklistOutput(result.stdout).filter((candidate) => candidate.pid !== process.pid)
  }
  throw new Error(`不支持的平台：${process.platform}`)
}
