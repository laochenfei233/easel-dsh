/**
 * Payload selection (spec easel-handoff-payload): `data` entries and
 * `mergeIntoExisting` on the wire, device-data placement with `.env` merging,
 * quick-push merge receipts, and the service-level payload options.
 */

import { Context } from '@deepseek-ai/cordis'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { afterEach, expect, it, vi } from 'vitest'
import {
  bundleFromFiles,
  computeTreeSummary,
  LanHandoffService,
  mergeEnvText,
  receiveHandoff,
  sendPreparedBundle,
  TRANSFER_PROTOCOL_VERSION,
  TransferProtocolError,
  validateBundleManifest,
  type BundleEntryRef,
  type HandoffImportHost,
  type HandoffImporter,
  type HandoffWorkspaces,
  type LanAdvertisement,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
} from '../src/index.ts'
import type { DeviceId } from '../src/identity.ts'
import { loadDeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import { attachChannel, type ConnectionChannel } from '../src/pairing.ts'

const encoder = new TextEncoder()

// ---- wire validation ----

/** One valid manifest shell with the given entries and extras. */
function manifestOf(entries: readonly BundleEntryRef[], extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    bundleId: 'b'.repeat(32),
    projectTitle: '项目',
    sourceCwd: '/tmp/source',
    entries,
    treeSummary: computeTreeSummary(entries),
    ...extras,
  }
}

const fileEntry: BundleEntryRef = { kind: 'file', path: 'a.txt', size: 1, sha256: 'a'.repeat(64) }
const dataEntry: BundleEntryRef = { kind: 'data', path: 'profiles/p/identity.md', size: 1, sha256: 'b'.repeat(64) }
const sessionEntry: BundleEntryRef = { kind: 'session', path: 'dsh-session-s1.zip', size: 1, sha256: 'c'.repeat(64) }

it('accepts data entries with nested paths and refuses traversal in them', () => {
  expect(() => validateBundleManifest(manifestOf([dataEntry]))).not.toThrow()
  expect(() => validateBundleManifest(manifestOf([{ ...dataEntry, path: '../escape' }]))).toThrow(TransferProtocolError)
  expect(() => validateBundleManifest(manifestOf([{ ...dataEntry, path: '/etc/passwd' }]))).toThrow(TransferProtocolError)
})

it('validates the mergeIntoExisting marker', () => {
  expect(validateBundleManifest(manifestOf([fileEntry], { mergeIntoExisting: true })).mergeIntoExisting).toBe(true)
  expect(validateBundleManifest(manifestOf([fileEntry]))).not.toHaveProperty('mergeIntoExisting')
  expect(() => validateBundleManifest(manifestOf([fileEntry], { mergeIntoExisting: 'yes' }))).toThrow(TransferProtocolError)
  expect(() => validateBundleManifest(manifestOf([sessionEntry], { mergeIntoExisting: true }))).toThrow(TransferProtocolError)
})

it('merges .env lines in place and preserves unknown content', () => {
  const existing = '# comment\nIMG_API_KEY=old\nLOCAL_ONLY=keep\n\nVIDEO_PROVIDER=dashscope\n'
  expect(mergeEnvText(existing, 'IMG_API_KEY=new\nMINIMAX_API_KEY=added\nEMPTY=\nnot a line\n'))
    .toBe('# comment\nIMG_API_KEY=new\nLOCAL_ONLY=keep\n\nVIDEO_PROVIDER=dashscope\n\nMINIMAX_API_KEY=added\n')
  expect(mergeEnvText(null, 'A=1')).toBe('A=1\n')
  expect(mergeEnvText('A=1\r\nB=2', 'A=9\r\n')).toBe('A=9\nB=2\n')
  expect(mergeEnvText('A=1', 'B=')).toBe('A=1\n')
})

// ---- receipt level ----

interface Loop {
  readonly client: ConnectionChannel
  readonly server: ConnectionChannel
  readonly close: () => Promise<void>
}

/** Boot one loopback TLS pair with channels on both ends. */
async function loopback(): Promise<Loop> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-payload-loop-'))
  const identity = await loadDeviceIdentity(root)
  const accepted = Promise.withResolvers<ConnectionChannel>()
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    accepted.resolve(attachChannel(socket))
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  return {
    client: attachChannel(socket),
    server: await accepted.promise,
    close: async () => {
      socket.destroy()
      await listener.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

class RecordingHost implements HandoffImportHost {
  readonly created: { projectPath: string; title: string }[] = []

  async importSessionArchives(): Promise<readonly string[]> {
    return []
  }

  async attachProject(projectPath: string, title: string): Promise<void> {
    this.created.push({ projectPath, title })
  }
}

interface Fixture {
  readonly base: string
  readonly parent: string
  readonly dataRoot: string
}

/** One base directory holding an inbox (parent) and a data root. */
async function fixture(): Promise<Fixture> {
  const base = await mkdtemp(join(tmpdir(), 'dsh-payload-fx-'))
  const parent = join(base, 'inbox')
  const dataRoot = join(base, 'data')
  await mkdir(parent, { recursive: true })
  await mkdir(dataRoot, { recursive: true })
  cleanup.push(() => rm(base, { recursive: true, force: true }))
  return { base, parent, dataRoot }
}

const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

/** Prepare one session-less bundle from files and optional data files. */
async function prepare(options: {
  readonly title: string
  readonly files: readonly { readonly name: string; readonly content: string }[]
  readonly dataFiles?: readonly { readonly path: string; readonly content: string }[]
  readonly merge?: boolean
}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-payload-src-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  for (const file of options.files) {
    await mkdir(join(root, file.name, '..'), { recursive: true })
    await writeFile(join(root, file.name), file.content, 'utf8')
  }
  return bundleFromFiles({
    projectTitle: options.title,
    files: options.files.map(file => ({ absolutePath: join(root, file.name), relativePath: file.name })),
    sessionArchives: [],
    ...options.dataFiles === undefined ? {} : {
      dataFiles: options.dataFiles.map(file => ({ path: file.path, bytes: encoder.encode(file.content) })),
    },
    ...options.merge === true ? { mergeIntoExisting: true } : {},
  })
}

it('places data entries under the data root and merges .env with existing lines', async () => {
  const { parent, dataRoot } = await fixture()
  await writeFile(join(dataRoot, '.env'), 'IMG_API_KEY=old\nLOCAL_ONLY=keep\n', 'utf8')
  const prepared = await prepare({
    title: '数据包',
    files: [{ name: 'a.txt', content: 'A' }],
    dataFiles: [
      { path: '.env', content: 'IMG_API_KEY=new\nDASHSCOPE_API_KEY=added\n' },
      { path: 'profiles/p/identity.md', content: '# 人设' },
    ],
  })
  const loop = await loopback()
  cleanup.push(loop.close)
  const receipt = await Promise.all([
    receiveHandoff(loop.server, { targetParentDirectory: parent, host: new RecordingHost(), dataDirectory: dataRoot }),
    sendPreparedBundle(loop.client, prepared),
  ])
  expect(receipt[0].projectPath).toBe(join(parent, '数据包'))
  expect(await readFile(join(parent, '数据包', 'a.txt'), 'utf8')).toBe('A')
  expect(await readFile(join(dataRoot, '.env'), 'utf8'))
    .toBe('IMG_API_KEY=new\nLOCAL_ONLY=keep\n\nDASHSCOPE_API_KEY=added\n')
  expect(await readFile(join(dataRoot, 'profiles', 'p', 'identity.md'), 'utf8')).toBe('# 人设')
  expect(await readdir(parent)).toEqual(['数据包'])
})

it('refuses a data bundle when no data directory is configured', async () => {
  const { parent } = await fixture()
  const prepared = await prepare({
    title: '无根',
    files: [{ name: 'a.txt', content: 'A' }],
    dataFiles: [{ path: '.env', content: 'A=1' }],
  })
  const loop = await loopback()
  cleanup.push(loop.close)
  await expect(Promise.all([
    receiveHandoff(loop.server, { targetParentDirectory: parent, host: new RecordingHost() }),
    sendPreparedBundle(loop.client, prepared),
  ])).rejects.toMatchObject({ name: 'TransferRejectedError', reason: 'dataDirectoryNotConfigured' })
})

it('merges a quick push into an existing directory and registers nothing', async () => {
  const { parent, dataRoot } = await fixture()
  await mkdir(join(parent, '项目', '素材'), { recursive: true })
  await writeFile(join(parent, '项目', '素材', 'old.txt'), 'old', 'utf8')
  const prepared = await prepare({
    title: '项目',
    files: [{ name: '素材/new.txt', content: 'fresh' }],
    dataFiles: [{ path: 'skills/s.md', content: '# s' }],
    merge: true,
  })
  const loop = await loopback()
  cleanup.push(loop.close)
  const host = new RecordingHost()
  await Promise.all([
    receiveHandoff(loop.server, { targetParentDirectory: parent, host, dataDirectory: dataRoot }),
    sendPreparedBundle(loop.client, prepared),
  ])
  expect(await readFile(join(dataRoot, 'skills', 's.md'), 'utf8')).toBe('# s')
  expect(await readFile(join(parent, '项目', '素材', 'old.txt'), 'utf8')).toBe('old')
  expect(await readFile(join(parent, '项目', '素材', 'new.txt'), 'utf8')).toBe('fresh')
  expect(host.created).toEqual([{ projectPath: join(parent, '项目'), title: '项目' }])
  expect(await readdir(parent)).toEqual(['项目'])
})

it('creates the destination directory when a merge push arrives first', async () => {
  const { parent } = await fixture()
  const prepared = await prepare({
    title: '初到',
    files: [{ name: 'a.txt', content: 'A' }],
    merge: true,
  })
  const loop = await loopback()
  cleanup.push(loop.close)
  const host = new RecordingHost()
  await Promise.all([
    receiveHandoff(loop.server, { targetParentDirectory: parent, host }),
    sendPreparedBundle(loop.client, prepared),
  ])
  expect(await readFile(join(parent, '初到', 'a.txt'), 'utf8')).toBe('A')
  expect(host.created).toEqual([{ projectPath: join(parent, '初到'), title: '初到' }])
})

it('refuses a merge bundle that ended before every manifest entry arrived', async () => {
  const { parent } = await fixture()
  const prepared = await prepare({ title: '缺件', files: [{ name: 'a.txt', content: 'A' }], merge: true })
  const loop = await loopback()
  cleanup.push(loop.close)
  const failure = Promise.withResolvers<unknown>()
  void receiveHandoff(loop.server, { targetParentDirectory: parent, host: new RecordingHost() })
    .catch((error: unknown) => { failure.resolve(error) })
  // Hand-rolled short send: offer → accept → done, no entries.
  loop.client.write({ type: 'offer', binaryLength: 0, manifest: prepared.manifest })
  await loop.client.next(['accept', 'reject'], 5_000)
  loop.client.write({ type: 'done', binaryLength: 0 })
  await expect(failure.promise).resolves.toMatchObject({ name: 'HandoffReceiveError', code: 'verification' })
  expect(await readdir(parent)).toEqual([])
})

it('reports a data-placement failure and keeps the received project', async () => {
  const { parent, dataRoot } = await fixture()
  // A data root whose `.env` is a directory makes the merge write fail.
  await mkdir(join(dataRoot, '.env'), { recursive: true })
  const prepared = await prepare({
    title: '翻车',
    files: [{ name: 'a.txt', content: 'A' }],
    dataFiles: [{ path: '.env', content: 'A=1' }],
  })
  const loop = await loopback()
  cleanup.push(loop.close)
  await expect(Promise.all([
    receiveHandoff(loop.server, { targetParentDirectory: parent, host: new RecordingHost(), dataDirectory: dataRoot }),
    sendPreparedBundle(loop.client, prepared),
  ])).rejects.toMatchObject({ name: 'HandoffReceiveError', code: 'data' })
  // The verified project files stay in place: re-transferring would not fix the data root.
  expect(await readFile(join(parent, '翻车', 'a.txt'), 'utf8')).toBe('A')
  expect(await readdir(dataRoot)).toEqual(['.env'])
})

// ---- service level ----

/** Discovery host that lets the test inject peers. */
class RecordingDiscoveryHost implements LanDiscoveryHost {
  readonly published: LanAdvertisement[] = []
  private onUp: ((entry: LanDiscoveryEntry) => void) | undefined

  publish(advertisement: LanAdvertisement): { readonly stop: () => void } {
    this.published.push(advertisement)
    return { stop: () => undefined }
  }

  find(_type: string, onUp: (entry: LanDiscoveryEntry) => void): void {
    this.onUp = onUp
  }

  emit(entry: LanDiscoveryEntry): void {
    this.onUp?.(entry)
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}

interface DeviceOptions {
  readonly handoffDirectory: string
  readonly dataDirectory?: string
  /** Workspace the send seam resolves; absent means nothing resolves. */
  readonly workspace?: { readonly path: string; readonly title: string }
  readonly createCalls?: string[]
  readonly importer?: HandoffImporter
}

/** Boot one loopback service with stubbed session services. */
async function device(options: DeviceOptions): Promise<{
  service: LanHandoffService
  deviceId: DeviceId
  port: number
  discovery: RecordingDiscoveryHost
}> {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'dsh-payload-svc-'))
  ctx.provide('sessionPersistence', {} as Context['sessionPersistence'])
  ctx.provide('sessionQuery', {} as Context['sessionQuery'])
  ctx.provide('attachments', {} as Context['attachments'])
  const workspaces: HandoffWorkspaces = {
    resolveByPath: async (path: string) => options.workspace !== undefined && options.workspace.path === path
      ? { path: options.workspace.path, title: options.workspace.title, sessionIds: [] }
      : undefined,
    create: async (path: string) => {
      options.createCalls?.push(path)
      return { attachSession: async () => undefined }
    },
  }
  const discovery = new RecordingDiscoveryHost()
  const service = new LanHandoffService(ctx, {
    name: 'loopback',
    handoffDirectory: options.handoffDirectory,
    ...(options.dataDirectory === undefined ? {} : { dataDirectory: options.dataDirectory }),
  }, {
    identityRoot: root,
    discovery,
    allowLoopbackPeers: true,
    workspaces,
    ...options.importer === undefined ? {} : { importer: options.importer },
  })
  const state = await service.ready
  cleanup.push(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  return { service, deviceId: state.deviceId, port: state.port, discovery }
}

/** Pair alpha with beta through the pending-offer API. */
async function pair(alpha: { service: LanHandoffService }, beta: { service: LanHandoffService }): Promise<void> {
  const dialed = await alpha.service.pairWithPeer({ host: '127.0.0.1', port: (await beta.service.ready).port })
  await vi.waitFor(() => { expect(beta.service.pairingOffers()).toHaveLength(1) })
  const pending = beta.service.pairingOffers()[0]
  if (pending === undefined) throw new Error('no pending pairing')
  await Promise.all([dialed.accept(), beta.service.acceptPairing(pending.id)])
}

/** Point alpha's discovery at beta. */
function discover(alpha: { discovery: RecordingDiscoveryHost }, beta: { deviceId: DeviceId; port: number }): void {
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '1', vmin: '1' },
  })
}

it('quick-pushes a file between services and merges into the existing project', async () => {
  const { base } = await fixture()
  const betaInbox = join(base, 'beta-inbox')
  const createCalls: string[] = []
  const alpha = await device({ handoffDirectory: join(base, 'alpha-inbox') })
  const beta = await device({
    handoffDirectory: betaInbox,
    dataDirectory: join(base, 'beta-data'),
    createCalls,
    importer: { importArchive: async () => ({ root: { id: 's1' }, descendants: [] }) },
  })
  await pair(alpha, beta)
  discover(alpha, beta)
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot()).toHaveLength(1) })

  // The receiving device already holds the project from an earlier handoff.
  await mkdir(join(betaInbox, '减脂餐', '素材'), { recursive: true })
  await writeFile(join(betaInbox, '减脂餐', '素材', 'old.txt'), 'old', 'utf8')

  const source = join(base, 'src')
  await mkdir(source, { recursive: true })
  await writeFile(join(source, 'bgm.mp3'), 'audio-bytes', 'utf8')

  await alpha.service.sendFilesToPeer(beta.deviceId, {
    projectTitle: '减脂餐',
    files: [{ absolutePath: join(source, 'bgm.mp3'), relativePath: '素材/bgm.mp3' }],
  })
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(true) })
  expect(await readFile(join(betaInbox, '减脂餐', '素材', 'bgm.mp3'), 'utf8')).toBe('audio-bytes')
  expect(await readFile(join(betaInbox, '减脂餐', '素材', 'old.txt'), 'utf8')).toBe('old')
  // Session-less receipts register no workspace on the receiving device.
  expect(createCalls).toEqual([])
})

it('sends a project with payload options: sessions off, materials excluded, config data files placed', async () => {
  const { base } = await fixture()
  const projectRoot = join(base, 'project')
  await mkdir(join(projectRoot, '素材'), { recursive: true })
  await writeFile(join(projectRoot, '选题.md'), '# 选题', 'utf8')
  await writeFile(join(projectRoot, '素材', 'big.mp4'), 'video', 'utf8')

  const betaInbox = join(base, 'beta-inbox')
  const betaData = join(base, 'beta-data')
  await mkdir(betaData, { recursive: true })
  await writeFile(join(betaData, '.env'), 'IMG_API_KEY=old\nLOCAL=keep\n', 'utf8')
  const createCalls: string[] = []
  const alpha = await device({
    handoffDirectory: join(base, 'alpha-inbox'),
    workspace: { path: projectRoot, title: '减脂餐' },
  })
  const beta = await device({
    handoffDirectory: betaInbox,
    dataDirectory: betaData,
    createCalls,
    importer: { importArchive: async () => ({ root: { id: 's1' }, descendants: [] }) },
  })
  await pair(alpha, beta)
  discover(alpha, beta)
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot()).toHaveLength(1) })

  await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot, {
    sessions: false,
    exclude: ['.env', '素材'],
    dataFiles: [{ path: '.env', bytes: encoder.encode('IMG_API_KEY=new\n') }],
  })
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(true) })
  expect(await readFile(join(betaInbox, '减脂餐', '选题.md'), 'utf8')).toBe('# 选题')
  await expect(stat(join(betaInbox, '减脂餐', '素材'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(join(betaData, '.env'), 'utf8')).toBe('IMG_API_KEY=new\nLOCAL=keep\n')
  // Sessions were not carried, so the receiving device registers no workspace.
  expect(createCalls).toEqual([])
})


it('refuses a merge bundle that would carry session archives', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-payload-merge-sessions-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'a.txt'), 'A', 'utf8')
  await expect(bundleFromFiles({
    projectTitle: 'x',
    files: [{ absolutePath: join(root, 'a.txt'), relativePath: 'a.txt' }],
    sessionArchives: [{ sessionId: 's', archiveName: 's.zip', open: async () => encoder.encode('PK') }],
    mergeIntoExisting: true,
  })).rejects.toMatchObject({ name: 'HandoffPreparationError' })
})

it('reads data files from disk and refuses a data source with neither bytes nor a path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-payload-data-src-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'skill.md'), '# skill', 'utf8')
  const fromDisk = await bundleFromFiles({
    projectTitle: 'x',
    files: [],
    sessionArchives: [],
    dataFiles: [{ path: 'skills/skill.md', absolutePath: join(root, 'skill.md') }],
  })
  expect(fromDisk.manifest.entries).toHaveLength(1)
  expect(fromDisk.manifest.entries[0]?.kind).toBe('data')
  await expect(bundleFromFiles({
    projectTitle: 'x',
    files: [],
    sessionArchives: [],
    dataFiles: [{ path: 'orphan' }],
  })).rejects.toMatchObject({ name: 'HandoffPreparationError' })
})

it('falls back to the project title as the source cwd when nothing else is known', async () => {
  const prepared = await bundleFromFiles({ projectTitle: '空包', files: [], sessionArchives: [] })
  expect(prepared.manifest.sourceCwd).toBe('空包')
  expect(prepared.manifest.entries).toEqual([])
})

it('merges a quick push that also carries data files, and appends after a file without a trailing newline', async () => {
  const { parent, dataRoot } = await fixture()
  const prepared = await prepare({
    title: '混合',
    files: [{ name: 'a.txt', content: 'A' }],
    dataFiles: [{ path: 'skills/s.md', content: '# s' }],
    merge: true,
  })
  const loop = await loopback()
  cleanup.push(loop.close)
  const host = new RecordingHost()
  await Promise.all([
    receiveHandoff(loop.server, { targetParentDirectory: parent, host, dataDirectory: dataRoot }),
    sendPreparedBundle(loop.client, prepared),
  ])
  expect(await readFile(join(parent, '混合', 'a.txt'), 'utf8')).toBe('A')
  expect(await readFile(join(dataRoot, 'skills', 's.md'), 'utf8')).toBe('# s')
  expect(host.created).toEqual([{ projectPath: join(parent, '混合'), title: '混合' }])
  expect(mergeEnvText('A=1', 'B=2')).toBe('A=1\n\nB=2\n')
})

it('refuses a merge push whose title is already a file on the receiving device', async () => {
  const { parent } = await fixture()
  await writeFile(join(parent, '撞名'), 'a file, not a directory', 'utf8')
  const prepared = await prepare({ title: '撞名', files: [{ name: 'a.txt', content: 'A' }], merge: true })
  const loop = await loopback()
  cleanup.push(loop.close)
  await expect(Promise.all([
    receiveHandoff(loop.server, { targetParentDirectory: parent, host: new RecordingHost() }),
    sendPreparedBundle(loop.client, prepared),
  ])).rejects.toMatchObject({ name: 'TransferRejectedError', reason: `destinationExists:${join(parent, '撞名')}` })
  expect(await readFile(join(parent, '撞名'), 'utf8')).toBe('a file, not a directory')
})
