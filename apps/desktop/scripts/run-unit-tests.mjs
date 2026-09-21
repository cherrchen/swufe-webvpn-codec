// Runs every apps/desktop/test/**/*.test.ts with the Node test runner + tsx loader.
// A Node-only replacement for shell globs so `pnpm run test:unit` works on every platform.
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const testDir = join(appRoot, 'test')

const files = readdirSync(testDir, { recursive: true })
  .map((entry) => join(testDir, String(entry)))
  .filter((path) => path.endsWith('.test.ts') && statSync(path).isFile())
  .sort()

if (files.length === 0) {
  console.error(`no *.test.ts files under ${testDir}`)
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  cwd: appRoot,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
