/** Certificate section: CA status plus install/uninstall, behind the risk notice (NFR-005). */

import { Button } from 'antd'

import type { CaStatus } from '../../../shared/types'
import { bridge, describeError } from '../../lib/bridge-api'
import { CA_INSTALLED, CA_PROMPT_INSTALLING, CA_UNINSTALLED, CA_UNINSTALLING, caInstallFailed, caUninstallFailed } from '../../lib/messages'
import { useModals } from './modals'

export function CertificateSection({
  status,
  reload,
  setMessage,
}: {
  status: CaStatus | null
  reload: () => Promise<void>
  setMessage: (text: string) => void
}) {
  const modals = useModals()
  const stateText =
    status === null
      ? '读取中…'
      : status.installed && status.trusted
        ? '已安装并被系统信任'
        : status.installed
          ? '已安装，但系统尚未信任'
          : '未安装'

  return (
    <section aria-labelledby="certificate-title">
      <h2 id="certificate-title" style={{ fontSize: 12, margin: 0 }}>
        证书
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{stateText}</span>
        <Button
          disabled={status?.installed === true && status.trusted}
          onClick={() => {
            void (async () => {
              // NFR-005: nothing is installed before the risk notice is accepted.
              if (!(await modals.caWarning())) return
              setMessage(CA_PROMPT_INSTALLING)
              try {
                const result = await bridge().installCa()
                setMessage(result.ok ? CA_INSTALLED : caInstallFailed(result.message ?? '未知原因'))
              } catch (error) {
                setMessage(caInstallFailed(describeError(error)))
              }
              await reload()
            })()
          }}
        >
          安装本机 CA
        </Button>
        <Button
          disabled={status === null || !status.installed}
          onClick={() => {
            void (async () => {
              setMessage(CA_UNINSTALLING)
              try {
                const result = await bridge().uninstallCa()
                setMessage(result.ok ? CA_UNINSTALLED : caUninstallFailed(result.message ?? '未知原因'))
              } catch (error) {
                setMessage(caUninstallFailed(describeError(error)))
              }
              await reload()
            })()
          }}
        >
          卸载本机 CA
        </Button>
      </div>
    </section>
  )
}
