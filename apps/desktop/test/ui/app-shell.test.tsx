/** The error boundary is the last line of defence against a blank window (EC2-008). */

import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { AppShell } from '../../src/renderer/lib/AppShell'

function Boom(): never {
  throw new Error('演示用异常')
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('a crashing window shows the Chinese error panel instead of a blank page', () => {
  // React and the boundary both report the crash; the assertion is about the panel.
  vi.spyOn(console, 'error').mockImplementation(() => {})

  render(
    <AppShell>
      <Boom />
    </AppShell>,
  )

  expect(screen.getByRole('alert').textContent).toBe('界面加载失败：演示用异常。可点「重新加载窗口」重试。')
  expect(screen.getByRole('button', { name: '重新加载窗口' })).toBeTruthy()
})
