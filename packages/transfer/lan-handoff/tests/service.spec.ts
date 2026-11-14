/** Service lifecycle: start state, advertisement, peer browsing, and fiber disposal. */

import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hostname } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { loadDeviceIdentity, type DeviceId } from '../src/identity.ts'
import { startLanListener } from '../src/listener.ts'
import { loadSavedPort } from '../src/port.ts'
import {
  LanHandoffService,
} from '../src/index.ts'
import type {
  LanAdvertisement,
  LanDiscoveryEntry,
  LanDiscoveryHost,
} from '../src/discovery.ts'

class RecordingDiscoveryHost implements LanDiscoveryHost {
  readonly published: LanAdvertisement[] = []
  stopped = 0
  disposed = false

  private onUp: ((entry: LanDiscoveryEntry) => void) | undefined
  private onDown: ((entry: LanDiscoveryEntry) => void) | undefined

  publish(advertisement: LanAdvertisement): { readonly stop: () => void } {
    this.published.push(advertisement)
    return { stop: () => { this.stopped += 1 } }
  }

  find(_type: string, onUp: (entry: LanDiscoveryEntry) => void, onDown?: (entry: LanDiscoveryEntry) => void): void {
    this.onUp = onUp
    this.onDown = onDown
  }

  emit(entry: LanDiscoveryEntry): void {
    this.onUp?.(entry)
  }

  emitDown(entry: LanDiscoveryEntry): void {
    this.onDown?.(entry)
  }

  async dispose(): Promise<void> {
    this.disposed = true
  }
}

let roots: string[] = []
let ctx: Context | undefined

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-service-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  for (const root of roots) await rm(root, { recursive: true, force: true })
  roots = []
})

it('starts with a minted identity, the configured name, an assigned port, and an advertisement', async () => {
  ctx = new Context()
  const discovery = new RecordingDiscoveryHost()
  const service = new LanHandoffService(ctx, { name: '测试机' }, { identityRoot: await tempRoot(), discovery })
  const state = await service.ready
  expect(state.deviceId).toMatch(/^[0-9a-f]{20}$/u)
  expect(state.name).toBe('测试机')
  expect(service.receivingSnapshot()).toBeUndefined()
  expect(state.port).toBeGreaterThan(0)
  expect(['::', '0.0.0.0']).toContain(state.host)
  const [advertisement] = discovery.published
  expect(advertisement).toMatchObject({
    name: state.deviceId,
    type: 'easel-handoff',
    port: state.port,
    txt: { id: state.deviceId, name: '测试机', v: '5', vmin: '5' },
  })
  await ctx.fiber.dispose()
  ctx = undefined
  expect(discovery.stopped).toBe(1)
  expect(discovery.disposed).toBe(true)
})

it('defaults the display name to the operating-system host name', async () => {
  ctx = new Context()
  const service = new LanHandoffService(ctx, {}, { identityRoot: await tempRoot(), discovery: new RecordingDiscoveryHost() })
  const state = await service.ready
  expect(state.name).toBe(hostname())
})

it('keeps the latest advertisement per peer id in the snapshot', async () => {
  ctx = new Context()
  const discovery = new RecordingDiscoveryHost()
  const service = new LanHandoffService(ctx, {}, { identityRoot: await tempRoot(), discovery })
  await service.ready
  const peerId = brandString<DeviceId>('c'.repeat(20))
  discovery.emit({ addresses: ['192.168.1.8'], port: 40123, txt: { id: peerId, name: 'first', pf: 'macos', v: '5', vmin: '5' } })
  discovery.emit({ addresses: ['192.168.1.9'], port: 40124, txt: { id: peerId, name: 'latest', pf: 'macos', v: '5', vmin: '5' } })
  expect(service.peersSnapshot().map(peer => peer.name)).toEqual(['latest'])
  expect(service.peersSnapshot().map(peer => peer.addresses)).toEqual([['192.168.1.9']])
  // A restarted peer advertises a new random port; the snapshot must dial it.
  discovery.emit({ addresses: ['192.168.1.9'], port: 40125, txt: { id: peerId, name: 'latest', pf: 'macos', v: '1', vmin: '1' } })
  expect(service.peersSnapshot().map(peer => peer.port)).toEqual([40125])
  // An update without addresses cannot be dialed; the previous entry survives.
  discovery.emit({ addresses: [], port: 40126, txt: { id: peerId, name: 'latest', pf: 'macos', v: '1', vmin: '1' } })
  expect(service.peersSnapshot().map(peer => peer.port)).toEqual([40125])
})

it('drops a peer the network withdrew from the snapshot', async () => {
  ctx = new Context()
  const discovery = new RecordingDiscoveryHost()
  const service = new LanHandoffService(ctx, {}, { identityRoot: await tempRoot(), discovery })
  await service.ready
  const peerId = brandString<DeviceId>('d'.repeat(20))
  const entry = { addresses: ['192.168.1.8'], port: 40123, txt: { id: peerId, name: 'gone', pf: 'macos', v: '1', vmin: '1' } }
  discovery.emit(entry)
  expect(service.peersSnapshot()).toHaveLength(1)
  discovery.emitDown(entry)
  expect(service.peersSnapshot()).toEqual([])
})

it('removes interrupted receipt staging groups at startup', async () => {
  const handoff = await tempRoot()
  const stale = join(handoff, `.handoff-${'a'.repeat(32)}`)
  await mkdir(join(stale, 'sub'), { recursive: true })
  await writeFile(join(stale, 'sub', 'file.txt'), 'x', 'utf8')
  // A child newer than its directory exercises the deep mtime scan.
  await utimes(join(stale, 'sub', 'file.txt'), new Date(Date.now() + 60_000), new Date(Date.now() + 60_000))
  await mkdir(`${stale}.data`, { recursive: true })
  await mkdir(`${stale}.sessions`, { recursive: true })
  ctx = new Context()
  const service = new LanHandoffService(ctx, { handoffDirectory: handoff, staleReceiptAgeMinutes: 0 }, {
    identityRoot: await tempRoot(),
    discovery: new RecordingDiscoveryHost(),
  })
  await service.ready
  await expect(stat(stale)).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(stat(`${stale}.data`)).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(stat(`${stale}.sessions`)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('refuses to dial a peer that advertises only unusable addresses', async () => {
  ctx = new Context()
  const discovery = new RecordingDiscoveryHost()
  const service = new LanHandoffService(ctx, {}, { identityRoot: await tempRoot(), discovery })
  await service.ready
  const peerId = brandString<DeviceId>('e'.repeat(20))
  discovery.emit({
    addresses: ['169.254.10.2', 'fe80::1'],
    port: 40123,
    txt: { id: peerId, name: 'link', pf: 'linux', v: '5', vmin: '5' },
  })
  await expect(service.pairWithDiscoveredPeer(peerId)).rejects.toThrow(/no dialable address/u)
})

it('rebinds the remembered listener port on the next start', async () => {
  const root = await tempRoot()
  ctx = new Context()
  const first = new LanHandoffService(ctx, {}, { identityRoot: root, discovery: new RecordingDiscoveryHost() })
  const firstState = await first.ready
  await ctx.fiber.dispose()
  ctx = undefined

  ctx = new Context()
  const second = new LanHandoffService(ctx, {}, { identityRoot: root, discovery: new RecordingDiscoveryHost() })
  const secondState = await second.ready
  expect(secondState.port).toBe(firstState.port)
  await ctx.fiber.dispose()
  ctx = undefined
})

it('binds a configured listener port and leaves the remembered port alone', async () => {
  const root = await tempRoot()
  // Reserve a free port, then release it for the service to bind.
  const reservation = await startLanListener(await loadDeviceIdentity(await tempRoot()), 0, () => undefined, ['127.0.0.1'])
  const port = reservation.port
  await reservation.close()
  ctx = new Context()
  const service = new LanHandoffService(ctx, { port }, { identityRoot: root, discovery: new RecordingDiscoveryHost() })
  const state = await service.ready
  expect(state.port).toBe(port)
  expect(await loadSavedPort(root)).toBeUndefined()
  await ctx.fiber.dispose()
  ctx = undefined
})
