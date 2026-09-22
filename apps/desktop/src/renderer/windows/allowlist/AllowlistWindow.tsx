/** Allowlist window: the only place hosts are added or removed (REQ-005). */

import { Button, Checkbox, Empty, Input } from 'antd'
import { useState } from 'react'

import type { AllowlistConfig } from '../../../shared/types'
import { describeError } from '../../lib/bridge-api'
import { HOST_EMPTY, hostAdded, hostInvalid, hostRemoved } from '../../lib/messages'
import { useAllowlistConfig } from '../../lib/hooks'

/** Structural check only — Main re-validates every host before it is persisted. */
const HOST_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i

export function AllowlistWindow() {
  const { config, save } = useAllowlistConfig()
  const [host, setHost] = useState('')
  const [note, setNote] = useState<{ text: string; error: boolean }>({ text: '', error: false })

  async function commit(next: AllowlistConfig, result: string): Promise<void> {
    try {
      await save(next)
      setNote({ text: result, error: false })
    } catch (error) {
      setNote({ text: describeError(error), error: true })
    }
  }

  async function add(): Promise<void> {
    if (!config) return
    const candidate = host.trim()
    if (!candidate) {
      setNote({ text: HOST_EMPTY, error: true })
      return
    }
    if (!HOST_PATTERN.test(candidate)) {
      setNote({ text: hostInvalid(candidate), error: true })
      return
    }
    try {
      await save({
        hosts: [...config.hosts, candidate],
        includeSwufeWildcard: config.includeSwufeWildcard,
      })
      setHost('')
      setNote({ text: hostAdded(candidate), error: false })
    } catch (error) {
      setNote({ text: describeError(error), error: true })
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 8, gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          value={host}
          placeholder="输入主机名，如 portal.swufe.edu.cn"
          aria-label="输入主机名，如 portal.swufe.edu.cn"
          onChange={(event) => setHost(event.target.value)}
          onPressEnter={() => void add()}
        />
        <Button onClick={() => void add()}>添加</Button>
      </div>
      {note.text ? (
        <p
          role="status"
          aria-live="polite"
          style={{ margin: 0, color: note.error ? '#cf1322' : 'rgba(0,0,0,0.65)' }}
        >
          {note.text}
        </p>
      ) : null}
      <div className="window-scroll" style={{ flex: 1, minHeight: 0 }}>
        {(config?.hosts.length ?? 0) === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="（空：所有流量直连）" />
        ) : (
          (config?.hosts ?? []).map((entry) => (
            <div key={entry} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>{entry}</span>
              <Button
                aria-label={`删除 ${entry}`}
                onClick={() =>
                  void commit(
                    {
                      hosts: (config?.hosts ?? []).filter((item) => item !== entry),
                      includeSwufeWildcard: config?.includeSwufeWildcard === true,
                    },
                    hostRemoved(entry),
                  )
                }
              >
                删除
              </Button>
            </div>
          ))
        )}
      </div>
      <Checkbox
        checked={config?.includeSwufeWildcard === true}
        onChange={(event) =>
          void commit(
            { hosts: config?.hosts ?? [], includeSwufeWildcard: event.target.checked },
            '',
          )
        }
      >
        启用 *.swufe.edu.cn（含 apex swufe.edu.cn）
      </Checkbox>
    </div>
  )
}
