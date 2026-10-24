/** LAN handoff routes: status projection, pairing relay, send relay, payload assembly, and quick push. */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    async sendProjectToPeer(peerId, workspacePath, options) {
      assert.equal(peerId, PEER_ID)
      assert.equal(workspacePath, 'C:\\easel-root\\projects\\p1')
      this.sentOptions = options
      return { sent: [{ kind: 'file', path: 'a.txt', size: 1, sha256: 'f'.repeat(64) }], skipped: [] }
    },
    async sendFilesToPeer(peerId, payload) {
      assert.equal(peerId, PEER_ID)
      this.pushed = payload
      return { sent: [], skipped: [] }
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

test('send defaults to the full payload and always keeps .env out of the tree', async () => {
  const service = fakeService()
  await call(service, 'POST', ['handoff', 'send'], {
    peerId: PEER_ID,
    workspacePath: 'C:\\easel-root\\projects\\p1',
  })
  assert.deepEqual(service.sentOptions, { sessions: true, exclude: ['.env'] })
})

test('send forwards the payload checkboxes as sessions, exclude, and data files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'easel-handoff-payload-'))
  try {
    // 数据根：.env（白名单外、白名单内空值、白名单内占位符各一把）、画像、技能、内容库。
    await writeFile(join(root, '.env'), 'IMG_API_KEY=k\nSECRET_USER_KEY=v\nVIDEO_PROVIDER=\nARK_API_KEY=replace_me\n', 'utf8')
    await mkdir(join(root, 'profiles', '小乙'), { recursive: true })
    await writeFile(join(root, 'profiles', '小乙', 'identity.md'), '# 人设', 'utf8')
    await mkdir(join(root, 'profiles', '_system'), { recursive: true })
    await writeFile(join(root, 'profiles', '_system', 'x.md'), 'skip', 'utf8')
    await mkdir(join(root, 'skills', 'openclaw', 'demo'), { recursive: true })
    await writeFile(join(root, 'skills', 'openclaw', 'demo', 'SKILL.md'), '---\n---\n', 'utf8')
    await mkdir(join(root, 'outputs', 'proj', '_deconstruct'), { recursive: true })
    await writeFile(join(root, 'outputs', 'proj', 'a.mp4'), 'v', 'utf8')
    await writeFile(join(root, 'outputs', 'proj', '_deconstruct', 'x.json'), '{}', 'utf8')
    await mkdir(join(root, 'outputs', 'analytics'), { recursive: true })
    await writeFile(join(root, 'outputs', 'analytics', 'y.json'), '{}', 'utf8')
    const rootSettings = { ...settings, projectRoot: root, skillsDir: join(root, 'skills', 'openclaw') }

    const service = fakeService()
    const ctx = { get: name => name === 'lanHandoff' ? service : undefined }
    const result = await dispatchLocalApi(
      rootSettings, 'POST', ['handoff', 'send'], new URLSearchParams(), async () => ({
        peerId: PEER_ID,
        workspacePath: 'C:\\easel-root\\projects\\p1',
        payload: { sessions: false, materials: false, library: true, config: true },
      }), {}, createHandoffRoutes(ctx),
    )
    assert.equal(result.json.ok, true)
    assert.equal(service.sentOptions.sessions, false)
    assert.deepEqual(service.sentOptions.exclude, ['.env', '素材'])
    const dataFiles = service.sentOptions.dataFiles
    const paths = dataFiles.map(file => file.path)
    assert.ok(paths.includes('.env'))
    const envText = Buffer.from(dataFiles.find(file => file.path === '.env').bytes).toString('utf8')
    assert.match(envText, /IMG_API_KEY=k/)
    assert.doesNotMatch(envText, /SECRET_USER_KEY/)
    // 空值与占位符都不上包：接收端合并时跳过它们，避免覆盖对端已配置的真值。
    assert.doesNotMatch(envText, /VIDEO_PROVIDER=/)
    assert.doesNotMatch(envText, /ARK_API_KEY=/)
    assert.ok(paths.includes('profiles/小乙/identity.md'))
    assert.ok(!paths.some(path => path.startsWith('profiles/_system')))
    assert.ok(paths.includes('skills/openclaw/demo/SKILL.md'))
    assert.ok(paths.includes('outputs/proj/a.mp4'))
    assert.ok(!paths.includes('outputs/proj/_deconstruct/x.json'))
    assert.ok(!paths.some(path => path.startsWith('outputs/analytics')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('push resolves the enclosing workspace for title and relative path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'easel-handoff-push-'))
  try {
    const project = join(root, 'projects', '项目甲')
    await mkdir(join(project, '素材'), { recursive: true })
    await writeFile(join(project, '素材', 'bgm.mp3'), 'audio', 'utf8')
    const service = fakeService()
    const ctx = {
      get: name => name === 'lanHandoff'
        ? service
        : name === 'workspaceRegistry'
          ? { list: () => [{ path: project, title: '项目甲' }] }
          : undefined,
    }
    const result = await dispatchLocalApi(
      settings, 'POST', ['handoff', 'push'], new URLSearchParams(), async () => ({
        peerId: PEER_ID,
        path: join(project, '素材', 'bgm.mp3'),
      }), {}, createHandoffRoutes(ctx),
    )
    assert.equal(result.json.ok, true)
    assert.deepEqual(service.pushed, {
      projectTitle: '项目甲',
      files: [{ absolutePath: join(project, '素材', 'bgm.mp3'), relativePath: '素材/bgm.mp3' }],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('push walks a directory and falls back to the file name outside any workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'easel-handoff-push-dir-'))
  try {
    await mkdir(join(root, 'bundle', 'inner'), { recursive: true })
    await writeFile(join(root, 'bundle', 'a.txt'), 'A', 'utf8')
    await writeFile(join(root, 'bundle', 'inner', 'b.txt'), 'B', 'utf8')
    const service = fakeService()
    const result = await call(service, 'POST', ['handoff', 'push'], { peerId: PEER_ID, path: join(root, 'bundle') })
    assert.equal(result.json.ok, true)
    assert.equal(service.pushed.projectTitle, 'bundle')
    assert.deepEqual(
      service.pushed.files.map(file => file.relativePath).sort(),
      ['a.txt', 'inner/b.txt'],
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('push refuses a missing path', async () => {
  await assert.rejects(
    call(fakeService(), 'POST', ['handoff', 'push'], { peerId: PEER_ID, path: 'C:\\definitely-missing.bin' }),
    error => error instanceof ApiError && error.status === 404,
  )
})

test('config assembly fails loud when the skills dir sits outside the data root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'easel-handoff-skills-'))
  const outside = await mkdtemp(join(tmpdir(), 'easel-handoff-skills-out-'))
  try {
    await mkdir(join(outside, 'openclaw'), { recursive: true })
    await writeFile(join(outside, 'openclaw', 'SKILL.md'), '---\n---\n', 'utf8')
    const service = fakeService()
    const ctx = { get: name => name === 'lanHandoff' ? service : undefined }
    await assert.rejects(
      dispatchLocalApi(
        { ...settings, projectRoot: root, skillsDir: join(outside, 'openclaw') },
        'POST', ['handoff', 'send'], new URLSearchParams(), async () => ({
          peerId: PEER_ID,
          workspacePath: 'C:\\easel-root\\projects\\p1',
          payload: { config: true },
        }), {}, createHandoffRoutes(ctx),
      ),
      error => error instanceof ApiError && error.status === 400,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('push requires both identifiers', async () => {
  await assert.rejects(
    call(fakeService(), 'POST', ['handoff', 'push'], { peerId: PEER_ID }),
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

test('the client bundle carries the standalone handoff settings section', () => {
  const bundle = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(bundle, /settings\.section/)
  assert.match(bundle, /easel-handoff/)
  assert.match(bundle, /easel\.handoff/)
  assert.match(bundle, /withSessions/)
  assert.match(bundle, /withMaterials/)
  assert.match(bundle, /withLibrary/)
  assert.match(bundle, /withConfig/)
  assert.match(bundle, /showPushTargets/)
})
