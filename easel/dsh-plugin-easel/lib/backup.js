// Host half: settings backup — grouped zip archives of the data root uploaded
// to a WebDAV / SMB / S3 destination, with optional passphrase encryption,
// retention pruning, catch-up scheduling, and verified restore. Split out of
// dsh-plugin-easel like the automation feature so the workbench keeps working
// when backup fails. The engine itself is @deepseek-ai/dsh-easel-backup in the
// CLI deploy closure, loaded lazily so a missing engine surfaces as one clear
// API error instead of breaking the whole plugin.
//
// 凭据永不回传前端：密码/密钥/口令存 dsh-credentials 库（scope easel-backup），
// 接口只返回 has/has-not。配置本体在 outputs/_backup_config.json，读改写走串
// 行队列（同 radar 的 _ideas.json 模式）。
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { ApiError, readJsonFile, writeJsonFile } from '../index.js'

const execFileP = promisify(execFile)

/** Config document under `<projectRoot>/outputs/`. */
export const BACKUP_CONFIG_FILE = '_backup_config.json'
/** History document under `<projectRoot>/outputs/`. */
export const BACKUP_HISTORY_FILE = '_backup_history.json'
/** Credentials-store scope owning every backup secret. */
export const BACKUP_CREDENTIALS_SCOPE = 'easel-backup'
/** Backup groups, in stable UI order; mirrors the engine's ids. */
export const BACKUP_GROUP_IDS = ['config', 'sessions', 'workspace']

// dsh-credentials 的 key 段语法是小写连字符标识符，全部满足。
const SECRET_IDS = {
  webdavPassword: 'webdav-password',
  s3Keys: 's3-keys',
  smbPassword: 'smb-password',
  passphrase: 'passphrase',
}

const STAMP_PATTERN = /^\d{8}T\d{6}Z$/
const REMOTE_DIR_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_/-]*$/
const AT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Fresh configuration with the safe defaults: WebDAV, config+sessions groups
 * on, encryption off, no schedule.
 * @returns {object} The default configuration document.
 */
export function defaultBackupConfig() {
  return {
    version: 1,
    protocol: 'webdav',
    endpoint: '',
    username: '',
    remoteDir: '',
    region: '',
    bucket: '',
    pathStyle: true,
    root: '',
    groups: { config: true, sessions: true, workspace: false },
    encryption: { enabled: false },
    schedule: { mode: 'off', at: '03:00', weekday: 0 },
    retention: 10,
    lastRunAt: null,
  }
}

const isNonEmpty = value => typeof value === 'string' && value.trim().length > 0
const isBoolean = value => typeof value === 'boolean'

/**
 * Project missing fields onto the known configuration shape and drop unknown
 * keys; every constraint is enforced later by {@link validateBackupConfig}.
 * @param {object|null} raw - Parsed document or null for a fresh install.
 * @returns {object} The normalized configuration.
 */
export function normalizeBackupConfig(raw) {
  const base = defaultBackupConfig()
  if (raw === null || typeof raw !== 'object') return base
  const groups = { ...base.groups }
  if (typeof raw.groups === 'object' && raw.groups !== null) {
    for (const id of BACKUP_GROUP_IDS) if (isBoolean(raw.groups[id])) groups[id] = raw.groups[id]
  }
  const encryption = { enabled: base.encryption.enabled }
  if (typeof raw.encryption === 'object' && raw.encryption !== null && isBoolean(raw.encryption.enabled)) {
    encryption.enabled = raw.encryption.enabled
  }
  const schedule = { ...base.schedule }
  if (typeof raw.schedule === 'object' && raw.schedule !== null) {
    if (['off', 'daily', 'weekly'].includes(raw.schedule.mode)) schedule.mode = raw.schedule.mode
    if (typeof raw.schedule.at === 'string') schedule.at = raw.schedule.at
    if (Number.isInteger(raw.schedule.weekday)) schedule.weekday = raw.schedule.weekday
  }
  return {
    version: 1,
    protocol: typeof raw.protocol === 'string' ? raw.protocol : base.protocol,
    endpoint: typeof raw.endpoint === 'string' ? raw.endpoint : '',
    username: typeof raw.username === 'string' ? raw.username : '',
    remoteDir: typeof raw.remoteDir === 'string' ? raw.remoteDir : '',
    region: typeof raw.region === 'string' ? raw.region : '',
    bucket: typeof raw.bucket === 'string' ? raw.bucket : '',
    pathStyle: isBoolean(raw.pathStyle) ? raw.pathStyle : true,
    root: typeof raw.root === 'string' ? raw.root : '',
    groups,
    encryption,
    schedule,
    retention: Number.isInteger(raw.retention) ? raw.retention : base.retention,
    lastRunAt: Number.isInteger(raw.lastRunAt) ? raw.lastRunAt : null,
  }
}

/**
 * Enforce every configuration constraint; any violation is a user-facing 400.
 * @param {object} config - Normalized configuration.
 */
export function validateBackupConfig(config) {
  if (!['webdav', 's3', 'smb'].includes(config.protocol)) throw new ApiError(400, `备份协议不支持：${String(config.protocol)}`)
  if (config.protocol === 'webdav') {
    if (!/^https?:\/\//.test(config.endpoint)) throw new ApiError(400, 'WebDAV 地址必须是 http(s) URL')
    if (!isNonEmpty(config.username)) throw new ApiError(400, 'WebDAV 需要用户名')
  }
  if (config.protocol === 's3') {
    if (!isNonEmpty(config.bucket)) throw new ApiError(400, 'S3 需要存储桶名')
    if (!isNonEmpty(config.region)) throw new ApiError(400, 'S3 需要区域')
    if (isNonEmpty(config.endpoint) && !/^https?:\/\//.test(config.endpoint)) throw new ApiError(400, 'S3 endpoint 必须是 http(s) URL 或留空')
  }
  if (config.protocol === 'smb' && !isNonEmpty(config.root)) throw new ApiError(400, 'SMB 需要共享路径（UNC、映射盘或挂载点）')
  if (config.remoteDir !== '' && (!REMOTE_DIR_PATTERN.test(config.remoteDir) || config.remoteDir.includes('..'))) {
    throw new ApiError(400, '远端目录只能包含字母、数字、-、_、/')
  }
  for (const id of BACKUP_GROUP_IDS) {
    if (!isBoolean(config.groups[id])) throw new ApiError(400, `备份内容 ${id} 需要布尔值`)
  }
  if (!isBoolean(config.encryption.enabled)) throw new ApiError(400, '加密开关需要布尔值')
  if (!['off', 'daily', 'weekly'].includes(config.schedule.mode)) throw new ApiError(400, `定时模式不支持：${String(config.schedule.mode)}`)
  if (!AT_PATTERN.test(config.schedule.at)) throw new ApiError(400, '定时时刻必须是 HH:mm')
  if (config.schedule.mode === 'weekly' && (!Number.isInteger(config.schedule.weekday) || config.schedule.weekday < 0 || config.schedule.weekday > 6)) {
    throw new ApiError(400, '每周定时需要 0–6 的星期值（0 为周日）')
  }
  if (!Number.isInteger(config.retention) || config.retention < 1 || config.retention > 100) {
    throw new ApiError(400, '保留份数必须是 1–100 的整数')
  }
}

/** The credentials-store key of one backup secret. */
const secretKey = id => `${BACKUP_CREDENTIALS_SCOPE}/${id}`

/**
 * Read one secret value from the credentials store.
 * @param {object} credentials - The credentials service.
 * @param {string} id - Secret id within the backup scope.
 * @returns {Promise<string|object|null>} The stored value, or null when absent.
 */
async function readSecret(credentials, id) {
  let record
  try {
    record = await credentials.readRecord(secretKey(id))
  } catch {
    return null
  }
  if (!record) return null
  if (record.kind === 'api-key') return typeof record.key === 'string' && record.key.length > 0 ? record.key : null
  if (record.kind === 'grant') return record.payload ?? null
  return null
}

/**
 * Store or clear one secret. The S3 key pair rides a grant record (owner-defined
 * JSON); plain secrets ride api-key records.
 * @param {object} credentials - The credentials service.
 * @param {string} id - Secret id within the backup scope.
 * @param {string|object|null} value - Value to store, or null to clear.
 */
async function writeSecret(credentials, id, value) {
  if (value === null) {
    await credentials.deleteRecord(secretKey(id))
    return
  }
  await credentials.modifyRecord(secretKey(id), async () =>
    id === SECRET_IDS.s3Keys ? { kind: 'grant', payload: value } : { kind: 'api-key', key: value })
}

/**
 * Presence map of every backup secret, safe to return to the client.
 * @param {object} credentials - The credentials service.
 * @returns {Promise<object>} Field name → has/has-not.
 */
async function hasSecrets(credentials) {
  const out = {}
  for (const [field, id] of Object.entries(SECRET_IDS)) {
    out[field] = (await readSecret(credentials, id)) !== null
  }
  return out
}

/**
 * dsh home for backup roots; mirrors dsh-home-paths' precedence (explicit >
 * $DSH_HOME > ~/.easel) without a static workspace import from this plain-JS
 * plugin. The packaged runtime sets DSH_HOME to the data root's home/.
 * @returns {string} The dsh home directory.
 */
export function resolveBackupHome() {
  const configured = process.env.DSH_HOME
  // 与 dsh-home-paths 同一裁决：空串视同未设。
  return configured !== undefined && configured.trim() !== '' ? configured : join(homedir(), '.easel')
}

/**
 * Map persisted configuration onto the engine's destination config plus
 * resolved secrets; a missing secret for the active protocol is a 400.
 * @param {object} engine - The loaded backup engine module.
 * @param {object} config - Validated configuration.
 * @param {object} credentials - The credentials service.
 * @returns {Promise<object>} The destination seam.
 */
async function buildDestination(engine, config, credentials) {
  if (config.protocol === 'webdav') {
    const password = await readSecret(credentials, SECRET_IDS.webdavPassword)
    if (password === null) throw new ApiError(400, '缺少 WebDAV 密码，请先在设置里保存')
    return engine.createDestination(
      { protocol: 'webdav', endpoint: config.endpoint, username: config.username, remoteDir: config.remoteDir },
      { protocol: 'webdav', password },
    )
  }
  if (config.protocol === 's3') {
    const keys = await readSecret(credentials, SECRET_IDS.s3Keys)
    if (keys === null || typeof keys !== 'object' || typeof keys.accessKeyId !== 'string' || typeof keys.secretAccessKey !== 'string') {
      throw new ApiError(400, '缺少 S3 访问密钥，请先在设置里保存')
    }
    return engine.createDestination(
      { protocol: 's3', endpoint: config.endpoint, region: config.region, bucket: config.bucket, pathStyle: config.pathStyle },
      { protocol: 's3', accessKeyId: keys.accessKeyId, secretAccessKey: keys.secretAccessKey },
    )
  }
  return engine.createDestination({ protocol: 'smb', root: config.root }, { protocol: 'smb' })
}

/** Groups the user has checked, in stable order. */
const enabledGroups = config => BACKUP_GROUP_IDS.filter(id => config.groups[id])

/** @returns {Promise<object>} The engine module, or an ApiError(500) rejection. */
function loadEngine(injected) {
  if (injected !== null) return Promise.resolve(injected)
  return import('@deepseek-ai/dsh-easel-backup').catch(error => {
    throw new ApiError(500, `备份引擎不可用：请重新安装 Easel（加载 @deepseek-ai/dsh-easel-backup 失败：${error.message}）`)
  })
}

/** The config document path for one deployment. */
const configPath = settings => join(settings.projectRoot, 'outputs', BACKUP_CONFIG_FILE)
/** The history document path for one deployment. */
const historyPath = settings => join(settings.projectRoot, 'outputs', BACKUP_HISTORY_FILE)

/**
 * Read the persisted configuration, normalized.
 * @param {object} settings - Deployment settings.
 * @returns {Promise<object>} The normalized configuration.
 */
export async function readBackupConfig(settings) {
  return normalizeBackupConfig(await readJsonFile(configPath(settings), null))
}

/**
 * Read the backup history, newest first.
 * @param {object} settings - Deployment settings.
 * @returns {Promise<Array>} The history entries.
 */
export async function readBackupHistory(settings) {
  const doc = await readJsonFile(historyPath(settings), null)
  return doc !== null && Array.isArray(doc.entries) ? doc.entries : []
}

async function appendHistory(settings, entry) {
  const entries = await readBackupHistory(settings)
  entries.unshift(entry)
  await writeJsonFile(historyPath(settings), { version: 1, entries: entries.slice(0, 50) })
}

/** UI summary of one verified restore plan; never includes target paths wholesale. */
function summarizePlan(plan) {
  return {
    group: plan.group,
    stamp: plan.stamp,
    createdAt: plan.manifest.createdAt,
    fileCount: plan.files.length,
    bytes: plan.files.reduce((sum, file) => sum + file.size, 0),
    skipped: plan.skipped.length,
    preview: plan.files.slice(0, 30).map(file => ({ path: file.path, size: file.size })),
  }
}

/**
 * Build the backup feature: route table, run/restore state, and the catch-up
 * tick. One instance per plugin mount; backup and restore share one busy flag
 * so they can never interleave.
 * @param {object} deps - Injected services and helpers.
 * @param {object} deps.settings - Deployment settings (projectRoot).
 * @param {object} deps.credentials - The credentials service.
 * @param {object} [deps.logger] - Logger with info/warn.
 * @param {object} [deps.engine] - Engine module override for tests; default lazy-imports the real package.
 * @param {() => number} [deps.now] - Clock override for tests.
 * @returns {{routes: Array, tick: () => Promise<void>, isBusy: () => boolean}} The feature surface.
 */
export function createBackupFeature({ settings, credentials, logger = null, engine: injectedEngine = null, now = Date.now }) {
  let busy = false
  let progress = null
  let pendingRestore = null
  let configQueue = Promise.resolve()

  /** Serialized read-modify-write over the config document. */
  function mutateConfig(mutator) {
    const run = configQueue.then(async () => {
      const config = await readBackupConfig(settings)
      const next = await mutator(config)
      await writeJsonFile(configPath(settings), next)
      return next
    })
    configQueue = run.catch(() => {})
    return run
  }

  /** @returns {Promise<object>} The loaded engine module. */
  const engine = () => loadEngine(injectedEngine)

  /**
   * Back up the requested groups serially. One history entry records the
   * whole run; `lastRunAt` moves on any completed run so catch-up does not
   * re-fire right after a manual backup. Claims `busy` synchronously, so two
   * callers can never both pass the gate before the first await.
   * @param {string[]} groups - Group ids to back up.
   * @param {string} trigger - 'manual' or 'schedule'.
   * @returns {Promise<Array>} Per-group run results.
   */
  async function runGroups(groups, trigger) {
    if (busy) throw new ApiError(409, '备份或恢复正在进行中')
    if (groups.length === 0) throw new ApiError(400, '没有勾选任何备份内容')
    busy = true
    progress = null
    return executeRun(groups, trigger, now())
  }

  /**
   * Run the whole backup with `busy` already claimed; history and lastRunAt
   * bookkeeping live here so both the awaited and detached entry points share
   * one failure story.
   * @param {string[]} groups - Group ids to back up.
   * @param {string} trigger - 'manual' or 'schedule'.
   * @param {number} startedAt - Run start in epoch milliseconds.
   * @returns {Promise<Array>} Per-group run results.
   */
  async function executeRun(groups, trigger, startedAt) {
    try {
      const engineModule = await engine()
      const config = await readBackupConfig(settings)
      validateBackupConfig(config)
      const destination = await buildDestination(engineModule, config, credentials)
      const roots = { home: resolveBackupHome(), workspace: settings.projectRoot }
      const passphrase = config.encryption.enabled ? await readSecret(credentials, SECRET_IDS.passphrase) : null
      const results = []
      for (const group of groups) {
        results.push(await engineModule.runBackupGroup({
          destination,
          roots,
          group,
          remoteDir: config.remoteDir,
          retention: config.retention,
          encryption: { enabled: config.encryption.enabled, passphrase: passphrase ?? undefined },
          stagingDir: join(roots.home, 'cache', 'backup-staging'),
          onProgress: event => {
            progress = event
          },
        }))
      }
      await mutateConfig(current => ({ ...current, lastRunAt: now() }))
      await appendHistory(settings, {
        startedAt,
        finishedAt: now(),
        trigger,
        status: 'completed',
        groups: results.map(result => ({
          group: result.group,
          stamp: result.stamp,
          fileCount: result.fileCount,
          totalBytes: result.totalBytes,
          durationMs: result.durationMs,
          pruned: result.pruned.length,
        })),
      })
      return results
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error?.message ?? String(error))
      await appendHistory(settings, { startedAt, finishedAt: now(), trigger, status: 'failed', error: message, groups: [] }).catch(() => {})
      throw error
    } finally {
      busy = false
      progress = null
    }
  }

  async function apiConfigGet() {
    let engineReady = true
    try {
      await engine()
    } catch {
      engineReady = false
    }
    return {
      json: {
        config: await readBackupConfig(settings),
        secrets: await hasSecrets(credentials),
        engineReady,
      },
    }
  }

  async function apiConfigPut(c) {
    const body = await c.body()
    const incoming = body?.config
    if (incoming === null || typeof incoming !== 'object') throw new ApiError(400, '缺少配置对象')
    const config = normalizeBackupConfig(incoming)
    validateBackupConfig(config)
    const secrets = typeof body?.secrets === 'object' && body.secrets !== null ? body.secrets : {}
    if (secrets.webdavPassword !== undefined) {
      if (secrets.webdavPassword === '') throw new ApiError(400, 'WebDAV 密码不能是空字符串')
      await writeSecret(credentials, SECRET_IDS.webdavPassword, secrets.webdavPassword ?? null)
    }
    if (secrets.smbPassword !== undefined) {
      if (secrets.smbPassword === '') throw new ApiError(400, 'SMB 密码不能是空字符串')
      await writeSecret(credentials, SECRET_IDS.smbPassword, secrets.smbPassword ?? null)
    }
    if (secrets.passphrase !== undefined) {
      if (secrets.passphrase === '') throw new ApiError(400, '加密口令不能是空字符串')
      await writeSecret(credentials, SECRET_IDS.passphrase, secrets.passphrase ?? null)
    }
    if (secrets.s3AccessKeyId !== undefined || secrets.s3SecretAccessKey !== undefined) {
      if (typeof secrets.s3AccessKeyId !== 'string' || secrets.s3AccessKeyId === '' || typeof secrets.s3SecretAccessKey !== 'string' || secrets.s3SecretAccessKey === '') {
        throw new ApiError(400, 'S3 访问密钥需要成对提供且不能为空')
      }
      await writeSecret(credentials, SECRET_IDS.s3Keys, { accessKeyId: secrets.s3AccessKeyId, secretAccessKey: secrets.s3SecretAccessKey })
    }
    await mutateConfig(() => config)
    return { json: { config, secrets: await hasSecrets(credentials) } }
  }

  async function apiTest(c) {
    if (busy) throw new ApiError(409, '备份或恢复正在进行中')
    const engineModule = await engine()
    const config = await readBackupConfig(settings)
    validateBackupConfig(config)
    const destination = await buildDestination(engineModule, config, credentials)
    try {
      await destination.probe()
    } catch (error) {
      throw new ApiError(502, `目标端不可用：${error.message}`)
    }
    return { json: { ok: true } }
  }

  async function apiRun(c) {
    const body = await c.body()
    if (busy) throw new ApiError(409, '备份或恢复正在进行中')
    const requested = Array.isArray(body?.groups) && body.groups.length > 0 ? body.groups : enabledGroups(await readBackupConfig(settings))
    if (requested.length === 0) throw new ApiError(400, '没有勾选任何备份内容')
    for (const group of requested) {
      if (!BACKUP_GROUP_IDS.includes(group)) throw new ApiError(400, `未知备份组：${String(group)}`)
    }
    // 引擎、配置与目标端在这里先行构建一次：缺密钥、配置不合法等快速失败直
    // 接回给前端，不等 detached 的整场备份把错误写进历史。
    const engineModule = await engine()
    const config = await readBackupConfig(settings)
    validateBackupConfig(config)
    await buildDestination(engineModule, config, credentials)
    // busy 在这里同步占位：并发请求在首个 await 前就会被 409 挡下。
    busy = true
    progress = null
    executeRun(requested, 'manual', now()).catch(() => {})
    return { json: { started: true, groups: requested } }
  }

  async function apiStatus() {
    const config = await readBackupConfig(settings)
    return {
      json: {
        busy,
        progress,
        lastRunAt: config.lastRunAt,
        enabledGroups: enabledGroups(config),
        history: (await readBackupHistory(settings)).slice(0, 20),
      },
    }
  }

  async function apiRemote() {
    const engineModule = await engine()
    const config = await readBackupConfig(settings)
    const destination = await buildDestination(engineModule, config, credentials)
    const backups = await engineModule.listBackups(destination, config.remoteDir)
    const groups = {}
    for (const id of BACKUP_GROUP_IDS) groups[id] = []
    for (const backup of backups) {
      groups[backup.group]?.push({ stamp: backup.stamp, size: backup.size, key: backup.key })
    }
    return { json: { groups } }
  }

  async function planFor(engineModule, config, group, stamp) {
    const roots = { home: resolveBackupHome(), workspace: settings.projectRoot }
    const passphrase = await readSecret(credentials, SECRET_IDS.passphrase)
    return engineModule.planRestore({
      destination: await buildDestination(engineModule, config, credentials),
      remoteDir: config.remoteDir,
      roots,
      group,
      stamp,
      stagingDir: join(roots.home, 'cache', 'backup-restore'),
      passphrase: passphrase ?? undefined,
    })
  }

  async function apiRestore(c) {
    const body = await c.body()
    const group = body?.group
    const stamp = body?.stamp
    if (!BACKUP_GROUP_IDS.includes(group)) throw new ApiError(400, `未知备份组：${String(group)}`)
    if (typeof stamp !== 'string' || !STAMP_PATTERN.test(stamp)) throw new ApiError(400, '备份时间戳格式不正确')
    if (busy) throw new ApiError(409, '备份或恢复正在进行中')
    busy = true
    try {
      const engineModule = await engine()
      const config = await readBackupConfig(settings)
      if (body?.confirm !== true) {
        if (pendingRestore !== null) await engineModule.discardRestore(pendingRestore).catch(() => {})
        const plan = await planFor(engineModule, config, group, stamp)
        pendingRestore = plan
        return { json: { plan: summarizePlan(plan) } }
      }
      const plan = pendingRestore !== null && pendingRestore.group === group && pendingRestore.stamp === stamp
        ? pendingRestore
        : await planFor(engineModule, config, group, stamp)
      pendingRestore = null
      const outcome = await engineModule.applyRestore(plan)
      return { json: { applied: outcome.applied, skipped: outcome.skipped } }
    } finally {
      busy = false
    }
  }

  async function apiConnectSmb(c) {
    const body = await c.body()
    if (process.platform !== 'win32') {
      throw new ApiError(400, 'SMB 凭据接线仅支持 Windows；macOS 请先在访达里连接服务器（⌘K）挂载共享')
    }
    const root = String(body?.root ?? '').trim()
    if (!root.startsWith('\\\\')) throw new ApiError(400, 'SMB 路径必须是 \\\\server\\share 形式')
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')
    if (username !== '' && password === '') throw new ApiError(400, '填写了用户名时需要同时填写密码')
    // net use 没有 stdin 口令通道，密码只能走参数行——本机进程列表可见，这是
    // Windows SMB 接线的已知上限；系统提示符弹窗方案需 UI 另起交互。
    const args = username === '' ? [root, '/persistent:yes'] : [root, password, `/user:${username}`, '/persistent:yes']
    try {
      await execFileP('net', args, { timeout: 30_000, windowsHide: true })
    } catch (error) {
      const detail = String(error.stderr ?? error.message ?? '').trim()
      throw new ApiError(502, `net use 失败：${detail || '未知错误'}`)
    }
    return { json: { ok: true } }
  }

  /**
   * Catch-up tick: run the checked groups once when the schedule crossed a
   * slot while the app was closed. Never re-enters while busy; engine and
   * config problems are logged, not thrown — the tick is background work.
   * @returns {Promise<void>} Resolves after the check (and any catch-up run).
   */
  async function tick() {
    if (busy) return
    const config = await readBackupConfig(settings)
    if (config.schedule.mode === 'off') return
    const engineModule = await engine().catch(error => {
      logger?.warn?.(`easel-backup: 备份引擎不可用，跳过定时检查：${error.message}`)
      return null
    })
    if (engineModule === null) return
    let due = false
    try {
      due = engineModule.computeDue(config.schedule, config.lastRunAt, now())
    } catch (error) {
      logger?.warn?.(`easel-backup: 定时配置不合法，跳过定时检查：${error.message}`)
      return
    }
    if (!due) return
    const groups = enabledGroups(config)
    if (groups.length === 0) return
    await runGroups(groups, 'schedule').catch(error => {
      logger?.warn?.(`easel-backup: 定时备份失败：${error.message}`)
    })
  }

  const routes = [
    ['GET', ['backup', 'config'], () => apiConfigGet()],
    ['PUT', ['backup', 'config'], c => apiConfigPut(c)],
    ['POST', ['backup', 'test'], () => apiTest()],
    ['POST', ['backup', 'run'], c => apiRun(c)],
    ['GET', ['backup', 'status'], () => apiStatus()],
    ['GET', ['backup', 'remote'], () => apiRemote()],
    ['POST', ['backup', 'restore'], c => apiRestore(c)],
    ['POST', ['backup', 'connect-smb'], c => apiConnectSmb(c)],
  ]

  return { routes, tick, isBusy: () => busy }
}

export const name = 'easel-backup'
export const inject = ['easelApi', 'credentials']

/**
 * Mount the backup feature: register its routes into the core easelApi
 * registry and start the catch-up scheduler. The registry's own settings
 * (projectRoot) feed the config path, exactly like the request handlers see.
 * @param {object} ctx - The cordis context.
 */
export function apply(ctx) {
  const feature = createBackupFeature({
    settings: ctx.easelApi.settings,
    credentials: ctx.credentials,
    logger: ctx.logger,
  })
  ctx.effect(() => ctx.easelApi.register(feature.routes), 'easel-backup: routes')
  ctx.effect(() => {
    const tick = () => {
      feature.tick().catch(error => ctx.logger?.warn?.(`easel-backup: 定时检查失败：${error.message}`))
    }
    // 启动即补跑一次错过的定时，然后每 15 分钟检查一次。
    tick()
    const timer = setInterval(tick, 15 * 60_000)
    timer.unref?.()
    return () => {
      clearInterval(timer)
    }
  }, 'easel-backup: catch-up scheduler')
  ctx.logger?.info?.('easel-backup: 备份路由与定时器已挂载')
}
