/**
 * Verification harness for M2 (not production code, not shipped).
 *
 * Runs the real app — AppStore, SessionBroker, Darwin/Win32 SystemProxy, SidecarProcess,
 * ProxyOrchestrator, IPC, preload and renderer — with exactly one dependency stubbed:
 * the CA trust check in Cert Manager, which needs an interactive admin prompt and can
 * therefore not run unattended. Everything else, including the real `networksetup`
 * calls and the real mitmproxy sidecar, is the shipping code path.
 *
 *   SWUFE_VERIFY_USER_DATA=/tmp/m2-e2e SWUFE_VERIFY_CDP_PORT=9223 \
 *     apps/desktop/node_modules/.bin/electron apps/desktop/test/fixtures/stub-ca-app.js
 */

const { app } = require('electron')
const path = require('node:path')

const appRoot = path.resolve(__dirname, '..', '..')
const repoRoot = path.resolve(appRoot, '..', '..')
/** Python bridge project: source, venv and tests live under <repo>/bridges/python (ADR-0009). */
const bridgeRoot = path.join(repoRoot, 'bridges', 'python')
const userDataDir = process.env.SWUFE_VERIFY_USER_DATA ?? path.join('/tmp', 'm2-e2e')
const cdpPort = process.env.SWUFE_VERIFY_CDP_PORT

app.setPath('userData', userDataDir)
if (cdpPort) app.commandLine.appendSwitch('remote-debugging-port', cdpPort)

const { AppStore } = require(path.join(appRoot, 'dist', 'main', 'store.js'))
const { SessionBroker } = require(path.join(appRoot, 'dist', 'main', 'session-broker.js'))
const { ProxyOrchestrator } = require(path.join(appRoot, 'dist', 'main', 'orchestrator.js'))
const { SidecarProcess } = require(path.join(appRoot, 'dist', 'main', 'sidecar.js'))
const { registerIpc } = require(path.join(appRoot, 'dist', 'main', 'ipc.js'))
const { createDebugLogBuffer } = require(path.join(appRoot, 'dist', 'main', 'debug-log-buffer.js'))
const { createWindowRegistry } = require(path.join(appRoot, 'dist', 'main', 'window-registry.js'))
const { createSystemProxy } = require(path.join(appRoot, 'dist', 'main', 'platform', 'index.js'))
const { installShutdown } = require(path.join(appRoot, 'dist', 'main', 'shutdown.js'))

/** The single stub: CA files exist and the cert is trusted in the system store. */
const stubbedCertManager = {
  async getStatus() {
    console.log('swufe-verify certManager.getStatus() → {installed:true,trusted:true}（CA 前置被替换）')
    return { installed: true, trusted: true }
  },
  async install() {
    return { ok: true }
  },
  async uninstall() {
    return { ok: true }
  },
}

let orchestrator = null

async function start() {
  await app.whenReady()
  const store = new AppStore(userDataDir)
  store.load()
  const session = new SessionBroker(store.getSettings().webvpnBase)
  await session.prepare()

  orchestrator = new ProxyOrchestrator({
    store,
    session,
    systemProxy: createSystemProxy(),
    certManager: stubbedCertManager,
    sidecarFactory: (options) => new SidecarProcess({ bridgeRoot, userDataDir, port: options.port }),
    userDataDir,
  })
  await orchestrator.recoverOnLaunch()

  const windows = createWindowRegistry({
    appRoot,
    devServerUrl: process.env.SWUFE_RENDERER_URL,
    onMainClosed: () => app.quit(),
  })

  registerIpc({
    store,
    session,
    orchestrator,
    certManager: stubbedCertManager,
    windows,
    debugLogs: createDebugLogBuffer(),
  })

  windows.openMain()
  console.log(`swufe-verify 启动完成 userData=${userDataDir} webvpnBase=${store.getSettings().webvpnBase}`)
}

installShutdown(async () => {
  await orchestrator?.stop()
})

void start().catch((error) => {
  console.error(`swufe-verify 启动失败：${String(error)}`)
  app.exit(1)
})
