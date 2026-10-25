/** Behavior tests for the Easel plugin's host routes, exercised through the real filesystem. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

/**
 * Build a throwaway Easel-shaped skill root and run one assertion pass against the mounted plugin.
 * @param run - receives the fixture paths and the routes `apply` registered.
 */
async function withFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'easel-plugin-'))
  const skillsDir = join(root, 'skills', 'openclaw')
  await mkdir(join(skillsDir, 'ai-image-gen'), { recursive: true })
  await mkdir(join(skillsDir, '_shared'), { recursive: true })
  await mkdir(join(skillsDir, 'block-scalar'), { recursive: true })
  await writeFile(join(skillsDir, 'ai-image-gen', 'SKILL.md'), [
    '---',
    'name: ai-image-gen',
    'description: "通用 AI 生图：文生图 / 图生图。"',
    'layer: produce',
    '---',
    '',
    '# body',
  ].join('\n'))
  // A folded block scalar: the description lives on the indented lines that
  // this read-only projection does not parse.
  await writeFile(join(skillsDir, 'block-scalar', 'SKILL.md'), [
    '---',
    'name: block-scalar',
    'description: >',
    '  通用 AI 生图：文生图 / 图生图。',
    'layer: produce',
    '---',
    '',
    '# body',
  ].join('\n'))
  await writeFile(join(skillsDir, 'quality-gate.md'), [
    '---',
    'name: quality-gate',
    'description: 发布前检查',
    '---',
    '',
    '# body',
  ].join('\n'))
  await writeFile(join(skillsDir, '_shared', 'SKILL.md'), '---\nname: shared\n---\n')
  const routes = []
  const ctx = {
    effect: start => start(),
    provide() {},
    webServer: { register: route => (routes.push(route), () => {}) },
    // The catalog tests never touch the API prefix; a fence that admits nothing
    // would make every /easel/api case a 401 before reaching its assertion.
    connection: { requestRejection: () => undefined },
    logger: { info() {} },
  }
  try {
    apply(ctx, { projectRoot: root, skillsDir })
    await run({ routes })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

/**
 * Drive one registered route's handler with a minimal request and collect the response.
 * @param route - the route to invoke.
 * @param method - HTTP method to present.
 * @returns the recorded status, headers, and body text.
 */
function invoke(route, method = 'GET') {
  return new Promise(resolve => {
    const res = {
      statusCode: null,
      headers: null,
      body: '',
      headersSent: false,
      writeHead(status, headers) {
        this.statusCode = status
        this.headers = headers
      },
      end(chunk) {
        this.body += chunk ?? ''
        resolve(this)
      },
    }
    route.handler({ method, url: `${route.path}/x`, headers: {} }, res)
  })
}

/** Find a registered route by its kind and path. @param routes - registered routes. @param path - pathname. @returns the route. */
const routeAt = (routes, path) => routes.find(route => route.path === path)

test('mounts two read routes and the local api prefix under the base path', async () => {
  await withFixture(({ routes }) => {
    assert.equal(routes.length, 3)
    assert.deepEqual(routes.map(route => `${route.kind} ${route.path}`), [
      'exact /easel/status',
      'exact /easel/skills',
      'prefix /easel/api',
    ])
  })
})

test('catalogs directory skills and flat markdown skills, skipping private entries', async () => {
  await withFixture(async ({ routes }) => {
    const answer = await invoke(routeAt(routes, '/easel/skills'))
    assert.equal(answer.statusCode, 200)
    const catalog = JSON.parse(answer.body)
    assert.equal(catalog.present, true)
    assert.equal(catalog.count, 3)
    assert.deepEqual(catalog.skills.map(skill => skill.name), ['ai-image-gen', 'block-scalar', 'quality-gate'])
    assert.equal(catalog.skills[0].layer, 'produce')
    assert.equal(catalog.skills[0].description, '通用 AI 生图：文生图 / 图生图。')
    // A folded block scalar enumerates as an empty description rather than the
    // bare `>` indicator the un-parsed frontmatter line holds.
    assert.equal(catalog.skills[1].description, '')
  })
})

test('reports an absent skill root instead of failing', async () => {
  const routes = []
  apply({
    effect: start => start(),
    provide() {},
    webServer: { register: route => (routes.push(route), () => {}) },
    connection: { requestRejection: () => undefined },
    logger: { info() {} },
  }, { skillsDir: join(tmpdir(), 'easel-plugin-does-not-exist'), basePath: '/easel' })
  const answer = await invoke(routeAt(routes, '/easel/skills'))
  const catalog = JSON.parse(answer.body)
  assert.equal(catalog.present, false)
  assert.equal(catalog.count, 0)
})

test('status reports the retired backend and the skill count', async () => {
  await withFixture(async ({ routes }) => {
    const answer = await invoke(routeAt(routes, '/easel/status'))
    assert.equal(answer.statusCode, 200)
    const status = JSON.parse(answer.body)
    assert.equal(status.backend.retired, true)
    assert.equal(status.skills.count, 3)
  })
})

test('a read route rejects a non-GET request', async () => {
  await withFixture(async ({ routes }) => {
    const answer = await invoke(routeAt(routes, '/easel/skills'), 'POST')
    assert.equal(answer.statusCode, 405)
    assert.equal(answer.headers.allow, 'GET, HEAD')
  })
})
