/** Capture window: the selection round trip, filter, failure state and empty states. */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'

import { CaptureWindow } from '../../src/renderer/windows/capture/CaptureWindow'
import type { AppSettingsView, BridgeStatus, CaptureCandidate } from '../../src/shared/types'
import { installBridgeFake } from './helpers/bridge-fake'
import { renderInShell } from './helpers/render'

const CHROME: CaptureCandidate = {
  pid: 100,
  name: 'Google Chrome',
  pattern: '/Applications/Google Chrome.app/',
}
const CURL: CaptureCandidate = { pid: 200, name: 'curl', pattern: '/usr/bin/curl' }
const SAFARI: CaptureCandidate = { pid: 300, name: 'Safari', pattern: '/Applications/Safari.app' }

function settings(patch: Partial<AppSettingsView> = {}): AppSettingsView {
  return {
    bridgePort: 8080,
    debugLogging: false,
    captureMode: 'system-proxy',
    captureProcesses: [],
    webvpnBase: 'https://webvpn.swufe.edu.cn',
    ...patch,
  }
}

function status(patch: Partial<BridgeStatus> = {}): BridgeStatus {
  return {
    state: 'idle',
    loggedIn: true,
    systemProxyEnabled: false,
    localCaptureEnabled: false,
    bridgePort: 8080,
    ...patch,
  }
}

test('checking an application pushes the whole selection to Main', async () => {
  const fake = installBridgeFake({
    getStatus: async () => status(),
    getSettings: async () => settings({ captureProcesses: [CURL.pattern] }),
    listCaptureCandidates: async () => [CHROME, CURL],
  })
  renderInShell(<CaptureWindow />)

  const chrome = await screen.findByRole('checkbox', { name: CHROME.name })
  chrome.click()

  await waitFor(() => expect(fake.calls).toContain('setCaptureProcesses'))
  // The selection carries over the already-chosen pattern, in selection order.
  expect(fake.args[fake.calls.indexOf('setCaptureProcesses')]).toEqual([[CURL.pattern, CHROME.pattern]])
})

test('unchecking removes only that application', async () => {
  const fake = installBridgeFake({
    getStatus: async () => status(),
    getSettings: async () =>
      settings({ captureMode: 'selected-apps', captureProcesses: [CURL.pattern, CHROME.pattern] }),
    listCaptureCandidates: async () => [CHROME, CURL],
  })
  renderInShell(<CaptureWindow />)

  const curl = await screen.findByRole('checkbox', { name: CURL.name })
  curl.click()

  await waitFor(() => expect(fake.calls).toContain('setCaptureProcesses'))
  expect(fake.args[fake.calls.indexOf('setCaptureProcesses')]).toEqual([[CHROME.pattern]])
})

test('the filter narrows the list but keeps selected rows visible', async () => {
  installBridgeFake({
    getStatus: async () => status(),
    getSettings: async () =>
      settings({ captureMode: 'selected-apps', captureProcesses: [CURL.pattern] }),
    listCaptureCandidates: async () => [CHROME, CURL, SAFARI],
  })
  renderInShell(<CaptureWindow />)

  await screen.findByRole('checkbox', { name: CHROME.name })
  fireEvent.change(screen.getByPlaceholderText('筛选应用名…'), { target: { value: 'chrome' } })

  expect(screen.getByRole('checkbox', { name: CHROME.name })).toBeTruthy()
  // Selected rows survive the filter so they can be unchecked without clearing it.
  expect(screen.getByRole('checkbox', { name: CURL.name })).toBeTruthy()
  expect(screen.queryByRole('checkbox', { name: SAFARI.name })).toBeNull()
})

test('an empty candidate list and an unmatched filter have their own empty states', async () => {
  installBridgeFake({
    getStatus: async () => status(),
    getSettings: async () => settings(),
    listCaptureCandidates: async () => [],
  })
  renderInShell(<CaptureWindow />)

  expect(await screen.findByText('暂无候选应用：请点「刷新列表」重试。')).toBeTruthy()

  fireEvent.change(screen.getByPlaceholderText('筛选应用名…'), { target: { value: 'nope' } })
  expect(await screen.findByText('没有匹配的应用。')).toBeTruthy()
})

test('a capture failure shows the reason, the guidance and a working retry', async () => {
  const fake = installBridgeFake({
    getStatus: async () => status({ captureError: '网络扩展未授权' }),
    getSettings: async () => settings({ captureMode: 'selected-apps' }),
    listCaptureCandidates: async () => [CHROME],
  })
  renderInShell(<CaptureWindow />)

  expect(await screen.findByText('进程捕获：启用失败 — 网络扩展未授权')).toBeTruthy()
  expect(screen.getByText(/首次启用时 macOS 会安装并激活 mitmproxy/)).toBeTruthy()

  screen.getByRole('button', { name: '重试' }).click()
  await waitFor(() => expect(fake.calls).toContain('setCaptureMode'))
  expect(fake.args[fake.calls.indexOf('setCaptureMode')]).toEqual(['selected-apps'])
})

test('the mode line and the selection count follow the persisted settings', async () => {
  installBridgeFake({
    getStatus: async () => status(),
    getSettings: async () => settings(),
    listCaptureCandidates: async () => [CHROME],
  })
  const view = renderInShell(<CaptureWindow />)

  expect(await screen.findByText('当前捕获方式为系统代理，进程捕获未启用。')).toBeTruthy()
  expect(screen.getByText('已选 0 / 32')).toBeTruthy()

  view.unmount()
  installBridgeFake({
    getStatus: async () => status(),
    getSettings: async () =>
      settings({ captureMode: 'selected-apps', captureProcesses: [CHROME.pattern] }),
    listCaptureCandidates: async () => [CHROME],
  })
  renderInShell(<CaptureWindow />)

  expect(await screen.findByText('当前捕获方式：指定应用')).toBeTruthy()
  expect(screen.getByText('已选 1 / 32')).toBeTruthy()
})

test('a selected application that is no longer running is labelled as such', async () => {
  installBridgeFake({
    getStatus: async () => status(),
    getSettings: async () =>
      settings({ captureMode: 'selected-apps', captureProcesses: ['/Applications/Gone.app/'] }),
    listCaptureCandidates: async () => [CHROME],
  })
  renderInShell(<CaptureWindow />)

  expect(await screen.findByText('/Applications/Gone.app/（当前未运行）')).toBeTruthy()
})
