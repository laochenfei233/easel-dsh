/**
 * Durable paired-device records for LAN handoff.
 *
 * The store is one JSON file under the handoff root. It records only ids,
 * display names, platforms, and pairing timestamps; identity keys live in the
 * identity file, and nothing from the peer beyond what discovery already
 * shows is duplicated here.
 * @module @deepseek-ai/dsh-lan-handoff/peers
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DeviceId } from './identity.ts'
import type { LanPlatform } from './discovery.ts'

/** One paired device as stored on this device. */
export interface PairedPeer {
  /** The peer's device id, derived from its certificate. */
  readonly id: DeviceId
  /** Display name the peer advertised at pairing time. */
  readonly name: string
  /** Platform the peer advertised at pairing time. */
  readonly platform: LanPlatform
  /** Pairing time as epoch milliseconds. */
  readonly pairedAt: number
}

/** On-disk record wrapper. */
interface PairedPeersDocument {
  readonly version: 1
  readonly peers: readonly PairedPeer[]
}

/** File name of the paired-device store inside the handoff root. */
const PEERS_FILE_NAME = 'peers.json'

/** Failure for a readable-but-invalid peers file. */
export class PairedPeersCorruptError extends Error {
  /**
   * @param path - the unusable peers file, quoted in the message.
   * @param cause - the original parse failure.
   */
  constructor(readonly path: string, cause: unknown) {
    super(`LAN handoff peers file at ${path} is unreadable (${String(cause)}); delete the file to start pairing from scratch`)
  }
}

/**
 * Load every paired peer.
 * @param root - handoff root directory.
 * @returns paired peers keyed by device id.
 * @throws {PairedPeersCorruptError} when the file exists but is not a valid peers document.
 */
export async function loadPairedPeers(root: string): Promise<Map<string, PairedPeer>> {
  const file = join(root, PEERS_FILE_NAME)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new PairedPeersCorruptError(file, error)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new PairedPeersCorruptError(file, new TypeError('peers document is not an object'))
  }
  const document = parsed as { readonly version?: unknown; readonly peers?: unknown }
  if (document.version !== 1 || !Array.isArray(document.peers)) {
    throw new PairedPeersCorruptError(file, new TypeError('peers document is not version 1'))
  }
  const peers = new Map<string, PairedPeer>()
  for (const entry of document.peers) {
    if (typeof entry !== 'object' || entry === null) {
      throw new PairedPeersCorruptError(file, new TypeError('peers list contains a non-object entry'))
    }
    const record = entry as Record<string, unknown>
    const id = record['id']
    const name = record['name']
    const platform = record['platform']
    const pairedAt = record['pairedAt']
    if (typeof id !== 'string' || typeof name !== 'string' || typeof pairedAt !== 'number'
      || (platform !== 'windows' && platform !== 'macos' && platform !== 'linux')) {
      throw new PairedPeersCorruptError(file, new TypeError(`peers list contains an invalid entry for ${String(id)}`))
    }
    peers.set(id, { id: id as DeviceId, name, platform, pairedAt })
  }
  return peers
}

/**
 * Persist every paired peer atomically: a temporary file replaces the previous
 * document, so a crash never leaves a half-written store.
 * @param root - handoff root directory.
 * @param peers - paired peers keyed by device id.
 */
export async function savePairedPeers(root: string, peers: ReadonlyMap<string, PairedPeer>): Promise<void> {
  const file = join(root, PEERS_FILE_NAME)
  await mkdir(dirname(file), { recursive: true })
  const document: PairedPeersDocument = { version: 1, peers: [...peers.values()] }
  const temporary = `${file}.tmp`
  await writeFile(temporary, JSON.stringify(document), { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, file)
}
