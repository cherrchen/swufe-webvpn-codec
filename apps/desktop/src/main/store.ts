/** Persistent app configuration: `<userData>/config.json`.
 *
 * One file carries both the allowlist (top-level camelCase keys, exactly the shape
 * `swufe_bridge.allowlist.parse_allowlist` reads, so the Python side can consume the
 * same file) and the app settings as a sibling `settings` key (ignored by Python).
 *
 * No Electron import: unit-testable with plain `fs`.
 */

import { existsSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  CONFIG_FILENAME,
  DEFAULT_BRIDGE_PORT,
  DEFAULT_CAPTURE_MODE,
  DEFAULT_HOSTS,
  DEFAULT_WEBVPN_BASE,
  DEFAULT_WRD_IV,
  DEFAULT_WRD_KEY,
  MAX_CAPTURE_PROCESSES,
} from './constants'
import type { AllowlistConfig, CaptureMode } from '../shared/types'

export interface AppSettings {
  bridgePort: number
  debugLogging: boolean
  captureMode: CaptureMode
  captureProcesses: string[]
  webvpnBase: string
  wrdKey: string
  wrdIv: string
  systemProxyManagedByApp: boolean
}

interface StoreFile {
  hosts: string[]
  includeSwufeWildcard: boolean
  updatedAt: string
  settings: AppSettings
}

/** Hostname rules mirror `swufe_bridge.allowlist.normalize_host` (INV-003). */
const MAX_HOST_LENGTH = 253
const LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
const BANNED_CHARS = [':', '/', ' ', '\t', '*', '?', '#', '@']

export function normalizeHost(host: string): string {
  const candidate = host.trim().toLowerCase().replace(/\.$/, '')
  const reject = (reason: string): never => {
    throw new Error(`主机名不合法：${host}（${reason}）`)
  }
  if (!candidate) reject('不能为空')
  for (const char of BANNED_CHARS) if (candidate.includes(char)) reject('包含非法字符')
  if (candidate.length > MAX_HOST_LENGTH) reject(`长度超过 ${MAX_HOST_LENGTH}`)
  for (const label of candidate.split('.')) {
    if (!label || label.length > 63 || !LABEL_RE.test(label)) reject('标签不合法')
  }
  return candidate
}

export function defaultSettings(): AppSettings {
  return {
    bridgePort: DEFAULT_BRIDGE_PORT,
    debugLogging: false,
    captureMode: DEFAULT_CAPTURE_MODE,
    captureProcesses: [],
    webvpnBase: DEFAULT_WEBVPN_BASE,
    wrdKey: DEFAULT_WRD_KEY,
    wrdIv: DEFAULT_WRD_IV,
    systemProxyManagedByApp: false,
  }
}

export function isCaptureMode(value: unknown): value is CaptureMode {
  return value === 'system-proxy' || value === 'selected-apps'
}

/**
 * mitmproxy intercept patterns: non-empty, comma-free (a comma separates entries
 * in the intercept spec), trimmed and deduplicated — the same rules the sidecar
 * enforces in `swufe_bridge.config._parse_capture_processes`.
 */
export function normalizeCapturePatterns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const patterns: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const pattern = entry.trim()
    if (!pattern || pattern.includes(',')) continue
    if (!patterns.includes(pattern)) patterns.push(pattern)
  }
  return patterns
}

function parseSettings(raw: unknown): AppSettings {
  const defaults = defaultSettings()
  if (typeof raw !== 'object' || raw === null) return defaults
  const record = raw as Record<string, unknown>
  const port = record.bridgePort
  return {
    bridgePort: typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536 ? port : defaults.bridgePort,
    debugLogging: typeof record.debugLogging === 'boolean' ? record.debugLogging : defaults.debugLogging,
    captureMode: isCaptureMode(record.captureMode) ? record.captureMode : defaults.captureMode,
    captureProcesses: Array.isArray(record.captureProcesses)
      ? normalizeCapturePatterns(record.captureProcesses).slice(0, MAX_CAPTURE_PROCESSES)
      : defaults.captureProcesses,
    webvpnBase: typeof record.webvpnBase === 'string' && record.webvpnBase ? record.webvpnBase : defaults.webvpnBase,
    wrdKey: typeof record.wrdKey === 'string' ? record.wrdKey : defaults.wrdKey,
    wrdIv: typeof record.wrdIv === 'string' ? record.wrdIv : defaults.wrdIv,
    systemProxyManagedByApp:
      typeof record.systemProxyManagedByApp === 'boolean'
        ? record.systemProxyManagedByApp
        : defaults.systemProxyManagedByApp,
  }
}

export class AppStore {
  readonly path: string
  private data: StoreFile | null = null

  constructor(userDataDir: string) {
    this.path = join(userDataDir, CONFIG_FILENAME)
  }

  /** Idempotent: the first call reads (or creates) the file, later calls are no-ops. */
  load(): void {
    if (this.data !== null) return
    this.data = this.read()
  }

  getAllowlist(): AllowlistConfig {
    const data = this.requireData()
    return { hosts: [...data.hosts], includeSwufeWildcard: data.includeSwufeWildcard }
  }

  setAllowlist(cfg: AllowlistConfig): void {
    const data = this.requireData()
    const hosts: string[] = []
    for (const host of cfg.hosts) {
      const candidate = normalizeHost(host)
      if (!hosts.includes(candidate)) hosts.push(candidate)
    }
    data.hosts = hosts
    data.includeSwufeWildcard = Boolean(cfg.includeSwufeWildcard)
    data.updatedAt = new Date().toISOString()
    this.save()
  }

  getSettings(): AppSettings {
    const settings = this.requireData().settings
    return { ...settings, captureProcesses: [...settings.captureProcesses] }
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const data = this.requireData()
    const next: AppSettings = { ...data.settings, ...patch }
    const port = next.bridgePort
    if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(`端口不合法：${String(port)}`)
    }
    if (!next.webvpnBase) throw new Error('webvpnBase 不能为空')
    for (const [field, value] of [
      ['wrdKey', next.wrdKey],
      ['wrdIv', next.wrdIv],
    ] as const) {
      if (Buffer.byteLength(value, 'utf8') !== 16) {
        throw new Error(`WRD AES-128 ${field} 必须为 16 字节：${value}`)
      }
    }
    if (!isCaptureMode(next.captureMode)) {
      throw new Error(`捕获方式不合法：${String(next.captureMode)}`)
    }
    const patterns = normalizeCapturePatterns(next.captureProcesses)
    if (patterns.length !== next.captureProcesses.length) {
      throw new Error('捕获进程列表不合法：每一项必须是非空且不含逗号的路径，且不能重复')
    }
    if (patterns.length > MAX_CAPTURE_PROCESSES) {
      throw new Error(`最多只能选择 ${MAX_CAPTURE_PROCESSES} 个应用`)
    }
    next.captureProcesses = patterns
    data.settings = next
    this.save()
    return { ...next, captureProcesses: [...next.captureProcesses] }
  }

  private requireData(): StoreFile {
    if (this.data === null) this.load()
    if (this.data === null) throw new Error('配置未加载')
    return this.data
  }

  private read(): StoreFile {
    if (!existsSync(this.path)) {
      const fresh = this.defaultFile()
      this.data = fresh
      this.save()
      return fresh
    }
    const text = readFileSync(this.path, 'utf-8')
    try {
      return this.parse(JSON.parse(text))
    } catch (error) {
      // Keep the unreadable file for inspection instead of silently overwriting it.
      const backup = `${this.path}.bad`
      renameSync(this.path, backup)
      console.warn(`swufe-config 无效配置已备份为 ${backup}：${String(error)}`)
      const fresh = this.defaultFile()
      this.data = fresh
      this.save()
      return fresh
    }
  }

  private defaultFile(): StoreFile {
    return {
      hosts: [...DEFAULT_HOSTS],
      includeSwufeWildcard: false,
      updatedAt: new Date().toISOString(),
      settings: defaultSettings(),
    }
  }

  private parse(raw: unknown): StoreFile {
    if (typeof raw !== 'object' || raw === null) throw new Error('配置根节点必须是对象')
    const record = raw as Record<string, unknown>
    const rawHosts = Array.isArray(record.hosts) ? record.hosts : [...DEFAULT_HOSTS]
    const hosts: string[] = []
    for (const host of rawHosts) {
      const candidate = normalizeHost(String(host))
      if (!hosts.includes(candidate)) hosts.push(candidate)
    }
    return {
      hosts,
      includeSwufeWildcard: record.includeSwufeWildcard === true,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
      settings: parseSettings(record.settings),
    }
  }

  private save(): void {
    const data = this.requireData()
    mkdirSync(dirname(this.path), { recursive: true })
    const tmp = `${this.path}.tmp`
    const payload = `${JSON.stringify(data, null, 2)}\n`
    const fd = openSync(tmp, 'w')
    try {
      writeSync(fd, payload)
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, this.path)
  }
}
