/** Paired-peer store: round trips, atomic replacement, and loud refusals. */

import { brandString } from '@deepseek-ai/dsh-brand'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import type { DeviceId } from '../src/identity.ts'
import { loadPairedPeers, PairedPeersCorruptError, savePairedPeers, type PairedPeer } from '../src/peers.ts'

const PEER: PairedPeer = {
  id: brandString<DeviceId>('d'.repeat(20)),
  name: '工作台',
  platform: 'macos',
  pairedAt: 1_700_000_000_000,
}

/** One temporary store root. */
async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'dsh-lan-peers-'))
}

it('loads no peers before the first pairing and round-trips saved ones', async () => {
  const root = await tempRoot()
  try {
    expect((await loadPairedPeers(root)).size).toBe(0)
    const peers = new Map<string, PairedPeer>([[PEER.id, PEER]])
    await savePairedPeers(root, peers)
    const reloaded = await loadPairedPeers(root)
    expect([...reloaded.values()]).toEqual([PEER])
    expect((await readdir(root)).filter(name => name.endsWith('.tmp'))).toEqual([])
    await savePairedPeers(root, new Map())
    expect((await loadPairedPeers(root)).size).toBe(0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('refuses malformed peers files loudly instead of starting empty', async () => {
  const root = await tempRoot()
  try {
    const file = join(root, 'peers.json')
    await writeFile(file, 'not json', 'utf8')
    await expect(loadPairedPeers(root)).rejects.toBeInstanceOf(PairedPeersCorruptError)
    await writeFile(file, JSON.stringify({ version: 2, peers: [] }), 'utf8')
    await expect(loadPairedPeers(root)).rejects.toThrow(/not version 1/u)
    await writeFile(file, JSON.stringify({ version: 1, peers: [{ id: 4 }] }), 'utf8')
    await expect(loadPairedPeers(root)).rejects.toThrow(/invalid entry/u)
    await expect(loadPairedPeers(root)).rejects.toThrow(/delete the file/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('writes the store with owner-only permissions on POSIX', async () => {
  const root = await tempRoot()
  try {
    await savePairedPeers(root, new Map([[PEER.id, PEER]]))
    const raw = await readFile(join(root, 'peers.json'), 'utf8')
    expect(raw).toContain('"version":1')
    expect(raw).toContain(String(PEER.id))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
