// Host half: breakdown pipeline — media ASR, deconstruct jobs, source cookies.
// Split out of dsh-plugin-easel so the video pipeline can be enabled or fail on
// its own. Runner helpers come from the automation module (module-level
// utilities, not its fiber); routes register into the core easelApi service.
import { createReadStream, existsSync, closeSync, mkdirSync, openSync } from 'node:fs'
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { AsrError, transcribeToSubtitle, resolveMimoCredentials, writeApiDiscovery } from '../asr.js'
import { createDeconstruct, deconstructBusy, readDeconstruct } from '../deconstruct.js'
import { parsePlatform, sourceStatus, writeCookie } from '../sourcedata.js'
import {
  ApiError, isFile, readEnvFile, readJsonFile, writeJsonFile,
} from '../../index.js'
import { SHARED_SCRIPTS, runCapture, runnerEnv } from './automation.js'

// ---- 语音转字幕（POST /easel/api/asr：ffmpeg 分段 + mimo ASR；核心在 lib/asr.js）----

// dsh webServer 端口（apply 时捕获；技能经 outputs/_easel_api.json 发现 base）。
let webServerPort = null

async function apiAsr(c) {
  const body = await c.body()
  const rawPath = typeof body?.path === 'string' ? body.path.trim() : ''
  if (!rawPath) throw new ApiError(400, '缺少 path：请传音频/视频文件路径（相对项目根或绝对路径）')
  if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(rawPath)) throw new ApiError(400, '路径不允许包含 ..')
  const format = body?.format === undefined || body?.format === null || body?.format === ''
    ? 'srt' : String(body.format).trim().toLowerCase()
  if (!['srt', 'ass', 'txt', 'json'].includes(format)) {
    throw new ApiError(400, `format 仅支持 srt/ass/txt/json，收到：${format}`)
  }
  const language = typeof body?.language === 'string' && body.language.trim() ? body.language.trim() : undefined
  const input = resolve(c.settings.projectRoot, rawPath)
  if (!(await isFile(input))) throw new ApiError(404, `文件不存在：${rawPath}`)
  // 刷新技能侧发现文件（apply 时服务可能尚未绑定端口，调用时补写最准）。
  await writeApiDiscovery(c.settings.projectRoot, webServerPort, c.settings.basePath).catch(() => {})
  // 凭据：dsh 模型管理凭据插件侧读不到（本插件只注入 webServer）→ 环境变量 / 项目 .env（进程环境优先）。
  const env = await readEnvFile(join(c.settings.projectRoot, '.env'))
  for (const key of ['MIMO_API_KEY', 'MIMO_BASE_URL', 'MIMO_ASR_MODEL']) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  const credentials = resolveMimoCredentials(env)
  if (!credentials.apiKey) {
    throw new ApiError(400, '未配置 mimo ASR 凭据：请设置 MIMO_API_KEY（环境变量或项目 .env）；'
      + '可选 MIMO_BASE_URL / MIMO_ASR_MODEL（默认 https://api.xiaomimimo.com/v1 与 mimo-v2.5-asr）')
  }
  try {
    const result = await transcribeToSubtitle({
      input,
      format,
      language,
      projectRoot: c.settings.projectRoot,
      credentials,
    })
    return { json: { file: result.file, segments: result.segments, seconds: result.seconds } }
  } catch (error) {
    if (error instanceof AsrError) throw new ApiError(error.status, error.message)
    throw error
  }
}

// ---- 拆解采集（spec easel-breakdown-fullpage：宿主直驱 下载→抽帧→ASR，状态落 job.json）----

/** 组装一次带模型覆盖的转写闭包（凭据来源与 apiAsr 同一注册表）。 */
function deconstructTranscribe(c) {
  return async ({ input, format, projectRoot, model }) => {
    const env = await readEnvFile(join(c.settings.projectRoot, '.env'))
    for (const key of ['MIMO_API_KEY', 'MIMO_BASE_URL', 'MIMO_ASR_MODEL']) {
      if (process.env[key] !== undefined) env[key] = process.env[key]
    }
    const credentials = resolveMimoCredentials(env)
    if (model) credentials.model = model
    if (!credentials.apiKey) {
      throw new Error('未配置 mimo ASR 凭据：请设置 MIMO_API_KEY（环境变量或项目 .env）；'
        + '可选 MIMO_BASE_URL / MIMO_ASR_MODEL')
    }
    return transcribeToSubtitle({ input, format, projectRoot, credentials })
  }
}

async function apiDeconstructCreate(c) {
  const body = await c.body()
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) throw new ApiError(400, '缺少 url：请贴视频链接（抖音/小红书/B站/…）')
  if (deconstructBusy(c.settings.projectRoot)) {
    throw new ApiError(409, '已有拆解采集在运行，请等它完成或失败后再开始')
  }
  const job = createDeconstruct({
    projectRoot: c.settings.projectRoot,
    url,
    asrModel: typeof body?.asrModel === 'string' ? body.asrModel : undefined,
    transcribe: deconstructTranscribe(c),
  })
  return { json: job }
}

async function apiDeconstructGet(c) {
  const job = await readDeconstruct(c.settings.projectRoot, c.params.id)
  if (job === undefined) throw new ApiError(404, `拆解任务不存在：${c.params.id}`)
  return { json: job }
}

// 拆解数据源门控：各平台登录/cookie 状态（绝不回显 cookie 明文）与 cookie 写入
//（spec easel-breakdown-fullpage 设计增补：设置页表单 + BreakdownPage preflight 共用）。
async function apiSourceStatus(c) {
  return { json: await sourceStatus(c.settings.projectRoot) }
}

async function apiCookiesWrite(c) {
  const body = await c.body()
  const platform = typeof body?.platform === 'string' ? body.platform.trim() : ''
  if (!/^[a-z]{2,12}$/.test(platform)) throw new ApiError(400, 'platform 无效')
  const cookie = typeof body?.cookie === 'string' ? body.cookie : ''
  const changed = await writeCookie(c.settings.projectRoot, platform, cookie)
  return { json: { ok: true, changed, status: await sourceStatus(c.settings.projectRoot) } }
}

// 拆解 preflight：按链接判平台，需要登录态而当前没有时拒绝创建任务。
async function apiDeconstructPreflight(c) {
  const body = await c.body()
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) throw new ApiError(400, '缺少 url')
  const platform = parsePlatform(url)
  const status = await sourceStatus(c.settings.projectRoot)
  const row = status.platforms.find(item => item.platform === platform)
  const blocked = row !== undefined && row.authRequired && !row.cookieSet && !row.loggedIn
  return { json: { platform, blocked, row: row ?? null } }
}

// 从已登录的浏览器会话导出 cookie 写入拆解数据源（登录成功后的「回传」步）。
// 目前只有 xhs 需要（douyin 免登录，bili/youtube 公开页免登录）：dump-cookies
// 与 whoami 共用 profile 锁，输出单行 JSON；stdout 按「末个 { 起整行解析」。
async function apiCookiesImport(c) {
  const body = await c.body()
  const platform = typeof body?.platform === 'string' ? body.platform.trim() : ''
  if (platform !== 'xhs') throw new ApiError(400, `平台 ${platform || '(空)'} 无需导入 cookie（免登录）`)
  const cmd = [
    c.settings.python,
    join(SHARED_SCRIPTS(c.settings), 'xhs_publish.py'),
    'dump-cookies', '--no-proxy',
  ]
  const proc = await runCapture(cmd, { cwd: c.settings.projectRoot, env: await runnerEnv(c.settings), timeout: 120_000 })
  let cookie = ''
  let error = ''
  for (const line of proc.stdout.trim().split(/\r?\n/).reverse()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const d = JSON.parse(trimmed)
      cookie = typeof d.cookie === 'string' ? d.cookie : ''
      error = typeof d.error === 'string' ? d.error : ''
      break
    } catch { continue }
  }
  if (!cookie) {
    throw new ApiError(409, `未能从登录会话导出 cookie${error ? `：${error}` : ''}`)
  }
  await writeCookie(c.settings.projectRoot, 'xhs', cookie)
  return { json: { ok: true, imported: true, count: cookie.split(';').length, status: await sourceStatus(c.settings.projectRoot) } }
}
// ── Routes contributed by this plugin ───────────────────────────────────
export const DECONSTRUCT_ROUTES = [
  ['POST', ['asr'], apiAsr],
  ['GET', ['source-status'], apiSourceStatus],
  ['POST', ['cookies'], apiCookiesWrite],
  ['POST', ['cookies', 'import'], apiCookiesImport],
  ['POST', ['deconstruct', 'preflight'], apiDeconstructPreflight],
  ['POST', ['deconstruct'], apiDeconstructCreate],
  ['GET', ['deconstruct', ':id'], apiDeconstructGet],
]

export const name = 'easel-deconstruct'
/** The core plugin's route registry. */
export const inject = ['easelApi', 'webServer']

/**
 * Contribute this plugin's routes and refresh the skill-side API discovery file.
 * @param ctx - host context carrying easelApi and the web server.
 */
export function apply(ctx) {
  webServerPort = ctx.webServer?.port ?? null
  void writeApiDiscovery(ctx.easelApi.settings.projectRoot, webServerPort, ctx.easelApi.settings.basePath)
    .catch(() => {})
  ctx.effect(() => ctx.easelApi.register(DECONSTRUCT_ROUTES), 'easel-deconstruct: routes')
  ctx.logger?.info?.('easel-deconstruct: breakdown pipeline mounted')
}
