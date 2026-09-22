/**
 * Main-side contract for high-frequency log pushes (spec 002 Q2-004 / SNFR-005).
 *
 * Events arriving in a burst are handed to `onFlush` in arrival order once per merge
 * window: 100ms normally, 250ms while the window is saturated (its row count has
 * reached the buffer limit) and the inflow stays above 50 events/second. The window
 * is measured from the first pending event, so a hot stream cannot defer a flush
 * indefinitely — the delay only ever stretches to 250ms.
 */

import type { DebugLogEvent } from '../../shared/types'

export interface LogBatchOptions {
  /** True once the receiving window already holds `MAX_DEBUG_LOG_ENTRIES` rows. */
  isSaturated: () => boolean
}

export interface LogBatcher {
  push(event: DebugLogEvent): void
  flush(): void
  dispose(): void
}

const NORMAL_DELAY_MS = 100
const SATURATED_DELAY_MS = 250
const RATE_WINDOW_MS = 1_000
const SATURATED_RATE = 50

export function createLogBatcher(
  onFlush: (events: DebugLogEvent[]) => void,
  options: LogBatchOptions,
): LogBatcher {
  let pending: DebugLogEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let batchStart = 0
  let deadline = 0
  const arrivals: number[] = []

  function delay(): number {
    const now = Date.now()
    while (arrivals.length > 0 && now - (arrivals[0] as number) > RATE_WINDOW_MS) arrivals.shift()
    return options.isSaturated() && arrivals.length > SATURATED_RATE
      ? SATURATED_DELAY_MS
      : NORMAL_DELAY_MS
  }

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (pending.length === 0) return
    const events = pending
    pending = []
    batchStart = 0
    deadline = 0
    onFlush(events)
  }

  return {
    push(event) {
      const now = Date.now()
      if (pending.length === 0) batchStart = now
      arrivals.push(now)
      pending.push(event)
      const nextDeadline = batchStart + delay()
      if (nextDeadline === deadline && timer !== null) return
      if (timer !== null) clearTimeout(timer)
      deadline = nextDeadline
      timer = setTimeout(flush, Math.max(0, nextDeadline - now))
    },
    flush,
    dispose() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      pending = []
      batchStart = 0
      deadline = 0
    },
  }
}
