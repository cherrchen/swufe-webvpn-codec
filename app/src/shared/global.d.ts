import type { SwufeBridgeApi } from './types'

declare global {
  interface Window {
    /** Injected by app/src/preload/index.ts (contextBridge). */
    swufeBridge: SwufeBridgeApi
  }
}
