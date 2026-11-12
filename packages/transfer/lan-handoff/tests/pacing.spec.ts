/** Channel write pacing: a bulk sender waits for the socket's flush instead of queueing its payload in memory. */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { afterEach, expect, it } from 'vitest'
import { loadDeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import { attachChannel, ChannelClosedError, type ConnectionChannel } from '../src/pairing.ts'

const teardown: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of teardown.splice(0).reverse()) await dispose()
})

/** One loopback pair whose server side stays raw, so the test controls when bytes are consumed. */
async function rawPair(): Promise<{ readonly client: ConnectionChannel; readonly clientSocket: TLSSocket; readonly server: TLSSocket }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-pacing-'))
  const identity = await loadDeviceIdentity(root)
  const accepted = Promise.withResolvers<TLSSocket>()
  const listener = await startLanListener(identity, 0, socket => { accepted.resolve(socket) }, ['127.0.0.1'])
  const clientSocket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  const server = await accepted.promise
  teardown.push(async () => {
    clientSocket.destroy()
    server.destroy()
    await listener.close()
    await rm(root, { recursive: true, force: true })
  })
  return { client: attachChannel(clientSocket), clientSocket, server }
}

/** Whether the paced write settled within a tick of the event loop. */
async function settledWithin(pending: Promise<void>): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  const tick = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 100) })
  try {
    return await Promise.race([pending.then(() => true), tick])
  } finally {
    clearTimeout(timer)
  }
}

const PAYLOAD = new Uint8Array(256 * 1024)

/** A paced write still waiting after a tick. The wrapper keeps the pending promise out of
    the helper's own `return`, which would adopt it and suspend the helper forever. */
interface HeldFrame {
  readonly pending: Promise<void>
}

/** Write paced frames until one is still waiting after a tick, and return that pending write. */
async function firstHeldFrame(client: ConnectionChannel): Promise<HeldFrame> {
  for (let index = 0; index < 4000; index += 1) {
    const pending = client.writeAwaited(
      { type: 'chunk', binaryLength: PAYLOAD.byteLength, offset: 0, final: false },
      PAYLOAD,
    )
    if (!(await settledWithin(pending))) return { pending }
  }
  throw new Error('the socket never reported backpressure')
}

it('resolves a paced frame without waiting while the socket accepts it', async () => {
  const { client } = await rawPair()
  const pending = client.writeAwaited({ type: 'chunk', binaryLength: 8, offset: 0, final: false }, new Uint8Array(8))
  await expect(settledWithin(pending)).resolves.toBe(true)
  await expect(pending).resolves.toBeUndefined()
})

it('holds a bulk frame until the peer consumes, then resolves it', async () => {
  const { client, server } = await rawPair()
  server.pause()
  const held = await firstHeldFrame(client)
  await expect(settledWithin(held.pending)).resolves.toBe(false)
  server.resume()
  await expect(held.pending).resolves.toBeUndefined()
})

it('rejects a held frame when the connection closes while it waits', async () => {
  const { client, server } = await rawPair()
  server.pause()
  const held = await firstHeldFrame(client)
  server.destroy()
  await expect(held.pending).rejects.toBeInstanceOf(ChannelClosedError)
})

it('rejects a held frame when the socket errors while it waits, then refuses later writes', async () => {
  const { client, clientSocket, server } = await rawPair()
  server.pause()
  const held = await firstHeldFrame(client)
  clientSocket.destroy(new Error('boom'))
  // The 'error' event settles the write; the follow-up 'close' reaches the
  // already-settled guard on the next event-loop turn.
  await new Promise(resolve => { setTimeout(resolve, 50) })
  await expect(held.pending).rejects.toBeInstanceOf(ChannelClosedError)
  // The channel latched the drop: later paced writes reject without touching the socket.
  await expect(client.writeAwaited({ type: 'chunk', binaryLength: 0, offset: 0, final: true })).rejects.toBeInstanceOf(ChannelClosedError)
})
