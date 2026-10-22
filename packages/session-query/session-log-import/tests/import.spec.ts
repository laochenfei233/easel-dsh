/**
 * Import integration over real local stores: work-directory remapping,
 * seeded descendants, attachment round trips, collision refusal, and
 * tampered-id refusal.
 */

import { Context } from '@deepseek-ai/cordis'
import { AttachmentId, type FileAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { LocalAttachmentStore } from '@deepseek-ai/dsh-attachment-local'
import { createHash } from 'node:crypto'
import {
  SessionLogOffset,
  type SessionEvent,
  type SessionHeader,
  type SessionId,
} from '@deepseek-ai/dsh-session'
import {
  SessionAlreadyExistsError,
  SessionPersistence,
  SessionPersistenceNotFoundError,
  SessionPersistenceRevision,
  type SessionAccess,
  type SessionHandle,
  type SessionHandleReadResult,
  type SessionPersistenceCreateOptions,
  type SessionPersistenceSnapshot,
} from '@deepseek-ai/dsh-session-persistence'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import { expect, it } from 'vitest'
import {
  SessionImportAttachmentMismatchError,
  SessionImportCollisionError,
} from '../src/errors.ts'
import { SessionLogImporter } from '../src/index.ts'

/** Well-known valid 1x1 PNG; the real image pipeline normalizes it. */
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const encoder = new TextEncoder()

interface StoredRecord {
  readonly header: SessionHeader
  readonly inheritedEventCount: number
  readonly events: SessionEvent[]
}

/** In-memory persistence double implementing the storage contract the import relies on. */
class MemoryPersistence extends SessionPersistence {
  readonly records = new Map<string, StoredRecord>()

  async create(header: SessionHeader, options?: SessionPersistenceCreateOptions): Promise<SessionHandle> {
    if (this.records.has(header.id)) throw new SessionAlreadyExistsError(header.id)
    const record: StoredRecord = {
      header,
      inheritedEventCount: options?.inheritedEventCount ?? 0,
      events: [],
    }
    this.records.set(header.id, record)
    return new MemoryHandle(record, 'write')
  }

  async open(id: SessionId, access: SessionAccess): Promise<SessionHandle> {
    const record = this.records.get(id)
    if (record === undefined) throw new SessionPersistenceNotFoundError(id)
    return new MemoryHandle(record, access)
  }

  async flush(): Promise<void> {
    // Memory records are always durable for this double.
  }

  async stat(id: SessionId): Promise<SessionPersistenceSnapshot | undefined> {
    const record = this.records.get(id)
    return record === undefined ? undefined : snapshotOf(record)
  }

  async list(): Promise<readonly SessionPersistenceSnapshot[]> {
    return [...this.records.values()].map(snapshotOf)
  }
}

/** Snapshot view of one memory record. */
function snapshotOf(record: StoredRecord): SessionPersistenceSnapshot {
  return {
    header: record.header,
    revision: SessionPersistenceRevision(`memory-${record.header.id}`),
  }
}

/** One handle over a memory record. */
class MemoryHandle implements SessionHandle {
  constructor(private readonly record: StoredRecord, readonly access: SessionAccess) {}

  get id(): SessionId {
    return this.record.header.id
  }

  get header(): SessionHeader {
    return this.record.header
  }

  get inheritedEventCount() {
    return SessionLogOffset(this.record.inheritedEventCount)
  }

  async read(offset = 0, length?: number): Promise<SessionHandleReadResult> {
    return {
      eventState: 'detached',
      events: this.record.events.slice(offset, length === undefined ? undefined : offset + length),
    }
  }

  async append(events: readonly SessionEvent[]): Promise<void> {
    const next = this.record.events.length
    for (const [index, event] of events.entries()) {
      if (event.seq !== next + index) throw new Error(`memory handle seq mismatch at ${index}`)
      this.record.events.push(event)
    }
  }

  async flush(): Promise<void> {
    // Memory appends are synchronously stored.
  }

  async close(): Promise<void> {
    // No ownership to release.
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close()
  }
}

/** One valid `turn/start` event line. */
function eventLine(seq: number): string {
  return JSON.stringify({ type: 'turn/start', seq, time: 1_000 + seq, data: { turn: 1 } })
}

/** One inherited seed marker line. */
function seedMarkerLine(seq: number): string {
  return JSON.stringify({ type: 'session/end-seed', seq, time: 1_000 + seq, data: { inherited: true } })
}

/** Canonical header line with overrides applied. */
function headerLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'session',
    version: 4,
    id: 'session-a',
    createdAt: 1_000,
    isSeeded: false,
    delegationDepth: 0,
    ...overrides,
  })
}

/** Canonical log text with a trailing newline. */
function logText(...lines: readonly string[]): string {
  return `${lines.join('\n')}\n`
}

interface Harness {
  readonly importer: SessionLogImporter
  readonly memory: MemoryPersistence
  readonly receiver: LocalAttachmentStore
  readonly sender: LocalAttachmentStore
  readonly hostCtx: Context
  readonly senderCtx: Context
  readonly roots: readonly string[]
}

/** Build a fresh importer host with real local stores on temp roots. */
async function harness(): Promise<Harness> {
  const roots: string[] = []
  const tempRoot = async (): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-session-import-'))
    roots.push(root)
    return root
  }
  const hostCtx = new Context()
  const senderCtx = new Context()
  const memory = new MemoryPersistence(hostCtx)
  const receiver = new LocalAttachmentStore(hostCtx, { dshHome: await tempRoot() })
  const sender = new LocalAttachmentStore(senderCtx, { dshHome: await tempRoot() })
  return {
    importer: new SessionLogImporter(hostCtx),
    memory,
    receiver,
    sender,
    hostCtx,
    senderCtx,
    roots,
  }
}

/** Dispose both contexts and remove the temp roots. */
async function teardown(harnessed: Harness): Promise<void> {
  await harnessed.hostCtx.fiber.dispose()
  await harnessed.senderCtx.fiber.dispose()
  for (const root of harnessed.roots) await rm(root, { recursive: true, force: true })
}

it('imports a root plus a seeded subagent, remaps cwd, and restores attachments', async () => {
  const context = await harness()
  try {
    const image = Uint8Array.from(Buffer.from(PNG_BASE64, 'base64'))
    const senderRef = await context.sender.saveImage({ data: image, mediaType: 'image/png' })
    const stored = await context.sender.readImage(senderRef)
    const fileBytes = encoder.encode('handoff notes')
    const fileDigest = createHash('sha256').update(fileBytes).digest('hex')
    const archive = zipSync({
      'session.v4.jsonl': encoder.encode(logText(headerLine({ cwd: 'C:\\old\\project' }), eventLine(0))),
      'subagents/child/session.v4.jsonl': encoder.encode(logText(
        headerLine({
          id: 'session-child',
          parentSession: 'session-a',
          cwd: 'C:\\old\\project',
          isSeeded: true,
          delegationDepth: 1,
        }),
        eventLine(0),
        seedMarkerLine(1),
      )),
      [`media/${String(senderRef.attachmentId)}.png`]: stored.data,
      [`files/${fileDigest.slice(0, 2)}/${fileDigest}/notes.txt`]: fileBytes,
    }, { level: 0 })

    const result = await context.importer.importArchive(archive, { targetCwd: 'D:\\target\\project' })

    expect(result.root.id).toBe('session-a')
    expect(result.root.header.cwd).toBe('D:\\target\\project')
    expect(result.descendants.map(session => session.id)).toEqual(['session-child'])
    expect(result.descendants[0]?.header).toMatchObject({
      cwd: 'D:\\target\\project',
      parentSession: 'session-a',
      isSeeded: true,
      delegationDepth: 1,
    })
    expect(context.memory.records.get('session-child')?.inheritedEventCount).toBe(1)
    expect(context.memory.records.get('session-a')?.events.map(event => event.seq)).toEqual([0])

    const receivedImage = await context.receiver.readImage(senderRef)
    expect(receivedImage.data).toEqual(stored.data)

    const fileRef: FileAttachmentRef = {
      attachmentId: AttachmentId(`sha256:${fileDigest}`),
      name: 'notes.txt',
      bytes: fileBytes.byteLength,
    }
    const chunks: Uint8Array[] = []
    for await (const chunk of context.receiver.readFileStream(fileRef)) chunks.push(chunk)
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(fileBytes))
  } finally {
    await teardown(context)
  }
})

it('forwards an active cancellation signal through every store call', async () => {
  const context = await harness()
  try {
    const controller = new AbortController()
    const archive = zipSync({ 'session.v4.jsonl': encoder.encode(logText(headerLine(), eventLine(0))) }, { level: 0 })
    const targetCwd = join(tmpdir(), 'dsh-import-signal')
    const result = await context.importer.importArchive(archive, { targetCwd, signal: controller.signal })
    expect(String(result.root.id)).toBe('session-a')
    expect(context.memory.records.get('session-a')?.events).toHaveLength(1)
  } finally {
    await teardown(context)
  }
})

it('refuses a file whose deposited digest differs from the recorded one', async () => {
  const context = await harness()
  try {
    const bytes = encoder.encode('actual bytes')
    const wrongDigest = createHash('sha256').update('other bytes').digest('hex')
    const archive = zipSync({
      'session.v4.jsonl': encoder.encode(logText(headerLine(), eventLine(0))),
      ['files/' + wrongDigest.slice(0, 2) + '/' + wrongDigest + '/notes.txt']: bytes,
    }, { level: 0 })
    const failure = context.importer.importArchive(archive, { targetCwd: join(tmpdir(), 'dsh-import-mismatch') })
    await expect(failure).rejects.toBeInstanceOf(SessionImportAttachmentMismatchError)
    await expect(failure).rejects.toMatchObject({ expected: 'sha256:' + wrongDigest })
  } finally {
    await teardown(context)
  }
})

it('refuses a second import of the same archive as an id collision', async () => {
  const context = await harness()
  try {
    const archive = zipSync({ 'session.v4.jsonl': encoder.encode(logText(headerLine(), eventLine(0))) }, { level: 0 })
    await context.importer.importArchive(archive, { targetCwd: 'D:\\first' })
    await expect(context.importer.importArchive(archive, { targetCwd: 'D:\\second' }))
      .rejects.toBeInstanceOf(SessionImportCollisionError)
  } finally {
    await teardown(context)
  }
})

it('refuses an image whose deposited id differs from the recorded one', async () => {
  const context = await harness()
  try {
    const image = Uint8Array.from(Buffer.from(PNG_BASE64, 'base64'))
    const senderRef = await context.sender.saveImage({ data: image, mediaType: 'image/png' })
    const stored = await context.sender.readImage(senderRef)
    const forged = `sha256:${'0'.repeat(64)}`
    const archive = zipSync({
      'session.v4.jsonl': encoder.encode(logText(headerLine(), eventLine(0))),
      [`media/${forged}.png`]: stored.data,
    }, { level: 0 })
    const failure = context.importer.importArchive(archive, { targetCwd: 'D:\\target' })
    await expect(failure).rejects.toBeInstanceOf(SessionImportAttachmentMismatchError)
    await expect(failure).rejects.toMatchObject({ expected: forged, actual: String(senderRef.attachmentId) })
    expect(context.memory.records.size).toBe(0)
  } finally {
    await teardown(context)
  }
})

it('refuses a relative target directory and a pre-aborted signal', async () => {
  const context = await harness()
  try {
    const archive = zipSync({ 'session.v4.jsonl': encoder.encode(logText(headerLine(), eventLine(0))) }, { level: 0 })
    await expect(context.importer.importArchive(archive, { targetCwd: 'relative\\project' }))
      .rejects.toThrow(/must be an absolute path/u)
    const controller = new AbortController()
    controller.abort()
    await expect(context.importer.importArchive(archive, { targetCwd: 'D:\\target', signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })
  } finally {
    await teardown(context)
  }
})
