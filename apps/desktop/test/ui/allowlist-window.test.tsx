/** Allowlist window: add, remove, wildcard — and the invalid-input path that writes nothing. */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'

import { AllowlistWindow } from '../../src/renderer/windows/allowlist/AllowlistWindow'
import { installBridgeFake } from './helpers/bridge-fake'
import { renderInShell } from './helpers/render'

function lastAllowlist(fake: ReturnType<typeof installBridgeFake>) {
  const index = fake.calls.lastIndexOf('setAllowlist')
  return index < 0 ? null : (fake.args[index]?.[0] as unknown)
}

async function typeHost(value: string): Promise<void> {
  fireEvent.change(screen.getByPlaceholderText('输入主机名，如 portal.swufe.edu.cn'), {
    target: { value },
  })
}

test('adding a host writes the extended list and clears the input', async () => {
  const fake = installBridgeFake()
  renderInShell(<AllowlistWindow />)
  await screen.findByText('jwxt.swufe.edu.cn')

  await typeHost('portal.swufe.edu.cn')
  screen.getByRole('button', { name: '添加' }).click()

  await waitFor(() => expect(fake.calls).toContain('setAllowlist'))
  expect(lastAllowlist(fake)).toEqual({
    hosts: ['jwxt.swufe.edu.cn', 'portal.swufe.edu.cn'],
    includeSwufeWildcard: false,
  })
  expect(await screen.findByText('已添加 portal.swufe.edu.cn。')).toBeTruthy()
  expect(
    (screen.getByPlaceholderText('输入主机名，如 portal.swufe.edu.cn') as HTMLInputElement).value,
  ).toBe('')
})

test('removing a host writes the remaining list', async () => {
  const fake = installBridgeFake({
    getAllowlist: async () => ({
      hosts: ['jwxt.swufe.edu.cn', 'portal.swufe.edu.cn'],
      includeSwufeWildcard: false,
    }),
  })
  renderInShell(<AllowlistWindow />)

  ;(await screen.findByRole('button', { name: '删除 jwxt.swufe.edu.cn' })).click()

  await waitFor(() => expect(fake.calls).toContain('setAllowlist'))
  expect(lastAllowlist(fake)).toEqual({
    hosts: ['portal.swufe.edu.cn'],
    includeSwufeWildcard: false,
  })
  expect(await screen.findByText('已删除 jwxt.swufe.edu.cn。')).toBeTruthy()
})

test('the wildcard checkbox writes the flag', async () => {
  const fake = installBridgeFake()
  renderInShell(<AllowlistWindow />)
  await screen.findByText('jwxt.swufe.edu.cn')

  screen.getByRole('checkbox', { name: '启用 *.swufe.edu.cn（含 apex swufe.edu.cn）' }).click()

  await waitFor(() => expect(fake.calls).toContain('setAllowlist'))
  expect(lastAllowlist(fake)).toEqual({
    hosts: ['jwxt.swufe.edu.cn'],
    includeSwufeWildcard: true,
  })
})

test('a structurally invalid host is reported inline and never written', async () => {
  const fake = installBridgeFake()
  renderInShell(<AllowlistWindow />)
  await screen.findByText('jwxt.swufe.edu.cn')

  await typeHost('bad host!')
  screen.getByRole('button', { name: '添加' }).click()

  expect(await screen.findByText('主机名不合法：bad host!')).toBeTruthy()
  expect(fake.calls).not.toContain('setAllowlist')

  await typeHost('   ')
  screen.getByRole('button', { name: '添加' }).click()

  expect(await screen.findByText('请输入主机名。')).toBeTruthy()
  expect(fake.calls).not.toContain('setAllowlist')
})

test('a rejection from Main is shown in the same inline slot', async () => {
  installBridgeFake({
    setAllowlist: async () => {
      throw new Error('主机名不合法：portal（包含非法字符）')
    },
  })
  renderInShell(<AllowlistWindow />)
  await screen.findByText('jwxt.swufe.edu.cn')

  await typeHost('portal.swufe.edu.cn')
  screen.getByRole('button', { name: '添加' }).click()

  expect(await screen.findByText('主机名不合法：portal（包含非法字符）')).toBeTruthy()
})
