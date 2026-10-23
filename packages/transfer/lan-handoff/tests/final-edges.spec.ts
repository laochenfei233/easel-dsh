/**
 * Final edge pass: every manifest refusal, reason-less refusals both ways,
 * invalid resume lists, service lifecycle failures, and the remaining
 * identity/archive/parse boundaries.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { afterEach, expect, it } from 'vitest'
import {
  attachChannel,
  computeTreeSummary,
  defaultLanHandoffRoot,
  LanHandoffService,
  PairingIncompatibleError,
  receiveBundle,
  sendBundle,
  TransferProtocolError,
  TransferRejectedError,
  TRANSFER_PROTOCOL_VERSION,
  validateBundleManifest,
  type BundleEntryRef,
  type BundleManifest,
  type ConnectionChannel,
  type HandoffSessionExport,
  type HandoffWorkspaces,
  type LanAdvertisement,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
  type LanHandoffStartOptions,
} from '../src/index.ts'
import { loadDeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import { loadPairedPeers } from '../src/peers.ts'

const encoder = new TextEncoder()
const PEER_ID = 'e'.repeat(20)
const FILE: BundleEntryRef = { kind: 'file', path: 'a.txt', size: 1, sha256: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb' }

/** One manifest over the supplied entries. */
function manifestOf(entries: readonly BundleEntryRef[] = [FILE]): BundleManifest {
  return {
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    bundleId: 'b',
    projectTitle: 'p',
    sourceCwd: 'C:\\x',
    entries,
    treeSummary: computeTreeSummary(entries),
  }
}

/** Discovery host with no real network behind it. */
class SilentDiscovery implements LanDiscoveryHost {
  publish(_advertisement: LanAdvertisement): { readonly stop: () => void } {
    return { stop: () => undefined }
  }

  find(_type: string, _onUp: (entry: LanDiscoveryEntry) => void): void {
    // No peers are discovered.
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}

/** Minimal workspace seam resolving nothing. */
const emptyWorkspaces: HandoffWorkspaces = {
  resolveByPath: async () => undefined,
  create: async () => ({ attachSession: async () => undefined }),
}

/** One raw loopback channel pair. */
async function rawLoop(): Promise<{
  readonly client: ConnectionChannel
  readonly server: ConnectionChannel
  readonly close: () => Promise<void>
}> {
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-final-raw-')))
  const accepted = Promise.withResolvers<ConnectionChannel>()
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    accepted.resolve(attachChannel(socket))
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  const server = await accepted.promise
  let closed = false
  return {
    client: attachChannel(socket),
    server,
    close: async () => {
      if (closed) return
      closed = true
      socket.destroy()
      await listener.close()
    },
  }
}

/** An accept-all receiver handler set. */
function receiver(): Parameters<typeof receiveBundle>[1] {
  return {
    decideOffer: async () => ({ accept: true }),
    openEntry: async () => ({ write: () => undefined, commit: async () => undefined, abort: async () => undefined }),
  }
}

it('refuses every malformed manifest field', () => {
  const bad = (overrides: Record<string, unknown>): unknown => ({ ...manifestOf(), ...overrides })
  const entry = (overrides: Record<string, unknown>): Record<string, unknown>[] => [{ ...FILE, ...overrides }]
  expect(() => validateBundleManifest(null)).toThrow(/no manifest object/u)
  expect(() => validateBundleManifest(bad({ bundleId: '' }))).toThrow(/valid bundleId/u)
  expect(() => validateBundleManifest(bad({ bundleId: 'x'.repeat(129) }))).toThrow(/valid bundleId/u)
  expect(() => validateBundleManifest(bad({ projectTitle: '' }))).toThrow(/valid projectTitle/u)
  expect(() => validateBundleManifest(bad({ projectTitle: 'x'.repeat(257) }))).toThrow(/valid projectTitle/u)
  expect(() => validateBundleManifest(bad({ sourceCwd: '' }))).toThrow(/no sourceCwd/u)
  expect(() => validateBundleManifest(bad({ entries: {} }))).toThrow(/no entries list/u)
  expect(() => validateBundleManifest(bad({ entries: [null] }))).toThrow(/entry is not an object/u)
  expect(() => validateBundleManifest(bad({ entries: entry({ kind: 'disk' }) }))).toThrow(/kind disk is unknown/u)
  expect(() => validateBundleManifest(bad({ entries: entry({ path: 4 }) }))).toThrow(/no path/u)
  expect(() => validateBundleManifest(bad({ entries: entry({ size: -1 }) }))).toThrow(/invalid size/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...FILE, path: '' }] }))).toThrow(/path length/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...FILE, path: 'a\u0000b' }] }))).toThrow(/control bytes/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...FILE, path: 'a//b' }] }))).toThrow(/empty or dot segment/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...FILE, path: './a' }] }))).toThrow(/empty or dot segment/u)
  expect(() => validateBundleManifest(bad({ treeSummary: null }))).toThrow(/no treeSummary/u)
  expect(() => validateBundleManifest(bad({ treeSummary: { entryCount: 1 } }))).toThrow(/treeSummary is incomplete/u)
})

it('maps a reason-less bundle refusal to the generic message', () => {
  expect(new TransferRejectedError(undefined).message).toContain('declined the bundle')
  expect(new TransferRejectedError('full').message).toContain('(full)')
})

it('refuses non-list, null-entry, and incomplete resume claims', async () => {
  const attempts: readonly unknown[] = ['nope', [null], [{ kind: 'file' }]]
  for (const resume of attempts) {
    const loop = await rawLoop()
    try {
      const sent = sendBundle(loop.client, manifestOf(), async function* () { yield encoder.encode('a') })
      const offer = await loop.server.next('offer', 5_000)
      expect(offer.type).toBe('offer')
      loop.server.write({ type: 'accept', binaryLength: 0, resume })
      await expect(sent).rejects.toBeInstanceOf(TransferProtocolError)
    } finally {
      await loop.close()
    }
  }
})

it('ignores resume claims for content the bundle does not carry', async () => {
  const loop = await rawLoop()
  try {
    const sent = sendBundle(loop.client, manifestOf(), async function* () { yield encoder.encode('a') })
    await loop.server.next('offer', 5_000)
    loop.server.write({
      type: 'accept',
      binaryLength: 0,
      resume: [{ kind: 'file', path: 'other.txt', sha256: 'b'.repeat(64) }],
    })
    const entry = await loop.server.next('entry', 5_000)
    expect(entry['path']).toBe('a.txt')
    const chunk = await loop.server.nextFrame('chunk', 5_000)
    expect(chunk.binary.byteLength).toBe(1)
    await sent
  } finally {
    await loop.close()
  }
})

it('refuses an entry announced outside the manifest and an incomplete announcement', async () => {
  const outside = await rawLoop()
  try {
    const received = receiveBundle(outside.server, receiver())
    outside.client.write({ type: 'offer', binaryLength: 0, manifest: manifestOf() })
    await outside.client.next('accept', 5_000)
    outside.client.write({ type: 'entry', binaryLength: 0, kind: 'file', path: 'other.txt', size: 1, sha256: 'b'.repeat(64) })
    await expect(received).rejects.toBeInstanceOf(TransferProtocolError)
  } finally {
    await outside.close()
  }

  const incomplete = await rawLoop()
  try {
    const received = receiveBundle(incomplete.server, receiver())
    incomplete.client.write({ type: 'offer', binaryLength: 0, manifest: manifestOf() })
    await incomplete.client.next('accept', 5_000)
    incomplete.client.write({ type: 'entry', binaryLength: 0, kind: 'file' })
    await expect(received).rejects.toBeInstanceOf(TransferProtocolError)
  } finally {
    await incomplete.close()
  }
})

it('declines without a reason when the offer decision carries none', async () => {
  const loop = await rawLoop()
  try {
    const received = receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: false }),
      openEntry: async () => ({ write: () => undefined, commit: async () => undefined, abort: async () => undefined }),
    })
    const sent = sendBundle(loop.client, manifestOf(), async function* () { yield encoder.encode('a') })
    await expect(sent).rejects.toBeInstanceOf(TransferRejectedError)
    await expect(received).rejects.toBeInstanceOf(TransferRejectedError)
  } finally {
    await loop.close()
  }
})

it('refuses a final chunk whose bytes total less than the announced size', async () => {
  const loop = await rawLoop()
  try {
    const declared: BundleEntryRef = { kind: 'file', path: 'a.txt', size: 5, sha256: 'a'.repeat(64) }
    const received = receiveBundle(loop.server, receiver())
    loop.client.write({ type: 'offer', binaryLength: 0, manifest: manifestOf([declared]) })
    await loop.client.next('accept', 5_000)
    loop.client.write({ type: 'entry', binaryLength: 0, ...declared })
    loop.client.write({ type: 'chunk', binaryLength: 1, offset: 0, final: true }, encoder.encode('a'))
    await expect(received).rejects.toMatchObject({ name: 'TransferIntegrityError' })
  } finally {
    await loop.close()
  }
})

it('resolves the default handoff root under the harness home', () => {
  expect(defaultLanHandoffRoot()).toMatch(/lan-handoff$/u)
})

it('refuses peers records with a null entry or an unknown platform', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-final-peers-'))
  try {
    await writeFile(join(root, 'peers.json'), JSON.stringify({ version: 1, peers: [null] }), 'utf8')
    await expect(loadPairedPeers(root)).rejects.toThrow(/non-object entry/u)
    await writeFile(join(root, 'peers.json'), JSON.stringify({
      version: 1,
      peers: [{ id: PEER_ID, name: 'x', platform: 'solaris', pairedAt: 1 }],
    }), 'utf8')
    await expect(loadPairedPeers(root)).rejects.toThrow(/invalid entry/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('describes an incompatible pairing without a peer range', () => {
  expect(new PairingIncompatibleError(undefined).message).toContain('no protocol version')
})

interface TestDevice {
  readonly service: LanHandoffService
  readonly root: string
}

const deviceCleanup: (() => Promise<void>)[] = []

/** Boot one service with silent discovery and stub storage services. */
async function testDevice(options?: {
  readonly workspaces?: HandoffWorkspaces
  readonly sessionExport?: HandoffSessionExport
}): Promise<TestDevice> {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'dsh-final-svc-'))
  const handoffDirectory = await mkdtemp(join(tmpdir(), 'dsh-final-inbox-'))
  ctx.provide('sessionPersistence', {} as Context['sessionPersistence'])
  ctx.provide('sessionQuery', {} as Context['sessionQuery'])
  ctx.provide('attachments', {} as Context['attachments'])
  const startOptions: LanHandoffStartOptions = {
    identityRoot: root,
    discovery: new SilentDiscovery(),
    workspaces: options?.workspaces ?? emptyWorkspaces,
    ...options?.sessionExport === undefined ? {} : { sessionExport: options.sessionExport },
  }
  const service = new LanHandoffService(ctx, { name: 'loopback', handoffDirectory }, startOptions)
  await service.ready
  deviceCleanup.push(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
    await rm(handoffDirectory, { recursive: true, force: true })
  })
  return { service, root }
}

it('awaits its init hook and uninstalls a pairing handler', async () => {
  const device = await testDevice()
  await expect(device.service[Service.init]()).resolves.toBeUndefined()
  const removed = device.service.onPairingRequest(() => undefined)
  removed()
  expect(device.service.pairingOffers()).toEqual([])
})

it('fails a dial to a closed port', async () => {
  const device = await testDevice()
  await expect(device.service.pairWithPeer({ host: '127.0.0.1', port: 1 })).rejects.toBeInstanceOf(Error)
})

it('refuses a session that has no stored log', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-final-src-'))
  await writeFile(join(projectRoot, 'a.txt'), 'a', 'utf8')
  const device = await testDevice({
    workspaces: {
      resolveByPath: async () => ({ path: projectRoot, title: 'x', sessionIds: [SessionId('s1')] }),
      create: async () => ({ attachSession: async () => undefined }),
    },
    sessionExport: {
      flush: async () => undefined,
      readLog: async () => undefined,
      zip: async () => new Uint8Array(),
    },
  })
  try {
    await expect(device.service.sendProjectToPeer(PEER_ID, projectRoot)).rejects.toThrow(/no stored log/u)
  } finally {
    await rm(projectRoot, { recursive: true, force: true })
  }
})

it('records non-Error send failures in the last outcome', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-final-src2-'))
  await writeFile(join(projectRoot, 'a.txt'), 'a', 'utf8')
  const device = await testDevice({
    workspaces: {
      resolveByPath: async () => ({ path: projectRoot, title: '', sessionIds: [SessionId('s1')] }),
      create: async () => ({ attachSession: async () => undefined }),
    },
    sessionExport: {
      flush: async () => undefined,
      readLog: async () => 'log',
      zip: async () => {
        // A non-Error throw must still be readable in the recorded outcome.
        throw 'zip exploded'
      },
    },
  })
  try {
    const failure = await device.service.sendProjectToPeer(PEER_ID, projectRoot).catch((error: unknown) => error)
    expect(failure).toBe('zip exploded')
    expect(device.service.lastHandoffOutcome()).toMatchObject({ ok: false, detail: 'zip exploded' })
  } finally {
    await rm(projectRoot, { recursive: true, force: true })
  }
})

afterEach(async () => {
  for (const dispose of deviceCleanup.splice(0).reverse()) await dispose()
})
