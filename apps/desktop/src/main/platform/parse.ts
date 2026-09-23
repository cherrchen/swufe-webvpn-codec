/** Pure parsers for OS command output — the unit-testable half of the platform adapters. */

import type { CaptureCandidate } from '../../shared/types'

export interface NetworkService {
  name: string
  disabled: boolean
}

export interface ProxyState {
  enabled: boolean
  server: string | null
  port: number | null
}

/** One raw line of a process listing, before capture grouping. */
export interface ProcessRow {
  pid: number
  name: string
}

/** `networksetup -listallnetworkservices`: header line, `*` prefix means disabled. */
export function parseNetworkServices(stdout: string): NetworkService[] {
  const services: NetworkService[] = []
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('An asterisk')) continue
    const disabled = line.startsWith('*')
    const name = disabled ? line.replace(/^\*+\s*/, '').trim() : line
    if (name) services.push({ name, disabled })
  }
  return services
}

/** `networksetup -getwebproxy <service>` (Server/Port stay populated even when disabled). */
export function parseNetworksetupProxy(stdout: string): ProxyState {
  let enabled = false
  let server: string | null = null
  let port: number | null = null
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    const [rawKey, ...rest] = line.split(':')
    const key = (rawKey ?? '').trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'enabled') enabled = value.toLowerCase() === 'yes'
    else if (key === 'server') server = value || null
    else if (key === 'port') {
      const parsed = Number.parseInt(value, 10)
      port = Number.isFinite(parsed) ? parsed : null
    }
  }
  return { enabled, server, port }
}

const WIN_PROXY_ENTRY_RE = /^(https?|socks)=(.+)$/i

/**
 * `reg query ... Internet Settings` values (`ProxyEnable` / `ProxyServer`).
 * `ProxyServer` is either `host:port` or `proto=host:port;proto=host:port`.
 */
export function parseWinInetValue(stdout: string): { enable: boolean | null; server: string | null } {
  let enable: boolean | null = null
  let server: string | null = null
  for (const rawLine of stdout.split('\n')) {
    const match = rawLine.match(/^\s*(\S+)\s+REG_(DWORD|SZ)\s+(.*)$/)
    if (!match) continue
    const [, name, type, rawValue] = match
    const value = (rawValue ?? '').trim()
    if (name === 'ProxyEnable' && type === 'DWORD') enable = value === '0x1'
    else if (name === 'ProxyServer' && type === 'SZ') server = value || null
  }
  return { enable, server }
}

/** Map the WinINET pair onto the same shape the macOS adapter produces. */
export function winInetState(enable: boolean | null, server: string | null): ProxyState {
  const enabled = enable === true
  if (!server) return { enabled, server: null, port: null }
  const entries = server.includes('=')
    ? server.split(';').map((entry) => {
        const match = entry.trim().match(WIN_PROXY_ENTRY_RE)
        return match ? (match[2] ?? '') : entry.trim()
      })
    : [server]
  const targets = new Set(entries.map((entry) => entry.trim()).filter(Boolean))
  if (targets.size !== 1) return { enabled, server, port: null }
  const target = [...targets][0] ?? ''
  const separator = target.lastIndexOf(':')
  const host = separator === -1 ? '' : target.slice(0, separator)
  const port = separator === -1 ? Number.NaN : Number.parseInt(target.slice(separator + 1), 10)
  if (!host || !Number.isFinite(port)) return { enabled, server, port: null }
  return { enabled, server: host, port }
}

/** An enabled proxy pointing anywhere but this bridge blocks our start (ADR-0004). */
export function isConflict(state: ProxyState, bridgePort: number): boolean {
  if (!state.enabled) return false
  return !(state.server === '127.0.0.1' && state.port === bridgePort)
}

/** Only ever clear what this bridge owns (INV-002). */
export function shouldClear(state: ProxyState, bridgePort: number): boolean {
  return state.enabled && state.server === '127.0.0.1' && state.port === bridgePort
}

/** `ps -Ao pid=,comm=` → pid + executable path (macOS, before grouping). */
export function parsePsOutput(stdout: string): ProcessRow[] {
  const rows: ProcessRow[] = []
  for (const rawLine of stdout.split('\n')) {
    const match = rawLine.trim().match(/^(\d+)\s+(.+)$/)
    if (!match) continue
    const pid = Number.parseInt(match[1] ?? '', 10)
    const name = (match[2] ?? '').trim()
    if (Number.isFinite(pid) && name) rows.push({ pid, name })
  }
  return rows
}

/** `tasklist /fo csv /nh` → pid + image name (Windows, before grouping). */
export function parseTasklistOutput(stdout: string): ProcessRow[] {
  const rows: ProcessRow[] = []
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const fields = line.match(/"([^"]*)"/g)?.map((field) => field.slice(1, -1))
    if (!fields) continue
    const pid = Number.parseInt(fields[1] ?? '', 10)
    const name = fields[0] ?? ''
    if (Number.isFinite(pid) && name) rows.push({ pid, name })
  }
  return rows
}

/**
 * mitmproxy intercept pattern for one executable path.
 *
 * An application is matched by its `.app` bundle path so that the main process
 * *and* its helpers are captured (and so a short name like `Safari` cannot hit
 * an unrelated process). Anything else is matched by its full executable path.
 */
export function capturePattern(executable: string): string {
  // Non-greedy: a helper nested in another `.app` (Chrome's Helper) must still
  // resolve to the outer application bundle.
  const match = executable.match(/^(.*?\.app)\/Contents\//)
  if (match) return `${match[1]}/`
  return executable.trim()
}

/** Display name for a pattern: `…/Google Chrome.app/` → `Google Chrome`. */
export function captureName(pattern: string): string {
  if (pattern.endsWith('.app/')) {
    const bundle = pattern.slice(0, -1)
    return bundle.slice(bundle.lastIndexOf('/') + 1).replace(/\.app$/, '')
  }
  const trimmed = pattern.replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1)
}

/**
 * Collapse processes onto one row per capture pattern (one application, one row),
 * keeping the lowest pid and ordering by display name.
 */
export function groupCaptureCandidates(rows: ProcessRow[]): CaptureCandidate[] {
  const groups = new Map<string, CaptureCandidate>()
  for (const row of rows) {
    const pattern = capturePattern(row.name)
    const existing = groups.get(pattern)
    if (existing && existing.pid <= row.pid) continue
    groups.set(pattern, { pid: row.pid, name: captureName(pattern), pattern })
  }
  return [...groups.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/** `security find-certificate -a -Z` may return several CAs with the same name. */
export function parseFindCertificateHashes(stdout: string): string[] {
  return [...stdout.matchAll(/SHA-1 hash:\s*([0-9A-Fa-f]{40})/gi)]
    .map((match) => (match[1] ?? '').toUpperCase())
}

/** `certutil -store Root <CertId>` must still prove that the returned hash is ours. */
export function parseCertutilHashes(stdout: string): string[] {
  return [...stdout.matchAll(/Cert Hash\(sha1\):\s*([0-9A-Fa-f ]{40,})/gi)]
    .map((match) => (match[1] ?? '').replaceAll(' ', '').toUpperCase())
    .filter((hash) => /^[0-9A-F]{40}$/.test(hash))
}
