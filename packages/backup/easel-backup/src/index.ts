/**
 * Remote backup engine for Easel: grouped zip archives with per-group
 * retention, WebDAV / SMB / S3 destinations, optional passphrase encryption,
 * verified restore plans, and pure schedule math. The Easel host plugin owns
 * configuration, credentials, and routes; this package owns no state.
 */
export {
  BACKUP_GROUP_IDS,
  type ArchiveEntry,
  type BackupGroupId,
  type BackupManifest,
  type BackupPhase,
  type BackupProgress,
  type BackupRoots,
  type Destination,
  type DestinationConfig,
  type DestinationSecrets,
  type RemoteBackup,
  type RemoteObject,
  type RestoreFile,
  type RestorePlan,
  type SourceRole,
} from './types.js'
export { BackupError, type BackupErrorCode } from './errors.js'
export { collectGroup, levelForPath, stampFor, STORE_EXTENSIONS, toPosixPath } from './collections.js'
export {
  BackupArchiveWriter,
  extractBackupArchive,
  writeBackupArchive,
  type ArchiveInput,
  type ExtractedArchive,
  type ExtractedFile,
} from './archive.js'
export { DEFAULT_CHUNK_SIZE, HEADER_LENGTH, blockIv, decryptFileTo, encryptFileTo, isEncryptedArchive } from './crypto.js'
export { createDestination } from './destinations/index.js'
export { FsDestination } from './destinations/fs.js'
export { S3Destination, parseListObjects, s3BucketRoot } from './destinations/s3.js'
export { WebDavDestination, parsePropfind } from './destinations/webdav.js'
export {
  DEFAULT_RETENTION,
  backupKey,
  listBackups,
  parseBackupKey,
  pruneGroup,
  runBackupGroup,
  type BackupRunOptions,
} from './engine.js'
export { applyRestore, discardRestore, planRestore, type PlanRestoreOptions } from './restore.js'
export { computeDue, type ScheduleConfig, type ScheduleMode } from './schedule.js'
