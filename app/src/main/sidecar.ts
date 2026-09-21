/** Sidecar supervision: spawn the M1 Python bridge, read its stderr control lines,
 * and map failures onto the fixed error-code set (see docs/api/bridge-control-protocol.md).
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import type { BridgeErrorCode, DebugLogEvent } from '../shared/types'
import {
  BRIDGE_READY_TIMEOUT_MS,
  CONFDIR_NAME,
  RUNTIME_CONFIG_FILENAME,
  SIDECAR_STOP_TIMEOUT_MS,
} from './constants'
import { resolvePythonCommand } from './python'

export type SidecarEvent =
  | { kind: 'ready'; payload: Record<string, unknown> }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'debug'; event: DebugLogEvent }

export interface Sidecar {
  start(): Promise<void>
  stop(): Promise<void>
  onExit(cb: (code: number | null, signal: string | null) => void): void
  onDebug(cb: (event: DebugLogEvent) => void): void
}

export interface SidecarOptions {
  repoRoot: string
  userDataDir: string
  port: number
}

const DEBUG_KEYS = ['ts', 'host', 'rewritten', 'direction', 'detail'] as const

function debugEvent(payload: Record<string, unknown>): DebugLogEvent {
  const event: DebugLogEvent = {
    ts: typeof payload.ts === 'string' ? payload.ts : new Date().toISOString(),
    host: typeof payload.host === 'string' ? payload.host : '',
    rewritten: payload.rewritten === true,
    direction: payload.direction === 'response' ? 'response' : 'request',
  }
  if (typeof payload.detail === 'string') event.detail = payload.detail
  return event
}

/**
 * Parse one stderr line of the sidecar. Debug payloads are reduced to the five
 * documented keys so a future sidecar cannot leak cookies or bodies through IPC
 * (INV-001).
 */
export function parseSidecarLine(line: string): SidecarEvent | null {
  const text = line.trim()
  if (text.startsWith('swufe-ready ')) {
    try {
      const payload = JSON.parse(text.slice('swufe-ready '.length)) as unknown
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
      return { kind: 'ready', payload: payload as Record<string, unknown> }
    } catch {
      return null
    }
  }
  if (text.startsWith('swufe-error ')) {
    const rest = text.slice('swufe-error '.length).trim()
    const [code = '', ...message] = rest.split(/\s+/)
    if (!code) return null
    return { kind: 'error', code, message: message.join(' ') }
  }
  if (text.startsWith('swufe-debug ')) {
    try {
      const payload = JSON.parse(text.slice('swufe-debug '.length)) as unknown
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
      const source = payload as Record<string, unknown>
      const reduced: Record<string, unknown> = {}
      for (const key of DEBUG_KEYS) reduced[key] = source[key]
      return { kind: 'debug', event: debugEvent(reduced) }
    } catch {
      return null
    }
  }
  return null
}

/** Every sidecar failure is a bridge crash to the UI except an empty allowlist. */
export function mapSidecarError(code: string | null): BridgeErrorCode {
  return code === 'ALLOWLIST_EMPTY' ? 'ALLOWLIST_EMPTY' : 'BRIDGE_CRASH'
}

export async function waitForTcpPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await canConnect(port)) return
    await delay(100)
  }
  throw new Error(`桥接进程已报告就绪，但 127.0.0.1:${port} 无法连接。`)
}

function canConnect(port: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const socket = createConnection({ host: '127.0.0.1', port })
  socket.once('connect', () => {
    socket.destroy()
    resolve(true)
  })
  socket.once('error', () => {
    socket.destroy()
    resolve(false)
  })
  return promise
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  const { promise: timeout, reject } = Promise.withResolvers<never>()
  const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const timer = setTimeout(() => resolve(false), timeoutMs)
  child.once('close', () => {
    clearTimeout(timer)
    resolve(true)
  })
  return promise
}

export class SidecarProcess implements Sidecar {
  private child: ChildProcess | null = null
  private stopping = false
  private failure: { code: string; message: string } | null = null
  private readonly exitListeners: Array<(code: number | null, signal: string | null) => void> = []
  private readonly debugListeners: Array<(event: DebugLogEvent) => void> = []

  constructor(private readonly options: SidecarOptions) {}

  onExit(cb: (code: number | null, signal: string | null) => void): void {
    this.exitListeners.push(cb)
  }

  onDebug(cb: (event: DebugLogEvent) => void): void {
    this.debugListeners.push(cb)
  }

  async start(): Promise<void> {
    const python = resolvePythonCommand(this.options.repoRoot)
    const args = [
      ...python.args,
      '-m',
      'swufe_bridge.sidecar',
      '--config',
      join(this.options.userDataDir, RUNTIME_CONFIG_FILENAME),
      '--port',
      String(this.options.port),
      '--confdir',
      join(this.options.userDataDir, CONFDIR_NAME),
    ]
    const child = spawn(python.command, args, {
      cwd: this.options.repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    this.stopping = false
    this.failure = null

    const readiness = Promise.withResolvers<Record<string, unknown>>()
    const handleLine = (line: string): void => {
      const event = parseSidecarLine(line)
      if (!event) return
      if (event.kind === 'debug') {
        for (const listener of this.debugListeners) listener(event.event)
        return
      }
      if (event.kind === 'error') {
        this.failure = { code: event.code, message: event.message }
        readiness.reject(new Error(event.message || event.code))
        return
      }
      readiness.resolve(event.payload)
    }
    createInterface({ input: child.stdout }).on('line', handleLine)
    createInterface({ input: child.stderr }).on('line', handleLine)

    child.on('error', (error) => readiness.reject(error))
    child.on('close', (code, signal) => {
      readiness.reject(
        new Error(this.failure?.message ?? `桥接进程提前退出（退出码 ${code ?? 'null'}）`),
      )
      if (this.stopping) return
      for (const listener of this.exitListeners) listener(code, signal)
    })

    await withTimeout(
      readiness.promise,
      BRIDGE_READY_TIMEOUT_MS,
      `桥接进程未在 ${BRIDGE_READY_TIMEOUT_MS / 1000} 秒内就绪。`,
    )
    await waitForTcpPort(this.options.port, BRIDGE_READY_TIMEOUT_MS)
  }

  async stop(): Promise<void> {
    const child = this.child
    this.child = null
    if (!child || child.exitCode !== null || child.signalCode !== null) return
    this.stopping = true
    child.kill('SIGTERM')
    if (await waitForExit(child, SIDECAR_STOP_TIMEOUT_MS)) return
    child.kill('SIGKILL')
    await waitForExit(child, SIDECAR_STOP_TIMEOUT_MS)
  }
}
