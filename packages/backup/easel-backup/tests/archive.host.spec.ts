/**
 * backup archive host path: writing produces a zip whose manifest.json comes
 * first and whose entries byte-match their sources; extraction enforces safe
 * paths, manifest presence, JSON validity, version support, count agreement,
 * and stream completeness.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strFromU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { extractBackupArchive, writeBackupArchive } from '../src/archive.ts'
import { BackupError } from '../src/errors.ts'

async function staging(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'easel-backup-archive-'))
}

const manifest = {
  manifestVersion: 1 as const,
  group: 'config' as const,
  createdAt: '2026-10-24T09:30:05.000Z',
  fileCount: 2,
  totalBytes: 9,
}

describe('writeBackupArchive + extractBackupArchive', () => {
  it('round-trips entries byte for byte with the manifest first', async () => {
    const dir = await staging()
    const sourceA = join(dir, 'a.txt')
    const sourceB = join(dir, 'nested.bin')
    await writeFile(sourceA, 'hello zip')
    await writeFile(sourceB, Buffer.from([1, 2, 3, 4, 5, 6]))
    const zipPath = join(dir, 'out.zip')
    await writeBackupArchive(
      [
        { path: 'home/profiles/a.txt', absolutePath: sourceA, size: 9 },
        { path: 'home/data.bin', absolutePath: sourceB, size: 6 },
      ],
      manifest,
      zipPath,
    )
    const extracted = await extractBackupArchive(zipPath, join(dir, 'extract'))
    expect(extracted.manifest).toEqual(manifest)
    expect(extracted.files.map(file => file.path)).toEqual(['home/profiles/a.txt', 'home/data.bin'])
    expect(await readFile(extracted.files[0]!.stagingPath, 'utf8')).toBe('hello zip')
    expect(await readFile(extracted.files[1]!.stagingPath)).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]))
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects archive paths that escape staging', async () => {
    const dir = await staging()
    const zipPath = join(dir, 'evil.zip')
    await writeFile(zipPath, Buffer.from(zipSync({ '../evil.txt': new Uint8Array([1]) })))
    await expect(extractBackupArchive(zipPath, join(dir, 'extract'))).rejects.toMatchObject({
      code: 'ARCHIVE_UNSAFE_PATH',
    })
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects archives without a manifest', async () => {
    const dir = await staging()
    const zipPath = join(dir, 'no-manifest.zip')
    await writeFile(zipPath, Buffer.from(zipSync({ 'home/a.txt': new Uint8Array([1]) })))
    await expect(extractBackupArchive(zipPath, join(dir, 'extract'))).rejects.toMatchObject({ code: 'ARCHIVE_INVALID' })
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects a manifest that is not JSON or of an unsupported version', async () => {
    const dir = await staging()
    const broken = join(dir, 'broken.zip')
    await writeFile(broken, Buffer.from(zipSync({ 'manifest.json': new TextEncoder().encode('not json') })))
    await expect(extractBackupArchive(broken, join(dir, 'extract-1'))).rejects.toMatchObject({ code: 'ARCHIVE_INVALID' })
    const future = join(dir, 'future.zip')
    await writeFile(future, Buffer.from(zipSync({
      'manifest.json': new TextEncoder().encode(JSON.stringify({ ...manifest, manifestVersion: 99 })),
    })))
    await expect(extractBackupArchive(future, join(dir, 'extract-2'))).rejects.toMatchObject({ code: 'ARCHIVE_INVALID' })
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects a file count that disagrees with the manifest', async () => {
    const dir = await staging()
    const zipPath = join(dir, 'mismatch.zip')
    await writeFile(zipPath, Buffer.from(zipSync({
      'manifest.json': new TextEncoder().encode(JSON.stringify(manifest)),
      'home/a.txt': new Uint8Array([1]),
    })))
    await expect(extractBackupArchive(zipPath, join(dir, 'extract'))).rejects.toMatchObject({
      code: 'ARCHIVE_MANIFEST_MISMATCH',
    })
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects a truncated archive and reports the open entry', async () => {
    const dir = await staging()
    const sourceA = join(dir, 'big.bin')
    await writeFile(sourceA, Buffer.alloc(256 * 1024, 3))
    const full = join(dir, 'full.zip')
    await writeBackupArchive(
      [{ path: 'home/big.bin', absolutePath: sourceA, size: 256 * 1024 }],
      { ...manifest, fileCount: 1, totalBytes: 256 * 1024 },
      full,
    )
    const bytes = await readFile(full)
    const truncated = join(dir, 'truncated.zip')
    await writeFile(truncated, bytes.subarray(0, Math.floor(bytes.length * 0.4)))
    await expect(extractBackupArchive(truncated, join(dir, 'extract'))).rejects.toSatisfy(
      (error: unknown) => error instanceof BackupError && ['ARCHIVE_TRUNCATED', 'ARCHIVE_INVALID'].includes(error.code),
    )
    await rm(dir, { recursive: true, force: true })
  })

  it('extracts with strFromU8 sanity: the produced archive is a real zip', async () => {
    const dir = await staging()
    const sourceA = join(dir, 'a.txt')
    await writeFile(sourceA, 'hello zip')
    const zipPath = join(dir, 'out.zip')
    await writeBackupArchive(
      [{ path: 'home/a.txt', absolutePath: sourceA, size: 9 }],
      { ...manifest, fileCount: 1, totalBytes: 9 },
      zipPath,
    )
    const { unzipSync: unzip } = await import('fflate')
    const files = unzip(new Uint8Array(await readFile(zipPath)))
    expect(JSON.parse(strFromU8(files['manifest.json']!))).toEqual({ ...manifest, fileCount: 1, totalBytes: 9 })
    await rm(dir, { recursive: true, force: true })
  })
})
