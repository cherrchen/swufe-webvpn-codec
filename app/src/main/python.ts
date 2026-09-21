/** Interpreter resolution for the Python sidecar and CA entry points. */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface PythonCommand {
  command: string
  args: string[]
}

/**
 * Order: `SWUFE_PYTHON` override → repository virtualenv → `uv run --project`.
 * Kept deliberately dumb so an unsupported layout fails loudly instead of guessing.
 */
export function resolvePythonCommand(repoRoot: string): PythonCommand {
  const override = process.env.SWUFE_PYTHON
  if (override) return { command: override, args: [] }
  const venvPython =
    process.platform === 'win32'
      ? join(repoRoot, '.venv', 'Scripts', 'python.exe')
      : join(repoRoot, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return { command: venvPython, args: [] }
  return { command: 'uv', args: ['run', '--project', repoRoot, 'python'] }
}
