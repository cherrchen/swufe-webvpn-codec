/** Log-row formatting, unchanged from the pre-React renderer. */

import type { DebugLogEvent } from '../../shared/types'

export function logTime(event: DebugLogEvent): string {
  const parsed = new Date(event.ts)
  return Number.isNaN(parsed.getTime())
    ? event.ts
    : parsed.toLocaleTimeString('zh-CN', { hour12: false })
}

export function describeLogResult(event: DebugLogEvent): string {
  const base = event.rewritten ? (event.direction === 'request' ? '已改写' : '响应改写') : '直连'
  return event.detail ? `${base}（${event.detail}）` : base
}
