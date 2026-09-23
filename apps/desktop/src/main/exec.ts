/** Thin, shell-free command execution used by every OS adapter. */

import { spawn } from 'node:child_process'

import { COMMAND_TIMEOUT_MS, PRIVILEGE_PROMPT_TIMEOUT_MS } from './constants'

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

/** Output beyond this is dropped rather than buffered (`exec`'s `maxBuffer` equivalent). */
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024

/**
 * Run a command without a shell; never throws for non-zero exit codes.
 *
 * stdin is a closed pipe, never inherited: `certutil -user -addstore Root` (the Windows CA
 * install/uninstall) drains stdin before it exits, so an inherited pipe nobody closes hangs
 * it until the timeout — measured, KI-017. No adapter feeds stdin.
 */
export function run(
  command: string,
  args: string[],
  options: { timeoutMs?: number } = {},
): Promise<RunResult> {
  const timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS
  const { promise, resolve, reject } = Promise.withResolvers<RunResult>()
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  const timer = setTimeout(() => {
    child.kill()
    // A killed timeout has no useful stdout/stderr; surface it as a failure.
    reject(new Error(`命令超时（${timeoutMs}ms）：${command}`))
  }, timeoutMs)
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk
  })
  child.stderr.on('data', (chunk: string) => {
    if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk
  })
  child.on('error', (error) => {
    clearTimeout(timer)
    // Spawn failures (missing binary, not executable) keep the non-throwing contract.
    resolve({ code: 1, stdout, stderr: error.message })
  })
  child.on('close', (code) => {
    clearTimeout(timer)
    resolve({ code: code ?? 1, stdout, stderr })
  })
  return promise
}

/**
 * Run a privileged shell command through osascript's "with administrator privileges".
 * A user cancel surfaces as a non-zero exit code, never a throw.
 *
 * Only for writes that touch the keychain alone: the macOS CA keychain add and uninstall.
 * Trust settings must go through `platform/darwin/cert.ts` instead: an osascript-administered
 * child has no GUI session, so macOS refuses to prompt for that authorization (KI-007, ADR-0008).
 */
export async function runPrivilegedDarwin(shellCommand: string): Promise<RunResult> {
  const escaped = shellCommand.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  const result = await run('osascript', ['-e', `do shell script "${escaped}" with administrator privileges`], {
    timeoutMs: PRIVILEGE_PROMPT_TIMEOUT_MS,
  })
  if (result.code !== 0 && /User canceled/i.test(result.stderr)) {
    return { code: 1, stdout: result.stdout, stderr: '已取消授权' }
  }
  return result
}
