/** Diagnostics: the read-only system-proxy line and the debug-log switch (REQ-009). */

import { Switch } from 'antd'

import type { AppSettingsView, BridgeStatus } from '../../../shared/types'
import { bridge, describeError } from '../../lib/bridge-api'

export function DiagnosticsSection({
  status,
  settings,
  reloadSettings,
  setMessage,
}: {
  status: BridgeStatus | null
  settings: AppSettingsView | null
  reloadSettings: () => Promise<void>
  setMessage: (text: string) => void
}) {
  const port = status?.bridgePort ?? settings?.bridgePort ?? 0
  const proxyLine = status
    ? status.systemProxyEnabled
      ? `系统代理：已指向本桥 127.0.0.1:${port}`
      : settings?.captureMode === 'selected-apps'
        ? '系统代理：未由本 App 设置（捕获方式：指定应用）'
        : '系统代理：未由本 App 设置'
    : '系统代理：读取中…'

  return (
    <section aria-labelledby="diagnostics-title">
      <h2 id="diagnostics-title" style={{ fontSize: 12, margin: 0 }}>
        诊断
      </h2>
      <p style={{ margin: 0 }}>{proxyLine}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span id="debug-logging-label">调试日志</span>
        <Switch
          checked={settings?.debugLogging === true}
          aria-labelledby="debug-logging-label"
          onChange={(enabled) => {
            void (async () => {
              try {
                await bridge().setDebugLogging(enabled)
                // Turning logging on opens the window; Main closes it on the way out.
                if (enabled) await bridge().openLogWindow()
              } catch (error) {
                setMessage(describeError(error))
              }
              await reloadSettings()
            })()
          }}
        />
      </div>
    </section>
  )
}
