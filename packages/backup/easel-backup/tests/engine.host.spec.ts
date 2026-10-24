/**
 * backup engine host path: one group run collects, archives, uploads, and
 * prunes against an in-memory destination; encryption wraps the archive;
 * failures clean up the remote object; malformed options fail loudly.
 */

import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { backupKey, listBackups, parseBackupKey, pruneGroup, runBackupGroup } from '../src/engine.ts'
import { decryptFileTo, extractBackupArchive } from '../src/index.ts'
import { BackupError } from '../src/errors.ts'
import type { BackupProgress, Destination, RemoteObject } from '../src/index.ts'

const NOW = new Date('2026-10-24T09:30:05Z')

class MemoryDestination implements Destination {
  readonly objects = new Map<string, Buffer>()
  readonly deleted: string[] = []
  failNextPut = false
  failDelete = false

  async probe(): Promise<void> {}

  async put(key: string, source: string | Uint8Array): Promise<void> {
    if (this.failNextPut) throw new Error('upload blew up')
    this.objects.set(key, typeof source === 'string' ? await readFile(source) : Buffer.from(source))
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const data = this.objects.get(key)
    if (data === undefined) throw new BackupError('DESTINATION_MISSING', `没有 ${key}`)
    return new Response(new Uint8Array(data)).body as ReadableStream<Uint8Array>
  }

  async list(prefix: string): Promise<RemoteObject[]> {
    return [...this.objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, data]) => ({ key, size: data.length }))
  }

  async del(key: string): Promise<void> {
    this.deleted.push(key)
    if (this.failDelete) throw new Error('delete blew up too')
    this.objects.delete(key)
  }
}

/** A data root with one home file and one workspace file. */
async function roots(): Promise<{ base: string; home: string; workspace: string }> {
  const base = await mkdtemp(join(tmpdir(), 'easel-backup-engine-'))
  const home = join(base, 'home')
  const workspace = join(base, 'workspace')
  await mkdir(join(home, 'profiles'), { recursive: true })
  await mkdir(join(home, 'sessions', 'proj', 's1'), { recursive: true })
  await mkdir(workspace, { recursive: true })
  await writeFile(join(home, 'profiles', 'cordis.patch.yml'), 'insert: []')
  await writeFile(join(home, '.credentials.yaml'), 'version: 1')
  await writeFile(join(home, 'sessions', 'proj', 's1', 'session.jsonl'), 'log')
  await writeFile(join(workspace, '.env'), 'KEY=1')
  return { base, home, workspace }
}

describe('runBackupGroup', () => {
  it('collects, archives, uploads, and reports the progress phases', async () => {
    const { base, home, workspace } = await roots()
    const destination = new MemoryDestination()
    const phases: BackupProgress['phase'][] = []
    const result = await runBackupGroup({
      destination,
      roots: { home, workspace },
      group: 'config',
      remoteDir: '',
      retention: 10,
      encryption: { enabled: false },
      stagingDir: join(base, 'staging'),
      now: NOW,
      onProgress: progress => phases.push(progress.phase),
    })
    expect(phases).toEqual(['collect', 'archive', 'upload', 'prune'])
    expect(result.group).toBe('config')
    expect(result.stamp).toBe('20261024T093005Z')
    expect(result.fileCount).toBe(3)
    const extracted = await extractBackupArchive(
      await writeOut(base, destination, backupKey('', 'config', result.stamp)),
      join(base, 'extract'),
    )
    expect(extracted.manifest.fileCount).toBe(3)
    expect(extracted.manifest.totalBytes).toBeGreaterThan(0)
    await rm(base, { recursive: true, force: true })
  })

  it('keeps only the newest retention archives per group, deleting oldest first', async () => {
    const { base, home, workspace } = await roots()
    const destination = new MemoryDestination()
    await destination.put('easel-backup/config/20260101T000000Z.zip', Buffer.from('old1'))
    await destination.put('easel-backup/config/20260102T000000Z.zip', Buffer.from('old2'))
    await destination.put('easel-backup/sessions/20260101T000000Z.zip', Buffer.from('other group'))
    await runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 2,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })
    expect([...destination.objects.keys()].sort()).toEqual([
      'easel-backup/config/20260102T000000Z.zip',
      'easel-backup/config/20261024T093005Z.zip',
      'easel-backup/sessions/20260101T000000Z.zip',
    ].sort())
    expect(destination.deleted).toEqual(['easel-backup/config/20260101T000000Z.zip'])
    await rm(base, { recursive: true, force: true })
  })

  it('encrypts the archive when enabled and cleans up staging', async () => {
    const { base, home, workspace } = await roots()
    const destination = new MemoryDestination()
    const result = await runBackupGroup({
      destination, roots: { home, workspace }, group: 'sessions', remoteDir: 'sites', retention: 5,
      encryption: { enabled: true, passphrase: 'secret' }, stagingDir: join(base, 'staging'), now: NOW,
    })
    const container = destination.objects.get(backupKey('sites', 'sessions', result.stamp))
    expect(container).toBeDefined()
    expect(container!.subarray(0, 8).toString('ascii')).toBe('EASELBAK')
    const plain = join(base, 'plain.zip')
    await decryptFileTo(await writeOut(base, destination, backupKey('sites', 'sessions', result.stamp)), plain, 'secret')
    const extracted = await extractBackupArchive(plain, join(base, 'extract'))
    expect(extracted.files.length).toBeGreaterThan(0)
    await rm(base, { recursive: true, force: true })
  })

  it('deletes the remote object when the upload fails mid-flight', async () => {
    const { base, home, workspace } = await roots()
    const destination = new MemoryDestination()
    destination.failNextPut = true
    await expect(runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })).rejects.toThrow('upload blew up')
    expect(destination.deleted).toEqual(['easel-backup/config/20261024T093005Z.zip'])
    expect(destination.objects.size).toBe(0)
    await rm(base, { recursive: true, force: true })
  })

  it('rejects a retention below one and encryption without a passphrase', async () => {
    const { base, home, workspace } = await roots()
    const destination = new MemoryDestination()
    await expect(runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 0,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'),
    })).rejects.toMatchObject({ code: 'CONFIG' })
    await expect(runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: true }, stagingDir: join(base, 'staging'),
    })).rejects.toMatchObject({ code: 'CONFIG' })
    await rm(base, { recursive: true, force: true })
  })
})

describe('key and listing helpers', () => {
  it('backupKey handles an empty and a non-empty remote dir', () => {
    expect(backupKey('', 'config', '20261024T093005Z')).toBe('easel-backup/config/20261024T093005Z.zip')
    expect(backupKey('sites/nas', 'sessions', '20261024T093005Z')).toBe('sites/nas/easel-backup/sessions/20261024T093005Z.zip')
  })

  it('parseBackupKey accepts group archives and rejects everything else', () => {
    expect(parseBackupKey('easel-backup/config/20261024T093005Z.zip')).toEqual({ group: 'config', stamp: '20261024T093005Z' })
    expect(parseBackupKey('easel-backup/nope/20261024T093005Z.zip')).toBeNull()
    expect(parseBackupKey('random.bin')).toBeNull()
  })

  it('listBackups lists every group newest first', async () => {
    const destination = new MemoryDestination()
    await destination.put('easel-backup/config/20260102T000000Z.zip', Buffer.from('a'))
    await destination.put('easel-backup/sessions/20260103T000000Z.zip', Buffer.from('b'))
    await destination.put('easel-backup/config/20260101T000000Z.zip', Buffer.from('c'))
    expect(await listBackups(destination, '')).toEqual([
      { key: 'easel-backup/sessions/20260103T000000Z.zip', group: 'sessions', stamp: '20260103T000000Z', size: 1 },
      { key: 'easel-backup/config/20260102T000000Z.zip', group: 'config', stamp: '20260102T000000Z', size: 1 },
      { key: 'easel-backup/config/20260101T000000Z.zip', group: 'config', stamp: '20260101T000000Z', size: 1 },
    ])
  })

  it('pruneGroup deletes beyond retention and validates the count', async () => {
    const destination = new MemoryDestination()
    for (const stamp of ['20260101T000000Z', '20260102T000000Z', '20260103T000000Z']) {
      await destination.put(`easel-backup/config/${stamp}.zip`, Buffer.from(stamp))
    }
    expect(await pruneGroup(destination, '', 'config', 2)).toEqual(['easel-backup/config/20260101T000000Z.zip'])
    await expect(pruneGroup(destination, '', 'config', 0)).rejects.toMatchObject({ code: 'CONFIG' })
  })
})

/** Pull one object out of the memory destination onto a real file for the extract helpers. */
async function writeOut(base: string, destination: MemoryDestination, key: string): Promise<string> {
  const path = join(base, `${key.replaceAll('/', '-')}.out`)
  await writeFile(path, destination.objects.get(key)!)
  return path
}

describe('runBackupGroup cleanup and remoteDir forms', () => {
  it('listBackups and prune respect a non-empty remoteDir', async () => {
    const destination = new MemoryDestination()
    await destination.put('sites/easel-backup/config/20260102T000000Z.zip', Buffer.from('a'))
    expect(await listBackups(destination, 'sites')).toEqual([
      { key: 'sites/easel-backup/config/20260102T000000Z.zip', group: 'config', stamp: '20260102T000000Z', size: 1 },
    ])
    expect(await pruneGroup(destination, 'sites', 'config', 5)).toEqual([])
  })

  it('a failed cleanup delete after a failed upload does not mask the upload error', async () => {
    const { base, home, workspace } = await roots()
    const destination = new MemoryDestination()
    destination.failNextPut = true
    destination.failDelete = true
    await expect(runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'),
    })).rejects.toThrow('upload blew up')
    await rm(base, { recursive: true, force: true })
  })

  it('a write-protected staging directory fails the run but still reports (posix only)', async () => {
    if (process.platform === 'win32') return
    const { base, home, workspace } = await roots()
    await mkdir(join(base, 'staging'), { recursive: true })
    await chmod(join(base, 'staging'), 0o500)
    const destination = new MemoryDestination()
    await expect(runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })).rejects.toThrow()
    await chmod(join(base, 'staging'), 0o700)
    await rm(base, { recursive: true, force: true })
  })
})

describe('listing edge cases', () => {
  it('foreign keys are skipped and equal stamps sort stably', async () => {
    const destination = new MemoryDestination()
    await destination.put('easel-backup/config/20260101T000000Z.zip', Buffer.from('a'))
    await destination.put('easel-backup/sessions/20260101T000000Z.zip', Buffer.from('b'))
    await destination.put('easel-backup/config/readme.txt', Buffer.from('not an archive'))
    await destination.put('easel-backup/config/nested/20260101T000000Z.zip', Buffer.from('nested under a group'))
    const listed = await listBackups(destination, '')
    // 外来 key 与嵌套 key 都不算组归档；两个同 stamp 的组并列时保持稳定顺序。
    expect(listed.map(backup => backup.group)).toEqual(['config', 'sessions'])
  })

  it('a staging target occupied by a directory fails the run and the cleanup (EISDIR)', async () => {
    const { base, home, workspace } = await roots()
    await mkdir(join(base, 'staging'), { recursive: true })
    await mkdir(join(base, 'staging', 'config-20261024T093005Z.zip'), { recursive: true })
    const destination = new MemoryDestination()
    await expect(runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })).rejects.toThrow()
    expect(destination.objects.size).toBe(0)
    await rm(base, { recursive: true, force: true })
  })
})
