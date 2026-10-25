/** Types of the shell update channel (hostUpdate.js). */

/** The injected desktop bridge: promise RPC plus relay-event subscription. */
export interface HostUpdateBridge {
  rpc(action: string, args?: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string }>
  onEvent?(name: string, listener: (payload: unknown) => void): () => void
}

/** The newest release a check found. */
export interface LatestRelease {
  version: string
  notes?: string
  pubDateMs?: number
}

/** The shared update store's observable state. */
export interface UpdateStoreState {
  supported: boolean
  ready: boolean
  version?: string
  endpoints: string[]
  source: 'default' | 'override' | 'error'
  sourceKey: 'default' | 'github' | 'custom'
  customUrl?: string
  lastCheckMs?: number
  lastCheckStatus?: 'up-to-date' | 'available' | 'error'
  latest?: LatestRelease
  lastError?: string
  announce?: LatestRelease & { seq: number }
  progress?: { phase: string; percent?: number; version?: string }
  checking: boolean
}

/** The store the About section and the update notice read. */
export interface EaselUpdate {
  subscribe(read: () => void): () => void
  snapshot(): UpdateStoreState
  refresh(): Promise<void>
  check(): Promise<{ status: string; version?: string; notes?: string; pubDateMs?: number; detail?: string }>
  install(): Promise<{ status: string; detail?: string }>
  setSource(source: 'default' | 'github' | 'custom', url?: string): Promise<{ ok: boolean; error?: string }>
  dismiss(): void
  dispose(): void
}

export declare function detectHostUpdateBridge(win?: Window): HostUpdateBridge | undefined
export declare function createUpdateStore(bridge: HostUpdateBridge | undefined): EaselUpdate
