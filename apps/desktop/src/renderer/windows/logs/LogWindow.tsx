/** Log window: the newest 200 rewrite records, restored from Main on every mount. */

import { Button, Empty, Table, type TableColumnsType } from 'antd'

import type { DebugLogEvent } from '../../../shared/types'
import { useDebugLogs } from '../../lib/hooks'
import { describeLogResult, logTime } from '../../lib/log-format'
import { EMPTY_LOG_ROWS } from '../../lib/messages'

const COLUMNS: TableColumnsType<DebugLogEvent> = [
  { title: '时间', key: 'time', render: (_value, event) => logTime(event) },
  { title: '域名', dataIndex: 'host' },
  { title: '结果', key: 'result', render: (_value, event) => describeLogResult(event) },
]

export function LogWindow() {
  const { rows, clear } = useDebugLogs(true)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 8, gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <strong>调试日志</strong>
        <span>最近 200 条，最新在前（当前 {rows.length} 条）</span>
        <Button onClick={() => void clear()}>清空</Button>
      </div>
      <div className="window-scroll" style={{ flex: 1, minHeight: 0 }}>
        <Table<DebugLogEvent>
          size="small"
          columns={COLUMNS}
          dataSource={rows}
          pagination={false}
          rowKey={(event) => `${event.ts}-${event.host}-${event.direction}`}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={EMPTY_LOG_ROWS} />,
          }}
        />
      </div>
    </div>
  )
}
