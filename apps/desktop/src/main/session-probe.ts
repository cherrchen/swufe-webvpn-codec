/** Session-expiry evidence classification (EC-007), kept pure for unit testing. */

import { AUTH_HOST } from './constants'
import type { ProbeResult } from './session-types'

/** A 2xx portal response means the session still works; a 3xx to the WebVPN login
 * page or to CAS means it does not. Anything else (network error, 5xx) is
 * inconclusive and must not flip the state. */
export function classifyProbe(
  status: number,
  locationHost: string | null,
  locationPath: string | null,
  webvpnHost: string,
): ProbeResult {
  if (status >= 200 && status < 300) return 'valid'
  if (status >= 300 && status < 400 && locationHost !== null) {
    if (locationHost === AUTH_HOST) return 'expired'
    if (locationHost === webvpnHost && (locationPath ?? '').startsWith('/login')) return 'expired'
  }
  return 'unknown'
}
