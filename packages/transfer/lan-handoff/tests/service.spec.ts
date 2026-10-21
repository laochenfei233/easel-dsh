/** Service lifecycle: start state, advertisement, peer browsing, and fiber disposal. */

import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hostname } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import type { DeviceId } from '../src/identity.ts'
import { LanHandoffService, type LanAdvertisement, type LanDiscoveryEntry, type LanDiscoveryHost } from '../src/index.ts'

class RecordingDiscoveryHost implements LanDiscoveryHost {
  readonly published: LanAdvertisement[] = []
  stopped = 0
  disposed = false

  private onUp: ((entry: LanDiscoveryEntry) => void) | undefined

  publish(advertisement: LanAdvertisement): { readonly stop: () => void } {
    this.published.push(advertisement)
    return { stop: () => { this.stopped += 1 } }
  }

  find(_type: string, onUp: (entry: LanDiscoveryEntry) => void): void {
    this.onUp = onUp
  }

  emit(entry: LanDiscoveryEntry): void {
    this.onUp?.(entry)
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
  expect(state.port).toBeGreaterThan(0)
  expect(['::', '0.0.0.0']).toContain(state.host)
  const [advertisement] = discovery.published
  expect(advertisement).toMatchObject({
    name: state.deviceId,
    type: 'easel-handoff',
    port: state.port,
    txt: { id: state.deviceId, name: '测试机', v: '1', vmin: '1' },
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
  discovery.emit({ addresses: ['192.168.1.8'], port: 40123, txt: { id: peerId, name: 'first', pf: 'macos', v: '1', vmin: '1' } })
  discovery.emit({ addresses: ['192.168.1.9'], port: 40124, txt: { id: peerId, name: 'latest', pf: 'macos', v: '1', vmin: '1' } })
  expect(service.peersSnapshot().map(peer => peer.name)).toEqual(['latest'])
  expect(service.peersSnapshot().map(peer => peer.addresses)).toEqual([['192.168.1.9']])
})
