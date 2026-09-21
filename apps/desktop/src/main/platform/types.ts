/** Platform adapter contracts (OS differences stay inside `platform/`). */

import type { ProxyState } from './parse'

/** One OS proxy container: a network service on macOS, the WinINET settings on Windows. */
export interface ProxyEntry {
  service: string
  web: ProxyState
  secure: ProxyState
}

export interface SystemProxy {
  /** Current proxy configuration; an empty array means "nothing to manage here". */
  read(): Promise<ProxyEntry[]>
  enable(port: number): Promise<void>
  /** Clear only entries that point at `127.0.0.1:<port>` (INV-002). */
  disable(port: number): Promise<void>
}

export interface CertManager {
  getStatus(): Promise<{ installed: boolean; trusted: boolean }>
  install(): Promise<{ ok: boolean; message?: string }>
  uninstall(): Promise<{ ok: boolean; message?: string }>
}
