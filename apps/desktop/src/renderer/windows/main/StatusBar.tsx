/** Status bar: the state name is always written out, never carried by colour alone. */

import { Tag } from 'antd'

import type { BridgeStatus } from '../../../shared/types'

export type StatusTone = 'muted' | 'ok' | 'busy' | 'warn' | 'error'

const TAG_COLOR: Record<StatusTone, string> = {
  muted: 'default',
  ok: 'green',
  busy: 'blue',
  warn: 'orange',
  error: 'red',
}

/** Same mapping as the pre-React renderer (see docs/ui-ux/main-window.md § 状态). */
export function describeStatus(status: BridgeStatus | null): { text: string; tone: StatusTone } {
  if (status?.error?.code === 'SESSION_EXPIRED') return { text: '过期处理中', tone: 'warn' }
  if (status?.state === 'error') return { text: '错误', tone: 'error' }
  if (status?.state === 'running') {
    return status.localCaptureEnabled
      ? { text: '桥接中（进程捕获）', tone: 'ok' }
      : { text: '桥接中', tone: 'ok' }
  }
  if (status?.state === 'starting') return { text: '桥接中（正在启动）', tone: 'busy' }
  if (status?.state === 'stopping') return { text: '正在停止', tone: 'busy' }
  return status?.loggedIn ? { text: '已登录', tone: 'ok' } : { text: '未登录', tone: 'muted' }
}

export function StatusBar({ status }: { status: BridgeStatus | null }) {
  const label = describeStatus(status)
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'baseline' }}>
      <strong style={{ flex: 'none' }}>SWUFE WebVPN Bridge</strong>
      <Tag color={TAG_COLOR[label.tone]} style={{ marginInline: 8 }}>
        {label.text}
      </Tag>
      <span>{status?.error?.message ?? ''}</span>
    </div>
  )
}
