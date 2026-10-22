/**
 * Protocol and storage edge coverage: frame refusals, identity/peer read
 * failures, listener exhaustion, and every pairing rejection branch driven
 * over raw loopback sockets.
 */

import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { expect, it } from 'vitest'
import {
  createFrameReader,
  encodeFrame,
  FrameError,
  FRAME_HEADER_MAX_BYTES,
  type WireMessage,
} from '../src/frame.ts'
import { loadDeviceIdentity, type DeviceIdentity } from '../src/identity.ts'
import { loadPairedPeers } from '../src/peers.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import {
  answerPairing,
  attachChannel,
  dialForPairing,
  PairingError,
  PairingIncompatibleError,
  PairingRejectedError,
  pairingIdentityOf,
  type ConnectionChannel,
} from '../src/pairing.ts'

const context: { identity?: DeviceIdentity } = {}

/** One shared identity (RSA minting dominates the suite). */
async function identity(): Promise<DeviceIdentity> {
  if (context.identity === undefined) {
    const root = await mkdtemp(join(tmpdir(), 'dsh-lan-edges-'))
    context.identity = await loadDeviceIdentity(root)
    await rm(root, { recursive: true, force: true })
  }
  return context.identity
}

/** Feed raw bytes through a frame reader and collect delivered messages. */
function decode(bytes: Buffer[], maxHeaderBytes?: number): WireMessage[] {
  const seen: WireMessage[] = []
  const reader = createFrameReader((message) => { seen.push(message) }, maxHeaderBytes)
  for (const chunk of bytes) reader.push(chunk)
  return seen
}

/** One frame header as raw JSON wrapped in the length prefix. */
function rawFrame(headerText: string): Buffer {
  const header = Buffer.from(headerText, 'utf8')
  const prefix = Buffer.alloc(4)
  prefix.writeUInt32BE(header.byteLength, 0)
  return Buffer.concat([prefix, header])
}

it('encodes and decodes zero-length payloads and rejects length disagreements', () => {
  expect(decode([encodeFrame({ type: 'ping', binaryLength: 0 })])).toEqual([{ type: 'ping', binaryLength: 0 }])
  expect(() => encodeFrame({ type: 'ping', binaryLength: 4 })).toThrow(FrameError)
  expect(() => encodeFrame({ type: 'ping', binaryLength: 4 }, new Uint8Array(2))).toThrow(/does not match/u)
})

it('refuses headers over the encoded cap', () => {
  const huge = 'x'.repeat(FRAME_HEADER_MAX_BYTES + 1)
  expect(() => encodeFrame({ type: 'ping', binaryLength: 0, note: huge })).toThrow(/exceeds the cap/u)
})

it('refuses malformed headers with frame errors', () => {
  expect(() => decode([rawFrame('not json')])).toThrow(/not valid JSON/u)
  expect(() => decode([rawFrame('[]')])).toThrow(/not a JSON object/u)
  expect(() => decode([rawFrame('{"binaryLength":0}')])).toThrow(/no type tag/u)
  expect(() => decode([rawFrame('{"type":""}')])).toThrow(/no type tag/u)
  expect(() => decode([rawFrame('{"type":"x"}')])).toThrow(/no valid binaryLength/u)
  expect(() => decode([rawFrame('{"type":"x","binaryLength":"4"}')])).toThrow(/no valid binaryLength/u)
  expect(() => decode([rawFrame('{"type":"x","binaryLength":-1}')])).toThrow(/no valid binaryLength/u)
  expect(() => decode([rawFrame('{"type":"x","binaryLength":1.5}')])).toThrow(/no valid binaryLength/u)
  expect(() => decode([rawFrame('{"type":"x","binaryLength":999999999}')])).toThrow(/exceeds the cap/u)
})

it('refuses zero and oversized length prefixes', () => {
  const zero = Buffer.alloc(4)
  expect(() => decode([zero])).toThrow(/outside 1\./u)
  const header = Buffer.from('{"type":"x","binaryLength":0}', 'utf8')
  const prefix = Buffer.alloc(4)
  prefix.writeUInt32BE(header.byteLength, 0)
  expect(() => decode([Buffer.concat([prefix, header])], header.byteLength - 1)).toThrow(/outside 1\./u)
})

it('refuses a persisted identity path that cannot be read', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-edges-id-'))
  try {
    await mkdir(join(root, 'identity.json'))
    await expect(loadDeviceIdentity(root)).rejects.toMatchObject({ code: 'EISDIR' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('refuses a peers path that cannot be read or is not a peers document', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-edges-peers-'))
  try {
    await mkdir(join(root, 'peers.json'))
    await expect(loadPairedPeers(root)).rejects.toMatchObject({ code: 'EISDIR' })
    await rm(join(root, 'peers.json'), { recursive: true, force: true })
    await writeFile(join(root, 'peers.json'), '42', 'utf8')
    await expect(loadPairedPeers(root)).rejects.toThrow(/not an object/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('fails loudly when every listen host is unusable', async () => {
  const device = await identity()
  await expect(startLanListener(device, 0, () => undefined, ['nonexistent.invalid', 'also.invalid']))
    .rejects.toBeDefined()
})

it('fails a dial to a closed port', async () => {
  const device = await identity()
  const listener = await startLanListener(device, 0, () => undefined, ['127.0.0.1'])
  const port = listener.port
  await listener.close()
  const socket = dialLanPeer({ host: '127.0.0.1', port }, device)
  await expect(once(socket, 'error')).resolves.toBeDefined()
  socket.destroy()
})

interface RawPair {
  readonly client: TLSSocket
  readonly server: Promise<{ socket: TLSSocket; channel: ConnectionChannel; hello: WireMessage }>
  readonly close: () => Promise<void>
}

/** Raw loopback pair reading one hello on the server side. */
async function rawPair(options: { readonly clientIdentity: boolean; readonly timeoutMs?: number }): Promise<RawPair> {
  const server = await identity()
  const client = await identity()
  const accepted = Promise.withResolvers<{ socket: TLSSocket; channel: ConnectionChannel; hello: WireMessage }>()
  const listener = await startLanListener(server, 0, (socket) => {
    const channel = attachChannel(socket)
    void channel.next('hello', 5_000).then(
      hello => accepted.resolve({ socket, channel, hello }),
      error => accepted.reject(error),
    )
  }, ['127.0.0.1'])
  const socket = dialLanPeer(
    { host: '127.0.0.1', port: listener.port },
    options.clientIdentity ? client : undefined,
  )
  return {
    client: socket,
    server: accepted.promise,
    close: async () => {
      socket.destroy()
      await listener.close()
    },
  }
}

it('refuses a peer that presents no certificate', async () => {
  const pair = await rawPair({ clientIdentity: false })
  try {
    attachChannel(pair.client).write({
      type: 'hello',
      binaryLength: 0,
      intent: 'pair',
      device: { name: 'x', platform: 'linux', protocol: { min: 1, max: 1 } },
      nonce: 'a'.repeat(32),
    })
    const { channel, hello } = await pair.server
    const server = await identity()
    await expect(answerPairing(
      (await pair.server).socket,
      hello,
      pairingIdentityOf((await server).deviceId, (await server).cert, 'listener'),
      channel,
    )).rejects.toBeInstanceOf(PairingError)
  } finally {
    await pair.close()
  }
})

it('refuses a hello without a usable device announcement', async () => {
  const pair = await rawPair({ clientIdentity: true })
  try {
    attachChannel(pair.client).write({ type: 'hello', binaryLength: 0, intent: 'pair', nonce: 'a'.repeat(32) })
    const { socket, channel, hello } = await pair.server
    const server = await identity()
    await expect(answerPairing(
      socket, hello, pairingIdentityOf((await server).deviceId, (await server).cert, 'listener'), channel,
    )).rejects.toThrow(/device announcement/u)
  } finally {
    await pair.close()
  }
})

it('refuses a hello with an invalid nonce', async () => {
  const pair = await rawPair({ clientIdentity: true })
  try {
    attachChannel(pair.client).write({
      type: 'hello',
      binaryLength: 0,
      intent: 'pair',
      device: { name: 'x', platform: 'linux', protocol: { min: 1, max: 1 } },
      nonce: 'not-hex',
    })
    const { socket, channel, hello } = await pair.server
    const server = await identity()
    await expect(answerPairing(
      socket, hello, pairingIdentityOf((await server).deviceId, (await server).cert, 'listener'), channel,
    )).rejects.toThrow(/nonce/u)
  } finally {
    await pair.close()
  }
})

it('refuses a hello announcing a protocol range this build cannot speak', async () => {
  const pair = await rawPair({ clientIdentity: true })
  try {
    const client = attachChannel(pair.client)
    client.write({
      type: 'hello',
      binaryLength: 0,
      intent: 'pair',
      device: { name: 'old', platform: 'linux', protocol: { min: 9, max: 9 } },
      nonce: 'a'.repeat(32),
    })
    const { socket, channel, hello } = await pair.server
    const server = await identity()
    await expect(answerPairing(
      socket, hello, pairingIdentityOf((await server).deviceId, (await server).cert, 'listener'), channel,
    )).rejects.toBeInstanceOf(PairingIncompatibleError)
    const rejection = await client.next('reject', 5_000)
    expect(rejection['reason']).toBe('incompatible')
  } finally {
    await pair.close()
  }
})

it('fails the dialing side when the listener announces an incompatible range', async () => {
  const server = await identity()
  const client = await identity()
  const listener = await startLanListener(server, 0, (socket) => {
    const channel = attachChannel(socket)
    void channel.next('hello', 5_000).then(() => {
      channel.write({
        type: 'pairChallenge',
        binaryLength: 0,
        device: { name: 'old', platform: 'linux', protocol: { min: 9, max: 9 } },
        nonce: 'b'.repeat(32),
      })
    })
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, client)
  try {
    await expect(dialForPairing(
      socket,
      pairingIdentityOf((await client).deviceId, (await client).cert, 'dialer'),
    )).rejects.toBeInstanceOf(PairingIncompatibleError)
  } finally {
    socket.destroy()
    await listener.close()
  }
})

it('fails the dialing side when the listener rejects outright', async () => {
  const server = await identity()
  const client = await identity()
  const listener = await startLanListener(server, 0, (socket) => {
    const channel = attachChannel(socket)
    void channel.next('hello', 5_000).then(() => {
      channel.write({ type: 'reject', binaryLength: 0, reason: 'notPaired' })
    })
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, client)
  try {
    const failure = dialForPairing(socket, pairingIdentityOf((await client).deviceId, (await client).cert, 'dialer'))
    await expect(failure).rejects.toBeInstanceOf(PairingRejectedError)
    await expect(failure).rejects.toMatchObject({ remoteReason: 'notPaired' })
  } finally {
    socket.destroy()
    await listener.close()
  }
})

it('settles a pairing once and refuses a second decision', async () => {
  const server = await identity()
  const client = await identity()
  const accepted = Promise.withResolvers<{ socket: TLSSocket; channel: ConnectionChannel; hello: WireMessage }>()
  const listener = await startLanListener(server, 0, (socket) => {
    const channel = attachChannel(socket)
    void channel.next('hello', 5_000).then(hello => accepted.resolve({ socket, channel, hello }))
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, client)
  try {
    const dialed = dialForPairing(socket, pairingIdentityOf((await client).deviceId, (await client).cert, 'dialer'))
    const { socket: serverSocket, channel, hello } = await accepted.promise
    const offer = await answerPairing(
      serverSocket, hello, pairingIdentityOf((await server).deviceId, (await server).cert, 'listener'), channel,
    )
    const dialedOffer = await dialed
    await Promise.all([dialedOffer.accept(), offer.accept()])
    await expect(dialedOffer.accept()).rejects.toThrow(/already settled/u)
    await expect(offer.reject()).resolves.toBeUndefined()
  } finally {
    socket.destroy()
    await listener.close()
  }
})

it('times out a channel wait and refuses writes after failure', async () => {
  const server = await identity()
  const client = await identity()
  const listener = await startLanListener(server, 0, () => undefined, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, client)
  const channel = attachChannel(socket)
  try {
    await expect(channel.next('never', 10)).rejects.toMatchObject({ reason: 'timeout' })
    socket.destroy()
    await once(socket, 'close')
    expect(() => { channel.write({ type: 'ping', binaryLength: 0 }) }).toThrow(PairingError)
  } finally {
    await listener.close()
  }
})
