import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { BackupError } from '../errors.js'
import { toPosixPath } from '../collections.js'
import type { Destination, RemoteObject } from '../types.js'

/** Temporary suffix for atomic writes onto the share. */
const TEMP_SUFFIX = '.backup-tmp'

/**
 * SMB destination: write through the OS SMB stack by treating the UNC,
 * mapped-drive, or mounted-share path as a filesystem root. Credential wiring
 * (`net use` on Windows, mounting on macOS) is the caller's setup step; this
 * implementation only needs the path to resolve.
 */
export class FsDestination implements Destination {
  /**
   * @param root - Absolute UNC/mapped/mounted path used as the destination root.
   */
  constructor(private readonly root: string) {}

  /**
   * Resolve a POSIX key to an on-disk path under the root.
   * @param key - Key with `/` separators.
   * @returns The absolute path.
   */
  private pathFor(key: string): string {
    const segments = key.split('/')
    if (key.startsWith('/') || segments.includes('..')) {
      throw new BackupError('CONFIG', `目标端 key 不合法：${JSON.stringify(key)}`)
    }
    return join(this.root, ...segments)
  }

  /**
   * @inheritdoc Destination.probe
   */
  async probe(): Promise<void> {
    try {
      await mkdir(this.root, { recursive: true })
    } catch (error) {
      throw new BackupError('DESTINATION_UNREACHABLE', `目标目录不可写：${this.root}`, { cause: error })
    }
    const probeKey = '.easel-backup-probe'
    await this.put(probeKey, Buffer.from('easel-backup probe', 'utf8'))
    await this.del(probeKey)
  }

  /**
   * @inheritdoc Destination.put
   */
  async put(key: string, source: string | Uint8Array): Promise<void> {
    const target = this.pathFor(key)
    await mkdir(dirname(target), { recursive: true })
    const temporary = `${target}.${process.pid}${TEMP_SUFFIX}`
    if (typeof source === 'string') {
      await pipeline(createReadStream(source), createWriteStream(temporary))
    } else {
      await writeFile(temporary, source)
    }
    try {
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { force: true })
      throw new BackupError('DESTINATION_UNREACHABLE', `写入目标失败：${target}`, { cause: error })
    }
  }

  /**
   * @inheritdoc Destination.get
   */
  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const target = this.pathFor(key)
    try {
      await stat(target)
    } catch {
      throw new BackupError('DESTINATION_MISSING', `目标端没有这个文件：${key}`)
    }
    return Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>
  }

  /**
   * @inheritdoc Destination.list
   */
  async list(prefix: string): Promise<RemoteObject[]> {
    const dir = this.pathFor(prefix.replace(/\/$/, ''))
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true, recursive: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new BackupError('DESTINATION_UNREACHABLE', `读取目标目录失败：${dir}`, { cause: error })
    }
    const objects: RemoteObject[] = []
    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isFile()) continue
      const absolutePath = join(entry.parentPath, entry.name)
      const key = toPosixPath(relative(this.root, absolutePath))
      if (key.endsWith(TEMP_SUFFIX)) continue
      objects.push({ key, size: (await stat(absolutePath)).size })
    }
    return objects
  }

  /**
   * @inheritdoc Destination.del
   */
  async del(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }
}
