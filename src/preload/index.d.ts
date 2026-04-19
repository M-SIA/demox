import type { DemoxApi } from './index.js'

declare global {
  interface Window {
    demox: DemoxApi
  }
}

export {}
