/** Cross-platform acceptance evidence collector (M4 / T044, NFR-003 / REQ-009).
 *
 * Collects the evidence the interactive acceptance run (specs/001-phase1-local-bridge/
 * verification.md, "M4 双平台验收执行手册") has to produce on both desktop OSes, in one
 * reproducible shape: OS/build facts, config and runtime-config state, CA files and
 * trust store, system-proxy state per network service, bridge liveness, a proxied curl
 * smoke test plus a direct control request, leftover sidecar processes, and a
 * self-check that the report leaks no secret.
 *
 * Redaction invariant (NFR-003 / INV-001): no Cookie value, no `wrdKey` / `wrdIv` value
 * and no `Set-Cookie` / `Cookie` / `Authorization` / `Proxy-Authorization` header value
 * ever reaches the report. Every recorded command output passes through `redact()`, the
 * two JSON configs are read through an explicit key allowlist, and the final
 * `redaction-self-check` section fails the run if any collected secret is present.
 *
 * Usage:
 *   pnpm run acceptance:check --out <dir> [--port 8080] [--host jwxt.swufe.edu.cn]
 *                             [--user-data-dir <dir>] [--save-body]
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { repoRoot } from './lib/util.ts'

type Verdict = 'PASS' | 'INFO' | 'FAIL'

interface Section {
  name: string
  verdict: Verdict
  summary: string
  command: string
  body: string
}

interface Options {
  out: string
  port: number
  host: string
  scheme: string
  userDataDir: string
  saveBody: boolean
}

const USAGE = `用法: pnpm run acceptance:check --out <dir> [--port 8080] [--host jwxt.swufe.edu.cn] [--scheme https] [--user-data-dir <dir>] [--save-body]

  --out             必填：报告输出目录
  --port            本机桥端口（默认 8080）
  --host            验收目标主机（默认 jwxt.swufe.edu.cn）
  --scheme          目标 scheme（默认 https；本校 WebVPN 网关不支持 https 代理的
                    主机需用 --scheme http，如 jwxt.swufe.edu.cn）
  --user-data-dir   应用数据目录（默认 macOS: ~/Library/Application Support/swufe-webvpn-bridge；
                    Windows: %APPDATA%\\\\swufe-webvpn-bridge）
  --save-body       额外保存上游响应正文到 <out>/body-<host>-<ts>.html（默认关闭；
                    正文可能含个人信息，不要入库）
`

const HEADER_RE = /^(set-cookie|cookie|authorization|proxy-authorization)\s*:.*$/gim
const HEADER_VALUE_RE = /^(set-cookie|cookie|authorization|proxy-authorization)\s*:\s*(.+)$/i

/** Values that must never appear in the report; checked by `redaction-self-check`. */
const secrets = new Set<string>()

/** Header lines become `<NAME>: <REDACTED>`; everything else is passed through. */
function redact(text: string): string {
  return text.replace(HEADER_RE, (_match, name: string) => `${name.toUpperCase()}: <REDACTED>`)
}

/** Register a value that must never appear in the report. */
function noteSecret(value: unknown): void {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  if (trimmed.length >= 6) secrets.add(trimmed)
}

/** Remember raw (pre-redaction) header values so the final self-check can look for them. */
function noteSecrets(raw: string): void {
  for (const line of raw.split('\n')) {
    const match = HEADER_VALUE_RE.exec(line.trim())
    noteSecret(match?.[2])
  }
}

const sections: Section[] = []

function record(
  name: string,
  verdict: Verdict,
  summary: string,
  command: string,
  raw: string,
): void {
  noteSecrets(raw)
  sections.push({ name, verdict, summary, command, body: redact(raw).trimEnd() })
}

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

function run(command: string, args: string[], timeoutMs = 30_000): RunResult {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: timeoutMs })
  const stderr = String(result.stderr ?? '')
  return {
    code: result.status ?? (result.error ? 127 : 0),
    stdout: String(result.stdout ?? ''),
    stderr: result.error && stderr === '' ? String(result.error.message) : stderr,
  }
}

function show(label: string, result: RunResult): string {
  return [
    `$ ${label}`,
    `exit: ${result.code}`,
    'stdout:',
    result.stdout.trimEnd() === '' ? '(空)' : result.stdout.trimEnd(),
    'stderr:',
    result.stderr.trimEnd() === '' ? '(空)' : result.stderr.trimEnd(),
  ].join('\n')
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function defaultUserDataDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'swufe-webvpn-bridge')
  }
  return path.join(os.homedir(), 'Library', 'Application Support', 'swufe-webvpn-bridge')
}

function parseArgs(argv: string[]): Options | null {
  let out: string | undefined
  let port = 8080
  let host = 'jwxt.swufe.edu.cn'
  let scheme = 'https'
  let userDataDir = defaultUserDataDir()
  let saveBody = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const value = (): string => {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new Error(`${String(arg)} 需要一个值`)
      i += 1
      return next
    }
    switch (arg) {
      case '--out':
        out = value()
        break
      case '--port':
        port = Number.parseInt(value(), 10)
        break
      case '--host':
        host = value()
        break
      case '--scheme':
        scheme = value()
        break
      case '--user-data-dir':
        userDataDir = value()
        break
      case '--save-body':
        saveBody = true
        break
      case '--help':
      case '-h':
        return null
      default:
        throw new Error(`未知参数：${String(arg)}`)
    }
  }

  if (out === undefined) return null
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('--port 必须是 1..65535 的整数')
  if (scheme !== 'http' && scheme !== 'https') throw new Error('--scheme 必须是 http 或 https')
  return { out, port, host, scheme, userDataDir, saveBody }
}

function isFile(abs: string): boolean {
  try {
    return statSync(abs).isFile()
  } catch {
    return false
  }
}

/** `statSync().mode & 0o777` formatted as `0o600`; `null` when the file is absent. */
function fileMode(abs: string): string | null {
  try {
    return `0o${(statSync(abs).mode & 0o777).toString(8)}`
  } catch {
    return null
  }
}

type JsonObject = Record<string, unknown>

/** Parses a JSON file at the boundary; only a top-level object is usable here. */
function readJsonObject(abs: string): { ok: true; value: JsonObject } | { ok: false; error: string } {
  try {
    const value: unknown = JSON.parse(readFileSync(abs, 'utf8'))
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: '顶层不是对象' }
    }
    return { ok: true, value: value as JsonObject }
  } catch (error) {
    return { ok: false, error: describe(error) }
  }
}

/** A nested object field, or `{}` when it is absent or of another type. */
function nestedObject(source: JsonObject, key: string): JsonObject {
  const value = source[key]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as JsonObject
}

function pick(source: JsonObject, keys: readonly string[]): JsonObject {
  const out: JsonObject = {}
  for (const key of keys) {
    if (key in source) out[key] = source[key]
  }
  return out
}

function probePort(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const done = (open: boolean): void => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

function curlBin(): string {
  if (process.platform === 'darwin' && existsSync('/usr/bin/curl')) return '/usr/bin/curl'
  return 'curl'
}

/** Windows' curl speaks Schannel, which rejects the freshly generated MITM leaf with
 * exit 60 ("the revocation status is unknown"); the flag is Schannel-only, so it is
 * passed on Windows and left out elsewhere. */
const CURL_TLS_ARGS: readonly string[] = process.platform === 'win32' ? ['--ssl-no-revoke'] : []
/** The same flag pre-spaced for the human-readable command labels of the report. */
const CURL_TLS_LABEL = CURL_TLS_ARGS.length > 0 ? ` ${CURL_TLS_ARGS.join(' ')}` : ''

function collectEnv(options: Options, startedAt: Date): void {
  const commit = run('git', ['rev-parse', '--short', 'HEAD'])
  const node = run(process.execPath, ['-v'])
  const uv = run('uv', ['--version'])
  const raw = [
    `date:              ${startedAt.toISOString()}`,
    `platform:          ${os.platform()}`,
    `release:           ${os.release()}`,
    `arch:              ${os.arch()}`,
    `node:              ${node.stdout.trim() || node.stderr.trim()}`,
    `uv:                ${uv.stdout.trim() || uv.stderr.trim()}`,
    `repo:              ${repoRoot}`,
    `commit:            ${commit.stdout.trim() || '(unknown)'}`,
    `userDataDir:       ${options.userDataDir}`,
    `bridgePort:        ${options.port}`,
    `target:            ${options.scheme}://${options.host}`,
  ].join('\n')
  record('env', 'INFO', `${os.platform()} ${os.release()}`, 'os.platform() / os.release() / node -v / uv --version / git rev-parse', raw)
}

function collectConfig(options: Options): void {
  const configPath = path.join(options.userDataDir, 'config.json')
  const command = `cat ${configPath}`
  if (!isFile(configPath)) {
    record('config', 'INFO', '尚未创建', command, `文件不存在：${configPath}`)
    return
  }
  const parsed = readJsonObject(configPath)
  if (!parsed.ok) {
    record('config', 'FAIL', '解析失败', command, `解析失败：${parsed.error}`)
    return
  }
  const file = parsed.value
  const settings = nestedObject(file, 'settings')
  // Read the secrets before echoing anything so the final self-check can look for them.
  noteSecret(settings.wrdKey)
  noteSecret(settings.wrdIv)
  // Allowlist only: `settings.wrdKey` / `settings.wrdIv` are deliberately never echoed.
  const whitelisted = {
    hosts: file.hosts,
    includeSwufeWildcard: file.includeSwufeWildcard,
    updatedAt: file.updatedAt,
    settings: pick(settings, [
      'bridgePort',
      'debugLogging',
      'captureMode',
      'captureProcesses',
      'webvpnBase',
    ]),
  }
  const hosts = Array.isArray(file.hosts) ? file.hosts.length : 0
  record(
    'config',
    'PASS',
    `hosts=${String(hosts)} wildcard=${String(file.includeSwufeWildcard)}`,
    command,
    `文件：${configPath}（mode ${String(fileMode(configPath))}）\n白名单字段（wrdKey/wrdIv 不写入报告）：\n${JSON.stringify(whitelisted, null, 2)}`,
  )
}

function collectRuntimeConfig(options: Options): void {
  const runtimePath = path.join(options.userDataDir, 'bridge-config.json')
  const command = `cat ${runtimePath}`
  if (!isFile(runtimePath)) {
    record('runtime-config', 'INFO', '尚未创建（桥未运行过）', command, `文件不存在：${runtimePath}`)
    return
  }
  const mode = fileMode(runtimePath)
  const parsed = readJsonObject(runtimePath)
  if (!parsed.ok) {
    record('runtime-config', 'FAIL', '解析失败', command, `解析失败：${parsed.error}`)
    return
  }
  const file = parsed.value
  const cookies = Array.isArray(file.cookies) ? file.cookies : []
  const capture = nestedObject(file, 'capture')
  const allowlist = nestedObject(file, 'allowlist')
  // Read the secrets before echoing anything so the final self-check can look for them.
  noteSecret(file.wrdKey)
  noteSecret(file.wrdIv)
  for (const cookie of cookies) {
    if (typeof cookie === 'object' && cookie !== null) noteSecret((cookie as JsonObject).value)
  }
  // Key allowlist: cookie values and the WRD key/IV never leave this process.
  const whitelisted = {
    allowlist: pick(allowlist, ['hosts', 'includeSwufeWildcard']),
    debug: file.debug,
    webvpnBase: file.webvpnBase,
    capture: pick(capture, ['processes']),
    cookieCount: cookies.length,
  }
  const detail = `文件：${runtimePath}（mode ${String(mode)}）\n白名单字段（cookie 值 / wrdKey / wrdIv 不写入报告）：\n${JSON.stringify(whitelisted, null, 2)}`
  // Windows synthesizes POSIX mode bits (a regular file always reads back 0o666); the
  // owner-only guarantee there is the per-user `%APPDATA%` profile ACL, not mode bits.
  if (process.platform === 'win32') {
    record(
      'runtime-config',
      'INFO',
      `权限位不适用（Windows 合成 ${String(mode)}）cookieCount=${String(cookies.length)}`,
      command,
      `${detail}\n（Windows：POSIX 权限位由系统合成、不代表 ACL；等价保护来自 %APPDATA% 的每用户 profile ACL）`,
    )
    return
  }
  if (mode !== '0o600') {
    record('runtime-config', 'FAIL', `权限为 ${String(mode)}（期望 0o600）`, command, detail)
    return
  }
  record('runtime-config', 'PASS', `mode 0o600 cookieCount=${String(cookies.length)}`, command, detail)
}

function collectCaFiles(options: Options): void {
  const confdir = path.join(options.userDataDir, 'mitmproxy')
  const caPem = path.join(confdir, 'mitmproxy-ca.pem')
  const caCert = path.join(confdir, 'mitmproxy-ca-cert.pem')
  const lines = [
    `confdir:  ${confdir}`,
    `cert:     ${caCert} exists=${String(isFile(caCert))} mode=${String(fileMode(caCert))}`,
    `private:  ${caPem} exists=${String(isFile(caPem))} mode=${String(fileMode(caPem))}`,
  ].join('\n')
  const command = `stat ${confdir}/mitmproxy-ca*.pem`
  const pemMode = fileMode(caPem)
  // Same Windows caveat as `collectRuntimeConfig`: synthesized mode bits carry no ACL
  // meaning, so only POSIX can be judged here.
  if (process.platform !== 'win32' && isFile(caPem) && pemMode !== '0o600') {
    record('ca-files', 'FAIL', `CA 私钥权限为 ${String(pemMode)}（期望 0o600）`, command, lines)
    return
  }
  record('ca-files', 'INFO', `cert=${isFile(caCert) ? 'yes' : 'no'} private=${isFile(caPem) ? 'yes' : 'no'}`, command, lines)
}

function collectTrustStore(options: Options): void {
  const caCert = path.join(options.userDataDir, 'mitmproxy', 'mitmproxy-ca-cert.pem')
  if (process.platform === 'win32') {
    const result = run('certutil', ['-user', '-store', 'Root', 'mitmproxy'])
    const installed = /mitmproxy/i.test(result.stdout)
    record(
      'trust-store',
      'INFO',
      `installed: ${installed ? 'yes' : 'no'}`,
      'certutil -user -store Root mitmproxy',
      show('certutil -user -store Root mitmproxy', result),
    )
    return
  }
  if (process.platform !== 'darwin') {
    record('trust-store', 'INFO', '不适用（仅 macOS / Windows）', '(none)', `platform=${process.platform}`)
    return
  }
  const selector = ['find-certificate', '-a', '-c', 'mitmproxy', '-Z', '/Library/Keychains/System.keychain']
  const found = run('/usr/bin/security', selector)
  const installed = found.stdout.length > 0
  const lines = [
    show(`security ${selector.join(' ')}`, found),
    `stdout bytes: ${String(found.stdout.length)}`,
    `contains SHA-1: ${found.stdout.includes('SHA-1') ? 'yes' : 'no'}`,
    `installed: ${installed ? 'yes' : 'no'}`,
  ]
  if (isFile(caCert)) {
    const verify = run('/usr/bin/security', ['verify-cert', '-c', caCert, '-p', 'ssl'])
    lines.push(show(`security verify-cert -c ${caCert} -p ssl`, verify))
    lines.push(`verify-cert exit: ${String(verify.code)}`)
  } else {
    lines.push(`verify-cert exit: (skipped，CA 证书不存在：${caCert})`)
  }
  record('trust-store', 'INFO', `installed: ${installed ? 'yes' : 'no'}`, `security ${selector.join(' ')}`, lines.join('\n'))
}

function collectSystemProxy(): void {
  if (process.platform === 'win32') {
    const query = (what: string): string => {
      const result = run('reg', [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
        '/v',
        what,
      ])
      return show(`reg query "...Internet Settings" /v ${what}`, result)
    }
    record(
      'system-proxy',
      'INFO',
      'Windows WinINET 注册表',
      'reg query HKCU\\...\\Internet Settings',
      `${query('ProxyEnable')}\n\n${query('ProxyServer')}`,
    )
    return
  }
  if (process.platform !== 'darwin') {
    record('system-proxy', 'INFO', '不适用（仅 macOS / Windows）', '(none)', `platform=${process.platform}`)
    return
  }
  const listed = run('/usr/sbin/networksetup', ['-listallnetworkservices'])
  const rawLines = listed.stdout.split('\n')
  // Line 1 is the "An asterisk (*) denotes…" header; a leading `*` marks a disabled service.
  const services = rawLines
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('*') && !/^An asterisk/i.test(line))
  const lines: string[] = [show('networksetup -listallnetworkservices', listed)]
  for (const service of services) {
    for (const flag of ['-getwebproxy', '-getsecurewebproxy'] as const) {
      const result = run('/usr/sbin/networksetup', [flag, service])
      const read = (key: string): string => {
        const match = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(result.stdout)
        return match?.[1]?.trim() ?? '?'
      }
      lines.push(
        `service: ${service} (${flag}) Enabled ${read('Enabled')} Server ${read('Server')} Port ${read('Port')}`,
      )
    }
  }
  const scutil = run('/usr/sbin/scutil', ['--proxy'])
  lines.push(show('scutil --proxy', scutil))
  record('system-proxy', 'INFO', `${String(services.length)} 个网络服务`, 'networksetup -getwebproxy / scutil --proxy', lines.join('\n'))
}

async function collectBridgePort(options: Options): Promise<boolean> {
  const open = await probePort(options.port)
  record(
    'bridge-port',
    'INFO',
    open ? 'open' : 'closed',
    `net.connect(127.0.0.1:${String(options.port)})`,
    `127.0.0.1:${String(options.port)} → ${open ? 'open' : 'closed'}`,
  )
  return open
}

/** curl writes the proxy `CONNECT` response first; the origin status line is the last one. */
function lastStatusLine(headers: string): string {
  const matches = [...headers.matchAll(/^HTTP\/[^\s]*\s+(\d{3}.*)$/gm)]
  return matches.at(-1)?.[1]?.trim() ?? '(无状态行)'
}

function curlRequest(args: string[], timeoutMs: number): RunResult {
  const result = spawnSync(curlBin(), args, { encoding: 'utf8', timeout: timeoutMs })
  const stderr = String(result.stderr ?? '')
  return {
    code: result.status ?? (result.error ? 127 : 0),
    stdout: String(result.stdout ?? ''),
    stderr: result.error && stderr === '' ? String(result.error.message) : stderr,
  }
}

async function collectBridgeSmoke(
  options: Options,
  portOpen: boolean,
  caCert: string,
  stamp: string,
): Promise<void> {
  if (!portOpen || !isFile(caCert)) {
    record(
      'bridge-smoke',
      'INFO',
      portOpen ? 'skipped（CA 证书不存在）' : 'skipped（桥未监听）',
      '(none)',
      `桥端口 open=${String(portOpen)}；CA 证书 ${caCert} exists=${String(isFile(caCert))}`,
    )
    return
  }
  const headerFile = path.join(os.tmpdir(), `swufe-acceptance-headers-${stamp}.txt`)
  const bodyPath = options.saveBody ? path.join(options.out, `body-${options.host}-${stamp}.html`) : null
  const url = `${options.scheme}://${options.host}/`
  const args = [
    '-sS',
    ...CURL_TLS_ARGS,
    '-x',
    `http://127.0.0.1:${String(options.port)}`,
    '--cacert',
    caCert,
    '-m',
    '20',
    '-D',
    headerFile,
    '-o',
    bodyPath ?? os.devNull,
    url,
  ]
  const result = curlRequest(args, 30_000)
  let headers = ''
  try {
    if (isFile(headerFile)) headers = readFileSync(headerFile, 'utf8')
  } catch (error) {
    headers = `(读取响应头失败：${describe(error)})`
  }
  // Headers may carry Set-Cookie: read them once, then delete the file outright.
  rmSync(headerFile, { force: true })

  const status = lastStatusLine(headers)
  const location = /^location:\s*(.*)$/im.exec(headers)?.[1]?.trim() ?? '(无)'
  const contentType = /^content-type:\s*(.*)$/im.exec(headers)?.[1]?.trim() ?? '(无)'
  const body = [
    show(`curl -sS${CURL_TLS_LABEL} -x http://127.0.0.1:${String(options.port)} --cacert <caCert> -m 20 -o ${bodyPath ?? os.devNull} -D - ${url}`, result),
    `status:       ${status}`,
    `location:     ${location}`,
    `content-type: ${contentType}`,
    bodyPath !== null ? `body:         ${bodyPath}（可能含个人信息，不要入库）` : 'body:         (未保存，--save-body 关闭)',
    '响应头（已脱敏）：',
    headers.trimEnd() === '' ? '(空)' : headers.trimEnd(),
  ].join('\n')

  if (result.code !== 0) {
    record('bridge-smoke', 'FAIL', `curl 退出码 ${String(result.code)}`, `curl${CURL_TLS_LABEL} -x http://127.0.0.1:${String(options.port)} ${url}`, body)
    return
  }
  record('bridge-smoke', 'PASS', status, `curl${CURL_TLS_LABEL} -x http://127.0.0.1:${String(options.port)} ${url}`, body)

  const direct = curlRequest(['-sS', '-m', '20', '-o', os.devNull, '-w', '%{http_code}', url], 30_000)
  record(
    'bridge-smoke-direct-control',
    'INFO',
    `direct http_code=${direct.stdout.trim() || '(空)'} curl exit=${String(direct.code)}`,
    `curl ${url}（直连对照）`,
    show(`curl -sS -m 20 -o /dev/null -w '%{http_code}' ${url}`, direct),
  )
}

function collectBypassControl(options: Options, portOpen: boolean, caCert: string): void {
  const url = 'https://webvpn.swufe.edu.cn/'
  if (!portOpen || !isFile(caCert)) {
    record('bypass-control', 'INFO', 'skipped（桥未监听或 CA 缺失）', '(none)', `桥端口 open=${String(portOpen)}；CA 证书 exists=${String(isFile(caCert))}`)
    return
  }
  const headerFile = path.join(os.tmpdir(), `swufe-acceptance-bypass-${String(Date.now())}.txt`)
  const result = curlRequest(
    ['-sS', ...CURL_TLS_ARGS, '-x', `http://127.0.0.1:${String(options.port)}`, '--cacert', caCert, '-m', '20', '-o', os.devNull, '-D', headerFile, url],
    30_000,
  )
  let headers = ''
  try {
    if (isFile(headerFile)) headers = readFileSync(headerFile, 'utf8')
  } catch (error) {
    headers = `(读取响应头失败：${describe(error)})`
  }
  rmSync(headerFile, { force: true })
  const status = lastStatusLine(headers)
  record(
    'bypass-control',
    'INFO',
    status,
    `curl${CURL_TLS_LABEL} -x http://127.0.0.1:${String(options.port)} ${url}`,
    `${show(`curl${CURL_TLS_LABEL} -x http://127.0.0.1:${String(options.port)} -D - ${url}`, result)}\nstatus: ${status}\n响应头（已脱敏）：\n${headers.trimEnd() === '' ? '(空)' : headers.trimEnd()}\n（防环对照：桥运行期间该主机的请求不应被二次包装，与 addon 的硬编码排除一致）`,
  )
}

function collectResidue(): void {
  if (process.platform === 'win32') {
    const result = run('tasklist', ['/fi', 'imagename eq python.exe', '/fo', 'csv', '/nh'])
    const lines = result.stdout.split('\n').filter((line) => line.trim() !== '')
    record('residue', 'INFO', `${String(lines.length)} 个 python.exe`, 'tasklist /fi "imagename eq python.exe"', show('tasklist /fi "imagename eq python.exe" /fo csv /nh', result))
    return
  }
  const result = run('pgrep', ['-fl', 'swufe_bridge.sidecar'])
  const lines = result.stdout.split('\n').filter((line) => line.trim() !== '')
  const detail = result.code === 1 ? `无匹配进程（pgrep 退出码 1）` : show('pgrep -fl swufe_bridge.sidecar', result)
  record('residue', 'INFO', `${String(lines.length)} 个 sidecar 进程`, 'pgrep -fl swufe_bridge.sidecar', detail)
}

function selfCheck(reportText: string): void {
  const leaked = [...secrets].filter((secret) => reportText.includes(secret))
  const lines = [
    `已收集敏感串：${String(secrets.size)} 个（cookie 值 / wrdKey / wrdIv / 四个敏感头的值）`,
    leaked.length === 0 ? '命中：0' : `命中：${String(leaked.length)}`,
  ].join('\n')
  if (leaked.length > 0) {
    record('redaction-self-check', 'FAIL', `${String(leaked.length)} 个敏感串出现在报告中`, '(none)', lines)
    return
  }
  record('redaction-self-check', 'PASS', '报告中无 Cookie / 密钥值', '(none)', lines)
}

function render(options: Options, reportPath: string, stamp: string): string {
  const header = [
    '# 验收证据（acceptance evidence）',
    '',
    `- 报告：${path.basename(reportPath)}`,
    `- 生成时间：${stamp}`,
    `- 平台：${os.platform()} ${os.release()} (${os.arch()})`,
    `- 应用数据目录：${options.userDataDir}`,
    `- 桥端口：${String(options.port)}；目标：${options.scheme}://${options.host}`,
    '- 脱敏：Cookie 值、`wrdKey` / `wrdIv` 值与四个敏感请求头的值不会出现在本报告中（NFR-003 / INV-001）。',
    '- 本报告可入库；`--save-body` 生成的正文文件与浏览器截图不入库。',
    '',
  ].join('\n')
  const body = sections
    .map((section) =>
      [
        `## ${section.name}`,
        '',
        `- verdict: **${section.verdict}**`,
        `- 摘要：${section.summary}`,
        `- 命令：\`${section.command}\``,
        '',
        '```text',
        section.body,
        '```',
        '',
      ].join('\n'),
    )
    .join('\n')
  return `${header}${body}`
}

async function main(): Promise<number> {
  let options: Options | null
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${describe(error)}\n\n${USAGE}`)
    return 2
  }
  if (options === null) {
    process.stderr.write(USAGE)
    return 2
  }

  const startedAt = new Date()
  const stamp = `${startedAt.getFullYear()}${String(startedAt.getMonth() + 1).padStart(2, '0')}${String(startedAt.getDate()).padStart(2, '0')}-${String(startedAt.getHours()).padStart(2, '0')}${String(startedAt.getMinutes()).padStart(2, '0')}${String(startedAt.getSeconds()).padStart(2, '0')}`
  mkdirSync(options.out, { recursive: true })

  collectEnv(options, startedAt)
  collectConfig(options)
  collectRuntimeConfig(options)
  collectCaFiles(options)
  collectTrustStore(options)
  collectSystemProxy()
  const portOpen = await collectBridgePort(options)
  const caCert = path.join(options.userDataDir, 'mitmproxy', 'mitmproxy-ca-cert.pem')
  await collectBridgeSmoke(options, portOpen, caCert, stamp)
  collectBypassControl(options, portOpen, caCert)
  collectResidue()
  selfCheck(render(options, '', stamp))

  const reportPath = path.join(options.out, `acceptance-${process.platform}-${stamp}.md`)
  writeFileSync(reportPath, render(options, reportPath, stamp), 'utf8')

  for (const section of sections) {
    console.log(`${section.verdict.padEnd(4)}  ${section.name}  ${section.summary}`)
  }
  console.log(`report: ${reportPath}`)

  return sections.some((section) => section.verdict === 'FAIL') ? 1 : 0
}

process.exitCode = await main()
