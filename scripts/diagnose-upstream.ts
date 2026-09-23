/** Live diagnosis harness for `KI-019` (sporadic stalls on bridged requests).
 *
 * Runs a fixed rhythm of rounds against a **running** app bridge and, per round, records
 * both sides of the comparison the `KI-019` conclusion needs:
 *
 *   1..3  DNS + TCP + TLS to the WebVPN gateway, straight from this process;
 *   4     the same site path through the bridge (`curl -x http://127.0.0.1:<port>`);
 *   5..6  the probes again right after the bridged request, plus the same WRD path direct;
 *   7     when the round was abnormal, the bridge's own `bridge-upstream.log` tail.
 *
 * The direct control deliberately carries no cookie, so the gateway answers it with a fast
 * `302 → /login` (and a fresh ticket) whenever the path is healthy: it measures the path,
 * not the session. Session expiry is therefore read from the **bridged** response, which
 * carries the cookies the bridge injects.
 *
 * The verdict is what separates a local from an external cause:
 *   `bridge-side`           the bridge was abnormal while the same-round direct path was healthy;
 *   `network-or-resolver`   the direct path was also unhealthy (or DNS was slow) in that round;
 *   `no-stall`              the bridged request was normal.
 *
 * Redaction (NFR-003 / INV-001): the whole run reads nothing but `webvpnBase` from the
 * app config, never prints a request/response header, and never persists the WRD URL —
 * it is kept in memory only, because it carries a session token. The `detail` fields
 * written to the JSONL come from the bridge log, which the sidecar has already sanitized.
 *
 * Usage:
 *   pnpm run diagnose:upstream --user-data-dir <dir> [--rounds 40] [--pause-ms 15000]
 *                              [--port 8080] [--host jwxt.swufe.edu.cn] [--scheme http]
 *                              [--connect-timeout-ms 3000] [--out <dir>]
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { connect as netConnect } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { connect as tlsConnect } from 'node:tls'

import { repoRoot } from './lib/util.ts'

interface Options {
  userDataDir: string
  out: string
  port: number
  host: string
  scheme: string
  rounds: number
  pauseMs: number
  connectTimeoutMs: number
}

const USAGE = `用法: pnpm run diagnose:upstream --user-data-dir <dir> [--rounds 40] [--pause-ms 15000] [--port 8080] [--host jwxt.swufe.edu.cn] [--scheme http] [--connect-timeout-ms 3000] [--out <dir>]

  --user-data-dir      必填：应用数据目录（需含 bridge-config.json 与 mitmproxy/mitmproxy-ca-cert.pem）
  --out                证据输出目录（默认系统临时目录；不得位于仓库内）
  --port               本机桥端口（默认 8080）
  --host               经桥目标主机（默认 jwxt.swufe.edu.cn）
  --scheme             目标 scheme（默认 http；本校网关不支持以 https 代理教务）
  --rounds             轮数（默认 40）
  --pause-ms           轮间隔毫秒（默认 15000）
  --connect-timeout-ms 直连对照的 DNS/TCP/TLS 超时（默认 3000）

前置：应用在运行、桥为「桥接中」、系统代理已启用、会话有效、allowlist 含 --host；
     历史失败轮的环境是「默认路由直连、无 TUN 路由」，复测应落在同一形态。`

const BRIDGE_REQUEST_TIMEOUT_MS = 8_000
const BRIDGE_ABNORMAL_MS = 3_000
const DNS_SLOW_MS = 200

interface Probe {
  ms: number
  ok: boolean
  addr: string | null
  alpn?: string | null
}

interface RoundFacts {
  round: number
  started_at: string
  dns_ms: number
  dns_addrs: string[]
  pre_tcp: Probe
  pre_tls: Probe
  bridge_exit: number
  bridge_status: string
  bridge_ms: number
  post_tcp: Probe
  post_tls: Probe
  direct_exit: number
  direct_status: string
  direct_ms: number
  direct_to_login: boolean
}

interface Round extends RoundFacts {
  verdict: string
  stall_records: unknown[]
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function run(command: string, args: string[], timeoutMs = 30_000) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: timeoutMs })
  const stderr = String(result.stderr ?? '')
  return {
    code: result.status ?? (result.error ? 127 : 0),
    stdout: String(result.stdout ?? ''),
    stderr: result.error && stderr === '' ? String(result.error.message) : stderr,
  }
}

function defaultUserDataDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'swufe-webvpn-bridge')
  }
  return path.join(os.homedir(), 'Library', 'Application Support', 'swufe-webvpn-bridge')
}

function parseArgs(argv: string[]): Options | null {
  let userDataDir = defaultUserDataDir()
  let seenUserDataDir = false
  let out = os.tmpdir()
  let port = 8080
  let host = 'jwxt.swufe.edu.cn'
  let scheme = 'http'
  let rounds = 40
  let pauseMs = 15_000
  let connectTimeoutMs = 3_000

  const value = (index: number, name: string): string => {
    const next = argv[index + 1]
    if (next === undefined || next.startsWith('--')) throw new Error(`${name} 需要一个值`)
    return next
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--user-data-dir':
        userDataDir = value(i, arg)
        seenUserDataDir = true
        i += 1
        break
      case '--out':
        out = value(i, arg)
        i += 1
        break
      case '--port':
        port = Number.parseInt(value(i, arg), 10)
        i += 1
        break
      case '--host':
        host = value(i, arg)
        i += 1
        break
      case '--scheme':
        scheme = value(i, arg)
        i += 1
        break
      case '--rounds':
        rounds = Number.parseInt(value(i, arg), 10)
        i += 1
        break
      case '--pause-ms':
        pauseMs = Number.parseInt(value(i, arg), 10)
        i += 1
        break
      case '--connect-timeout-ms':
        connectTimeoutMs = Number.parseInt(value(i, arg), 10)
        i += 1
        break
      case '--help':
      case '-h':
        return null
      default:
        throw new Error(`未知参数：${arg}`)
    }
  }

  if (!seenUserDataDir) return null
  for (const [name, parsed] of [
    ['--port', port],
    ['--rounds', rounds],
    ['--pause-ms', pauseMs],
    ['--connect-timeout-ms', connectTimeoutMs],
  ] as const) {
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} 必须是正整数`)
  }
  return { userDataDir, out, port, host, scheme, rounds, pauseMs, connectTimeoutMs }
}

const sleep = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

async function dnsProbe(host: string): Promise<{ ms: number; addrs: string[] }> {
  const started = performance.now()
  try {
    const results = await lookup(host, { all: true })
    return { ms: Math.round(performance.now() - started), addrs: results.map((entry) => entry.address) }
  } catch {
    return { ms: Math.round(performance.now() - started), addrs: [] }
  }
}

function tcpProbe(address: string | null, port: number, timeoutMs: number): Promise<Probe> {
  if (address === null) return Promise.resolve({ ms: 0, ok: false, addr: null })
  const { promise, resolve } = Promise.withResolvers<Probe>()
  const started = performance.now()
  const socket = netConnect({ host: address, port })
  const finish = (ok: boolean): void => {
    socket.removeAllListeners()
    socket.destroy()
    resolve({ ms: Math.round(performance.now() - started), ok, addr: address })
  }
  socket.setTimeout(timeoutMs)
  socket.once('connect', () => finish(true))
  socket.once('timeout', () => finish(false))
  socket.once('error', () => finish(false))
  return promise
}

function tlsProbe(
  address: string | null,
  serverName: string,
  port: number,
  timeoutMs: number,
): Promise<Probe> {
  if (address === null) return Promise.resolve({ ms: 0, ok: false, addr: null, alpn: null })
  const { promise, resolve } = Promise.withResolvers<Probe>()
  const started = performance.now()
  // Certificate verification is irrelevant here (and would need the bridge CA): the
  // probe only measures whether a handshake completes at all.
  const socket = tlsConnect({
    host: address,
    port,
    servername: serverName,
    ALPNProtocols: ['h2', 'http/1.1'],
    rejectUnauthorized: false,
  })
  const finish = (ok: boolean, alpn: string | null = null): void => {
    socket.removeAllListeners()
    socket.destroy()
    resolve({ ms: Math.round(performance.now() - started), ok, addr: address, alpn })
  }
  socket.setTimeout(timeoutMs)
  socket.once('secureConnect', () => finish(true, socket.alpnProtocol || null))
  socket.once('timeout', () => finish(false))
  socket.once('error', () => finish(false))
  return promise
}

/** curl writes the proxy `CONNECT` response first; the origin status line is the last one. */
function lastStatusLine(headers: string): string {
  const matches = [...headers.matchAll(/^HTTP\/[^\s]*\s+(\d{3}.*)$/gm)]
  return matches.at(-1)?.[1]?.trim() ?? '(无状态行)'
}

function headerValue(headers: string, name: string): string | null {
  const match = new RegExp(`^${name}:\\s*(.*)$`, 'im').exec(headers)
  return match?.[1]?.trim() ?? null
}

function readHeaders(file: string): string {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  } catch {
    return ''
  }
}

/** The bridged request: exactly the shape the historical stall was observed on. */
function bridgedRequest(
  options: Options,
  caCert: string,
  headerFile: string,
): { exit: number; ms: number; status: string; location: string | null } {
  const started = performance.now()
  const result = spawnSync(
    'curl',
    [
      '--silent',
      '--show-error',
      ...(process.platform === 'win32' ? ['--ssl-no-revoke'] : []),
      '--proxy',
      `http://127.0.0.1:${String(options.port)}`,
      '--cacert',
      caCert,
      '-m',
      String(BRIDGE_REQUEST_TIMEOUT_MS / 1000),
      '-o',
      os.devNull,
      '-D',
      headerFile,
      `${options.scheme}://${options.host}/`,
    ],
    { encoding: 'utf8', timeout: BRIDGE_REQUEST_TIMEOUT_MS + 10_000 },
  )
  const ms = Math.round(performance.now() - started)
  const headers = readHeaders(headerFile)
  return {
    exit: result.status ?? (result.error ? 127 : 0),
    ms,
    status: lastStatusLine(headers),
    location: headerValue(headers, 'location'),
  }
}

/** The gateway's own login page — not a proxied site path that merely contains "login". */
function isGatewayLogin(url: string, webvpnHost: string): boolean {
  return url.includes(`//${webvpnHost}/login`)
}

/** The same WRD path, straight from this process (no bridge, no cookie). */
function directControl(
  url: string,
  webvpnHost: string,
): { exit: number; status: string; ms: number; toLogin: boolean } {
  const result = run(
    'curl',
    [
      '--silent',
      '--show-error',
      ...(process.platform === 'win32' ? ['--ssl-no-revoke'] : []),
      '-m',
      String(BRIDGE_REQUEST_TIMEOUT_MS / 1000),
      '-o',
      os.devNull,
      '-w',
      '%{http_code} %{time_total} %{redirect_url}',
      url,
    ],
    BRIDGE_REQUEST_TIMEOUT_MS + 10_000,
  )
  const [status = '', seconds = '0', redirect = ''] = result.stdout.trim().split(/\s+/)
  return {
    exit: result.code,
    status: status || '(空)',
    ms: Math.round(Number.parseFloat(seconds || '0') * 1000),
    // Only the classification is kept: the redirect target is a URL and never persisted.
    toLogin: isGatewayLogin(redirect, webvpnHost),
  }
}

function bridgePortOpen(port: number): Promise<boolean> {
  return tcpProbe('127.0.0.1', port, 1_000).then((probe) => probe.ok)
}

/** Sanitized `bridge-upstream.log` records from this round onward (newest last). */
function stallRecords(logPath: string, sinceMs: number): unknown[] {
  if (!existsSync(logPath)) return []
  const entries: unknown[] = []
  for (const line of readFileSync(logPath, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      const entry: unknown = JSON.parse(line)
      const ts = (entry as { ts?: unknown }).ts
      if (typeof ts === 'string' && Date.parse(ts) >= sinceMs) entries.push(entry)
    } catch {
      // A partially written line is not evidence; skip it.
    }
  }
  return entries.slice(-20)
}

function defaultRouteSnapshot(): string {
  if (process.platform === 'win32') {
    const result = run('powershell', [
      '-NoProfile',
      '-Command',
      'Get-NetRoute -AddressFamily IPv4 -DestinationPrefix 0.0.0.0/0 | Select-Object ifIndex,NextHop,InterfaceAlias | Format-Table -AutoSize',
    ])
    return (result.stdout.trim() || result.stderr.trim() || '(无输出)').replace(/\s+$/, '')
  }
  const result = run('netstat', ['-rn'])
  const defaults = result.stdout
    .split('\n')
    .filter((line) => /^default|^0\.0\.0\.0/.test(line.trim()))
  return defaults.join('\n').trim() || '(未找到默认路由)'
}

function verdictOf(round: RoundFacts): string {
  const abnormal = round.bridge_exit !== 0 || round.bridge_ms > BRIDGE_ABNORMAL_MS
  if (!abnormal) return 'no-stall'
  const controlHealthy =
    round.pre_tcp.ok &&
    round.pre_tls.ok &&
    round.post_tcp.ok &&
    round.post_tls.ok &&
    round.dns_ms < DNS_SLOW_MS
  return controlHealthy ? 'bridge-side' : 'network-or-resolver'
}

function formatRound(round: Round): string {
  return [
    `#${String(round.round).padStart(2, '0')} ${round.verdict}`,
    `bridge=exit ${String(round.bridge_exit)} / ${String(round.bridge_ms)}ms / ${round.bridge_status}`,
    `dns=${String(round.dns_ms)}ms tcp=${String(round.pre_tcp.ms)}ms/${round.pre_tcp.ok ? 'ok' : 'fail'}`,
    `tls=${String(round.pre_tls.ms)}ms/${round.pre_tls.ok ? (round.pre_tls.alpn ?? 'ok') : 'fail'}`,
    `post-tcp=${round.post_tcp.ok ? 'ok' : 'fail'} post-tls=${round.post_tls.ok ? 'ok' : 'fail'}`,
    `direct=exit ${String(round.direct_exit)} / ${String(round.direct_ms)}ms / ${round.direct_status}${round.direct_to_login ? '（→ 登录页，未带 Cookie）' : ''}`,
  ].join('  ')
}

async function probeControls(
  address: string | null,
  webvpnHost: string,
  options: Options,
): Promise<{ tcp: Probe; tls: Probe }> {
  const tcp = await tcpProbe(address, 443, options.connectTimeoutMs)
  const tls = tcp.ok
    ? await tlsProbe(address, webvpnHost, 443, options.connectTimeoutMs)
    : { ms: 0, ok: false, addr: address, alpn: null }
  return { tcp, tls }
}

async function main(): Promise<number> {
  let options: Options | null
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${describe(error)}\n\n${USAGE}\n`)
    return 2
  }
  if (options === null) {
    process.stderr.write(`${USAGE}\n`)
    return 2
  }

  const out = path.resolve(options.out)
  const relative = path.relative(repoRoot, out)
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    process.stderr.write(`--out 不得位于仓库内（${out}）：运行证据不入库。\n`)
    return 2
  }

  const configPath = path.join(options.userDataDir, 'bridge-config.json')
  if (!existsSync(configPath)) {
    process.stderr.write(`找不到 ${configPath}：先启动应用并开桥（本脚本不读该文件除 webvpnBase 之外的内容）。\n`)
    return 2
  }
  const caCert = path.join(options.userDataDir, 'mitmproxy', 'mitmproxy-ca-cert.pem')
  if (!existsSync(caCert)) {
    process.stderr.write(`找不到 ${caCert}：先在应用内「安装本机 CA」并开桥。\n`)
    return 2
  }
  const upstreamLog = path.join(options.userDataDir, 'bridge-upstream.log')

  let webvpnHost: string
  try {
    const raw: unknown = JSON.parse(readFileSync(configPath, 'utf8'))
    webvpnHost = new URL(String((raw as { webvpnBase?: unknown }).webvpnBase)).hostname
  } catch (error) {
    process.stderr.write(`${configPath} 的 webvpnBase 不可解析：${describe(error)}\n`)
    return 2
  }

  const startedAt = new Date()
  const stamp = `${startedAt.getFullYear()}${String(startedAt.getMonth() + 1).padStart(2, '0')}${String(startedAt.getDate()).padStart(2, '0')}-${String(startedAt.getHours()).padStart(2, '0')}${String(startedAt.getMinutes()).padStart(2, '0')}${String(startedAt.getSeconds()).padStart(2, '0')}`
  mkdirSync(out, { recursive: true })
  const evidencePath = path.join(out, `diagnose-upstream-${process.platform}-${stamp}.jsonl`)
  const commit = run('git', ['rev-parse', '--short', 'HEAD']).stdout.trim() || '(unknown)'

  const header = {
    kind: 'env',
    date: startedAt.toISOString(),
    platform: `${os.platform()} ${os.release()}`,
    node: process.version,
    commit,
    userDataDir: options.userDataDir,
    upstreamLog,
    target: `${options.scheme}://${options.host}`,
    webvpnHost,
    port: options.port,
    rounds: options.rounds,
    pauseMs: options.pauseMs,
    connectTimeoutMs: options.connectTimeoutMs,
    bridgeRequestTimeoutMs: BRIDGE_REQUEST_TIMEOUT_MS,
    defaultRoute: defaultRouteSnapshot(),
  }
  const evidence: unknown[] = [header]
  console.log(`环境: ${header.platform} / node ${header.node} / commit ${commit}`)
  console.log(`目标: ${header.target}  |  网关: ${webvpnHost}  |  桥: 127.0.0.1:${String(options.port)}`)
  console.log(`默认路由:\n${header.defaultRoute}`)
  console.log(`轮次: ${String(options.rounds)}  间隔: ${String(options.pauseMs)}ms  证据: ${evidencePath}`)

  const counts: Record<string, number> = { 'bridge-side': 0, 'network-or-resolver': 0, 'no-stall': 0 }
  let consecutivePortFailures = 0

  for (let index = 1; index <= options.rounds; index += 1) {
    if (index > 1) await sleep(options.pauseMs)

    if (!(await bridgePortOpen(options.port))) {
      consecutivePortFailures += 1
      console.log(`#${String(index).padStart(2, '0')} 桥端口 ${String(options.port)} 不可连（${String(consecutivePortFailures)}/3）`)
      if (consecutivePortFailures >= 3) {
        process.stderr.write(`桥未运行：127.0.0.1:${String(options.port)} 连续 3 轮不可连。\n`)
        evidence.push({ kind: 'aborted', reason: 'bridge-port-unreachable' })
        writeFileSync(evidencePath, `${evidence.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8')
        return 2
      }
      continue
    }
    consecutivePortFailures = 0

    const roundStart = Date.now()
    const dns = await dnsProbe(webvpnHost)
    const address = dns.addrs[0] ?? null
    const pre = await probeControls(address, webvpnHost, options)
    const headerFile = path.join(os.tmpdir(), `swufe-diagnose-headers-${String(roundStart)}.txt`)
    const bridged = bridgedRequest(options, caCert, headerFile)
    rmSync(headerFile, { force: true })
    const post = await probeControls(address, webvpnHost, options)

    let direct = { exit: 0, status: '(跳过)', ms: 0, toLogin: false }
    if (bridged.location !== null) {
      direct = directControl(bridged.location, webvpnHost)
    } else {
      // No response headers at all means the upstream answered nothing: that is the stall
      // shape itself, and the same-path control can only be built from a real Location.
      console.log('# 提示: 本轮响应没有 location 头（上游未返回响应头），跳过第 6 步同路径直连对照')
    }

    // The session signal has to come from the *bridged* response, which carries the cookies
    // the bridge injects, and only the gateway's own login page counts (a proxied site path
    // may legitimately contain "login"). The direct control deliberately sends no cookie, so
    // the gateway bounces it to that page whenever the path is healthy — a fast round trip,
    // not an expiry, and it must never abort the run.
    if (bridged.status.startsWith('302') && bridged.location !== null && isGatewayLogin(bridged.location, webvpnHost)) {
      console.log('会话已过期（经桥响应 302 → 网关登录页）：请在应用内重新登录后重跑。')
      evidence.push({ kind: 'aborted', reason: 'session-expired' })
      writeFileSync(evidencePath, `${evidence.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8')
      return 2
    }

    const partial = {
      round: index,
      started_at: new Date(roundStart).toISOString(),
      dns_ms: dns.ms,
      dns_addrs: dns.addrs,
      pre_tcp: pre.tcp,
      pre_tls: pre.tls,
      bridge_exit: bridged.exit,
      bridge_status: bridged.status,
      bridge_ms: bridged.ms,
      post_tcp: post.tcp,
      post_tls: post.tls,
      direct_exit: direct.exit,
      direct_status: direct.status,
      direct_ms: direct.ms,
      direct_to_login: direct.toLogin,
    }
    const verdict = verdictOf(partial)
    const abnormal = verdict !== 'no-stall'
    const round: Round = {
      ...partial,
      verdict,
      stall_records: abnormal ? stallRecords(upstreamLog, roundStart) : [],
    }
    counts[verdict] = (counts[verdict] ?? 0) + 1
    evidence.push(round)

    console.log(formatRound(round))
    if (abnormal) {
      console.log(`     阶段记录: ${round.stall_records.length} 条（ts >= 本轮开始）`)
      for (const entry of round.stall_records) console.log(`     ${JSON.stringify(entry)}`)
      console.log(`     默认路由:\n${defaultRouteSnapshot()}`)
    } else if (index % 5 === 0) {
      console.log(`     默认路由:\n${defaultRouteSnapshot()}`)
    }
  }

  const summary = {
    kind: 'summary',
    rounds: options.rounds,
    counts,
    upstreamLogExists: existsSync(upstreamLog),
    defaultRoute: defaultRouteSnapshot(),
  }
  evidence.push(summary)
  writeFileSync(evidencePath, `${evidence.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8')

  console.log('')
  console.log(`汇总: 轮数 ${String(options.rounds)}  |  bridge-side ${String(counts['bridge-side'])}  |  network-or-resolver ${String(counts['network-or-resolver'])}  |  no-stall ${String(counts['no-stall'])}`)
  if (!summary.upstreamLogExists) {
    console.log(`上游阶段记录: 无 ${upstreamLog}（正常路径不写日志：只有超时/重试/失败或慢响应才会落盘）`)
  } else {
    console.log(`上游阶段记录: ${upstreamLog}`)
  }
  console.log('上游有界化信息: 请确认桥由本次改造后的 sidecar 启动 —— `swufe-ready` 行应含 upstream_connect_timeout_ms / upstream_connect_attempts / upstream_log 三键；桥内建连上限为 4s × 2 次尝试，超时对客户端表现为 502。')
  console.log(`证据: ${evidencePath}`)
  return 0
}

process.exitCode = await main()
