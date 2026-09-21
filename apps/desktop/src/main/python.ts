/** Interpreter resolution for the Python sidecar and CA entry points. */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface PythonCommand {
  command: string
  args: string[]
}

/**
 * Order: `SWUFE_PYTHON` override → bridge project virtualenv → `uv run --project`.
 * `bridgeRoot` is the Python bridge project (`<repo>/bridges/python`), which owns both
 * the venv and the `swufe_bridge` package. Kept deliberately dumb so an unsupported
 * layout fails loudly instead of guessing.
 */
export function resolvePythonCommand(bridgeRoot: string): PythonCommand {
  const override = process.env.SWUFE_PYTHON
  if (override) return { command: override, args: [] }
  const venvPython =
    process.platform === 'win32'
      ? join(bridgeRoot, '.venv', 'Scripts', 'python.exe')
      : join(bridgeRoot, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return { command: venvPython, args: [] }
  return { command: 'uv', args: ['run', '--project', bridgeRoot, 'python'] }
}
