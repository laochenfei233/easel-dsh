/**
 * Backup scope groups; each group archives and uploads as one independent zip.
 * @mode Data layout for the Easel settings backup feature.
 */
export type BackupGroupId = 'config' | 'sessions' | 'workspace';

/** Every group id, in stable UI order. */
export const BACKUP_GROUP_IDS: readonly BackupGroupId[] = ['config', 'sessions', 'workspace'] as const;

/**
 * Directory roles prefixing archive entry paths. Restore maps each role back
 * onto the live directory of the current data root, so backups survive data
 * root migration unchanged.
 */
export type SourceRole = 'home' | 'workspace';

/** Filesystem roots one backup reads from. */
export interface BackupRoots {
  /** dsh home directory (`$DSH_HOME`): profiles, credentials, sessions, attachments. */
  home: string;
  /** Easel workspace root: projects, outputs, personas, skills, `.env`. */
  workspace: string;
}

/** One collected file destined for the archive. */
export interface ArchiveEntry {
  /** Archive path, `<role>/...` relative to the data root, POSIX separators. */
  path: string;
  /** Absolute source path on disk. */
  absolutePath: string;
  /** File size in bytes. */
  size: number;
}

/** Manifest written as the first entry of every backup archive. */
export interface BackupManifest {
  /** Manifest format version; readers reject unknown values. */
  manifestVersion: 1;
  /** The group this archive belongs to. */
  group: BackupGroupId;
  /** Creation time in ISO-8601. */
  createdAt: string;
  /** Number of file entries after the manifest. */
  fileCount: number;
  /** Sum of collected file sizes in bytes. */
  totalBytes: number;
}

/** Remote protocol and addressing for one backup destination. */
export type DestinationConfig =
  | {
      /** Discriminant. */
      protocol: 'smb';
      /** UNC, mapped-drive, or mounted-share path written through the OS SMB stack. */
      root: string;
    }
  | {
      /** Discriminant. */
      protocol: 'webdav';
      /** Base URL such as `https://dav.example.com/dav`. */
      endpoint: string;
      /** Account name sent with Basic auth. */
      username: string;
      /** Directory under the endpoint that holds `easel-backup/`. */
      remoteDir: string;
    }
  | {
      /** Discriminant. */
      protocol: 's3';
      /** API endpoint; defaults to `https://s3.<region>.amazonaws.com`. */
      endpoint?: string;
      /** S3 region. */
      region: string;
      /** Bucket name. */
      bucket: string;
      /** Path-style addressing (required by MinIO and most S3-compatible NAS gateways). */
      pathStyle: boolean;
    };

/** Secret material one destination needs, resolved from the credentials store. */
export type DestinationSecrets =
  | {
      /** Discriminant. */
      protocol: 'smb';
    }
  | {
      /** Discriminant. */
      protocol: 'webdav';
      /** Basic-auth password. */
      password: string;
    }
  | {
      /** Discriminant. */
      protocol: 's3';
      /** Access key id. */
      accessKeyId: string;
      /** Secret access key. */
      secretAccessKey: string;
    };

/** One object stored under a destination. */
export interface RemoteObject {
  /** Key relative to the destination root. */
  key: string;
  /** Object size in bytes. */
  size: number;
}

/** Storage seam implemented once per protocol. */
export interface Destination {
  /** Verify reachability and create the remote base directory when missing. */
  probe(): Promise<void>;
  /**
   * Store one object.
   * @param key - Key relative to the destination root, POSIX separators.
   * @param source - Local file path (streamed, never fully buffered) or in-memory bytes.
   */
  put(key: string, source: string | Uint8Array): Promise<void>;
  /**
   * Read one object.
   * @param key - Key relative to the destination root.
   * @returns The object body as a byte stream.
   * @throws {@link BackupError} with code `DESTINATION_MISSING` when the object does not exist.
   */
  get(key: string): Promise<ReadableStream<Uint8Array>>;
  /**
   * List objects under a key prefix.
   * @param prefix - Key prefix, POSIX separators.
   * @returns Every object whose key starts with the prefix.
   */
  list(prefix: string): Promise<RemoteObject[]>;
  /**
   * Delete one object; deleting an absent object succeeds.
   * @param key - Key relative to the destination root.
   */
  del(key: string): Promise<void>;
}

/** Phases of one group backup run, reported through {@link BackupProgress}. */
export type BackupPhase = 'collect' | 'archive' | 'upload' | 'prune';

/** Live progress of one group backup run. */
export interface BackupProgress {
  /** The group being backed up. */
  group: BackupGroupId;
  /** UTC stamp naming this run. */
  stamp: string;
  /** Current phase. */
  phase: BackupPhase;
  /** Collected file count, meaningful from `archive` on. */
  fileCount: number;
  /** Collected byte total, meaningful from `archive` on. */
  totalBytes: number;
  /** Bytes written to the archive so far. */
  writtenBytes: number;
}

/** Outcome of one completed group backup. */
export interface BackupRunResult {
  /** The group that was backed up. */
  group: BackupGroupId;
  /** UTC stamp naming the run. */
  stamp: string;
  /** Archived file count. */
  fileCount: number;
  /** Archived byte total. */
  totalBytes: number;
  /** Wall-clock duration of the whole run. */
  durationMs: number;
  /** Remote keys removed by retention pruning. */
  pruned: string[];
}

/** One archived backup on a destination. */
export interface RemoteBackup {
  /** Full key of the archive object. */
  key: string;
  /** The group the archive belongs to. */
  group: BackupGroupId;
  /** UTC stamp parsed from the key. */
  stamp: string;
  /** Archive size in bytes. */
  size: number;
}

/** One archive file mapped to its staging copy and its restore target. */
export interface RestoreFile {
  /** Archive path, `<role>/...`. */
  path: string;
  /** Staging file holding the verified content. */
  stagingPath: string;
  /** Uncompressed size in bytes. */
  size: number;
  /** Absolute target path on disk. */
  targetPath: string;
}

/** Verified restore plan produced by `planRestore` and consumed by `applyRestore`. */
export interface RestorePlan {
  /** The group being restored. */
  group: BackupGroupId;
  /** UTC stamp of the archive. */
  stamp: string;
  /** Manifest read from the archive. */
  manifest: BackupManifest;
  /** Files that will be overwritten on apply. */
  files: RestoreFile[];
  /** Archive paths whose role does not exist on this data root; apply skips them. */
  skipped: string[];
  /** Directory holding the extracted staging files; removed by apply or discard. */
  stagingDir: string;
}
