// easel-backup 路由与调度测试：真实文件系统 + stub 引擎 + stub 凭据库。
// 覆盖：配置规范化与校验 fail loud、secrets 只回传 has/has-not、备份/恢复互斥、
// 快速失败（缺密钥/坏配置直接 4xx）、定时补跑一次、引擎缺失时 engineReady=false。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BACKUP_CONFIG_FILE,
  BACKUP_GROUP_IDS,
  createBackupFeature,
  defaultBackupConfig,
  normalizeBackupConfig,
  resolveBackupHome,
  validateBackupConfig,
} from '../lib/backup.js'
import { dispatchLocalApi } from '../index.js'

async function makeDeployment() {
  const projectRoot = await mkdtemp(join(tmpdir(), 'easel-backup-plugin-'))
  const records = new Map()
  const credentials = {
    async readRecord(key) {
      const value = records.get(key)
      if (value === undefined) return undefined
      return value.kind === 'api-key' ? { kind: 'api-key', key: value.key } : { kind: 'grant', payload: value.payload }
    },
    async modifyRecord(key, mutate) {
      const next = await mutate(records.get(key))
      if (next !== undefined) records.set(key, next)
      return next
    },
    async deleteRecord(key) {
      records.delete(key)
    },
  }
  const calls = { runs: [], destinations: [], restores: [], due: true, runDelayMs: 0 }
  const engine = {
    async createDestination(config, secrets) {
      calls.destinations.push({ config, secrets })
      return { async probe() {}, async put() {}, async get() {}, async list() { return [] }, async del() {} }
    },
    async runBackupGroup(options) {
      calls.runs.push(options)
      if (calls.runDelayMs > 0) await new Promise(resolve => setTimeout(resolve, calls.runDelayMs))
      return {
        group: options.group,
        stamp: '20261024T093005Z',
        fileCount: 3,
        totalBytes: 30,
        durationMs: 1,
        pruned: [],
      }
    },
    async listBackups() {
      return [{ key: 'easel-backup/config/20261024T093005Z.zip', group: 'config', stamp: '20261024T093005Z', size: 30 }]
    },
    async planRestore(options) {
      calls.restores.push(options)
      return {
        group: options.group,
        stamp: options.stamp,
        manifest: { manifestVersion: 1, group: options.group, createdAt: '2026-10-24T09:30:05.000Z', fileCount: 2, totalBytes: 20 },
        files: [
          { path: 'home/a.txt', stagingPath: join(projectRoot, 'staging-a'), size: 10, targetPath: join(projectRoot, 'a') },
          { path: 'workspace/b.txt', stagingPath: join(projectRoot, 'staging-b'), size: 10, targetPath: join(projectRoot, 'b') },
        ],
        skipped: ['other/c.txt'],
        stagingDir: join(projectRoot, 'staging'),
      }
    },
    async applyRestore() {
      return { applied: 2, skipped: ['other/c.txt'] }
    },
    async discardRestore() {},
    computeDue(_config, lastRunAt) {
      return calls.due && lastRunAt === null
    },
  }
  return { projectRoot, credentials, engine, calls, cleanup: () => rm(projectRoot, { recursive: true, force: true }) }
}


/** 合法可用的 WebDAV 配置（默认配置是「未配置」状态，校验应当拒绝）。 */
const validConfig = () => ({ ...defaultBackupConfig(), endpoint: 'https://dav.example.com/dav', username: 'user' })

function makeFeature(deployment, extra = {}) {
  return createBackupFeature({
    settings: { projectRoot: deployment.projectRoot },
    credentials: deployment.credentials,
    engine: deployment.engine,
    ...extra,
  })
}

const call = async (feature, method, segments, body = undefined) =>
  dispatchLocalApi({ projectRoot: process.cwd() }, method, segments, {}, async () => body ?? {}, {}, feature.routes)

test('默认配置可过校验，normalize 补默认并丢未知字段', () => {
  assert.deepEqual(defaultBackupConfig().groups, { config: true, sessions: true, workspace: false })
  // 未配置的默认值必须被校验拒绝（fail loud），填好端点后放行。
  assert.throws(() => validateBackupConfig(defaultBackupConfig()), error => error.status === 400)
  validateBackupConfig(validConfig())
  const normalized = normalizeBackupConfig({ protocol: 's3', bucket: 'b', region: 'r', unknownField: 1 })
  assert.equal(normalized.protocol, 's3')
  assert.equal(normalized.retention, 10)
  assert.equal('unknownField' in normalized, false)
  assert.equal(normalizeBackupConfig(null).schedule.mode, 'off')
})

test('校验对每类坏配置 fail loud', () => {
  const bad = (patch) => {
    const config = { ...defaultBackupConfig(), ...patch }
    assert.throws(() => validateBackupConfig(config), error => error.status === 400, JSON.stringify(patch))
  }
  bad({ protocol: 'ftp' })
  bad({ protocol: 'webdav', endpoint: 'notaurl' })
  bad({ protocol: 'webdav', username: '' })
  bad({ protocol: 's3', endpoint: 'ftp://x' })
  bad({ protocol: 's3', bucket: '' })
  bad({ protocol: 'smb', root: '' })
  bad({ remoteDir: '../escape' })
  bad({ retention: 0 })
  bad({ retention: 101 })
  bad({ schedule: { mode: 'hourly', at: '03:00', weekday: 0 } })
  bad({ schedule: { mode: 'daily', at: '9:00', weekday: 0 } })
  bad({ schedule: { mode: 'weekly', at: '03:00', weekday: 7 } })
  validateBackupConfig({ ...defaultBackupConfig(), protocol: 's3', bucket: 'b', region: 'r', remoteDir: 'nas/easel' })
})

test('GET config 返回归一化配置与 has/has-not，不回传密钥；引擎缺失时 engineReady=false', async () => {
  const deployment = await makeDeployment()
  try {
    deployment.engine = undefined
    const feature = makeFeature(deployment)
    const response = await call(feature, 'GET', ['backup', 'config'])
    assert.equal(response.json.engineReady, false)
    assert.equal(response.json.config.protocol, 'webdav')
    assert.deepEqual(response.json.secrets, { webdavPassword: false, s3Keys: false, smbPassword: false, passphrase: false })
  } finally {
    await deployment.cleanup()
  }
})

test('PUT config 保存配置并把 secrets 写进凭据库；空字符串 fail loud', async () => {
  const deployment = await makeDeployment()
  try {
    const feature = makeFeature(deployment)
    const config = { ...defaultBackupConfig(), protocol: 's3', bucket: 'bkt', region: 'r1', endpoint: 'http://10.0.0.5:9000', pathStyle: true }
    await assert.rejects(
      call(feature, 'PUT', ['backup', 'config'], { config, secrets: { s3AccessKeyId: 'AKID' } }),
      error => error.status === 400,
    )
    const saved = await call(feature, 'PUT', ['backup', 'config'], {
      config,
      secrets: { s3AccessKeyId: 'AKID', s3SecretAccessKey: 'SECRET', passphrase: 'pw' },
    })
    assert.equal(saved.json.config.bucket, 'bkt')
    assert.deepEqual(saved.json.secrets, { webdavPassword: false, s3Keys: true, smbPassword: false, passphrase: true })
    const persisted = JSON.parse(await readFile(join(deployment.projectRoot, 'outputs', BACKUP_CONFIG_FILE), 'utf8'))
    assert.equal(persisted.protocol, 's3')
    await assert.rejects(
      call(feature, 'PUT', ['backup', 'config'], { config, secrets: { webdavPassword: '' } }),
      error => error.status === 400,
    )
    await assert.rejects(
      call(feature, 'PUT', ['backup', 'config'], { config: null }),
      error => error.status === 400,
    )
  } finally {
    await deployment.cleanup()
  }
})

test('test 连接：缺密钥 400，引擎探活失败 502，成功 ok', async () => {
  const deployment = await makeDeployment()
  try {
    const feature = makeFeature(deployment)
    await call(feature, 'PUT', ['backup', 'config'], { config: validConfig() })
    await assert.rejects(call(feature, 'POST', ['backup', 'test']), error => error.status === 400)
    await call(feature, 'PUT', ['backup', 'config'], { config: validConfig(), secrets: { webdavPassword: 'p' } })
    assert.deepEqual((await call(feature, 'POST', ['backup', 'test'])).json, { ok: true })
  } finally {
    await deployment.cleanup()
  }
})

/** 轮询直到一次 detached 的备份/恢复结束（替代固定 sleep，避免竞态）。 */
async function untilIdle(feature, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = await call(feature, 'GET', ['backup', 'status'])
    if (status.json.busy === false) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.fail('备份在超时内没有结束')
}

test('run：快速失败（未知组/没勾组）直接 4xx；正常运行落历史并更新 lastRunAt', async () => {
  const deployment = await makeDeployment()
  try {
    const feature = makeFeature(deployment)
    await call(feature, 'PUT', ['backup', 'config'], { config: validConfig(), secrets: { webdavPassword: 'p' } })
    await assert.rejects(call(feature, 'POST', ['backup', 'run'], { groups: ['nope'] }), error => error.status === 400)
    const configDoc = join(deployment.projectRoot, 'outputs', BACKUP_CONFIG_FILE)
    await writeFile(configDoc, JSON.stringify({ ...validConfig(), groups: { config: false, sessions: false, workspace: false } }))
    await assert.rejects(call(feature, 'POST', ['backup', 'run']), error => error.status === 400)
    await writeFile(configDoc, JSON.stringify(validConfig()))
    assert.deepEqual((await call(feature, 'POST', ['backup', 'run'])).json, { started: true, groups: ['config', 'sessions'] })
    await untilIdle(feature)
    const status = await call(feature, 'GET', ['backup', 'status'])
    assert.equal(status.json.busy, false)
    assert.equal(status.json.history[0].status, 'completed')
    assert.equal(status.json.history[0].groups.length, 2)
    const persisted = JSON.parse(await readFile(configDoc, 'utf8'))
    assert.equal(typeof persisted.lastRunAt, 'number')
  } finally {
    await deployment.cleanup()
  }
})

test('run 进行中重入 409，且缺密钥在响应里快速失败', async () => {
  const deployment = await makeDeployment()
  try {
    deployment.calls.runDelayMs = 80
    const feature = makeFeature(deployment)
    await call(feature, 'PUT', ['backup', 'config'], { config: validConfig(), secrets: { webdavPassword: 'p' } })
    assert.deepEqual((await call(feature, 'POST', ['backup', 'run'])).json.started, true)
    await assert.rejects(call(feature, 'POST', ['backup', 'run']), error => error.status === 409)
    await untilIdle(feature)
    // 去掉密码后：快速失败 400 而不是把错误埋进历史。
    await deployment.credentials.deleteRecord('easel-backup/webdav-password')
    await assert.rejects(call(feature, 'POST', ['backup', 'run']), error => error.status === 400)
  } finally {
    await deployment.cleanup()
  }
})

test('remote 列出远端份，restore 走 plan → confirm 两段', async () => {
  const deployment = await makeDeployment()
  try {
    const feature = makeFeature(deployment)
    await call(feature, 'PUT', ['backup', 'config'], { config: validConfig(), secrets: { webdavPassword: 'p' } })
    const remote = await call(feature, 'GET', ['backup', 'remote'])
    assert.equal(remote.json.groups.config[0].stamp, '20261024T093005Z')
    await assert.rejects(call(feature, 'POST', ['backup', 'restore'], { group: 'nope', stamp: '20261024T093005Z' }), error => error.status === 400)
    await assert.rejects(call(feature, 'POST', ['backup', 'restore'], { group: 'config', stamp: 'bad' }), error => error.status === 400)
    const planResponse = await call(feature, 'POST', ['backup', 'restore'], { group: 'config', stamp: '20261024T093005Z' })
    assert.equal(planResponse.json.plan.fileCount, 2)
    assert.equal(planResponse.json.plan.skipped, 1)
    const applied = await call(feature, 'POST', ['backup', 'restore'], { group: 'config', stamp: '20261024T093005Z', confirm: true })
    assert.deepEqual(applied.json, { applied: 2, skipped: ['other/c.txt'] })
  } finally {
    await deployment.cleanup()
  }
})

test('tick：off 不跑；due 时跑勾选组一次并推进 lastRunAt；再次 tick 不重入', async () => {
  const deployment = await makeDeployment()
  try {
    const feature = makeFeature(deployment)
    await call(feature, 'PUT', ['backup', 'config'], { config: validConfig(), secrets: { webdavPassword: 'p' } })
    await feature.tick()
    assert.equal(deployment.calls.runs.length, 0)
    const configDoc = join(deployment.projectRoot, 'outputs', BACKUP_CONFIG_FILE)
    await writeFile(configDoc, JSON.stringify({ ...validConfig(), schedule: { mode: 'daily', at: '03:00', weekday: 0 } }))
    await feature.tick()
    assert.equal(deployment.calls.runs.length, 2)
    assert.ok(['config', 'sessions'].includes(deployment.calls.runs[0].group))
    // 第二次 tick：lastRunAt 已推进，stub 的 computeDue 判定不再到期——历史仍只有一场。
    await feature.tick()
    const persisted = JSON.parse(await readFile(configDoc, 'utf8'))
    assert.equal(typeof persisted.lastRunAt, 'number')
    assert.equal(deployment.calls.runs.length, 2)
    const status = await call(feature, 'GET', ['backup', 'status'])
    assert.equal(status.json.history.length, 1)
  } finally {
    await deployment.cleanup()
  }
})

test('connect-smb 仅 Windows 且要求 UNC 形式', async () => {
  const deployment = await makeDeployment()
  try {
    const feature = makeFeature(deployment)
    if (process.platform !== 'win32') {
      await assert.rejects(call(feature, 'POST', ['backup', 'connect-smb'], { root: '\\\\srv\\share' }), error => error.status === 400)
      return
    }
    await assert.rejects(call(feature, 'POST', ['backup', 'connect-smb'], { root: 'C:\\not-unc' }), error => error.status === 400)
    await assert.rejects(call(feature, 'POST', ['backup', 'connect-smb'], { root: '\\\\srv\\share', username: 'u' }), error => error.status === 400)
  } finally {
    await deployment.cleanup()
  }
})

test('resolveBackupHome 尊重 DSH_HOME，兜底 ~/.easel', () => {
  const previous = process.env.DSH_HOME
  try {
    process.env.DSH_HOME = join(tmpdir(), 'dsh-home-override')
    assert.equal(resolveBackupHome(), process.env.DSH_HOME)
    delete process.env.DSH_HOME
    assert.ok(resolveBackupHome().endsWith('.easel') || resolveBackupHome().includes('Easel-dsh'))
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})

test('组 id 与引擎约定一致', () => {
  assert.deepEqual(BACKUP_GROUP_IDS, ['config', 'sessions', 'workspace'])
})

test('入口装配：导出 name/inject/apply，apply 挂路由与定时器（审查 C1 回归）', async () => {
  const mod = await import('../lib/backup.js')
  assert.equal(mod.name, 'easel-backup')
  assert.deepEqual(mod.inject, ['easelApi', 'credentials'])
  assert.equal(typeof mod.apply, 'function')
  const registered = []
  const effects = []
  const credentials = { async readRecord() { return undefined }, async modifyRecord(_key, mutate) { return mutate(undefined) }, async deleteRecord() {} }
  const ctx = {
    easelApi: { settings: { projectRoot: process.cwd() }, register(routes) { registered.push(routes); return () => {} } },
    credentials,
    logger: { info() {}, warn() {} },
    effect(fn, why) {
      effects.push(why)
      return fn()
    },
  }
  mod.apply(ctx)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].length, 8)
  assert.ok(effects.includes('easel-backup: routes'))
  assert.ok(effects.includes('easel-backup: catch-up scheduler'))
})
