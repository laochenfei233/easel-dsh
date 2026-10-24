/** Structured failure codes carried by every {@link BackupError}. */
export type BackupErrorCode =
  | 'CONFIG'
  | 'CONTAINER_INVALID'
  | 'DECRYPT_FAILED'
  | 'ARCHIVE_INVALID'
  | 'ARCHIVE_TRUNCATED'
  | 'ARCHIVE_MANIFEST_MISMATCH'
  | 'ARCHIVE_UNSAFE_PATH'
  | 'DESTINATION_UNREACHABLE'
  | 'DESTINATION_MISSING'
  | 'HTTP_ERROR'

/**
 * Typed failure of the backup engine. Callers match on {@link code} to render
 * actionable reports; the message is a complete sentence naming the subject.
 */
export class BackupError extends Error {
  /** Machine-readable failure class. */
  readonly code: BackupErrorCode

  /**
   * @param code - Failure class.
   * @param message - Complete, actionable description.
   * @param options - Underlying cause, preserved for diagnostics.
   */
  constructor(code: BackupErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'BackupError'
    this.code = code
  }
}
