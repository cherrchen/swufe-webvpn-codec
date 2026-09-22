/**
 * Renderer component tests: jsdom only, no browser and no display (spec 002 R2-008).
 * Zero-scroll, window counts and window-open latency are asserted on the real app
 * over CDP instead — they cannot be measured in jsdom.
 *
 * JSX is handled by esbuild using `tsconfig.json`'s `jsx: react-jsx`; the React plugin
 * is not needed here.
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/ui/**/*.test.tsx'],
    setupFiles: ['test/ui/helpers/setup.ts'],
    restoreMocks: true,
  },
})
