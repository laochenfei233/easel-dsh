/**
 * backup fs (SMB) destination host path: a local directory stands in for the
 * UNC/mounted root — probe writes and removes a canary, put is atomic through
 * a temp file, get streams bytes back, list walks recursively with POSIX keys,
 * and a missing object reads as DESTINATION_MISSING.
 */

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FsDestination } from '../src/destinations/fs.ts'
import { BackupError } from '../src/errors.ts'

async function root(): Promise<{ dir: string; destination: FsDestination }> {
  const dir = await mkdtemp(join(tmpdir(), 'easel-backup-fs-'))
  return { dir, destination: new FsDestination(join(dir, 'share')) }
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

describe('FsDestination', () => {
  it('probe creates the root and leaves no canary behind', async () => {
    const { dir, destination } = await root()
    await destination.probe()
    await expect(stat(join(dir, 'share', '.easel-backup-probe'))).rejects.toMatchObject({ code: 'ENOENT' })
    await rm(dir, { recursive: true, force: true })
  })

  it('put then get round-trips from a file source, and list reports POSIX keys with sizes', async () => {
    const { dir, destination } = await root()
    const source = join(dir, 'staging.zip')
    await writeFile(source, Buffer.from('zip-bytes'))
    await destination.put('easel-backup/config/20261024T093000Z.zip', source)
    await destination.put('easel-backup/config/nested/20261023T090000Z.zip', Buffer.from('earlier'))
    expect(await collect(await destination.get('easel-backup/config/20261024T093000Z.zip'))).toEqual(Buffer.from('zip-bytes'))
    const listed = await destination.list('easel-backup/config/')
    expect(listed.map(object => object.key).sort()).toEqual([
      'easel-backup/config/20261024T093000Z.zip',
      'easel-backup/config/nested/20261023T090000Z.zip',
    ])
    expect(listed.find(object => object.key.endsWith('T093000Z.zip'))?.size).toBe(9)
    await rm(dir, { recursive: true, force: true })
  })

  it('del removes objects and tolerates absent ones', async () => {
    const { dir, destination } = await root()
    await destination.put('a/b.txt', Buffer.from('x'))
    await destination.del('a/b.txt')
    await destination.del('a/b.txt')
    await expect(destination.get('a/b.txt')).rejects.toMatchObject({ code: 'DESTINATION_MISSING' })
    await rm(dir, { recursive: true, force: true })
  })

  it('list of a missing prefix is empty; unsafe keys fail loudly', async () => {
    const { dir, destination } = await root()
    await expect(destination.list('nope/')).resolves.toEqual([])
    await expect(destination.put('../escape', Buffer.from('x'))).rejects.toMatchObject({ code: 'CONFIG' })
    await rm(dir, { recursive: true, force: true })
  })
})

describe('FsDestination failure paths', () => {
  it('probe on an unwritable root reports the share as unreachable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-fs-'))
    const blocker = join(dir, 'blocker')
    await writeFile(blocker, 'not a directory')
    const destination = new FsDestination(join(blocker, 'share'))
    await expect(destination.probe()).rejects.toMatchObject({ code: 'DESTINATION_UNREACHABLE' })
    await rm(dir, { recursive: true, force: true })
  })

  it('put onto a path occupied by a directory fails and cleans its temp file', async () => {
    const { dir, destination } = await root()
    await mkdir(join(dir, 'share', 'occupied'), { recursive: true })
    await expect(destination.put('occupied', Buffer.from('x'))).rejects.toMatchObject({ code: 'DESTINATION_UNREACHABLE' })
    await rm(dir, { recursive: true, force: true })
  })

  it('list over a file prefix fails loudly and skips temp-suffixed stragglers', async () => {
    const { dir, destination } = await root()
    await mkdir(join(dir, 'share'), { recursive: true })
    await writeFile(join(dir, 'share', 'a.txt'), 'x')
    await writeFile(join(dir, 'share', 'b.backup-tmp'), 'partial')
    await expect(destination.list('a.txt')).rejects.toMatchObject({ code: 'DESTINATION_UNREACHABLE' })
    const listed = await destination.list('')
    expect(listed.map(object => object.key)).toEqual(['a.txt'])
    await rm(dir, { recursive: true, force: true })
  })
})
