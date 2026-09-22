/** The renderer's only IPC exit: the preload-exposed `window.swufeBridge`. */

import type { SwufeBridgeApi } from '../../shared/types'

export function bridge(): SwufeBridgeApi {
  const api = window.swufeBridge
  if (!api) throw new Error('swufeBridge 未注入：渲染层只能经 preload 访问主进程。')
  return api
}

/**
 * Main → Renderer error text.
 *
 * Electron rejects `invoke` with an `Error` that keeps only `message`/`stack`, so
 * Main prefixes the error code onto the message (see docs/api/electron-ipc.md).
 */
export function parseFailure(error: unknown): { code: string | null; message: string } {
  const raw = error instanceof Error ? error.message : String(error)
  const stripped = raw.replace(/^Error invoking remote method '[^']*': Error: /, '')
  const match = stripped.match(/^([A-Z_]+)：/)
  return match
    ? { code: match[1] ?? null, message: stripped.slice(match[0].length) }
    : { code: null, message: stripped }
}

export function describeError(error: unknown): string {
  return parseFailure(error).message
}
