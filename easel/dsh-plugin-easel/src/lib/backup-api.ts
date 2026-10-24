// Backup API client: shapes mirror the host's /easel/api/backup/* routes.
const BASE = '/easel/api/backup';

/** Backup scope groups, mirroring the engine's ids. */
export type BackupGroupId = 'config' | 'sessions' | 'workspace';

/** Protocol and addressing of the active destination. */
export interface BackupConfig {
  version: number;
  protocol: 'webdav' | 's3' | 'smb';
  endpoint: string;
  username: string;
  remoteDir: string;
  region: string;
  bucket: string;
  pathStyle: boolean;
  root: string;
  groups: Record<BackupGroupId, boolean>;
  encryption: { enabled: boolean };
  schedule: { mode: 'off' | 'daily' | 'weekly'; at: string; weekday: number };
  retention: number;
  lastRunAt: number | null;
}

/** Which secrets exist in the credentials store; values never come back. */
export interface BackupSecretsPresence {
  webdavPassword: boolean;
  s3Keys: boolean;
  smbPassword: boolean;
  passphrase: boolean;
}

/** Secrets the client may submit; absent fields leave the stored value alone. */
export interface BackupSecretsInput {
  webdavPassword?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  smbPassword?: string;
  passphrase?: string;
}

/** One archived backup on the destination. */
export interface RemoteBackupItem {
  stamp: string;
  size: number;
  key: string;
}

/** Live progress of the running backup. */
export interface BackupProgressView {
  group: BackupGroupId;
  stamp: string;
  phase: 'collect' | 'archive' | 'upload' | 'prune';
  fileCount: number;
  totalBytes: number;
}

/** One history entry as the status route reports it. */
export interface BackupHistoryEntry {
  startedAt: number;
  finishedAt: number;
  trigger: 'manual' | 'schedule';
  status: 'completed' | 'failed';
  error?: string;
  groups: Array<{ group: BackupGroupId; stamp: string; fileCount: number; totalBytes: number; durationMs: number }>;
}

/** Status projection rendered by the settings section. */
export interface BackupStatusView {
  busy: boolean;
  progress: BackupProgressView | null;
  lastRunAt: number | null;
  enabledGroups: BackupGroupId[];
  history: BackupHistoryEntry[];
}

/** Verified restore plan preview before the user confirms the overwrite. */
export interface RestorePlanView {
  group: BackupGroupId;
  stamp: string;
  createdAt: string;
  fileCount: number;
  bytes: number;
  skipped: number;
  preview: Array<{ path: string; size: number }>;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, { cache: 'no-store', ...options });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.message ?? '';
    } catch {
      /* 错误体不是 JSON 时保留空 detail */
    }
    throw new Error(detail || `请求失败（${res.status} ${res.statusText}）`);
  }
  return res.json() as Promise<T>;
}

/** @returns The stored configuration plus secret presence. */
export function getBackupConfig(): Promise<{ config: BackupConfig; secrets: BackupSecretsPresence; engineReady: boolean }> {
  return request('/config');
}

/**
 * Persist the configuration and any provided secrets.
 * @param config - The full configuration document.
 * @param secrets - Secrets to store; absent fields keep the stored values.
 */
export function putBackupConfig(config: BackupConfig, secrets: BackupSecretsInput): Promise<{ config: BackupConfig; secrets: BackupSecretsPresence }> {
  return request('/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config, secrets }) });
}

/** Probe the destination; resolves or throws with the protocol error. */
export function testBackupDestination(): Promise<{ ok: true }> {
  return request('/test', { method: 'POST' });
}

/**
 * Start backing up the given groups in the background.
 * @param groups - Group ids to back up now.
 */
export function runBackup(groups: BackupGroupId[]): Promise<{ started: true; groups: BackupGroupId[] }> {
  return request('/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groups }) });
}

/** @returns The live status projection. */
export function getBackupStatus(): Promise<BackupStatusView> {
  return request('/status');
}

/** @returns Archived backups per group, newest first. */
export function listRemoteBackups(): Promise<{ groups: Record<BackupGroupId, RemoteBackupItem[]> }> {
  return request('/remote');
}

/**
 * Plan or apply one restore.
 * @param group - The group to restore.
 * @param stamp - The archive stamp.
 * @param confirm - False previews the plan; true overwrites live files.
 */
export function restoreBackup(group: BackupGroupId, stamp: string, confirm: boolean): Promise<{ plan?: RestorePlanView; applied?: number; skipped?: string[] }> {
  return request('/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ group, stamp, confirm }) });
}

/**
 * Wire Windows SMB credentials for the destination share.
 * @param root - UNC path such as `\\\\server\\share`.
 * @param username - Account name; empty uses the current session.
 * @param password - Account password; required when a username is given.
 */
export function connectSmb(root: string, username: string, password: string): Promise<{ ok: true }> {
  return request('/connect-smb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root, username, password }) });
}
