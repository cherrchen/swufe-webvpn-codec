/** Bridge state machine: idle → starting → running → stopping → idle, plus `error`.
 *
 * Illegal transitions throw. `fail()` parks the machine in `error`, which is kept
 * until the next start/stop call resets it (`reset()`), so the UI can show the
 * reason (data-model.md BridgeRuntimeStatus).
 */

import type { BridgeState } from '../shared/types'

const LEGAL: Record<BridgeState, readonly BridgeState[]> = {
  idle: ['starting'],
  starting: ['running', 'error'],
  running: ['stopping', 'error'],
  stopping: ['idle', 'error'],
  error: ['idle'],
}

export interface BridgeError {
  code: string
  message: string
}

export class BridgeStateMachine {
  private current: BridgeState = 'idle'
  private currentError: BridgeError | undefined

  get state(): BridgeState {
    return this.current
  }

  get error(): BridgeError | undefined {
    return this.currentError
  }

  transition(next: BridgeState): void {
    if (!LEGAL[this.current].includes(next)) {
      throw new Error(`非法状态迁移：${this.current} → ${next}`)
    }
    this.current = next
    this.currentError = undefined
  }

  /** Enter `error` from any state; the reason stays until the next operation. */
  fail(code: string, message: string): void {
    this.current = 'error'
    this.currentError = { code, message }
  }

  /** `error` → `idle` (no-op from any other state). */
  reset(): void {
    if (this.current !== 'error') return
    this.current = 'idle'
    this.currentError = undefined
  }
}
