/** Two-service loopback pairing: SAS equality, mutual persistence, and refusal paths. */

import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LanHandoffService,
  loadPairedPeers,
  PairingRejectedError,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
  type PairingOffer,
} from '../src/index.ts'
import type { LanAdvertisement } from '../src/index.ts'

/** Discovery host that records publications and lets the test inject entries. */
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

interface Device {
  readonly ctx: Context
  readonly service: LanHandoffService
  readonly root: string
  readonly port: number
}

const cleanup: (() => Promise<void>)[] = []

/** Boot one loopback device with a temp identity root. */
async function device(): Promise<Device> {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-pairing-'))
  const service = new LanHandoffService(ctx, { name: 'loopback' }, { identityRoot: root, discovery: new RecordingDiscoveryHost() })
  const state = await service.ready
  cleanup.push(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  return { ctx, service, root, port: state.port }
}

it('pairs two devices over loopback with one shared confirmation string', async () => {
  const alpha = await device()
  const beta = await device()
  const received: PairingOffer[] = []
  beta.service.onPairingRequest((offer) => { received.push(offer) })

  const dialed = await alpha.service.pairWithPeer({ host: '127.0.0.1', port: beta.port })
  await vi.waitFor(() => { expect(received).toHaveLength(1) })
  const answered = received[0]
  if (answered === undefined) throw new Error('no incoming offer recorded')

  expect(dialed.direction).toBe('dialed')
  expect(answered.direction).toBe('received')
  expect(dialed.sas).toBe(answered.sas)
  expect(dialed.sas).toMatch(/^[0-9]{6}$/u)
  expect(String(dialed.peer.id)).toBe(String((await beta.service.ready).deviceId))
  expect(String(answered.peer.id)).toBe(String((await alpha.service.ready).deviceId))

  await Promise.all([dialed.accept(), answered.accept()])

  expect(alpha.service.pairedPeers().map(peer => String(peer.id))).toEqual([String((await beta.service.ready).deviceId)])
  expect(beta.service.pairedPeers().map(peer => String(peer.id))).toEqual([String((await alpha.service.ready).deviceId)])
  const persisted = await loadPairedPeers(beta.root)
  expect([...persisted.keys()]).toEqual([String((await alpha.service.ready).deviceId)])
  expect(persisted.values().next().value).toMatchObject({ name: 'loopback' })
})

it('propagates a decline to the dialing side without persisting anyone', async () => {
  const alpha = await device()
  const beta = await device()
  const received: PairingOffer[] = []
  beta.service.onPairingRequest((offer) => { received.push(offer) })

  const dialed = await alpha.service.pairWithPeer({ host: '127.0.0.1', port: beta.port })
  await vi.waitFor(() => { expect(received).toHaveLength(1) })
  await received[0]?.reject()

  await expect(dialed.accept()).rejects.toBeInstanceOf(PairingRejectedError)
  expect(alpha.service.pairedPeers()).toEqual([])
  expect(beta.service.pairedPeers()).toEqual([])
})

it('declines incoming pairing when no handler is installed', async () => {
  const alpha = await device()
  const beta = await device()

  const dialed = await alpha.service.pairWithPeer({ host: '127.0.0.1', port: beta.port })
  await expect(dialed.accept()).rejects.toBeInstanceOf(PairingRejectedError)
  expect(alpha.service.pairedPeers()).toEqual([])
})

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})
