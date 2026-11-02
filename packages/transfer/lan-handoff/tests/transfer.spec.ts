/** Bundle transfer: manifest validation, loopback streaming, resume, and integrity refusals. */

import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { expect, it } from 'vitest'
import { loadDeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import { attachChannel, type ConnectionChannel } from '../src/pairing.ts'
import {
  computeTreeSummary,
  receiveBundle,
  sendBundle,
  TransferIntegrityError,
  TransferProtocolError,
  TRANSFER_PROTOCOL_VERSION,
  validateBundleManifest,
  type BundleEntryRef,
  type BundleEntrySink,
  type BundleManifest,
} from '../src/transfer.ts'

/** 64-hex digest of one byte sequence. */
function digestOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** One entry reference over exact bytes. */
function entryRef(kind: BundleEntryRef['kind'], path: string, bytes: Uint8Array): BundleEntryRef {
  return { kind, path, size: bytes.byteLength, sha256: digestOf(bytes) }
}

/** One manifest over the supplied entries. */
function manifestOf(entries: readonly BundleEntryRef[]): BundleManifest {
  return {
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    bundleId: 'bundle-1',
    projectTitle: '项目甲',
    sourceCwd: 'C:\\old\\project',
    entries,
    treeSummary: computeTreeSummary(entries),
  }
}

/** In-memory sink recording the bytes and the outcome. */
class MemorySink implements BundleEntrySink {
  readonly chunks: Uint8Array[] = []
  committed = false
  aborted = false

  write(chunk: Uint8Array): void {
    this.chunks.push(Buffer.from(chunk))
  }

  async commit(): Promise<void> {
    this.committed = true
  }

  async abort(): Promise<void> {
    this.aborted = true
  }
}

const encoder = new TextEncoder()
const PROJECT_FILE = entryRef('file', '素材/notes.txt', encoder.encode('handoff notes'))
const SESSION_ARCHIVE = entryRef('session', 'dsh-session-abc.zip', encoder.encode('PK\u0003\u0004 zip bytes'))
const SOURCES = new Map<string, Uint8Array>([
  ['file\u0000素材/notes.txt', encoder.encode('handoff notes')],
  ['session\u0000dsh-session-abc.zip', encoder.encode('PK\u0003\u0004 zip bytes')],
])

/** One loopback channel pair and its teardown. */
interface Loop {
  readonly client: ConnectionChannel
  readonly server: ConnectionChannel
  readonly close: () => Promise<void>
}

/** Boot one loopback TLS pair with channels on both ends. */
async function loopback(): Promise<Loop> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-transfer-'))
  const identity = await loadDeviceIdentity(root)
  const accepted = Promise.withResolvers<ConnectionChannel>()
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    accepted.resolve(attachChannel(socket))
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  const server = await accepted.promise
  const client = attachChannel(socket)
  return {
    client,
    server,
    close: async () => {
      socket.destroy()
      await listener.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

it('validates manifests fail-closed before any payload moves', () => {
  const manifest = manifestOf([PROJECT_FILE, SESSION_ARCHIVE])
  expect(validateBundleManifest(manifest)).toEqual(manifest)

  const bad = (overrides: Record<string, unknown>): unknown => ({ ...manifest, ...overrides })
  expect(() => validateBundleManifest(bad({ protocolVersion: 2 }))).toThrow(/version 2 is not supported/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...PROJECT_FILE, path: '../escape.txt' }], treeSummary: computeTreeSummary([{ ...PROJECT_FILE, path: '../escape.txt' }]) })))
    .toThrow(/escapes the project directory/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...PROJECT_FILE, path: 'C:\\absolute.txt' }], treeSummary: computeTreeSummary([{ ...PROJECT_FILE, path: 'C:\\absolute.txt' }]) })))
    .toThrow(/is absolute/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...SESSION_ARCHIVE, path: 'nested/archive.zip' }], treeSummary: computeTreeSummary([{ ...SESSION_ARCHIVE, path: 'nested/archive.zip' }]) })))
    .toThrow(/single path segment/u)
  expect(() => validateBundleManifest(bad({ entries: [{ ...PROJECT_FILE, sha256: 'nope' }], treeSummary: computeTreeSummary([{ ...PROJECT_FILE, sha256: 'nope' }]) })))
    .toThrow(/invalid sha256/u)
  expect(() => validateBundleManifest(bad({ entries: [PROJECT_FILE, PROJECT_FILE] })))
    .toThrow(/repeats entry/u)
  expect(() => validateBundleManifest(bad({ treeSummary: { entryCount: 9, totalBytes: 9, sha256: 'f'.repeat(64) } })))
    .toThrow(/does not match its entries/u)
})

it('streams a bundle over loopback and verifies every entry', async () => {
  const loop = await loopback()
  try {
    const sinks = new Map<string, MemorySink>()
    const received = receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: true }),
      openEntry: async (entry) => {
        const sink = new MemorySink()
        sinks.set(entry.path, sink)
        return sink
      },
    })
    const sent = await sendBundle(
      loop.client,
      manifestOf([PROJECT_FILE, SESSION_ARCHIVE]),
      async function* (entry) {
        const bytes = SOURCES.get(`${entry.kind}\u0000${entry.path}`)
        if (bytes === undefined) throw new Error(`missing source for ${entry.path}`)
        yield bytes.subarray(0, 3)
        yield bytes.subarray(3)
      },
    )
    const outcome = await received
    expect(sent.sent.map(entry => entry.path)).toEqual(['素材/notes.txt', 'dsh-session-abc.zip'])
    expect(sent.skipped).toEqual([])
    expect(outcome.entries).toEqual([PROJECT_FILE, SESSION_ARCHIVE])
    for (const entry of [PROJECT_FILE, SESSION_ARCHIVE]) {
      const sink = sinks.get(entry.path)
      expect(sink?.committed).toBe(true)
      expect(Buffer.concat(sink?.chunks ?? [])).toEqual(Buffer.from(SOURCES.get(`${entry.kind}\u0000${entry.path}`) ?? new Uint8Array()))
    }
  } finally {
    await loop.close()
  }
})

it('skips entries the receiver reports complete', async () => {
  const loop = await loopback()
  try {
    const sinks = new Map<string, MemorySink>()
    const received = receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: true, completed: [PROJECT_FILE] }),
      openEntry: async (entry) => {
        const sink = new MemorySink()
        sinks.set(entry.path, sink)
        return sink
      },
    })
    const sent = await sendBundle(loop.client, manifestOf([PROJECT_FILE, SESSION_ARCHIVE]), async function* (entry) {
      const bytes = SOURCES.get(`${entry.kind}\u0000${entry.path}`)
      if (bytes !== undefined) yield bytes
    })
    await received
    expect(sent.skipped).toEqual([PROJECT_FILE])
    expect(sent.sent).toEqual([SESSION_ARCHIVE])
    expect(sinks.has(PROJECT_FILE.path)).toBe(false)
  } finally {
    await loop.close()
  }
})

it('refuses a source whose bytes no longer match the manifest', async () => {
  const loop = await loopback()
  try {
    void receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: true }),
      openEntry: async () => new MemorySink(),
    }).catch(() => undefined)
    await expect(sendBundle(loop.client, manifestOf([PROJECT_FILE]), async function* () {
      yield encoder.encode('tampered bytes')
    })).rejects.toBeInstanceOf(TransferIntegrityError)
  } finally {
    await loop.close()
  }
})

it('aborts the receiving sink when arrived bytes disagree with the manifest', async () => {
  const loop = await loopback()
  try {
    const declared = entryRef('file', 'gone.txt', encoder.encode('expected bytes'))
    const sinks: MemorySink[] = []
    const received = receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: true }),
      openEntry: async () => {
        const sink = new MemorySink()
        sinks.push(sink)
        return sink
      },
    })
    // Same length, different content: only the digest can catch this.
    const sendFailure = sendBundle(loop.client, manifestOf([declared]), async function* () {
      yield encoder.encode('wrong bytes!!!')
    })
    await expect(sendFailure).rejects.toBeInstanceOf(TransferIntegrityError)
    await expect(received).rejects.toBeInstanceOf(TransferIntegrityError)
    expect(sinks[0]?.aborted).toBe(true)
    expect(sinks[0]?.committed).toBe(false)
  } finally {
    await loop.close()
  }
})

it('skips unknown message types instead of failing the connection', async () => {
  const loop = await loopback()
  try {
    const received = receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: true }),
      openEntry: async () => new MemorySink(),
    })
    loop.client.write({ type: 'future/note', binaryLength: 0 })
    await sendBundle(loop.client, manifestOf([PROJECT_FILE]), async function* () {
      yield encoder.encode('handoff notes')
    })
    await received
  } finally {
    await loop.close()
  }
})

it('refuses a chunk sequence that does not continue at the expected offset', async () => {
  const loop = await loopback()
  try {
    const declared = entryRef('file', 'notes.txt', encoder.encode('handoff notes'))
    const received = receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: true }),
      openEntry: async () => new MemorySink(),
    })
    // Hand-rolled sender: correct entry announcement, wrong second offset.
    loop.client.write({ type: 'offer', binaryLength: 0, manifest: manifestOf([declared]) })
    await loop.client.next('accept', 5_000)
    loop.client.write({ type: 'entry', binaryLength: 0, ...declared })
    const first = encoder.encode('handoff ')
    const second = encoder.encode('notes')
    loop.client.write({ type: 'chunk', binaryLength: first.byteLength, offset: 0, final: false }, first)
    loop.client.write({ type: 'chunk', binaryLength: second.byteLength, offset: 99, final: true }, second)
    await expect(received).rejects.toBeInstanceOf(TransferProtocolError)
  } finally {
    await loop.close()
  }
})
