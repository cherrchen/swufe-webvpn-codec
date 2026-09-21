/** Renderer: M2 orchestration surface (status bar, login/bridge, CA, advanced). */

import type {
  AppSettingsView,
  BridgeStatus,
  CaStatus,
  DebugLogEvent,
} from '../shared/types'

const api = window.swufeBridge

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`缺少界面元素：${id}`)
  return found as T
}

const statusBar = element<HTMLParagraphElement>('status-bar')
const statusText = element<HTMLSpanElement>('status-text')
const statusReason = element<HTMLSpanElement>('status-reason')
const loginButton = element<HTMLButtonElement>('login-button')
const bridgeToggle = element<HTMLInputElement>('bridge-toggle')
const allowlistHosts = element<HTMLParagraphElement>('allowlist-hosts')
const installCaButton = element<HTMLButtonElement>('install-ca')
const uninstallCaButton = element<HTMLButtonElement>('uninstall-ca')
const caState = element<HTMLParagraphElement>('ca-state')
const proxyState = element<HTMLParagraphElement>('proxy-state')
const debugLogging = element<HTMLInputElement>('debug-logging')
const message = element<HTMLParagraphElement>('message')
const caWarningModal = element<HTMLDialogElement>('ca-warning-modal')
const proxyConflictModal = element<HTMLDialogElement>('proxy-conflict-modal')
const sessionExpiredModal = element<HTMLDialogElement>('session-expired-modal')
const goLoginButton = element<HTMLButtonElement>('go-login')

let status: BridgeStatus | null = null
let caStatus: CaStatus | null = null
let settings: AppSettingsView | null = null
let allowlistText = '读取中…'

function describeStatus(): { text: string; tone: string } {
  if (status?.error?.code === 'SESSION_EXPIRED') return { text: '过期处理中', tone: 'warn' }
  if (status?.state === 'error') return { text: '错误', tone: 'error' }
  if (status?.state === 'running') return { text: '桥接中', tone: 'ok' }
  if (status?.state === 'starting') return { text: '桥接中（正在启动）', tone: 'busy' }
  if (status?.state === 'stopping') return { text: '正在停止', tone: 'busy' }
  return status?.loggedIn ? { text: '已登录', tone: 'ok' } : { text: '未登录', tone: 'muted' }
}

function render(): void {
  const label = describeStatus()
  statusBar.dataset.tone = label.tone
  statusText.textContent = label.text
  statusReason.textContent = status?.error?.message ?? ''

  loginButton.textContent = status?.loggedIn ? '重新登录' : '登录 WebVPN'
  const busy = status?.state === 'starting' || status?.state === 'stopping'
  const expired = status?.error?.code === 'SESSION_EXPIRED'
  bridgeToggle.checked = status?.state === 'running' || status?.state === 'starting'
  bridgeToggle.disabled = busy || expired || !status?.loggedIn
  bridgeToggle.setAttribute(
    'aria-label',
    bridgeToggle.checked ? '关闭桥接' : '开启桥接',
  )

  caState.textContent =
    caStatus === null
      ? '读取中…'
      : caStatus.installed && caStatus.trusted
        ? '已安装并被系统信任'
        : caStatus.installed
          ? '已安装，但系统尚未信任'
          : '未安装'
  installCaButton.disabled = caStatus?.installed === true && caStatus.trusted
  uninstallCaButton.disabled = caStatus === null || !caStatus.installed

  if (status) {
    const port = status.bridgePort ?? settings?.bridgePort ?? 0
    proxyState.textContent = status.systemProxyEnabled
      ? `系统代理：已指向本桥 127.0.0.1:${port}`
      : '系统代理：未由本 App 设置'
  }
  if (settings) debugLogging.checked = settings.debugLogging
  allowlistHosts.textContent = allowlistText
}

async function refresh(): Promise<void> {
  const [nextStatus, nextCa, nextSettings, allowlist] = await Promise.all([
    api.getStatus(),
    api.getCaStatus(),
    api.getSettings(),
    api.getAllowlist(),
  ])
  status = nextStatus
  caStatus = nextCa
  settings = nextSettings
  const wildcard = allowlist.includeSwufeWildcard ? '（含 *.swufe.edu.cn）' : ''
  allowlistText = `${allowlist.hosts.join('、') || '（空）'}${wildcard}`
  render()
}

function setMessage(text: string): void {
  message.textContent = text
}

function showModal(dialog: HTMLDialogElement): Promise<string> {
  const { promise, resolve } = Promise.withResolvers<string>()
  dialog.addEventListener(
    'close',
    () => {
      resolve(dialog.returnValue)
    },
    { once: true },
  )
  dialog.showModal()
  return promise
}

loginButton.addEventListener('click', () => {
  void (async () => {
    try {
      await api.login()
      setMessage('')
    } catch (error) {
      setMessage(`打开登录窗口失败：${String(error)}`)
    }
    await refresh()
  })()
})

bridgeToggle.addEventListener('change', () => {
  void (async () => {
    bridgeToggle.disabled = true
    try {
      status = bridgeToggle.checked ? await api.startBridge() : await api.stopBridge()
      if (status.error) {
        if (status.error.code === 'PROXY_CONFLICT') await showModal(proxyConflictModal)
        else setMessage(`${status.error.code}：${status.error.message}`)
      } else {
        setMessage('')
      }
    } catch (error) {
      setMessage(`操作失败：${String(error)}`)
    }
    await refresh()
  })()
})

installCaButton.addEventListener('click', () => {
  void (async () => {
    // NFR-005: the risk notice must be shown before anything is installed.
    if ((await showModal(caWarningModal)) !== 'confirm') return
    setMessage('正在安装本机 CA（系统可能要求输入管理员密码）…')
    try {
      const result = await api.installCa()
      setMessage(result.ok ? '本机 CA 已安装并被系统信任。' : `安装失败：${result.message ?? '未知原因'}`)
    } catch (error) {
      setMessage(`安装失败：${String(error)}`)
    }
    await refresh()
  })()
})

uninstallCaButton.addEventListener('click', () => {
  void (async () => {
    setMessage('正在卸载本机 CA…')
    try {
      const result = await api.uninstallCa()
      setMessage(result.ok ? '本机 CA 已卸载。' : `卸载失败：${result.message ?? '未知原因'}`)
    } catch (error) {
      setMessage(`卸载失败：${String(error)}`)
    }
    await refresh()
  })()
})

debugLogging.addEventListener('change', () => {
  void (async () => {
    await api.setDebugLogging(debugLogging.checked)
    await refresh()
  })()
})

goLoginButton.addEventListener('click', () => {
  void (async () => {
    await api.login()
    await refresh()
  })()
})

api.onStatus((next: BridgeStatus) => {
  status = next
  render()
})

api.onSessionExpired(() => {
  void showModal(sessionExpiredModal)
})

api.onDebugLog((event: DebugLogEvent) => {
  console.log('swufe-debug', JSON.stringify(event))
})

void refresh()
