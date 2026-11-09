/**
 * The desktop host bridge is an inline `<script>` inside
 * `apps/desktop-tauri/scripts/bundle-runtime.mjs`. The packaging script
 * compiles it, but nothing else exercises its three transports before a
 * user's webview runs it: a broken one silently degrades the About section to
 * "desktop only". Run the extracted script against stub windows here.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import { describe, expect, it } from 'vitest'

const bundleScript = readFileSync(
  fileURLToPath(new URL('../apps/desktop-tauri/scripts/bundle-runtime.mjs', import.meta.url)),
  'utf8',
)

/** The bridge body between the wrapping `<script>` tags. */
function bridgeScript(): string {
  const start = bundleScript.indexOf('const bridge = `<script>')
  expect(start).toBeGreaterThan(-1)
  const bodyStart = bundleScript.indexOf('\n', start) + 1
  const end = bundleScript.indexOf('</script>`;', bodyStart)
  expect(end).toBeGreaterThan(bodyStart)
  return bundleScript.slice(bodyStart, end)
}

/** The updater bridge the page code consumes (`hostUpdate.js`). */
interface HostUpdateBridge {
  rpc: (action: string, args?: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; error?: string }>
  onEvent: (name: string, cb: (payload: unknown) => void) => () => void
}

/** A `window` stub the extracted script can run against. */
interface FakeWindow {
  [key: string]: unknown
  /** The frame parent for the postMessage transport; the window itself top-level. */
  parent?: unknown
}

function fakeWindow(patch: Record<string, unknown> = {}): FakeWindow {
  const win = {} as FakeWindow
  win.parent = win
  Object.assign(win, patch)
  return win
}

/** Run the bridge in a fresh context and return the installed global. */
function runBridge(win: FakeWindow, extras: Record<string, unknown> = {}): unknown {
  const context = { window: win, setTimeout, clearTimeout, console, ...extras }
  new Script(bridgeScript()).runInNewContext(context)
  return win.__easelHostUpdate
}

describe('desktop host bridge', () => {
  it('drives the updater commands through the Tauri IPC on a top-level window', async () => {
    const calls: Array<[string, unknown]> = []
    const listeners: Array<[string, (event: { payload: unknown }) => void]> = []
    let unlistenCalls = 0
    const win = fakeWindow({
      __TAURI__: {
        core: {
          invoke: async (command: string, args: unknown) => {
            calls.push([command, args])
            if (command === 'easel_check_update') return { status: 'up-to-date' }
            throw new Error('denied')
          },
        },
        event: {
          listen: (name: string, cb: (event: { payload: unknown }) => void) => {
            listeners.push([name, cb])
            return Promise.resolve(() => { unlistenCalls += 1 })
          },
        },
      },
    })

    const bridge = runBridge(win) as HostUpdateBridge
    expect(JSON.stringify(await bridge.rpc('update-check'))).toBe(JSON.stringify({ ok: true, data: { status: 'up-to-date' } }))
    expect(calls[0]?.[0]).toBe('easel_check_update')
    expect(JSON.stringify(calls[0]?.[1])).toBe('{}')
    expect(JSON.stringify(await bridge.rpc('update-source-set', { source: 'github' })))
      .toBe(JSON.stringify({ ok: false, error: 'Error: denied' }))
    expect(calls[1]?.[0]).toBe('easel_set_update_source')
    expect(JSON.stringify(await bridge.rpc('unknown'))).toBe(JSON.stringify({ ok: false, error: 'unsupported action: unknown' }))
    await bridge.rpc('update-state')
    expect(calls[2]?.[0]).toBe('easel_update_state')
    await bridge.rpc('update-install')
    expect(calls[3]?.[0]).toBe('easel_install_update')

    const seen: unknown[] = []
    const off = bridge.onEvent('easel://update-progress', payload => seen.push(payload))
    expect(listeners[0]?.[0]).toBe('easel://update-progress')
    listeners[0]?.[1]({ payload: { phase: 'downloading' } })
    expect(seen).toEqual([{ phase: 'downloading' }])
    off()
    await Promise.resolve()
    expect(unlistenCalls).toBe(1)
  })

  it('stays absent in a plain browser', () => {
    const win = fakeWindow()
    expect(runBridge(win)).toBeUndefined()
  })

  it('stays absent when the Tauri global has no invoke', () => {
    expect(runBridge(fakeWindow({ __TAURI__: { core: {} } }))).toBeUndefined()
  })

  it('keeps the postMessage relay inside the shell iframe', async () => {
    const posted: Array<{ kind?: string; action?: string; id?: number }> = []
    const handlers: Array<(event: { data: unknown }) => void> = []
    const win = fakeWindow()
    win.parent = { postMessage: (payload: { kind?: string; action?: string; id?: number }) => posted.push(payload) }
    win.addEventListener = (_name: string, cb: (event: { data: unknown }) => void) => handlers.push(cb)

    const bridge = runBridge(win, {
      document: { addEventListener: () => {} },
      location: { href: 'http://127.0.0.1:1/' },
    }) as HostUpdateBridge
    const pending = bridge.rpc('update-state')
    expect(posted[0]?.kind).toBe('rpc')
    expect(posted[0]?.action).toBe('update-state')
    handlers[0]?.({ data: { source: 'dsh-desktop-host', kind: 'rpc-result', id: posted[0]?.id, ok: true, data: { version: '1.0.0' } } })
    expect(JSON.stringify(await pending)).toBe(JSON.stringify({ source: 'dsh-desktop-host', kind: 'rpc-result', id: 1, ok: true, data: { version: '1.0.0' } }))

    const seen: unknown[] = []
    bridge.onEvent('easel://update-available', payload => seen.push(payload))
    handlers[0]?.({ data: { source: 'dsh-desktop-host', kind: 'rpc-event', event: 'easel://update-available', payload: { version: '2.0.0' } } })
    expect(seen).toEqual([{ version: '2.0.0' }])
  })
})
