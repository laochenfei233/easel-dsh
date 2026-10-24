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
import { copyFile, mkdir, open, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { ConnectionChannel } from './pairing.ts'
import {
  computeTreeSummary,
  receiveBundle,
  sendBundle,
  TRANSFER_PROTOCOL_VERSION,
  type BundleEntryRef,
  type BundleEntrySink,
  type BundleManifest,
  type OfferDecision,
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
 * Build one bundle manifest from an explicit file set, optional session
 * archives, and optional device data files. This is the packing core:
 * {@link prepareBundle} feeds it a walked project tree, and quick push feeds
 * an arbitrary selection.
 *
 * Session archives and inline data are opened once here so their size and
 * digest enter the manifest before streaming; they stay in memory through the
 * send. Large attachment-heavy archives raise the sender's memory cost —
 * spooling them to temporary files is the upgrade path.
 * @param options - title, explicit files, lazy session archives, and data files.
 * @returns the prepared bundle.
 * @throws {HandoffPreparationError} when a file or data source cannot be read.
 */
export async function bundleFromFiles(options: {
  readonly projectTitle: string
  readonly files: readonly BundleFileInput[]
  readonly sessionArchives: readonly SessionArchiveSource[]
  readonly dataFiles?: readonly DataFileSource[]
  /** Sending device's project directory recorded on the manifest; defaults to the first file. */
  readonly sourceCwd?: string
  /** Quick-push marker carried onto the manifest; bundles must stay session-less. */
  readonly mergeIntoExisting?: boolean
}): Promise<PreparedBundle> {
  if (options.mergeIntoExisting === true && options.sessionArchives.length > 0) {
    throw new HandoffPreparationError('', 'building a merge bundle', new TypeError('merge bundles carry no session archives'))
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
    const bytes = data.bytes ?? await readFileBytes(data.absolutePath as string)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const entry: BundleEntryRef = { kind: 'data', path: data.path, size: bytes.byteLength, sha256 }
    entries.push(entry)
    sources.set(sourceKey(entry), bytes)
  }
  const manifest: BundleManifest = {
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    bundleId: createHash('sha256').update(`${options.projectTitle}\u0000${String(Date.now())}\u0000${String(Math.random())}`).digest('hex').slice(0, 32),
    projectTitle: options.projectTitle,
    sourceCwd: options.sourceCwd ?? options.files[0]?.absolutePath ?? options.projectTitle,
    entries,
    treeSummary: computeTreeSummary(entries),
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
  const { manifest, sources } = prepared
  return sendBundle(channel, manifest, (entry) => {
    const source = sources.get(sourceKey(entry))
    if (source === undefined) throw new Error(`no prepared source for entry "${entry.path}"`)
    if (source instanceof Uint8Array) return singleChunk(source)
    return createReadStream(source.absolutePath)
  }, signal)
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
  constructor(readonly code: 'destination-exists' | 'verification' | 'import' | 'data', message: string, cause?: unknown) {
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

/** Product seams the receiving device supplies. */
export interface HandoffImportHost {
  /**
   * Import every archive into the local stores.
   * @param archives - session archives in manifest order.
   * @param targetCwd - the receiving project directory, already in place.
   * @returns imported session ids in archive order.
   */
  importSessionArchives(archives: readonly Uint8Array[], targetCwd: string): Promise<readonly string[]>
  /**
   * Register the received project and attach every imported session.
   * @param projectPath - the final project directory.
   * @param title - the sender's project title.
   * @param sessionIds - imported session ids in import order.
   */
  attachProject(projectPath: string, title: string, sessionIds: readonly string[]): Promise<void>
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

/** The staging layout for one bundle inside the target parent directory. */
interface StagingLayout {
  readonly projectRoot: string
  readonly sessionRoot: string
  readonly dataRoot: string
}

/** Staging layout for one bundle id. */
function stagingOf(parentDirectory: string, bundleId: string): StagingLayout {
  const base = join(parentDirectory, `.handoff-${bundleId}`)
  return { projectRoot: base, sessionRoot: `${base}.sessions`, dataRoot: `${base}.data` }
}

/** Streaming sink writing one entry to one staging path. */
class StagingSink implements BundleEntrySink {
  private handle: Awaited<ReturnType<typeof open>> | undefined

  /**
   * @param absolutePath - staging file to create.
   */
  constructor(private readonly absolutePath: string) {}

  async write(chunk: Uint8Array): Promise<void> {
    this.handle ??= await open(this.absolutePath, 'w')
    const handle = this.handle
    /* v8 ignore next -- the ??= above guarantees the handle */
    if (handle === undefined) return
    let offset = 0
    while (offset < chunk.byteLength) {
      const { bytesWritten } = await handle.write(chunk, offset, chunk.byteLength - offset)
      offset += bytesWritten
    }
  }

  async commit(): Promise<void> {
    const handle = this.handle
    /* v8 ignore next -- every received entry writes at least its final chunk first */
    if (handle === undefined) throw new Error('staging sink committed before its first write')
    await handle.sync()
    await handle.close()
  }

  async abort(): Promise<void> {
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
 * @param channel - the authenticated connection channel.
 * @param options - target parent directory, data root, and product seams.
 * @returns the completed receipt.
 * @throws {HandoffReceiveError} at the documented failure points.
 */
export async function receiveHandoff(
  channel: ConnectionChannel,
  options: {
    readonly targetParentDirectory: string
    readonly host: HandoffImportHost
    /** Receiving device's data root for `data` entries; required by bundles that carry them. */
    readonly dataDirectory?: string
    readonly signal?: AbortSignal
  },
): Promise<ReceivedHandoff> {
  const parent = resolve(options.targetParentDirectory)
  let staging: StagingLayout | undefined
  let finalPath: string | undefined
  let title: string | undefined
  let mergeMode = false
  let skipped: readonly BundleEntryRef[] = []

  const finish = async (manifest: BundleManifest, received: readonly BundleEntryRef[]): Promise<ReceivedHandoff> => {
    /* v8 ignore next 3 -- staging and title are set by the accepted offer */
    if (staging === undefined || finalPath === undefined || title === undefined) {
      throw new HandoffReceiveError('verification', 'receipt state was lost before completion')
    }
    const receipt = await completeReceipt(staging, finalPath, title, manifest, options.host, {
      dataDirectory: options.dataDirectory,
      mergeMode,
      received,
      skipped,
    })
    return { ...receipt, skipped }
  }

  return receiveBundle(channel, {
    ...options.signal === undefined ? {} : { signal: options.signal },
    decideOffer: async (manifest): Promise<OfferDecision> => {
      const decision = await decideOffer(manifest, parent, options.dataDirectory, (layout, path, receivedTitle, merge) => {
        staging = layout
        finalPath = path
        title = receivedTitle
        mergeMode = merge
      })
      skipped = decision.completed ?? []
      return decision
    },
    openEntry: async (entry) => {
      /* v8 ignore next 3 -- decideOffer runs before any entry opens */
      if (staging === undefined) throw new HandoffReceiveError('verification', 'receipt state was lost before receipt')
      const root = entry.kind === 'session' ? staging.sessionRoot : entry.kind === 'data' ? staging.dataRoot : staging.projectRoot
      const target = stagedPathOf(root, entry)
      await mkdir(dirname(target), { recursive: true })
      return new StagingSink(target)
    },
  }).then(async bundle => finish(bundle.manifest, bundle.entries))
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
): Promise<OfferDecision> {
  if (manifest.entries.some(entry => entry.kind === 'data') && (dataDirectory === undefined || dataDirectory.trim().length === 0)) {
    return { accept: false, reason: 'dataDirectoryNotConfigured' }
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
        return { accept: false, reason: `destinationExists:${finalPath}` }
      }
      remember(staging, finalPath, title, true)
      return { accept: true, completed: [] }
    }
    await mkdir(staging.projectRoot, { recursive: true })
    await mkdir(staging.sessionRoot, { recursive: true })
    await mkdir(staging.dataRoot, { recursive: true })
  } catch (error) {
    /* v8 ignore start -- the refusal is asserted end to end by the unholdable-parent test; attribution drifts across this block */
    throw new HandoffReceiveError('verification', `cannot prepare the receiving directory (${error instanceof Error ? error.message : String(error)})`, error)
    /* v8 ignore stop */
  }
  remember(staging, finalPath, title, false)
  return { accept: true, completed: await completedStagedEntries(staging, manifest) }
}

/**
 * Report entries whose staged copy already matches the manifest.
 * @param staging - staging layout.
 * @param manifest - the offered manifest.
 * @returns matching entries.
 */
async function completedStagedEntries(staging: StagingLayout, manifest: BundleManifest): Promise<readonly BundleEntryRef[]> {
  const completed: BundleEntryRef[] = []
  for (const entry of manifest.entries) {
    const root = entry.kind === 'session' ? staging.sessionRoot : entry.kind === 'data' ? staging.dataRoot : staging.projectRoot
    let target: string
    try {
      target = stagedPathOf(root, entry)
    } catch {
      /* v8 ignore next -- manifest validation refuses escapes before staging */
      continue
    }
    try {
      const info = await stat(target)
      if (!info.isFile() || info.size !== entry.size) continue
      const { sha256 } = await hashFile(target, entry.path, undefined)
      /* v8 ignore next -- the mismatch path is asserted by the same-size-different-content resume test; attribution drifts */
      if (sha256 === entry.sha256) completed.push(entry)
    } catch {
      /* v8 ignore start -- absence is the normal first-attempt path and is asserted via the resume tests */
      // Absence and unreadable partials both mean 'not complete'.
      /* v8 ignore stop */
    }
  }
  return completed
}

/** Completion inputs threaded from the receive loop into {@link completeReceipt}. */
interface CompletionContext {
  /** Receiving data root for `data` entries; required by bundles that carry them. */
  readonly dataDirectory: string | undefined
  /** Quick-push merge into an existing destination directory. */
  readonly mergeMode: boolean
  /** Entries received and verified in this session. */
  readonly received: readonly BundleEntryRef[]
  /** Entries the receiver already held complete (resume). */
  readonly skipped: readonly BundleEntryRef[]
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
  const arrived = new Set(context.received)
  const missing = manifest.entries.filter(entry => !arrived.has(entry) && !context.skipped.some(resumed => resumed.kind === entry.kind
    && resumed.path === entry.path && resumed.sha256 === entry.sha256))
  if (missing.length > 0) {
    await cleanupStaging(staging)
    const names = missing.map(entry => `"${entry.path}"`).slice(0, 3).join(', ')
    throw new HandoffReceiveError('verification', `the bundle ended before ${String(missing.length)} manifest entry(ies) arrived (${names}); nothing was published`)
  }
  if (context.mergeMode) {
    return mergeReceipt(staging, finalPath, title, manifest, host, context)
  }
  if (!await reconcileStagedTree(staging, manifest)) {
    await cleanupStaging(staging)
    throw new HandoffReceiveError('verification', 'the received project tree does not match the manifest (file count, sizes, or digests); nothing was published')
  }
  const archives: Uint8Array[] = []
  for (const entry of manifest.entries) {
    if (entry.kind !== 'session') continue
    const path = stagedPathOf(staging.sessionRoot, entry)
    archives.push(new Uint8Array(await readFileBytes(path)))
  }
  await rename(staging.projectRoot, finalPath)
  try {
    await applyDataFiles(staging, manifest, context.dataDirectory)
  } catch (error) {
    await rm(staging.sessionRoot, { recursive: true, force: true })
    throw error
  }
  let sessionIds: readonly string[]
  try {
    sessionIds = await host.importSessionArchives(archives, finalPath)
    await host.attachProject(finalPath, title, sessionIds)
  } catch (error) {
    // The verified project files stay in place on purpose: re-transferring
    // them would not fix an import failure, and deleting them would lose work.
    /* v8 ignore next -- host import seams throw Error instances */
    throw new HandoffReceiveError(
      'import',
      `project files were received verified at "${finalPath}", but importing its sessions failed (${error instanceof Error ? error.message : String(error)}); retry the import instead of re-transferring`,
      error,
    )
  } finally {
    await rm(staging.sessionRoot, { recursive: true, force: true })
  }
  return { projectPath: finalPath, sessionIds, skipped: [] }
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
    await host.attachProject(finalPath, title, [])
    await applyDataFiles(staging, manifest, context.dataDirectory)
  } finally {
    await cleanupStaging(staging)
  }
  return { projectPath: finalPath, sessionIds: [], skipped: [] }
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
  if (dataEntries.length === 0) return
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
  await rm(staging.projectRoot, { recursive: true, force: true })
  await rm(staging.sessionRoot, { recursive: true, force: true })
  await rm(staging.dataRoot, { recursive: true, force: true })
}
