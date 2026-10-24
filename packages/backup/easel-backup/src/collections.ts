import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArchiveEntry, BackupGroupId, BackupRoots } from './types.js';

/** Directory names never traversed anywhere: deployment-owned plugin stores. */
const EXCLUDED_DIRECTORY_NAMES = new Set(['node_modules', '.dsh-module-fallback']);

/** File names never collected: migration and temp-write stragglers. */
const EXCLUDED_FILE_NAMES = new Set(['.easel-migrating']);

/** Suffix marking an in-flight atomic write; the rename target is the real file. */
const TEMP_SUFFIX = '.tmp';

/** Extensions archived with deflate level 0: already-compressed content. */
export const STORE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.mp4', '.mov', '.webm', '.m4v', '.mkv', '.avi',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.heic', '.ico',
  '.zip', '.zst', '.7z', '.gz', '.xz', '.woff2',
]);

/**
 * Pick the deflate level for one archive path: media and already-compressed
 * content store verbatim, everything else deflates.
 * @param path - Archive path whose extension decides the level.
 * @returns 0 for incompressible content, otherwise 6.
 */
export function levelForPath(path: string): 0 | 6 {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 6;
  return STORE_EXTENSIONS.has(path.slice(dot).toLowerCase()) ? 0 : 6;
}

/**
 * Format a UTC stamp that names one backup run: `yyyymmddThhmmssZ`. The
 * lexicographic order of stamps is their chronological order.
 * @param date - Moment to format.
 * @returns The compact UTC stamp.
 */
export function stampFor(date: Date): string {
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}` +
    `T${pad(date.getUTCHours(), 2)}${pad(date.getUTCMinutes(), 2)}${pad(date.getUTCSeconds(), 2)}Z`
  );
}

/** POSIX archive path of one collected file; prefix is always non-empty. */
function entryPath(role: string, prefix: string, name: string): string {
  return `${role}/${prefix}/${name}`;
}

/**
 * Recursively collect files under one directory. Symbolic links and junctions
 * are skipped outright — the data root keeps junctions aliasing app-owned
 * runtime directories, and traversing them would copy the same bytes twice.
 * A missing root (fresh install, feature not yet used) yields nothing instead
 * of failing the run; any other read error propagates. Every non-directory
 * child is collected; exotic dirent kinds fail the archive read later, loudly.
 * @param role - Role prefix for archive paths.
 * @param absoluteRoot - Directory to walk.
 * @param prefix - Non-empty path under the role, POSIX separators.
 * @param entries - Collector to append to.
 */
async function collectDirectory(
  role: 'home' | 'workspace',
  absoluteRoot: string,
  prefix: string,
  entries: ArchiveEntry[],
): Promise<void> {
  let children;
  try {
    children = await readdir(absoluteRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  for (const child of children) {
    if (child.isSymbolicLink()) continue;
    const childPath = join(absoluteRoot, child.name);
    if (child.isDirectory()) {
      if (EXCLUDED_DIRECTORY_NAMES.has(child.name)) continue;
      await collectDirectory(role, childPath, `${prefix}/${child.name}`, entries);
      continue;
    }
    if (EXCLUDED_FILE_NAMES.has(child.name) || child.name.endsWith(TEMP_SUFFIX)) continue;
    const size = (await stat(childPath)).size;
    entries.push({ path: entryPath(role, prefix, child.name), absolutePath: childPath, size });
  }
}

/** Collect one top-level file when it exists. */
async function collectFile(role: 'home' | 'workspace', absolutePath: string, name: string, entries: ArchiveEntry[]): Promise<void> {
  try {
    const size = (await stat(absolutePath)).size;
    entries.push({ path: `${role}/${name}`, absolutePath, size });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}

/**
 * Collect the workspace half of the `config` group: env file, personas,
 * skill catalog, and the outputs state stores (top-level JSON plus `_login`).
 * @param workspaceRoot - Easel workspace root.
 * @param entries - Collector to append to.
 */
async function collectWorkspaceConfig(workspaceRoot: string, entries: ArchiveEntry[]): Promise<void> {
  await collectFile('workspace', join(workspaceRoot, '.env'), '.env', entries);
  await collectDirectory('workspace', join(workspaceRoot, 'profiles'), 'profiles', entries);
  await collectDirectory('workspace', join(workspaceRoot, 'skills'), 'skills', entries);
  let children;
  try {
    children = await readdir(join(workspaceRoot, 'outputs'), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  for (const child of children) {
    if (child.isFile() && child.name.endsWith('.json') && !child.name.endsWith(TEMP_SUFFIX) && !EXCLUDED_FILE_NAMES.has(child.name)) {
      const absolutePath = join(workspaceRoot, 'outputs', child.name);
      const size = (await stat(absolutePath)).size;
      entries.push({ path: entryPath('workspace', 'outputs', child.name), absolutePath, size });
      continue;
    }
    if (child.isDirectory() && child.name === '_login') {
      await collectDirectory('workspace', join(workspaceRoot, 'outputs', '_login'), 'outputs/_login', entries);
    }
  }
}

/**
 * Collect every file of one backup group per the scope table: `config` reads
 * profile patches, credentials, personas, skills, and state stores; `sessions`
 * reads session logs and durable attachments; `workspace` reads projects and
 * the full outputs tree.
 * @param roots - Data root directories to read from.
 * @param group - The group to collect.
 * @returns The collected entries in walk order.
 */
export async function collectGroup(roots: BackupRoots, group: BackupGroupId): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];
  if (group === 'config') {
    await collectDirectory('home', join(roots.home, 'profiles'), 'profiles', entries);
    await collectFile('home', join(roots.home, '.credentials.yaml'), '.credentials.yaml', entries);
    await collectWorkspaceConfig(roots.workspace, entries);
  } else if (group === 'sessions') {
    await collectDirectory('home', join(roots.home, 'sessions'), 'sessions', entries);
    await collectDirectory('home', join(roots.home, 'attachments', 'v1'), 'attachments/v1', entries);
  } else {
    await collectDirectory('workspace', join(roots.workspace, 'projects'), 'projects', entries);
    await collectDirectory('workspace', join(roots.workspace, 'outputs'), 'outputs', entries);
  }
  return entries;
}

/** POSIX separators for an on-disk relative path (no-op on POSIX). */
export function toPosixPath(value: string): string {
  return value.split('\\').join('/');
}
