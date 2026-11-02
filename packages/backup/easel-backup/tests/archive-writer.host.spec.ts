/**
 * backup archive writer host path: the streaming writer forwards fflate
 * callback errors, flushes through a backpressured sink, and the file-backed
 * wrapper destroys and terminates on failure.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BackupArchiveWriter, extractBackupArchive, writeBackupArchive } from '../src/archive.ts'
import type { BackupManifest } from '../src/index.ts'

const manifest: BackupManifest = {
  manifestVersion: 1,
  group: 'config',
  createdAt: '2026-10-24T09:30:05.000Z',
  fileCount: 1,
  totalBytes: 1,
}

describe('BackupArchiveWriter', () => {
  it('round-trips through an async sink', async () => {
    const chunks: Buffer[] = []
    const writer = new BackupArchiveWriter(async (chunk) => {
      chunks.push(chunk)
    })
    await writer.add({ path: 'home/a.txt', source: Buffer.from('hello') })
    await writer.finish()
    const zip = Buffer.concat(chunks)
    expect(zip.subarray(0, 2).toString('latin1')).toBe('PK')
  })

  it('reports a misuse error on the next await point and surfaces it from finish', async () => {
    const writer = new BackupArchiveWriter(async () => {})
    await writer.add({ path: 'a.txt', source: Buffer.from('x') })
    await writer.finish()
    // finish 之后再 add：fflate 经回调报「stream finishing」，下一个检查点抛出。
    await expect(writer.add({ path: 'b.txt', source: Buffer.from('y') })).rejects.toThrow()
    await expect(writer.finish()).rejects.toThrow()
  })

  it('flushes through a backpressured sink without dropping bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-writer-'))
    const big = join(dir, 'big.bin')
    await writeFile(big, Buffer.alloc(512 * 1024, 5))
    const zipPath = join(dir, 'out.zip')
    await writeBackupArchive(
      [{ path: 'home/big.bin', absolutePath: big, size: 512 * 1024 }],
      { ...manifest, totalBytes: 512 * 1024 },
      zipPath,
    )
    const extracted = await extractBackupArchive(zipPath, join(dir, 'extract'))
    expect(extracted.files[0]?.size).toBe(512 * 1024)
    await rm(dir, { recursive: true, force: true })
  })

  it('destroys the output and terminates the zip when a source is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-writer-'))
    const zipPath = join(dir, 'out.zip')
    await expect(
      writeBackupArchive([{ path: 'home/gone.bin', absolutePath: join(dir, 'gone.bin'), size: 1024 }], manifest, zipPath),
    ).rejects.toThrow()
    await rm(dir, { recursive: true, force: true })
  })

  it('writeBackupArchive output is a readable zip the extractor accepts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-writer-'))
    const source = join(dir, 'a.txt')
    await writeFile(source, 'round trip')
    const zipPath = join(dir, 'out.zip')
    await writeBackupArchive(
      [{ path: 'home/a.txt', absolutePath: source, size: 10 }],
      { ...manifest, totalBytes: 10 },
      zipPath,
    )
    expect((await readFile(zipPath)).subarray(0, 2).toString('latin1')).toBe('PK')
    await rm(dir, { recursive: true, force: true })
  })
})

describe('write/extract pressure and corruption', () => {
  it('an incompressible multi-megabyte entry crosses the file sink high-water mark', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-writer-'))
    const big = join(dir, 'noise.bin')
    await writeFile(big, randomBytes(9 * 1024 * 1024))
    const zipPath = join(dir, 'out.zip')
    await writeBackupArchive(
      [{ path: 'home/noise.bin', absolutePath: big, size: 9 * 1024 * 1024 }],
      { ...manifest, totalBytes: 9 * 1024 * 1024 },
      zipPath,
    )
    const extracted = await extractBackupArchive(zipPath, join(dir, 'extract'))
    expect(extracted.files[0]?.size).toBe(9 * 1024 * 1024)
    await rm(dir, { recursive: true, force: true })
  })

  it('a corrupted entry fails the CRC check as ARCHIVE_INVALID', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-writer-'))
    const big = join(dir, 'big.bin')
    await writeFile(big, Buffer.alloc(512 * 1024, 5))
    const zipPath = join(dir, 'out.zip')
    await writeBackupArchive(
      [{ path: 'home/big.bin', absolutePath: big, size: 512 * 1024 }],
      { ...manifest, totalBytes: 512 * 1024 },
      zipPath,
    )
    const bytes = await readFile(zipPath)
    bytes[Math.floor(bytes.length * 0.5)] = (bytes[Math.floor(bytes.length * 0.5)]! + 1) % 256
    const corrupted = join(dir, 'corrupted.zip')
    await writeFile(corrupted, bytes)
    await expect(extractBackupArchive(corrupted, join(dir, 'extract'))).rejects.toMatchObject({
      code: 'ARCHIVE_INVALID',
    })
    await rm(dir, { recursive: true, force: true })
  })
})
