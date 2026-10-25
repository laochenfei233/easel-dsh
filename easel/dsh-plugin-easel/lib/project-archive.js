// Project archive engine: export one projects/<name>/ directory as a standard
// zip and import a zip back into projects/. The host owns the filesystem work;
// the client only starts a job and polls it.
//
// Format: the zip root is the project content, with a hidden manifest as the
// first entry. The manifest carries format/version/title/exportedAt only. It
// deliberately has no file or byte counts: an agent can rewrite a project file
// while the archive is being written, and a count written before the content
// would then describe a different tree than the one on disk. Per-entry CRCs in
// the zip already protect integrity.
//
// Import is deliberately tolerant of archives produced elsewhere: a manifest
// is optional, and a zip whose content sits under one top-level directory is
// unwrapped. Nothing is ever overwritten: a name collision becomes "name (2)".
import { constants, createReadStream, createWriteStream, closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { access, lstat, mkdir, open, readdir, readFile, readlink, rename, rm, statfs } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { finished } from 'node:stream/promises'
import { once } from 'node:events'
import { sanitizeProjectTitle } from './projectize.js'
import { PickerUnavailableError, pickSaveZip, pickZipFile } from './native-picker.js'

/** Hidden manifest at the archive root. */
export const MANIFEST_NAME = '.easel-project.json'
/** Manifest format discriminator. */
export const PROJECT_ARCHIVE_FORMAT = 'easel-project'
/** Manifest version this build reads and writes. */
export const PROJECT_ARCHIVE_VERSION = 1
/** Security invariant: an archive may not claim more entries than this. */
export const MAX_ARCHIVE_ENTRIES = 200_000
/** Security invariant: longest entry path in UTF-8 bytes. */
export const MAX_ENTRY_PATH_BYTES = 1024
/** fflate cannot write one entry above 4 GiB (ZIP64 total size is supported). */
export const MAX_SINGLE_FILE_BYTES = 0xFFFF_FFFF
/** Keep this much room on the destination volume while importing. */
const FREE_SPACE_RESERVE = 512 * 1024 * 1024
/** Refuse to begin extracting into a volume with less than this free. */
const MIN_FREE_SPACE = 1024 * 1024 * 1024
/** Zip output batches flush at this size; memory stays bounded on huge projects. */
const FLUSH_THRESHOLD_BYTES = 8 * 1024 * 1024
/** Extract staging directories older than this are crash residue. */
const STALE_STAGING_MS = 24 * 60 * 60 * 1000
/** A finished job stays readable this long for a late poll after completion. */
const JOB_RESULT_TTL_MS = 10 * 60 * 1000

/** Extensions stored verbatim: recompressing media wastes CPU and can inflate it. */
const STORE_EXTENSIONS = new Set([
  '.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.avif', '.zip', '.gz', '.7z', '.rar',
])

/** One archive failure with a stable client-facing code. */
export class ProjectArchiveError extends Error {
  /**
   * @param {string} code - stable error code the client maps to copy.
   * @param {string} detail - human-readable detail.
   * @param {ErrorOptions} [options] - cause and similar native error options.
   */
  constructor(code, detail, options = {}) {
    super(detail, options)
    this.name = 'ProjectArchiveError'
    this.code = code
    this.detail = detail
  }
}

function isWindows() { return process.platform === 'win32' }

/**
 * Compare two absolute paths the way the host filesystem does.
 * @param {string} value - absolute path.
 * @returns {string} a comparison key.
 */
function compareKey(value) {
  const normalized = resolve(value).replace(/\\/g, '/').replace(/\/+$/, '')
  return isWindows() ? normalized.toLowerCase() : normalized
}

/**
 * Collision key for archive entries. Windows and the default macOS
 * filesystems treat case-equivalent names as one file; macOS also treats NFC
 * and NFD spellings as equivalent, so both collapse before the duplicate and
 * ancestor checks.
 * @param {string} path - POSIX-style archive path.
 * @returns {string} the comparison key.
 */
function collisionKey(path) {
  const normalized = process.platform === 'darwin' ? String(path).normalize('NFC') : String(path)
  return process.platform === 'win32' || process.platform === 'darwin' ? normalized.toLowerCase() : normalized
}

/**
 * Whether a candidate is a direct child of <projectRoot>/projects.
 * @param {string} projectRoot - resolved Easel project root.
 * @param {string} candidate - absolute path to test.
 * @returns {boolean} true for a lexical direct child.
 */
export function isDirectProjectPath(projectRoot, candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0 || !isAbsolute(candidate)) return false
  const path = compareKey(candidate)
  const slash = path.lastIndexOf('/')
  if (slash <= 0) return false
  return path.slice(0, slash) === compareKey(join(projectRoot, 'projects'))
}

/**
 * Detect a symlink or Windows junction without following it. Node reports
 * junctions as directories on some Windows versions, so readlink is the only
 * reliable test there.
 * @param {string} path - absolute path.
 * @returns {Promise<boolean>} true for a link/junction.
 */
async function isLink(path) {
  return readlink(path).then(() => true, () => false)
}

/**
 * @param {string} path - path to inspect.
 * @returns {Promise<import('node:fs').Stats|null>} lstat result, or null.
 */
async function pathInfo(path) {
  return lstat(path).then(info => info, () => null)
}

/**
 * Whether an entry is OS metadata that must never enter a user project.
 * @param {string} path - POSIX entry path.
 * @returns {boolean} true for macOS/Windows junk files.
 */
export function isJunkEntry(path) {
  const normalized = path.replace(/\\/g, '/')
  if (normalized === '__MACOSX' || normalized.startsWith('__MACOSX/')) return true
  const name = normalized.slice(normalized.lastIndexOf('/') + 1)
  return name === '.DS_Store' || name === 'Thumbs.db' || name === 'desktop.ini'
}

/**
 * Validate one archive entry path and return it without a trailing slash.
 * Rejects absolute paths, drive letters, UNC, backslashes, NUL, empty/./.. segments.
 * @param {string} name - entry name as reported by the zip reader.
 * @returns {string} the normalized relative path.
 * @throws {ProjectArchiveError} `unsafe-path` for any hostile or unrepresentable name.
 */
export function assertSafeEntryPath(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new ProjectArchiveError('unsafe-path', '压缩包里有空路径')
  }
  const trimmed = name.endsWith('/') ? name.slice(0, -1) : name
  if (trimmed.length === 0) throw new ProjectArchiveError('unsafe-path', '压缩包里有空路径')
  if (trimmed.includes('\\') || trimmed.includes('\0')) {
    throw new ProjectArchiveError('unsafe-path', `压缩包里有不安全的路径：${JSON.stringify(name)}`)
  }
  if (trimmed.startsWith('/') || /^[A-Za-z]:/.test(trimmed)) {
    throw new ProjectArchiveError('unsafe-path', `压缩包里有绝对路径：${JSON.stringify(name)}`)
  }
  // A colon inside a segment is an NTFS alternate data stream target; the
  // visible file would be empty and the payload invisible in Explorer.
  if (trimmed.includes(':')) {
    throw new ProjectArchiveError('unsafe-path', `压缩包里有不安全的路径：${JSON.stringify(name)}`)
  }
  if (Buffer.byteLength(trimmed, 'utf8') > MAX_ENTRY_PATH_BYTES) {
    throw new ProjectArchiveError('unsafe-path', '压缩包里有超长路径')
  }
  for (const segment of trimmed.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new ProjectArchiveError('unsafe-path', `压缩包里有不安全的路径：${JSON.stringify(name)}`)
    }
  }
  return trimmed
}

/**
 * @param {string} path - archive entry path.
 * @returns {number} fflate compression level: store media, deflate text.
 */
function compressionLevel(path) {
  return STORE_EXTENSIONS.has(extname(path).toLowerCase()) ? 0 : 6
}

/**
 * @param {string} dir - directory whose volume is inspected.
 * @returns {Promise<number>} available bytes, Infinity when the query fails.
 */
async function freeBytes(dir) {
  try {
    const info = await statfs(dir)
    return Number(info.bavail) * Number(info.bsize)
  } catch {
    // Some network/UNC data roots do not implement statfs. Skipping the guard
    // keeps the feature usable there; an actual write failure still aborts the
    // job and removes staging/`.part`.
    return Number.POSITIVE_INFINITY
  }
}

/**
 * List project directories directly under projects/.
 * @param {string} projectsDir - absolute projects directory.
 * @returns {Promise<Array<{name: string, path: string}>>} real directories, name-sorted.
 */
export async function listProjects(projectsDir) {
  const entries = await readdir(projectsDir, { withFileTypes: true }).then(found => found, () => [])
  const projects = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || !entry.isDirectory()) continue
    const absolute = join(projectsDir, entry.name)
    if (await isLink(absolute)) continue
    projects.push({ name: entry.name, path: absolute })
  }
  return projects.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Resolve and validate one exportable project directory.
 * @param {string} projectRoot - resolved Easel project root.
 * @param {string} candidate - request path.
 * @returns {Promise<string>} the absolute project directory.
 * @throws {ProjectArchiveError} `not-a-project` when outside projects/ or not a real directory.
 */
async function projectDirectory(projectRoot, candidate) {
  if (!isDirectProjectPath(projectRoot, candidate)) {
    throw new ProjectArchiveError('not-a-project', '只能导出数据位置 projects/ 下的项目')
  }
  const absolute = resolve(candidate)
  const info = await pathInfo(absolute)
  if (info === null || !info.isDirectory() || await isLink(absolute)) {
    throw new ProjectArchiveError('not-a-project', '这个项目目录不存在或不是普通文件夹')
  }
  return absolute
}

/**
 * Walk one project for export. Links and special files are skipped, never
 * followed; unreadable entries are counted and skipped.
 * @param {string} sourceDir - project directory.
 * @returns {Promise<{entries: Array<{absolute: string, path: string, size: number}>, totalBytes: number, skippedLinks: number, skippedUnreadable: number}>} scan result.
 */
async function scanProject(sourceDir) {
  const entries = []
  let totalBytes = 0
  let skippedLinks = 0
  let skippedUnreadable = 0
  let skippedJunk = 0
  const walk = async (dir) => {
    const items = await readdir(dir, { withFileTypes: true }).catch(() => {
      skippedUnreadable += 1
      return []
    })
    items.sort((left, right) => left.name.localeCompare(right.name))
    for (const item of items) {
      const absolute = join(dir, item.name)
      const info = await pathInfo(absolute)
      if (info === null) {
        skippedUnreadable += 1
        continue
      }
      if (await isLink(absolute)) {
        skippedLinks += 1
        continue
      }
      if (info.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!info.isFile()) {
        skippedLinks += 1
        continue
      }
      const readable = await access(absolute, constants.R_OK).then(() => true, () => false)
      if (!readable) {
        skippedUnreadable += 1
        continue
      }
      const path = relative(sourceDir, absolute).split(sep).join('/')
      if (path === MANIFEST_NAME || isJunkEntry(path)) {
        skippedJunk += 1
        continue
      }
      if (path.includes('\\') || path.includes('\0') || path.includes(':')) {
        throw new ProjectArchiveError('bad-name', `文件名称无法写入压缩包：${JSON.stringify(path)}`)
      }
      if (info.size >= MAX_SINGLE_FILE_BYTES) {
        throw new ProjectArchiveError(
          'file-too-large',
          `「${path}」有 ${(info.size / 1024 / 1024 / 1024).toFixed(1)} GB，单个文件超过 4 GB 无法打包；请压缩或拆分该文件`,
        )
      }
      entries.push({ absolute, path, size: info.size })
      totalBytes += info.size
    }
  }
  await walk(sourceDir)
  return { entries, totalBytes, skippedLinks, skippedUnreadable, skippedJunk }
}

/**
 * Streaming zip writer over fflate, mirroring the backup engine's writer. The
 * sink receives contiguous output batches and applies backpressure.
 */
class ArchiveWriter {
  /**
   * @param {(chunk: Buffer) => Promise<void>} sink - output sink.
   * @param {typeof import('fflate')} fflate - loaded zip primitives.
   */
  constructor(sink, fflate) {
    this.sink = sink
    this.pending = []
    this.pendingBytes = 0
    /** @type {Error|undefined} */
    this.failure = undefined
    this.zip = new fflate.Zip((error, data) => {
      if (error !== null) {
        this.failure ??= error
        return
      }
      this.pending.push(Buffer.from(data))
      this.pendingBytes += data.byteLength
    })
    this.ZipDeflate = fflate.ZipDeflate
  }

  async flush() {
    if (this.pending.length === 0) return
    const buffer = Buffer.concat(this.pending)
    this.pending = []
    this.pendingBytes = 0
    await this.sink(buffer)
  }

  async check() {
    if (this.failure !== undefined) throw this.failure
  }

  async drainIfAbove() {
    if (this.pendingBytes >= FLUSH_THRESHOLD_BYTES) await this.flush()
    await this.check()
  }

  /**
   * @param {string} path - archive path.
   * @param {Buffer} data - in-memory entry content.
   */
  async addBuffer(path, data) {
    const deflate = new this.ZipDeflate(path, { level: compressionLevel(path) })
    this.zip.add(deflate)
    await this.check()
    deflate.push(data)
    deflate.push(new Uint8Array(0), true)
    await this.drainIfAbove()
  }

  /**
   * @param {string} path - archive path.
   * @param {string} absolute - source file.
   */
  async addFile(path, absolute) {
    const deflate = new this.ZipDeflate(path, { level: compressionLevel(path) })
    this.zip.add(deflate)
    await this.check()
    for await (const chunk of createReadStream(absolute)) {
      deflate.push(chunk)
      await this.drainIfAbove()
    }
    deflate.push(new Uint8Array(0), true)
    await this.drainIfAbove()
  }

  async finish() {
    this.zip.end()
    await this.flush()
    await this.check()
  }

  terminate() {
    try {
      this.zip.terminate()
    } catch {
      /* already ended or terminated */
    }
  }
}

/**
 * Sink over one output stream honoring backpressure.
 * @param {import('node:fs').WriteStream} output - output file.
 * @returns {(chunk: Buffer) => Promise<void>} sink.
 */
function fileSink(output) {
  const failure = new Promise((_, reject) => {
    output.once('error', reject)
  })
  failure.catch(() => {})
  return async (chunk) => {
    if (!output.write(chunk)) await Promise.race([once(output, 'drain'), failure])
  }
}

/**
 * @param {string} part - completed temporary file.
 * @param {string} destination - final destination.
 */
async function replaceFile(part, destination) {
  try {
    // POSIX rename replaces atomically. Windows may refuse while the target is
    // open in another process; then move the old file aside and restore it if
    // the replacement fails, so a failed export never destroys the original.
    await rename(part, destination)
    return
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM' && error.code !== 'EACCES') throw error
    if (await pathInfo(destination) === null) throw error
  }
  const backup = `${destination}.${randomBytes(4).toString('hex')}.old`
  await rename(destination, backup)
  try {
    await rename(part, destination)
  } catch (error) {
    await rename(backup, destination).catch(() => {})
    throw error
  }
  await rm(backup, { force: true }).catch(() => {})
}

/**
 * Export one project directory as a zip.
 * @param {{ sourceDir: string, destination: string, onProgress?: (progress: object) => void }} options - project and target.
 * @returns {Promise<{path: string, files: number, bytes: number, skippedLinks: number, skippedUnreadable: number}>} export result.
 * @throws {ProjectArchiveError} for invalid paths, oversized entries, space, or IO failures.
 */
export async function exportProjectArchive({ sourceDir, destination, onProgress = () => {} }) {
  const source = resolve(sourceDir)
  const info = await pathInfo(source)
  if (info === null || !info.isDirectory() || await isLink(source)) {
    throw new ProjectArchiveError('not-a-project', '这个项目目录不存在或不是普通文件夹')
  }
  const dest = resolve(destination)
  if (!/\.zip$/i.test(dest)) throw new ProjectArchiveError('bad-destination', '导出文件必须以 .zip 结尾')
  const sourceKey = compareKey(source)
  const destKey = compareKey(dest)
  if (destKey === sourceKey || destKey.startsWith(`${sourceKey}/`)) {
    throw new ProjectArchiveError('destination-inside-source', '导出文件不能放在被导出的项目目录里')
  }
  const parent = await pathInfo(dirname(dest))
  if (parent === null || !parent.isDirectory()) {
    throw new ProjectArchiveError('bad-destination', '导出位置不存在')
  }
  const existing = await pathInfo(dest)
  if (existing !== null && !existing.isFile()) {
    throw new ProjectArchiveError('bad-destination', '导出位置已存在同名文件夹')
  }

  onProgress({ phase: 'scanning', files: 0, bytes: 0, totalBytes: 0 })
  const scan = await scanProject(source)
  if (scan.entries.length === 0) throw new ProjectArchiveError('no-files', '这个项目里没有可打包的文件')
  const free = await freeBytes(dirname(dest))
  if (free < scan.totalBytes + 64 * 1024 * 1024) {
    throw new ProjectArchiveError('disk-space', '导出位置所在磁盘空间不足')
  }
  onProgress({ phase: 'writing', files: 0, bytes: 0, totalBytes: scan.totalBytes })

  const part = `${dest}.part`
  await rm(part, { force: true })
  const fflate = await loadFflate()
  const output = createWriteStream(part)
  const writer = new ArchiveWriter(fileSink(output), fflate)
  try {
    await writer.addBuffer(MANIFEST_NAME, Buffer.from(JSON.stringify({
      format: PROJECT_ARCHIVE_FORMAT,
      version: PROJECT_ARCHIVE_VERSION,
      title: basename(source),
      exportedAt: new Date().toISOString(),
    }, null, 2), 'utf8'))
    let bytes = 0
    let files = 0
    for (const entry of scan.entries) {
      // The scan happened earlier; re-check that the path is still a regular
      // file (an agent may have swapped in a link) and that it did not grow
      // past the writer's single-entry ceiling.
      const current = await pathInfo(entry.absolute)
      if (current === null || !current.isFile() || await isLink(entry.absolute)) {
        throw new ProjectArchiveError('file-changed', `「${entry.path}」在打包过程中被替换，已停止导出`)
      }
      if (current.size >= MAX_SINGLE_FILE_BYTES) {
        throw new ProjectArchiveError('file-too-large', `「${entry.path}」超过 4 GB，无法打包`)
      }
      await writer.addFile(entry.path, entry.absolute)
      bytes += entry.size
      files += 1
      onProgress({ phase: 'writing', files, bytes, totalBytes: scan.totalBytes })
    }
    await writer.finish()
    output.end()
    await finished(output)
    await replaceFile(part, dest)
    onProgress({ phase: 'writing', files, bytes, totalBytes: scan.totalBytes })
    return {
      path: dest,
      files,
      bytes,
      skippedLinks: scan.skippedLinks,
      skippedUnreadable: scan.skippedUnreadable,
      skippedJunk: scan.skippedJunk,
    }
  } catch (error) {
    output.destroy()
    writer.terminate()
    await finished(output).catch(() => {})
    await rm(part, { force: true }).catch(() => {})
    // Windows can report EBUSY for a moment after the handle closes.
    await new Promise(resolvePromise => setTimeout(resolvePromise, 50))
    await rm(part, { force: true }).catch(() => {})
    throw asArchiveError(error)
  }
}

/**
 * Load fflate lazily so a deployment missing the zip engine disables only this
 * feature instead of failing the whole workbench plugin.
 * @returns {Promise<typeof import('fflate')>} the module.
 */
async function loadFflate() {
  try {
    return await import('fflate')
  } catch (error) {
    throw new ProjectArchiveError('archive-engine-unavailable', '压缩包引擎不可用，请重新安装 Easel', { cause: error })
  }
}

/**
 * @param {unknown} error - thrown value.
 * @returns {ProjectArchiveError} a typed failure.
 */
function asArchiveError(error) {
  if (error instanceof ProjectArchiveError) return error
  const detail = error instanceof Error ? error.message : String(error)
  return new ProjectArchiveError('io', detail, { cause: error })
}

/** CRC32 table used to verify every extracted file against the central directory. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

const CRC_SEED = 0xFFFFFFFF

/**
 * @param {number} state - running CRC register.
 * @param {Uint8Array} data - next bytes.
 * @returns {number} updated register.
 */
function crc32Update(state, data) {
  let value = state
  for (let index = 0; index < data.length; index += 1) {
    value = CRC_TABLE[(value ^ data[index]) & 0xFF] ^ (value >>> 8)
  }
  return value >>> 0
}

/**
 * @param {number} state - running CRC register.
 * @returns {number} the finalized CRC32.
 */
function crc32Final(state) {
  return (state ^ 0xFFFFFFFF) >>> 0
}

/**
 * @param {Buffer} buffer - at least 8 bytes at offset.
 * @param {number} offset - little-endian uint64 offset.
 * @returns {number} the value when it fits a safe JS integer.
 */
function readUInt64(buffer, offset) {
  const value = buffer.readBigUInt64LE(offset)
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ProjectArchiveError('invalid-archive', '压缩包过大')
  }
  return Number(value)
}

/**
 * Read exactly one range from an open file.
 * @param {import('node:fs/promises').FileHandle} handle - open archive.
 * @param {number} offset - absolute byte offset.
 * @param {number} length - bytes to read.
 * @returns {Promise<Buffer>} the range.
 */
async function readRange(handle, offset, length) {
  const buffer = Buffer.alloc(length)
  let read = 0
  while (read < length) {
    const { bytesRead } = await handle.read(buffer, read, length - read, offset + read)
    if (bytesRead === 0) throw new ProjectArchiveError('invalid-archive', '压缩包不完整')
    read += bytesRead
  }
  return buffer
}

/**
 * Find the End Of Central Directory record, honoring the comment length.
 * @param {Buffer} tail - last bytes of the archive.
 * @returns {number} offset within the tail, or -1.
 */
function findEndOfCentralDirectory(tail) {
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) !== 0x06054B50) continue
    const commentLength = tail.readUInt16LE(index + 20)
    if (index + 22 + commentLength > tail.length) continue
    return index
  }
  return -1
}

/**
 * Read the central directory's entry CRC and uncompressed size. fflate's
 * streaming unzip does not verify CRCs, and stored media would otherwise
 * import corrupted bytes silently.
 * @param {string} archivePath - local zip.
 * @returns {Promise<Map<string, {crc: number, size: number}>>} entries keyed by the raw archive name.
 */
async function readCentralDirectory(archivePath) {
  const handle = await open(archivePath, 'r')
  try {
    const info = await handle.stat()
    if (info.size < 22) throw new ProjectArchiveError('invalid-archive', '压缩包不完整')
    const tailLength = Math.min(info.size, 66_000)
    const tail = await readRange(handle, info.size - tailLength, tailLength)
    const eocd = findEndOfCentralDirectory(tail)
    if (eocd < 0) throw new ProjectArchiveError('invalid-archive', '压缩包缺少中央目录')
    let total = tail.readUInt16LE(eocd + 10)
    let directorySize = tail.readUInt32LE(eocd + 12)
    let directoryOffset = tail.readUInt32LE(eocd + 16)
    const eocdAbsolute = info.size - tailLength + eocd
    if (total === 0xFFFF || directorySize === 0xFFFFFFFF || directoryOffset === 0xFFFFFFFF) {
      if (eocdAbsolute < 20) throw new ProjectArchiveError('invalid-archive', '压缩包缺少 ZIP64 目录')
      const locator = await readRange(handle, eocdAbsolute - 20, 20)
      if (locator.readUInt32LE(0) !== 0x07064B50) {
        throw new ProjectArchiveError('invalid-archive', '压缩包缺少 ZIP64 定位记录')
      }
      const zip64Offset = readUInt64(locator, 8)
      const zip64 = await readRange(handle, zip64Offset, 56)
      if (zip64.readUInt32LE(0) !== 0x06064B50) {
        throw new ProjectArchiveError('invalid-archive', '压缩包缺少 ZIP64 目录')
      }
      total = readUInt64(zip64, 32)
      directorySize = readUInt64(zip64, 40)
      directoryOffset = readUInt64(zip64, 48)
    }
    if (total > MAX_ARCHIVE_ENTRIES) throw new ProjectArchiveError('too-many-entries', '压缩包里的文件数量过多')
    if (directorySize > 128 * 1024 * 1024 || directoryOffset + directorySize > info.size) {
      throw new ProjectArchiveError('invalid-archive', '压缩包中央目录超出文件范围')
    }
    const directory = directorySize === 0 ? Buffer.alloc(0) : await readRange(handle, directoryOffset, directorySize)
    /** @type {Map<string, {crc: number, size: number}>} */
    const entries = new Map()
    let offset = 0
    for (let index = 0; index < total; index += 1) {
      if (offset + 46 > directory.length || directory.readUInt32LE(offset) !== 0x02014B50) {
        throw new ProjectArchiveError('invalid-archive', '压缩包中央目录损坏')
      }
      const flags = directory.readUInt16LE(offset + 8)
      const crc = directory.readUInt32LE(offset + 16)
      let compressed = directory.readUInt32LE(offset + 20)
      let size = directory.readUInt32LE(offset + 24)
      const nameLength = directory.readUInt16LE(offset + 28)
      const extraLength = directory.readUInt16LE(offset + 30)
      const commentLength = directory.readUInt16LE(offset + 32)
      const entryEnd = offset + 46 + nameLength + extraLength + commentLength
      if (entryEnd > directory.length) {
        throw new ProjectArchiveError('invalid-archive', '压缩包中央目录损坏')
      }
      const name = directory
        .subarray(offset + 46, offset + 46 + nameLength)
        .toString((flags & 0x800) !== 0 ? 'utf8' : 'latin1')
      const extra = directory.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength)
      if (size === 0xFFFFFFFF || compressed === 0xFFFFFFFF) {
        let pointer = 0
        let found = false
        while (pointer + 4 <= extra.length) {
          const id = extra.readUInt16LE(pointer)
          const length = extra.readUInt16LE(pointer + 2)
          if (pointer + 4 + length > extra.length) break
          if (id === 1) {
            let dataPointer = pointer + 4
            if (size === 0xFFFFFFFF) {
              size = readUInt64(extra, dataPointer)
              dataPointer += 8
            }
            if (compressed === 0xFFFFFFFF) compressed = readUInt64(extra, dataPointer)
            found = true
            break
          }
          pointer += 4 + length
        }
        if (!found || size === 0xFFFFFFFF) {
          throw new ProjectArchiveError('invalid-archive', '压缩包 ZIP64 目录损坏')
        }
      }
      assertSafeEntryPath(name)
      if (entries.has(name)) throw new ProjectArchiveError('path-conflict', `压缩包里有重复路径：${name}`)
      entries.set(name, { crc, size })
      offset = entryEnd
    }
    return entries
  } finally {
    await handle.close()
  }
}

/**
 * Read and validate the optional manifest at the extracted root.
 * @param {string} staging - extraction root.
 * @returns {Promise<{title: string}|null>} the manifest title, or null when absent.
 */
async function readManifest(staging) {
  const path = join(staging, MANIFEST_NAME)
  const raw = await readFile(path, 'utf8').then(text => text, () => null)
  if (raw === null) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new ProjectArchiveError('invalid-archive', '项目清单不是合法 JSON', { cause: error })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
    || parsed.format !== PROJECT_ARCHIVE_FORMAT) {
    throw new ProjectArchiveError('invalid-archive', '项目清单格式不正确')
  }
  if (parsed.version !== PROJECT_ARCHIVE_VERSION) {
    throw new ProjectArchiveError('manifest-version', '这个压缩包来自更新的 Easel，请先升级应用')
  }
  if (typeof parsed.title !== 'string' || parsed.title.trim() === '') {
    throw new ProjectArchiveError('invalid-archive', '项目清单缺少项目名')
  }
  if (typeof parsed.exportedAt !== 'string') {
    throw new ProjectArchiveError('invalid-archive', '项目清单缺少导出时间')
  }
  return { title: parsed.title.trim() }
}

/**
 * Extract one zip into staging, validating every entry and its path.
 * @param {string} source - zip path.
 * @param {string} staging - empty staging directory under projects/.
 * @param {number} byteLimit - maximum uncompressed bytes this extraction may write.
 * @param {(progress: object) => void} onProgress - progress sink.
 * @param {Map<string, {crc: number, size: number}>} expected - central-directory entries keyed by raw name.
 * @returns {Promise<{files: Array<{path: string, size: number}>, skippedJunk: number}>} extracted files.
 */
async function extractEntries(source, staging, byteLimit, onProgress, expected) {
  const fflate = await loadFflate()
  const unzip = new fflate.Unzip()
  unzip.register(fflate.UnzipInflate)
  /** @type {ProjectArchiveError|undefined} */
  let failure
  /** @type {{fd: number, path: string, size: number}|null} */
  let open = null
  let entries = 0
  let bytes = 0
  let skippedJunk = 0
  const seen = new Set()
  const seenRaw = new Set()
  const filePaths = new Set()
  const dirPaths = new Set()
  const files = []

  const fail = (code, detail) => {
    failure ??= new ProjectArchiveError(code, detail)
  }
  const startIgnored = (file) => {
    file.ondata = () => {}
    file.start()
  }
  const addImplicitDirs = (path) => {
    const parts = path.split('/')
    for (let index = 1; index < parts.length; index += 1) {
      dirPaths.add(collisionKey(parts.slice(0, index).join('/')))
    }
  }

  unzip.onfile = (file) => {
    entries += 1
    seenRaw.add(file.name)
    if (entries > MAX_ARCHIVE_ENTRIES) {
      fail('too-many-entries', '压缩包里的文件数量过多')
      startIgnored(file)
      return
    }
    let path
    try {
      path = assertSafeEntryPath(file.name)
    } catch (error) {
      fail('unsafe-path', error instanceof Error ? error.message : String(error))
      startIgnored(file)
      return
    }
    if (isJunkEntry(path)) {
      skippedJunk += 1
      startIgnored(file)
      return
    }
    const key = collisionKey(path)
    if (seen.has(key)) {
      fail('path-conflict', `压缩包里有重复路径：${path}`)
      startIgnored(file)
      return
    }
    seen.add(key)
    const isDirectory = file.name.endsWith('/')
    if (isDirectory) {
      if (filePaths.has(key)) {
        fail('path-conflict', `压缩包里的文件与目录同名：${path}`)
        startIgnored(file)
        return
      }
      dirPaths.add(key)
      addImplicitDirs(path)
      try {
        mkdirSync(join(staging, ...path.split('/')), { recursive: true })
      } catch (error) {
        fail('io', `无法创建目录 ${path}：${error.message}`)
      }
      startIgnored(file)
      return
    }
    const parts = path.split('/')
    for (let index = 1; index < parts.length; index += 1) {
      if (filePaths.has(collisionKey(parts.slice(0, index).join('/')))) {
        fail('path-conflict', `压缩包里的文件与目录冲突：${path}`)
        startIgnored(file)
        return
      }
    }
    if (dirPaths.has(key)) {
      fail('path-conflict', `压缩包里的文件与目录同名：${path}`)
      startIgnored(file)
      return
    }
    const absolute = join(staging, ...parts)
    let fd
    try {
      mkdirSync(dirname(absolute), { recursive: true })
      fd = openSync(absolute, 'w')
    } catch (error) {
      fail('io', `无法写入 ${path}：${error.message}`)
      startIgnored(file)
      return
    }
    const current = { fd, path, rawName: file.name, size: 0, crc: CRC_SEED }
    open = current
    file.ondata = (error, data, final) => {
      if (failure !== undefined) {
        if (final) {
          try { closeSync(current.fd) } catch { /* already closed */ }
          if (open === current) open = null
        }
        return
      }
      if (error !== null) {
        fail('invalid-archive', `解压 ${path} 失败：${error.message ?? error}`)
        try { closeSync(current.fd) } catch { /* already closed */ }
        if (open === current) open = null
        return
      }
      try {
        if (data.length > 0) {
          writeSync(current.fd, data)
          current.crc = crc32Update(current.crc, data)
          current.size += data.byteLength
          bytes += data.byteLength
          if (bytes > byteLimit) {
            fail('disk-space', '磁盘空间不足，已停止解压')
          }
        }
        if (final) {
          closeSync(current.fd)
          if (open === current) open = null
          const expectedEntry = expected.get(current.rawName)
          if (expectedEntry === undefined
            || expectedEntry.crc !== crc32Final(current.crc)
            || expectedEntry.size !== current.size) {
            fail('invalid-archive', `CRC 校验失败：${current.path}`)
            return
          }
          files.push({ path: current.path, size: current.size })
          filePaths.add(collisionKey(current.path))
          addImplicitDirs(current.path)
          onProgress({ phase: 'extracting', files: files.length, bytes })
        }
      } catch (writeError) {
        fail('io', `写入 ${path} 失败：${writeError.message}`)
        try { closeSync(current.fd) } catch { /* already closed */ }
        if (open === current) open = null
      }
    }
    file.start()
  }

  try {
    for await (const chunk of createReadStream(source)) {
      unzip.push(chunk, false)
      if (failure !== undefined) throw failure
    }
    unzip.push(new Uint8Array(0), true)
  } catch (error) {
    if (error instanceof ProjectArchiveError) throw error
    throw new ProjectArchiveError('invalid-archive', `压缩包损坏或不是有效 zip：${error instanceof Error ? error.message : error}`, { cause: error })
  } finally {
    if (open !== null) {
      try { closeSync(open.fd) } catch { /* already closed */ }
      open = null
    }
  }
  if (failure !== undefined) throw failure
  if (seenRaw.size !== expected.size) {
    throw new ProjectArchiveError('invalid-archive', '压缩包中央目录与内容不一致')
  }
  for (const name of expected.keys()) {
    if (!seenRaw.has(name)) throw new ProjectArchiveError('invalid-archive', '压缩包中央目录与内容不一致')
  }
  if (files.length === 0) throw new ProjectArchiveError('no-files', '压缩包里没有可导入的文件')
  return { files, skippedJunk }
}

/**
 * Import one zip into projects/, staging and validating before publishing.
 * @param {{ archivePath: string, projectsDir: string, onProgress?: (progress: object) => void }} options - source and destination root.
 * @returns {Promise<{name: string, path: string, files: number, bytes: number, renamed: boolean, skippedJunk: number}>} import result.
 * @throws {ProjectArchiveError} for unsafe, unsupported, oversized, or IO failures.
 */
export async function importProjectArchive({ archivePath, projectsDir, onProgress = () => {} }) {
  const source = resolve(archivePath)
  const info = await pathInfo(source)
  if (info === null || !info.isFile()) throw new ProjectArchiveError('invalid-archive', '找不到这个压缩包')
  await mkdir(projectsDir, { recursive: true })
  // Read the authoritative central directory before writing anything. This
  // validates every entry name and gives the per-entry CRC the streaming
  // unzip cannot check.
  const expected = await readCentralDirectory(source)
  const staging = join(projectsDir, `.easel-import-${randomBytes(8).toString('hex')}`)
  await mkdir(staging, { recursive: true })
  try {
    const free = await freeBytes(projectsDir)
    if (free < MIN_FREE_SPACE) throw new ProjectArchiveError('disk-space', '磁盘空间不足，无法解压项目')
    const byteLimit = free - FREE_SPACE_RESERVE
    if (byteLimit <= 0) throw new ProjectArchiveError('disk-space', '磁盘空间不足，无法解压项目')
    onProgress({ phase: 'extracting', files: 0, bytes: 0 })
    const extracted = await extractEntries(source, staging, byteLimit, onProgress, expected)
    const manifest = await readManifest(staging)
    if (manifest !== null) {
      await rm(join(staging, MANIFEST_NAME), { force: true })
    }
    const remaining = extracted.files.filter(file => manifest === null || file.path !== MANIFEST_NAME)
    if (remaining.length === 0) throw new ProjectArchiveError('no-files', '压缩包里没有可导入的文件')

    let rootRel = ''
    const firstSegments = new Set(remaining.map(file => file.path.split('/')[0]))
    const allNested = remaining.every(file => file.path.includes('/'))
    if (allNested && firstSegments.size === 1) {
      const folder = [...firstSegments][0]
      // Without a manifest the single top folder is always the wrapper. With
      // our manifest it is a wrapper only when it repeats the project title
      // (the unzip-and-rezip-the-folder workflow); otherwise it is project
      // content that happens to be the only top-level directory.
      const sanitizedTitle = manifest === null ? '' : sanitizeProjectTitle(manifest.title, '')
      if (manifest === null || folder === manifest.title || folder === sanitizedTitle) rootRel = folder
    }
    const root = rootRel === '' ? staging : join(staging, ...rootRel.split('/'))
    const rootInfo = await pathInfo(root)
    if (rootInfo === null || !rootInfo.isDirectory()) {
      throw new ProjectArchiveError('invalid-archive', '项目根目录不在压缩包里')
    }
    const projectFiles = rootRel === ''
      ? remaining
      : remaining.filter(file => file.path.startsWith(`${rootRel}/`))
    if (projectFiles.length === 0) throw new ProjectArchiveError('no-files', '压缩包里没有可导入的文件')
    const bytes = projectFiles.reduce((total, file) => total + file.size, 0)

    const rawTitle = manifest?.title ?? (rootRel !== '' ? rootRel : basename(source, extname(source)))
    const baseName = sanitizeProjectTitle(rawTitle, '导入项目') || '导入项目'
    let finalName = baseName
    let target = join(projectsDir, finalName)
    for (let suffix = 2; suffix <= 101; suffix += 1) {
      if (!(await pathExists(target))) break
      if (suffix === 101) throw new ProjectArchiveError('name-conflict', '同名项目太多，无法为导入的项目命名')
      finalName = `${baseName} (${suffix})`
      target = join(projectsDir, finalName)
    }

    await rename(root, target)
    if (root !== staging) await rm(staging, { recursive: true, force: true })
    onProgress({ phase: 'finalizing', files: projectFiles.length, bytes })
    return {
      name: finalName,
      path: target,
      files: projectFiles.length,
      bytes,
      renamed: finalName !== baseName,
      skippedJunk: extracted.skippedJunk,
    }
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
    throw asArchiveError(error)
  }
}

/** @param {string} path - candidate. @returns {Promise<boolean>} true when lstat succeeds. */
async function pathExists(path) {
  return (await pathInfo(path)) !== null
}

/**
 * Build the project-archive routes and in-memory job state for one plugin
 * instance. `deps` exists for tests and never changes production behavior.
 * @param {{projectRoot: string, archiveEnabled?: boolean}} settings - resolved plugin settings.
 * @param {object} [deps] - injectable pickers and engine functions.
 * @returns {{routes: Array, sweepStale: () => Promise<number>, dispose: () => void}} feature surface.
 */
export function createProjectArchiveFeature(settings, deps = {}) {
  const projectsDir = join(settings.projectRoot, 'projects')
  const pickZip = deps.pickZipFile ?? pickZipFile
  const pickSave = deps.pickSaveZip ?? pickSaveZip
  const importFn = deps.importProjectArchive ?? importProjectArchive
  const exportFn = deps.exportProjectArchive ?? exportProjectArchive
  /** @type {object|null} */
  let job = null
  let disposed = false

  const supported = () => settings.archiveEnabled === true
  const failure = (code, detail, status = 400) => ({ status, json: { error: { code, detail } } })
  const update = (jobId, patch) => {
    if (disposed || job === null || job.jobId !== jobId) return
    job = { ...job, ...patch }
  }
  const failJob = (jobId, error) => {
    const mapped = error instanceof ProjectArchiveError
      ? error
      : new ProjectArchiveError('io', error instanceof Error ? error.message : String(error))
    update(jobId, {
      state: 'failed',
      phase: 'done',
      error: { code: mapped.code, detail: mapped.detail ?? mapped.message },
      finishedAt: Date.now(),
    })
  }
  const completeJob = (jobId, result) => {
    update(jobId, {
      state: 'done',
      phase: 'done',
      name: result.name ?? job?.name ?? '',
      files: result.files,
      bytes: result.bytes,
      result,
      finishedAt: Date.now(),
    })
  }
  const runImport = async (jobId, source) => {
    try {
      const result = await importFn({
        archivePath: source,
        projectsDir,
        onProgress: progress => update(jobId, progress),
      })
      completeJob(jobId, result)
    } catch (error) {
      failJob(jobId, error)
    }
  }
  const runExport = async (jobId, source, destination) => {
    try {
      const result = await exportFn({
        sourceDir: source,
        destination,
        onProgress: progress => update(jobId, progress),
      })
      completeJob(jobId, result)
    } catch (error) {
      failJob(jobId, error)
    }
  }

  async function apiProjects() {
    if (!supported()) return { json: { supported: false, projects: [] } }
    try {
      return { json: { supported: true, projects: await listProjects(projectsDir) } }
    } catch (error) {
      return failure('io', error instanceof Error ? error.message : String(error), 500)
    }
  }

  async function apiImport(c) {
    if (!supported()) return failure('unsupported', '当前部署未启用项目压缩包', 501)
    if (job?.state === 'running') return failure('busy', '已有压缩包任务在进行', 409)
    const body = await c.body()
    const locale = body !== null && typeof body === 'object' && body.locale === 'en' ? 'en' : 'zh'
    const jobId = randomBytes(8).toString('hex')
    job = {
      jobId,
      kind: 'import',
      state: 'running',
      phase: 'picking',
      name: '',
      files: 0,
      bytes: 0,
      totalBytes: 0,
      startedAt: Date.now(),
    }
    let picked
    try {
      picked = await pickZip(locale)
    } catch (error) {
      job = null
      if (error instanceof PickerUnavailableError || error?.code === 'picker-unavailable') {
        return failure('picker-unavailable', '系统没有可用的文件选择器', 501)
      }
      throw error
    }
    if (typeof picked !== 'string' || picked.trim() === '') {
      job = null
      return { json: { cancelled: true } }
    }
    const source = picked.trim()
    job = { ...job, phase: 'extracting', name: basename(source) }
    void runImport(jobId, source)
    return { json: { jobId, sourceName: basename(source) } }
  }

  async function apiExport(c) {
    if (!supported()) return failure('unsupported', '当前部署未启用项目压缩包', 501)
    if (job?.state === 'running') return failure('busy', '已有压缩包任务在进行', 409)
    const body = await c.body()
    const rawPath = body !== null && typeof body === 'object' && typeof body.path === 'string' ? body.path.trim() : ''
    if (rawPath === '') return failure('not-a-project', '缺少要导出的项目路径')
    let project
    try {
      project = await projectDirectory(settings.projectRoot, rawPath)
    } catch (error) {
      if (error instanceof ProjectArchiveError) return failure(error.code, error.detail)
      throw error
    }
    const locale = body !== null && typeof body === 'object' && body.locale === 'en' ? 'en' : 'zh'
    const name = basename(project)
    const jobId = randomBytes(8).toString('hex')
    job = {
      jobId,
      kind: 'export',
      state: 'running',
      phase: 'picking',
      name,
      files: 0,
      bytes: 0,
      totalBytes: 0,
      startedAt: Date.now(),
    }
    let picked
    try {
      picked = await pickSave(locale, `${name}.zip`)
    } catch (error) {
      job = null
      if (error instanceof PickerUnavailableError || error?.code === 'picker-unavailable') {
        return failure('picker-unavailable', '系统没有可用的保存对话框', 501)
      }
      throw error
    }
    if (typeof picked !== 'string' || picked.trim() === '') {
      job = null
      return { json: { cancelled: true } }
    }
    let destination = picked.trim()
    if (!/\.zip$/i.test(destination)) destination = `${destination}.zip`
    job = { ...job, phase: 'scanning', destination: resolve(destination) }
    void runExport(jobId, project, resolve(destination))
    return { json: { jobId, destination: resolve(destination) } }
  }

  function apiJob() {
    if (job === null) return { json: { state: 'idle' } }
    if (job.state !== 'running' && Date.now() - (job.finishedAt ?? 0) > JOB_RESULT_TTL_MS) {
      job = null
      return { json: { state: 'idle' } }
    }
    return { json: job }
  }

  const routes = [
    ['GET', ['projects'], apiProjects],
    ['POST', ['projects', 'import'], apiImport],
    ['POST', ['projects', 'export'], apiExport],
    ['GET', ['projects', 'job'], apiJob],
  ]

  return {
    routes,
    async sweepStale() {
      const entries = await readdir(projectsDir, { withFileTypes: true }).catch(() => [])
      let removed = 0
      for (const entry of entries) {
        if (!entry.name.startsWith('.easel-import-') || !entry.isDirectory()) continue
        const absolute = join(projectsDir, entry.name)
        const info = await pathInfo(absolute)
        if (info === null || Date.now() - info.mtimeMs < STALE_STAGING_MS) continue
        await rm(absolute, { recursive: true, force: true }).catch(() => {})
        removed += 1
      }
      return removed
    },
    dispose() {
      disposed = true
    },
  }
}
