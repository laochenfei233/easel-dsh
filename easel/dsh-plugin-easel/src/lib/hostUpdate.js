/**
 * Shell update channel: the desktop relay's promise RPC plus the shared
 * store the About section and the update notice dialog read.
 *
 * The GUI document (the cross-origin iframe of the Tauri shell, or the
 * WebKit app window) has no Tauri IPC of its own; the staged host bridge
 * exposes `window.__easelHostUpdate` only inside the shell, and a missing or
 * malformed global degrades to `supported: false` — the About section shows
 * the desktop-only line and the notice dialog never opens. Plain-browser
 * `dsh web` runs are that case by construction.
 */

/** Payloads the shell page relays from `easel_check_update` / `easel_update_state`. */

/** The `easel://update-progress` phases the store exposes. */
const EVENT_PROGRESS = 'easel://update-progress'
/** The `easel://update-available` event that opens the notice dialog. */
const EVENT_AVAILABLE = 'easel://update-available'

/**
 * Read the injected desktop-update bridge.
 * @param {Window | undefined} win - window to read; defaults to the global one when it exists.
 * @returns {object | undefined} The bridge (`rpc` + `onEvent`), or undefined outside the desktop shell.
 */
export function detectHostUpdateBridge(win) {
  if (win === undefined) {
    if (typeof window === 'undefined') return undefined
    win = window
  }
  const host = win.__easelHostUpdate
  return host !== undefined && typeof host.rpc === 'function' ? host : undefined
}

/**
 * One shared update store, created per client boot. State starts from the
 * shell's snapshot (`refresh`), is updated by the live relay events, and
 * carries the two transient flags the surfaces render busy states from.
 * @param {object | undefined} bridge - the injected bridge; undefined degrades.
 * @returns {object} store with subscribe/snapshot/refresh/check/install/dismiss/dispose.
 */
export function createUpdateStore(bridge) {
  let seq = 0
  let state = {
    supported: bridge !== undefined,
    /** The shell snapshot has been read at least once. */
    ready: false,
    /** Running shell version; desktop only. */
    version: undefined,
    endpoints: [],
    /** `default` | `override` | `error` — the update-source seam state. */
    source: 'default',
    lastCheckMs: undefined,
    /** `up-to-date` | `available` | `error` — outcome of the last check. */
    lastCheckStatus: undefined,
    /** The newest found release `{version, notes?, pubDateMs?}`, when the last check saw one. */
    latest: undefined,
    lastError: undefined,
    /** The live notice payload `{version, notes?, pubDateMs?, seq}`; drives the dialog. */
    announce: undefined,
    /** Latest install progress `{phase, percent?, version?}`, cleared on failure. */
    progress: undefined,
    checking: false,
  }
  const readers = new Set()
  const notify = () => { for (const read of readers) read() }
  const set = (patch) => { state = { ...state, ...patch }; notify() }

  const applyStatePayload = (payload) => {
    if (payload === undefined || typeof payload !== 'object') return
    set({
      ready: true,
      version: payload.version,
      endpoints: Array.isArray(payload.endpoints) ? payload.endpoints : [],
      source: payload.source ?? 'default',
      sourceKey: payload.sourceKey ?? 'default',
      customUrl: payload.customUrl,
      lastCheckMs: payload.lastCheckMs,
      lastCheckStatus: payload.lastCheckStatus,
      latest: payload.latest,
      lastError: payload.lastError,
    })
  }

  /** Re-read the shell snapshot; a relay failure records it as the About's error. */
  const refresh = async () => {
    if (bridge === undefined) return
    try {
      const res = await bridge.rpc('update-state')
      if (res.ok) applyStatePayload(res.data)
      else set({ ready: true, lastError: res.error })
    } catch {
      // The relay timed out; the last known state stands until the next refresh.
    }
  }

  /** Manual check from the About section; returns the shell's check result. */
  const check = async () => {
    if (bridge === undefined) return { status: 'error', detail: 'unsupported' }
    set({ checking: true, lastError: undefined })
    try {
      const res = await bridge.rpc('update-check')
      if (res.ok) {
        const data = res.data ?? {}
        set({
          checking: false,
          lastCheckStatus: data.status,
          latest: data.status === 'available'
            ? { version: data.version, notes: data.notes, pubDateMs: data.pubDateMs }
            : undefined,
          lastError: data.status === 'error' ? data.detail : undefined,
        })
        return data
      }
      set({ checking: false, lastError: res.error })
      return { status: 'error', detail: res.error }
    } catch (err) {
      set({ checking: false, lastError: String(err) })
      return { status: 'error', detail: String(err) }
    }
  }

  /** Install from the About row or the notice dialog; progress flows via events. */
  const install = async () => {
    if (bridge === undefined) return { status: 'error', detail: 'unsupported' }
    set({ progress: { phase: 'downloading', percent: 0, version: state.latest?.version } })
    try {
      const res = await bridge.rpc('update-install')
      if (res.ok && res.data === 'started') return { status: 'started' }
      if (res.ok && res.data === 'up-to-date') {
        set({ progress: undefined })
        return { status: 'up-to-date' }
      }
      set({ progress: undefined, lastError: res.error ?? 'install failed' })
      return { status: 'error', detail: res.error }
    } catch (err) {
      set({ progress: undefined, lastError: String(err) })
      return { status: 'error', detail: String(err) }
    }
  }

  /** Switch the update source from the About selector; the shell persists it. */
  const setSource = async (source, url) => {
    if (bridge === undefined) return { ok: false, error: 'unsupported' }
    try {
      const res = await bridge.rpc('update-source-set', { source, url })
      if (res.ok) {
        applyStatePayload(res.data)
        return { ok: true }
      }
      set({ lastError: res.error })
      return { ok: false, error: res.error }
    } catch (err) {
      set({ lastError: String(err) })
      return { ok: false, error: String(err) }
    }
  }

  const offProgress = bridge?.onEvent?.(EVENT_PROGRESS, (payload) => {
    if (payload?.phase === 'failed') {
      // Keep the failed phase on the store (the notice dialog renders it) and
      // re-read the snapshot so the shell-recorded error text arrives.
      set({ progress: payload })
      void refresh()
    } else {
      set({ progress: payload })
    }
  })
  const offAvailable = bridge?.onEvent?.(EVENT_AVAILABLE, (payload) => {
    if (payload?.version === undefined) return
    seq += 1
    set({ announce: { ...payload, seq } })
  })

  return {
    subscribe: (read) => { readers.add(read); return () => readers.delete(read) },
    snapshot: () => state,
    refresh,
    check,
    install,
    setSource,
    dismiss: () => set({ announce: undefined }),
    dispose: () => { offProgress?.(); offAvailable?.(); readers.clear() },
  }
}
