/**
 * Reading exported session-log ZIP archives: decompression, entry
 * classification, and the media-type mapping the exporter uses.
 *
 * The archive layout is the one `@deepseek-ai/dsh-session-log-export`
 * produces: one root log, one log per subagent descendant, content-addressed
 * images, and content-addressed verbatim files. Unknown entries are ignored,
 * so a newer exporter adding content does not break this reader.
 * @module @deepseek-ai/dsh-session-log-import/archive-read
 */

import { unzipSync } from 'fflate'
import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { sessionFormatLogFilename } from '@deepseek-ai/dsh-session-format'
import { SessionImportFormatError } from './errors.ts'

/** Image media types carried by `media/<attachmentId>.<ext>` entries, keyed by extension. */
export const ARCHIVE_MEDIA_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
} as const

/** One image entry decoded from an archive. */
export type ArchiveMediaType = (typeof ARCHIVE_MEDIA_TYPES)[keyof typeof ARCHIVE_MEDIA_TYPES]

/** One image entry with the attachment id its log records. */
export interface ArchiveMediaEntry {
  /** Attachment id as recorded by the log, `sha256:` prefixed. */
  readonly id: string
  /** Media type derived from the entry extension. */
  readonly mediaType: ArchiveMediaType
  /** The stored normalized image bytes. */
  readonly data: Uint8Array
}

/** One verbatim file entry. */
export interface ArchiveFileEntry {
  /** 64-hex SHA-256 digest of the exact bytes. */
  readonly digest: string
  /** Display name recorded by the exporting store, sanitized by the exporter. */
  readonly name: string
  /** Exact file bytes. */
  readonly data: Uint8Array
}

/** Classified contents of one exported session archive. */
export interface ArchiveContents {
  /** The root session log text (canonical JSONL). */
  readonly rootLog: string
  /** Subagent descendant log texts in archive order. */
  readonly subagentLogs: readonly string[]
  /** Every image the included logs reference. */
  readonly media: readonly ArchiveMediaEntry[]
  /** Every verbatim file the included logs reference. */
  readonly files: readonly ArchiveFileEntry[]
}

/** Archive path shape of one subagent log: `subagents/<segment>/<log filename>`. */
const SUBAGENT_PREFIX = 'subagents/'

/** Archive path shape of one image entry. */
const MEDIA_ENTRY = /^media\/([^/]+)\.(png|jpg|webp|gif)$/u

/** Archive path shape of one verbatim file entry: `files/<prefix>/<digest>/<name>`. */
const FILE_ENTRY = /^files\/[^/]+\/([a-f0-9]{64})\/([^/]+)$/u

/**
 * Decompress and classify one exported session archive.
 *
 * The whole archive is decompressed in memory: handoff archives arrive as one
 * received file whose transport already buffers the complete entry, and the
 * session logs plus bounded images are small next to it. Per-entry streaming
 * inflate is the upgrade path if verbatim files ever outgrow memory.
 * @param archive - complete ZIP bytes as received.
 * @returns the classified logs and attachments.
 * @throws {SessionImportFormatError} when the bytes are not a readable ZIP or the root log is absent.
 */
export function readSessionArchive(archive: Uint8Array): ArchiveContents {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(archive)
  } catch (error) {
    throw new SessionImportFormatError(undefined, 'archive bytes are not a readable ZIP container', { cause: error })
  }
  const logName = sessionFormatLogFilename(SESSION_FORMAT_VERSION)
  const decoder = new TextDecoder()
  let rootLog: string | undefined
  const subagentLogs: string[] = []
  const media: ArchiveMediaEntry[] = []
  const files: ArchiveFileEntry[] = []
  for (const [path, data] of Object.entries(entries)) {
    if (path === logName) {
      rootLog = decoder.decode(data)
      continue
    }
    if (path.startsWith(SUBAGENT_PREFIX)) {
      const rest = path.slice(SUBAGENT_PREFIX.length)
      const separator = rest.indexOf('/')
      if (separator > 0 && rest.slice(separator + 1) === logName) subagentLogs.push(decoder.decode(data))
      continue
    }
    const mediaMatch = MEDIA_ENTRY.exec(path)
    if (mediaMatch !== null) {
      const [, id, extension] = mediaMatch
      if (id !== undefined && extension !== undefined) {
        media.push({ id, mediaType: ARCHIVE_MEDIA_TYPES[extension as keyof typeof ARCHIVE_MEDIA_TYPES], data })
      }
      continue
    }
    const fileMatch = FILE_ENTRY.exec(path)
    if (fileMatch !== null) {
      const [, digest, name] = fileMatch
      if (digest !== undefined && name !== undefined) files.push({ digest, name, data })
    }
    // Other entries are ignored: a newer exporter may add content.
  }
  if (rootLog === undefined) {
    throw new SessionImportFormatError(undefined, `archive has no root session log named "${logName}"`)
  }
  return { rootLog, subagentLogs, media, files }
}
