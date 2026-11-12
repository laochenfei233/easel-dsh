/**
 * Bundle assembly: pre-flight walking, staged receipt, three-way
 * verification, resume, destination refusal, and import-failure reporting.
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { afterEach, expect, it, vi } from 'vitest'
import {
  bundleFromFiles,
  cleanupStaleReceipts,
  HandoffPreparationError,
  HandoffReceiveError,
  prepareBundle,
  preparedEntryReader,
  projectDirectoryName,
  receiveHandoff,
  sendPreparedBundle,
  walkProjectTree,
  type HandoffImportHost,
  type HandoffPathRemap,
  type HandoffReceiveProgress,
  type PreparedBundle,
  type ReceivedConfigDocument,
} from '../src/handoff.ts'
import { TransferIntegrityError } from '../src/transfer.ts'
import { loadDeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import { attachChannel, type ConnectionChannel } from '../src/pairing.ts'

const encoder = new TextEncoder()

/** Write fixture archive bytes to the spool file the sender hands over. */
async function writeFixtureArchive(absolutePath: string, bytes: Uint8Array): Promise<{ readonly size: number; readonly sha256: string }> {
  await writeFile(absolutePath, bytes)
  return { size: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }
}

/** One loopback channel pair and its teardown. */
interface Loop {
  readonly client: ConnectionChannel
  readonly server: ConnectionChannel
  readonly endClient: () => void
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
    endClient: () => { socket.end() },
    close: async () => {
      socket.destroy()
      await listener.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

/** Host recording the product-seam calls. */
class RecordingHost implements HandoffImportHost {
  readonly imported: { archives: readonly Uint8Array[]; targetCwd: string; remaps?: readonly HandoffPathRemap[] }[] = []
  readonly attached: { projectPath: string; title: string; sessionIds: readonly string[] }[] = []
  readonly configs: { name: string; text: string }[] = []

  constructor(
    private readonly failImport = false,
    private readonly sessionIds: readonly string[] = ['session-1'],
    private readonly failConfig = false,
  ) {}

  async importSessionArchives(
    readers: readonly (() => Promise<Uint8Array>)[],
    targetCwd: string,
    remaps?: readonly HandoffPathRemap[],
  ): Promise<readonly string[]> {
    const archives: Uint8Array[] = []
    for (const read of readers) archives.push(await read())
    this.imported.push({ archives, targetCwd, ...remaps === undefined ? {} : { remaps } })
    if (this.failImport) throw new Error('store refused the archive')
    return this.sessionIds
  }

  async attachProject(projectPath: string, title: string, sessionIds: readonly string[]): Promise<void> {
    this.attached.push({ projectPath, title, sessionIds })
  }

  async applyConfigDocuments(documents: readonly ReceivedConfigDocument[]): Promise<void> {
    for (const document of documents) {
      this.configs.push({ name: document.name, text: new TextDecoder().decode(document.bytes) })
    }
    if (this.failConfig) throw new Error('settings refused the document')
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
      writeTo: async (absolutePath) => writeFixtureArchive(absolutePath, SESSION_ZIP),
    }],
  })
  if (prepared.spoolDirectory !== undefined) spooled.push(prepared.spoolDirectory)
  return { project, prepared }
}

/** Spool directories prepared bundles created, removed after each suite run. */
const spooled: string[] = []

afterEach(async () => {
  for (const directory of spooled.splice(0)) await rm(directory, { recursive: true, force: true })
})

/**
 * Stream one prepared bundle without the terminal `done`, then leave the
 * connection open for the caller to close: the receiver must fall back to its
 * all-entries-arrived check.
 * @param client - sending channel.
 * @param prepared - prepared bundle.
 */
async function sendPreparedEntries(client: ConnectionChannel, prepared: PreparedBundle): Promise<void> {
  client.write({ type: 'offer', binaryLength: 0, manifest: prepared.manifest })
  await client.next('accept', 5_000)
  for (const entry of prepared.manifest.entries) {
    const source = prepared.sources.get(`${entry.kind}\u0000${entry.path}`)
    if (source === undefined) throw new Error(`missing source for ${entry.path}`)
    const bytes = source instanceof Uint8Array ? source : await readFile(source.absolutePath)
    client.write({ type: 'entry', binaryLength: 0, kind: entry.kind, path: entry.path, size: entry.size, sha256: entry.sha256 })
    client.write({ type: 'chunk', binaryLength: bytes.byteLength, offset: 0, final: true }, bytes)
  }
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

it('spools session archives to disk instead of holding their bytes', async () => {
  const project = await projectFixture()
  const spoolDirectory = await mkdtemp(join(tmpdir(), 'dsh-handoff-spool-prepared-'))
  try {
    const prepared = await prepareBundle({
      projectPath: project.root,
      projectTitle: '项目 甲/测试',
      sessionArchives: [{
        sessionId: 'session-1',
        archiveName: 'dsh-session-session-1.zip',
        writeTo: async (absolutePath) => writeFixtureArchive(absolutePath, SESSION_ZIP),
      }],
      spoolDirectory,
    })
    const found = prepared.spoolDirectory
    if (found === undefined) throw new Error('the bundle reports its spool directory')
    const session = prepared.manifest.entries.find(entry => entry.kind === 'session')
    if (session === undefined) throw new Error('the bundle carries a session archive')
    // The source is a path, not bytes: the archive streams from the spool file.
    expect(prepared.sources.get(`session\u0000${session.path}`)).toEqual({
      absolutePath: join(found, session.path),
    })
    expect(await readFile(join(found, session.path))).toEqual(Buffer.from(SESSION_ZIP))
  } finally {
    await rm(project.root, { recursive: true, force: true })
    await rm(spoolDirectory, { recursive: true, force: true })
  }
})

it('refuses an archive name that is not a single path segment', async () => {
  for (const archiveName of ['../escape.zip', 'sub/dir.zip', 'sub\\dir.zip', '', '..']) {
    await expect(bundleFromFiles({
      projectTitle: '逃逸',
      files: [],
      sessionArchives: [{ sessionId: 's', archiveName, writeTo: async (absolutePath) => writeFixtureArchive(absolutePath, SESSION_ZIP) }],
    })).rejects.toBeInstanceOf(HandoffPreparationError)
  }
})

it('removes the spool directory it owns when an archive fails to write', async () => {
  let spooledPath = ''
  const failure = new Error('spool write failed')
  await expect(bundleFromFiles({
    projectTitle: '写失败',
    files: [],
    sessionArchives: [{
      sessionId: 's',
      archiveName: 'dsh-session-s.zip',
      writeTo: async (absolutePath) => {
        spooledPath = absolutePath
        throw failure
      },
    }],
  })).rejects.toBe(failure)
  const spoolDirectory = dirname(spooledPath)
  await expect(stat(spoolDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('spools into the directory it is given and reports it back', async () => {
  const spoolDirectory = await mkdtemp(join(tmpdir(), 'dsh-handoff-spool-test-'))
  try {
    const prepared = await bundleFromFiles({
      projectTitle: '指定目录',
      files: [],
      sessionArchives: [{
        sessionId: 's',
        archiveName: 'dsh-session-s.zip',
        writeTo: async (absolutePath) => writeFixtureArchive(absolutePath, SESSION_ZIP),
      }],
      spoolDirectory,
    })
    expect(prepared.spoolDirectory).toBe(spoolDirectory)
    expect(await readFile(join(spoolDirectory, 'dsh-session-s.zip'))).toEqual(Buffer.from(SESSION_ZIP))
    // A directory the caller owns survives a failed write: only the bundle's
    // own temporary directory is cleaned up behind the failure.
    await expect(bundleFromFiles({
      projectTitle: '指定目录写失败',
      files: [],
      sessionArchives: [{
        sessionId: 's2',
        archiveName: 'dsh-session-s2.zip',
        writeTo: async () => { throw new Error('spool write failed') },
      }],
      spoolDirectory,
    })).rejects.toThrow(/spool write failed/u)
    expect((await stat(spoolDirectory)).isDirectory()).toBe(true)
  } finally {
    await rm(spoolDirectory, { recursive: true, force: true })
  }
})

it('reads inline bytes from a start offset for a resumed entry', async () => {
  const prepared = await bundleFromFiles({
    projectTitle: '内联',
    files: [],
    sessionArchives: [],
    configDocuments: [{ name: 'model-config.json', bytes: encoder.encode('{"a":1}') }],
  })
  const entry = prepared.manifest.entries[0]
  if (entry === undefined) throw new Error('the bundle carries a config document')
  const chunks: Uint8Array[] = []
  for await (const chunk of preparedEntryReader(prepared)(entry, 5)) chunks.push(chunk)
  expect(Buffer.concat(chunks).toString('utf8')).toBe('1}')
})

it('records only the sending-device source roots it knows', async () => {
  const none = await bundleFromFiles({ projectTitle: '无根', files: [], sessionArchives: [], sourceRoots: {} })
  expect(none.manifest.sourceRoots).toEqual({})
  const homeOnly = await bundleFromFiles({
    projectTitle: '仅 home',
    files: [],
    sessionArchives: [],
    sourceRoots: { home: '/old/home' },
  })
  expect(homeOnly.manifest.sourceRoots).toEqual({ home: '/old/home' })
  const dataOnly = await bundleFromFiles({
    projectTitle: '仅 data',
    files: [],
    sessionArchives: [],
    sourceRoots: { data: '/old/data' },
  })
  expect(dataOnly.manifest.sourceRoots).toEqual({ data: '/old/data' })
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
    await expect(stat(join(destination, `.handoff-${prepared.manifest.bundleId}.data`))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(destination, `.handoff-${prepared.manifest.bundleId}.sessions`))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('imports and registers under the canonical parent when the receiving root is a symlink', async () => {
  const { project, prepared } = await preparedFixture()
  const root = await mkdtemp(join(tmpdir(), 'dsh-handoff-link-'))
  const realParent = join(root, 'real')
  const aliasParent = join(root, 'alias')
  await mkdir(realParent, { recursive: true })
  await symlink(realParent, aliasParent, process.platform === 'win32' ? 'junction' : 'dir')
  const loop = await loopback()
  try {
    const host = new RecordingHost()
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: aliasParent, host })
    await sendPreparedBundle(loop.client, prepared)
    const outcome = await receipt

    // Sessions and the workspace registration must agree on the real path; a
    // receipt filed through the alias splits them and the workspace shows no
    // conversations.
    const expected = join(await realpath(realParent), projectDirectoryName(prepared.manifest.projectTitle))
    expect(outcome.projectPath).toBe(expected)
    expect(host.imported[0]?.targetCwd).toBe(expected)
    expect(host.attached[0]?.projectPath).toBe(expected)
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
  }
})

it('applies received config documents and source-root remaps before importing', async () => {
  const project = await projectFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-config-'))
  const dataRoot = await mkdtemp(join(tmpdir(), 'dsh-handoff-data-'))
  const homeRoot = await mkdtemp(join(tmpdir(), 'dsh-handoff-home-'))
  const loop = await loopback()
  const configText = '{"version":1,"settings":{"llm-pi-ai":{"providers":{}}},"credentials":{}}'
  try {
    const prepared = await bundleFromFiles({
      projectTitle: '带回执配置',
      files: [{ absolutePath: join(project.root, '项目资料.md'), relativePath: '项目资料.md' }],
      sessionArchives: [{
        sessionId: 'session-1',
        archiveName: 'dsh-session-session-1.zip',
        writeTo: async (absolutePath) => writeFixtureArchive(absolutePath, SESSION_ZIP),
      }],
      configDocuments: [{ name: 'model-config.json', bytes: encoder.encode(configText) }],
      sourceCwd: project.root,
      sourceRoots: { data: 'C:\\old\\data', home: 'C:\\old\\home' },
    })
    const host = new RecordingHost()
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host,
      dataDirectory: dataRoot,
      homeDirectory: homeRoot,
    })
    await sendPreparedBundle(loop.client, prepared)
    const outcome = await receipt

    expect(host.configs).toEqual([{ name: 'model-config.json', text: configText }])
    // Longest source first: the project root wins over the sender's wider roots.
    expect(host.imported[0]?.remaps).toEqual([
      { from: project.root, to: outcome.projectPath },
      { from: 'C:\\old\\data', to: resolve(dataRoot) },
      { from: 'C:\\old\\home', to: resolve(homeRoot) },
    ])
    await expect(stat(join(destination, `.handoff-${prepared.manifest.bundleId}.config`)))
      .rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
    await rm(dataRoot, { recursive: true, force: true })
    await rm(homeRoot, { recursive: true, force: true })
  }
})

it('keeps the bundle id content-derived so a retried send can resume', async () => {
  const project = await projectFixture()
  try {
    const build = () => bundleFromFiles({
      projectTitle: '续传项目',
      files: [{ absolutePath: join(project.root, '项目资料.md'), relativePath: '项目资料.md' }],
      sessionArchives: [],
      sourceCwd: project.root,
    })
    expect((await build()).manifest.bundleId).toBe((await build()).manifest.bundleId)

    const otherTitle = await bundleFromFiles({
      projectTitle: '另一个标题',
      files: [{ absolutePath: join(project.root, '项目资料.md'), relativePath: '项目资料.md' }],
      sessionArchives: [],
      sourceCwd: project.root,
    })
    expect(otherTitle.manifest.bundleId).not.toBe((await build()).manifest.bundleId)

    await writeFile(join(project.root, 'extra.txt'), 'more', 'utf8')
    const otherContent = await bundleFromFiles({
      projectTitle: '续传项目',
      files: [
        { absolutePath: join(project.root, '项目资料.md'), relativePath: '项目资料.md' },
        { absolutePath: join(project.root, 'extra.txt'), relativePath: 'extra.txt' },
      ],
      sessionArchives: [],
      sourceCwd: project.root,
    })
    expect(otherContent.manifest.bundleId).not.toBe((await build()).manifest.bundleId)
  } finally {
    await rm(project.root, { recursive: true, force: true })
  }
})

it('streams disk-backed data entries from their source path instead of memory', async () => {
  const project = await projectFixture()
  try {
    const absolutePath = join(project.root, '项目资料.md')
    const prepared = await bundleFromFiles({
      projectTitle: '流式数据',
      files: [],
      sessionArchives: [],
      dataFiles: [
        { path: 'profiles/a/identity.md', absolutePath },
        { path: '.env', bytes: encoder.encode('K=v\n') },
      ],
    })
    const streamed = prepared.manifest.entries.find(entry => entry.path === 'profiles/a/identity.md')
    expect(streamed).toMatchObject({ kind: 'data', size: (await stat(absolutePath)).size })
    expect(streamed?.sha256).toBe(createHash('sha256').update(await readFile(absolutePath)).digest('hex'))
    expect(prepared.sources.get('data\u0000profiles/a/identity.md')).toEqual({ absolutePath })
    expect(prepared.sources.get('data\u0000.env')).toBeInstanceOf(Uint8Array)
  } finally {
    await rm(project.root, { recursive: true, force: true })
  }
})

it('resumes a retried send from the entries the receiver already staged', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-resume-'))
  const staged = prepared.manifest.entries.find(entry => entry.path === '素材/notes.txt')
  if (staged === undefined) throw new Error('fixture has no notes entry')
  const first = await loopback()
  try {
    // Attempt 1: stream one entry, then drop the link before the rest.
    const failing = receiveHandoff(first.server, { targetParentDirectory: destination, host: new RecordingHost() })
    first.client.write({ type: 'offer', binaryLength: 0, manifest: prepared.manifest })
    await first.client.next('accept', 5_000)
    const source = prepared.sources.get(`${staged.kind}\u0000${staged.path}`)
    if (source === undefined) throw new Error('missing source')
    const bytes = source instanceof Uint8Array ? source : await readFile(source.absolutePath)
    first.client.write({ type: 'entry', binaryLength: 0, kind: staged.kind, path: staged.path, size: staged.size, sha256: staged.sha256 })
    first.client.write({ type: 'chunk', binaryLength: bytes.byteLength, offset: 0, final: true }, bytes)
    await vi.waitFor(async () => {
      await expect(stat(join(destination, `.handoff-${prepared.manifest.bundleId}`, staged.path))).resolves.toBeDefined()
    })
    first.endClient()
    await expect(failing).rejects.toThrow()
  } finally {
    await first.close()
  }

  // Attempt 2: the same title and content rebuild the same bundle id, so the
  // receiver reports the staged entry and the sender skips it.
  const retried = await prepareBundle({
    projectPath: project.root,
    projectTitle: '项目 甲/测试',
    sessionArchives: [{
      sessionId: 'session-1',
      archiveName: 'dsh-session-session-1.zip',
      writeTo: async (absolutePath) => writeFixtureArchive(absolutePath, SESSION_ZIP),
    }],
  })
  expect(retried.manifest.bundleId).toBe(prepared.manifest.bundleId)
  const second = await loopback()
  try {
    const host = new RecordingHost()
    const receipt = receiveHandoff(second.server, { targetParentDirectory: destination, host })
    const sent = await sendPreparedBundle(second.client, retried)
    const outcome = await receipt
    expect(sent.skipped).toEqual([staged])
    expect(outcome.skipped).toEqual([staged])
    expect(await treeDigest(outcome.projectPath)).toEqual(await treeDigest(project.root))
    expect(outcome.sessionIds).toEqual(['session-1'])
    expect(host.imported).toHaveLength(1)
  } finally {
    await second.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('resumes a session archive from its staged bytes and digests the whole file', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-resume-zip-'))
  const archiveEntry = prepared.manifest.entries.find(entry => entry.kind === 'session')
  if (archiveEntry === undefined) throw new Error('fixture has no session archive')
  const loop = await loopback()
  try {
    // Half of the archive is already staged from an interrupted attempt.
    const stagedArchive = join(destination, `.handoff-${prepared.manifest.bundleId}.sessions`, archiveEntry.path)
    await mkdir(dirname(stagedArchive), { recursive: true })
    const whole = await readFile(join(project.root, '素材', '成品', 'final.bin'))
    void whole
    await writeFile(stagedArchive, SESSION_ZIP.slice(0, SESSION_ZIP.byteLength - 4))
    const host = new RecordingHost()
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: destination, host })
    const sent = await sendPreparedBundle(loop.client, prepared)
    const outcome = await receipt

    expect(sent.skipped).toEqual([])
    expect(sent.sent).toContainEqual(archiveEntry)
    expect(outcome.sessionIds).toEqual(['session-1'])
    expect(Buffer.from(host.imported[0]?.archives[0] ?? new Uint8Array())).toEqual(Buffer.from(SESSION_ZIP))
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('refuses a receipt whose resumed session archive no longer matches the manifest', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-resume-zip-bad-'))
  const archiveEntry = prepared.manifest.entries.find(entry => entry.kind === 'session')
  if (archiveEntry === undefined) throw new Error('fixture has no session archive')
  const loop = await loopback()
  try {
    const stagedArchive = join(destination, `.handoff-${prepared.manifest.bundleId}.sessions`, archiveEntry.path)
    await mkdir(dirname(stagedArchive), { recursive: true })
    // A corrupt prefix cannot reproduce the manifest digest once the tail
    // appends; the completion gate must refuse to import it.
    await writeFile(stagedArchive, encoder.encode('garbage!'))
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: new RecordingHost(),
    })
    void sendPreparedBundle(loop.client, prepared).catch(() => undefined)
    await expect(receipt).rejects.toMatchObject({ code: 'verification' })
    await expect(readdir(dirname(stagedArchive))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('discards a staged entry whose streamed bytes fail the digest', async () => {
  const project = await projectFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-discard-'))
  const loop = await loopback()
  try {
    // Same size, different bytes: only the receiving digest can catch this,
    // and the corrupt staged bytes must not seed the next resume.
    const target = join(project.root, '项目资料.md')
    await writeFile(target, 'XXXXXXXXXXXX', 'utf8')
    const prepared = await bundleFromFiles({
      projectTitle: '损坏续传',
      files: [{ absolutePath: target, relativePath: '项目资料.md' }],
      sessionArchives: [],
      sourceCwd: project.root,
    })
    await writeFile(target, 'YYYYYYYYYYYY', 'utf8')
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: new RecordingHost(),
    })
    await expect(sendPreparedBundle(loop.client, prepared)).rejects.toBeInstanceOf(TransferIntegrityError)
    await expect(receipt).rejects.toBeInstanceOf(TransferIntegrityError)
    const staged = join(destination, `.handoff-${prepared.manifest.bundleId}`, '项目资料.md')
    await expect(stat(staged)).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('restreams a zero-byte staged file instead of reporting it as partial', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-resume-zero-'))
  const notesEntry = prepared.manifest.entries.find(entry => entry.path === '素材/notes.txt')
  if (notesEntry === undefined) throw new Error('fixture has no notes entry')
  const loop = await loopback()
  try {
    // A zero-byte staged file matches no entry: it is neither complete nor a
    // partial (a partial must hold bytes), so the entry restreams from zero.
    const stagedEmpty = join(destination, `.handoff-${prepared.manifest.bundleId}`, notesEntry.path)
    await mkdir(dirname(stagedEmpty), { recursive: true })
    await writeFile(stagedEmpty, new Uint8Array())
    const host = new RecordingHost()
    const controller = new AbortController()
    const receipt = receiveHandoff(loop.server, { targetParentDirectory: destination, host, signal: controller.signal })
    const sent = await sendPreparedBundle(loop.client, prepared)
    const outcome = await receipt
    expect(sent.skipped).toEqual([])
    expect(outcome.projectPath).toBe(join(destination, projectDirectoryName('项目 甲/测试')))
    expect(host.attached).toHaveLength(1)
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('fails loudly when a directory squats on a staged entry path', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-squat-'))
  const loop = await loopback()
  try {
    // Progress reporting skips a non-file; the fresh write then cannot create
    // the file, so the receipt fails loudly instead of publishing a lie.
    await mkdir(join(destination, `.handoff-${prepared.manifest.bundleId}`, '项目资料.md'), { recursive: true })
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: new RecordingHost(),
    })
    void sendPreparedBundle(loop.client, prepared).catch(() => undefined)
    await expect(receipt).rejects.toBeDefined()
    await expect(stat(join(destination, projectDirectoryName('项目 甲/测试')))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('publishes nothing when the build cannot apply a received config document', async () => {
  const project = await projectFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-config-missing-'))
  const loop = await loopback()
  try {
    const prepared = await bundleFromFiles({
      projectTitle: '无配置接收端',
      files: [{ absolutePath: join(project.root, '项目资料.md'), relativePath: '项目资料.md' }],
      sessionArchives: [],
      configDocuments: [{ name: 'model-config.json', bytes: encoder.encode('{"version":1,"settings":{},"credentials":{}}') }],
      sourceCwd: project.root,
    })
    // A host that predates the config seam: the project must not publish.
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: {
        importSessionArchives: async () => [],
        attachProject: async () => undefined,
      },
    })
    void sendPreparedBundle(loop.client, prepared).catch(() => undefined)
    const failure = await receipt.then(
      () => { throw new Error('expected the config application to fail') },
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(HandoffReceiveError)
    expect((failure as HandoffReceiveError).code).toBe('config')
    await expect(stat(join(destination, projectDirectoryName('无配置接收端')))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(destination, `.handoff-${prepared.manifest.bundleId}`))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('reports a refused config document and publishes nothing', async () => {
  const project = await projectFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-config-refused-'))
  const loop = await loopback()
  try {
    const prepared = await bundleFromFiles({
      projectTitle: '配置被拒',
      files: [{ absolutePath: join(project.root, '项目资料.md'), relativePath: '项目资料.md' }],
      sessionArchives: [],
      configDocuments: [{ name: 'model-config.json', bytes: encoder.encode('{"version":1,"settings":{},"credentials":{}}') }],
      sourceCwd: project.root,
    })
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: new RecordingHost(false, [], true),
    })
    void sendPreparedBundle(loop.client, prepared).catch(() => undefined)
    const failure = await receipt.then(
      () => { throw new Error('expected the config application to fail') },
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(HandoffReceiveError)
    expect((failure as HandoffReceiveError).code).toBe('config')
    expect((failure as Error).message).toContain('settings refused the document')
    await expect(stat(join(destination, projectDirectoryName('配置被拒')))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('refuses config documents on a quick push', async () => {
  await expect(bundleFromFiles({
    projectTitle: '快推',
    files: [],
    sessionArchives: [],
    configDocuments: [{ name: 'model-config.json', bytes: encoder.encode('{}') }],
    mergeIntoExisting: true,
  })).rejects.toBeInstanceOf(HandoffPreparationError)
})

it('reports receiving, verifying, and importing phases with byte and entry progress', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-progress-'))
  const loop = await loopback()
  const updates: HandoffReceiveProgress[] = []
  try {
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: new RecordingHost(),
      onProgress: progress => updates.push(progress),
    })
    await sendPreparedBundle(loop.client, prepared)
    await receipt

    const first = updates[0]
    expect(first).toMatchObject({
      phase: 'receiving',
      projectTitle: prepared.manifest.projectTitle,
      entriesDone: 0,
      bytesDone: 0,
    })
    expect(first?.entriesTotal).toBe(prepared.manifest.entries.length)
    expect(first?.bytesTotal).toBe(prepared.manifest.treeSummary.totalBytes)
    expect(updates.map(update => update.phase)).toContain('verifying')
    expect(updates.at(-1)?.phase).toBe('importing')
    const receiving = updates.filter(update => update.phase === 'receiving')
    expect(receiving.at(-1)?.entriesDone).toBe(prepared.manifest.entries.length)
    expect(receiving.at(-1)?.bytesDone).toBe(prepared.manifest.treeSummary.totalBytes)
    expect(updates.every(update => update.entriesTotal === prepared.manifest.entries.length)).toBe(true)
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('finalizes a receipt whose sender closes after the last entry', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-lost-done-'))
  const loop = await loopback()
  try {
    const host = new RecordingHost()
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host,
    })
    await sendPreparedEntries(loop.client, prepared)
    loop.endClient()
    const outcome = await receipt
    expect(outcome.projectPath).toBe(join(destination, projectDirectoryName('项目 甲/测试')))
    expect(await treeDigest(outcome.projectPath)).toEqual(await treeDigest(project.root))
    expect(outcome.sessionIds).toEqual(['session-1'])
    expect(host.imported).toHaveLength(1)
    expect(host.attached).toHaveLength(1)
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('cleans staging when the sender closes after the last entry and verification fails', async () => {
  const { project, prepared } = await preparedFixture()
  const destination = await mkdtemp(join(tmpdir(), 'dsh-handoff-lost-done-bad-'))
  const loop = await loopback()
  try {
    const staging = join(destination, `.handoff-${prepared.manifest.bundleId}`)
    await mkdir(staging, { recursive: true })
    await writeFile(join(staging, 'intruder.txt'), 'not in the manifest', 'utf8')
    const receipt = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: new RecordingHost(),
    })
    await sendPreparedEntries(loop.client, prepared)
    loop.endClient()
    await expect(receipt).rejects.toMatchObject({ code: 'verification' })
    await expect(stat(staging)).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await loop.close()
    await rm(project.root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('removes stale receipt staging groups and keeps fresh and unrelated directories', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dsh-handoff-stale-'))
  const now = Date.now()
  const staleBase = join(parent, `.handoff-${'a'.repeat(32)}`)
  const freshBase = join(parent, `.handoff-${'b'.repeat(32)}`)
  const orphanBase = join(parent, `.handoff-${'c'.repeat(32)}`)
  const unrelated = join(parent, 'regular-project')
  try {
    for (const base of [staleBase, freshBase]) {
      await mkdir(join(base, 'sub'), { recursive: true })
      await writeFile(join(base, 'sub', 'file.txt'), 'x', 'utf8')
      await mkdir(`${base}.data`, { recursive: true })
      await mkdir(`${base}.sessions`, { recursive: true })
    }
    await mkdir(unrelated, { recursive: true })
    // A data-less receipt can leave only the `.data` sibling behind.
    await mkdir(`${orphanBase}.data`, { recursive: true })
    const old = new Date(now - 3_600_000)
    for (const path of [
      staleBase,
      join(staleBase, 'sub'),
      join(staleBase, 'sub', 'file.txt'),
      `${staleBase}.data`,
      `${staleBase}.sessions`,
      `${orphanBase}.data`,
    ]) {
      await utimes(path, old, old)
    }

    const removed = await cleanupStaleReceipts(parent, 60_000, now)
    expect(new Set(removed)).toEqual(new Set([staleBase, orphanBase]))
    await expect(stat(`${orphanBase}.data`)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(staleBase)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(`${staleBase}.data`)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(`${staleBase}.sessions`)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await stat(freshBase)).isDirectory()).toBe(true)
    expect((await stat(unrelated)).isDirectory()).toBe(true)

    // A zero threshold removes every staging group, still leaving unrelated names.
    expect(await cleanupStaleReceipts(parent, 0, now)).toEqual([freshBase])
    await expect(stat(freshBase)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await stat(unrelated)).isDirectory()).toBe(true)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

it('reports no stale staging groups when the handoff directory does not exist', async () => {
  await expect(cleanupStaleReceipts(join(tmpdir(), `dsh-handoff-missing-${String(Date.now())}`), 0))
    .resolves.toEqual([])
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
