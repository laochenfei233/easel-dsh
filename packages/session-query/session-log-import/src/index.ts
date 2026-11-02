/**
 * Session-log import service (`ctx.sessionLogImporter`): materializes an
 * exported session archive into the mounted persistence and attachment
 * stores, remapping every session's work directory to the importing device.
 *
 * The import is two-phase and fail-loud: every log is parsed, validated, and
 * checked for id collisions before the first write; attachments are deposited
 * before sessions, so a failed import leaves at most unreachable
 * content-addressed objects (which the attachment store already documents as
 * harmless) and never a session that references missing attachments.
 * @module @deepseek-ai/dsh-session-log-import
 */

import { isAbsolute } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import {
  SessionLogOffset,
  type SessionHeader,
  type SessionId,
} from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import { readSessionArchive, type ArchiveContents } from './archive-read.ts'
import { parseSessionLog, type ParsedSessionLog } from './parse-log.ts'
import {
  SessionImportAttachmentMismatchError,
  SessionImportCollisionError,
  SessionImportFormatError,
} from './errors.ts'

export {
  SessionImportAttachmentMismatchError,
  SessionImportCollisionError,
  SessionImportError,
  SessionImportFormatError,
  type SessionImportErrorCode,
} from './errors.ts'
export {
  ARCHIVE_MEDIA_TYPES,
  readSessionArchive,
  type ArchiveContents,
  type ArchiveFileEntry,
  type ArchiveMediaEntry,
  type ArchiveMediaType,
} from './archive-read.ts'
export { parseSessionLog, type ParsedSessionLog } from './parse-log.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Session-log import service: materializes exported archives on this device. */
    sessionLogImporter: SessionLogImporter
  }
}

/** One imported session as stored on this device. */
export interface ImportedSession {
  /** Stored session id (unchanged from the exporting device). */
  readonly id: SessionId
  /** Stored immutable header, with `cwd` remapped to this device. */
  readonly header: SessionHeader
}

/** Outcome of one successful import. */
export interface SessionImportResult {
  /** The archive's root session. */
  readonly root: ImportedSession
  /** Subagent descendant sessions in archive order. */
  readonly descendants: readonly ImportedSession[]
}

/** Inputs for one archive import. */
export interface SessionImportOptions {
  /**
   * Absolute work directory every imported session binds to on this device.
   * Sessions without a recorded cwd keep none.
   */
  readonly targetCwd: string
  /** Optional cancellation observed between phases and forwarded to store operations. */
  readonly signal?: AbortSignal
}

/**
 * Import one exported session archive.
 *
 * Refuses without writing anything when a stored log is malformed, carries an
 * unknown format version, or collides with an existing session id; refuses
 * after depositing attachments when an attachment re-materializes under a
 * different id than the log records.
 */
export class SessionLogImporter extends Service {
  /** Storage seams the import writes through. */
  static inject = ['sessionPersistence', 'attachments']

  /**
   * @param host - host context carrying the persistence and attachment stores.
   */
  constructor(private readonly host: Context) {
    super(host, 'sessionLogImporter')
  }

  /**
   * Import one exported session archive into this device's stores.
   * @param archive - complete archive ZIP bytes as received.
   * @param options - target work directory and optional cancellation.
   * @returns the stored root session and its stored descendants.
   * @throws {SessionImportFormatError} when a log is unreadable, unparsable, or of another format version.
   * @throws {SessionImportCollisionError} when a session id already exists on this device.
   * @throws {SessionImportAttachmentMismatchError} when a deposited attachment id differs from the recorded one.
   * @throws {Error} from the mounted stores for storage-level failures.
   */
  async importArchive(archive: Uint8Array, options: SessionImportOptions): Promise<SessionImportResult> {
    if (!isAbsolute(options.targetCwd)) {
      throw new TypeError(`session import targetCwd must be an absolute path, received ${JSON.stringify(options.targetCwd)}`)
    }
    const signal = options.signal
    signal?.throwIfAborted()
    const contents = readSessionArchive(archive)
    const parsed: ParsedSessionLog[] = [
      parseSessionLog(contents.rootLog, 'root session log'),
      ...contents.subagentLogs.map((text, index) => parseSessionLog(text, `subagent log ${index + 1}`)),
    ]
    const root = parsed[0]
    /* v8 ignore start -- readSessionArchive refuses a missing root before this point */
    if (root === undefined) {
      throw new SessionImportFormatError(undefined, 'archive has no root session log')
    }
    /* v8 ignore stop */
    const persistence = this.host.sessionPersistence
    await this.refuseCollisions(persistence, parsed, options)
    signal?.throwIfAborted()
    await this.depositAttachments(contents, signal)
    signal?.throwIfAborted()
    const storedRoot = await this.materialize(persistence, root, options)
    const descendants: ImportedSession[] = []
    for (const log of parsed.slice(1)) {
      descendants.push(await this.materialize(persistence, log, options))
    }
    return { root: storedRoot, descendants }
  }

  /**
   * Refuse every id the archive would duplicate, before the first write.
   * @param persistence - the mounted persistence store.
   * @param parsed - every parsed log in the archive.
   * @param options - import options carrying cancellation.
   */
  private async refuseCollisions(
    persistence: SessionPersistence,
    parsed: readonly ParsedSessionLog[],
    options: SessionImportOptions,
  ): Promise<void> {
    const stored = await persistence.list(options.signal === undefined ? undefined : { signal: options.signal })
    const existing = new Set(stored.map(snapshot => snapshot.header.id))
    for (const log of parsed) {
      if (existing.has(log.header.id)) throw new SessionImportCollisionError(log.header.id)
    }
  }

  /**
   * Deposit every archive attachment through the store's public write API and
   * verify each one re-materializes under the id its log records.
   * @param contents - the classified archive.
   * @param signal - optional cancellation.
   */
  private async depositAttachments(contents: ArchiveContents, signal: AbortSignal | undefined): Promise<void> {
    const attachments: AttachmentStore = this.host.attachments
    for (const media of contents.media) {
      signal?.throwIfAborted()
      const ref = await attachments.saveImage({ data: media.data, mediaType: media.mediaType })
      if (String(ref.attachmentId) !== media.id) {
        throw new SessionImportAttachmentMismatchError(media.id, String(ref.attachmentId), `media/${media.id}`)
      }
    }
    for (const file of contents.files) {
      signal?.throwIfAborted()
      const ref = await attachments.saveFile({ data: file.data, name: file.name })
      const recorded = `sha256:${file.digest}`
      if (String(ref.attachmentId) !== recorded) {
        throw new SessionImportAttachmentMismatchError(recorded, String(ref.attachmentId), `files/${file.digest}/${file.name}`)
      }
    }
  }

  /**
   * Create, fill, and materialize one stored session.
   * @param persistence - the mounted persistence store.
   * @param log - the parsed and validated log.
   * @param options - import options carrying the target cwd and cancellation.
   * @returns the stored session.
   */
  private async materialize(
    persistence: SessionPersistence,
    log: ParsedSessionLog,
    options: SessionImportOptions,
  ): Promise<ImportedSession> {
    const header = remapHeader(log.header, options.targetCwd)
    const createOptions = {
      ...log.inheritedEventCount === undefined
        ? {}
        : { inheritedEventCount: SessionLogOffset(log.inheritedEventCount) },
      ...options.signal === undefined ? {} : { signal: options.signal },
    }
    const handle = await persistence.create(header, createOptions)
    try {
      await handle.append(log.events, options.signal === undefined ? undefined : { signal: options.signal })
      await handle.flush(options.signal === undefined ? undefined : { signal: options.signal })
      return { id: handle.header.id, header: handle.header }
    } finally {
      await handle.close()
    }
  }
}

/**
 * Bind one header's work directory to the importing device.
 * @param header - the exporting device's header.
 * @param targetCwd - absolute work directory on this device.
 * @returns the header to store: the same header with `cwd` replaced when one was recorded.
 */
function remapHeader(header: SessionHeader, targetCwd: string): SessionHeader {
  return header.cwd === undefined ? header : { ...header, cwd: targetCwd }
}
