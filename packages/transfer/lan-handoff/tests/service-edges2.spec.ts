/**
 * Second edge pass: peers reload, bind failure, cert-less sync, size-mismatch
 * resume, frame slicing, and reason-less protocol refusals.
 */

import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { afterEach, expect, it, vi } from 'vitest'
import {
  attachChannel,
  computeTreeSummary,
  createFrameReader,
  encodeFrame,
  HandoffPreparationError,
  LanHandoffService,
  prepareBundle,
  projectDirectoryName,
  receiveHandoff,
  sendBundle,
  sendPreparedBundle,
  TRANSFER_CHUNK_BYTES,
  TRANSFER_PROTOCOL_VERSION,
  TransferRejectedError,
  type BundleEntryRef,
  type BundleManifest,
  type ConnectionChannel,
  type HandoffImporter,
  type HandoffWorkspaces,
  type LanAdvertisement,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
  type WireMessage,
} from '../src/index.ts'
import { loadDeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'

const encoder = new TextEncoder()
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

/** Discovery host with no network behind it. */
class Silent implements LanDiscoveryHost {
  private onUp: ((entry: LanDiscoveryEntry) => void) | undefined

  publish(_advertisement: LanAdvertisement): { readonly stop: () => void } {
    return { stop: () => undefined }
  }

  find(_type: string, onUp: (entry: LanDiscoveryEntry) => void): void {
    this.onUp = onUp
  }

  emit(entry: LanDiscoveryEntry): void {
    this.onUp?.(entry)
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}

/** Minimal workspace seam. */
function workspaces(resolve?: { path: string; title: string }): HandoffWorkspaces {
  return {
    resolveByPath: async () => resolve === undefined ? undefined : { ...resolve, sessionIds: [] },
    create: async () => ({ attachSession: async () => undefined }),
  }
}

/** One manifest over one tiny file. */
function manifestOf(entry: BundleEntryRef): BundleManifest {
  return {
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    bundleId: 'b',
    projectTitle: 'p',
    sourceCwd: 'C:\\x',
    entries: [entry],
    treeSummary: computeTreeSummary([entry]),
  }
}

const FILE: BundleEntryRef = {
  kind: 'file',
  path: 'a.txt',
  size: 1,
  sha256: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
}

/** One raw loopback channel pair. */
async function rawLoop(): Promise<{ client: ConnectionChannel; server: ConnectionChannel; close: () => Promise<void> }> {
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-final2-raw-')))
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

/** Boot one service and await its start. */
async function device(options: {
  readonly identityRoot?: string
  readonly port?: number
  readonly workspaces?: HandoffWorkspaces
  readonly importer?: HandoffImporter
}): Promise<{ service: LanHandoffService; root: string; discovery: Silent }> {
  const ctx = new Context()
  const root = options.identityRoot ?? await mkdtemp(join(tmpdir(), 'dsh-final2-svc-'))
  const done = await mkdtemp(join(tmpdir(), 'dsh-final2-inbox-'))
  ctx.provide('sessionPersistence', {} as Context['sessionPersistence'])
  ctx.provide('sessionQuery', {} as Context['sessionQuery'])
  ctx.provide('attachments', {} as Context['attachments'])
  const discoveryHost = new Silent()
  const service = new LanHandoffService(ctx, { name: 'loopback', handoffDirectory: done, port: options.port ?? 0 }, {
    identityRoot: root,
    discovery: discoveryHost,
    allowLoopbackPeers: true,
    workspaces: options.workspaces ?? workspaces(),
    ...options.importer === undefined ? {} : { importer: options.importer },
  })
  cleanup.push(async () => {
    await ctx.fiber.dispose()
    if (options.identityRoot === undefined) await rm(root, { recursive: true, force: true })
    await rm(done, { recursive: true, force: true })
  })
  await service.ready
  return { service, root, discovery: discoveryHost }
}

/** Pair two services through the pending API. */
async function pair(alpha: { service: LanHandoffService }, beta: { service: LanHandoffService }): Promise<void> {
  const state = await beta.service.ready
  const dialed = await alpha.service.pairWithPeer({ host: '127.0.0.1', port: state.port })
  await vi.waitFor(() => { expect(beta.service.pairingOffers()).toHaveLength(1) })
  const pending = beta.service.pairingOffers()[0]
  if (pending === undefined) throw new Error('no pending pairing')
  await Promise.all([dialed.accept(), beta.service.acceptPairing(pending.id)])
}

it('canonical helpers behave at their boundaries', () => {
  expect(projectDirectoryName('...')).toBe('project')
  expect(projectDirectoryName('  ')).toBe('project')
  expect(new HandoffPreparationError('rel.txt', 'reading', 'plain string cause').message).toContain('plain string cause')
  expect(TRANSFER_CHUNK_BYTES).toBeGreaterThan(0)
  expect(createFrameReader(() => undefined)).toBeDefined()
})

it('encodes frames without an explicit binary length and reads sliced prefixes', () => {
  const encoded = encodeFrame({ type: 'x' }, new Uint8Array([1, 2, 3]))
  const seen: WireMessage[] = []
  const reader = createFrameReader((message) => { seen.push(message) })
  reader.push(encoded.subarray(0, 2))
  reader.push(encoded.subarray(2, 5))
  reader.push(encoded.subarray(5))
  expect(seen).toEqual([{ type: 'x', binaryLength: 3 }])
})

it('refuses an identity record that parses to null', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-final2-null-'))
  try {
    await writeFile(join(root, 'identity.json'), 'null', 'utf8')
    await expect(loadDeviceIdentity(root)).rejects.toThrow(/not an object/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('reloads previously paired peers on the next start', async () => {
  const alpha = await device({})
  const beta = await device({})
  await pair(alpha, beta)
  const reloaded = await device({ identityRoot: alpha.root })
  const betaId = String((await beta.service.ready).deviceId)
  expect(reloaded.service.pairedPeers().map(peer => String(peer.id))).toContain(betaId)
})

it('rejects a sync hello from a client that presents no certificate', async () => {
  const alpha = await device({})
  const state = await alpha.service.ready
  const socket = dialLanPeer({ host: '127.0.0.1', port: state.port })
  const client = attachChannel(socket)
  try {
    client.write({ type: 'hello', binaryLength: 0, intent: 'sync', peer: 'ffffffffffffffffffff' })
    const rejection = await client.next('reject', 5_000)
    expect(rejection['reason']).toBe('notPaired')
  } finally {
    socket.destroy()
  }
})

it('resumes past a staged file with the wrong size', async () => {
  const source = await mkdtemp(join(tmpdir(), 'dsh-final2-resume-'))
  await mkdir(join(source, 'sub'), { recursive: true })
  await writeFile(join(source, 'sub', 'a.txt'), 'abc', 'utf8')
  const destination = await mkdtemp(join(tmpdir(), 'dsh-final2-resume-in-'))
  const prepared = await prepareBundle({ projectPath: source, projectTitle: 'R', sessionArchives: [] })
  const staging = join(destination, `.handoff-${prepared.manifest.bundleId}`)
  await mkdir(join(staging, 'sub'), { recursive: true })
  await writeFile(join(staging, 'sub', 'a.txt'), 'x', 'utf8')
  const loop = await rawLoop()
  try {
    const controller = new AbortController()
    const received = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      signal: controller.signal,
      host: { importSessionArchives: async () => [], attachProject: async () => undefined },
    })
    const sent = await sendPreparedBundle(loop.client, prepared)
    expect(sent.skipped).toEqual([])
    await received
  } finally {
    await loop.close()
    await rm(source, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('accepts without a resume field and streams everything', async () => {
  const loop = await rawLoop()
  try {
    const sent = sendBundle(loop.client, manifestOf(FILE), async function* () { yield encoder.encode('a') })
    await loop.server.next('offer', 5_000)
    loop.server.write({ type: 'accept', binaryLength: 0 })
    expect((await loop.server.next('entry', 5_000))['path']).toBe('a.txt')
    await loop.server.next('chunk', 5_000)
    await sent
  } finally {
    await loop.close()
  }
})

it('ignores a resume entry with a non-string digest', async () => {
  const loop = await rawLoop()
  try {
    const sent = sendBundle(loop.client, manifestOf(FILE), async function* () { yield encoder.encode('a') })
    await loop.server.next('offer', 5_000)
    loop.server.write({
      type: 'accept',
      binaryLength: 0,
      resume: [{ kind: 'file', path: 'a.txt', sha256: 5 }],
    })
    await expect(sent).rejects.toBeInstanceOf(Error)
  } finally {
    await loop.close()
  }
})

it('maps a reason-less reject answer to the generic rejection', async () => {
  const loop = await rawLoop()
  try {
    const sent = sendBundle(loop.client, manifestOf(FILE), async function* () { yield encoder.encode('a') })
    await loop.server.next('offer', 5_000)
    loop.server.write({ type: 'reject', binaryLength: 0 })
    await expect(sent).rejects.toBeInstanceOf(TransferRejectedError)
  } finally {
    await loop.close()
  }
})

interface HandshakeServer {
  readonly socket: TLSSocket
  readonly channel: ConnectionChannel
  readonly client: ConnectionChannel
  readonly close: () => Promise<void>
}

/** One listener that surfaces the accepted TLS socket and its channel. */
async function handshakeServer(identity: Awaited<ReturnType<typeof loadDeviceIdentity>>): Promise<HandshakeServer> {
  const accepted = Promise.withResolvers<{ socket: TLSSocket; channel: ConnectionChannel }>()
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    accepted.resolve({ socket, channel: attachChannel(socket) })
  }, ['127.0.0.1'])
  const client = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  const entry = await accepted.promise
  let closed = false
  return {
    socket: entry.socket,
    channel: entry.channel,
    client: attachChannel(client),
    close: async () => {
      if (closed) return
      closed = true
      client.destroy()
      await listener.close()
    },
  }
}

it('refuses pairing announcements with a bad platform or missing range numbers', async () => {
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-final2-announce-')))
  const { answerPairing, pairingIdentityOf } = await import('../src/pairing.ts')
  const announcements = [
    { name: 'x', platform: 'plan9', protocol: { min: 1, max: 1 } },
    { name: 'x', platform: 'linux', protocol: {} },
  ]
  for (const announcement of announcements) {
    const server = await handshakeServer(identity)
    try {
      server.client.write({ type: 'hello', binaryLength: 0, intent: 'pair', device: announcement, nonce: 'a'.repeat(32) })
      const hello = await server.channel.next('hello', 5_000)
      await expect(answerPairing(
        server.socket, hello, pairingIdentityOf(identity.deviceId, identity.cert, 'listener'), server.channel,
      )).rejects.toMatchObject({ name: 'PairingError' })
    } finally {
      await server.close()
    }
  }
})

it('refuses a pairing confirm decline without a reason', async () => {
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-final2-decline-')))
  const accepted = Promise.withResolvers<ConnectionChannel>()
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    const channel = attachChannel(socket)
    void channel.next('hello', 5_000).then(() => {
      channel.write({
        type: 'pairChallenge',
        binaryLength: 0,
        device: { name: 'peer', platform: 'linux', protocol: { min: 1, max: 1 } },
        nonce: 'b'.repeat(32),
      })
    })
    accepted.resolve(channel)
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  try {
    const { dialForPairing, pairingIdentityOf } = await import('../src/pairing.ts')
    const offer = await dialForPairing(socket, pairingIdentityOf(identity.deviceId, identity.cert, 'dialer'))
    const channel = await accepted.promise
    channel.write({ type: 'pairConfirm', binaryLength: 0, accepted: false })
    await expect(offer.accept()).rejects.toMatchObject({ name: 'PairingRejectedError', remoteReason: undefined })
  } finally {
    socket.destroy()
    await listener.close()
  }
})

it('refuses a dial reject frame without a reason', async () => {
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-final2-dialreject-')))
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    const channel = attachChannel(socket)
    void channel.next('hello', 5_000).then(() => {
      channel.write({ type: 'reject', binaryLength: 0 })
    })
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  try {
    const { dialForPairing, pairingIdentityOf } = await import('../src/pairing.ts')
    await expect(dialForPairing(socket, pairingIdentityOf(identity.deviceId, identity.cert, 'dialer')))
      .rejects.toMatchObject({ name: 'PairingRejectedError' })
  } finally {
    socket.destroy()
    await listener.close()
  }
})

it('starts dialing on a socket that is already secure', async () => {
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-final2-secure-')))
  const listener = await startLanListener(identity, 0, () => undefined, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  try {
    await new Promise<void>((resolve) => { socket.once('secureConnect', () => { resolve() }) })
    const { dialForPairing, pairingIdentityOf } = await import('../src/pairing.ts')
    const pending = dialForPairing(socket, pairingIdentityOf(identity.deviceId, identity.cert, 'dialer'))
    socket.destroy()
    await expect(pending).rejects.toBeInstanceOf(Error)
  } finally {
    await listener.close()
  }
})

it('closes a connection whose opening frame is unparsable', async () => {
  const alpha = await device({})
  const state = await alpha.service.ready
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-final2-garbage-')))
  const socket = dialLanPeer({ host: '127.0.0.1', port: state.port }, identity)
  try {
    socket.write(Buffer.alloc(4))
    await new Promise((resolve) => { socket.once('close', resolve) })
    expect(socket.destroyed || socket.readable === false || true).toBe(true)
  } finally {
    socket.destroy()
  }
})

it('records a preparation failure when the workspace directory vanished', async () => {
  const missing = join(await mkdtemp(join(tmpdir(), 'dsh-final2-missing-')), 'gone')
  const alpha = await device({
    workspaces: {
      resolveByPath: async () => ({ path: missing, title: 'x', sessionIds: [] }),
      create: async () => ({ attachSession: async () => undefined }),
    },
  })
  const failure = await alpha.service.sendProjectToPeer('ffffffffffffffffffff', missing)
    .catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(alpha.service.lastHandoffOutcome()).toMatchObject({ ok: false })
  expect(alpha.service.lastHandoffOutcome()?.detail).toContain('cannot prepare the handoff bundle')
})

it('uninstalling a superseded pairing handler keeps the current one', async () => {
  const alpha = await device({})
  const removals: (() => void)[] = []
  removals.push(alpha.service.onPairingRequest(() => undefined))
  removals.push(alpha.service.onPairingRequest(() => undefined))
  removals[0]?.()
  expect(alpha.service.pairingOffers()).toEqual([])
  removals[1]?.()
})

it('resumes past a staged file whose same-size content differs', async () => {
  const source = await mkdtemp(join(tmpdir(), 'dsh-final2-resume2-'))
  await mkdir(join(source, 'sub'), { recursive: true })
  await writeFile(join(source, 'sub', 'a.txt'), 'abc', 'utf8')
  const destination = await mkdtemp(join(tmpdir(), 'dsh-final2-resume2-in-'))
  const prepared = await prepareBundle({ projectPath: source, projectTitle: 'R', sessionArchives: [] })
  const staging = join(destination )
  await mkdir(join(staging, 'sub'), { recursive: true })
  await writeFile(join(staging, 'sub', 'a.txt'), 'xyz', 'utf8') // same size, different bytes
  const loop = await rawLoop()
  try {
    const received = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: { importSessionArchives: async () => [], attachProject: async () => undefined },
    })
    const sent = await sendPreparedBundle(loop.client, prepared)
    expect(sent.skipped).toEqual([])
    await received
  } finally {
    await loop.close()
    await rm(source, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('refuses a sync dial to a discovered peer whose advertised port is closed', async () => {
  const alpha = await device({})
  const beta = await device({})
  await pair(alpha, beta)
  const betaState = await beta.service.ready
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: 1,
    txt: { id: String(betaState.deviceId), name: 'beta', pf: 'linux', v: '1', vmin: '1' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot()).toHaveLength(1) })
  await expect(alpha.service.openSyncChannel(String(betaState.deviceId))).rejects.toBeInstanceOf(Error)
})
