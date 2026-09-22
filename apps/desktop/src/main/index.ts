/** Electron Main entry: wires the store, session broker, orchestrator, IPC and windows. */

import { app } from 'electron'
import { join } from 'node:path'

import { CONFDIR_NAME } from './constants'
import { createDebugLogBuffer } from './debug-log-buffer'
import { registerIpc } from './ipc'
import { ProxyOrchestrator } from './orchestrator'
import { resolveRepoRoot } from './paths'
import { createCertManager, createSystemProxy } from './platform'
import { SessionBroker } from './session-broker'
import { installShutdown } from './shutdown'
import { SidecarProcess } from './sidecar'
import { AppStore } from './store'
import { createWindowRegistry, type WindowRegistry } from './window-registry'

/** `--user-data-dir[=]<dir>` / `SWUFE_USER_DATA_DIR`: isolate config and cookies for tests. */
function applyUserDataOverride(): void {
  const inline = process.argv.find((arg) => arg.startsWith('--user-data-dir='))
  const index = process.argv.indexOf('--user-data-dir')
  const fromArgv = inline
    ? inline.slice('--user-data-dir='.length)
    : index >= 0
      ? process.argv[index + 1]
      : undefined
  const dir = process.env.SWUFE_USER_DATA_DIR ?? fromArgv
  if (dir) app.setPath('userData', dir)
}

applyUserDataOverride()

let windows: WindowRegistry | null = null
let orchestrator: ProxyOrchestrator | null = null

async function start(): Promise<void> {
  await app.whenReady()
  app.setAppUserModelId('com.swufe.webvpn-bridge')

  const appRoot = app.getAppPath()
  const userDataDir = app.getPath('userData')
  const repoRoot = resolveRepoRoot(appRoot)
  /** Python bridge project: source, venv and tests live under `<repo>/bridges/python` (ADR-0009). */
  const bridgeRoot = join(repoRoot, 'bridges', 'python')

  const store = new AppStore(userDataDir)
  store.load()
  const session = new SessionBroker(store.getSettings().webvpnBase)
  await session.prepare()
  const certManager = createCertManager(join(userDataDir, CONFDIR_NAME), bridgeRoot)

  orchestrator = new ProxyOrchestrator({
    store,
    session,
    systemProxy: createSystemProxy(),
    certManager,
    sidecarFactory: (options) => new SidecarProcess({ bridgeRoot, userDataDir, port: options.port }),
    userDataDir,
  })
  await orchestrator.recoverOnLaunch()

  // Closing the main window quits the app; secondary windows never outlive it (EC2-004).
  windows = createWindowRegistry({
    appRoot,
    devServerUrl: process.env.SWUFE_RENDERER_URL,
    onMainClosed: () => app.quit(),
  })

  registerIpc({
    store,
    session,
    orchestrator,
    certManager,
    windows,
    debugLogs: createDebugLogBuffer(),
  })

  windows.openMain()
}

/** NFR-004: quitting always clears our own proxy before the process goes away. */
function install(): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  app.on('second-instance', () => {
    const main = windows?.mainWindow() ?? null
    if (!main) return
    if (main.isMinimized()) main.restore()
    main.show()
    main.focus()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  installShutdown(async () => {
    await orchestrator?.stop()
  })

  void start().catch((error: unknown) => {
    console.error(`swufe-app 启动失败：${String(error)}`)
    app.exit(1)
  })
}

install()
