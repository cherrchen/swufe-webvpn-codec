/** Renders a window inside the real `AppShell` (`App.useApp()` needs it for modals). */

import { render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'

import { AppShell } from '../../../src/renderer/lib/AppShell'

export function renderInShell(ui: ReactNode): RenderResult {
  return render(<AppShell>{ui}</AppShell>)
}
