/**
 * Product-level handoff over two loopback services: pairing through the
 * pending API, discovery-driven sync dialing, and a zero-session bundle
 * received into the configured handoff directory with workspace attachment.
 */

import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
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
}): Promise<Device> {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'dsh-prod-'))
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
  const service = new LanHandoffService(ctx, { name: 'loopback', handoffDirectory: destination }, {
    identityRoot: root,
    discovery,
    allowLoopbackPeers: true,
    ...seamOptions,
  })
  const state = await service.ready
  disposers.push(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
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
  const alpha = await device({ withSeams: true, resolveWorkspaceTo: { path: projectRoot, title: '项目甲' } })
  const beta = await device({ withSeams: true })
  await pair(alpha, beta)

  // Discovery tells alpha where beta listens.
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '2', vmin: '2' },
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

it('refuses a sync dial to a device that is not paired', async () => {
  const alpha = await device({ withSeams: true })
  const beta = await device({ withSeams: true })
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '2', vmin: '2' },
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
    zip: async () => new Uint8Array([1, 2, 3]),
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
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '2', vmin: '2' },
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
    zip: async () => new Uint8Array([1, 2, 3]),
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
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '2', vmin: '2' },
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
