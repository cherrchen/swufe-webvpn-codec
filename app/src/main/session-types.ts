/** Session contract types shared by the broker, the orchestrator and their tests. */

export interface SessionCookie {
  name: string
  value: string
  domain: string
  path: string
}

export type ProbeResult = 'valid' | 'expired' | 'unknown'

/** The slice of SessionBroker the orchestrator needs (injectable in tests). */
export interface SessionLike {
  readonly loggedIn: boolean
  readonly cookies: SessionCookie[]
  getSession(): { loggedIn: boolean; expiresAt?: string | null }
  probe(): Promise<ProbeResult>
  clear(): Promise<void>
  startMonitor(onExpired: () => void): void
  stopMonitor(): void
}
