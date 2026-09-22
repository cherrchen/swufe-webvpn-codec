/** Primary actions: the login button and the bridge switch. */

import { Button, Switch } from 'antd'

import type { BridgeStatus } from '../../../shared/types'
import { bridge, describeError, parseFailure } from '../../lib/bridge-api'
import { loginOpenFailed } from '../../lib/messages'
import { useModals } from './modals'

export function PrimaryActions({
  status,
  setMessage,
}: {
  status: BridgeStatus | null
  setMessage: (text: string) => void
}) {
  const modals = useModals()
  const busy = status?.state === 'starting' || status?.state === 'stopping'
  const expired = status?.error?.code === 'SESSION_EXPIRED'
  const running = status?.state === 'running' || status?.state === 'starting'

  /** A rejected switch carries the code in the message prefix (see docs/api/electron-ipc.md). */
  async function report(failure: { code: string | null; message: string }): Promise<void> {
    if (failure.code === 'PROXY_CONFLICT') await modals.proxyConflict(failure.message)
    else if (failure.code) setMessage(`${failure.code}：${failure.message}`)
    else setMessage(failure.message)
  }

  async function toggle(next: boolean): Promise<void> {
    try {
      const result = next ? await bridge().startBridge() : await bridge().stopBridge()
      if (result.error) await report({ code: result.error.code, message: result.error.message })
      else setMessage('')
    } catch (error) {
      await report(parseFailure(error))
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button
        onClick={() => {
          void (async () => {
            try {
              await bridge().login()
              setMessage('')
            } catch (error) {
              setMessage(loginOpenFailed(describeError(error)))
            }
          })()
        }}
      >
        {status?.loggedIn ? '重新登录' : '登录 WebVPN'}
      </Button>
      <span>桥接</span>
      <Switch
        checked={running}
        disabled={Boolean(busy) || expired || !status?.loggedIn}
        aria-label={running ? '关闭桥接' : '开启桥接'}
        onChange={(next) => void toggle(next)}
      />
    </div>
  )
}
