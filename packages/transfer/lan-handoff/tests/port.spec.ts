/** The remembered listener port: round trip, absence, and unusable files. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { loadSavedPort, saveSavedPort } from '../src/port.ts'

/** One temporary handoff root. */
async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'dsh-lan-port-'))
}

it('round-trips the last bound port and treats absence as unset', async () => {
  const root = await tempRoot()
  try {
    expect(await loadSavedPort(root)).toBeUndefined()
    await saveSavedPort(root, 40123)
    expect(await loadSavedPort(root)).toBe(40123)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('ignores an unreadable, malformed, or out-of-range stored port', async () => {
  const root = await tempRoot()
  try {
    const file = join(root, 'listener-port.json')
    for (const content of ['not json', '42', JSON.stringify({ port: 0 }), JSON.stringify({ port: 70000 }), JSON.stringify({ port: 'x' })]) {
      await writeFile(file, content, 'utf8')
      expect(await loadSavedPort(root)).toBeUndefined()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
