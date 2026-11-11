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
  const options: unknown[] = []
  const bonjour = {
    find: vi.fn((_options: unknown, onUp?: (service: unknown) => void) => {
      if (onUp !== undefined) listeners.set('up', onUp)
      return browser
    }),
    publish: vi.fn(() => ({ stop: vi.fn() })),
    unpublishAll: vi.fn((callback: () => void) => { callback() }),
    destroy: vi.fn((callback: () => void) => { callback() }),
  }
  return { listeners, browser, bonjour, options }
})

vi.mock('bonjour-service', () => ({
  Bonjour: function Bonjour(opts?: unknown) {
    mocks.options.push(opts)
    return mocks.bonjour
  },
}))

const { createBonjourDiscovery, LAN_HANDOFF_RESCAN_MS } = await import('../src/discovery.ts')

afterEach(() => {
  vi.clearAllMocks()
  mocks.listeners.clear()
  vi.useRealTimers()
})

describe('the bonjour adapter', () => {
  it('publishes and browses on every configured interface', async () => {
    const discovery = createBonjourDiscovery({ interfaces: ['192.168.1.8', '10.0.0.5'] })
    expect(mocks.options).toEqual([{ interface: '192.168.1.8' }, { interface: '10.0.0.5' }])
    discovery.publish({ name: 'self', type: 'easel-handoff', port: 40123, txt: { id: 'self' } })
    expect(mocks.bonjour.publish).toHaveBeenCalledTimes(2)
    // Each interface repeats its own query on the rescan cadence.
    vi.useFakeTimers()
    discovery.find('easel-handoff', () => undefined)
    const before = mocks.browser.update.mock.calls.length
    vi.advanceTimersByTime(LAN_HANDOFF_RESCAN_MS)
    expect(mocks.browser.update.mock.calls.length - before).toBe(2)
    await discovery.dispose()
    vi.useRealTimers()
  })

  it('repeats the browse query on the rescan cadence and releases the browser on dispose', async () => {
    vi.useFakeTimers()
    const discovery = createBonjourDiscovery({ interfaces: ['192.168.1.8'] })
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

  it('reports a new service, its record updates, and its withdrawal to the host callbacks', async () => {
    const discovery = createBonjourDiscovery({ interfaces: ['192.168.1.8'] })
    const up: { port: number; addresses: readonly string[]; txt: Readonly<Record<string, unknown>> }[] = []
    const down: { port: number; addresses: readonly string[]; txt: Readonly<Record<string, unknown>> }[] = []
    discovery.find(
      'easel-handoff',
      (entry) => { up.push(entry) },
      (entry) => { down.push(entry) },
    )

    const service: FakeService = { port: 40123, addresses: ['192.168.1.8'], txt: { id: 'peer', v: '1' } }
    mocks.listeners.get('up')?.(service)
    // A restarted peer advertises a new port through the SRV record.
    mocks.listeners.get('srv-update')?.({ ...service, port: 40124 })
    mocks.listeners.get('txt-update')?.(service)
    mocks.listeners.get('down')?.(service)

    expect(up.map(entry => entry.port)).toEqual([40123, 40124, 40123])
    expect(down).toEqual([{ addresses: ['192.168.1.8'], port: 40123, txt: { id: 'peer', v: '1' } }])
    await discovery.dispose()
  })

  it('does not subscribe a withdrawal callback the host did not supply', async () => {
    const discovery = createBonjourDiscovery({ interfaces: ['192.168.1.8'] })
    discovery.find('easel-handoff', () => undefined)
    expect(mocks.listeners.has('down')).toBe(false)
    await discovery.dispose()
  })
})
