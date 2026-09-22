/** Log window: three columns, newest first, the 200-entry cap, restore and clear. */

import { screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { LogWindow } from '../../src/renderer/windows/logs/LogWindow'
import type { DebugLogEvent } from '../../src/shared/types'
import { installBridgeFake } from './helpers/bridge-fake'
import { renderInShell } from './helpers/render'

function event(index: number, patch: Partial<DebugLogEvent> = {}): DebugLogEvent {
  return {
    ts: new Date(Date.UTC(2026, 8, 23, 12, 0, 0) + index * 1000).toISOString(),
    host: `host-${index}.swufe.edu.cn`,
    rewritten: index % 2 === 0,
    direction: index % 2 === 0 ? 'request' : 'response',
    ...patch,
  }
}

function dataRows(): HTMLElement[][] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell'))
}

test('the table shows time, host and result with the newest record first', async () => {
  installBridgeFake({
    getDebugLogs: async () => [event(2), event(1), event(0, { detail: '非 allowlist' })],
  })
  renderInShell(<LogWindow />)

  await waitFor(() => expect(dataRows()).toHaveLength(3))
  expect(screen.getByRole('columnheader', { name: '时间' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: '域名' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: '结果' })).toBeTruthy()
  expect(screen.getByText('最近 200 条，最新在前（当前 3 条）')).toBeTruthy()

  const hosts = dataRows().map((cells) => cells[1]?.textContent)
  expect(hosts).toEqual(['host-2.swufe.edu.cn', 'host-1.swufe.edu.cn', 'host-0.swufe.edu.cn'])
  // direction/rewritten still drive the result column, detail stays in parentheses.
  expect(dataRows()[0]?.[2]?.textContent).toBe('已改写')
  expect(dataRows()[1]?.[2]?.textContent).toBe('直连')
  // `detail` is appended in parentheses whatever the rewrite outcome is.
  expect(dataRows()[2]?.[2]?.textContent).toBe('已改写（非 allowlist）')
})

test('a restored buffer is capped at 200 rows', async () => {
  // Main hands the buffer over newest first.
  const many = Array.from({ length: 260 }, (_value, index) => event(index)).reverse()
  installBridgeFake({ getDebugLogs: async () => many })
  renderInShell(<LogWindow />)

  await waitFor(() => expect(dataRows()).toHaveLength(200))
  expect(screen.getByText('最近 200 条，最新在前（当前 200 条）')).toBeTruthy()
  expect(dataRows()[0]?.[1]?.textContent).toBe('host-259.swufe.edu.cn')
})

test('pushed records land on top and are only re-rendered in merged batches', async () => {
  const fake = installBridgeFake({ getDebugLogs: async () => [event(0)] })
  renderInShell(<LogWindow />)

  await waitFor(() => expect(dataRows()).toHaveLength(1))
  fake.emitDebugLog(event(1))
  fake.emitDebugLog(event(2))

  await waitFor(() => expect(dataRows()).toHaveLength(3))
  expect(dataRows().map((cells) => cells[1]?.textContent)).toEqual([
    'host-2.swufe.edu.cn',
    'host-1.swufe.edu.cn',
    'host-0.swufe.edu.cn',
  ])
})

test('清空 clears the Main buffer and the table', async () => {
  const fake = installBridgeFake({ getDebugLogs: async () => [event(0), event(1)] })
  renderInShell(<LogWindow />)

  await waitFor(() => expect(dataRows()).toHaveLength(2))
  screen.getByRole('button', { name: '清空' }).click()

  await waitFor(() => expect(fake.calls).toContain('clearDebugLogs'))
  await waitFor(() => expect(screen.getByText('尚无日志：开启调试日志并产生流量后在此显示。')).toBeTruthy())
  expect(screen.queryByText('host-0.swufe.edu.cn')).toBeNull()
  expect(screen.queryByText('host-1.swufe.edu.cn')).toBeNull()
})

test('an empty buffer shows the empty state', async () => {
  installBridgeFake({ getDebugLogs: async () => [] })
  renderInShell(<LogWindow />)

  expect(await screen.findByText('尚无日志：开启调试日志并产生流量后在此显示。')).toBeTruthy()
})
