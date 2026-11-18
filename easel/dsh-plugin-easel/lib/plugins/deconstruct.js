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
import { createDeconstruct, DeconstructBusyError, deconstructBusy, readDeconstruct, resumeDeconstruct } from '../deconstruct.js'
import { parsePlatform, sourceStatus, writeCookie } from '../sourcedata.js'
import { detectWeChat, downloaderRunning, findChannelsTool, launchChannelsTool } from '../channels.js'
import {
  EnvToolError, checkEnvTools, envInstallStatus, envToolsBinDir, requiresYtDlp, resolveEnvTool, startEnvToolInstall,
} from '../env-tools.js'
import {
  ApiError, isDirectory, isFile, personaDir, readEnvFile, readJsonFile, validPersonaName, writeJsonFile,
} from '../../index.js'
import { SHARED_SCRIPTS, accountBrowserArgs, loadRegistry, resolveAccountStrict, runCapture, runnerEnv } from './automation.js'

// ---- 语音转字幕（POST /easel/api/asr：ffmpeg 分段 + mimo ASR；核心在 lib/asr.js）----

// dsh webServer 端口（apply 时捕获；技能经 outputs/_easel_api.json 发现 base）。
let webServerPort = null

// 环境探测的注入缝（仅测试覆写）：宿主装没装 ffmpeg 不该决定路由测试的
// 走向，测试把 spawnSync 换成恒成功桩；生产永远走默认的真探测。
export const envToolProbeDeps = { current: {} }

/** 平台所需的自动装配工具：ffmpeg/ffprobe 恒需；yt-dlp 仅走通用下载的平台。 */
function requiredEnvTools(platform) {
  return requiresYtDlp(platform) ? ['ffmpeg', 'yt-dlp'] : ['ffmpeg']
}

/**
 * 解析 ffmpeg 家族两个可执行文件的绝对路径（PATH 优先、tools/bin 兜底）。
 * 未就绪时抛 400，文案指回拆解页的自动下载。
 */
function resolveFfmpegBins(settings, deps = {}) {
  const resolved = resolveEnvTool(settings, 'ffmpeg', deps)
  if (!resolved.installed) {
    throw new ApiError(400, '运行环境未就绪：ffmpeg/ffprobe 缺失。回到拆解页点「开始采集」会自动下载安装')
  }
  return { ffmpegBin: resolved.bins.ffmpeg.path, ffprobeBin: resolved.bins.ffprobe.path }
}

/** 下载子进程的环境注入：tools/bin 前插 PATH（video_fetch 的 yt-dlp 解析）。 */
function envToolsFetchEnv(settings) {
  const binDir = envToolsBinDir(settings)
  if (!existsSync(binDir)) return {}
  return { PATH: `${binDir}${sep}${process.env.PATH ?? ''}` }
}

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
  await writeApiDiscovery(c.settings.projectRoot, webServerPort, c.settings.basePath, c.settings.runnerToken).catch(() => {})
  // 凭据：技能路由保持环境变量 / 项目 .env（进程环境优先）；拆解任务可带
  // provider::model 走 dsh 模型管理凭据（见 deconstructTranscribe）。
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
    const { ffmpegBin, ffprobeBin } = resolveFfmpegBins(c.settings, envToolProbeDeps.current)
    const result = await transcribeToSubtitle({
      input,
      format,
      language,
      projectRoot: c.settings.projectRoot,
      credentials,
      ffmpegBin,
      ffprobeBin,
    })
    return { json: { file: result.file, segments: result.segments, seconds: result.seconds } }
  } catch (error) {
    if (error instanceof AsrError) throw new ApiError(error.status, error.message)
    throw error
  }
}

// ---- 拆解采集（spec easel-breakdown-fullpage：宿主直驱 下载→抽帧→ASR，状态落 job.json）----

// 宿主 cordis 上下文（apply 时捕获）：`provider::model` 的凭据从这里解析。
let hostCtx = null

/**
 * 从 dsh 模型管理解析一个服务商路由下的 ASR 凭据，与「设置→模型」同一注册表：
 * 路由表来自 `ctx.llm`，Base URL 读自 settings 命名空间的服务商 profile
 * （缺省回退路由 `defaultBaseURL`），`apiKeyEnv` 同读自该 profile，密钥经
 * `ctx.credentials` 解析（与 session-controller 的
 * modelCatalog / hasProviderApiKey 同一条读取链）。
 * @param ctx - 宿主 cordis 上下文；缺 llm/settings/credentials 的部署返回失败。
 * @param providerId - 模型目录的 provider 组 id（llm 路由键）。
 * @param modelId - 该路由下的模型 id，原样作为 ASR 请求的 model。
 * @returns `{ ok: true, credentials }`（`credentials` 即 transcribeToSubtitle 的
 *   `{ apiKey, baseUrl, model }`）或 `{ ok: false, reason }`（面向用户的失败原因）。
 */
export async function resolveDshAsrCredentials(ctx, providerId, modelId) {
  const llm = ctx?.get?.('llm')
  const settings = ctx?.get?.('settings')
  const credentials = ctx?.get?.('credentials')
  if (llm === undefined || settings === undefined || credentials === undefined) {
    return { ok: false, reason: '宿主未提供模型管理服务（llm/settings/credentials）' }
  }
  const route = llm.listConfigurableProviders().find(row => row.provider === providerId)
  if (route === undefined) return { ok: false, reason: `服务商「${providerId}」不在模型管理目录中` }
  let profile = settings.describe({ redactSecrets: true }).find(row => row.ns === route.settingsNs)?.value
  for (const key of route.settingsPath) {
    profile = typeof profile === 'object' && profile !== null ? Reflect.get(profile, key) : undefined
  }
  if (typeof profile !== 'object' || profile === null) {
    return { ok: false, reason: `服务商「${providerId}」尚未配置` }
  }
  const ref = profile.apiKeyEnv
  const resolved = typeof ref === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)
    ? await credentials.resolve(ref)
    : undefined
  if (typeof resolved?.value !== 'string' || resolved.value === '') {
    return { ok: false, reason: `服务商「${providerId}」的 API Key 未配置` }
  }
  // profile 没写 baseURL 时回退路由默认端点，与适配器自身行为一致
  // （如 xiaomi 出厂即 https://api.xiaomimimo.com/v1）。
  const baseUrl = String(profile.baseURL ?? route.defaultBaseURL ?? '').trim().replace(/\/+$/, '')
  if (baseUrl === '') return { ok: false, reason: `服务商「${providerId}」未配置 Base URL` }
  return { ok: true, credentials: { apiKey: resolved.value, baseUrl, model: modelId } }
}

/**
 * 组装一次带模型覆盖的转写闭包。`provider::model`（拆解页模型目录的选择）走
 * dsh 模型管理凭据；裸 model id（在途旧任务）保持既有 MIMO_* env 路径。
 */
function deconstructTranscribe(c) {
  return async ({ input, format, projectRoot, model, outDir, outStem }) => {
    // ffmpeg 路径每段解析一次（PATH 优先、tools/bin 兜底）；缺了直接落 job.failed。
    const { ffmpegBin, ffprobeBin } = resolveFfmpegBins(c.settings, envToolProbeDeps.current)
    const split = typeof model === 'string' ? model.indexOf('::') : -1
    if (split > 0) {
      const resolved = await resolveDshAsrCredentials(hostCtx, model.slice(0, split), model.slice(split + 2))
      if (!resolved.ok) {
        throw new Error(`无法用所选模型 ${model} 转写：${resolved.reason}（可在 设置→模型 处理，或改选其他模型）`)
      }
      return transcribeToSubtitle({
        input, format, projectRoot, credentials: resolved.credentials, outDir, outStem, ffmpegBin, ffprobeBin,
      })
    }
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
    return transcribeToSubtitle({
      input, format, projectRoot, credentials, outDir, outStem, ffmpegBin, ffprobeBin,
    })
  }
}

async function apiDeconstructCreate(c) {
  const body = await c.body()
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) throw new ApiError(400, '缺少 url：请贴视频链接（抖音/小红书/B站/…）')
  if (deconstructBusy(c.settings.projectRoot)) {
    throw new ApiError(409, '已有拆解采集在运行，请等它完成或失败后再开始')
  }
  // persona（spec easel-breakdown-persona-push §S2.1）：拆解归属画像，进 job.json
  // 供审计与选题卡写入；名字必须指向真实画像目录，误配在这里响。
  const persona = typeof body?.persona === 'string' ? body.persona.trim() : ''
  if (persona !== '') {
    const { dir } = personaDir(c.settings, persona)
    if (!validPersonaName(persona) || !(await isDirectory(dir))) {
      throw new ApiError(404, `画像「${persona}」不存在`)
    }
  }
  // 运行环境守卫（spec easel-breakdown-env-bootstrap）：preflight 与 create 之间
  // 可能隔了手动删目录等变化，create 再查一次，缺失直接 400（fail loud）。
  const platform = parsePlatform(url)
  const envGate = checkEnvTools(c.settings, requiredEnvTools(platform), envToolProbeDeps.current)
  const missingTools = envGate.tools.filter(tool => !tool.installed).map(tool => tool.id)
  if (missingTools.length > 0) {
    throw new ApiError(400, `运行环境未就绪：缺少 ${missingTools.join('、')}。回到拆解页点「开始采集」会自动下载安装`)
  }
  // 视频号（spec easel-breakdown-channels）：识别到 sph 才触碰微信检测——
  // 启动采集前守卫微信登录（用户拍板），并把下载器 staging 目录注入下载子进程。
  // tools/bin 无论平台都前插 PATH：yt-dlp（通用平台）与 skills 侧二进制同源解析。
  const fetchEnv = {
    ...(platform === 'sph' ? { EASEL_CHANNELS_DIR: (await ensureChannelsReady(c)).stagingDir } : {}),
    ...envToolsFetchEnv(c.settings),
  }
  const job = createDeconstruct({
    projectRoot: c.settings.projectRoot,
    url,
    asrModel: typeof body?.asrModel === 'string' ? body.asrModel : undefined,
    persona: persona !== '' ? persona : undefined,
    transcribe: deconstructTranscribe(c),
    fetchEnv,
    ffmpegBin: resolveEnvTool(c.settings, 'ffmpeg', envToolProbeDeps.current).bins.ffmpeg.path,
  })
  return { json: job }
}

async function apiDeconstructGet(c) {
  const job = await readDeconstruct(c.settings.projectRoot, c.params.id)
  if (job === undefined) throw new ApiError(404, `拆解任务不存在：${c.params.id}`)
  return { json: job }
}

// 断点续跑（spec easel-upstream-adoptions S2.1）：以 job.json 为检查点，只补
// 缺失段；响应形状与 POST deconstruct 一致（续跑启动时的 job 快照）。
async function apiDeconstructRetry(c) {
  const existing = await readDeconstruct(c.settings.projectRoot, c.params.id)
  if (existing === undefined) throw new ApiError(404, `拆解任务不存在：${c.params.id}`)
  // 环境守卫与 create 同强（重试可能重跑 fetch/frames/asr 任意段）。
  const platform = parsePlatform(existing.url)
  const envGate = checkEnvTools(c.settings, requiredEnvTools(platform), envToolProbeDeps.current)
  const missingTools = envGate.tools.filter(tool => !tool.installed).map(tool => tool.id)
  if (missingTools.length > 0) {
    throw new ApiError(400, `运行环境未就绪：缺少 ${missingTools.join('、')}。回到拆解页点「开始采集」会自动下载安装`)
  }
  // 视频号任务的重试可能重跑 fetch 段：同样按平台注入 staging 目录（守卫同 create）。
  const fetchEnv = {
    ...(platform === 'sph' ? { EASEL_CHANNELS_DIR: (await ensureChannelsReady(c)).stagingDir } : {}),
    ...envToolsFetchEnv(c.settings),
  }
  let job
  try {
    job = await resumeDeconstruct(c.settings.projectRoot, c.params.id, deconstructTranscribe(c), fetchEnv,
      resolveEnvTool(c.settings, 'ffmpeg', envToolProbeDeps.current).bins.ffmpeg.path)
  } catch (error) {
    // busy 由 resumeDeconstruct 在占锁点同步抛出：检查到占锁之间没有 await，
    // 并发 retry 不会双双绕过 409。
    if (error instanceof DeconstructBusyError) {
      throw new ApiError(409, '已有拆解采集在运行，请等它完成或失败后再重试')
    }
    throw error
  }
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

// ---- 视频号 sidecar（spec easel-breakdown-channels）----
// 微信登录/下载器状态只在识别到视频号的链路上探测：preflight（识别步）只读，
// create/launch（启动采集）才允许拉起下载器；页面加载与插件启动不经过这里。

/** 视频号门控快照：微信运行/登录态 + 下载器安装/运行态（只读，不拉起进程）。 */
async function channelsSnapshot(c) {
  const [wechat, tool] = [await detectWeChat(), findChannelsTool(c.settings)]
  const running = tool.installed && await downloaderRunning()
  return { wechat, tool: { ...tool, running } }
}

/** create/launch 共用的启动守卫：已安装 → 微信已登录 → 拉起（未运行时）。 */
async function ensureChannelsReady(c) {
  const tool = findChannelsTool(c.settings)
  if (!tool.installed) {
    throw new ApiError(400, '未找到视频号下载器：把 wx_video_download 安装目录填入插件配置 '
      + 'channelsDownloader（首次使用请手动以管理员运行一次完成证书安装）')
  }
  const launched = await launchChannelsTool(c.settings)
  if (!launched.ok) throw new ApiError(400, launched.message)
  return tool
}

async function apiChannelsStatus(c) {
  return { json: await channelsSnapshot(c) }
}

async function apiChannelsLaunch(c) {
  const tool = await ensureChannelsReady(c)
  return { json: { ok: true, status: await channelsSnapshot(c), stagingDir: tool.stagingDir } }
}

// 拆解 preflight：按链接判平台；运行环境缺失先于登录门控拦下（首次使用
// 下载 spec easel-breakdown-env-bootstrap），登录/下载器门控其次。
async function apiDeconstructPreflight(c) {
  const body = await c.body()
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) throw new ApiError(400, '缺少 url')
  const platform = parsePlatform(url)
  // 运行环境快照（只读 -version 探测）：缺 ffmpeg/yt-dlp 时直接给门卡，
  // 页面据此自动下载，完成后重新走 create。
  const env = checkEnvTools(c.settings, requiredEnvTools(platform), envToolProbeDeps.current)
  if (!env.ready) {
    return { json: { platform, blocked: true, blockedReason: 'env', row: null, env } }
  }
  // 视频号不走 cookies.json 门控：门在微信登录与下载器安装上（识别到才检测）。
  if (platform === 'sph') {
    const channels = await channelsSnapshot(c)
    const blocked = !channels.tool.installed || !channels.wechat.loggedIn
    return { json: { platform, blocked, row: null, channels, env } }
  }
  const status = await sourceStatus(c.settings.projectRoot)
  const row = status.platforms.find(item => item.platform === platform)
  const blocked = row !== undefined && row.authRequired && !row.cookieSet && !row.loggedIn
  return { json: { platform, blocked, row: row ?? null, env } }
}

// ── 运行环境自动装配（spec easel-breakdown-env-bootstrap）────────────────
// POST env/install 启动（校验同步、下载异步），GET env/install/status 轮询；
// 进度落数据根 tools/install-state.json，应用重启后改判 interrupted。

const ENV_INSTALLABLE = new Set(['ffmpeg', 'yt-dlp'])

async function apiEnvInstall(c) {
  const body = await c.body()
  const ids = Array.isArray(body?.tools) ? body.tools.filter(id => typeof id === 'string') : []
  const unknown = ids.filter(id => !ENV_INSTALLABLE.has(id))
  if (ids.length === 0 || unknown.length > 0) {
    throw new ApiError(400, `tools 无效：${unknown.join('、') || '(空)'}（可安装：ffmpeg、yt-dlp）`)
  }
  try {
    return { json: startEnvToolInstall(c.settings, ids) }
  } catch (error) {
    if (error instanceof EnvToolError) {
      throw new ApiError(error.code === 'busy' ? 409 : 400, error.message)
    }
    throw error
  }
}

async function apiEnvInstallStatus(c) {
  return { json: await envInstallStatus(c.settings) }
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
  // 从指定小红书账号（缺省默认账号）的登录态导出；直启窗口开着就附身，避免 profile 锁冲突。
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, 'xiaohongshu', typeof body?.account === 'string' ? body.account : '')
  if (account !== null) cmd.push(...await accountBrowserArgs(c.settings, account))
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
  ['GET', ['channels', 'status'], apiChannelsStatus],
  ['POST', ['channels', 'launch'], apiChannelsLaunch],
  ['POST', ['env', 'install'], apiEnvInstall],
  ['GET', ['env', 'install', 'status'], apiEnvInstallStatus],
  ['POST', ['deconstruct', 'preflight'], apiDeconstructPreflight],
  ['POST', ['deconstruct'], apiDeconstructCreate],
  ['GET', ['deconstruct', ':id'], apiDeconstructGet],
  ['POST', ['deconstruct', ':id', 'retry'], apiDeconstructRetry],
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
  hostCtx = ctx
  void writeApiDiscovery(ctx.easelApi.settings.projectRoot, webServerPort, ctx.easelApi.settings.basePath,
    ctx.easelApi.runnerToken)
    .catch(() => {})
  ctx.effect(() => ctx.easelApi.register(DECONSTRUCT_ROUTES), 'easel-deconstruct: routes')
  ctx.logger?.info?.('easel-deconstruct: breakdown pipeline mounted')
}
