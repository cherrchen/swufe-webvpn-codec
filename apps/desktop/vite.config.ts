/**
 * Vite build for the renderer layer (four窗口 entry HTML + shared chunk).
 *
 * The CSP meta tag is injected here (and only here) so production and development
 * policies stay in one place: the shipped build keeps `script-src 'self'`, while
 * the dev server additionally allows the Vite dev origin and its HMR websocket.
 * antd 6 injects styles at runtime via @ant-design/cssinjs, hence the single
 * relaxation `style-src 'self' 'unsafe-inline'` (spec 002 SC2-004 / ADR-0012).
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const appRoot = dirname(fileURLToPath(import.meta.url))
const rendererRoot = resolve(appRoot, 'src/renderer')

export const DEV_SERVER_ORIGIN = 'http://127.0.0.1:5173'

const PRODUCTION_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"

const DEVELOPMENT_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' " + DEV_SERVER_ORIGIN,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  `connect-src ${DEV_SERVER_ORIGIN} ws://127.0.0.1:5173`,
  "font-src 'self' data:",
].join('; ')

/** Inject the mode-appropriate CSP meta into every entry HTML. */
function cspPlugin(): Plugin {
  return {
    name: 'swufe-csp',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: {
                'http-equiv': 'Content-Security-Policy',
                content: ctx.server ? DEVELOPMENT_CSP : PRODUCTION_CSP,
              },
              injectTo: 'head-prepend',
            },
          ],
        }
      },
    },
  }
}

export default defineConfig({
  root: rendererRoot,
  base: './',
  plugins: [react(), cspPlugin()],
  build: {
    outDir: resolve(appRoot, 'dist/renderer'),
    emptyOutDir: true,
    target: 'esnext',
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        main: resolve(rendererRoot, 'main.html'),
        capture: resolve(rendererRoot, 'capture.html'),
        logs: resolve(rendererRoot, 'logs.html'),
        allowlist: resolve(rendererRoot, 'allowlist.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
