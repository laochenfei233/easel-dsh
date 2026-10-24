import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CORE_ROUTES, dispatchLocalApi, setDataRootRestart } from '../index.js'

const root = mkdtempSync(join(tmpdir(), 'easel-data-root-'))
const current = join(root, 'OneDrive', 'current')
const target = join(root, 'moved')
const documents = join(root, 'OneDrive', 'Documents')
const config = join(root, 'config', 'data-root.json')
mkdirSync(join(current, 'workspace'), { recursive: true })

process.env.EASEL_DATA_ROOT = current
process.env.EASEL_DATA_ROOT_DEFAULT = join(documents, 'Easel-dsh')
process.env.EASEL_DATA_ROOT_CONFIG = config
process.env.EASEL_INSTALL_DIR = join(root, 'install')
setDataRootRestart(() => {})

const call = (method, segments, body = {}) =>
  dispatchLocalApi({}, method, segments, new URLSearchParams(), async () => body, {}, CORE_ROUTES)

after(() => {
  delete process.env.EASEL_DATA_ROOT
  delete process.env.EASEL_DATA_ROOT_DEFAULT
  delete process.env.EASEL_DATA_ROOT_CONFIG
  delete process.env.EASEL_INSTALL_DIR
  rmSync(root, { recursive: true, force: true })
})

test('status reports the current root, default, and cloud-sync hint', async () => {
  const res = await call('GET', ['data-root'])
  assert.equal(res.json.supported, true)
  assert.equal(res.json.current, current)
  assert.equal(res.json.default, join(documents, 'Easel-dsh'))
  assert.equal(res.json.isDefault, false)
  assert.equal(res.json.cloudSynced, true)
  assert.equal(res.json.configPath, config)
  assert.equal(res.json.pending, null)
  assert.equal(res.json.lastError, null)
})

test('status reports unsupported when the desktop shell did not provide a root', async () => {
  const saved = process.env.EASEL_DATA_ROOT
  delete process.env.EASEL_DATA_ROOT
  try {
    const res = await call('GET', ['data-root'])
    assert.equal(res.json.supported, false)
  } finally {
    process.env.EASEL_DATA_ROOT = saved
  }
})

test('a relative or missing target is rejected', async () => {
  await assert.rejects(call('POST', ['data-root'], {}), /缺少目标路径/)
  await assert.rejects(call('POST', ['data-root'], { path: 'relative/Easel' }), /绝对路径/)
})

test('targets overlapping the current root are rejected', async () => {
  await assert.rejects(call('POST', ['data-root'], { path: current }), /当前数据目录/)
  await assert.rejects(
    call('POST', ['data-root'], { path: join(current, 'workspace') }),
    /重叠/,
  )
  await assert.rejects(call('POST', ['data-root'], { path: root }), /重叠/)
})

test('a non-empty target or an existing data root is rejected', async () => {
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'notes.txt'), 'user')
  await assert.rejects(call('POST', ['data-root'], { path: target }), /非空/)

  const existing = join(root, 'existing')
  mkdirSync(join(existing, 'workspace'), { recursive: true })
  await assert.rejects(call('POST', ['data-root'], { path: existing }), /已经包含/)
})

test('targets inside the application directory are rejected', async () => {
  const inside = join(root, 'install', 'data')
  await assert.rejects(call('POST', ['data-root'], { path: inside }), /安装目录/)
})

test('moving back through the old-root link is allowed', async () => {
  const link = join(root, 'old-root')
  symlinkSync(current, link, process.platform === 'win32' ? 'junction' : 'dir')
  try {
    const res = await call('POST', ['data-root'], { path: link })
    assert.equal(res.status, 202)
  } finally {
    rmSync(link, { force: true })
  }
})

test('a valid empty target writes the pending request and asks for a restart', async () => {
  const empty = join(root, 'empty-target')
  mkdirSync(empty, { recursive: true })
  let restarted = false
  setDataRootRestart(() => { restarted = true })
  try {
    const res = await call('POST', ['data-root'], { path: empty })
    assert.equal(res.status, 202)
    assert.equal(res.json.ok, true)
    assert.equal(restarted, true)
    const pending = JSON.parse(readFileSync(join(root, 'config', 'data-root.pending.json'), 'utf8'))
    assert.equal(pending.target, empty)
  } finally {
    setDataRootRestart(() => {})
  }
})
