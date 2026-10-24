import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { once } from 'node:events';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { finished } from 'node:stream/promises';
import { BackupError } from './errors.js';

/** Container magic: `EASELBAK` followed by the format version byte. */
const MAGIC = Buffer.from('EASELBAK', 'ascii');

/** Container format version written at byte 8. */
const FORMAT_VERSION = 0x01;

/** KDF identifier for scrypt with the parameters below. */
const KDF_SCRYPT = 1;

/** Salt length in bytes. */
const SALT_LENGTH = 16;

/** Per-file random nonce length in bytes; the block counter rides the last 4. */
const NONCE_LENGTH = 12;

/** Fixed header length: magic(9) + kdf(2) + salt(16) + nonce(12) + chunkSize(4). */
export const HEADER_LENGTH = 9 + 2 + SALT_LENGTH + NONCE_LENGTH + 4;

/** Default plaintext block size per GCM chunk. */
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

/** Smallest block size accepted from either side of the header. */
const MIN_CHUNK_SIZE = 1024;

/** scrypt parameters; maxmem is raised because 128·r·N is exactly 32 MiB. */
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

/**
 * Write to a stream honoring backpressure.
 * @param output - Writable to write into.
 * @param buffer - Bytes to write.
 */
async function writeChunk(output: NodeJS.WritableStream, buffer: Buffer): Promise<void> {
  if (!output.write(buffer)) await once(output, 'drain');
}

/**
 * Build the GCM input for one block: the 12-byte IV with the block counter in
 * the low 32 bits. Exported so the counter-overflow guard is directly testable.
 * @param baseNonce - Per-file random nonce.
 * @param index - Zero-based block index.
 * @returns The IV for this block.
 */
export function blockIv(baseNonce: Buffer, index: number): Buffer {
  if (index >= 2 ** 32) throw new BackupError('CONTAINER_INVALID', '块计数溢出');
  const iv = Buffer.from(baseNonce);
  iv.writeUInt32BE(index, NONCE_LENGTH - 4);
  return iv;
}

/** AAD bytes binding the container magic and format version to one block index. */
function blockAad(index: number): Buffer {
  const aad = Buffer.alloc(13);
  MAGIC.copy(aad, 0);
  aad[8] = FORMAT_VERSION;
  aad.writeUInt32BE(index, 9);
  return aad;
}

/**
 * Derive the container key from a passphrase.
 * @param passphrase - User-chosen passphrase.
 * @param salt - Per-file random salt from the header.
 * @returns The 32-byte AES-256 key.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, SCRYPT_PARAMS);
}

/**
 * Detect the encrypted-container header.
 * @param head - First bytes of a file, at least 9.
 * @returns True when the bytes start with the container magic and version.
 */
export function isEncryptedArchive(head: Uint8Array): boolean {
  if (head.length < MAGIC.length + 1) return false;
  return Buffer.from(head.subarray(0, MAGIC.length)).equals(MAGIC) && head[MAGIC.length] === FORMAT_VERSION;
}

/** Synchronous exact-size buffered reader over a byte stream. */
class BlockReader {
  private readonly iterator: AsyncIterator<Buffer>;
  private leftover: Buffer = Buffer.alloc(0);
  private done = false;

  /**
   * @param source - Byte stream to read fixed-size blocks from.
   */
  constructor(source: NodeJS.ReadableStream) {
    this.iterator = source[Symbol.asyncIterator]();
  }

  /**
   * Read exactly `length` bytes, or the final short block at end of stream.
   * @param length - Bytes to read.
   * @returns The block, the final short block, or null when the stream is exhausted.
   */
  async next(length: number): Promise<Buffer | null> {
    if (this.done && this.leftover.length === 0) return null;
    const parts: Buffer[] = [];
    let filled = 0;
    if (this.leftover.length > 0) {
      parts.push(this.leftover);
      filled = this.leftover.length;
      this.leftover = Buffer.alloc(0);
    }
    while (filled < length && !this.done) {
      const chunk = await this.iterator.next();
      if (chunk.done === true) {
        this.done = true;
        break;
      }
      parts.push(chunk.value);
      filled += chunk.value.length;
    }
    if (filled === 0) return null;
    if (filled <= length) return Buffer.concat(parts);
    const whole = Buffer.concat(parts);
    this.leftover = whole.subarray(length);
    return whole.subarray(0, length);
  }
}

/**
 * Encrypt one file into the chunked AES-256-GCM container: header, then per
 * block ciphertext with its 16-byte auth tag. Blocks are bound to the magic
 * and their index through the AAD, so any truncation, reordering, or bit flip
 * fails a tag check.
 * @param inputPath - Plaintext file (typically the staging zip).
 * @param outputPath - Container file to write.
 * @param passphrase - User-chosen passphrase.
 * @param chunkSize - Plaintext bytes per GCM block; decrypt reads it from the header.
 */
export async function encryptFileTo(
  inputPath: string,
  outputPath: string,
  passphrase: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<void> {
  if (passphrase.length === 0) throw new BackupError('CONFIG', '加密已开启但未提供口令');
  if (!Number.isInteger(chunkSize) || chunkSize < MIN_CHUNK_SIZE) throw new BackupError('CONFIG', '加密块大小不合法');
  const salt = randomBytes(SALT_LENGTH);
  const baseNonce = randomBytes(NONCE_LENGTH);
  const key = deriveKey(passphrase, salt);
  const header = Buffer.alloc(HEADER_LENGTH);
  MAGIC.copy(header, 0);
  header[8] = FORMAT_VERSION;
  header.writeUInt16BE(KDF_SCRYPT, 9);
  salt.copy(header, 11);
  baseNonce.copy(header, 11 + SALT_LENGTH);
  header.writeUInt32BE(chunkSize, 11 + SALT_LENGTH + NONCE_LENGTH);
  await mkdir(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  const output = createWriteStream(temporary);
  try {
    await writeChunk(output, header);
    const reader = new BlockReader(createReadStream(inputPath));
    let index = 0;
    for (;;) {
      const block = await reader.next(chunkSize);
      if (block === null) break;
      const cipher = createCipheriv('aes-256-gcm', key, blockIv(baseNonce, index));
      cipher.setAAD(blockAad(index));
      await writeChunk(output, Buffer.concat([cipher.update(block), cipher.final(), cipher.getAuthTag()]));
      index += 1;
    }
    output.end();
    await finished(output);
  } catch (error) {
    output.destroy();
    throw error;
  }
  await rename(temporary, outputPath);
}

/**
 * Decrypt one container produced by {@link encryptFileTo}. A wrong passphrase
 * or any tampering surfaces as `DECRYPT_FAILED` from the first block whose
 * tag does not verify.
 * @param inputPath - Container file to read.
 * @param outputPath - Plaintext file to write.
 * @param passphrase - The passphrase the container was encrypted with.
 */
export async function decryptFileTo(inputPath: string, outputPath: string, passphrase: string): Promise<void> {
  if (passphrase.length === 0) throw new BackupError('CONFIG', '该备份已加密，需要口令才能恢复');
  const handle = await open(inputPath, 'r');
  try {
    const header = Buffer.alloc(HEADER_LENGTH);
    const headerRead = await handle.read(header, 0, HEADER_LENGTH, 0);
    if (headerRead.bytesRead < HEADER_LENGTH) {
      throw new BackupError('CONTAINER_INVALID', '加密容器头不完整');
    }
    validateHeader(header);
    const salt = header.subarray(11, 11 + SALT_LENGTH);
    const baseNonce = Buffer.from(header.subarray(11 + SALT_LENGTH, 11 + SALT_LENGTH + NONCE_LENGTH));
    const chunkSize = header.readUInt32BE(11 + SALT_LENGTH + NONCE_LENGTH);
    const key = deriveKey(passphrase, salt);
    await mkdir(dirname(outputPath), { recursive: true });
    const temporary = `${outputPath}.tmp`;
    const output = createWriteStream(temporary);
    try {
      const reader = new BlockReader(createReadStream(inputPath, { start: HEADER_LENGTH }));
      let index = 0;
      for (;;) {
        const block = await reader.next(chunkSize + 16);
        if (block === null) break;
        if (block.length < 17) {
          throw new BackupError('DECRYPT_FAILED', '容器被截断');
        }
        const ciphertext = block.subarray(0, block.length - 16);
        const tag = block.subarray(block.length - 16);
        const decipher = createDecipheriv('aes-256-gcm', key, blockIv(baseNonce, index));
        decipher.setAAD(blockAad(index));
        decipher.setAuthTag(tag);
        let plaintext: Buffer;
        try {
          plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        } catch {
          throw new BackupError('DECRYPT_FAILED', '口令错误或备份文件已损坏');
        }
        await writeChunk(output, plaintext);
        index += 1;
      }
      output.end();
      await finished(output);
    } catch (error) {
      output.destroy();
      throw error;
    }
    await rename(temporary, outputPath);
  } finally {
    await handle.close();
  }
}

/**
 * Validate the fixed fields of a container header.
 * @param header - The 43-byte header read from a container.
 */
function validateHeader(header: Buffer): void {
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new BackupError('CONTAINER_INVALID', '不是本工具的加密容器');
  }
  if (header[MAGIC.length] !== FORMAT_VERSION) {
    throw new BackupError('CONTAINER_INVALID', `容器格式版本不被支持：${String(header[MAGIC.length])}`);
  }
  const kdf = header.readUInt16BE(9);
  if (kdf !== KDF_SCRYPT) {
    throw new BackupError('CONTAINER_INVALID', `KDF 不被支持：${String(kdf)}`);
  }
  if (header.readUInt32BE(11 + SALT_LENGTH + NONCE_LENGTH) < MIN_CHUNK_SIZE) {
    throw new BackupError('CONTAINER_INVALID', '容器块大小不合法');
  }
}
