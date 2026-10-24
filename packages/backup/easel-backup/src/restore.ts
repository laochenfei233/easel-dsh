import { createWriteStream } from 'node:fs';
import { chmod, copyFile, mkdir, open, rename, rm } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { BackupError } from './errors.js';
import { extractBackupArchive } from './archive.js';
import { decryptFileTo, isEncryptedArchive } from './crypto.js';
import { backupKey } from './engine.js';
import type { BackupGroupId, BackupRoots, Destination, RestoreFile, RestorePlan } from './types.js';

/** Bytes read from the head of a downloaded archive to detect encryption. */
const HEAD_BYTES = 9;

/** Everything one restore plan needs. */
export interface PlanRestoreOptions {
  /** Destination seam to download through. */
  destination: Destination;
  /** Destination directory or '' for the destination root. */
  remoteDir: string;
  /** Data root directories to map roles onto. */
  roots: BackupRoots;
  /** The group to restore. */
  group: BackupGroupId;
  /** UTC stamp of the archive. */
  stamp: string;
  /** Local directory for staging; created when missing. */
  stagingDir: string;
  /** Passphrase for encrypted archives; required when the archive is encrypted. */
  passphrase?: string;
}

/**
 * Open a file for one positional read.
 * @param path - File to open.
 * @returns The file handle; the caller closes it.
 */
async function openHead(path: string): Promise<FileHandle> {
  return open(path, 'r');
}

/**
 * Download one archive, verify it end to end, and map every entry onto its
 * restore target without touching live files. The plan is consumable by
 * {@link applyRestore} or dropped with {@link discardRestore}; a failed plan
 * removes its own staging directory.
 * @param options - Everything the plan needs.
 * @returns The verified restore plan.
 */
export async function planRestore(options: PlanRestoreOptions): Promise<RestorePlan> {
  const passphrase = options.passphrase ?? '';
  const key = backupKey(options.remoteDir, options.group, options.stamp);
  const stagingDir = join(options.stagingDir, `restore-${options.group}-${options.stamp}`);
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  const downloadPath = join(stagingDir, 'archive.zip');
  const plainPath = join(stagingDir, 'archive-plain.zip');
  try {
    await pipeline(Readable.fromWeb(await options.destination.get(key)), createWriteStream(downloadPath));
    let archivePath = downloadPath;
    const head = Buffer.alloc(HEAD_BYTES);
    const handle = await openHead(downloadPath);
    try {
      await handle.read(head, 0, HEAD_BYTES, 0);
    } finally {
      await handle.close();
    }
    if (isEncryptedArchive(head)) {
      if (passphrase.length === 0) {
        throw new BackupError('CONFIG', '该备份已加密，需要口令才能恢复');
      }
      await decryptFileTo(downloadPath, plainPath, passphrase);
      archivePath = plainPath;
    }
    const extracted = await extractBackupArchive(archivePath, join(stagingDir, 'files'));
    const files: RestoreFile[] = [];
    const skipped: string[] = [];
    for (const file of extracted.files) {
      const separator = file.path.indexOf('/');
      const role = separator < 0 ? '' : file.path.slice(0, separator);
      const rest = separator < 0 ? '' : file.path.slice(separator + 1);
      const base = role === 'home' ? options.roots.home : role === 'workspace' ? options.roots.workspace : undefined;
      if (base === undefined || rest === '') {
        skipped.push(file.path);
        continue;
      }
      files.push({ ...file, targetPath: join(base, ...rest.split('/')) });
    }
    return { group: options.group, stamp: options.stamp, manifest: extracted.manifest, files, skipped, stagingDir };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Overwrite the live files of a verified plan: every target is written to a
 * temporary sibling and renamed into place, so a crash mid-apply leaves either
 * the old or the new file, never a partial one. The staging copy is removed
 * after each file lands, and the whole staging directory goes once done.
 * @param plan - A plan produced by {@link planRestore}.
 * @param onFile - Progress sink called once per applied file.
 * @returns The number of files applied and the paths skipped.
 */
export async function applyRestore(plan: RestorePlan, onFile?: (path: string) => void): Promise<{ applied: number; skipped: string[] }> {
  let applied = 0;
  for (const file of plan.files) {
    await mkdir(dirname(file.targetPath), { recursive: true });
    const temporary = `${file.targetPath}.restore-tmp`;
    await copyFile(file.stagingPath, temporary);
    await rename(temporary, file.targetPath);
    if (basename(file.targetPath) === '.credentials.yaml') {
      // POSIX 收紧到 0600；Windows 的 chmod 只影响只读位，0o600 无副作用。
      await chmod(file.targetPath, 0o600);
    }
    await rm(file.stagingPath, { force: true });
    applied += 1;
    onFile?.(file.path);
  }
  await rm(plan.stagingDir, { recursive: true, force: true }).catch(() => {});
  return { applied, skipped: plan.skipped };
}

/**
 * Drop a plan without touching live files.
 * @param plan - A plan produced by {@link planRestore}.
 */
export async function discardRestore(plan: RestorePlan): Promise<void> {
  await rm(plan.stagingDir, { recursive: true, force: true }).catch(() => {});
}
