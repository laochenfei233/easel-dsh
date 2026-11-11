/**
 * Host-side bundle assembly: project-tree pre-flight for the sending device
 * and staged receipt with three-way verification for the receiving device.
 *
 * The module touches only the filesystem and a transfer channel; session
 * export/import and workspace registration arrive as callbacks, so the
 * transport package stays free of the session stack and the product layer
 * owns those seams.
 * @module @easel-dsh/easel-air-transfer/handoff
 */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, lstat, mkdir, open, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { ConnectionChannel } from './pairing.ts'
import { ChannelClosedError, PairingError } from './pairing.ts'
import {
  computeTreeSummary,
  receiveBundle,
  receiveBundleFrom,
  sendBundle,
  TRANSFER_PROTOCOL_VERSION,
  type BundleEntryRef,
  type BundleEntrySink,
  type BundleManifest,
  type BundleEntryReader,
  type BundlePartialProgress,
  type BundleWorkerSlice,
  type OfferDecision,
  type ReceiveBundleHandlers,
  type SentBundle,
} from './transfer.ts'

/** Failure: the project tree cannot be read completely for a handoff. */
export class HandoffPreparationError extends Error {
  /**
   * @param path - the file or directory that could not be read.
   * @param action - what was being attempted, quoted in the report.
   * @param cause - the underlying failure.
   */
  constructor(readonly path: string, action: string, cause: unknown) {
    super(`cannot prepare the handoff bundle: ${action} "${path}" failed (${cause instanceof Error ? cause.message : String(cause)}); the transfer was aborted so no partial bundle ships`)
    this.name = 'HandoffPreparationError'
  }
}

/** One readable project file with its manifest identity. */
export interface ProjectTreeFile {
  /** Project-relative path with forward slashes. */
  readonly relativePath: string
  /** Absolute path on disk. */
  readonly absolutePath: string
  /** Exact byte length. */
  readonly size: number
  /** 64-hex SHA-256 of the exact bytes. */
  readonly sha256: string
}

/**
 * Hash one file by streaming.
 * @param absolutePath - file to hash.
 * @param relativePath - project-relative path for the refusal report.
 * @param signal - optional cancellation.
 * @returns size and digest.
 */
async function hashFile(
  absolutePath: string,
  relativePath: string,
  signal: AbortSignal | undefined,
): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256')
  let size = 0
  try {
    for await (const chunk of createReadStream(absolutePath)) {
      signal?.throwIfAborted()
      const bytes = chunk as Buffer
      hash.update(bytes)
      size += bytes.byteLength
    }
  } catch (error) {
    /* v8 ignore start -- a read failing mid-stream needs a live permission revocation */
    if (signal?.aborted === true) throw error
    throw new HandoffPreparationError(relativePath, 'reading', error)
    /* v8 ignore stop */
  }
  return { size, sha256: hash.digest('hex') }
}

/**
 * Walk a project tree and hash every regular file.
 *
 * The walk is the pre-flight gate: every directory is realpath-resolved, every
 * file must be readable, and any failure aborts the handoff instead of
 * producing a bundle with silently missing files.
 * @param root - absolute project directory.
 * @param signal - optional cancellation.
 * @returns every regular file with its manifest identity, in stable walk order.
 * @throws {HandoffPreparationError} when a directory or file cannot be read.
 */
export async function walkProjectTree(root: string, signal?: AbortSignal): Promise<readonly ProjectTreeFile[]> {
  let canonical: string
  try {
    canonical = await realpath(root)
  } catch (error) {
    throw new HandoffPreparationError(root, 'resolving the project directory', error)
  }
  const files: ProjectTreeFile[] = []
  const visit = async (directory: string): Promise<void> => {
    signal?.throwIfAborted()
    let entries: Dirent[]
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      /* v8 ignore next -- directory listing fails only under permission or mount loss */
      throw new HandoffPreparationError(directory, 'listing', error)
    }
    /* v8 ignore next -- one directory never lists the same name twice */
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    for (const entry of entries) {
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolute)
        continue
      }
      /* v8 ignore next 3 -- creating a FIFO or socket needs POSIX-only tooling */
      if (!entry.isFile()) {
        throw new HandoffPreparationError(absolute, 'reading (only regular files and directories are transferable)', new TypeError('unsupported file type'))
      }
      const relativePath = relative(canonical, absolute).split(sep).join('/')
      const { size, sha256 } = await hashFile(absolute, relativePath, signal)
      files.push({ relativePath, absolutePath: absolute, size, sha256 })
    }
  }
  await visit(canonical)
  return files
}

/** One session archive to carry, opened lazily by the sender. */
export interface SessionArchiveSource {
  /** Session id carried by the archive (for the receiving report only). */
  readonly sessionId: string
  /** Archive file name on the wire, `dsh-session-<id>.zip`. */
  readonly archiveName: string
  /** Produce the archive bytes. */
  open(): Promise<Uint8Array>
}

/** A fully prepared bundle ready to stream. */
export interface PreparedBundle {
  /** The validated manifest. */
  readonly manifest: BundleManifest
  /** Entry sources keyed by entry key. */
  readonly sources: ReadonlyMap<string, Uint8Array | { readonly absolutePath: string }>
  /** The pre-flight walk result, for reporting. */
  readonly files: readonly ProjectTreeFile[]
}

/** Key identifying one entry for source lookup. */
function sourceKey(entry: Pick<BundleEntryRef, 'kind' | 'path'>): string {
  return `${entry.kind}\u0000${entry.path}`
}

/** One project file offered to the packing core; digests may arrive pre-computed. */
export interface BundleFileInput {
  /** Absolute path on disk. */
  readonly absolutePath: string
  /** Bundle-relative wire path. */
  readonly relativePath: string
  /** Exact byte length; computed when omitted. */
  readonly size?: number
  /** 64-hex SHA-256; computed when omitted. */
  readonly sha256?: string
}

/**
 * One device data file carried outside the project tree, addressed relative to
 * the receiving device's data root (`.env`, `profiles/<name>/*.md`,
 * `skills/openclaw/**`, `outputs/**`).
 */
export interface DataFileSource {
  /** Data-root-relative wire path. */
  readonly path: string
  /** File to read lazily at packing time; exactly one of the two sources is set. */
  readonly absolutePath?: string
  /** Inline bytes; exactly one of the two sources is set. */
  readonly bytes?: Uint8Array
}

/**
 * One portable device-configuration document. The receiving product layer
 * applies it through its own configuration seams instead of copying it as a
 * file, so machine-specific paths on the sending device never overwrite the
 * receiver's own profile.
 */
export interface ConfigDocumentSource {
  /** Single-segment document name on the wire (`model-config.json`). */
  readonly name: string
  /** Document bytes. */
  readonly bytes: Uint8Array
}

/**
 * Build one bundle manifest from an explicit file set, optional session
 * archives, and optional device data files. This is the packing core:
 * {@link prepareBundle} feeds it a walked project tree, and quick push feeds
 * an arbitrary selection.
 *
 * Session archives and inline data are opened once here so their size and
 * digest enter the manifest before streaming; they stay in memory through the
 * send. Large attachment-heavy archives raise the sender's memory cost —
 * spooling them to temporary files is the upgrade path. Disk-backed data files
 * never load here: they are hashed by streaming and read from their source
 * path during the send, so a gigabyte-scale content library does not sit in
 * the sender's memory.
 * @param options - title, explicit files, lazy session archives, and data files.
 * @returns the prepared bundle.
 * @throws {HandoffPreparationError} when a file or data source cannot be read.
 */
export async function bundleFromFiles(options: {
  readonly projectTitle: string
  readonly files: readonly BundleFileInput[]
  readonly sessionArchives: readonly SessionArchiveSource[]
  readonly dataFiles?: readonly DataFileSource[]
  readonly configDocuments?: readonly ConfigDocumentSource[]
  /** Sending device's project directory recorded on the manifest; defaults to the first file. */
  readonly sourceCwd?: string
  /** Sending device's data root and harness home, so received logs can be remapped. */
  readonly sourceRoots?: { readonly data?: string; readonly home?: string }
  /** Quick-push marker carried onto the manifest; bundles must stay session-less. */
  readonly mergeIntoExisting?: boolean
}): Promise<PreparedBundle> {
  if (options.mergeIntoExisting === true && (options.sessionArchives.length > 0 || (options.configDocuments?.length ?? 0) > 0)) {
    throw new HandoffPreparationError('', 'building a merge bundle', new TypeError('merge bundles carry no session archives or config documents'))
  }
  const sources = new Map<string, Uint8Array | { readonly absolutePath: string }>()
  const entries: BundleEntryRef[] = []
  const walked: ProjectTreeFile[] = []
  for (const file of options.files) {
    const identity = file.size !== undefined && file.sha256 !== undefined
      ? { size: file.size, sha256: file.sha256 }
      : await hashFile(file.absolutePath, file.relativePath, undefined)
    const entry: BundleEntryRef = { kind: 'file', path: file.relativePath, size: identity.size, sha256: identity.sha256 }
    entries.push(entry)
    walked.push({ relativePath: file.relativePath, absolutePath: file.absolutePath, size: identity.size, sha256: identity.sha256 })
    sources.set(sourceKey(entry), { absolutePath: file.absolutePath })
  }
  for (const archive of options.sessionArchives) {
    const bytes = await archive.open()
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const entry: BundleEntryRef = { kind: 'session', path: archive.archiveName, size: bytes.byteLength, sha256 }
    entries.push(entry)
    sources.set(sourceKey(entry), bytes)
  }
  for (const data of options.dataFiles ?? []) {
    if (data.absolutePath === undefined && data.bytes === undefined) {
      throw new HandoffPreparationError(data.path, 'collecting device data', new TypeError('data file carries neither bytes nor a source path'))
    }
    if (data.bytes !== undefined) {
      const sha256 = createHash('sha256').update(data.bytes).digest('hex')
      const entry: BundleEntryRef = { kind: 'data', path: data.path, size: data.bytes.byteLength, sha256 }
      entries.push(entry)
      sources.set(sourceKey(entry), data.bytes)
      continue
    }
    // Disk-backed: hash by streaming and stream the bytes during the send.
    const absolutePath = data.absolutePath as string
    const { size, sha256 } = await hashFile(absolutePath, data.path, undefined)
    const entry: BundleEntryRef = { kind: 'data', path: data.path, size, sha256 }
    entries.push(entry)
    sources.set(sourceKey(entry), { absolutePath })
  }
  for (const document of options.configDocuments ?? []) {
    const sha256 = createHash('sha256').update(document.bytes).digest('hex')
    const entry: BundleEntryRef = { kind: 'config', path: document.name, size: document.bytes.byteLength, sha256 }
    entries.push(entry)
    sources.set(sourceKey(entry), document.bytes)
  }
  const sourceRoots = options.sourceRoots === undefined
    ? undefined
    : {
        ...options.sourceRoots.data === undefined ? {} : { data: options.sourceRoots.data },
        ...options.sourceRoots.home === undefined ? {} : { home: options.sourceRoots.home },
      }
  const treeSummary = computeTreeSummary(entries)
  const manifest: BundleManifest = {
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    // Content-derived, not random: re-sending the same title and entries
    // yields the same id, so a retry after an interrupted transfer resumes
    // from the receiver's staged entries instead of restarting the bundle.
    bundleId: createHash('sha256').update(`${options.projectTitle}\u0000${treeSummary.sha256}`).digest('hex').slice(0, 32),
    projectTitle: options.projectTitle,
    sourceCwd: options.sourceCwd ?? options.files[0]?.absolutePath ?? options.projectTitle,
    ...sourceRoots === undefined ? {} : { sourceRoots },
    entries,
    treeSummary,
    ...options.mergeIntoExisting === true ? { mergeIntoExisting: true } : {},
  }
  return { manifest, sources, files: walked }
}

/**
 * Build one bundle manifest from a project tree and session archives.
 * @param options - project directory, title, and lazy session archives.
 * @returns the prepared bundle.
 * @throws {HandoffPreparationError} when the project tree is unreadable.
 */
export async function prepareBundle(options: {
  readonly projectPath: string
  readonly projectTitle: string
  readonly sessionArchives: readonly SessionArchiveSource[]
  readonly signal?: AbortSignal
}): Promise<PreparedBundle> {
  const files = await walkProjectTree(options.projectPath, options.signal)
  return bundleFromFiles({
    projectTitle: options.projectTitle,
    files,
    sessionArchives: options.sessionArchives,
    sourceCwd: options.projectPath,
  })
}

/**
 * Stream one prepared bundle and account for what the receiver already held.
 * @param channel - the authenticated connection channel.
 * @param prepared - the prepared bundle.
 * @param signal - optional cancellation.
 * @returns skipped and streamed entries.
 */
export function sendPreparedBundle(
  channel: ConnectionChannel,
  prepared: PreparedBundle,
  signal?: AbortSignal,
): Promise<SentBundle> {
  return sendBundle(channel, prepared.manifest, preparedEntryReader(prepared), signal)
}

/**
 * Read one prepared entry's bytes from a start offset, for one connection.
 * @param prepared - the prepared bundle.
 * @returns a reader usable by {@link sendEntries}.
 * @throws {Error} when the bundle has no source for the entry.
 */
export function preparedEntryReader(prepared: PreparedBundle): BundleEntryReader {
  const { sources } = prepared
  return (entry, startOffset) => {
    const source = sources.get(sourceKey(entry))
    if (source === undefined) throw new Error(`no prepared source for entry "${entry.path}"`)
    if (source instanceof Uint8Array) return singleChunk(startOffset === 0 ? source : source.subarray(startOffset))
    return createReadStream(source.absolutePath, startOffset === 0 ? undefined : { start: startOffset })
  }
}

/** Yield one buffer as the complete byte sequence. */
async function* singleChunk(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes
}

/** Failure: the received bundle cannot be completed. */
export class HandoffReceiveError extends Error {
  /**
   * @param code - the stable failure kind.
   * @param message - the actionable report.
   * @param cause - the underlying failure, when one exists.
   */
  constructor(readonly code: 'destination-exists' | 'verification' | 'import' | 'data' | 'config', message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'HandoffReceiveError'
  }
}

/**
 * Turn a project title into one safe directory name.
 * @param title - the sender's title.
 * @returns a directory name safe on Windows and POSIX.
 */
export function projectDirectoryName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/gu, '_').replace(/[. ]+$/gu, '').slice(0, 80)
  return cleaned.length === 0 ? 'project' : cleaned
}

/** One sending-device directory rewritten onto its receiving-device counterpart. */
export interface HandoffPathRemap {
  /** Absolute directory as recorded on the sending device. */
  readonly from: string
  /** Absolute directory on the receiving device. */
  readonly to: string
}

/** One received portable config document. */
export interface ReceivedConfigDocument {
  /** Document name as carried on the manifest. */
  readonly name: string
  /** Document bytes. */
  readonly bytes: Uint8Array
}

/** Product seams the receiving device supplies. */
export interface HandoffImportHost {
  /**
   * Import every archive into the local stores.
   * @param archives - session archives in manifest order.
   * @param targetCwd - the receiving project directory, already in place.
   * @param remaps - sending-device roots and their receiving-device counterparts;
   * absolute paths inside the logs are rewritten onto this device before the
   * log is stored.
   * @returns imported session ids in archive order.
   */
  importSessionArchives(
    archives: readonly Uint8Array[],
    targetCwd: string,
    remaps: readonly HandoffPathRemap[],
  ): Promise<readonly string[]>
  /**
   * Register the received project and attach every imported session.
   * @param projectPath - the final project directory.
   * @param title - the sender's project title.
   * @param sessionIds - imported session ids in import order.
   */
  attachProject(projectPath: string, title: string, sessionIds: readonly string[]): Promise<void>
  /**
   * Apply portable config documents through this device's own configuration
   * seams. Required when the bundle carries `config` entries; the receipt is
   * refused otherwise.
   * @param documents - received documents in manifest order.
   */
  applyConfigDocuments?(documents: readonly ReceivedConfigDocument[]): Promise<void>
}

/** Outcome of one completed receipt. */
export interface ReceivedHandoff {
  /** Final project directory on this device. */
  readonly projectPath: string
  /** Imported session ids. */
  readonly sessionIds: readonly string[]
  /** Entries the receiver already held from an earlier attempt. */
  readonly skipped: readonly BundleEntryRef[]
}

/** Phase of one incoming receipt. */
export type HandoffReceivePhase = 'receiving' | 'verifying' | 'importing'

/** Live progress of one incoming receipt. */
export interface HandoffReceiveProgress {
  /** What the receiver is doing now. */
  readonly phase: HandoffReceivePhase
  /** The sender's project title. */
  readonly projectTitle: string
  /** Bundle entries whose bytes arrived and verified. */
  readonly entriesDone: number
  /** Bundle entries in the accepted manifest. */
  readonly entriesTotal: number
  /** Bytes written to staging so far. */
  readonly bytesDone: number
  /** Bytes the accepted manifest announces. */
  readonly bytesTotal: number
}

/** The staging layout for one bundle inside the target parent directory. */
interface StagingLayout {
  readonly projectRoot: string
  readonly sessionRoot: string
  readonly dataRoot: string
  readonly configRoot: string
}

/**
 * Staging root for one entry kind.
 * @param staging - staging layout.
 * @param kind - entry kind.
 * @returns the absolute directory the entry streams into.
 */
function stagingRootOf(staging: StagingLayout, kind: BundleEntryRef['kind']): string {
  switch (kind) {
    case 'file': return staging.projectRoot
    case 'session': return staging.sessionRoot
    case 'data': return staging.dataRoot
    case 'config': return staging.configRoot
  }
}

/** Mutable progress record behind {@link HandoffReceiveProgress}. */
interface MutableProgress {
  phase: HandoffReceivePhase
  projectTitle: string
  entriesDone: number
  entriesTotal: number
  bytesDone: number
  bytesTotal: number
}

/** Staging layout for one bundle id. */
function stagingOf(parentDirectory: string, bundleId: string): StagingLayout {
  const base = join(parentDirectory, `.handoff-${bundleId}`)
  return {
    projectRoot: base,
    sessionRoot: `${base}.sessions`,
    dataRoot: `${base}.data`,
    configRoot: `${base}.config`,
  }
}

/** Names this package gives the staging paths of one receipt (same id alphabet the manifest accepts). */
const STAGING_NAME = /^(\.handoff-[A-Za-z0-9_-]{1,128})(?:\.data|\.sessions|\.config)?$/u

/**
 * Remove staging directories left by receipts interrupted before completion
 * (process exit, crash, or app relaunch).
 *
 * Only names matching this package's staging pattern are considered, and a
 * group is removed only when its newest file is at least `maxAgeMs` old, so a
 * concurrently running instance's active receipt is not deleted.
 * @param parentDirectory - the configured handoff directory.
 * @param maxAgeMs - minimum age of the newest staged file before removal.
 * @param now - current epoch milliseconds (injectable for tests).
 * @returns the staging base paths that were removed.
 */
export async function cleanupStaleReceipts(
  parentDirectory: string,
  maxAgeMs: number,
  now = Date.now(),
): Promise<readonly string[]> {
  let entries: readonly Dirent[]
  try {
    entries = await readdir(parentDirectory, { withFileTypes: true })
  } catch {
    // A handoff directory that does not exist yet has no stale receipts.
    return []
  }
  const bases = new Set<string>()
  for (const entry of entries) {
    const match = STAGING_NAME.exec(entry.name)
    if (match?.[1] !== undefined) bases.add(join(parentDirectory, match[1]))
  }
  const removed: string[] = []
  for (const base of bases) {
    // A data-less receipt can leave only the `.data` sibling after the project
    // base was renamed away; the sibling's age still decides whether it is stale.
    const times = await Promise.all([base, `${base}.data`, `${base}.sessions`, `${base}.config`].map(path => newestMtime(path)))
    const known = times.filter((time): time is number => time !== undefined)
    /* v8 ignore next -- every staging path vanishing between listing and inspection is a race */
    if (known.length === 0) continue
    const newest = Math.max(...known)
    // A zero threshold means "remove every group"; positive thresholds keep
    // anything touched inside the window, including files newer than `now`.
    if (maxAgeMs > 0 && now - newest < maxAgeMs) continue
    for (const path of [base, `${base}.data`, `${base}.sessions`, `${base}.config`]) {
      await rm(path, { recursive: true, force: true })
    }
    removed.push(base)
  }
  return removed
}

/**
 * Find the newest modification time among a path and everything under it.
 * @param path - file or directory to inspect.
 * @returns epoch milliseconds, or `undefined` when the path already vanished.
 */
async function newestMtime(path: string): Promise<number | undefined> {
  let info
  try {
    info = await lstat(path)
  } catch {
    /* v8 ignore next -- a staging path can vanish between listing and inspection */
    return undefined
  }
  let newest = info.mtimeMs
  if (!info.isDirectory()) return newest
  let entries: readonly Dirent[]
  try {
    entries = await readdir(path, { withFileTypes: true })
  } catch {
    /* v8 ignore next -- a staging directory can vanish between listing and inspection */
    return newest
  }
  for (const entry of entries) {
    const value = await newestMtime(join(path, entry.name))
    if (value !== undefined && value > newest) newest = value
  }
  return newest
}

/** Streaming sink writing one entry to one staging path. */
class StagingSink implements BundleEntrySink {
  private handle: Awaited<ReturnType<typeof open>> | undefined
  /** Absolute file offset the next write lands at. */
  private position: number

  /**
   * @param absolutePath - staging file to create.
   * @param startOffset - staged bytes this stream continues past; the sink
   * appends from there and keeps them when the stream dies. 0 creates the file.
   */
  constructor(private readonly absolutePath: string, startOffset = 0) {
    this.position = startOffset
  }

  async write(chunk: Uint8Array): Promise<void> {
    this.handle ??= await this.openHandle()
    const handle = this.handle
    /* v8 ignore next -- the ??= above guarantees the handle */
    if (handle === undefined) return
    let offset = 0
    while (offset < chunk.byteLength) {
      const { bytesWritten } = await handle.write(chunk, offset, chunk.byteLength - offset, this.position)
      offset += bytesWritten
      this.position += bytesWritten
    }
  }

  /**
   * Open the staging file for this sink's offset: append to the existing
   * partial file, or create it fresh. A reported partial whose file vanished
   * in between falls back to creating it, restarting that entry from zero.
   */
  private async openHandle() {
    if (this.position > 0) {
      try {
        return await open(this.absolutePath, 'r+')
      } catch (error) {
        /* v8 ignore start -- a staged file vanishing between resume reporting and open needs a concurrent delete */
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        this.position = 0
        /* v8 ignore stop */
      }
    }
    return open(this.absolutePath, 'w')
  }

  async commit(): Promise<void> {
    const handle = this.handle
    /* v8 ignore next -- every received entry writes at least its final chunk first */
    if (handle === undefined) throw new Error('staging sink committed before its first write')
    await handle.sync()
    await handle.close()
  }

  async abort(): Promise<void> {
    // Keep the staged bytes: a resend continues this entry from them.
    await this.handle?.close()
  }

  async discard(): Promise<void> {
    try {
      await this.handle?.close()
    } finally {
      await rm(this.absolutePath, { force: true })
    }
  }
}

/**
 * Map one manifest entry onto a staging path, refusing escapes.
 * @param root - staging root.
 * @param entry - the manifest entry.
 * @returns the absolute staging path.
 */
function stagedPathOf(root: string, entry: BundleEntryRef): string {
  const absolute = resolve(root, entry.path)
  const base = resolve(root)
  /* v8 ignore next 3 -- manifest validation refuses escapes before staging */
  if (absolute !== base && !absolute.startsWith(`${base}${sep}`)) {
    throw new HandoffReceiveError('verification', `entry path "${entry.path}" escapes the staging directory`)
  }
  return absolute
}

/**
 * Reconcile a staged project tree against the manifest's file entries.
 * @param staging - staging layout.
 * @param manifest - the accepted manifest.
 * @returns whether the tree matches exactly.
 */
async function reconcileStagedTree(staging: StagingLayout, manifest: BundleManifest): Promise<boolean> {
  let files: readonly ProjectTreeFile[]
  try {
    files = await walkProjectTree(staging.projectRoot)
  } catch {
    /* v8 ignore next -- a vanished staging tree also reports the count mismatch below */
    return false
  }
  const expected = new Map(manifest.entries
    .filter(entry => entry.kind === 'file')
    .map(entry => [entry.path, entry]))
  if (files.length !== expected.size) return false
  for (const file of files) {
    const entry = expected.get(file.relativePath)
    /* v8 ignore next 2 -- ingress verification makes a present-file mismatch unreachable */
    if (entry === undefined || entry.size !== file.size || entry.sha256 !== file.sha256) return false
  }
  return true
}

/**
 * Receive one bundle into a staging area, verify it, move it into place, apply
 * device data files, then hand the archives and the project to the product
 * layer.
 *
 * Resume: entries whose staged file already matches size and digest are
 * reported complete, and the sender skips them. Failure before the move
 * removes the staging directories; failure after the move leaves the verified
 * project files in place and reports their location, because re-transferring
 * the project would not fix an import problem.
 *
 * Quick push: a manifest marked `mergeIntoExisting` whose destination already
 * exists is merged file-by-file into the existing directory instead of
 * refusing, skipping the whole-tree reconciliation (per-entry digest plus the
 * all-entries-arrived check still apply).
 *
 * Completion: after the receipt settles the receiver sends `received`, or
 * `failed` with the failure reason. The sender waits for that message, so its
 * success means this receipt finished importing, not that the bytes arrived.
 * @param channel - the authenticated connection channel.
 * @param options - target parent directory, data root, and product seams.
 * @returns the completed receipt.
 * @throws {HandoffReceiveError} at the documented failure points.
 * @throws when the connection ends before every entry arrived.
 */
export async function receiveHandoff(
  channel: ConnectionChannel,
  options: {
    readonly targetParentDirectory: string
    readonly host: HandoffImportHost
    /** Receiving device's data root for `data` entries; required by bundles that carry them. */
    readonly dataDirectory?: string
    /** Receiving device's harness home, used to rewrite home-rooted paths in imported logs. */
    readonly homeDirectory?: string
    readonly signal?: AbortSignal
    /** Called with each progress change while the bundle streams and settles. */
    readonly onProgress?: (progress: HandoffReceiveProgress) => void
    /** Offer already read by the caller; omitted reads it here. */
    readonly offer?: import('./transfer.ts').ReceivedOffer
  },
): Promise<ReceivedHandoff> {
  const parent = resolve(options.targetParentDirectory)
  let staging: StagingLayout | undefined
  let finalPath: string | undefined
  let title: string | undefined
  let mergeMode = false
  let skipped: readonly BundleEntryRef[] = []
  let partial: readonly BundlePartialProgress[] = []
  const progress: MutableProgress = {
    phase: 'receiving',
    projectTitle: '',
    entriesDone: 0,
    entriesTotal: 0,
    bytesDone: 0,
    bytesTotal: 0,
  }

  const report = (): void => {
    options.onProgress?.({ ...progress })
  }
  const setPhase = (phase: HandoffReceivePhase): void => {
    progress.phase = phase
    report()
  }

  const finish = async (manifest: BundleManifest, received: readonly BundleEntryRef[]): Promise<ReceivedHandoff> => {
    /* v8 ignore next 3 -- staging and title are set by the accepted offer */
    if (staging === undefined || finalPath === undefined || title === undefined) {
      throw new HandoffReceiveError('verification', 'receipt state was lost before completion')
    }
    const receipt = await completeReceipt(staging, finalPath, title, manifest, options.host, {
      dataDirectory: options.dataDirectory,
      homeDirectory: options.homeDirectory,
      mergeMode,
      received,
      skipped,
      resumedPartial: partial,
      onPhase: setPhase,
    })
    return { ...receipt, skipped }
  }

  const handlers: ReceiveBundleHandlers = {
    ...options.signal === undefined ? {} : { signal: options.signal },
    decideOffer: async (manifest): Promise<OfferDecision> => {
      const decision = await decideOffer(manifest, parent, options.dataDirectory, (layout, path, receivedTitle, merge) => {
        staging = layout
        finalPath = path
        title = receivedTitle
        mergeMode = merge
      })
      // The internal decideOffer always resolves both resume lists.
      skipped = decision.completed
      partial = decision.partial
      if (decision.accept) {
        progress.phase = 'receiving'
        progress.projectTitle = manifest.projectTitle
        progress.entriesDone = 0
        progress.entriesTotal = manifest.entries.length
        // Resumed bytes are already on this device; count them as done so the
        // progress card reflects the true remainder of a retried transfer.
        progress.bytesDone = partial.reduce((total, item) => total + item.bytes, 0)
        progress.bytesTotal = manifest.treeSummary.totalBytes
        report()
      }
      return decision
    },
    openEntry: async (entry, startOffset) => {
      /* v8 ignore next 3 -- decideOffer runs before any entry opens */
      if (staging === undefined) throw new HandoffReceiveError('verification', 'receipt state was lost before receipt')
      const target = stagedPathOf(stagingRootOf(staging, entry.kind), entry)
      await mkdir(dirname(target), { recursive: true })
      const sink = new StagingSink(target, startOffset)
      return {
        write: (chunk) => {
          progress.bytesDone += chunk.byteLength
          report()
          return sink.write(chunk)
        },
        commit: async () => {
          await sink.commit()
          progress.entriesDone += 1
          report()
        },
        abort: () => sink.abort(),
        discard: () => sink.discard(),
      }
    },
  }
  const receive = options.offer === undefined
    ? receiveBundle(channel, handlers)
    : receiveBundleFrom(channel, options.offer, handlers)
  try {
    const bundle = await receive
    const receipt = await finish(bundle.manifest, bundle.entries)
    try {
      channel.write({ type: 'received', binaryLength: 0 })
    } catch {
      // The sender already closed; the receipt is still complete on this device.
    }
    return receipt
  } catch (error) {
    /* v8 ignore next -- this module throws Error instances; the fallback covers a foreign seam throw */
    const reason = error instanceof Error ? error.message : String(error)
    // A connection-level failure (dropped link, idle stall) leaves staged
    // bytes a resend continues from; a receipt refusal does not. The prefix
    // tells the sender's retry policy which is which.
    const retryable = isConnectionLevelReceiveError(error)
    try {
      channel.write({ type: 'failed', binaryLength: 0, reason: `${retryable ? 'retryable' : 'fatal'}: ${reason}` })
    } catch {
      // The sender is gone; the local failure still reaches this caller.
    }
    throw error
  }
}

/**
 * One bundle streaming in over several connections: the first worker prepares
 * staging and the resume report, every worker stages its own slice, and the
 * last worker's `done` settles the receipt once for all of them.
 *
 * Workers never share an entry: the sender partitions by stride, and a
 * duplicate announcement is refused so two sinks cannot write one path.
 */
export class SharedReceipt {
  private readonly received: BundleEntryRef[] = []
  private readonly done = new Set<number>()
  private readonly resumedPartial: BundlePartialProgress[] = []
  private readonly completed: BundleEntryRef[] = []
  private state: 'preparing' | 'ready' | 'settled' | 'failed' = 'preparing'
  private staging: StagingLayout | undefined
  private finalPath: string | undefined
  private title: string | undefined
  private readonly ready: Promise<void>
  private resolveReady!: () => void
  private rejectReady!: (error: Error) => void
  private readonly settled: Promise<ReceivedHandoff>
  private resolveSettled!: (receipt: ReceivedHandoff) => void
  private rejectSettled!: (error: Error) => void
  /** Live channels for this receipt, so the settle report reaches every worker. */
  readonly channels = new Set<ConnectionChannel>()
  /** Bytes written to staging so far, across workers. */
  bytesDone = 0
  /** Entries committed so far, across workers. */
  entriesDone = 0
  /** Owner of the settle attempt, so only one worker runs the completion. */
  private settling = false
  /** Whether this receipt merges into an existing destination (never in parallel sends). */
  private mergeMode = false

  /**
   * @param manifest - the offered manifest, identical on every worker.
   * @param parent - resolved target parent directory.
   * @param dataDirectory - receiving data root, required by bundles carrying data entries.
   * @param homeDirectory - receiving harness home for path remapping.
   * @param host - product seams.
   * @param total - worker count the sender announced.
   * @param onProgress - progress observer, invoked after each write/commit.
   */
  constructor(
    readonly manifest: BundleManifest,
    private readonly parent: string,
    private readonly dataDirectory: string | undefined,
    private readonly homeDirectory: string | undefined,
    private readonly host: HandoffImportHost,
    readonly total: number,
    private readonly onProgress: ((progress: HandoffReceiveProgress) => void) | undefined,
  ) {
    this.ready = new Promise<void>((resolveReady, rejectReady) => {
      this.resolveReady = resolveReady
      this.rejectReady = rejectReady
    })
    this.settled = new Promise<ReceivedHandoff>((resolveSettled, rejectSettled) => {
      this.resolveSettled = resolveSettled
      this.rejectSettled = rejectSettled
    })
  }

  /** The receipt's own outcome, settling after every worker's `done`. */
  get completion(): Promise<ReceivedHandoff> {
    return this.settled
  }

  /**
   * Prepare the receipt on the first worker.
   * @returns the accept decision shared by every worker of this bundle.
   * @throws when staging cannot be prepared; the caller reports the refusal.
   */
  async start(): Promise<OfferDecision> {
    try {
      const decision = await decideOffer(this.manifest, this.parent, this.dataDirectory, (layout, path, title, merge) => {
        this.staging = layout
        this.finalPath = path
        this.title = title
        this.mergeMode = merge
      })
      this.completed.push(...decision.completed)
      this.resumedPartial.push(...decision.partial)
      this.report('receiving')
      if (!decision.accept) {
        /* v8 ignore next -- every refusal decideOffer returns names a reason */
        this.fail(new HandoffReceiveError('verification', `the receiving device refused the bundle (${decision.reason ?? 'declined'})`))
      } else {
        this.state = 'ready'
        this.resolveReady()
      }
      return decision
    } catch (error) {
      /* v8 ignore start -- staging failures need an unwritable handoff directory, which the refusal tests do not force */
      this.fail(error instanceof Error ? error : new Error(String(error)))
      throw error
      /* v8 ignore stop */
    }
  }

  /**
   * Answer one worker's offer with the receipt's shared resume report.
   * @param worker - the worker's slice.
   * @returns the accept decision.
   */
  async decide(worker: BundleWorkerSlice): Promise<OfferDecision> {
    // A refused or failed first worker rejects ready, which is the refusal a
    // later worker reports; a prepared receipt resolves it.
    if (worker.index !== 0) await this.ready
    return { accept: true, completed: this.completed, partial: this.resumedPartial }
  }

  /**
   * Open one entry's staging sink for a worker.
   * @param entry - the manifest entry about to stream.
   * @param startOffset - staged bytes this stream continues past.
   * @returns the sink writing into the shared staging layout.
   * @throws {HandoffReceiveError} when staging was never prepared.
   */
  async openEntry(entry: BundleEntryRef, startOffset: number): Promise<BundleEntrySink> {
    /* v8 ignore next 3 -- decideOffer runs before any entry opens */
    if (this.staging === undefined) throw new HandoffReceiveError('verification', 'receipt state was lost before receipt')
    const target = stagedPathOf(stagingRootOf(this.staging, entry.kind), entry)
    await mkdir(dirname(target), { recursive: true })
    const sink = new StagingSink(target, startOffset)
    return {
      write: (chunk) => {
        this.bytesDone += chunk.byteLength
        this.report('receiving')
        return sink.write(chunk)
      },
      commit: async () => {
        await sink.commit()
        this.entriesDone += 1
        this.report('receiving')
      },
      abort: () => sink.abort(),
      discard: () => sink.discard(),
    }
  }

  /**
   * Record one worker's arrival. The last worker's record settles the receipt.
   * @param worker - the worker's slice.
   * @param entries - entries this worker streamed.
   */
  record(worker: BundleWorkerSlice, entries: readonly BundleEntryRef[]): void {
    this.received.push(...entries)
    this.done.add(worker.index)
    if (this.done.size < this.total) return
    void this.settle()
  }

  /**
   * Mark the receipt failed for every worker; staged bytes stay for a resend
   * when the failure is connection-level.
   * @param error - the failure all workers report.
   */
  fail(error: Error): void {
    if (this.state === 'failed' || this.state === 'settled') return
    this.state = 'failed'
    this.rejectReady(error)
    this.rejectSettled(error)
    this.broadcast(`failed:${isConnectionLevelReceiveError(error) ? 'retryable' : 'fatal'}: ${error.message}`)
  }

  /** Settle the receipt once: verify, publish, import, attach, then report to every worker. */
  private async settle(): Promise<void> {
    /* v8 ignore next -- record() settles only once, after every worker's done and a ready receipt */
    if (this.settling || this.state !== 'ready') return
    this.settling = true
    /* v8 ignore next 3 -- start() sets these before any worker's done can arrive */
    if (this.staging === undefined || this.finalPath === undefined || this.title === undefined) return
    const staging = this.staging
    const finalPath = this.finalPath
    try {
      this.report('verifying')
      const receipt = await completeReceipt(staging, finalPath, this.title, this.manifest, this.host, {
        dataDirectory: this.dataDirectory,
        homeDirectory: this.homeDirectory,
        mergeMode: this.mergeMode,
        received: this.received,
        skipped: this.completed,
        resumedPartial: this.resumedPartial,
        onPhase: phase => { this.report(phase) },
      })
      this.state = 'settled'
      this.resolveSettled({ ...receipt, skipped: this.completed })
      this.broadcast('received')
    } catch (error) {
      /* v8 ignore next -- completeReceipt throws HandoffReceiveError or host Error instances */
      const failure = error instanceof Error ? error : new Error(String(error))
      this.fail(failure)
    }
  }

  /** Send the terminal frame to every worker still connected. */
  private broadcast(kind: 'received' | `failed:${string}`): void {
    for (const channel of this.channels) {
      try {
        if (kind === 'received') channel.write({ type: 'received', binaryLength: 0 })
        else channel.write({ type: 'failed', binaryLength: 0, reason: kind.slice('failed:'.length) })
      } catch {
        // A worker that closed already has its own failure path.
      }
    }
  }

  /** Report aggregate progress to the service's receiving snapshot. */
  private report(phase: HandoffReceivePhase): void {
    this.onProgress?.({
      phase,
      projectTitle: this.manifest.projectTitle,
      entriesDone: this.entriesDone,
      entriesTotal: this.manifest.entries.length,
      bytesDone: this.resumedPartial.reduce((total, item) => total + item.bytes, 0) + this.bytesDone,
      bytesTotal: this.manifest.treeSummary.totalBytes,
    })
  }
}

/**
 * Whether one receive failure is connection-level, so resending the bundle
 * continues from the receiver's staged bytes instead of starting over.
 * @param error - the failure receiveHandoff is reporting.
 * @returns true for a dropped link or an idle-stall timeout.
 */
function isConnectionLevelReceiveError(error: unknown): boolean {
  // The receive loop's only PairingError is the channel's idle-stall timeout;
  // pairing-time PairingErrors never reach it.
  return error instanceof ChannelClosedError || error instanceof PairingError
}

/**
 * Decide one offer and prepare staging.
 * @param manifest - the validated manifest.
 * @param parent - target parent directory.
 * @param dataDirectory - the receiving data root, when configured.
 * @param remember - records the staging layout, final path, and merge mode for later phases.
 * @returns the decision for {@link receiveBundle}.
 */
async function decideOffer(
  manifest: BundleManifest,
  parent: string,
  dataDirectory: string | undefined,
  remember: (layout: StagingLayout, finalPath: string, title: string, mergeMode: boolean) => void,
): Promise<OfferDecision & Required<Pick<OfferDecision, 'completed' | 'partial'>>> {
  if (manifest.entries.some(entry => entry.kind === 'data') && (dataDirectory === undefined || dataDirectory.trim().length === 0)) {
    return { accept: false, reason: 'dataDirectoryNotConfigured', completed: [], partial: [] }
  }
  const title = projectDirectoryName(manifest.projectTitle)
  const finalPath = join(parent, title)
  const staging = stagingOf(parent, manifest.bundleId)
  try {
    const existing = await stat(finalPath).catch((error: unknown) => {
      /* v8 ignore start -- the ENOENT path is the normal first attempt; the other path needs a concurrent delete to race */
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
      /* v8 ignore stop */
    })
    if (existing !== undefined) {
      // Quick push merges into the existing directory; a project handoff, or a
      // quick push whose title is already a file, refuses.
      if (manifest.mergeIntoExisting !== true || !existing.isDirectory()) {
        return { accept: false, reason: `destinationExists:${finalPath}`, completed: [], partial: [] }
      }
      remember(staging, finalPath, title, true)
      // Merge receipts re-copy every entry, so staged progress is irrelevant.
      return { accept: true, completed: [], partial: [] }
    }
    await mkdir(staging.projectRoot, { recursive: true })
    await mkdir(staging.sessionRoot, { recursive: true })
    await mkdir(staging.dataRoot, { recursive: true })
    await mkdir(staging.configRoot, { recursive: true })
  } catch (error) {
    /* v8 ignore start -- the refusal is asserted end to end by the unholdable-parent test; attribution drifts across this block */
    throw new HandoffReceiveError('verification', `cannot prepare the receiving directory (${error instanceof Error ? error.message : String(error)})`, error)
    /* v8 ignore stop */
  }
  remember(staging, finalPath, title, false)
  const progress = await stagedProgress(staging, manifest)
  return { accept: true, completed: progress.completed, partial: progress.partial }
}

/**
 * Report the staged progress of a previous attempt: entries whose staged copy
 * matches the manifest are complete; entries with contiguous partial bytes
 * continue from their size.
 * @param staging - staging layout.
 * @param manifest - the offered manifest.
 * @returns complete entries and partial byte counts.
 */
async function stagedProgress(
  staging: StagingLayout,
  manifest: BundleManifest,
): Promise<{ completed: readonly BundleEntryRef[]; partial: readonly BundlePartialProgress[] }> {
  const completed: BundleEntryRef[] = []
  const partial: BundlePartialProgress[] = []
  for (const entry of manifest.entries) {
    let target: string
    try {
      target = stagedPathOf(stagingRootOf(staging, entry.kind), entry)
    } catch {
      /* v8 ignore next -- manifest validation refuses escapes before staging */
      continue
    }
    try {
      const info = await stat(target)
      if (!info.isFile()) continue
      if (info.size === entry.size) {
        const { sha256 } = await hashFile(target, entry.path, undefined)
        /* v8 ignore next -- the mismatch path is asserted by the same-size-different-content resume test; attribution drifts */
        if (sha256 === entry.sha256) completed.push(entry)
        continue
      }
      if (info.size > 0 && info.size < entry.size) {
        partial.push({ kind: entry.kind, path: entry.path, sha256: entry.sha256, bytes: info.size })
      }
    } catch {
      /* v8 ignore start -- absence is the normal first-attempt path and is asserted via the resume tests */
      // Absence and unreadable partials both mean 'not complete'.
      /* v8 ignore stop */
    }
  }
  return { completed, partial }
}

/** Completion inputs threaded from the receive loop into {@link completeReceipt}. */
interface CompletionContext {
  /** Receiving data root for `data` entries; required by bundles that carry them. */
  readonly dataDirectory: string | undefined
  /** Receiving harness home, the target for the sender's home-rooted paths. */
  readonly homeDirectory: string | undefined
  /** Quick-push merge into an existing destination directory. */
  readonly mergeMode: boolean
  /** Entries received and verified in this session. */
  readonly received: readonly BundleEntryRef[]
  /** Entries the receiver already held complete (resume). */
  readonly skipped: readonly BundleEntryRef[]
  /** Entries resumed from staged bytes; their complete files are digest-gated at completion. */
  readonly resumedPartial: readonly BundlePartialProgress[]
  /** Called when the receipt moves to a later phase; absent when progress is not observed. */
  readonly onPhase?: (phase: HandoffReceivePhase) => void
}

/**
 * Complete one receipt: verify arrival coverage, reconcile or merge, move into
 * place, import, apply data files, attach.
 * @param staging - staging layout.
 * @param finalPath - final project directory.
 * @param title - final project title.
 * @param manifest - the received manifest.
 * @param host - product seams.
 * @param context - arrival coverage, merge mode, and the data root.
 * @returns the completed receipt.
 */
async function completeReceipt(
  staging: StagingLayout,
  finalPath: string,
  title: string,
  manifest: BundleManifest,
  host: HandoffImportHost,
  context: CompletionContext,
): Promise<ReceivedHandoff> {
  // Every manifest entry must have arrived (this session or a resume), or the
  // bundle is incomplete and nothing may publish — the merge path skips the
  // whole-tree reconciliation, so this check is what keeps it honest.
  const arrived = new Set(context.received.map(sourceKey))
  const missing = manifest.entries.filter(entry => !arrived.has(sourceKey(entry)) && !context.skipped.some(resumed => resumed.kind === entry.kind
    && resumed.path === entry.path && resumed.sha256 === entry.sha256))
  if (missing.length > 0) {
    await cleanupStaging(staging)
    const names = missing.map(entry => `"${entry.path}"`).slice(0, 3).join(', ')
    throw new HandoffReceiveError('verification', `the bundle ended before ${String(missing.length)} manifest entry(ies) arrived (${names}); nothing was published`)
  }
  if (context.mergeMode) {
    context.onPhase?.('importing')
    return mergeReceipt(staging, finalPath, title, manifest, host, context)
  }
  context.onPhase?.('verifying')
  // Entries resumed from staged bytes were digest-gated only by their tail
  // stream (a tail cannot reproduce the whole-entry digest); hash their
  // complete staged files now — session, data, and config entries are consumed
  // directly from staging, and the tree reconciliation below covers files.
  for (const progress of context.resumedPartial) {
    if (progress.kind === 'file') continue
    const entry = manifest.entries.find(candidate => candidate.kind === progress.kind && candidate.path === progress.path)
    /* v8 ignore next -- the accept-time report is validated against the manifest before streaming */
    if (entry === undefined) continue
    const { sha256 } = await hashFile(stagedPathOf(stagingRootOf(staging, entry.kind), entry), entry.path, undefined)
    if (sha256 !== entry.sha256) {
      await cleanupStaging(staging)
      throw new HandoffReceiveError('verification', `the resumed entry "${entry.path}" no longer matches the manifest digest; nothing was published`)
    }
  }
  if (!await reconcileStagedTree(staging, manifest)) {
    await cleanupStaging(staging)
    throw new HandoffReceiveError('verification', 'the received project tree does not match the manifest (file count, sizes, or digests); nothing was published')
  }
  // Configuration lands before anything publishes: a refused document leaves
  // no project behind, so the sender can fix it and retry the whole bundle.
  await applyConfigDocuments(staging, manifest, host)
  context.onPhase?.('importing')
  const archives: Uint8Array[] = []
  for (const entry of manifest.entries) {
    if (entry.kind !== 'session') continue
    const path = stagedPathOf(staging.sessionRoot, entry)
    archives.push(new Uint8Array(await readFileBytes(path)))
  }
  await rename(staging.projectRoot, finalPath)
  // The project directory exists now, so its real path is authoritative: the
  // workspace registry registers projects by real path, and imported sessions
  // record the cwd they are handed. A data root reached through a symlink would
  // otherwise file the sessions under the alias path and leave the workspace
  // with no conversations.
  const projectPath = await realpath(finalPath)
  try {
    await applyDataFiles(staging, manifest, context.dataDirectory)
  } catch (error) {
    await rm(staging.sessionRoot, { recursive: true, force: true })
    throw error
  }
  let sessionIds: readonly string[]
  try {
    sessionIds = await host.importSessionArchives(archives, projectPath, await pathRemaps(manifest, projectPath, context))
    await host.attachProject(projectPath, title, sessionIds)
  } catch (error) {
    // The verified project files stay in place on purpose: re-transferring
    // them would not fix an import failure, and deleting them would lose work.
    /* v8 ignore next -- host import seams throw Error instances */
    throw new HandoffReceiveError(
      'import',
      `project files were received verified at "${projectPath}", but importing its sessions failed (${error instanceof Error ? error.message : String(error)}); retry the import instead of re-transferring`,
      error,
    )
  } finally {
    await rm(staging.sessionRoot, { recursive: true, force: true })
  }
  return { projectPath, sessionIds, skipped: [] }
}

/**
 * Apply the bundle's portable config documents through the product's own
 * configuration seams. Runs before the project publishes, so a refused
 * document leaves nothing half-registered.
 * @param staging - staging layout.
 * @param manifest - the received manifest.
 * @param host - product seams supplying the config application.
 * @throws {HandoffReceiveError} with code `config` when the build cannot apply
 * the documents or the product refuses one; staging is removed first.
 */
async function applyConfigDocuments(
  staging: StagingLayout,
  manifest: BundleManifest,
  host: HandoffImportHost,
): Promise<void> {
  const configEntries = manifest.entries.filter(entry => entry.kind === 'config')
  if (configEntries.length === 0) {
    // No config entries still leaves the staging root decideOffer created.
    await rm(staging.configRoot, { recursive: true, force: true })
    return
  }
  try {
    const apply = host.applyConfigDocuments
    if (apply === undefined) {
      throw new HandoffReceiveError('config', 'the bundle carries portable configuration, but this build cannot apply it; update the receiving app and retry')
    }
    const documents: ReceivedConfigDocument[] = []
    for (const entry of configEntries) {
      documents.push({ name: entry.path, bytes: new Uint8Array(await readFileBytes(stagedPathOf(staging.configRoot, entry))) })
    }
    await apply.call(host, documents)
  } catch (error) {
    await cleanupStaging(staging)
    if (error instanceof HandoffReceiveError) throw error
    /* v8 ignore next -- product config seams throw Error instances */
    throw new HandoffReceiveError(
      'config',
      `the configuration arrived verified but could not be applied (${error instanceof Error ? error.message : String(error)}); nothing was published`,
      error,
    )
  } finally {
    await rm(staging.configRoot, { recursive: true, force: true })
  }
}

/**
 * Build the sending-device-to-receiving-device directory pairs used to rewrite
 * absolute paths inside imported session logs. The project directory maps to
 * its received location; the sender's wider data root and harness home map to
 * this device's counterparts when both sides know them. Longest source first,
 * so a project root inside the data root wins the replacement.
 * @param manifest - the received manifest.
 * @param projectPath - final project directory on this device.
 * @param context - receiving data root and harness home.
 * @returns the remaps to apply, in replacement order.
 */
function pathRemaps(
  manifest: BundleManifest,
  projectPath: string,
  context: CompletionContext,
): readonly HandoffPathRemap[] {
  const pairs: HandoffPathRemap[] = [{ from: manifest.sourceCwd, to: projectPath }]
  const data = manifest.sourceRoots?.data
  if (data !== undefined && context.dataDirectory !== undefined && context.dataDirectory.trim().length > 0) {
    pairs.push({ from: data, to: resolve(context.dataDirectory) })
  }
  const home = manifest.sourceRoots?.home
  if (home !== undefined && context.homeDirectory !== undefined && context.homeDirectory.trim().length > 0) {
    pairs.push({ from: home, to: resolve(context.homeDirectory) })
  }
  return pairs
    .filter(pair => pair.from !== pair.to)
    .sort((left, right) => right.from.length - left.from.length)
}

/**
 * Merge one quick-push receipt into an existing destination directory: move
 * every staged file in place (same-name overwrite), apply data files, and
 * attach nothing (merge bundles carry no sessions, so no workspace is
 * registered).
 * @param staging - staging layout.
 * @param finalPath - the existing destination directory.
 * @param title - the sender's title.
 * @param manifest - the received manifest.
 * @param host - product seams.
 * @param context - arrival coverage and the data root.
 * @returns the completed receipt.
 */
async function mergeReceipt(
  staging: StagingLayout,
  finalPath: string,
  title: string,
  manifest: BundleManifest,
  host: HandoffImportHost,
  context: CompletionContext,
): Promise<ReceivedHandoff> {
  // Quick push merges into an existing destination directory, so its real path
  // resolves already; sessions never travel with it.
  const projectPath = await realpath(finalPath)
  try {
    for (const entry of manifest.entries) {
      if (entry.kind !== 'file') continue
      const base = resolve(finalPath)
      const target = resolve(base, entry.path)
      /* v8 ignore next 3 -- manifest validation refuses escapes before staging */
      if (target !== base && !target.startsWith(`${base}${sep}`)) {
        throw new HandoffReceiveError('verification', `entry path "${entry.path}" escapes the destination directory`)
      }
      await mkdir(dirname(target), { recursive: true })
      await copyFile(stagedPathOf(staging.projectRoot, entry), target)
    }
    // Quick push merges into an existing destination directory, whose real path
    // is already resolvable; sessions never travel with it.
    await host.attachProject(projectPath, title, [])
    await applyDataFiles(staging, manifest, context.dataDirectory)
  } finally {
    await cleanupStaging(staging)
  }
  return { projectPath, sessionIds: [], skipped: [] }
}

/**
 * Move every `data` entry from its staging root into the receiving data root.
 * `.env` merges into the existing file (unknown lines and keys survive);
 * everything else copies over by path.
 * @param staging - staging layout.
 * @param manifest - the received manifest.
 * @param dataDirectory - the receiving data root; bundles without `data` entries skip this.
 * @throws {HandoffReceiveError} when a data file cannot be placed and no data root is set for a data bundle.
 */
async function applyDataFiles(
  staging: StagingLayout,
  manifest: BundleManifest,
  dataDirectory: string | undefined,
): Promise<void> {
  const dataEntries = manifest.entries.filter(entry => entry.kind === 'data')
  if (dataEntries.length === 0) {
    // No data entries still leaves the staging root decideOffer created.
    await rm(staging.dataRoot, { recursive: true, force: true })
    return
  }
  /* v8 ignore next 3 -- decideOffer refuses data bundles without a configured data root before any byte moves */
  if (dataDirectory === undefined || dataDirectory.trim().length === 0) {
    throw new HandoffReceiveError('data', 'the bundle carries device data files but this device has no data directory configured')
  }
  const root = resolve(dataDirectory)
  try {
    for (const entry of dataEntries) {
      const target = resolve(root, entry.path)
      /* v8 ignore next 3 -- manifest validation refuses escapes before staging */
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        throw new HandoffReceiveError('data', `data path "${entry.path}" escapes the data directory`)
      }
      await mkdir(dirname(target), { recursive: true })
      const staged = stagedPathOf(staging.dataRoot, entry)
      if (entry.path === '.env') {
        const incoming = await readFileBytes(staged)
        const merged = mergeEnvText(await readFile(target, 'utf8').catch(() => null), incoming.toString('utf8'))
        await writeFile(target, merged, 'utf8')
        continue
      }
      await copyFile(staged, target)
    }
  } catch (error) {
    /* v8 ignore next -- host filesystem failures carry Error messages */
    throw new HandoffReceiveError(
      'data',
      `project files were received verified, but placing the device data files failed (${error instanceof Error ? error.message : String(error)}); the project is complete, retry the data placement instead of re-transferring`,
      error,
    )
  } finally {
    await rm(staging.dataRoot, { recursive: true, force: true })
  }
}

/** A `.env` key line: `KEY=value` with an identifier key. */
const ENV_LINE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u

/**
 * Merge incoming `.env` lines into existing content: keys in the incoming set
 * are replaced in place (or appended), every other line survives, and empty
 * incoming values are skipped. Comments and unknown keys are never touched.
 * @param existing - current file content, or null when the file is new.
 * @param incoming - the received `.env` content.
 * @returns the merged content.
 */
export function mergeEnvText(existing: string | null, incoming: string): string {
  const updates = new Map<string, string>()
  for (const line of incoming.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed === '') continue
    const match = ENV_LINE.exec(trimmed)
    if (match === null || match[1] === undefined || match[2] === undefined) continue
    if (match[2].trim() === '') continue
    updates.set(match[1], match[2])
  }
  const lines = (existing ?? '').split(/\r?\n/)
  if (lines.length === 1 && lines[0] === '') lines.pop()
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const match = ENV_LINE.exec(line.trim())
    const key = match === null || match[1] === undefined ? undefined : match[1]
    const replacement = key === undefined ? undefined : updates.get(key)
    if (key !== undefined && replacement !== undefined) {
      seen.add(key)
      out.push(`${key}=${replacement}`)
      continue
    }
    out.push(line)
  }
  const appended = [...updates].filter(([key]) => !seen.has(key))
  if (appended.length > 0) {
    const lastLine = out[out.length - 1]
    if (lastLine !== undefined && lastLine.trim() !== '') out.push('')
    for (const [key, value] of appended) out.push(`${key}=${value}`)
  }
  return `${out.join('\n').replace(/\n{3,}/gu, '\n\n').replace(/\n+$/u, '')}\n`
}

/** Read whole file bytes. @param path - file to read. @returns the bytes. */
async function readFileBytes(path: string): Promise<Buffer> {
  return readFile(path)
}

/**
 * Remove the staging directories.
 * @param staging - staging layout.
 */
async function cleanupStaging(staging: StagingLayout): Promise<void> {
  for (const path of [staging.projectRoot, staging.sessionRoot, staging.dataRoot, staging.configRoot]) {
    await rm(path, { recursive: true, force: true })
  }
}
