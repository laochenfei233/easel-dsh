/** LAN handoff routes: status projection, pairing relay, and send relay. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createHandoffRoutes, dispatchLocalApi } from '../index.js'

const settings = {
  projectRoot: 'C:\\easel-root',
  skillsDir: 'C:\\easel-root\\skills',
  backendUrl: new URL('http://127.0.0.1:1'),
  basePath: '/easel',
}

const OWN_ID = 'a'.repeat(20)
const PEER_ID = 'b'.repeat(20)

/** One fake `lanHandoff` service with a mutable pending list. */
function fakeService() {
  const pending = []
  return {
    ready: Promise.resolve({ deviceId: OWN_ID, name: '开发机', port: 40100, host: '::', handoffDirectory: 'C:\\easel-root\\projects' }),
    pairedPeers: () => [{ id: PEER_ID, name: 'bee', platform: 'macos', pairedAt: 1 }],
    peersSnapshot: () => [],
    pairingOffers: () => pending,
    lastHandoffOutcome: () => null,
    async pairWithPeer() {
      pending.push({ id: 'p1', sas: '123456', direction: 'dialed', peer: { id: 'c'.repeat(20), name: 'cee', platform: 'linux' } })
    },
    async pairWithDiscoveredPeer() {
      throw new Error('unused in this test')
    },
    async acceptPairing(id) {
      assert.equal(id, 'p1')
      pending.length = 0
    },
    async rejectPairing(id) {
      assert.equal(id, 'p1')
      pending.length = 0
    },
    async sendProjectToPeer(peerId, workspacePath) {
      assert.equal(peerId, PEER_ID)
      assert.equal(workspacePath, 'C:\\easel-root\\projects\\p1')
      return { sent: [{ kind: 'file', path: 'a.txt', size: 1, sha256: 'f'.repeat(64) }], skipped: [] }
    },
  }
}

/** Dispatch one route call against a context carrying the fake service. */
function call(service, method, segments, body) {
  const ctx = { get: name => name === 'lanHandoff' ? service : undefined }
  return dispatchLocalApi(
    settings,
    method,
    segments,
    new URLSearchParams(),
    async () => body ?? {},
    {},
    createHandoffRoutes(ctx),
  )
}

test('status reports unavailable without the handoff service', async () => {
  const result = await call(undefined, 'GET', ['handoff', 'status'])
  assert.deepEqual(result.json, { available: false, reason: 'LAN handoff is not enabled in this profile' })
})

test('status projects the device, paired list, pending offers, and last outcome', async () => {
  const result = await call(fakeService(), 'GET', ['handoff', 'status'])
  assert.equal(result.json.available, true)
  assert.equal(result.json.device.id, OWN_ID)
  assert.equal(result.json.device.handoffDirectory, 'C:\\easel-root\\projects')
  assert.deepEqual(result.json.paired.map(peer => peer.name), ['bee'])
  assert.deepEqual(result.json.pending, [])
  assert.equal(result.json.last, null)
})

test('pair parks the dialed offer and returns its confirmation string', async () => {
  const result = await call(fakeService(), 'POST', ['handoff', 'pair'], { host: '127.0.0.1', port: 40100 })
  assert.equal(result.json.id, 'p1')
  assert.equal(result.json.sas, '123456')
  assert.equal(result.json.direction, 'dialed')
  assert.equal(result.json.peer.name, 'cee')
})

test('pair refuses a target without usable host and port', async () => {
  await assert.rejects(
    call(fakeService(), 'POST', ['handoff', 'pair'], { host: '', port: 'nope' }),
    error => error instanceof ApiError && error.status === 400,
  )
})

test('accept and send relay to the service', async () => {
  const service = fakeService()
  const accepted = await call(service, 'POST', ['handoff', 'pair', 'p1', 'accept'])
  assert.deepEqual(accepted.json, { ok: true })
  const sent = await call(service, 'POST', ['handoff', 'send'], {
    peerId: PEER_ID,
    workspacePath: 'C:\\easel-root\\projects\\p1',
  })
  assert.equal(sent.json.ok, true)
  assert.equal(sent.json.sent[0].path, 'a.txt')
})

test('send requires both identifiers', async () => {
  await assert.rejects(
    call(fakeService(), 'POST', ['handoff', 'send'], {}),
    error => error instanceof ApiError && error.status === 400,
  )
})

test('workspaces route lists registered projects', async () => {
  const ctx = {
    get: name => name === 'workspaceRegistry'
      ? { list: () => [{ path: 'C:\easel-root\projects\p1', title: '项目甲' }] }
      : undefined,
  }
  const result = await dispatchLocalApi(
    settings, 'GET', ['handoff', 'workspaces'], new URLSearchParams(), async () => ({}), {}, createHandoffRoutes(ctx),
  )
  assert.deepEqual(result.json, { workspaces: [{ path: 'C:\easel-root\projects\p1', title: '项目甲' }] })
})

test('workspaces route answers empty without a workspace registry', async () => {
  const ctx = { get: () => undefined }
  const result = await dispatchLocalApi(
    settings, 'GET', ['handoff', 'workspaces'], new URLSearchParams(), async () => ({}), {}, createHandoffRoutes(ctx),
  )
  assert.deepEqual(result.json, { workspaces: [] })
})
