/**
 * Main-side ring buffer of debug-log events: newest first, at most `MAX_DEBUG_LOG_ENTRIES`.
 *
 * The log window is created and destroyed on demand, so the history has to outlive it
 * (REQ-009 / AC2-006). Memory only — the buffer is never written to disk (NFR-003).
 */

import { MAX_DEBUG_LOG_ENTRIES } from '../shared/limits'
import type { DebugLogEvent } from '../shared/types'

export interface DebugLogBuffer {
  push(event: DebugLogEvent): void
  /** A copy of the buffer, newest first. */
  snapshot(): DebugLogEvent[]
  clear(): void
  size(): number
}

export function createDebugLogBuffer(limit: number = MAX_DEBUG_LOG_ENTRIES): DebugLogBuffer {
  const events: DebugLogEvent[] = []
  return {
    push(event) {
      events.unshift(event)
      if (events.length > limit) events.length = limit
    },
    snapshot() {
      return [...events]
    },
    clear() {
      events.length = 0
    },
    size() {
      return events.length
    },
  }
}
