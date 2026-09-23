/** Windows system proxy via the WinINET registry settings (no WM_SETTINGCHANGE broadcast).
 *
 * Known limitation, recorded in the M2 milestone: already-running browsers may keep
 * the previous proxy until they are restarted. Real-machine verification is deferred
 * to M4/T038.
 */

import { run } from '../../exec'
import { parseWinInetValue, shouldClear, winInetState } from '../parse'
import type { ProxyEntry, SystemProxy } from '../types'

const INTERNET_SETTINGS = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'

export class Win32SystemProxy implements SystemProxy {
  constructor(private readonly execute: typeof run = run) {}

  async read(): Promise<ProxyEntry[]> {
    const enable = await this.execute('reg', ['query', INTERNET_SETTINGS, '/v', 'ProxyEnable'])
    const server = await this.execute('reg', ['query', INTERNET_SETTINGS, '/v', 'ProxyServer'])
    const parsed = parseWinInetValue(`${enable.stdout}\n${server.stdout}`)
    const state = winInetState(parsed.enable, parsed.server)
    return [{ service: 'Internet Settings', web: state, secure: state }]
  }

  async enable(port: number): Promise<void> {
    // A disabled WinINET profile may retain another tool's old ProxyServer.
    // Write our target first so a failure cannot briefly activate that stale target.
    await this.write('ProxyServer', 'REG_SZ', `127.0.0.1:${port}`)
    await this.write('ProxyEnable', 'REG_DWORD', '1')
  }

  async disable(port: number): Promise<void> {
    for (const entry of await this.read()) {
      if (shouldClear(entry.web, port)) await this.write('ProxyEnable', 'REG_DWORD', '0')
    }
  }

  private async write(name: string, type: string, value: string): Promise<void> {
    const result = await this.execute('reg', ['add', INTERNET_SETTINGS, '/v', name, '/t', type, '/d', value, '/f'])
    if (result.code !== 0) {
      throw new Error(`reg add ${name} 失败：${result.stderr.trim() || `退出码 ${result.code}`}`)
    }
  }
}
