/**
 * Service-level edge coverage: guard refusals, the session-export send path,
 * raw hello routing, and handoff receipt refusals.
 */

import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { afterEach, expect, it, vi } from 'vitest'
import {
  attachChannel,
  HandoffReceiveError,
  LanHandoffService,
  prepareBundle,
  receiveHandoff,
  sendPreparedBundle,
  type ConnectionChannel,
  type HandoffImporter,
  type HandoffSessionExport,
  type HandoffWorkspaces,
  type LanAdvertisement,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
} from '../src/index.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'
import { loadDeviceIdentity } from '../src/identity.ts'

const encoder = new TextEncoder()

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

interface SeamSet {
  readonly workspaces: HandoffWorkspaces
  readonly importer?: HandoffImporter
  readonly sessionExport?: HandoffSessionExport
}

/** Minimal workspace seam resolving one optional project with optional sessions. */
function workspaceSeam(project?: {
  readonly path: string
  readonly title: string
  readonly sessionIds?: readonly SessionId[]
}): HandoffWorkspaces {
  return {
    resolveByPath: async () => project === undefined
      ? undefined
      : { path: project.path, title: project.title, sessionIds: project.sessionIds ?? [] },
    create: async () => ({ attachSession: async () => undefined }),
  }
}

interface Device {
  readonly service: LanHandoffService
  readonly discovery: RecordingDiscoveryHost
  readonly destination: string
  readonly port: number
  readonly deviceId: string
}

const cleanup: (() => Promise<void>)[] = []

/** Boot one service with stubbed storage services and the supplied seams. */
async function device(seams: SeamSet): Promise<Device> {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'dsh-svc-'))
  const destination = await mkdtemp(join(tmpdir(), 'dsh-svc-inbox-'))
  ctx.provide('sessionPersistence', {} as Context['sessionPersistence'])
  ctx.provide('sessionQuery', {} as Context['sessionQuery'])
  ctx.provide('attachments', {} as Context['attachments'])
  const discovery = new RecordingDiscoveryHost()
  const service = new LanHandoffService(ctx, { name: 'loopback', handoffDirectory: destination }, {
    identityRoot: root,
    discovery,
    allowLoopbackPeers: true,
    workspaces: seams.workspaces,
    ...seams.importer === undefined ? {} : { importer: seams.importer },
    ...seams.sessionExport === undefined ? {} : { sessionExport: seams.sessionExport },
  })
  const state = await service.ready
  cleanup.push(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  })
  return { service, discovery, destination, port: state.port, deviceId: String(state.deviceId) }
}

/** Pair two services through the pending-offer API. */
async function pair(alpha: Device, beta: Device): Promise<void> {
  const dialed = await alpha.service.pairWithPeer({ host: '127.0.0.1', port: beta.port })
  await vi.waitFor(() => { expect(beta.service.pairingOffers()).toHaveLength(1) })
  const pending = beta.service.pairingOffers()[0]
  if (pending === undefined) throw new Error('no pending pairing')
  await Promise.all([dialed.accept(), beta.service.acceptPairing(pending.id)])
}

/** Point alpha's discovery at beta. */
function discover(alpha: Device, beta: Device): void {
  alpha.discovery.emit({
    addresses: ['127.0.0.1'],
    port: beta.port,
    txt: { id: beta.deviceId, name: 'beta', pf: 'linux', v: '1', vmin: '1' },
  })
}

/** Open one raw loopback TLS channel pair without pairing. */
async function rawLoop(): Promise<{
  readonly client: ConnectionChannel
  readonly server: ConnectionChannel
  readonly close: () => Promise<void>
}> {
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-svc-raw-')))
  const accepted = Promise.withResolvers<ConnectionChannel>()
  const listener = await startLanListener(identity, 0, (socket: TLSSocket) => {
    accepted.resolve(attachChannel(socket))
  }, ['127.0.0.1'])
  const socket = dialLanPeer({ host: '127.0.0.1', port: listener.port }, identity)
  const server = await accepted.promise
  let closed = false
  return {
    client: attachChannel(socket),
    server,
    close: async () => {
      if (closed) return
      closed = true
      socket.destroy()
      await listener.close()
    },
  }
}

it('refuses unknown pairing ids, unknown peers, and cancelled dials', async () => {
  const alpha = await device({ workspaces: workspaceSeam() })
  await expect(alpha.service.acceptPairing('nope')).rejects.toThrow(/not pending/u)
  await expect(alpha.service.rejectPairing('nope')).rejects.toThrow(/not pending/u)
  await expect(alpha.service.pairWithDiscoveredPeer('ffffffffffffffffffff')).rejects.toThrow(/not currently visible/u)
  const controller = new AbortController()
  controller.abort()
  await expect(alpha.service.pairWithPeer({ host: '127.0.0.1', port: 1 }, { signal: controller.signal }))
    .rejects.toMatchObject({ name: 'AbortError' })
  expect(alpha.service.lastHandoffOutcome()).toBeUndefined()
})

it('refuses to send an unregistered workspace', async () => {
  const alpha = await device({ workspaces: workspaceSeam() })
  await expect(alpha.service.sendProjectToPeer('ffffffffffffffffffff', 'C:\\missing'))
    .rejects.toThrow(/no registered workspace/u)
})

it('sends one exported session archive alongside the project files', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-svc-src-'))
  await writeFile(join(projectRoot, 'a.txt'), 'alpha', 'utf8')
  const imported: Uint8Array[] = []
  const exported: string[] = []
  const attachedIds: string[] = []
  const alpha = await device({
    workspaces: workspaceSeam({ path: projectRoot, title: '会话项目', sessionIds: [SessionId('s1')] }),
    sessionExport: {
      flush: async (sessionId) => { exported.push(`flush:${String(sessionId)}`) },
      readLog: async sessionId => `log:${String(sessionId)}`,
      zip: async (content, sessionId) => {
        exported.push(`zip:${String(sessionId)}:${content}`)
        return encoder.encode('PK\u0003\u0004zip')
      },
    },
  })
  const beta = await device({
    workspaces: {
      resolveByPath: async () => undefined,
      create: async () => ({ attachSession: async (id) => { attachedIds.push(String(id)) } }),
    },
    importer: {
      importArchive: async (archive) => {
        imported.push(archive)
        return { root: { id: 's1' }, descendants: [{ id: 'c1' }] }
      },
    },
  })
  await pair(alpha, beta)
  discover(alpha, beta)
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot()).toHaveLength(1) })

  const controller = new AbortController()
  const sent = await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot, { signal: controller.signal })
  expect(exported).toEqual(['flush:s1', 'zip:s1:log:s1'])
  expect(sent.sent.map(entry => entry.path).sort()).toEqual(['a.txt', 'dsh-session-s1.zip'])
  await vi.waitFor(() => { expect(imported).toHaveLength(1) })
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(true) })
  await vi.waitFor(() => { expect(attachedIds).toEqual(['s1', 'c1']) })
  await rm(projectRoot, { recursive: true, force: true })
})

it('closes a sync connection when the receiving side has no importer', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-svc-src2-'))
  await writeFile(join(projectRoot, 'a.txt'), 'alpha', 'utf8')
  const alpha = await device({ workspaces: workspaceSeam({ path: projectRoot, title: 'p' }) })
  const beta = await device({ workspaces: workspaceSeam() })
  await pair(alpha, beta)
  discover(alpha, beta)
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot()).toHaveLength(1) })
  const failure = await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(beta.service.lastHandoffOutcome()).toBeUndefined()
  await rm(projectRoot, { recursive: true, force: true })
})

it('routes a sync hello that claims an unpaired identity to a notPaired reject', async () => {
  const alpha = await device({ workspaces: workspaceSeam() })
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-raw-sync-')))
  const socket = dialLanPeer({ host: '127.0.0.1', port: alpha.port }, identity)
  const client = attachChannel(socket)
  try {
    client.write({ type: 'hello', binaryLength: 0, intent: 'sync', peer: 'ffffffffffffffffffff' })
    const rejection = await client.next('reject', 5_000)
    expect(rejection['reason']).toBe('notPaired')
  } finally {
    socket.destroy()
  }
})

it('routes an unrecognized intent to an incompatible reject', async () => {
  const alpha = await device({ workspaces: workspaceSeam() })
  const identity = await loadDeviceIdentity(await mkdtemp(join(tmpdir(), 'dsh-raw-intent-')))
  const socket = dialLanPeer({ host: '127.0.0.1', port: alpha.port }, identity)
  const client = attachChannel(socket)
  try {
    client.write({ type: 'hello', binaryLength: 0, intent: 'teleport' })
    const rejection = await client.next('reject', 5_000)
    expect(rejection['reason']).toBe('incompatible')
  } finally {
    socket.destroy()
  }
})

it('receives an empty project as an empty directory', async () => {
  const source = await mkdtemp(join(tmpdir(), 'dsh-svc-empty-'))
  const destination = await mkdtemp(join(tmpdir(), 'dsh-svc-empty-in-'))
  const prepared = await prepareBundle({ projectPath: source, projectTitle: '空项目', sessionArchives: [] })
  const loop = await rawLoop()
  try {
    const received = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: { importSessionArchives: async () => [], attachProject: async () => undefined },
    })
    const sent = sendPreparedBundle(loop.client, prepared)
    await sent
    const outcome = await received
    expect(await readdir(outcome.projectPath)).toEqual([])
  } finally {
    await loop.close()
    await rm(source, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('refuses receipt when the target parent cannot hold directories', async () => {
  const source = await mkdtemp(join(tmpdir(), 'dsh-svc-parent-'))
  await writeFile(join(source, 'a.txt'), 'a', 'utf8')
  const prepared = await prepareBundle({ projectPath: source, projectTitle: '项目', sessionArchives: [] })
  const blocker = join(await mkdtemp(join(tmpdir(), 'dsh-svc-block-')), 'file')
  await writeFile(blocker, 'not a directory', 'utf8')
  const loop = await rawLoop()
  try {
    const received = receiveHandoff(loop.server, {
      targetParentDirectory: blocker,
      host: { importSessionArchives: async () => [], attachProject: async () => undefined },
    })
    const sent = sendPreparedBundle(loop.client, prepared).catch((error: unknown) => error)
    const outcome = await received.then(
      () => { throw new Error('expected receipt to refuse') },
      (error: unknown) => error,
    )
    expect(outcome).toBeInstanceOf(HandoffReceiveError)
    expect((outcome as HandoffReceiveError).code).toBe('verification')
    expect(await sent).toBeInstanceOf(Error)
  } finally {
    await loop.close()
    await rm(source, { recursive: true, force: true })
  }
})

it('refuses a prepared bundle whose entry has no source', async () => {
  const source = await mkdtemp(join(tmpdir(), 'dsh-svc-src3-'))
  await writeFile(join(source, 'a.txt'), 'a', 'utf8')
  const prepared = await prepareBundle({ projectPath: source, projectTitle: '缺源', sessionArchives: [] })
  const destination = await mkdtemp(join(tmpdir(), 'dsh-svc-src3-in-'))
  const loop = await rawLoop()
  try {
    const received = receiveHandoff(loop.server, {
      targetParentDirectory: destination,
      host: { importSessionArchives: async () => [], attachProject: async () => undefined },
    }).catch((error: unknown) => error)
    const tampered = { ...prepared, sources: new Map() }
    const failure = await sendPreparedBundle(loop.client, tampered).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    await loop.close()
    expect(await received).toBeInstanceOf(Error)
  } finally {
    await loop.close()
    await rm(source, { recursive: true, force: true })
    await rm(destination, { recursive: true, force: true })
  }
})

it('honours cancellation while walking a project tree', async () => {
  const source = await mkdtemp(join(tmpdir(), 'dsh-svc-cancel-'))
  await mkdir(join(source, 'sub'), { recursive: true })
  await writeFile(join(source, 'sub', 'a.txt'), 'a', 'utf8')
  const controller = new AbortController()
  controller.abort()
  await expect(prepareBundle({
    projectPath: source,
    projectTitle: '取消',
    sessionArchives: [],
    signal: controller.signal,
  })).rejects.toMatchObject({ name: 'AbortError' })
  await rm(source, { recursive: true, force: true })
})

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

it('records a receiving-side import failure on the serving device', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dsh-svc-src4-'))
  await writeFile(join(projectRoot, 'a.txt'), 'alpha', 'utf8')
  const alpha = await device({ workspaces: workspaceSeam({ path: projectRoot, title: 'p', sessionIds: [SessionId('s1')] }), sessionExport: {
    flush: async () => undefined,
    readLog: async () => 'log',
    zip: async () => encoder.encode('PK zip'),
  } })
  const beta = await device({
    workspaces: workspaceSeam(),
    importer: { importArchive: async () => { throw new Error('store refused') } },
  })
  await pair(alpha, beta)
  discover(alpha, beta)
  await vi.waitFor(() => { expect(alpha.service.peersSnapshot()).toHaveLength(1) })
  await alpha.service.sendProjectToPeer(beta.deviceId, projectRoot)
  await vi.waitFor(() => { expect(beta.service.lastHandoffOutcome()?.ok).toBe(false) }, { timeout: 5_000 })
  expect(beta.service.lastHandoffOutcome()?.detail).toContain('store refused')
  await rm(projectRoot, { recursive: true, force: true })
})
