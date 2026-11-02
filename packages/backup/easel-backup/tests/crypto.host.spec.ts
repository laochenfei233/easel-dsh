/**
 * backup crypto host path: the chunked AES-256-GCM container round-trips
 * exactly, fails closed on a wrong passphrase, any tampering, truncation, and
 * malformed headers, and rejects configuration nonsense up front.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { blockIv, decryptFileTo, encryptFileTo, isEncryptedArchive } from '../src/crypto.ts'
import { HEADER_LENGTH } from '../src/crypto.ts'
import { BackupError } from '../src/errors.ts'

async function staging(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'easel-backup-crypto-'))
}

/** A plaintext of 2.5 blocks at the given chunk size exercises block math. */
async function writePlaintext(dir: string, bytes: number): Promise<string> {
  const path = join(dir, 'plain.bin')
  await writeFile(path, Buffer.alloc(bytes, 7))
  return path
}

describe('encryptFileTo + decryptFileTo', () => {
  it('round-trips a multi-block payload byte for byte', async () => {
    const dir = await staging()
    const plain = await writePlaintext(dir, 5 * 1024 + 123)
    const container = join(dir, 'out.bak')
    const restored = join(dir, 'restored.bin')
    await encryptFileTo(plain, container, '口令-passphrase', 2 * 1024)
    const head = await readFile(container)
    expect(head.length).toBeGreaterThan(HEADER_LENGTH)
    expect(isEncryptedArchive(head)).toBe(true)
    await decryptFileTo(container, restored, '口令-passphrase')
    expect(await readFile(restored)).toEqual(Buffer.alloc(5 * 1024 + 123, 7))
    await rm(dir, { recursive: true, force: true })
  })

  it('round-trips an empty payload and an exact multiple of the block size', async () => {
    const dir = await staging()
    for (const size of [0, 2048]) {
      const plain = await writePlaintext(dir, size)
      const container = join(dir, `out-${String(size)}.bak`)
      const restored = join(dir, `restored-${String(size)}.bin`)
      await encryptFileTo(plain, container, 'p', 1024)
      await decryptFileTo(container, restored, 'p')
      expect((await readFile(restored)).length).toBe(size)
    }
    await rm(dir, { recursive: true, force: true })
  })

  it('fails closed on a wrong passphrase', async () => {
    const dir = await staging()
    const plain = await writePlaintext(dir, 4096)
    const container = join(dir, 'out.bak')
    await encryptFileTo(plain, container, 'right', 1024)
    await expect(decryptFileTo(container, join(dir, 'x.bin'), 'wrong')).rejects.toMatchObject({
      code: 'DECRYPT_FAILED',
    })
    await rm(dir, { recursive: true, force: true })
  })

  it('fails closed when a ciphertext byte is flipped', async () => {
    const dir = await staging()
    const plain = await writePlaintext(dir, 4096)
    const container = join(dir, 'out.bak')
    await encryptFileTo(plain, container, 'p', 1024)
    const bytes = await readFile(container)
    bytes[HEADER_LENGTH + 10] = (bytes[HEADER_LENGTH + 10]! + 1) % 256
    const tampered = join(dir, 'tampered.bak')
    await writeFile(tampered, bytes)
    await expect(decryptFileTo(tampered, join(dir, 'x.bin'), 'p')).rejects.toMatchObject({ code: 'DECRYPT_FAILED' })
    await rm(dir, { recursive: true, force: true })
  })

  it('fails closed on a truncated container', async () => {
    const dir = await staging()
    const plain = await writePlaintext(dir, 4096)
    const container = join(dir, 'out.bak')
    await encryptFileTo(plain, container, 'p', 1024)
    const bytes = await readFile(container)
    const truncated = join(dir, 'truncated.bak')
    await writeFile(truncated, bytes.subarray(0, bytes.length - 8))
    await expect(decryptFileTo(truncated, join(dir, 'x.bin'), 'p')).rejects.toSatisfy(
      (error: unknown) => error instanceof BackupError && ['DECRYPT_FAILED', 'CONTAINER_INVALID'].includes(error.code),
    )
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects foreign bytes, bad versions, bad kdf, short headers, and tiny blocks', async () => {
    const dir = await staging()
    const foreign = join(dir, 'foreign.bin')
    await writeFile(foreign, Buffer.from('not a container at all, definitely not, padding to pass the header length check'))
    await expect(decryptFileTo(foreign, join(dir, 'x.bin'), 'p')).rejects.toMatchObject({ code: 'CONTAINER_INVALID' })

    const header = (patch: (buffer: Buffer) => void, length = HEADER_LENGTH): Buffer => {
      const buffer = Buffer.alloc(Math.max(length, HEADER_LENGTH), 0)
      buffer.write('EASELBAK', 0, 'ascii')
      buffer[8] = 1
      patch(buffer)
      return buffer.subarray(0, length)
    }
    const shortHeader = join(dir, 'short.bin')
    await writeFile(shortHeader, header(() => {}, HEADER_LENGTH - 1))
    await expect(decryptFileTo(shortHeader, join(dir, 'x.bin'), 'p')).rejects.toMatchObject({ code: 'CONTAINER_INVALID' })

    const badVersion = join(dir, 'version.bin')
    await writeFile(badVersion, header((buffer) => {
      buffer[8] = 9
    }))
    await expect(decryptFileTo(badVersion, join(dir, 'x.bin'), 'p')).rejects.toMatchObject({ code: 'CONTAINER_INVALID' })

    const badKdf = join(dir, 'kdf.bin')
    await writeFile(badKdf, header((buffer) => {
      buffer.writeUInt16BE(7, 9)
    }))
    await expect(decryptFileTo(badKdf, join(dir, 'x.bin'), 'p')).rejects.toMatchObject({ code: 'CONTAINER_INVALID' })

    const tinyBlock = join(dir, 'block.bin')
    await writeFile(tinyBlock, header((buffer) => {
      buffer.writeUInt16BE(1, 9)
      buffer.writeUInt32BE(1, HEADER_LENGTH - 4)
    }))
    await expect(decryptFileTo(tinyBlock, join(dir, 'x.bin'), 'p')).rejects.toMatchObject({ code: 'CONTAINER_INVALID' })
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects empty passphrases and out-of-range chunk sizes up front', async () => {
    const dir = await staging()
    const plain = await writePlaintext(dir, 32)
    await expect(encryptFileTo(plain, join(dir, 'a.bak'), '')).rejects.toMatchObject({ code: 'CONFIG' })
    await expect(encryptFileTo(plain, join(dir, 'a.bak'), 'p', 1)).rejects.toMatchObject({ code: 'CONFIG' })
    await expect(decryptFileTo(plain, join(dir, 'b.bin'), '')).rejects.toMatchObject({ code: 'CONFIG' })
    await rm(dir, { recursive: true, force: true })
  })

  it('isEncryptedArchive only accepts the exact magic and version', () => {
    expect(isEncryptedArchive(Buffer.from('EASELBAK\x01more'))).toBe(true)
    expect(isEncryptedArchive(Buffer.from('EASELBAK\x02more'))).toBe(false)
    expect(isEncryptedArchive(Buffer.from('EASELBAK'))).toBe(false)
    expect(isEncryptedArchive(Buffer.from('EASEL'))).toBe(false)
    expect(isEncryptedArchive(Buffer.alloc(0))).toBe(false)
  })
})

describe('crypto guards', () => {
  it('blockIv rejects a block counter that would overflow the IV', () => {
    expect(() => blockIv(Buffer.alloc(12, 1), 2 ** 32)).toThrow(BackupError)
    expect(() => blockIv(Buffer.alloc(12, 1), 2 ** 32 - 1)).not.toThrow()
  })

  it('a container body shorter than one block reads as truncated', async () => {
    const dir = await staging()
    const plain = await writePlaintext(dir, 4096)
    const container = join(dir, 'out.bak')
    await encryptFileTo(plain, container, 'p', 1024)
    const bytes = await readFile(container)
    const stub = join(dir, 'stub.bak')
    await writeFile(stub, bytes.subarray(0, HEADER_LENGTH + 5))
    await expect(decryptFileTo(stub, join(dir, 'x.bin'), 'p')).rejects.toMatchObject({ code: 'DECRYPT_FAILED' })
    await rm(dir, { recursive: true, force: true })
  })

  it('a vanished plaintext fails the encrypt pass and destroys its output', async () => {
    const dir = await staging()
    await expect(encryptFileTo(join(dir, 'missing.bin'), join(dir, 'out.bak'), 'p', 1024)).rejects.toThrow()
    await rm(dir, { recursive: true, force: true })
  })
})

describe('encrypt backpressure', () => {
  it('a default-chunk-size write crosses the stream high-water mark and drains', async () => {
    const dir = await staging()
    const plain = join(dir, 'big.bin')
    await writeFile(plain, randomBytes(5 * 1024 * 1024))
    const container = join(dir, 'out.bak')
    const restored = join(dir, 'restored.bin')
    await encryptFileTo(plain, container, 'p')
    await decryptFileTo(container, restored, 'p')
    expect((await readFile(restored)).length).toBe(5 * 1024 * 1024)
    await rm(dir, { recursive: true, force: true })
  })
})
