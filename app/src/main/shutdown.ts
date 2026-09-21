/** Quit handling (NFR-004): the managed system proxy must be gone before the
 * process disappears, and a re-requested quit must not win the race against an
 * in-flight cleanup.
 *
 * Signals are deliberately not handled: Electron's browser process dies on
 * SIGTERM/SIGKILL without running JS (verified on macOS), so the residual proxy
 * from a hard kill is healed by `ProxyOrchestrator.recoverOnLaunch()` on the next start.
 */

import { app } from 'electron'

export function installShutdown(cleanup: () => Promise<unknown>): void {
  let shuttingDown = false
  const shutdown = (reason: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`swufe-quit 开始退出清理（${reason}）`)
    void (async () => {
      try {
        await cleanup()
        console.log('swufe-quit 退出清理完成')
      } catch (error) {
        console.error(`swufe-quit 退出清理失败：${String(error)}`)
      } finally {
        app.exit(0)
      }
    })()
  }

  app.on('before-quit', (event) => {
    // Always hold the quit: the cleanup runs asynchronously and macOS re-issues a
    // quit request when the last window closes, which would otherwise exit first.
    event.preventDefault()
    shutdown('before-quit')
  })
}
