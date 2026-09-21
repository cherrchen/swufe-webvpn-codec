/** Repository root resolution (dev layout: the Electron app lives in `<repo>/app`). */

import { resolve } from 'node:path'

/** `SWUFE_REPO_ROOT` overrides the inferred root (used by tests and manual runs). */
export function resolveRepoRoot(appPath: string): string {
  return process.env.SWUFE_REPO_ROOT ?? resolve(appPath, '..')
}
