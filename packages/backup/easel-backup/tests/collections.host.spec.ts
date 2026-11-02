/**
 * backup collections host path: the group walker collects exactly the scope
 * table's files — profile patches, credentials, personas, skills, state
 * stores, sessions, attachments, projects, outputs — and never follows
 * junctions/symlinks, node_modules, caches, or temp-write stragglers.
 */

import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectGroup, levelForPath, stampFor } from '../src/index.ts'

async function makeRoots(): Promise<{ home: string; workspace: string }> {
  const base = await mkdtemp(join(tmpdir(), 'easel-backup-collections-'))
  return { home: join(base, 'home'), workspace: join(base, 'workspace') }
}

async function seedLayout(roots: { home: string; workspace: string }): Promise<void> {
  await mkdir(join(roots.home, 'profiles'), { recursive: true })
  await writeFile(join(roots.home, 'profiles', 'cordis.patch.yml'), 'insert: []\n')
  await writeFile(join(roots.home, '.credentials.yaml'), 'version: 1\n')
  await mkdir(join(roots.home, 'sessions', 'proj', 's1'), { recursive: true })
  await writeFile(join(roots.home, 'sessions', 'proj', 's1', 'session.jsonl'), 'log\n')
  await mkdir(join(roots.home, 'attachments', 'v1', 'ab'), { recursive: true })
  await writeFile(join(roots.home, 'attachments', 'v1', 'ab', 'cd.bin'), 'attachment\n')
  await mkdir(join(roots.home, 'profiles', 'node_modules', 'dep'), { recursive: true })
  await writeFile(join(roots.home, 'profiles', 'node_modules', 'dep', 'index.js'), 'x\n')

  await mkdir(join(roots.workspace, 'profiles'), { recursive: true })
  await writeFile(join(roots.workspace, 'profiles', 'identity.md'), 'persona\n')
  await writeFile(join(roots.workspace, '.env'), 'KEY=1\n')
  await mkdir(join(roots.workspace, 'skills', 'openclaw'), { recursive: true })
  await writeFile(join(roots.workspace, 'skills', 'openclaw', 'SKILL.md'), 'skill\n')
  await mkdir(join(roots.workspace, 'outputs', '_login'), { recursive: true })
  await writeFile(join(roots.workspace, 'outputs', '_schedule.json'), '[]\n')
  await writeFile(join(roots.workspace, 'outputs', '_schedule.json.tmp'), 'partial\n')
  await writeFile(join(roots.workspace, 'outputs', '_login', 'state.json'), '{}\n')
  await mkdir(join(roots.workspace, 'projects', 'p1'), { recursive: true })
  await writeFile(join(roots.workspace, 'projects', 'p1', 'brief.md'), 'brief\n')
  await mkdir(join(roots.workspace, 'outputs', 'media'), { recursive: true })
  await writeFile(join(roots.workspace, 'outputs', 'media', 'clip.mp4'), 'video\n')
  await writeFile(join(roots.workspace, 'outputs', 'junk.tmp'), 'temp\n')
}

const paths = (entries: { path: string }[]): string[] => entries.map(entry => entry.path).sort()

describe('collectGroup', () => {
  it('config collects profiles, credentials, env, personas, skills, and state stores', async () => {
    const roots = await makeRoots()
    await seedLayout(roots)
    const entries = await collectGroup(roots, 'config')
    expect(paths(entries)).toEqual([
      'home/.credentials.yaml',
      'home/profiles/cordis.patch.yml',
      'workspace/.env',
      'workspace/outputs/_login/state.json',
      'workspace/outputs/_schedule.json',
      'workspace/profiles/identity.md',
      'workspace/skills/openclaw/SKILL.md',
    ])
    await rm(join(roots.home, '..'), { recursive: true, force: true })
  })

  it('sessions collects session logs and durable attachments only', async () => {
    const roots = await makeRoots()
    await seedLayout(roots)
    const entries = await collectGroup(roots, 'sessions')
    expect(paths(entries)).toEqual(['home/attachments/v1/ab/cd.bin', 'home/sessions/proj/s1/session.jsonl'])
    await rm(join(roots.home, '..'), { recursive: true, force: true })
  })

  it('workspace collects projects and the full outputs tree', async () => {
    const roots = await makeRoots()
    await seedLayout(roots)
    const entries = await collectGroup(roots, 'workspace')
    expect(paths(entries)).toEqual([
      'workspace/outputs/_login/state.json',
      'workspace/outputs/_schedule.json',
      'workspace/outputs/media/clip.mp4',
      'workspace/projects/p1/brief.md',
    ])
    await rm(join(roots.home, '..'), { recursive: true, force: true })
  })

  it('skips symlinks and junctions instead of following them', async () => {
    const roots = await makeRoots()
    await seedLayout(roots)
    await symlink(join(roots.workspace, 'projects'), join(roots.workspace, 'outputs', 'alias'), 'junction')
    const entries = await collectGroup(roots, 'workspace')
    expect(paths(entries).filter(path => path.includes('alias'))).toEqual([])
    if (process.platform !== 'win32') {
      // posix 上再放一个目录符号链接，覆盖 collectDirectory 自身的跳过分支。
      await symlink(join(roots.workspace, 'projects'), join(roots.workspace, 'projects', 'link'), 'dir')
      const all = await collectGroup(roots, 'workspace')
      expect(paths(all).filter(path => path.includes('/link/'))).toEqual([])
    }
    await rm(join(roots.home, '..'), { recursive: true, force: true })
  })

  it('missing roots yield nothing instead of failing', async () => {
    const roots = await makeRoots()
    for (const group of ['config', 'sessions', 'workspace'] as const) {
      expect(await collectGroup(roots, group)).toEqual([])
    }
    await rm(join(roots.home, '..'), { recursive: true, force: true })
  })
})

describe('levelForPath', () => {
  it('stores media and compressed content verbatim', () => {
    for (const path of ['workspace/outputs/media/clip.MP4', 'home/sessions/s.jsonl.zst', 'a.PNG', 'b.mp3']) {
      expect(levelForPath(path)).toBe(0)
    }
  })

  it('deflates text and extensionless entries', () => {
    for (const path of ['home/profiles/cordis.patch.yml', 'manifest', 'a.txt']) {
      expect(levelForPath(path)).toBe(6)
    }
  })
})

describe('stampFor', () => {
  it('formats UTC stamps whose order is time order', () => {
    expect(stampFor(new Date('2026-10-24T09:30:05Z'))).toBe('20261024T093005Z')
    expect(stampFor(new Date('2026-01-01T00:00:00Z'))).toBe('20260101T000000Z')
    expect(stampFor(new Date('2026-10-24T09:30:05Z')) < stampFor(new Date('2026-10-24T09:30:06Z'))).toBe(true)
  })
})

describe('collectGroup failure paths', () => {
  it('rethrows non-ENOENT read errors with context', async () => {
    const base = await mkdtemp(join(tmpdir(), 'easel-backup-collections-'))
    const home = join(base, 'home')
    const workspace = join(base, 'workspace')
    await mkdir(home, { recursive: true })
    await writeFile(join(home, 'profiles'), 'not a directory')
    await expect(collectGroup({ home, workspace }, 'config')).rejects.toThrow()
    await rm(base, { recursive: true, force: true })

    const base2 = await mkdtemp(join(tmpdir(), 'easel-backup-collections-'))
    const home2 = join(base2, 'home')
    const workspace2 = join(base2, 'workspace')
    await mkdir(join(home2, 'profiles'), { recursive: true })
    await writeFile(join(home2, '.credentials.yaml'), 'version: 1')
    await mkdir(workspace2, { recursive: true })
    await writeFile(join(workspace2, 'outputs'), 'not a directory')
    await expect(collectGroup({ home: home2, workspace: workspace2 }, 'config')).rejects.toThrow()
    await rm(base2, { recursive: true, force: true })
  })

  it('an unreadable parent rethrows on posix', async () => {
    if (process.platform === 'win32') return
    const base = await mkdtemp(join(tmpdir(), 'easel-backup-collections-'))
    const home = join(base, 'home')
    const workspace = join(base, 'workspace')
    await mkdir(home, { recursive: true })
    await chmod(home, 0o000)
    await expect(collectGroup({ home, workspace }, 'config')).rejects.toThrow()
    await chmod(home, 0o700)
    await rm(base, { recursive: true, force: true })
  })

  it('outputs naming rules exclude temp files and excluded names even with a .json shape', async () => {
    const base = await mkdtemp(join(tmpdir(), 'easel-backup-collections-'))
    const home = join(base, 'home')
    const workspace = join(base, 'workspace')
    await mkdir(join(workspace, 'outputs'), { recursive: true })
    await writeFile(join(workspace, 'outputs', 'a.json'), '{}')
    await writeFile(join(workspace, 'outputs', 'b.json.tmp'), 'partial')
    await writeFile(join(workspace, 'outputs', '.easel-migrating'), 'migration marker')
    const entries = await collectGroup({ home, workspace }, 'config')
    expect(paths(entries)).toEqual(['workspace/outputs/a.json'])
    await rm(base, { recursive: true, force: true })
  })
})
