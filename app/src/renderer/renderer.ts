/** Renderer: status bar, login/bridge, capture mode, allowlist, CA and debug log. */

import type {
  AllowlistConfig,
  AppSettingsView,
  BridgeStatus,
  CaptureCandidate,
  CaptureMode,
  CaStatus,
  DebugLogEvent,
} from '../shared/types'

const api = window.swufeBridge

/** `#log-rows` retention: the panel drops the oldest entries beyond this. */
const MAX_LOG_ROWS = 200

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

const allowlistForm = element<HTMLFormElement>('allowlist-form')
const allowlistInput = element<HTMLInputElement>('allowlist-input')
const allowlistList = element<HTMLUListElement>('allowlist-list')
const allowlistWildcard = element<HTMLInputElement>('allowlist-wildcard')

const captureModeInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="capture-mode"]'),
)
const captureState = element<HTMLParagraphElement>('capture-state')
const captureFilter = element<HTMLInputElement>('capture-filter')
const captureList = element<HTMLDivElement>('capture-list')
const captureGuidance = element<HTMLParagraphElement>('capture-guidance')
const captureRetry = element<HTMLButtonElement>('capture-retry')
const captureRefresh = element<HTMLButtonElement>('capture-refresh')

const logPanel = element<HTMLElement>('log-panel')
const logTableBody = element<HTMLTableSectionElement>('log-rows')
const logClear = element<HTMLButtonElement>('log-clear')

let status: BridgeStatus | null = null
let caStatus: CaStatus | null = null
let settings: AppSettingsView | null = null
let allowlist: AllowlistConfig | null = null
let candidates: CaptureCandidate[] = []
let logRows: DebugLogEvent[] = []

function describeStatus(): { text: string; tone: string } {
  if (status?.error?.code === 'SESSION_EXPIRED') return { text: '过期处理中', tone: 'warn' }
  if (status?.state === 'error') return { text: '错误', tone: 'error' }
  if (status?.state === 'running') {
    return status.localCaptureEnabled
      ? { text: '桥接中（进程捕获）', tone: 'ok' }
      : { text: '桥接中', tone: 'ok' }
  }
  if (status?.state === 'starting') return { text: '桥接中（正在启动）', tone: 'busy' }
  if (status?.state === 'stopping') return { text: '正在停止', tone: 'busy' }
  return status?.loggedIn ? { text: '已登录', tone: 'ok' } : { text: '未登录', tone: 'muted' }
}

/**
 * Main → Renderer error text.
 *
 * Electron rejects `invoke` with an `Error` that keeps only `message`/`stack`, so
 * Main prefixes the error code onto the message (see docs/api/electron-ipc.md).
 */
function parseFailure(error: unknown): { code: string | null; message: string } {
  const raw = error instanceof Error ? error.message : String(error)
  const stripped = raw.replace(/^Error invoking remote method '[^']*': Error: /, '')
  const match = stripped.match(/^([A-Z_]+)：/)
  return match
    ? { code: match[1] ?? null, message: stripped.slice(match[0].length) }
    : { code: null, message: stripped }
}

function describeError(error: unknown): string {
  return parseFailure(error).message
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
  bridgeToggle.setAttribute('aria-label', bridgeToggle.checked ? '关闭桥接' : '开启桥接')

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
    const mode = settings?.captureMode ?? 'system-proxy'
    proxyState.textContent = status.systemProxyEnabled
      ? `系统代理：已指向本桥 127.0.0.1:${port}`
      : mode === 'selected-apps'
        ? '系统代理：未由本 App 设置（捕获方式：指定应用）'
        : '系统代理：未由本 App 设置'
  }
  if (settings) debugLogging.checked = settings.debugLogging

  renderAllowlist()
  renderCapture()
  renderLog()
}

function renderAllowlist(): void {
  allowlistList.replaceChildren()
  if (!allowlist || allowlist.hosts.length === 0) {
    const empty = document.createElement('li')
    empty.textContent = '（空：所有流量直连）'
    allowlistList.append(empty)
  } else {
    for (const host of allowlist.hosts) {
      const item = document.createElement('li')
      const name = document.createElement('span')
      name.textContent = host
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.dataset.host = host
      remove.textContent = '删除'
      remove.setAttribute('aria-label', `删除 ${host}`)
      item.append(name, remove)
      allowlistList.append(item)
    }
  }
  allowlistWildcard.checked = allowlist?.includeSwufeWildcard === true
}

function renderCapture(): void {
  const mode: CaptureMode = settings?.captureMode ?? 'system-proxy'
  for (const input of captureModeInputs) input.checked = input.value === mode

  const selected = settings?.captureProcesses ?? []
  const selectedSet = new Set(selected)
  const filter = captureFilter.value.trim().toLowerCase()
  const names = new Map(candidates.map((candidate) => [candidate.pattern, candidate.name]))

  // Selected rows are always listed (unchecking must not require clearing the
  // filter); the rest is filtered by name as the user types.
  const rows: Array<{ pattern: string; label: string; chosen: boolean }> = selected.map(
    (pattern) => ({
      pattern,
      label: names.has(pattern) ? (names.get(pattern) as string) : `${pattern}（当前未运行）`,
      chosen: true,
    }),
  )
  for (const candidate of candidates) {
    if (selectedSet.has(candidate.pattern)) continue
    if (filter && !candidate.name.toLowerCase().includes(filter)) continue
    rows.push({ pattern: candidate.pattern, label: candidate.name, chosen: false })
  }

  captureList.replaceChildren()
  if (rows.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'hint'
    empty.textContent = filter ? '没有匹配的应用。' : '没有可捕获的应用。'
    captureList.append(empty)
  }
  for (const row of rows) {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.dataset.pattern = row.pattern
    input.checked = row.chosen
    const text = document.createElement('span')
    text.textContent = row.label
    label.append(input, text)
    captureList.append(label)
  }

  const failure = status?.captureError
  captureState.textContent = status?.localCaptureEnabled
    ? `进程捕获：已启用（${selected.length} 个应用）`
    : failure
      ? `进程捕获：启用失败 — ${failure}`
      : mode === 'selected-apps'
        ? '进程捕获：启用中…'
        : '进程捕获：未启用'
  captureGuidance.hidden = !failure
  captureRetry.hidden = !failure
}

function renderLog(): void {
  logPanel.hidden = settings?.debugLogging !== true
  logTableBody.replaceChildren()
  for (const event of logRows) {
    const row = document.createElement('tr')
    for (const text of [logTime(event), event.host, describeLogResult(event)]) {
      const cell = document.createElement('td')
      cell.textContent = text
      row.append(cell)
    }
    logTableBody.append(row)
  }
}

function logTime(event: DebugLogEvent): string {
  const parsed = new Date(event.ts)
  return Number.isNaN(parsed.getTime())
    ? event.ts
    : parsed.toLocaleTimeString('zh-CN', { hour12: false })
}

function describeLogResult(event: DebugLogEvent): string {
  const base = event.rewritten ? (event.direction === 'request' ? '已改写' : '响应改写') : '直连'
  return event.detail ? `${base}（${event.detail}）` : base
}

async function refresh(): Promise<void> {
  const [nextStatus, nextCa, nextSettings, nextAllowlist, nextCandidates] = await Promise.all([
    api.getStatus(),
    api.getCaStatus(),
    api.getSettings(),
    api.getAllowlist(),
    api.listCaptureCandidates(),
  ])
  status = nextStatus
  caStatus = nextCa
  settings = nextSettings
  allowlist = nextAllowlist
  candidates = nextCandidates
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

function saveAllowlist(next: AllowlistConfig): Promise<void> {
  return api.setAllowlist(next)
}

function report(error: unknown): void {
  setMessage(describeError(error))
}

loginButton.addEventListener('click', () => {
  void (async () => {
    try {
      await api.login()
      setMessage('')
    } catch (error) {
      setMessage(`打开登录窗口失败：${describeError(error)}`)
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
      report(error)
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
      setMessage(`安装失败：${describeError(error)}`)
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
      setMessage(`卸载失败：${describeError(error)}`)
    }
    await refresh()
  })()
})

allowlistForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void (async () => {
    const host = allowlistInput.value.trim()
    if (!host) {
      setMessage('请输入主机名。')
      return
    }
    if (!allowlist) return
    try {
      await saveAllowlist({
        hosts: [...allowlist.hosts, host],
        includeSwufeWildcard: allowlist.includeSwufeWildcard,
      })
    } catch (error) {
      report(error)
      return
    }
    allowlistInput.value = ''
    setMessage(`已添加 ${host}。`)
    await refresh()
  })()
})

allowlistList.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest('button[data-host]')
  if (!(button instanceof HTMLButtonElement) || !allowlist) return
  const host = button.dataset.host ?? ''
  void (async () => {
    try {
      await saveAllowlist({
        hosts: allowlist ? allowlist.hosts.filter((entry) => entry !== host) : [],
        includeSwufeWildcard: allowlist?.includeSwufeWildcard === true,
      })
    } catch (error) {
      report(error)
      return
    }
    setMessage(`已删除 ${host}。`)
    await refresh()
  })()
})

allowlistWildcard.addEventListener('change', () => {
  void (async () => {
    try {
      await saveAllowlist({
        hosts: allowlist?.hosts ?? [],
        includeSwufeWildcard: allowlistWildcard.checked,
      })
    } catch (error) {
      report(error)
    }
    await refresh()
  })()
})

for (const input of captureModeInputs) {
  input.addEventListener('change', () => {
    if (!input.checked) return
    void applyCaptureMode(input.value as CaptureMode)
  })
}

/** Switching mode revokes or restores the system proxy in Main (ADR-0006). */
async function applyCaptureMode(mode: CaptureMode): Promise<void> {
  let failure: { code: string | null; message: string } | null = null
  try {
    await api.setCaptureMode(mode)
  } catch (error) {
    failure = parseFailure(error)
    setMessage(failure.message)
  }
  // Re-display the persisted mode before any dialog: a rejected switch must not
  // leave the radio pointing at a mode that was not saved.
  await refresh()
  if (failure?.code === 'PROXY_CONFLICT') await showModal(proxyConflictModal)
}

captureList.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return
  const patterns = Array.from(
    captureList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  )
    .filter((box) => box.checked)
    .map((box) => box.dataset.pattern ?? '')
    .filter(Boolean)
  void (async () => {
    try {
      await api.setCaptureProcesses(patterns)
      setMessage('')
    } catch (error) {
      report(error)
    }
    await refresh()
  })()
})

captureFilter.addEventListener('input', () => renderCapture())

captureRefresh.addEventListener('click', () => {
  void (async () => {
    try {
      candidates = await api.listCaptureCandidates()
    } catch (error) {
      report(error)
    }
    renderCapture()
  })()
})

captureRetry.addEventListener('click', () => {
  void (async () => {
    // Re-pushing the config is the retry: the sidecar applies it on the next poll.
    await applyCaptureMode(settings?.captureMode ?? 'system-proxy')
  })()
})

debugLogging.addEventListener('change', () => {
  void (async () => {
    await api.setDebugLogging(debugLogging.checked)
    if (!debugLogging.checked) logRows = []
    await refresh()
  })()
})

logClear.addEventListener('click', () => {
  logRows = []
  renderLog()
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
  logRows.unshift(event)
  if (logRows.length > MAX_LOG_ROWS) logRows.pop()
  if (settings?.debugLogging) renderLog()
})

void refresh()
