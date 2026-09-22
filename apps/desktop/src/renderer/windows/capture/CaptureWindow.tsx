/** Capture window: process-capture state, candidate list and the ≤32 selection. */

import { Button, Checkbox, Empty, Input } from 'antd'
import { useState } from 'react'

import { MAX_CAPTURE_PROCESSES } from '../../../shared/limits'
import type { BridgeStatus, CaptureCandidate } from '../../../shared/types'
import { bridge, parseFailure } from '../../lib/bridge-api'
import { CAPTURE_GUIDANCE, CAPTURE_MODE_HINT, EMPTY_CANDIDATES, NO_FILTER_MATCH, selectedNotRunning } from '../../lib/messages'
import { useBridgeStatus, useCandidates, useSettings } from '../../lib/hooks'

interface Row {
  pattern: string
  label: string
  chosen: boolean
}

export function CaptureWindow() {
  const status: BridgeStatus | null = useBridgeStatus()
  const { settings, reload } = useSettings()
  const { candidates, loaded, refresh } = useCandidates()
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState('')
  const [optimistic, setOptimistic] = useState<string[] | null>(null)

  const mode = settings?.captureMode ?? 'system-proxy'
  const chosen = optimistic ?? settings?.captureProcesses ?? []
  const failure = status?.captureError

  const stateLine = status?.localCaptureEnabled
    ? `进程捕获：已启用（${chosen.length} 个应用）`
    : failure
      ? `进程捕获：启用失败 — ${failure}`
      : mode === 'selected-apps'
        ? '进程捕获：启用中…'
        : '进程捕获：未启用'

  // Selected rows are always listed (unchecking must not require clearing the filter).
  const names = new Map(candidates.map((candidate: CaptureCandidate) => [candidate.pattern, candidate.name]))
  const needle = filter.trim().toLowerCase()
  const rows: Row[] = chosen.map((pattern) => ({
    pattern,
    label: names.get(pattern) ?? selectedNotRunning(pattern),
    chosen: true,
  }))
  for (const candidate of candidates) {
    if (chosen.includes(candidate.pattern)) continue
    if (needle && !candidate.name.toLowerCase().includes(needle)) continue
    rows.push({ pattern: candidate.pattern, label: candidate.name, chosen: false })
  }

  async function toggle(pattern: string, checked: boolean): Promise<void> {
    const next = checked
      ? [...chosen.filter((entry) => entry !== pattern), pattern]
      : chosen.filter((entry) => entry !== pattern)
    setOptimistic(next)
    try {
      await bridge().setCaptureProcesses(next)
      setMessage('')
    } catch (error) {
      setMessage(parseFailure(error).message)
    }
    // Main is the authority: refresh first, then drop the optimistic copy so the row
    // never falls back to a stale value (failure path included).
    await reload()
    setOptimistic(null)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 8, gap: 6 }}>
      <div>{stateLine}</div>
      <div>{mode === 'selected-apps' ? '当前捕获方式：指定应用' : '当前捕获方式为系统代理，进程捕获未启用。'}</div>
      <p style={{ margin: 0, color: 'rgba(0,0,0,0.45)' }}>{CAPTURE_MODE_HINT}</p>
      {failure ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ margin: 0 }}>{CAPTURE_GUIDANCE}</p>
          <Button
            onClick={() => {
              void (async () => {
                try {
                  await bridge().setCaptureMode(mode)
                  setMessage('')
                } catch (error) {
                  setMessage(parseFailure(error).message)
                }
                await reload()
              })()
            }}
          >
            重试
          </Button>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          allowClear
          value={filter}
          placeholder="筛选应用名…"
          aria-label="筛选应用名"
          onChange={(event) => setFilter(event.target.value)}
        />
        <Button onClick={() => void refresh()}>刷新列表</Button>
      </div>
      <div className="window-scroll" style={{ flex: 1, minHeight: 0 }}>
        {rows.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={!loaded ? '读取中…' : needle ? NO_FILTER_MATCH : EMPTY_CANDIDATES}
          />
        ) : (
          rows.map((row) => (
            <div key={row.pattern}>
              <Checkbox
                checked={row.chosen}
                onChange={(event) => void toggle(row.pattern, event.target.checked)}
              >
                {row.label}
              </Checkbox>
            </div>
          ))
        )}
      </div>
      <p style={{ margin: 0 }}>
        已选 {chosen.length} / {MAX_CAPTURE_PROCESSES}
      </p>
      {message ? (
        <p role="status" aria-live="polite" style={{ margin: 0 }}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
