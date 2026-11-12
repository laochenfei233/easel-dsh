/**
 * Product-level handoff over two loopback services: pairing through the
 * pending API, discovery-driven sync dialing, and a zero-session bundle
 * received into the configured handoff directory with workspace attachment.
 */

import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { bundleFromFiles } from '../src/handoff.ts'
import { computeTreeSummary } from '../src/transfer.ts'
import { ChannelClosedError } from '../src/pairing.ts'
import {
  LanHandoffService,
  type HandoffImporter,
  type HandoffSessionExport,
  type HandoffWorkspaces,
  type LanAdvertisement,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
} from '../src/index.ts'

/** Discovery host that records publications and lets the test inject peers. */
class RecordingDiscoveryHost implements LanDiscoveryHost {
  readonly published: LanAdvertisement[] = []
  stopped = 0
  disposed = false
  private onUp: ((entry: LanDiscoveryEntry) => void) | undefined

  publish(advertisement: LanAdvertisement): { readonly stop: () => void } {
    this.published.push(advertisement)
    return { stop: () => { this.stopped += 1 } }
  }

  find(_type: string, onUp: (entry: LanDiscoveryEntry) => void): void {
    this.onUp = onUp
  }

  emit(entry: LanDiscoveryEntry): void {
    this.onUp?.(entry)
  }

  async dispose(): Promise<void> {
    this.disposed = true
  }
}

interface FakeSeams {
  readonly workspaces: HandoffWorkspaces
  readonly created: { readonly path: string; readonly title: string }[]
  readonly attached: string[]
}

/** Importer seam reporting one imported session regardless of archive count. */
/** Write fixture archive bytes to the spool file the service hands over. */
async function writeFixtureArchive(absolutePath: string, bytes: Uint8Array): Promise<{ readonly size: number; readonly sha256: string }> {
  await writeFile(absolutePath, bytes)
  return { size: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }
}

const fakeImporter: HandoffImporter = {
  importArchive: async () => ({ root: { id: 'session-x' }, descendants: [] }),
}

/** Minimal workspaces/importer/persistence seams for a handoff. */
function fakeServices(resolveWorkspaceTo?: {
  readonly path: string
  readonly title: string
  readonly sessionIds?: readonly SessionId[]
}): FakeSeams {
  const created: { path: string; title: string }[] = []
  const attached: string[] = []
  const workspaces: HandoffWorkspaces = {
    resolveByPath: async () => resolveWorkspaceTo === undefined
      ? undefined
      : {
          path: resolveWorkspaceTo.path,
          title: resolveWorkspaceTo.title,
          sessionIds: resolveWorkspaceTo.sessionIds ?? [],
        },
    create: async (path, title) => {
      created.push({ path, title: title ?? '' })
      return { attachSession: async (id) => { attached.push(String(id)) } }
    },
  }
  return { workspaces, created, attached }
}

interface Device {
  readonly ctx: Context
  readonly service: LanHandoffService
  readonly discovery: RecordingDiscoveryHost
  readonly root: string
  readonly destination: string
  readonly port: number
  readonly deviceId: string
}

const disposers: (() => Promise<void>)[] = []

/** Boot one loopback device with a temp identity root, destination, and fake seams. */
async function device(options: {
  readonly withSeams: boolean
  readonly resolveWorkspaceTo?: {
    readonly path: string
    readonly title: string
    readonly sessionIds?: readonly SessionId[]
  }
  readonly importer?: HandoffImporter
  readonly sessionExport?: HandoffSessionExport
  readonly homeDirectory?: string
  readonly parallelConnections?: number
  readonly dataDirectory?: string
  readonly identityRoot?: string
}): Promise<Device> {
  const ctx = new Context()
  const root = options.identityRoot ?? await mkdtemp(join(tmpdir(), 'dsh-prod-'))
  const destination = await mkdtemp(join(tmpdir(), 'dsh-prod-inbox-'))
  let seamOptions = {}
  if (options.withSeams) {
    const seams = fakeServices(options.resolveWorkspaceTo)
    ctx.provide('sessionPersistence', {} as Context['sessionPersistence'])
    ctx.provide('sessionQuery', {} as Context['sessionQuery'])
    ctx.provide('attachments', {} as Context['attachments'])
    seamOptions = {
      workspaces: seams.workspaces,
      importer: options.importer ?? fakeImporter,
      ...options.sessionExport === undefined ? {} : { sessionExport: options.sessionExport },
    }
  }
  const discovery = new RecordingDiscoveryHost()
  const service = new LanHandoffService(ctx, {
    name: 'loopback',
    handoffDirectory: destination,
    ...options.parallelConnections === undefined ? {} : { parallelConnections: options.parallelConnections },
    ...options.dataDirectory === undefined ? {} : { dataDirectory: options.dataDirectory },
  }, {
    identityRoot: root,
    discovery,
    allowLoopbackPeers: true,
    ...options.homeDirectory === undefined ? {} : { homeDirectory: options.homeDirectory },
    ...seamOptions,
  })
  const state = await service.ready
  disposers.push(async () => {
    await ctx.fiber.dispose()
    if (options.identityRoot === undefined) await rm(root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  })
  return { ctx, service, discovery, root, destination, port: state.port, deviceId: String(state.deviceId) }
}

/** Pair two devices through the pending-offer API. */
async function pair(alpha: Device, beta: Device): Promise<void> {
  const dialed = await alpha.service.pairWithPeer({ host: '127.0.0.1', port: beta.port })
  await vi.waitFor(() => { expect(beta.service.pairingOffers()).toHaveLength(1) })
  const pending = beta.service.pairingOffers()[0]
  if (pending === undefined) throw new Error('no pending pairing')
  await Promise.all([dialed.accept(), beta.service.acceptPairing(pending.id)])
}

it('sends a workspace to a paired discovery peer and registers it on receipt', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-src-'))
  await mkdir(join(projectRoot, '素材'), { recursive: true })
  await writeFile(join(projectRoot, '素材', 'notes.txt'), 'handoff notes', 'utf8')
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '项目甲' },
    parallelConnections: 1,
  })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)

  // Discovery tells alpha where beta listens.
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })

  const sent = await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
  expect(sent.skipped).toEqual([])
  expect(sent.sent.map(entry => entry.path)).toEqual(['素材/notes.txt'])

  // The sender resolves only after the receiver confirms completion; poll the
  // receiver's outcome because its ack can land just after the send resolves.
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(true) }, { timeout: 5_000 })
  expect(beta.service.lastHandoffOutcome()?.detail).toContain('项目甲')
  const receivedFile = join(beta.destination, '项目甲', '素材', 'notes.txt')
  expect(await readFile(receivedFile, 'utf8')).toBe('handoff notes')
  expect(alpha.service.lastHandoffOutcome()).toMatchObject({ ok: true })
  await rm(projectRoot, { recursive: true, force: true })
})

it('applies received model configuration and remaps session paths onto the receiver', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-model-src-'))
  const betaHome = await mkdtemp(join(tmpdir(), 'dsh-prod-home-'))
  const alphaHome = await mkdtemp(join(tmpdir(), 'dsh-prod-sender-home-'))
  await mkdir(join(projectRoot, '素材'), { recursive: true })
  await writeFile(join(projectRoot, '素材', 'notes.txt'), 'notes', 'utf8')
  const applied: { ns: string; patch: object }[] = []
  const stored: [string, string][] = []
  const importedRemaps: unknown[] = []
  const importer: HandoffImporter = {
    importArchive: async (_archive, options) => {
      importedRemaps.push(options.pathRemaps)
      return { root: { id: 'session-model' }, descendants: [] }
    },
  }
  const sessionExport: HandoffSessionExport = {
    flush: async () => undefined,
    readLog: async () => '{"header":{}}',
    writeArchive: async (_content, _id, absolutePath) => writeFixtureArchive(absolutePath, new Uint8Array([1, 2, 3])),
  }
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '带模型配置', sessionIds: [SessionId('s1')] },
    sessionExport,
    homeDirectory: alphaHome,
  })
  const beta = await device({ withSeams: true, importer, homeDirectory: betaHome })
  beta.ctx.provide('settings', {
    update: async (ns: string, patch: object) => { applied.push({ ns, patch }) },
  } as never)
  beta.ctx.provide('credentials', {
    set: async (ref: string, value: string) => { stored.push([ref, value]) },
  } as never)
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })

  const config = {
    version: 1,
    settings: { 'llm-pi-ai': { providers: { xiaomi: { models: [] } } } },
    credentials: { XIAOMI_API_KEY: 'sk-test' },
  }
  await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot, {
    configDocuments: [{ name: 'model-config.json', bytes: new TextEncoder().encode(JSON.stringify(config)) }],
  })
  expect(applied).toEqual([{ ns: 'llm-pi-ai', patch: { providers: { xiaomi: { models: [] } } } }])
  expect(stored).toEqual([['XIAOMI_API_KEY', 'sk-test']])
  const received = join(beta.destination, '带模型配置')
  const remaps = importedRemaps[0] as readonly { from: string; to: string }[]
  expect(new Map(remaps.map(remap => [remap.from, remap.to]))).toEqual(new Map([
    [projectRoot, received],
    [alphaHome, betaHome],
  ]))
  await rm(projectRoot, { recursive: true, force: true })
  await rm(betaHome, { recursive: true, force: true })
  await rm(alphaHome, { recursive: true, force: true })
})

it('streams one project over the configured parallel connections', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-par-'))
  const files = ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt']
  for (const name of files) await writeFile(join(projectRoot, name), `content-${name}`, 'utf8')
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '并行项目' },
    parallelConnections: 3,
  })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })

  const opened = vi.spyOn(alpha.service, 'openSyncChannel')
  const sent = await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
  expect(opened).toHaveBeenCalledTimes(3)
  expect(sent.sent.map(entry => entry.path).sort()).toEqual(files.sort())
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(true) }, { timeout: 5_000 })
  for (const name of files) {
    expect(await readFile(join(beta.destination, '并行项目', name), 'utf8')).toBe(`content-${name}`)
  }
  await rm(projectRoot, { recursive: true, force: true })
})

it('dials a paired peer from its stored endpoint while discovery is blind', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-lastaddr-'))
  await writeFile(join(projectRoot, 'a.txt'), 'AAAA', 'utf8')
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '存储地址' },
    parallelConnections: 1,
  })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)
  // No discovery event at all: the stored pairing endpoint is the only way
  // this device knows where the peer listens.
  expect(alpha.service.peersSnapshot()).toEqual([])
  const record = await readFile(join(alpha.root, 'peers.json'), 'utf8')
  expect(JSON.parse(record).peers).toEqual([expect.objectContaining({
    id: beta.deviceId,
    addresses: ['127.0.0.1'],
    port: beta.port,
  })])

  await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(true) }, { timeout: 5_000 })
  expect(await readFile(join(beta.destination, '存储地址', 'a.txt'), 'utf8')).toBe('AAAA')
  await rm(projectRoot, { recursive: true, force: true })
})

it('remembers a discovered endpoint at pairing time and dials it after a restart', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-restart-'))
  await writeFile(join(projectRoot, 'a.txt'), 'AAAA', 'utf8')
  const alpha = await device({ withSeams: true, resolveWorkspaceTo: { path: projectRoot, title: '重启续用' }, parallelConnections: 1 })
  const beta = await device({ withSeams: true })
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })
  // Pair through discovery: the recorded endpoint includes lastSeenAt.
  const dialed = await alpha.service.pairWithDiscoveredPeer(beta.deviceId)
  await vi.waitFor(() => { expect(beta.service.pairingOffers()).toHaveLength(1) })
  const pending = beta.service.pairingOffers()[0]
  if (pending === undefined) throw new Error('no pending pairing')
  await Promise.all([dialed.accept(), beta.service.acceptPairing(pending.id)])
  const record = JSON.parse(await readFile(join(alpha.root, 'peers.json'), 'utf8')).peers[0]
  expect(record).toMatchObject({ addresses: ['127.0.0.1'], port: beta.port })
  expect(typeof record.lastSeenAt).toBe('number')
  await rm(projectRoot, { recursive: true, force: true })
})

it('asks for an address when a paired peer has no remembered endpoint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-prod-legacy-peers-'))
  const peersFile = join(root, 'peers.json')
  await writeFile(peersFile, JSON.stringify({
    version: 1,
    peers: [{ id: 'e'.repeat(20), name: 'legacy', platform: 'macos', pairedAt: 1 }],
  }), 'utf8')
  const alpha = await device({ withSeams: true, identityRoot: root })
  try {
    await expect(alpha.service.openSyncChannel('e'.repeat(20)))
      .rejects.toThrow(/"pair by address"/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('refuses a sync dial to a device that is not paired', async () => {
  const alpha = await device({ withSeams: true })
  const beta = await device({ withSeams: true })
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot()).toHaveLength(1) })
  await expect(alpha.service.openSyncChannel(beta.deviceId)).rejects.toThrow(/not paired/u)
})

it('refuses handoff when the profile lacks session services', async () => {
  const alpha = await device({ withSeams: false })
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-nosrc-'))
  await writeFile(join(projectRoot, 'a.txt'), 'x', 'utf8')
  await expect(alpha.service.sendProjectToPeer('someone', projectRoot))
    .rejects.toThrow(/requires the .*service\(s\)/u)
  await rm(projectRoot, { recursive: true, force: true })
})

it('projects live receipt progress until the session import settles', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-live-'))
  await writeFile(join(projectRoot, 'a.txt'), 'x', 'utf8')
  const gate = Promise.withResolvers<void>()
  const importer: HandoffImporter = {
    importArchive: async () => {
      await gate.promise
      return { root: { id: 'session-x' }, descendants: [] }
    },
  }
  const sessionExport: HandoffSessionExport = {
    flush: async () => undefined,
    readLog: async () => '{"header":{}}',
    writeArchive: async (_content, _id, absolutePath) => writeFixtureArchive(absolutePath, new Uint8Array([1, 2, 3])),
  }
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '带会话', sessionIds: [SessionId('s1')] },
    sessionExport,
  })
  const beta = await device({ withSeams: true, importer })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })

  const sending = alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
  let settled = false
  void sending.then(() => { settled = true }, () => { settled = true })
  await vi.waitFor(() => { expect(beta.service.receivingSnapshot()?.phase).toBe('importing') }, { timeout: 5_000 })
  const live = beta.service.receivingSnapshot()
  expect(live).toMatchObject({
    phase: 'importing',
    projectTitle: '带会话',
    entriesDone: 2,
    entriesTotal: 2,
  })
  expect(live?.bytesDone).toBe(live?.bytesTotal)
  expect(live?.startedAt).toBeLessThanOrEqual(Date.now())
  // The sender's success is the receiver's completion ack, which arrives only
  // after the import settles.
  expect(settled).toBe(false)
  gate.resolve()
  await sending
  await vi.waitFor(() => { expect(beta.service.receivingSnapshot()).toBeUndefined() }, { timeout: 5_000 })
  expect(beta.service.lastHandoffOutcome()?.ok).toBe(true)
  await rm(projectRoot, { recursive: true, force: true })
})

it('reports the receiving device import failure to the sender', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-importfail-'))
  await writeFile(join(projectRoot, 'a.txt'), 'x', 'utf8')
  const importer: HandoffImporter = {
    importArchive: async () => { throw new Error('store refused the archive') },
  }
  const sessionExport: HandoffSessionExport = {
    flush: async () => undefined,
    readLog: async () => '{"header":{}}',
    writeArchive: async (_content, _id, absolutePath) => writeFixtureArchive(absolutePath, new Uint8Array([1, 2, 3])),
  }
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '导入失败', sessionIds: [SessionId('s1')] },
    sessionExport,
  })
  const beta = await device({ withSeams: true, importer })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })

  const failure = await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
    .then(() => undefined, (error: unknown) => error)
  expect(failure).toMatchObject({ name: 'TransferCompletionError' })
  expect((failure as Error).message).toContain('store refused the archive')
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(false) }, { timeout: 5_000 })
  await rm(projectRoot, { recursive: true, force: true })
})

it('refuses to dial a paired peer that speaks an older protocol', async () => {
  const alpha = await device({ withSeams: true })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '1', vmin: '1' },
  })
  await vi.waitFor(() => {
    expect(alpha.service.peersSnapshot().find(peer => String(peer.id) === beta.deviceId)?.compatible).toBe(false)
  })
  await expect(alpha.service.openSyncChannel(beta.deviceId)).rejects.toThrow(/incompatible/u)
})

afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) await dispose()
})

it('fails every parallel worker when the receiver cannot stage one entry', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-par-bad-'))
  await writeFile(join(projectRoot, 'a.txt'), 'AAAAAAAA', 'utf8')
  await writeFile(join(projectRoot, 'b.txt'), 'BBBBBBBB', 'utf8')
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '并行损坏' },
    parallelConnections: 2,
  })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })
  // Recompute the content-derived bundle id and squat a directory on one
  // entry's staging path: the receiving sink cannot write that entry, so the
  // shared receipt fails every worker and nothing publishes.
  const prepared = await bundleFromFiles({
    projectTitle: '并行损坏',
    files: await Promise.all(['a.txt', 'b.txt'].map(async (name) => {
      const absolutePath = join(projectRoot, name)
      const info = await stat(absolutePath)
      return { absolutePath, relativePath: name, size: info.size, sha256: createHash('sha256').update(await readFile(absolutePath)).digest('hex') }
    })),
    sessionArchives: [],
    sourceCwd: projectRoot,
  })
  await mkdir(join(beta.destination, `.handoff-${prepared.manifest.bundleId}`, 'a.txt'), { recursive: true })
  await expect(alpha.service.sendProjectToPeer(beta.deviceId, projectRoot))
    .rejects.toBeDefined()
  await expect(stat(join(beta.destination, '并行损坏'))).rejects.toMatchObject({ code: 'ENOENT' })
  await rm(projectRoot, { recursive: true, force: true })
})

it('reports a parallel import failure to the sender and publishes nothing', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-par-import-'))
  await writeFile(join(projectRoot, 'a.txt'), 'AAAA', 'utf8')
  await writeFile(join(projectRoot, 'b.txt'), 'BBBB', 'utf8')
  const importer: HandoffImporter = {
    importArchive: async () => { throw new Error('store refused the archive') },
  }
  const sessionExport: HandoffSessionExport = {
    flush: async () => undefined,
    readLog: async () => '{"header":{}}',
    writeArchive: async (_content, _id, absolutePath) => writeFixtureArchive(absolutePath, new Uint8Array([1, 2, 3])),
  }
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '并行导入失败', sessionIds: [SessionId('s1')] },
    sessionExport,
    parallelConnections: 2,
  })
  const beta = await device({ withSeams: true, importer })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })
  const failure = await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
    .then(() => undefined, (error: unknown) => error)
  expect((failure as Error).message).toContain('store refused the archive')
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(false) }, { timeout: 5_000 })
  await rm(projectRoot, { recursive: true, force: true })
})

it('streams a parallel bundle into a receiver that configures a data root', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-par-data-'))
  await writeFile(join(projectRoot, 'a.txt'), 'AAAA', 'utf8')
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '并行数据根' },
    parallelConnections: 2,
  })
  const beta = await device({ withSeams: true, dataDirectory: await mkdtemp(join(tmpdir(), 'dsh-prod-par-data-in-')) })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })
  await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(true) }, { timeout: 5_000 })
  expect(await readFile(join(beta.destination, '并行数据根', 'a.txt'), 'utf8')).toBe('AAAA')
  await rm(projectRoot, { recursive: true, force: true })
})

it('aborts every worker when the caller cancels a parallel send', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-prod-par-abort-'))
  // Large enough that the transfer is still running when the signal fires.
  const chunk = Buffer.alloc(32 * 1024 * 1024, 7)
  await writeFile(join(projectRoot, 'big.bin'), chunk)
  const alpha = await device({
    withSeams: true,
    resolveWorkspaceTo: { path: projectRoot, title: '并行取消' },
    parallelConnections: 2,
  })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })
  const controller = new AbortController()
  const sending = alpha.service.sendProjectToPeer(beta.deviceId, projectRoot, { signal: controller.signal })
  // Abort only once the receiver is actually staging bytes, so the signal
  // lands mid-transfer instead of during the TLS handshake.
  await vi.waitFor(() => { expect(beta.service.receivingSnapshot()?.phase).toBe('receiving') }, { timeout: 5_000 })
  controller.abort()
  await expect(sending).rejects.toBeDefined()
  await rm(projectRoot, { recursive: true, force: true })
})

it('refuses a worker that arrives without its first connection', async () => {
  const alpha = await device({ withSeams: true })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '5', vmin: '5' },
  })
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot().map(peer => String(peer.id))).toContain(beta.deviceId) })
  const entry = { kind: 'file' as const, path: 'a.txt', size: 1, sha256: 'a'.repeat(64) }
  const manifest = {
    protocolVersion: 5,
    bundleId: 'orphan-worker',
    projectTitle: '孤儿',
    sourceCwd: '/tmp/x',
    entries: [entry],
    treeSummary: computeTreeSummary([entry]),
  }
  const opened = await alpha.service.openSyncChannel(beta.deviceId)
  try {
    opened.channel.write({ type: 'offer', binaryLength: 0, manifest, worker: { index: 1, total: 2 } })
    await expect(opened.channel.next(['accept', 'reject'], 5_000)).rejects.toBeInstanceOf(ChannelClosedError)
  } finally {
    opened.socket.destroy()
  }
})
