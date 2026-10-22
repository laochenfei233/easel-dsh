/**
 * Bundle transfer over an authenticated channel: manifest offer, per-entry
 * streaming with whole-entry SHA-256 verification, and file-level resume.
 *
 * Both sides speak the same frame channel (u32 JSON header + declared binary
 * payload). Unknown message types are skipped by the channel, so a newer peer
 * adding messages never breaks an older one. Resume is at entry granularity:
 * the receiver reports entries it already holds complete, and the sender
 * skips them.
 * @module @deepseek-ai/dsh-lan-handoff/transfer
 */

import { createHash } from 'node:crypto'
import { isAbsolute } from 'node:path'
import type { ConnectionChannel } from './pairing.ts'
import type { WireMessage } from './frame.ts'

/** Version of the transfer message vocabulary. */
export const TRANSFER_PROTOCOL_VERSION = 1

/** Bytes of payload per `chunk` message. */
export const TRANSFER_CHUNK_BYTES = 256 * 1024

/** Which part of a bundle one entry belongs to. */
export type BundleEntryKind = 'file' | 'session'

/** One file carried by a bundle: a project file (relative path) or a session archive. */
export interface BundleEntryRef {
  /** Entry kind: project file or session archive. */
  readonly kind: BundleEntryKind
  /** Project-relative path for files; archive file name for sessions. */
  readonly path: string
  /** Exact byte length. */
  readonly size: number
  /** 64-hex SHA-256 of the exact bytes. */
  readonly sha256: string
}

/** Aggregate identity of every entry in one bundle. */
export interface BundleTreeSummary {
  /** Number of entries. */
  readonly entryCount: number
  /** Sum of entry sizes. */
  readonly totalBytes: number
  /** SHA-256 over the canonical entry lines, sorted. */
  readonly sha256: string
}

/** One handoff bundle's manifest. */
export interface BundleManifest {
  /** Transfer protocol version the sender speaks. */
  readonly protocolVersion: number
  /** Stable bundle identity (random per send). */
  readonly bundleId: string
  /** Project title to create on the receiving device. */
  readonly projectTitle: string
  /** The sending device's project directory, for reporting only. */
  readonly sourceCwd: string
  /** Every carried entry. */
  readonly entries: readonly BundleEntryRef[]
  /** Aggregate identity computed from {@link BundleManifest.entries}. */
  readonly treeSummary: BundleTreeSummary
}

/** Failure: the manifest or a streamed entry violates the protocol. */
export class TransferProtocolError extends Error {
  /**
   * @param reason - what violated the protocol.
   */
  constructor(reason: string) {
    super(`LAN handoff transfer protocol: ${reason}`)
    this.name = 'TransferProtocolError'
  }
}

/** Failure: the peer declined the bundle. */
export class TransferRejectedError extends Error {
  /**
   * @param reason - the peer's own reason, when it sent one.
   */
  constructor(readonly reason: string | undefined) {
    super(reason === undefined ? 'the receiving device declined the bundle' : `the receiving device declined the bundle (${reason})`)
    this.name = 'TransferRejectedError'
  }
}

/** Failure: streamed bytes disagree with the manifest's recorded SHA-256 or size. */
export class TransferIntegrityError extends Error {
  /**
   * @param path - the entry that failed verification.
   * @param expected - the manifest's recorded digest.
   * @param actual - the digest of the bytes that arrived (or the size mismatch description).
   */
  constructor(readonly path: string, readonly expected: string, readonly actual: string) {
    super(`entry "${path}" failed integrity verification: expected ${expected}, received ${actual}`)
    this.name = 'TransferIntegrityError'
  }
}

/** Key identifying one entry across reconnects. */
function entryKey(entry: BundleEntryRef): string {
  return `${entry.kind}\u0000${entry.path}\u0000${entry.sha256}`
}

/**
 * Canonical aggregate hash of a bundle's entries.
 * @param entries - every entry, in any order.
 * @returns the aggregate summary.
 */
export function computeTreeSummary(entries: readonly BundleEntryRef[]): BundleTreeSummary {
  const lines = entries
    .map(entry => `${entry.kind}\u0000${entry.path}\u0000${String(entry.size)}\u0000${entry.sha256}`)
    .sort()
  const hash = createHash('sha256')
  for (const line of lines) hash.update(`${line}\n`)
  return {
    entryCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.size, 0),
    sha256: hash.digest('hex'),
  }
}

/** Digest shape accepted anywhere a SHA-256 appears on the wire. */
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u

/**
 * Validate one entry path for its kind.
 * @param kind - entry kind.
 * @param path - the received path.
 * @throws {TransferProtocolError} for absolute paths, traversal, empty names, or control bytes.
 */
function assertSafePath(kind: BundleEntryKind, path: string): void {
  if (path.length === 0 || path.length > 1024) throw new TransferProtocolError(`entry path length is invalid (${String(path.length)})`)
  if (path.includes('\u0000') || /[\u0000-\u001f\u007f]/u.test(path)) throw new TransferProtocolError(`entry path "${path}" contains control bytes`)
  if (isAbsolute(path) || /^[A-Za-z]:/u.test(path) || path.startsWith('\\\\')) {
    throw new TransferProtocolError(`entry path "${path}" is absolute; bundles carry project-relative paths only`)
  }
  const segments = path.split(/[\\/]/u)
  if (segments.some(segment => segment === '..')) {
    throw new TransferProtocolError(`entry path "${path}" escapes the project directory`)
  }
  if (segments.some(segment => segment === '' || segment === '.')) {
    throw new TransferProtocolError(`entry path "${path}" has an empty or dot segment`)
  }
  if (kind === 'session' && segments.length !== 1) {
    throw new TransferProtocolError(`session archive name "${path}" must be a single path segment`)
  }
}

/**
 * Validate one received manifest fail-closed before any payload is accepted.
 * @param candidate - the raw offer payload.
 * @returns the validated manifest.
 * @throws {TransferProtocolError} for any structural, version, or path violation.
 */
export function validateBundleManifest(candidate: unknown): BundleManifest {
  if (typeof candidate !== 'object' || candidate === null) throw new TransferProtocolError('offer carries no manifest object')
  const record = candidate as Record<string, unknown>
  const protocolVersion = record['protocolVersion']
  if (protocolVersion !== TRANSFER_PROTOCOL_VERSION) {
    throw new TransferProtocolError(`bundle protocol version ${String(protocolVersion)} is not supported (expected ${TRANSFER_PROTOCOL_VERSION})`)
  }
  const bundleId = record['bundleId']
  const projectTitle = record['projectTitle']
  const sourceCwd = record['sourceCwd']
  const entriesRaw = record['entries']
  const treeRaw = record['treeSummary']
  if (typeof bundleId !== 'string' || bundleId.length === 0 || bundleId.length > 128) throw new TransferProtocolError('manifest has no valid bundleId')
  if (typeof projectTitle !== 'string' || projectTitle.length === 0 || projectTitle.length > 256) throw new TransferProtocolError('manifest has no valid projectTitle')
  if (typeof sourceCwd !== 'string' || sourceCwd.length === 0) throw new TransferProtocolError('manifest has no sourceCwd')
  if (!Array.isArray(entriesRaw)) throw new TransferProtocolError('manifest has no entries list')
  const seen = new Set<string>()
  const entries: BundleEntryRef[] = []
  for (const raw of entriesRaw as readonly unknown[]) {
    if (typeof raw !== 'object' || raw === null) throw new TransferProtocolError('manifest entry is not an object')
    const entry = raw as Record<string, unknown>
    const kind = entry['kind']
    const path = entry['path']
    const size = entry['size']
    const sha256 = entry['sha256']
    if (kind !== 'file' && kind !== 'session') throw new TransferProtocolError(`manifest entry kind ${String(kind)} is unknown`)
    if (typeof path !== 'string') throw new TransferProtocolError('manifest entry has no path')
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) throw new TransferProtocolError(`manifest entry "${path}" has an invalid size`)
    if (typeof sha256 !== 'string' || !DIGEST_PATTERN.test(sha256)) throw new TransferProtocolError(`manifest entry "${path}" has an invalid sha256`)
    assertSafePath(kind, path)
    const key = entryKey({ kind, path, size, sha256 })
    if (seen.has(key)) throw new TransferProtocolError(`manifest repeats entry "${path}"`)
    seen.add(key)
    entries.push({ kind, path, size, sha256 })
  }
  if (typeof treeRaw !== 'object' || treeRaw === null) throw new TransferProtocolError('manifest has no treeSummary')
  const tree = treeRaw as Record<string, unknown>
  const entryCount = tree['entryCount']
  const totalBytes = tree['totalBytes']
  const treeSha = tree['sha256']
  if (typeof entryCount !== 'number' || typeof totalBytes !== 'number' || typeof treeSha !== 'string') {
    throw new TransferProtocolError('manifest treeSummary is incomplete')
  }
  const computed = computeTreeSummary(entries)
  if (computed.entryCount !== entryCount || computed.totalBytes !== totalBytes || computed.sha256 !== treeSha) {
    throw new TransferProtocolError('manifest treeSummary does not match its entries')
  }
  return {
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    bundleId,
    projectTitle,
    sourceCwd,
    entries,
    treeSummary: computed,
  }
}

/** Sender-side source for one entry's bytes. */
export type BundleEntryReader = (entry: BundleEntryRef) => AsyncIterable<Uint8Array>

/** Outcome of sending one bundle. */
export interface SentBundle {
  /** Entries the receiver already held complete. */
  readonly skipped: readonly BundleEntryRef[]
  /** Entries streamed in this session. */
  readonly sent: readonly BundleEntryRef[]
}

/**
 * Offer and stream one bundle.
 *
 * Waits for the receiver's acceptance, skips entries it reports complete,
 * streams every other entry as `entry` + `chunk` messages, and verifies each
 * source's bytes against the manifest while streaming (a source that changed
 * after the manifest aborts the transfer instead of shipping a lie).
 * @param channel - the authenticated connection channel.
 * @param manifest - the validated manifest (computed by the caller).
 * @param readEntry - source of one entry's bytes in order.
 * @param signal - optional cancellation.
 * @returns which entries were skipped and which were streamed.
 * @throws {TransferRejectedError} when the receiver declines.
 * @throws {TransferIntegrityError} when a source no longer matches the manifest.
 * @throws {TransferProtocolError} when the receiver's resume list is invalid.
 */
export async function sendBundle(
  channel: ConnectionChannel,
  manifest: BundleManifest,
  readEntry: BundleEntryReader,
  signal?: AbortSignal,
): Promise<SentBundle> {
  signal?.throwIfAborted()
  channel.write({ type: 'offer', binaryLength: 0, manifest })
  const answer = await channel.next(['accept', 'reject'], 120_000)
  if (answer.type === 'reject') throw new TransferRejectedError(typeof answer['reason'] === 'string' ? answer['reason'] : undefined)
  const completed = parseResumeList(answer['resume'], manifest)
  const skipped: BundleEntryRef[] = []
  const sent: BundleEntryRef[] = []
  for (const entry of manifest.entries) {
    signal?.throwIfAborted()
    if (completed.has(entryKey(entry))) {
      skipped.push(entry)
      continue
    }
    channel.write({ type: 'entry', binaryLength: 0, kind: entry.kind, path: entry.path, size: entry.size, sha256: entry.sha256 })
    await streamEntry(channel, entry, readEntry(entry), signal)
    sent.push(entry)
  }
  channel.write({ type: 'done', binaryLength: 0 })
  return { skipped, sent }
}

/**
 * Validate the receiver's resume list against the manifest.
 * @param raw - the resume field from the accept message.
 * @param manifest - the offered manifest.
 * @returns keys of entries the receiver already holds.
 */
function parseResumeList(raw: unknown, manifest: BundleManifest): Set<string> {
  if (raw === undefined) return new Set()
  if (!Array.isArray(raw)) throw new TransferProtocolError('accept carries a non-list resume field')
  const known = new Set(manifest.entries.map(entryKey))
  const completed = new Set<string>()
  for (const candidate of raw as readonly unknown[]) {
    if (typeof candidate !== 'object' || candidate === null) throw new TransferProtocolError('resume entry is not an object')
    const entry = candidate as Record<string, unknown>
    const kind = entry['kind']
    const path = entry['path']
    const sha256 = entry['sha256']
    /* v8 ignore start -- short-circuit attribution: the refusal path is asserted through the incomplete-resume test */
    if ((kind !== 'file' && kind !== 'session') || typeof path !== 'string' || typeof sha256 !== 'string') {
      throw new TransferProtocolError('resume entry is incomplete')
    }
    /* v8 ignore stop */
    const key = entryKey({ kind, path, size: 0, sha256 })
    // A resume claim for content the bundle does not carry grants nothing.
    if (known.has(key)) completed.add(key)
  }
  return completed
}

/**
 * Stream one entry as chunk frames and verify it against the manifest.
 * @param channel - the connection channel.
 * @param entry - the manifest entry.
 * @param source - the entry's bytes.
 * @param signal - optional cancellation.
 */
async function streamEntry(
  channel: ConnectionChannel,
  entry: BundleEntryRef,
  source: AsyncIterable<Uint8Array>,
  signal?: AbortSignal,
): Promise<void> {
  const hash = createHash('sha256')
  let offset = 0
  for await (const chunk of source) {
    signal?.throwIfAborted()
    hash.update(chunk)
    let at = 0
    while (at < chunk.byteLength) {
      const end = Math.min(at + TRANSFER_CHUNK_BYTES, chunk.byteLength)
      const piece = chunk.subarray(at, end)
      channel.write({
        type: 'chunk',
        binaryLength: piece.byteLength,
        offset,
        final: offset + piece.byteLength === entry.size,
      }, piece)
      offset += piece.byteLength
      at = end
    }
  }
  if (offset === 0 && entry.size === 0) {
    channel.write({ type: 'chunk', binaryLength: 0, offset: 0, final: true })
  }
  if (offset !== entry.size) throw new TransferIntegrityError(entry.path, `size ${String(entry.size)}`, `size ${String(offset)}`)
  const digest = hash.digest('hex')
  if (digest !== entry.sha256) throw new TransferIntegrityError(entry.path, entry.sha256, digest)
}

/** Receiver-side sink for one entry's bytes. */
export interface BundleEntrySink {
  /**
   * Accept the next bytes of the entry, in order.
   * @param chunk - the next piece.
   */
  write(chunk: Uint8Array): Promise<void> | void
  /** The entry arrived complete and verified; publish it. */
  commit(): Promise<void>
  /** The entry cannot be completed; discard partial state. */
  abort(): Promise<void>
}

/** One receiver's answer to an offered bundle. */
export interface OfferDecision {
  /** Whether to receive this bundle. */
  readonly accept: boolean
  /** Decline reason sent to the sender when refusing. */
  readonly reason?: string
  /** Entries the receiver already holds complete. */
  readonly completed?: readonly BundleEntryRef[]
}

/** Receiver-side decisions for one offered bundle. */
export interface ReceiveBundleHandlers {
  /**
   * Decide whether to accept the offer.
   * @param manifest - the validated manifest.
   * @returns acceptance, an optional decline reason, and the entries already held complete.
   */
  decideOffer(manifest: BundleManifest): Promise<OfferDecision>
  /**
   * Open a sink for one incoming entry.
   * @param entry - the manifest entry about to stream.
   */
  openEntry(entry: BundleEntryRef): Promise<BundleEntrySink>
  /** Optional cancellation. */
  readonly signal?: AbortSignal
}

/** Outcome of receiving one bundle. */
export interface ReceivedBundle {
  /** The accepted manifest. */
  readonly manifest: BundleManifest
  /** Entries whose bytes were received and verified in this session. */
  readonly entries: readonly BundleEntryRef[]
}

/**
 * Receive one offered bundle.
 *
 * The offer is validated fail-closed before any chunk is accepted (path
 * traversal, duplicate entries, and a tree summary disagreeing with the entry
 * list all refuse). Each entry is written into a sink and verified against
 * the manifest's size and SHA-256 before {@link BundleEntrySink.commit}.
 * @param channel - the authenticated connection channel.
 * @param handlers - offer decision and per-entry sinks.
 * @returns the manifest and the entries received in this session.
 * @throws {TransferProtocolError} for malformed offers or message sequences.
 * @throws {TransferIntegrityError} when received bytes disagree with the manifest.
 */
export async function receiveBundle(
  channel: ConnectionChannel,
  handlers: ReceiveBundleHandlers,
): Promise<ReceivedBundle> {
  const offer = await channel.next('offer', 120_000)
  const manifest = validateBundleManifest(offer['manifest'])
  let decision: OfferDecision
  try {
    decision = await handlers.decideOffer(manifest)
  } catch (error) {
    // A local refusal (unusable destination, storage failure) must still tell
    // the sender, or it waits out its own accept timeout on a dead choice.
    channel.write({ type: 'reject', binaryLength: 0, reason: 'refused' })
    throw error
  }
  if (!decision.accept) {
    channel.write({ type: 'reject', binaryLength: 0, reason: decision.reason ?? 'declined' })
    throw new TransferRejectedError(decision.reason)
  }
  channel.write({ type: 'accept', binaryLength: 0, resume: decision.completed ?? [] })
  const byPath = new Map<string, BundleEntryRef>(manifest.entries.map(entry => [theKey(entry), entry]))
  const received: BundleEntryRef[] = []
  for (;;) {
    handlers.signal?.throwIfAborted()
    const message = await channel.next(['entry', 'done'], 120_000)
    if (message.type === 'done') return { manifest, entries: received }
    const announced = entryOf(message)
    const entry = byPath.get(theKey(announced))
    if (entry === undefined || entry.sha256 !== announced.sha256 || entry.size !== announced.size) {
      throw new TransferProtocolError(`entry "${announced.path}" was not offered in the manifest`)
    }
    await receiveEntry(channel, entry, handlers.openEntry, handlers.signal)
    received.push(entry)
  }
}

/** Lookup key for one announced entry. */
function theKey(entry: Pick<BundleEntryRef, 'kind' | 'path'>): string {
  return `${entry.kind}\u0000${entry.path}`
}

/**
 * Read one `entry` announcement into a typed reference.
 * @param message - the entry message.
 * @returns the announced reference.
 */
function entryOf(message: WireMessage): BundleEntryRef {
  const kind = message['kind']
  const path = message['path']
  const size = message['size']
  const sha256 = message['sha256']
  if ((kind !== 'file' && kind !== 'session') || typeof path !== 'string' || typeof size !== 'number' || typeof sha256 !== 'string') {
    throw new TransferProtocolError('entry announcement is incomplete')
  }
  return { kind, path, size, sha256 }
}

/**
 * Receive one entry's chunks into a sink and verify the whole entry.
 * @param channel - the connection channel.
 * @param entry - the manifest entry being received.
 * @param openEntry - sink factory.
 * @param signal - optional cancellation.
 */
async function receiveEntry(
  channel: ConnectionChannel,
  entry: BundleEntryRef,
  openEntry: ReceiveBundleHandlers['openEntry'],
  signal: AbortSignal | undefined,
): Promise<void> {
  const sink = await openEntry(entry)
  const hash = createHash('sha256')
  let offset = 0
  try {
    for (;;) {
      signal?.throwIfAborted()
      const { message, binary } = await channel.nextFrame('chunk', 120_000)
      const chunkOffset = message['offset']
      if (chunkOffset !== offset) {
        throw new TransferProtocolError(`entry "${entry.path}" chunk offset ${String(chunkOffset)} does not continue at ${String(offset)}`)
      }
      hash.update(binary)
      await sink.write(binary)
      offset += binary.byteLength
      if (message['final'] === true) break
    }
    if (offset !== entry.size) throw new TransferIntegrityError(entry.path, `size ${String(entry.size)}`, `size ${String(offset)}`)
    const digest = hash.digest('hex')
    if (digest !== entry.sha256) throw new TransferIntegrityError(entry.path, entry.sha256, digest)
    await sink.commit()
  } catch (error) {
    await sink.abort()
    throw error
  }
}
