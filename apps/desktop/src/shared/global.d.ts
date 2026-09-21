import type { SwufeBridgeApi } from './types'

declare global {
  interface Window {
    /** Injected by apps/desktop/src/preload/index.ts (contextBridge). */
    swufeBridge: SwufeBridgeApi
  }
}
