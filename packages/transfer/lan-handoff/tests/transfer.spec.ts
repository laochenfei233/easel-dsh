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
import type { WireMessage } from '../src/frame.ts'
import {
  computeTreeSummary,
  receiveBundle,
  sendBundle,
  TransferCompletionError,
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
  discarded = false

  constructor(readonly startOffset = 0) {}

  write(chunk: Uint8Array): void {
    this.chunks.push(Buffer.from(chunk))
  }

  async commit(): Promise<void> {
    this.committed = true
  }

  async abort(): Promise<void> {
    this.aborted = true
  }

  async discard(): Promise<void> {
    this.discarded = true
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
  expect(() => validateBundleManifest(bad({ protocolVersion: 1 }))).toThrow(/version 1 is not supported/u)
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

  const config = entryRef('config', 'model-config.json', encoder.encode('{"version":1}'))
  expect(validateBundleManifest(manifestOf([config]))).toMatchObject({ entries: [config] })
  expect(() => validateBundleManifest(bad({
    entries: [{ ...config, path: 'nested/doc.json' }],
    treeSummary: computeTreeSummary([{ ...config, path: 'nested/doc.json' }]),
  }))).toThrow(/single path segment/u)
  expect(() => validateBundleManifest(bad({
    mergeIntoExisting: true,
    entries: [config],
    treeSummary: computeTreeSummary([config]),
  }))).toThrow(/config documents/u)

  expect(validateBundleManifest(bad({ sourceRoots: { data: '/data', home: '/home' } })))
    .toMatchObject({ sourceRoots: { data: '/data', home: '/home' } })
  expect(() => validateBundleManifest(bad({ sourceRoots: { data: '' } }))).toThrow(/sourceRoots\.data/u)
  expect(() => validateBundleManifest(bad({ sourceRoots: { home: 7 } }))).toThrow(/sourceRoots\.home/u)
  expect(() => validateBundleManifest(bad({ sourceRoots: 'nope' }))).toThrow(/must be an object/u)
  expect(validateBundleManifest(bad({ sourceRoots: {} }))).not.toHaveProperty('sourceRoots')
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
    const sending = sendBundle(
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
    loop.server.write({ type: 'received', binaryLength: 0 })
    const sent = await sending
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

it('resumes an interrupted entry from the reported byte offset of the receiver', async () => {
  const loop = await loopback()
  try {
    const bytes = encoder.encode('handoff notes')
    const entry = entryRef('file', '素材/notes.txt', bytes)
    const resumed = { kind: 'file' as const, path: entry.path, sha256: entry.sha256, bytes: 8 }
    const sinks: MemorySink[] = []
    const received = receiveBundle(loop.server, {
      decideOffer: async () => ({ accept: true, partial: [resumed] }),
      openEntry: (_candidate, startOffset) => {
        const sink = new MemorySink(startOffset)
        sinks.push(sink)
        return Promise.resolve(sink)
      },
    })
    const offsets: number[] = []
    const sending = sendBundle(loop.client, manifestOf([entry]), async function* (_candidate, startOffset) {
      offsets.push(startOffset)
      yield bytes.subarray(startOffset)
    })
    await received
    loop.server.write({ type: 'received', binaryLength: 0 })
    const sent = await sending
    // Only the tail past the staged bytes streams; the sink appends at the offset.
    expect(offsets).toEqual([8])
    expect(sent.sent).toEqual([entry])
    expect(sent.skipped).toEqual([])
    expect(sinks[0]?.startOffset).toBe(8)
    expect(Buffer.concat(sinks[0]?.chunks ?? []).toString()).toBe('notes')
    expect(sinks[0]?.committed).toBe(true)
  } finally {
    await loop.close()
  }
})

it('refuses a partial report whose byte count is out of range or malformed', async () => {
  const entry = entryRef('file', '素材/notes.txt', encoder.encode('handoff notes'))
  const refuse = async (partial: unknown): Promise<void> => {
    // A channel double answers the offer with the malformed accept directly:
    // the sender's wire validation is what must refuse, before any payload.
    const answer = { type: 'accept', binaryLength: 0, resume: [], partial }
    const sent: WireMessage[] = []
    const channel = {
      write: (message: WireMessage): void => { sent.push(message) },
      next: async () => answer,
      nextFrame: async () => ({ message: answer, binary: new Uint8Array() }),
    } as unknown as ConnectionChannel
    await expect(sendBundle(channel, manifestOf([entry]), async function* () {
      yield encoder.encode('handoff notes')
    })).rejects.toBeInstanceOf(TransferProtocolError)
    // The refusal happens at the accept: no entry was ever announced.
    expect(sent.map(message => message.type)).toEqual(['offer'])
  }
  // A non-list report is refused before any candidate is read.
  await refuse('nope')
  await refuse(null)
  // At or past the entry size, zero, negative, and non-integer counts are out
  // of range; non-object candidates and malformed fields are refused too.
  const candidates: readonly unknown[] = [
    { kind: 'file', path: entry.path, sha256: entry.sha256, bytes: entry.size },
    { kind: 'file', path: entry.path, sha256: entry.sha256, bytes: entry.size + 1 },
    { kind: 'file', path: entry.path, sha256: entry.sha256, bytes: 0 },
    { kind: 'file', path: entry.path, sha256: entry.sha256, bytes: -2 },
    { kind: 'file', path: entry.path, sha256: entry.sha256, bytes: 1.5 },
    { kind: 'file', path: entry.path, sha256: entry.sha256 },
    null,
    42,
    'nope',
    { kind: 7, path: entry.path, sha256: entry.sha256, bytes: 2 },
    { kind: 'file', path: 7, sha256: entry.sha256, bytes: 2 },
    { kind: 'file', path: entry.path, sha256: 7, bytes: 2 },
  ]
  for (const candidate of candidates) await refuse([candidate])
})

it('ignores a partial claim for content the bundle does not carry', async () => {
  const entry = entryRef('file', '素材/notes.txt', encoder.encode('handoff notes'))
  const answers = [
    { type: 'accept', binaryLength: 0, resume: [], partial: [{ kind: 'file', path: 'not-carried.txt', sha256: 'a'.repeat(64), bytes: 2 }] },
    { type: 'received', binaryLength: 0 },
  ]
  const channel = {
    write: (): void => undefined,
    next: async () => answers.shift() ?? { type: 'received', binaryLength: 0 },
    nextFrame: async () => ({ message: { type: 'received', binaryLength: 0 }, binary: new Uint8Array() }),
  } as unknown as ConnectionChannel
  const offsets: number[] = []
  const sent = await sendBundle(channel, manifestOf([entry]), async function* (_candidate, startOffset) {
    offsets.push(startOffset)
    yield encoder.encode('handoff notes')
  })
  // The uncarryable claim granted nothing: the entry streams from zero.
  expect(offsets).toEqual([0])
  expect(sent.sent).toEqual([entry])
  expect(sent.skipped).toEqual([])
})

it('marks a receiver-reported failure retryable only under the retryable prefix', async () => {
  const loop = await loopback()
  try {
    const send = (reason: string): Promise<unknown> => {
      void receiveBundle(loop.server, {
        decideOffer: async () => ({ accept: true }),
        openEntry: async () => new MemorySink(),
      }).then(() => undefined, () => undefined)
      const sending = sendBundle(loop.client, manifestOf([PROJECT_FILE]), async function* () {
        yield encoder.encode('handoff notes')
      })
      void sending.then(() => undefined, () => undefined)
      loop.client.write({ type: 'entry', binaryLength: 0, ...PROJECT_FILE })
      loop.client.write({ type: 'chunk', binaryLength: 13, offset: 0, final: true }, encoder.encode('handoff notes'))
      loop.client.write({ type: 'done', binaryLength: 0 })
      loop.server.write({ type: 'failed', binaryLength: 0, reason })
      return sending
    }
    const retryable = await send('retryable: connection did not advance within 120000 ms').then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(retryable).toBeInstanceOf(TransferCompletionError)
    expect((retryable as TransferCompletionError).retryable).toBe(true)
    expect((retryable as Error).message).toContain('connection did not advance')
    expect((retryable as Error).message).not.toContain('retryable:')

    const fatal = await send('fatal: importing its sessions failed').then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(fatal).toBeInstanceOf(TransferCompletionError)
    expect((fatal as TransferCompletionError).retryable).toBe(false)
    expect((fatal as Error).message).not.toContain('fatal:')
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
    const sending = sendBundle(loop.client, manifestOf([PROJECT_FILE, SESSION_ARCHIVE]), async function* (entry) {
      const bytes = SOURCES.get(`${entry.kind}\u0000${entry.path}`)
      if (bytes !== undefined) yield bytes
    })
    await received
    loop.server.write({ type: 'received', binaryLength: 0 })
    const sent = await sending
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

it('discards the receiving sink when arrived bytes disagree with the manifest', async () => {
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
    // Corrupt bytes must not seed the next resume.
    expect(sinks[0]?.discarded).toBe(true)
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
    const sending = sendBundle(loop.client, manifestOf([PROJECT_FILE]), async function* () {
      yield encoder.encode('handoff notes')
    })
    await received
    loop.server.write({ type: 'received', binaryLength: 0 })
    await sending
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
