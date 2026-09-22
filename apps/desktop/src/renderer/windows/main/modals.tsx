/** The three modals, all owned by the main window (EC2-003). */

import { App, type ModalFuncProps } from 'antd'
import { useCallback, useMemo } from 'react'

import { bridge } from '../../lib/bridge-api'
import { CA_WARNING_TEXT } from '../../lib/messages'

export interface Modals {
  /** NFR-005: resolves `true` only for 确认安装 — a cancel must not install anything. */
  caWarning(): Promise<boolean>
  proxyConflict(content: string): Promise<void>
  sessionExpired(content: string): Promise<void>
}

export function useModals(): Modals {
  const { modal } = App.useApp()

  /** Resolves with the user's choice; dismissing (Escape/mask) counts as a cancel. */
  const ask = useCallback(
    (kind: 'confirm' | 'info', props: ModalFuncProps, onConfirm?: () => void): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        modal[kind]({
          ...props,
          onOk: () => {
            onConfirm?.()
            resolve(true)
          },
          onCancel: () => resolve(false),
        })
      }),
    [modal],
  )

  return useMemo<Modals>(
    () => ({
      caWarning: () =>
        ask('confirm', {
          title: '安装本机 CA',
          content: CA_WARNING_TEXT,
          okText: '确认安装',
          cancelText: '取消',
        }),
      async proxyConflict(content) {
        await ask('info', { title: '检测到代理环境冲突', content, okText: '知道了' })
      },
      async sessionExpired(content) {
        await ask(
          'confirm',
          { title: '会话已过期', content, okText: '去登录', cancelText: '取消' },
          () => void bridge().login(),
        )
      },
    }),
    [ask],
  )
}

/** Session-expiry text when the status carries no reason of its own. */
export const SESSION_EXPIRED_FALLBACK = 'WebVPN 会话已失效。桥接已停止并已清除系统代理。'
