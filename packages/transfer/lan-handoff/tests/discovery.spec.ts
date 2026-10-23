/** TXT encoding/parsing, version negotiation, and filtering of discovery entries. */

import { brandString } from '@deepseek-ai/dsh-brand'
import { describe, expect, it } from 'vitest'
import type { DeviceId } from '../src/identity.ts'
import {
  advertiseLanHandoff,
  browseLanHandoff,
  encodeDeviceTxt,
  isLoopbackAddress,
  LAN_HANDOFF_PROTOCOL_VERSION,
  lanPlatformOfHost,
  parseDeviceTxt,
  parseDiscoveredEntry,
  protocolRangesOverlap,
  type LanAdvertisement,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
} from '../src/discovery.ts'

const OWN_ID: DeviceId = brandString<DeviceId>('a'.repeat(20))
const PEER_ID: DeviceId = brandString<DeviceId>('b'.repeat(20))

const PEER_ENTRY: LanDiscoveryEntry = {
  addresses: ['192.168.1.8'],
  port: 40123,
  txt: { id: PEER_ID, name: '工作台', pf: 'macos', v: '2', vmin: '1' },
}

class RecordingDiscoveryHost implements LanDiscoveryHost {
  readonly published: LanAdvertisement[] = []
  stopped = 0
  disposed = false
  lastType: string | undefined

  private onUp: ((entry: LanDiscoveryEntry) => void) | undefined

  publish(advertisement: LanAdvertisement): { readonly stop: () => void } {
    this.published.push(advertisement)
    return { stop: () => { this.stopped += 1 } }
  }

  find(type: string, onUp: (entry: LanDiscoveryEntry) => void): void {
    this.lastType = type
    this.onUp = onUp
  }

  emit(entry: LanDiscoveryEntry): void {
    this.onUp?.(entry)
  }

  async dispose(): Promise<void> {
    this.disposed = true
  }
}

describe('the device TXT document', () => {
  it('round-trips the id, name, platform, and protocol range', () => {
    const document = { id: OWN_ID, name: '测试机', platform: 'windows', protocol: { min: 2, max: 3 } } as const
    expect(parseDeviceTxt(encodeDeviceTxt(document))).toEqual(document)
  })

  it('defaults the lower protocol bound to the advertised maximum', () => {
    const parsed = parseDeviceTxt({ id: PEER_ID, name: 'p', pf: 'linux', v: '4' })
    expect(parsed?.protocol).toEqual({ min: 4, max: 4 })
  })

  it('refuses records with an invalid id, name, platform, or version', () => {
    expect(parseDeviceTxt({ id: OWN_ID, name: 'p', pf: 'macos', v: 'bad' })).toBeUndefined()
    expect(parseDeviceTxt({ id: OWN_ID, name: 'p', pf: 'tablet', v: '1' })).toBeUndefined()
    expect(parseDeviceTxt({ name: 'p', pf: 'macos', v: '1' })).toBeUndefined()
    expect(parseDeviceTxt({ id: PEER_ID, pf: 'macos', v: '1' })).toBeUndefined()
    expect(parseDeviceTxt({ id: PEER_ID, name: 'p', pf: 'macos', v: 1 })).toBeUndefined()
    expect(parseDeviceTxt({ id: PEER_ID, name: 'p', pf: 'macos', v: '65536' })).toBeUndefined()
  })
})

it('maps this host to one of the advertised platform labels', () => {
  expect(['windows', 'macos', 'linux']).toContain(lanPlatformOfHost())
})

it('detects version-range overlap inclusively', () => {
  expect(protocolRangesOverlap({ min: 1, max: 1 }, { min: 1, max: 1 })).toBe(true)
  expect(protocolRangesOverlap({ min: 1, max: 2 }, { min: 2, max: 5 })).toBe(true)
  expect(protocolRangesOverlap(LAN_HANDOFF_PROTOCOL_VERSION, { min: 9, max: 9 })).toBe(false)
})

it('loops back only on loopback literals', () => {
  expect(isLoopbackAddress('127.0.0.1')).toBe(true)
  expect(isLoopbackAddress('127.31.2.9')).toBe(true)
  expect(isLoopbackAddress('::1')).toBe(true)
  expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
  expect(isLoopbackAddress('192.168.1.8')).toBe(false)
  expect(isLoopbackAddress('fe80::1')).toBe(false)
})

describe('discovered-entry listing', () => {
  it('lists an incompatible peer as incompatible', () => {
    const peer = parseDiscoveredEntry(PEER_ENTRY, OWN_ID)
    expect(peer).toEqual({
      id: PEER_ID,
      name: '工作台',
      platform: 'macos',
      protocol: { min: 1, max: 2 },
      port: 40123,
      addresses: ['192.168.1.8'],
      compatible: true,
    })
  })

  it('marks version ranges without overlap as incompatible but keeps the peer listed', () => {
    const peer = parseDiscoveredEntry({ ...PEER_ENTRY, txt: { ...PEER_ENTRY.txt, v: '9', vmin: '9' } }, OWN_ID)
    expect(peer?.compatible).toBe(false)
  })

  it('skips its own advertisement, unlistable entries, and loopback-only entries', () => {
    expect(parseDiscoveredEntry(PEER_ENTRY, PEER_ID)).toBeUndefined()
    expect(parseDiscoveredEntry({ ...PEER_ENTRY, txt: { id: 7 } }, OWN_ID)).toBeUndefined()
    expect(parseDiscoveredEntry({ ...PEER_ENTRY, addresses: ['127.0.0.1', '::ffff:127.0.0.2'] }, OWN_ID)).toBeUndefined()
    expect(parseDiscoveredEntry({ ...PEER_ENTRY, port: 0 }, OWN_ID)).toBeUndefined()
    expect(parseDiscoveredEntry({ ...PEER_ENTRY, addresses: ['192.168.1.8', '127.0.0.2'] }, OWN_ID)?.addresses)
      .toEqual(['192.168.1.8'])
  })
})

describe('the recording host drives advertisement and browsing', () => {
  it('publishes this device under its id with the encoded TXT document', () => {
    const host = new RecordingDiscoveryHost()
    const published = advertiseLanHandoff(
      host,
      { deviceId: OWN_ID, platform: lanPlatformOfHost(), protocol: LAN_HANDOFF_PROTOCOL_VERSION },
      'bill',
      40121,
    )
    expect(host.published).toEqual([{
      name: OWN_ID,
      type: 'easel-handoff',
      port: 40121,
      txt: { id: OWN_ID, name: 'bill', pf: lanPlatformOfHost(), v: '1', vmin: '1' },
    }])
    published.stop()
    expect(host.stopped).toBe(1)
  })

  it('routes tagged entries to the peer callback and drops the rest', () => {
    const host = new RecordingDiscoveryHost()
    const seen: unknown[] = []
    browseLanHandoff(host, OWN_ID, (peer) => { seen.push(peer) })
    expect(host.lastType).toBe('easel-handoff')
    host.emit(PEER_ENTRY)
    host.emit({ ...PEER_ENTRY, txt: { id: 7 } })
    host.emit({ ...PEER_ENTRY, txt: { ...PEER_ENTRY.txt, id: OWN_ID } })
    expect(seen).toHaveLength(1)
  })
})
