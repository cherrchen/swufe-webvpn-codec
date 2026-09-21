/** macOS system proxy via `networksetup` (one proxy per enabled network service). */

import { run } from '../../exec'
import { parseNetworksetupProxy, parseNetworkServices, shouldClear } from '../parse'
import type { ProxyEntry, SystemProxy } from '../types'

const NETWORKSETUP = '/usr/sbin/networksetup'

export class DarwinSystemProxy implements SystemProxy {
  async read(): Promise<ProxyEntry[]> {
    const entries: ProxyEntry[] = []
    for (const service of await this.enabledServices()) {
      const web = await run(NETWORKSETUP, ['-getwebproxy', service])
      const secure = await run(NETWORKSETUP, ['-getsecurewebproxy', service])
      entries.push({
        service,
        web: parseNetworksetupProxy(web.stdout),
        secure: parseNetworksetupProxy(secure.stdout),
      })
    }
    return entries
  }

  async enable(port: number): Promise<void> {
    for (const service of await this.enabledServices()) {
      await this.must('-setwebproxy', service, '127.0.0.1', String(port))
      await this.must('-setsecurewebproxy', service, '127.0.0.1', String(port))
      await this.must('-setwebproxystate', service, 'on')
      await this.must('-setsecurewebproxystate', service, 'on')
    }
  }

  async disable(port: number): Promise<void> {
    for (const entry of await this.read()) {
      if (shouldClear(entry.web, port)) await this.must('-setwebproxystate', entry.service, 'off')
      if (shouldClear(entry.secure, port)) await this.must('-setsecurewebproxystate', entry.service, 'off')
    }
  }

  /** Enabled network services; a disabled service cannot carry a system proxy. */
  private async enabledServices(): Promise<string[]> {
    const result = await run(NETWORKSETUP, ['-listallnetworkservices'])
    if (result.code !== 0) {
      throw new Error(`无法枚举网络服务：${result.stderr.trim() || `退出码 ${result.code}`}`)
    }
    return parseNetworkServices(result.stdout)
      .filter((service) => !service.disabled)
      .map((service) => service.name)
  }

  private async must(...args: string[]): Promise<void> {
    const result = await run(NETWORKSETUP, args)
    if (result.code !== 0) {
      throw new Error(
        `networksetup ${args.join(' ')} 失败：${result.stderr.trim() || `退出码 ${result.code}`}`,
      )
    }
  }
}
