/** Prevent an old asynchronous probe from changing a newer login or stopped monitor. */

import type { ProbeResult } from './session-types'

export class SessionProbeGuard {
  private sessionRevision = 0
  private monitorRevision = 0
  private monitoring = false

  changeSession(): number {
    return ++this.sessionRevision
  }

  isCurrentSession(revision: number): boolean {
    return revision === this.sessionRevision
  }

  startMonitor(): void {
    this.monitoring = true
    this.monitorRevision++
  }

  stopMonitor(): void {
    this.monitoring = false
    this.monitorRevision++
  }

  async runMonitorProbe(
    probe: () => Promise<ProbeResult>,
    onValid: () => void,
    onExpired: () => void,
  ): Promise<void> {
    if (!this.monitoring) return
    const monitorRevision = this.monitorRevision
    const sessionRevision = this.sessionRevision
    const result = await probe()
    if (
      !this.monitoring ||
      monitorRevision !== this.monitorRevision ||
      sessionRevision !== this.sessionRevision
    ) return
    if (result === 'valid') onValid()
    if (result === 'expired') {
      // Only the first of several overlapping probes may expire this session.
      this.changeSession()
      onExpired()
    }
  }
}

export async function validateCapturedSession(
  cookieCount: number,
  probe: () => Promise<ProbeResult>,
): Promise<boolean> {
  return cookieCount > 0 && (await probe()) === 'valid'
}
