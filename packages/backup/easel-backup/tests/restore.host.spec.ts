/**
 * backup restore host path: a plan downloads, verifies, and maps a real
 * archive onto the data root without touching live files; apply overwrites
 * atomically (credentials get 0600 on POSIX) and clears staging; encrypted
 * archives demand the passphrase; unknown roles are skipped, not applied.
 */

import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FsDestination } from '../src/destinations/fs.ts'
import { runBackupGroup } from '../src/engine.ts'
import { applyRestore, discardRestore, planRestore } from '../src/restore.ts'

const NOW = new Date('2026-10-24T09:30:05Z')

async function setup(): Promise<{
  base: string
  home: string
  workspace: string
  destination: FsDestination
}> {
  const base = await mkdtemp(join(tmpdir(), 'easel-backup-restore-'))
  const home = join(base, 'home')
  const workspace = join(base, 'workspace')
  await mkdir(join(home, 'profiles'), { recursive: true })
  await mkdir(join(workspace, 'projects'), { recursive: true })
  await writeFile(join(home, '.credentials.yaml'), 'version: 1\nrefs: {}\n')
  await writeFile(join(home, 'profiles', 'cordis.patch.yml'), 'insert: []\n')
  await writeFile(join(workspace, '.env'), 'KEY=1\n')
  await writeFile(join(workspace, 'projects', 'brief.md'), 'v1\n')
  const destination = new FsDestination(join(base, 'remote'))
  await destination.probe()
  return { base, home, workspace, destination }
}

describe('planRestore + applyRestore', () => {
  it('round-trips a real backup: plan previews, apply overwrites, staging clears', async () => {
    const { base, home, workspace, destination } = await setup()
    const result = await runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })
    await writeFile(join(home, 'profiles', 'cordis.patch.yml'), 'v2-drift')
    const plan = await planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'),
    })
    expect(plan.files.map(file => file.path).sort()).toEqual([
      'home/.credentials.yaml',
      'home/profiles/cordis.patch.yml',
      'workspace/.env',
    ])
    expect(plan.skipped).toEqual([])
    await applyRestore(plan)
    expect(await readFile(join(home, 'profiles', 'cordis.patch.yml'), 'utf8')).toBe('insert: []\n')
    await expect(stat(plan.stagingDir)).rejects.toMatchObject({ code: 'ENOENT' })
    if (process.platform !== 'win32') {
      expect((await stat(join(home, '.credentials.yaml'))).mode & 0o777).toBe(0o600)
    }
    await rm(base, { recursive: true, force: true })
  })

  it('skips entries whose role is unknown instead of writing them', async () => {
    const { base, home, workspace, destination } = await setup()
    const result = await runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })
    // 用一个手工归档把未知角色条目混进去，验证 plan 不落盘。
    const { writeBackupArchive } = await import('../src/archive.ts')
    const rogue = join(base, 'rogue.txt')
    await writeFile(rogue, 'rogue')
    await writeBackupArchive(
      [
        { path: 'other/rogue.txt', absolutePath: rogue, size: 5 },
        { path: 'stray', absolutePath: rogue, size: 5 },
      ],
      { manifestVersion: 1, group: 'config', createdAt: NOW.toISOString(), fileCount: 2, totalBytes: 10 },
      join(base, 'rogue.zip'),
    )
    await destination.put(`easel-backup/config/${result.stamp}.zip`, join(base, 'rogue.zip'))
    const plan = await planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'),
    })
    expect(plan.files).toEqual([])
    expect(plan.skipped).toEqual(['other/rogue.txt', 'stray'])
    await applyRestore(plan)
    await rm(base, { recursive: true, force: true })
  })

  it('demands the passphrase for encrypted archives and accepts the right one', async () => {
    const { base, home, workspace, destination } = await setup()
    const result = await runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: true, passphrase: 'secret' }, stagingDir: join(base, 'staging'), now: NOW,
    })
    await expect(planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'),
    })).rejects.toMatchObject({ code: 'CONFIG' })
    await expect(planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'), passphrase: 'wrong',
    })).rejects.toMatchObject({ code: 'DECRYPT_FAILED' })
    const plan = await planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'), passphrase: 'secret',
    })
    expect(plan.files.length).toBeGreaterThan(0)
    await discardRestore(plan)
    await expect(stat(plan.stagingDir)).rejects.toMatchObject({ code: 'ENOENT' })
    await rm(base, { recursive: true, force: true })
  })

  it('a missing archive fails with DESTINATION_MISSING and cleans staging', async () => {
    const { base, home, workspace, destination } = await setup()
    await expect(planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: '20260101T000000Z',
      stagingDir: join(base, 'staging'),
    })).rejects.toMatchObject({ code: 'DESTINATION_MISSING' })
    await rm(base, { recursive: true, force: true })
  })

  it('0600 lands on restored credentials even when the share mode drifted', async () => {
    if (process.platform === 'win32') return
    const { base, home, workspace, destination } = await setup()
    const result = await runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })
    await chmod(join(home, '.credentials.yaml'), 0o644)
    const plan = await planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'),
    })
    await applyRestore(plan)
    expect((await stat(join(home, '.credentials.yaml'))).mode & 0o777).toBe(0o600)
    await rm(base, { recursive: true, force: true })
  })
})

describe('restore remoteDir and cleanup failure paths', () => {
  it('planRestore maps a non-empty remoteDir', async () => {
    const { base, home, workspace, destination } = await setup()
    const result = await runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: 'sites', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })
    const plan = await planRestore({
      destination, remoteDir: 'sites', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'),
    })
    expect(plan.files.length).toBeGreaterThan(0)
    await discardRestore(plan)
    await rm(base, { recursive: true, force: true })
  })

  it('a failed staging cleanup does not mask the plan error (posix only)', async () => {
    if (process.platform === 'win32') return
    const { base, home, workspace, destination } = await setup()
    await chmod(base, 0o500)
    await expect(planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: '20260101T000000Z',
      stagingDir: join(base, 'staging'),
    })).rejects.toMatchObject({ code: 'DESTINATION_MISSING' })
    await chmod(base, 0o700)
    await rm(base, { recursive: true, force: true })
  })

  it('a failed final cleanup after apply is contained (posix only)', async () => {
    if (process.platform === 'win32') return
    const { base, home, workspace, destination } = await setup()
    const result = await runBackupGroup({
      destination, roots: { home, workspace }, group: 'config', remoteDir: '', retention: 3,
      encryption: { enabled: false }, stagingDir: join(base, 'staging'), now: NOW,
    })
    const plan = await planRestore({
      destination, remoteDir: '', roots: { home, workspace }, group: 'config', stamp: result.stamp,
      stagingDir: join(base, 'staging'),
    })
    let applied = 0
    const outcome = await applyRestore(plan, () => {
      applied += 1
      if (applied === plan.files.length) {
        // 最后一个文件落地后锁住父目录，让 staging 目录的最终清理失败一次。
        return chmod(base, 0o500)
      }
    })
    expect(outcome.applied).toBe(plan.files.length)
    await chmod(base, 0o700)
    await rm(base, { recursive: true, force: true })
  })
})
