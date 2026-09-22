/** Capture mode: the first-level choice, the process-capture state line and its entry point. */

import { Button, Radio } from 'antd'

import type { AppSettingsView, BridgeStatus, CaptureMode } from '../../../shared/types'
import { bridge, describeError, parseFailure } from '../../lib/bridge-api'
import { CAPTURE_GUIDANCE } from '../../lib/messages'
import { useModals } from './modals'

export function CaptureSection({
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
  const modals = useModals()
  const mode: CaptureMode = settings?.captureMode ?? 'system-proxy'
  const selected = settings?.captureProcesses ?? []
  const failure = status?.captureError

  const stateLine = status?.localCaptureEnabled
    ? `进程捕获：已启用（${selected.length} 个应用）`
    : failure
      ? `进程捕获：启用失败 — ${failure}`
      : mode === 'selected-apps'
        ? '进程捕获：启用中…'
        : '进程捕获：未启用'

  /** Switching mode revokes or restores the system proxy in Main (ADR-0006). */
  async function applyMode(next: CaptureMode): Promise<void> {
    let failureOf: { code: string | null; message: string } | null = null
    try {
      await bridge().setCaptureMode(next)
    } catch (error) {
      failureOf = parseFailure(error)
      setMessage(failureOf.message)
    }
    // Never leave the radio pointing at a mode that was not persisted.
    await reloadSettings()
    if (failureOf?.code === 'PROXY_CONFLICT') await modals.proxyConflict(failureOf.message)
  }

  return (
    <section aria-labelledby="capture-mode-title">
      <h2 id="capture-mode-title" style={{ fontSize: 12, margin: 0 }}>
        捕获方式
      </h2>
      <Radio.Group
        value={mode}
        onChange={(event) => void applyMode(event.target.value as CaptureMode)}
      >
        <Radio value="system-proxy">系统代理（全部流量）</Radio>
        <Radio value="selected-apps">指定应用</Radio>
      </Radio.Group>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{stateLine}</span>
        <Button
          onClick={() => {
            void bridge()
              .openCaptureWindow()
              .catch((error: unknown) => setMessage(describeError(error)))
          }}
        >
          选择应用…
        </Button>
      </div>
      {failure ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ margin: 0 }}>{CAPTURE_GUIDANCE}</p>
          <Button onClick={() => void applyMode(mode)}>重试</Button>
        </div>
      ) : null}
    </section>
  )
}
