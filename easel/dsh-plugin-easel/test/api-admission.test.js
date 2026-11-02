// Admission for `/easel/api/*`: the plane answers filesystem state, so it
// shares the connection fence with `/api`. The ASR runner capability (the
// skills' curl) is the one exception and covers `POST /asr` only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

/**
 * Mount the plugin against a throwaway project root and capture its prefix route.
 * @param options.withConnection - false to mount without the connection service.
 * @returns the mounted fixture; `rejections` feeds one admission verdict per request.
 */
async function mount({ withConnection = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'easel-admission-'))
  await mkdir(join(root, 'outputs'), { recursive: true })
  const routes = []
  const provided = {}
  const rejections = []
  const ctx = {
    effect: start => start(),
    provide: (name, service) => { provided[name] = service },
    webServer: { register: route => (routes.push(route), () => {}) },
    ...(withConnection ? { connection: { requestRejection: () => rejections.shift() } } : {}),
    logger: { info() {} },
  }
  apply(ctx, { projectRoot: root })
  return { root, routes, provided, rejections, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * Drive one request through the mounted `/easel/api` prefix.
 * @returns the recorded status and parsed body.
 */
function call(routes, { method = 'GET', path = '/easel/api/status', headers = {} } = {}) {
  const route = routes.find(entry => entry.path === '/easel/api')
  return new Promise(resolve => {
    const res = {
      statusCode: null,
      body: '',
      writeHead(status) { this.statusCode = status },
      end(chunk) { this.body += chunk ?? '' },
    }
    Promise.resolve(route.handler({ method, url: path, headers }, res)).then(() => {
      let json = null
      try {
        json = JSON.parse(res.body)
      } catch {
        // A file response writes bytes; these cases only assert status and JSON.
      }
      resolve({ status: res.statusCode, json })
    })
  })
}

test('an unauthenticated caller is refused', async () => {
  const fixture = await mount()
  try {
    fixture.rejections.push(401)
    const answer = await call(fixture.routes)
    assert.equal(answer.status, 401)
    assert.equal(answer.json.ok, false)
  } finally {
    await fixture.cleanup()
  }
})

test('an authenticated same-origin caller is admitted', async () => {
  const fixture = await mount()
  try {
    fixture.rejections.push(undefined)
    const answer = await call(fixture.routes)
    assert.equal(answer.status, 200)
    assert.equal(answer.json.transport, 'dsh')
  } finally {
    await fixture.cleanup()
  }
})

test('a cross-site or rebound caller is refused even without a cookie', async () => {
  const fixture = await mount()
  try {
    fixture.rejections.push(403)
    const answer = await call(fixture.routes)
    assert.equal(answer.status, 403)
  } finally {
    await fixture.cleanup()
  }
})

test('the runner capability opens POST /asr and nothing else', async () => {
  const fixture = await mount()
  try {
    const token = fixture.provided.easelApi.runnerToken
    const runner = { 'x-easel-runner': token }

    // No ASR route is mounted in this fixture, so 404 (not 401) proves admission passed.
    fixture.rejections.push(401)
    const asr = await call(fixture.routes, { method: 'POST', path: '/easel/api/asr', headers: runner })
    assert.equal(asr.status, 404)

    fixture.rejections.push(401)
    const other = await call(fixture.routes, { method: 'GET', path: '/easel/api/status', headers: runner })
    assert.equal(other.status, 401)

    fixture.rejections.push(401)
    const wrong = await call(fixture.routes, {
      method: 'POST', path: '/easel/api/asr', headers: { 'x-easel-runner': 'f'.repeat(64) },
    })
    assert.equal(wrong.status, 401)

    // A multi-byte value must be a plain mismatch, not a crash out of the byte compare.
    fixture.rejections.push(401)
    const multibyte = await call(fixture.routes, {
      method: 'POST', path: '/easel/api/asr', headers: { 'x-easel-runner': 'é'.repeat(64) },
    })
    assert.equal(multibyte.status, 401)
  } finally {
    await fixture.cleanup()
  }
})

test('a deployment without the connection service answers nothing', async () => {
  const fixture = await mount({ withConnection: false })
  try {
    const answer = await call(fixture.routes)
    assert.equal(answer.status, 503)
  } finally {
    await fixture.cleanup()
  }
})
