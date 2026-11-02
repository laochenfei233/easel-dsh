/**
 * Typed refusals for session-log import.
 * @module @deepseek-ai/dsh-session-log-import/errors
 */

import type { SessionId } from '@deepseek-ai/dsh-session'

/** Stable failure kinds an import can report. */
export type SessionImportErrorCode = 'collision' | 'format' | 'attachment-mismatch'

/** Base class for every refused import, carrying a stable code. */
export class SessionImportError extends Error {
  /**
   * @param code - the stable failure kind.
   * @param message - the actionable report.
   * @param options - optional cause preservation.
   */
  constructor(readonly code: SessionImportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
  }
}

/** Refusal: the archive carries a session id that already exists on this device. */
export class SessionImportCollisionError extends SessionImportError {
  /** @param id - the colliding session id. */
  constructor(readonly id: SessionId) {
    super('collision', `session "${id}" already exists in this harness home; delete or rename the local session before importing, or export the incoming project from a different source`)
  }
}

/** Refusal: the archive or one of its entries is not a readable session export. */
export class SessionImportFormatError extends SessionImportError {
  /**
   * @param path - the archive entry being read, when one is identifiable.
   * @param message - what the entry contains instead of a valid log.
   * @param options - optional cause preservation.
   */
  constructor(readonly path: string | undefined, message: string, options?: ErrorOptions) {
    super('format', path === undefined ? message : `${message} (archive entry: ${path})`, options)
  }
}

/** Refusal: a deposited attachment re-materialized under a different id than the log records. */
export class SessionImportAttachmentMismatchError extends SessionImportError {
  /**
   * @param expected - the attachment id recorded by the archive entry name.
   * @param actual - the id the mounted store assigned to the deposited bytes.
   * @param entryPath - the archive entry, quoted in the report.
   */
  constructor(readonly expected: string, readonly actual: string, readonly entryPath: string) {
    super('attachment-mismatch', `attachment "${entryPath}" re-materialized as "${actual}" instead of "${expected}"; the archive was produced with an incompatible image pipeline and cannot be linked to the imported log`)
  }
}
