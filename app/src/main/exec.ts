/** Thin, shell-free command execution used by every OS adapter. */

import { execFile } from 'node:child_process'

import { COMMAND_TIMEOUT_MS } from './constants'

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

function toResult(error: unknown, stdout: string, stderr: string): RunResult {
  if (error === null || error === undefined) return { code: 0, stdout, stderr }
  const code = (error as { code?: unknown }).code
  if (typeof code === 'number') return { code, stdout, stderr }
  return { code: 1, stdout, stderr }
}

/** Run a command without a shell; never throws for non-zero exit codes. */
export function run(
  command: string,
  args: string[],
  options: { timeoutMs?: number } = {},
): Promise<RunResult> {
  const timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS
  const { promise, resolve, reject } = Promise.withResolvers<RunResult>()
  execFile(
    command,
    args,
    { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
    (error, stdout, stderr) => {
      // A killed timeout has no useful stdout/stderr; surface it as a failure.
      if (error && (error as { killed?: boolean }).killed) {
        reject(new Error(`命令超时（${timeoutMs}ms）：${command}`))
        return
      }
      resolve(toResult(error, stdout, stderr))
    },
  )
  return promise
}

/**
 * Run a privileged shell command through osascript's "with administrator privileges".
 * A user cancel surfaces as a non-zero exit code, never a throw.
 */
export async function runPrivilegedDarwin(shellCommand: string): Promise<RunResult> {
  const escaped = shellCommand.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  const result = await run('osascript', ['-e', `do shell script "${escaped}" with administrator privileges`])
  if (result.code !== 0 && /User canceled/i.test(result.stderr)) {
    return { code: 1, stdout: result.stdout, stderr: '已取消授权' }
  }
  return result
}
