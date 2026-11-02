/**
 * Bundle assembly: pre-flight walking, staged receipt, three-way
 * verification, resume, destination refusal, and import-failure reporting.
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { expect, it } from 'vitest'
import {
  HandoffPreparationError,
  HandoffReceiveError,
  prepareBundle,
  projectDirectoryName,
  receiveHandoff,
  sendPreparedBundle,
  walkProjectTree,
  type HandoffImportHost,
} from '../src/handoff.ts'
import { loadDeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import { attachChannel, type ConnectionChannel } from '../src/pairing.ts'

const encoder = new TextEncoder()

/** One loopback channel pair and its teardown. */
interface Loop {
  readonly client: ConnectionChannel
  readonly server: ConnectionChannel
  readonly close: () => Promise<void>
}

/** Boot one loopback TLS pair with channels on both ends. */
async function loopback(): Promise<Loop> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-handoff-'))
  const identity = await loadDeviceIdentity(root)
  const accepted = Promise.withResolvers<ConnectionChannel>()
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    accepted.resolve(attachChannel(socket))
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  const server = await accepted.promise
  return {
    client: attachChannel(socket),
    server,
    close: async () => {
      socket.destroy()
      await listener.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

/** Host recording the product-seam calls. */
class RecordingHost implements HandoffImportHost {
  readonly imported: { archives: readonly Uint8Array[]; targetCwd: string }[] = []
  readonly attached: { projectPath: string; title: string; sessionIds: readonly string[] }[] = []

  constructor(private readonly failImport = false, private readonly sessionIds: readonly string[] = ['session-1']) {}

  async importSessionArchives(archives: readonly Uint8Array[], targetCwd: string): Promise<readonly string[]> {
    this.imported.push({ archives, targetCwd })
    if (this.failImport) throw new Error('store refused the archive')
    return this.sessionIds
  }

  async attachProject(projectPath: string, title: string, sessionIds: readonly string[]): Promise<void> {
    this.attached.push({ projectPath, title, sessionIds })
  }
}

interface ProjectFixture {
  readonly root: string
  readonly files: readonly string[]
}

/** Create one source project with nested, unicode, empty, and large files. */
async function projectFixture(): Promise<ProjectFixture> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-handoff-src-'))
  const large = Buffer.alloc(300 * 1024)
  for (let index = 0; index < large.length; index += 1) large[index] = index % 251
  const files = ['素材/notes.txt', '素材/成品/final.bin', '项目资料.md', 'empty.txt']
  await mkdir(join(root, '素材', '成品'), { recursive: true })
  await writeFile(join(root, '素材', 'notes.txt'), 'handoff notes', 'utf8')
  await writeFile(join(root, '素材', '成品', 'final.bin'), large)
  await writeFile(join(root, '项目资料.md'), '# 项目\n', 'utf8')
  await writeFile(join(root, 'empty.txt'), new Uint8Array())
  return { root, files }
}

/** The session archive bytes this suite ships. */
const SESSION_ZIP = encoder.encode('PK\u0003\u0004session archive bytes')

/** Prepare one bundle over the fixture project. */
async function preparedFixture() {
  const project = await projectFixture()
  const prepared = await prepareBundle({
    projectPath: project.root,
    projectTitle: '项目 甲/测试',
    sessionArchives: [{
      sessionId: 'session-1',
      archiveName: 'dsh-session-session-1.zip',
      open: async () => SESSION_ZIP,
    }],
  })
  return { project, prepared }
}

/** Walk a tree into a path → digest map. */
async function treeDigest(root: string): Promise<Map<string, string>> {
  const files = await walkProjectTree(root)
  return new Map(files.map(file => [file.relativePath, file.sha256]))
}

it('walks the project tree with hashes and refuses a missing directory', async () => {
  const project = await projectFixture()
  try {
    const files = await walkProjectTree(project.root)
    expect(files.map(file => file.relativePath)).toEqual([
      'empty.txt',
      '素材/notes.txt',
      '素材/成品/final.bin',
      '项目资料.md',
    ])
    const empty = files.find(file => file.relativePath === 'empty.txt')
    expect(empty?.size).toBe(0)
    expect(empty?.sha256).toBe(createHash('sha256').update(new Uint8Array()).digest('hex'))
    await expect(walkProjectTree(join(project.root, 'missing'))).rejects.toBeInstanceOf(HandoffPreparationError)
  } finally {
    await rm(project.root, { recursive: true, force: true })
  }
})

it('prepares a manifest whose summary matches its entries', async () => {
  const { project, prepared } = await preparedFixture()
  try {
    expect(prepared.manifest.projectTitle).toBe('项目 甲/测试')
    expect(prepared.manifest.sourceCwd).toBe(project.root)
    expect(prepared.manifest.entries.filter(entry => entry.kind === 'file').length).toBe(4)
    const session = prepared.manifest.entries.find(entry => entry.kind === 'session')
    expect(session).toMatchObject({
      path: 'dsh-session-session-1.zip',
      size: SESSION_ZIP.byteLength,
      sha256: createHash('sha256').update(SESSION_ZIP).digest('hex'),
    })
    expect(prepared.manifest.treeSummary.entryCount).toBe(prepared.manifest.entries.length)
    expect(prepared.manifest.treeSummary.totalBytes)
      .toBe(prepared.manifest.entries.reduce((total, entry) => total + entry.size, 0))
  } finally {
    await rm(project.root, { recursive: true, force: true })
  }
})

it('receives a bundle end to end: verified files, moved project, imported sessions', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-dst-'))
  const loop = await loopback()
  try {
    const host = new RecordingHost()
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: destination, host })
    const sent = await sendPreparedBundle(loop.client, prepared)
    const outcome = await receipt

    expect(sent.sent.length).toBe(prepared.manifest.entries.length)
    expect(sent.skipped).toEqual([])
    expect(outcome.projectPath).toBe(join(destination, projectDirectoryName('项目 甲/测试')))
    expect(outcome.sessionIds).toEqual(['session-1'])
    expect(outcome.skipped).toEqual([])
    expect(await treeDigest(outcome.projectPath)).toEqual(await treeDigest(project.root))
    expect(host.imported).toHaveLength(1)
    expect(host.imported[0]?.targetCwd).toBe(outcome.projectPath)
    expect(Buffer.from(host.imported[0]?.archives[0] ?? new Uint8Array())).toEqual(Buffer.from(SESSION_ZIP))
    expect(host.attached).toEqual([{
      projectPath: outcome.projectPath,
      title: projectDirectoryName('项目 甲/测试'),
      sessionIds: ['session-1'],
    }])
    await expect(stat(join(destination, `.handoff-${prepared.manifest.bundleId}`))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('resumes from a staged file that already matches', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-resume-'))
  const loop = await loopback()
  try {
    const staging = join(destination, `.handoff-${prepared.manifest.bundleId}`)
    const staged = prepared.manifest.entries.find(entry => entry.kind === 'file' && entry.path === '素材/notes.txt')
    if (staged === undefined) throw new Error('fixture lost its notes entry')
    await mkdir(join(staging, '素材'), { recursive: true })
    await writeFile(join(staging, '素材', 'notes.txt'), 'handoff notes', 'utf8')

    const host = new RecordingHost()
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: destination, host })
    const sent = await sendPreparedBundle(loop.client, prepared)
    const outcome = await receipt

    expect(sent.skipped.map(entry => entry.path)).toContain('素材/notes.txt')
    expect(outcome.skipped.map(entry => entry.path)).toContain('素材/notes.txt')
    expect(await treeDigest(outcome.projectPath)).toEqual(await treeDigest(project.root))
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('refuses a destination that already exists', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-exists-'))
  const loop = await loopback()
  try {
    await mkdir(join(destination, projectDirectoryName('项目 甲/测试')), { recursive: true })
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: destination, host: new RecordingHost() })
      .catch((error: unknown) => error)
    const sendFailure = sendPreparedBundle(loop.client, prepared)
      .catch((error: unknown) => error)
    const [receiptError, sendError] = await Promise.all([receipt, sendFailure])
    expect(receiptError).toMatchObject({ name: 'TransferRejectedError' })
    expect(sendError).toMatchObject({ name: 'TransferRejectedError' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('cleans staging when the received tree does not match the manifest', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-tamper-'))
  const loop = await loopback()
  try {
    const staging = join(destination, `.handoff-${prepared.manifest.bundleId}`)
    await mkdir(staging, { recursive: true })
    await writeFile(join(staging, 'intruder.txt'), 'not in the manifest', 'utf8')
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: destination, host: new RecordingHost() })
    void sendPreparedBundle(loop.client, prepared).catch(() => undefined)
    await expect(receipt).rejects.toMatchObject({ code: 'verification' })
    await expect(stat(staging)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(destination, projectDirectoryName('项目 甲/测试')))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('keeps the verified project files and reports the path when importing fails', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-import-fail-'))
  const loop = await loopback()
  try {
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: new RecordingHost(true),
    })
    void sendPreparedBundle(loop.client, prepared).catch(() => undefined)
    const failure = await receipt.then(
      () => { throw new Error('expected the import to fail') },
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(HandoffReceiveError)
    expect((failure as HandoffReceiveError).code).toBe('import')
    const finalPath = join(destination, projectDirectoryName('项目 甲/测试'))
    expect((failure as Error).message).toContain(finalPath)
    expect(await treeDigest(finalPath)).toEqual(await treeDigest(project.root))
    const kept = await readFile(join(finalPath, '素材', 'notes.txt'), 'utf8')
    expect(kept).toBe('handoff notes')
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('leaves product seams untouched when the offer is refused before receipt', async () => {
  // receiveBundle refuses an unparsable offer before decideOffer; the host
  // must see no calls. This pins the ordering of validation and side effects.
  const loop = await loopback()
  try {
    const host = new RecordingHost()
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: tmpdir(), host })
    loop.client.write({ type: 'offer', binaryLength: 0, manifest: { broken: true } })
    await expect(receipt).rejects.toMatchObject({ name: 'TransferProtocolError' })
    expect(host.imported).toEqual([])
    expect(host.attached).toEqual([])
  } finally {
    await loop.close()
  }
})
