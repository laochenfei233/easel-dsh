import { createReadStream, createWriteStream, mkdirSync, openSync, writeSync, closeSync, rmSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { finished } from 'node:stream/promises'
import { once } from 'node:events'
import type { WriteStream } from 'node:fs'
import { Zip, ZipDeflate, Unzip, UnzipInflate } from 'fflate'
import { BackupError } from './errors.js'
import { levelForPath } from './collections.js'
import type { ArchiveEntry, BackupManifest } from './types.js'

/** Flush buffered archive output to the sink once this many bytes queue up. */
const FLUSH_THRESHOLD_BYTES = 8 * 1024 * 1024

/** One named piece of content to archive. */
export interface ArchiveInput {
  /** Archive path. */
  path: string
  /** Local file path (streamed) or in-memory bytes. */
  source: string | Uint8Array
}

/**
 * Incremental streaming archive writer: entries push through `fflate`, output
 * batches flush to the sink once they pass the threshold, and every fflate
 * callback error is captured and rethrown at the next await point. Exported so
 * fault-injection tests can drive misuse paths (add-after-finish) directly.
 */
export class BackupArchiveWriter {
  private readonly zip: Zip
  private pending: Buffer[] = []
  private pendingBytes = 0
  private failure: Error | undefined

  /**
   * @param sink - Receives every output batch in order.
   */
  constructor(private readonly sink: (chunk: Buffer) => Promise<void>) {
    this.zip = new Zip((error, data) => {
      if (error !== null) {
        this.failure ??= error
        return
      }
      this.pending.push(Buffer.from(data))
      this.pendingBytes += data.byteLength
    })
  }

  /**
   * Flush buffered output once it crosses the threshold.
   */
  private async drainIfAbove(): Promise<void> {
    if (this.pendingBytes >= FLUSH_THRESHOLD_BYTES) await this.flush()
  }

  /**
   * Hand every buffered batch to the sink.
   */
  private async flush(): Promise<void> {
    if (this.pending.length === 0) return
    const buffer = Buffer.concat(this.pending)
    this.pending = []
    this.pendingBytes = 0
    await this.sink(buffer)
  }

  /**
   * Add one entry; media stores verbatim, text deflates.
   * @param entry - Named content to archive.
   */
  async add(entry: ArchiveInput): Promise<void> {
    const deflate = new ZipDeflate(entry.path, { level: levelForPath(entry.path) })
    this.zip.add(deflate)
    // 误用（finish 之后 add）在这里表现为回调错误，立刻在检查点抛出。
    if (this.failure !== undefined) throw this.failure
    if (typeof entry.source === 'string') {
      for await (const chunk of createReadStream(entry.source)) {
        deflate.push(chunk as Buffer)
        await this.drainIfAbove()
      }
    } else {
      deflate.push(entry.source)
    }
    deflate.push(new Uint8Array(0), true)
    await this.drainIfAbove()
  }

  /**
   * Close the archive: central directory, final flush, last error check.
   */
  async finish(): Promise<void> {
    this.zip.end()
    await this.flush()
    if (this.failure !== undefined) throw this.failure
  }

  /**
   * Abandon the writer after a failure; fflate's internal state is dropped.
   */
  terminate(): void {
    this.zip.terminate()
  }
}

/**
 * Sink over one output file honoring backpressure.
 * @param output - The stream to write into.
 */
function fileSink(output: WriteStream): (chunk: Buffer) => Promise<void> {
  const failure = new Promise<never>((_, reject) => {
    output.once('error', reject)
  })
  return async (chunk) => {
    if (!output.write(chunk)) await Promise.race([once(output, 'drain'), failure])
  }
}

/**
 * Write one backup archive: `manifest.json` first, then every entry, streaming
 * to disk with bounded memory. Media entries store verbatim, text deflates.
 * @param entries - Files to archive, already collected.
 * @param manifest - Manifest written as the first entry.
 * @param outputPath - Staging file to write; parent directories are created.
 */
export async function writeBackupArchive(
  entries: readonly ArchiveEntry[],
  manifest: BackupManifest,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })
  const output = createWriteStream(outputPath)
  const writer = new BackupArchiveWriter(fileSink(output))
  try {
    await writer.add({ path: 'manifest.json', source: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') })
    for (const entry of entries) {
      await writer.add({ path: entry.path, source: entry.absolutePath })
    }
    await writer.finish()
    output.end()
    await finished(output)
  } catch (error) {
    output.destroy()
    writer.terminate()
    throw error
  }
}

/** One file extracted from an archive onto staging. */
export interface ExtractedFile {
  /** Archive path. */
  path: string
  /** Staging file holding the verified content. */
  stagingPath: string
  /** Uncompressed size in bytes. */
  size: number
}

/** Result of extracting one backup archive onto staging. */
export interface ExtractedArchive {
  /** Manifest read from the archive. */
  manifest: BackupManifest
  /** File entries after the manifest, in archive order. */
  files: ExtractedFile[]
}

/**
 * Reject archive paths that could escape the staging directory: absolute,
 * backslash, drive-letter, or `..` segments. Zip paths always use POSIX
 * separators; anything else is hostile.
 * @param name - Archive path to check.
 */
function assertSafeArchivePath(name: string): void {
  if (
    name.length === 0 ||
    name.startsWith('/') ||
    name.includes('\\') ||
    name.includes(':') ||
    name.split('/').some(segment => segment === '..' || segment === '')
  ) {
    throw new BackupError('ARCHIVE_UNSAFE_PATH', `归档内出现不安全路径：${JSON.stringify(name)}`)
  }
}

/**
 * Extract one backup archive onto staging, verifying every entry's CRC32 via
 * the inflate stream and the manifest's file count. Unknown manifest versions
 * and truncated streams fail loudly. Entries are written sequentially with
 * synchronous staging writes, so extraction throughput tracks the read stream.
 * @param archivePath - Local archive file to read.
 * @param stagingDir - Directory to extract into; created when missing.
 * @returns The manifest and every file entry after the manifest.
 */
export async function extractBackupArchive(archivePath: string, stagingDir: string): Promise<ExtractedArchive> {
  await mkdir(stagingDir, { recursive: true })
  const files: ExtractedFile[] = []
  let open: { fd: number; path: string; stagingPath: string; size: number } | undefined
  let failure: Error | undefined
  const unzip = new Unzip()
  unzip.register(UnzipInflate)
  unzip.onfile = (file) => {
    try {
      assertSafeArchivePath(file.name)
    } catch (error) {
      failure ??= error as Error
      return
    }
    const stagingPath = join(stagingDir, ...file.name.split('/'))
    mkdirSync(dirname(stagingPath), { recursive: true })
    const current = { fd: openSync(stagingPath, 'w'), path: file.name, stagingPath, size: 0 }
    open = current
    // writeSync 直接抛：条目按序到达，写失败经外层 catch 包成 ARCHIVE_INVALID。
    file.ondata = (error, data, final) => {
      if (error !== null) {
        failure ??= error
        return
      }
      writeSync(current.fd, data)
      current.size += data.byteLength
      if (final) {
        closeSync(current.fd)
        files.push({ path: current.path, stagingPath: current.stagingPath, size: current.size })
        open = undefined
      }
    }
    file.start()
  }
  try {
    for await (const chunk of createReadStream(archivePath)) {
      unzip.push(chunk as Buffer, false)
      if (failure !== undefined) throw failure
    }
    unzip.push(new Uint8Array(0), true)
  } catch (error) {
    if (error instanceof BackupError) throw error
    throw new BackupError('ARCHIVE_INVALID', `解压失败：${String(error)}`, { cause: error })
  } finally {
    if (open !== undefined) closeSync(open.fd)
  }
  const manifestEntry = files.find(file => file.path === 'manifest.json')
  if (manifestEntry === undefined) {
    throw new BackupError('ARCHIVE_INVALID', '归档缺少 manifest.json')
  }
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(await readFile(manifestEntry.stagingPath, 'utf8')) as Record<string, unknown>
  } catch (error) {
    throw new BackupError('ARCHIVE_INVALID', 'manifest.json 不是合法 JSON', { cause: error })
  }
  if (raw.manifestVersion !== 1) {
    throw new BackupError('ARCHIVE_INVALID', `manifest 版本不被支持：${String(raw.manifestVersion)}`)
  }
  const group = raw.group
  const createdAt = raw.createdAt
  const fileCount = raw.fileCount
  const totalBytes = raw.totalBytes
  if (
    (group !== 'config' && group !== 'sessions' && group !== 'workspace') ||
    typeof createdAt !== 'string' ||
    typeof fileCount !== 'number' ||
    typeof totalBytes !== 'number'
  ) {
    throw new BackupError('ARCHIVE_INVALID', 'manifest 字段不完整或不合法')
  }
  const manifest: BackupManifest = { manifestVersion: 1, group, createdAt, fileCount, totalBytes }
  const fileEntries = files.filter(file => file.path !== 'manifest.json')
  if (manifest.fileCount !== fileEntries.length) {
    throw new BackupError(
      'ARCHIVE_MANIFEST_MISMATCH',
      `manifest 计 ${String(manifest.fileCount)} 个文件，实际 ${String(fileEntries.length)} 个`,
    )
  }
  rmSync(manifestEntry.stagingPath, { force: true })
  return { manifest, files: fileEntries }
}
