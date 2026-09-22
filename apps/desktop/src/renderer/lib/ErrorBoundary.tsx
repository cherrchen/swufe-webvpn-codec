/** Per-window error panel: a renderer crash must never leave a blank window (EC2-008). */

import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ERROR_BOUNDARY } from './messages'

interface Props {
  children: ReactNode
}

interface State {
  reason: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { reason: null }

  static getDerivedStateFromError(error: unknown): State {
    return { reason: error instanceof Error ? error.message : String(error) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('swufe-ui 渲染层异常', error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.reason === null) return this.props.children
    // Deliberately dependency-free: antd itself may be what failed.
    return (
      <div style={{ padding: 12, fontSize: 12, fontFamily: 'sans-serif' }}>
        <p role="alert" style={{ margin: '0 0 8px' }}>
          {ERROR_BOUNDARY(this.state.reason)}
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          重新加载窗口
        </button>
      </div>
    )
  }
}
