/**
 * The bonjour-service adapter: repeat-query cadence and event mapping.
 *
 * The adapter wires live mDNS sockets, so these tests replace the library and
 * drive the browser handle the same way the real one behaves: one `up` per new
 * service, `srv-update`/`txt-update` on record changes, `down` on goodbye.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

interface FakeService {
  readonly port: number
  readonly addresses?: readonly string[]
  readonly txt?: Readonly<Record<string, unknown>>
}

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (service: unknown) => void>()
  const browser = {
    update: vi.fn(),
    stop: vi.fn(),
    on: vi.fn((event: string, listener: (service: unknown) => void) => {
      listeners.set(event, listener)
      return browser
    }),
  }
  const bonjour = {
    find: vi.fn((_options: unknown, onUp?: (service: unknown) => void) => {
      if (onUp !== undefined) listeners.set('up', onUp)
      return browser
    }),
    publish: vi.fn(() => ({ stop: vi.fn() })),
    unpublishAll: vi.fn((callback: () => void) => { callback() }),
    destroy: vi.fn((callback: () => void) => { callback() }),
  }
  return { listeners, browser, bonjour }
})

vi.mock('bonjour-service', () => ({ Bonjour: function Bonjour() { return mocks.bonjour } }))

const { createBonjourDiscovery, LAN_HANDOFF_RESCAN_MS } = await import('../src/discovery.ts')

afterEach(() => {
  vi.clearAllMocks()
  mocks.listeners.clear()
  vi.useRealTimers()
})

describe('the bonjour adapter', () => {
  it('repeats the browse query on the rescan cadence and releases the browser on dispose', async () => {
    vi.useFakeTimers()
    const discovery = createBonjourDiscovery()
    discovery.find('easel-handoff', () => undefined)
    expect(mocks.browser.update).not.toHaveBeenCalled()

    vi.advanceTimersByTime(LAN_HANDOFF_RESCAN_MS)
    expect(mocks.browser.update).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(LAN_HANDOFF_RESCAN_MS)
    expect(mocks.browser.update).toHaveBeenCalledTimes(2)

    await discovery.dispose()
    expect(mocks.browser.stop).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(LAN_HANDOFF_RESCAN_MS * 3)
    expect(mocks.browser.update).toHaveBeenCalledTimes(2)
  })

  it('reports a new service, its records, and its withdrawal to the host callbacks', () => {
    const discovery = createBonjourDiscovery()
    const up: { port: number; addresses: readonly string[]; txt: Readonly<Record<string, unknown>> }[] = []
    const down: { port: number; addresses: readonly string[]; txt: Readonly<Record<string, unknown>> }[] = []
    discovery.find(
      'easel-handoff',
      (entry) => { up.push(entry) },
      (entry) => { down.push(entry) },
    )

    const service: FakeService = { port: 40123, addresses: ['192.168.1.8'], txt: { id: 'peer', v: '1' } }
    for (const event of ['up', 'srv-update', 'txt-update'] as const) mocks.listeners.get(event)?.(service)
    mocks.listeners.get('down')?.(service)

    expect(up).toEqual([1, 2, 3].map(() => ({ addresses: ['192.168.1.8'], port: 40123, txt: { id: 'peer', v: '1' } })))
    expect(down).toHaveLength(1)
  })

  it('does not subscribe a withdrawal callback the host did not supply', () => {
    const discovery = createBonjourDiscovery()
    discovery.find('easel-handoff', () => undefined)
    expect(mocks.listeners.has('down')).toBe(false)
  })
})
