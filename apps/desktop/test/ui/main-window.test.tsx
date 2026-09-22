/** Main window behaviour: status mapping, disabled rules, modals, summary and switches. */

import { screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { MainWindow } from '../../src/renderer/windows/main/MainWindow'
import { describeStatus } from '../../src/renderer/windows/main/StatusBar'
import type { BridgeStatus } from '../../src/shared/types'
import { installBridgeFake } from './helpers/bridge-fake'
import { renderInShell } from './helpers/render'

function status(patch: Partial<BridgeStatus>): BridgeStatus {
  return {
    state: 'idle',
    loggedIn: false,
    systemProxyEnabled: false,
    localCaptureEnabled: false,
    bridgePort: 8080,
    ...patch,
  }
}

test('every bridge state maps to its documented label', () => {
  expect(describeStatus(null)).toEqual({ text: '未登录', tone: 'muted' })
  expect(describeStatus(status({ loggedIn: true }))).toEqual({ text: '已登录', tone: 'ok' })
  expect(describeStatus(status({ state: 'running', loggedIn: true }))).toEqual({
    text: '桥接中',
    tone: 'ok',
  })
  expect(
    describeStatus(status({ state: 'running', loggedIn: true, localCaptureEnabled: true })),
  ).toEqual({ text: '桥接中（进程捕获）', tone: 'ok' })
  expect(describeStatus(status({ state: 'starting', loggedIn: true }))).toEqual({
    text: '桥接中（正在启动）',
    tone: 'busy',
  })
  expect(describeStatus(status({ state: 'stopping', loggedIn: true }))).toEqual({
    text: '正在停止',
    tone: 'busy',
  })
  expect(describeStatus(status({ state: 'error', loggedIn: true }))).toEqual({
    text: '错误',
    tone: 'error',
  })
  expect(
    describeStatus(
      status({ state: 'running', loggedIn: true, error: { code: 'SESSION_EXPIRED', message: '过期' } }),
    ),
  ).toEqual({ text: '过期处理中', tone: 'warn' })
})

test('the bridge switch is disabled while logged out and enabled after login', async () => {
  const fake = installBridgeFake()
  renderInShell(<MainWindow />)

  const toggle = (await screen.findByRole('switch', { name: '开启桥接' })) as HTMLButtonElement
  expect(toggle.disabled).toBe(true)

  fake.emitStatus(status({ loggedIn: true }))
  await waitFor(() =>
    expect((screen.getByRole('switch', { name: '开启桥接' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  )
  expect(screen.getByRole('button', { name: '重新登录' })).toBeTruthy()
})

test('a proxy conflict opens the modal in the main window', async () => {
  installBridgeFake({
    getStatus: async () =>
      status({ loggedIn: true }),
    startBridge: async () =>
      status({
        loggedIn: true,
        state: 'error',
        error: { code: 'PROXY_CONFLICT', message: '检测到代理环境冲突：系统代理已启用。' },
      }),
  })
  renderInShell(<MainWindow />)

  const toggle = (await screen.findByRole('switch', { name: '开启桥接' })) as HTMLButtonElement
  await waitFor(() => expect(toggle.disabled).toBe(false))
  toggle.click()

  // antd renders the title on the dialog and on its confirm header; assert on the dialog.
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getAllByText('检测到代理环境冲突').length).toBeGreaterThan(0)
  expect(within(dialog).getByText('检测到代理环境冲突：系统代理已启用。')).toBeTruthy()
})

test('any other failure code keeps its code in the message row', async () => {
  installBridgeFake({
    getStatus: async () => status({ loggedIn: true }),
    startBridge: async () =>
      status({
        loggedIn: true,
        state: 'error',
        error: { code: 'CA_MISSING', message: '需要安装本机证书才能处理 HTTPS' },
      }),
  })
  renderInShell(<MainWindow />)

  const toggle = (await screen.findByRole('switch', { name: '开启桥接' })) as HTMLButtonElement
  await waitFor(() => expect(toggle.disabled).toBe(false))
  toggle.click()

  expect(await screen.findByText('CA_MISSING：需要安装本机证书才能处理 HTTPS')).toBeTruthy()
})

test('the allowlist summary counts hosts and the wildcard, and 管理… opens the window', async () => {
  const fake = installBridgeFake({
    getAllowlist: async () => ({
      hosts: ['jwxt.swufe.edu.cn', 'portal.swufe.edu.cn'],
      includeSwufeWildcard: true,
    }),
  })
  renderInShell(<MainWindow />)

  expect(await screen.findByText('2 个主机（含 *.swufe.edu.cn）')).toBeTruthy()
  screen.getByRole('button', { name: '管理…' }).click()
  await waitFor(() => expect(fake.calls).toContain('openAllowlistWindow'))
})

test('an empty allowlist is reported as such, wildcard included', async () => {
  installBridgeFake({
    getAllowlist: async () => ({ hosts: [], includeSwufeWildcard: true }),
  })
  renderInShell(<MainWindow />)

  expect(await screen.findByText('未添加主机（含 *.swufe.edu.cn）')).toBeTruthy()
})

test('cancelling the CA risk notice installs nothing', async () => {
  const fake = installBridgeFake()
  renderInShell(<MainWindow />)

  const install = await screen.findByRole('button', { name: '安装本机 CA' })
  install.click()
  const dialog = await screen.findByRole('dialog')
  expect(
    within(dialog).getAllByText('本证书用于在本机解密并改写 HTTPS，仅限个人设备；可随时卸载。').length,
  ).toBeGreaterThan(0)

  within(dialog).getByRole('button', { name: '取消' }).click()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(fake.calls).not.toContain('installCa')
})

test('confirming the risk notice installs the CA and reports the result', async () => {
  const fake = installBridgeFake()
  renderInShell(<MainWindow />)

  ;(await screen.findByRole('button', { name: '安装本机 CA' })).click()
  ;(await screen.findByRole('button', { name: '确认安装' })).click()

  await waitFor(() => expect(fake.calls).toContain('installCa'))
  expect(await screen.findByText('本机 CA 已安装并被系统信任。')).toBeTruthy()
})

test('the debug-log switch persists the flag and opens the log window', async () => {
  const fake = installBridgeFake()
  renderInShell(<MainWindow />)

  const label = await screen.findByText('调试日志')
  const toggle = label.parentElement?.querySelector('.ant-switch')
  expect(toggle).toBeTruthy()
  ;(toggle as HTMLElement).click()

  await waitFor(() => expect(fake.calls).toContain('setDebugLogging'))
  expect(fake.args[fake.calls.indexOf('setDebugLogging')]).toEqual([true])
  expect(fake.calls).toContain('openLogWindow')
})

test('a session-expiry push opens the re-login modal owned by the main window', async () => {
  const fake = installBridgeFake()
  renderInShell(<MainWindow />)
  await screen.findByRole('switch', { name: '开启桥接' })

  fake.emitSessionExpired()

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getAllByText('会话已过期').length).toBeGreaterThan(0)
  expect(within(dialog).getByText('WebVPN 会话已失效。桥接已停止并已清除系统代理。')).toBeTruthy()
  within(dialog).getByRole('button', { name: '去登录' }).click()
  await waitFor(() => expect(fake.calls).toContain('login'))
})
