import { createRoot } from 'react-dom/client'

import { AppShell } from '../lib/AppShell'
import { AllowlistWindow } from '../windows/allowlist/AllowlistWindow'

const container = document.getElementById('root')
if (!container) throw new Error('缺少根节点 #root')
createRoot(container).render(
  <AppShell>
    <AllowlistWindow />
  </AppShell>,
)
