/** Renderer hooks: mount-time fetch, event follow-through, and unsubscription on unmount. */

import { render, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'

import { useBridgeStatus, useDebugLogs } from '../../src/renderer/lib/hooks'
import { AppShell } from '../../src/renderer/lib/AppShell'
import type { DebugLogEvent } from '../../src/shared/types'
import { installBridgeFake } from './helpers/bridge-fake'
import { renderInShell } from './helpers/render'

test('useBridgeStatus follows Main: it shows the fetched status, then every pushed one', async () => {
  const fake = installBridgeFake({
    getStatus: async () => ({
      state: 'idle',
      loggedIn: true,
      systemProxyEnabled: false,
      localCaptureEnabled: false,
    }),
  })

  function Status() {
    return <span data-testid="state">{useBridgeStatus()?.state ?? '-'}</span>
  }

  const view = renderInShell(<Status />)
  await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('idle'))

  fake.emitStatus({
    state: 'running',
    loggedIn: true,
    systemProxyEnabled: true,
    localCaptureEnabled: false,
  })
  await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('running'))

  expect(fake.listenerCount('status')).toBe(1)
  view.unmount()
  expect(fake.listenerCount('status')).toBe(0)
})

test('useDebugLogs restores the Main buffer, prepends pushes newest-first and caps at 200', async () => {
  const backfill: DebugLogEvent[] = [
    { ts: '2026-09-23T12:00:02.000Z', host: 'older.swufe.edu.cn', rewritten: false, direction: 'request' },
    { ts: '2026-09-23T12:00:01.000Z', host: 'oldest.swufe.edu.cn', rewritten: false, direction: 'request' },
  ]
  const fake = installBridgeFake({ getDebugLogs: async () => backfill })

  function Rows() {
    const { rows } = useDebugLogs(true)
    return <span data-testid="rows">{rows.map((row) => row.host).join(',')}</span>
  }

  const view = renderInShell(<Rows />)
  await waitFor(() =>
    expect(screen.getByTestId('rows').textContent).toBe('older.swufe.edu.cn,oldest.swufe.edu.cn'),
  )

  fake.emitDebugLog({
    ts: '2026-09-23T12:00:03.000Z',
    host: 'newest.swufe.edu.cn',
    rewritten: true,
    direction: 'request',
  })
  await waitFor(() =>
    expect(screen.getByTestId('rows').textContent).toBe(
      'newest.swufe.edu.cn,older.swufe.edu.cn,oldest.swufe.edu.cn',
    ),
  )

  expect(fake.listenerCount('debug')).toBe(1)
  view.unmount()
  expect(fake.listenerCount('debug')).toBe(0)
})

test('useDebugLogs drops the rows when logging is switched off', async () => {
  installBridgeFake({
    getDebugLogs: async () => [
      { ts: '2026-09-23T12:00:01.000Z', host: 'a.swufe.edu.cn', rewritten: true, direction: 'request' },
    ],
  })

  function Rows({ enabled }: { enabled: boolean }) {
    const { rows } = useDebugLogs(enabled)
    return <span data-testid="count">{rows.length}</span>
  }

  const view = render(
    <AppShell>
      <Rows enabled />
    </AppShell>,
  )
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
  view.rerender(
    <AppShell>
      <Rows enabled={false} />
    </AppShell>,
  )
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
})

test('clear drops the local rows and calls the Main-side clear', async () => {
  const fake = installBridgeFake({
    getDebugLogs: async () => [
      { ts: '2026-09-23T12:00:01.000Z', host: 'a.swufe.edu.cn', rewritten: true, direction: 'request' },
    ],
  })

  function ClearButton() {
    const { rows, clear } = useDebugLogs(true)
    return (
      <button type="button" onClick={() => void clear()}>
        {rows.length}
      </button>
    )
  }

  renderInShell(<ClearButton />)
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('1'))
  screen.getByRole('button').click()
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('0'))
  expect(fake.calls).toContain('clearDebugLogs')
})
