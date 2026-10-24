import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { collectGroup, stampFor } from './collections.js';
import { writeBackupArchive } from './archive.js';
import { encryptFileTo } from './crypto.js';
import { BackupError } from './errors.js';
import type { BackupGroupId, BackupProgress, BackupRoots, BackupRunResult, Destination, RemoteBackup } from './types.js';

/** Groups kept per group when no explicit retention is configured. */
export const DEFAULT_RETENTION = 10;

/** Everything one group backup run needs. */
export interface BackupRunOptions {
  /** Destination seam to upload through. */
  destination: Destination;
  /** Data root directories to read from. */
  roots: BackupRoots;
  /** The group to back up. */
  group: BackupGroupId;
  /** Destination directory holding `easel-backup/`, e.g. `sites` or `` (empty = destination root). */
  remoteDir: string;
  /** How many archives to keep per group. */
  retention: number;
  /** Encryption switch and passphrase; enabled without a passphrase is a config error. */
  encryption: { enabled: boolean; passphrase?: string };
  /** Local directory for staging files; created when missing. */
  stagingDir: string;
  /** Clock override for tests. */
  now?: Date;
  /** Progress sink, called at phase transitions. */
  onProgress?: (progress: BackupProgress) => void;
}

/**
 * Compose the remote key of one group archive.
 * @param remoteDir - Destination directory or '' for the destination root.
 * @param group - The group the archive belongs to.
 * @param stamp - UTC stamp of the run.
 * @returns The full key, e.g. `easel-backup/config/20261024T093000Z.zip`.
 */
export function backupKey(remoteDir: string, group: BackupGroupId, stamp: string): string {
  const dir = remoteDir.replace(/^\/+|\/+$/g, '');
  return dir === '' ? `easel-backup/${group}/${stamp}.zip` : `${dir}/easel-backup/${group}/${stamp}.zip`;
}

/**
 * Parse the group and stamp out of one archive key.
 * @param key - Full key on the destination.
 * @returns The parsed backup, or null when the key is not a group archive.
 */
export function parseBackupKey(key: string): { group: BackupGroupId; stamp: string } | null {
  const match = /(?:^|\/)easel-backup\/(config|sessions|workspace)\/(\d{8}T\d{6}Z)\.zip$/.exec(key);
  if (match === null) return null;
  // 组名与时间戳由正则保证存在；时间戳固定 15 字符，右起第 5 到第 15 位。
  return { group: match[1] as BackupGroupId, stamp: key.slice(key.length - 20, key.length - 4) };
}

/**
 * List every group archive on the destination, newest first.
 * @param destination - Destination seam to list through.
 * @param remoteDir - Destination directory or '' for the destination root.
 * @returns All archives across the three groups, newest stamp first.
 */
export async function listBackups(destination: Destination, remoteDir: string): Promise<RemoteBackup[]> {
  const prefixDir = remoteDir.replace(/^\/+|\/+$/g, '');
  const prefix = prefixDir === '' ? 'easel-backup/' : `${prefixDir}/easel-backup/`;
  const objects = await destination.list(prefix);
  const backups: RemoteBackup[] = [];
  for (const object of objects) {
    const parsed = parseBackupKey(object.key);
    if (parsed === null) continue;
    backups.push({ key: object.key, group: parsed.group, stamp: parsed.stamp, size: object.size });
  }
  return backups.sort((left, right) => (left.stamp < right.stamp ? 1 : left.stamp > right.stamp ? -1 : 0));
}

/**
 * Delete archives beyond the retention count of one group, oldest first.
 * @param destination - Destination seam to delete through.
 * @param remoteDir - Destination directory or '' for the destination root.
 * @param group - The group to prune.
 * @param retention - How many newest archives to keep.
 * @returns The keys that were deleted.
 */
export async function pruneGroup(destination: Destination, remoteDir: string, group: BackupGroupId, retention: number): Promise<string[]> {
  if (!Number.isInteger(retention) || retention < 1) {
    throw new BackupError('CONFIG', `保留份数必须是正整数：${String(retention)}`);
  }
  const prefixDir = remoteDir.replace(/^\/+|\/+$/g, '');
  const prefix = prefixDir === '' ? `easel-backup/${group}/` : `${prefixDir}/easel-backup/${group}/`;
  const objects = await destination.list(prefix);
  const stamps = objects
    .map(object => parseBackupKey(object.key))
    .filter((parsed): parsed is { group: BackupGroupId; stamp: string } => parsed !== null && parsed.group === group)
    .map(parsed => parsed.stamp)
    .sort()
    .reverse();
  const pruned: string[] = [];
  for (const stamp of stamps.slice(retention)) {
    const key = backupKey(remoteDir, group, stamp);
    await destination.del(key);
    pruned.push(key);
  }
  return pruned;
}

/**
 * Run one group backup: collect, archive, optionally encrypt, upload, prune.
 * The staging file is removed no matter how the run ends; a failed upload
 * leaves no half-written remote object behind.
 * @param options - Everything the run needs.
 * @returns The run outcome, including retention deletions.
 */
export async function runBackupGroup(options: BackupRunOptions): Promise<BackupRunResult> {
  const started = Date.now();
  if (!Number.isInteger(options.retention) || options.retention < 1) {
    throw new BackupError('CONFIG', `保留份数必须是正整数：${String(options.retention)}`);
  }
  const passphrase = options.encryption.passphrase ?? '';
  if (options.encryption.enabled && passphrase.length === 0) {
    throw new BackupError('CONFIG', '加密已开启但未提供口令');
  }
  const now = options.now ?? new Date();
  const stamp = stampFor(now);
  const report = (phase: BackupProgress['phase'], fileCount = 0, totalBytes = 0): void => {
    options.onProgress?.({ group: options.group, stamp, phase, fileCount, totalBytes, writtenBytes: 0 });
  };
  report('collect');
  const entries = await collectGroup(options.roots, options.group);
  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  report('archive', entries.length, totalBytes);
  const manifest = {
    manifestVersion: 1 as const,
    group: options.group,
    createdAt: now.toISOString(),
    fileCount: entries.length,
    totalBytes,
  };
  const stagingZip = join(options.stagingDir, `${options.group}-${stamp}.zip`);
  let uploadPath = stagingZip;
  try {
    await writeBackupArchive(entries, manifest, stagingZip);
    if (options.encryption.enabled) {
      const encrypted = `${stagingZip}.enc`;
      await encryptFileTo(stagingZip, encrypted, passphrase);
      await rm(stagingZip, { force: true });
      uploadPath = encrypted;
    }
    report('upload');
    const key = backupKey(options.remoteDir, options.group, stamp);
    try {
      await options.destination.put(key, uploadPath);
    } catch (error) {
      await options.destination.del(key).catch(() => {});
      throw error;
    }
  } finally {
    await rm(uploadPath, { force: true }).catch(() => {});
  }
  report('prune');
  const pruned = await pruneGroup(options.destination, options.remoteDir, options.group, options.retention);
  return {
    group: options.group,
    stamp,
    fileCount: entries.length,
    totalBytes,
    durationMs: Date.now() - started,
    pruned,
  };
}
