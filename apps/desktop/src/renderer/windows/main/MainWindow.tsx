/** Main window: everything that must stay visible without scrolling (AC2-002). */

import { Flex } from 'antd'
import { useEffect, useRef, useState } from 'react'

import { bridge } from '../../lib/bridge-api'
import { useAllowlistConfig, useBridgeStatus, useCaStatus, useSettings } from '../../lib/hooks'
import { AllowlistSummary } from './AllowlistSummary'
import { CaptureSection } from './CaptureSection'
import { CertificateSection } from './CertificateSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { MessageRow } from './MessageRow'
import { PrimaryActions } from './PrimaryActions'
import { SESSION_EXPIRED_FALLBACK, useModals } from './modals'
import { StatusBar } from './StatusBar'

export function MainWindow() {
  const status = useBridgeStatus()
  const { settings, reload: reloadSettings } = useSettings()
  const { config } = useAllowlistConfig()
  const { status: caStatus, reload: reloadCa } = useCaStatus()
  const [message, setMessage] = useState('')
  const modals = useModals()

  // Session-expiry modals belong to the main window even when a secondary window has
  // focus (EC2-003); the reason is read at fire time, not at subscribe time.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    const unsubscribe = bridge().onSessionExpired(() => {
      void modals.sessionExpired(statusRef.current?.error?.message ?? SESSION_EXPIRED_FALLBACK)
    })
    return unsubscribe
  }, [modals])

  return (
    <Flex vertical gap={6} style={{ height: '100%', padding: 8, overflow: 'hidden' }}>
      <StatusBar status={status} />
      <PrimaryActions status={status} setMessage={setMessage} />
      <CaptureSection
        status={status}
        settings={settings}
        reloadSettings={reloadSettings}
        setMessage={setMessage}
      />
      <AllowlistSummary config={config} setMessage={setMessage} />
      <CertificateSection status={caStatus} reload={reloadCa} setMessage={setMessage} />
      <DiagnosticsSection
        status={status}
        settings={settings}
        reloadSettings={reloadSettings}
        setMessage={setMessage}
      />
      <MessageRow text={message} />
    </Flex>
  )
}
