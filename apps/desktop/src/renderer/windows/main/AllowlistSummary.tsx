/** Allowlist summary: the host count only; editing lives in its own window. */

import { Button } from 'antd'

import type { AllowlistConfig } from '../../../shared/types'
import { bridge, describeError } from '../../lib/bridge-api'

export function AllowlistSummary({
  config,
  setMessage,
}: {
  config: AllowlistConfig | null
  setMessage: (text: string) => void
}) {
  const count = config?.hosts.length ?? 0
  const wildcard = config?.includeSwufeWildcard === true
  const summary =
    count === 0
      ? wildcard
        ? '未添加主机（含 *.swufe.edu.cn）'
        : '未添加主机'
      : wildcard
        ? `${count} 个主机（含 *.swufe.edu.cn）`
        : `${count} 个主机`

  return (
    <section aria-labelledby="allowlist-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <h2 id="allowlist-title" style={{ fontSize: 12, margin: 0 }}>
        Allowlist
      </h2>
      <span>{config === null ? '读取中…' : summary}</span>
      <Button
        onClick={() => {
          void bridge()
            .openAllowlistWindow()
            .catch((error: unknown) => setMessage(describeError(error)))
        }}
      >
        管理…
      </Button>
    </section>
  )
}
