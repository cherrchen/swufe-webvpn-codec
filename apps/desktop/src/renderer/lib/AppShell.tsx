/** Shared shell for all four windows: error boundary + zh_CN locale + compact tokens. */

import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'

import { ErrorBoundary } from './ErrorBoundary'
import { COMPACT_THEME } from './theme'
import './app.css'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      {/* Button copy must stay verbatim: antd's automatic CJK spacing would render
          「清空」 as 「清 空」 in the DOM. */}
      <ConfigProvider
        locale={zhCN}
        componentSize="small"
        theme={COMPACT_THEME}
        button={{ autoInsertSpace: false }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  )
}
