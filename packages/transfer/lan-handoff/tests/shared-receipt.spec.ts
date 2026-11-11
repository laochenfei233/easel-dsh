/**
 * The shared multi-connection receipt: staging prepared once, resume reports
 * shared by every worker, and a receipt that settles exactly once.
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { ChannelClosedError } from '../src/pairing.ts'
import {
  bundleFromFiles,
  SharedReceipt,
  type HandoffImportHost,
  type HandoffReceiveProgress,
} from '../src/handoff.ts'
import type { BundleEntryRef } from '../src/transfer.ts'

/** Host that records what the receipt handed it. */
function recordingHost(): HandoffImportHost & { attached: string[] } {
  const attached: string[] = []
  return {
    attached,
    importSessionArchives: async () => [],
    attachProject: async (projectPath: string) => { attached.push(projectPath) },
  }
}

/** One prepared project bundle with content-derived identity. */
async function fixture(): Promise<{ root: string; entry: BundleEntryRef; bundleId: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-shared-receipt-'))
  await writeFile(join(root, 'a.txt'), 'AAAA', 'utf8')
  const prepared = await bundleFromFiles({
    projectTitle: '共享',
    files: [{
      absolutePath: join(root, 'a.txt'),
      relativePath: 'a.txt',
      size: 4,
      sha256: createHash('sha256').update('AAAA').digest('hex'),
    }],
    sessionArchives: [],
    sourceCwd: root,
  })
  const entry = prepared.manifest.entries[0]
  if (entry === undefined) throw new Error('fixture has no entry')
  return { root, entry, bundleId: prepared.manifest.bundleId }
}

it('prepares staging once and settles after every worker records', async () => {
  const project = await mkdtemp(join(tmpdir(), 'dsh-shared-prep-'))
  const destination = await mkdtemp(join(tmpdir(), 'dsh-shared-prep-in-'))
  const phases: HandoffReceiveProgress['phase'][] = []
  try {
    await writeFile(join(project, 'a.txt'), 'AAAA', 'utf8')
    const prepared = await bundleFromFiles({
      projectTitle: '共享',
      files: [{
        absolutePath: join(project, 'a.txt'),
        relativePath: 'a.txt',
        size: 4,
        sha256: createHash('sha256').update('AAAA').digest('hex'),
      }],
      sessionArchives: [],
      sourceCwd: project,
    })
    const entry = prepared.manifest.entries[0]
    if (entry === undefined) throw new Error('fixture has no entry')
    const host = recordingHost()
    const receipt = new SharedReceipt(prepared.manifest, destination, undefined, undefined, host, 2, progress => phases.push(progress.phase))
    const decision = await receipt.start()
    expect(decision.accept).toBe(true)
    // Every worker sees the same resume report; the first worker answers at once.
    await expect(receipt.decide({ index: 0, total: 2 })).resolves.toMatchObject({ accept: true, completed: [] })
    await expect(receipt.decide({ index: 1, total: 2 })).resolves.toMatchObject({ accept: true, completed: [] })
    const sink = await receipt.openEntry(entry, 0)
    await sink.write(new TextEncoder().encode('AAAA'))
    await sink.commit()
    receipt.record({ index: 0, total: 2 }, [entry])
    receipt.record({ index: 1, total: 2 }, [])
    const outcome = await receipt.completion
    expect(outcome.projectPath).toBe(join(destination, '共享'))
    expect(host.attached).toEqual([outcome.projectPath])
    // A failure reported after settlement is ignored.
    receipt.fail(new Error('late failure after settle is ignored'))
    expect(await readFile(join(outcome.projectPath, 'a.txt'), 'utf8')).toBe('AAAA')
    expect(phases).toContain('verifying')
  } finally {
    await rm(project, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('refuses a data bundle without a receiving data root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-shared-refuse-'))
  const destination = await mkdtemp(join(tmpdir(), 'dsh-shared-refuse-in-'))
  try {
    const prepared = await bundleFromFiles({
      projectTitle: '无数据根',
      files: [],
      sessionArchives: [],
      dataFiles: [{ path: '.env', bytes: new TextEncoder().encode('A=1') }],
    })
    const receipt = new SharedReceipt(prepared.manifest, destination, undefined, undefined, recordingHost(), 2, undefined)
    const decision = await receipt.start()
    expect(decision.accept).toBe(false)
    await expect(receipt.decide({ index: 1, total: 2 })).rejects.toBeDefined()
    await expect(receipt.completion).rejects.toBeDefined()
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('discards a staged entry on demand', async () => {
  const fixtureValue = await fixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-shared-discard-'))
  try {
    const prepared = await bundleFromFiles({
      projectTitle: '共享',
      files: [],
      sessionArchives: [],
      sourceCwd: fixtureValue.root,
    })
    const receipt = new SharedReceipt(
      { ...prepared.manifest, entries: [fixtureValue.entry], treeSummary: prepared.manifest.treeSummary },
      destination,
      undefined,
      undefined,
      recordingHost(),
      2,
      undefined,
    )
    await receipt.start()
    const sink = await receipt.openEntry(fixtureValue.entry, 0)
    await sink.write(new TextEncoder().encode('AA'))
    await sink.discard()
    await expect(stat(join(destination, '.handoff-' + prepared.manifest.bundleId, 'a.txt')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await rm(fixtureValue.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('reports resumed bytes from the staged prefix', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-shared-resume-'))
  const destination = await mkdtemp(join(tmpdir(), 'dsh-shared-resume-in-'))
  const phases: HandoffReceiveProgress[] = []
  try {
    await writeFile(join(root, 'a.txt'), 'AAAAAAAA', 'utf8')
    const prepared = await bundleFromFiles({
      projectTitle: '续传',
      files: [{
        absolutePath: join(root, 'a.txt'),
        relativePath: 'a.txt',
        size: 8,
        sha256: createHash('sha256').update('AAAAAAAA').digest('hex'),
      }],
      sessionArchives: [],
      sourceCwd: root,
    })
    // Stage a genuine prefix so the receipt reports partial bytes.
    const staging = join(destination, '.handoff-' + prepared.manifest.bundleId)
    await mkdir(staging, { recursive: true })
    await writeFile(join(staging, 'a.txt'), 'AAAA', 'utf8')
    const receipt = new SharedReceipt(prepared.manifest, destination, undefined, undefined, recordingHost(), 2, progress => phases.push(progress))
    const decision = await receipt.start()
    expect(decision.partial).toEqual([{ kind: 'file', path: 'a.txt', sha256: prepared.manifest.entries[0]?.sha256, bytes: 4 }])
    const entry = prepared.manifest.entries[0]
    if (entry === undefined) throw new Error('fixture has no entry')
    const sink = await receipt.openEntry(entry, 4)
    await sink.write(new TextEncoder().encode('AAAA'))
    await sink.commit()
    receipt.record({ index: 0, total: 2 }, [entry])
    receipt.record({ index: 1, total: 2 }, [])
    await receipt.completion
    expect(phases.some(progress => progress.bytesDone === 8)).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('marks a dropped connection as retryable for the sender', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-shared-drop-'))
  const destination = await mkdtemp(join(tmpdir(), 'dsh-shared-drop-in-'))
  try {
    const prepared = await bundleFromFiles({ projectTitle: '掉线', files: [], sessionArchives: [] })
    const receipt = new SharedReceipt(prepared.manifest, destination, undefined, undefined, recordingHost(), 2, undefined)
    await receipt.start()
    receipt.fail(new ChannelClosedError())
    await expect(receipt.completion).rejects.toBeInstanceOf(ChannelClosedError)
    // A second failure report changes nothing.
    receipt.fail(new ChannelClosedError())
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})
