// Host half: platform automation — login runners, publishing, WeChat MP, analytics.
// Split out of dsh-plugin-easel so the workbench data API and the Python-runner
// fleet can be enabled, fail and be reasoned about independently. The route table
// registers into the core plugin's easelApi service; shared helpers are imported
// from the core module (no cycle: core never imports this file).
import { createReadStream, existsSync, closeSync, mkdirSync, openSync } from 'node:fs'
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import {
  ANALYTICS_PLATFORMS, ApiError, IMAGE_EXTS, LOGIN_RUNNERS, SCHEDULE_FILE, VIDEO_EXTS,
  isDirectory, isFile, pathStat,
  readEnvFile, readJsonFile, readRadarConfig, readStoreList, writeJsonFile,
} from '../../index.js'

async function accountLoggedIn(settings, platform, cfg) {
  const root = settings.projectRoot
  if (cfg.backend === 'biliup') return existsSync(join(root, 'cookies.json'))
  if (cfg.backend === 'wechat-oa') {
    // mp 后台会话优先；AppID 凭证兜底（B2 起宿主半直读凭证 YAML）。
    const mp = await readJsonFile(join(root, 'outputs', '_login', 'wechat-oa-mp.json'), null)
    if (mp !== null && typeof mp === 'object' && mp.state === 'success') return true
    return wechatHasCredentials(settings)
  }
  const status = await readJsonFile(join(root, 'outputs', '_login', `${platform}.json`), null)
  return status !== null && typeof status === 'object' && status.state === 'success'
}

async function apiAccounts(c) {
  const result = []
  for (const [platform, cfg] of Object.entries(LOGIN_RUNNERS)) {
    result.push({
      platform,
      name: cfg.name,
      backend: cfg.backend,
      supported: cfg.backend !== 'unsupported',
      loggedIn: await accountLoggedIn(c.settings, platform, cfg),
      note: '',
    })
  }
  return { json: result }
}

async function apiAnalyticsPlatforms(c) {
  const result = []
  for (const [platform, cfg] of Object.entries(LOGIN_RUNNERS)) {
    if (!ANALYTICS_PLATFORMS.has(platform)) continue
    result.push({ platform, name: cfg.name, loggedIn: await accountLoggedIn(c.settings, platform, cfg) })
  }
  return { json: result }
}

async function writeSmsCode(c, subdir, prefix) {
  const body = await c.body()
  const code = String(body?.code ?? '').replace(/\D/g, '')
  if (code.length < 4 || code.length > 8) throw new ApiError(400, '验证码应为 4-8 位数字')
  const dir = join(c.settings.projectRoot, 'outputs', subdir)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${prefix}.code`), code, 'utf8')
  return { json: { ok: true } }
}

async function apiLoginSms(c) {
  if (!(c.params.p in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  return writeSmsCode(c, '_login', c.params.p)
}

async function apiPublishStatus(c) {
  const platform = c.params.p
  if (!(platform in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  const raw = await readJsonFile(join(c.settings.projectRoot, 'outputs', '_publish', `${platform}.json`), null)
  const state = raw !== null && typeof raw === 'object' && typeof raw.state === 'string' ? raw.state : 'unknown'
  const message = raw !== null && typeof raw === 'object' && typeof raw.message === 'string' ? raw.message : ''
  return { json: { mode: 'publish', state, message } }
}

async function apiPublishSms(c) {
  if (!(c.params.p in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  return writeSmsCode(c, '_publish', c.params.p)
}

async function apiLogout(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  if (cfg.backend === 'wechat-oa') {
    // 清 AppID 凭证 + 停 mp 登录进程 + 删标记/二维码/日志 + 删 mp 浏览器会话。
    const deleted = []
    await wechatClearCredentials(c.settings)
    deleted.push('wechat-publisher.yaml:accounts.web')
    const mpProc = loginProcesses.get('wechat-oa-mp')
    if (mpProc !== undefined && mpProc.exitCode === null) {
      try { mpProc.kill() } catch { /* 已死 */ }
    }
    const loginDir = join(c.settings.projectRoot, 'outputs', '_login')
    for (const name of ['wechat-oa.json', 'wechat-oa.png', 'wechat-oa-mp.json', 'wechat-oa-mp.png', 'wechat-oa-mp.log']) {
      try {
        const file = join(loginDir, name)
        if (await isFile(file)) {
          await unlink(file)
          deleted.push(name)
        }
      } catch { /* 单个失败不挡其余 */ }
    }
    const profilesRoot = resolve(BROWSER_PROFILES())
    const mpdir = resolve(profilesRoot, 'WeixinMpProfile')
    if (mpdir.startsWith(profilesRoot + sep) && await isDirectory(mpdir)) {
      await rm(mpdir, { recursive: true, force: true })
      deleted.push('WeixinMpProfile')
    }
    clearWhoamiCache(platform)
    return { json: { ok: true, deleted } }
  }
  const deleted = []
  if (cfg.profile !== undefined) {
    const profilesRoot = resolve(join(homedir(), '.easel-browser-profiles'))
    const pdir = resolve(profilesRoot, cfg.profile)
    if (pdir.startsWith(profilesRoot + sep) && await isDirectory(pdir)) {
      await rm(pdir, { recursive: true, force: true })
      deleted.push(cfg.profile)
    }
  }
  if (cfg.backend === 'biliup') {
    const cookies = join(c.settings.projectRoot, 'cookies.json')
    if (existsSync(cookies)) {
      await unlink(cookies)
      deleted.push('cookies.json')
    }
  }
  const loginDir = join(c.settings.projectRoot, 'outputs', '_login')
  for (const suffix of ['.json', '.png', '-me.png', '.code']) {
    const file = join(loginDir, `${platform}${suffix}`)
    try {
      if (await isFile(file)) {
        await unlink(file)
        deleted.push(`${platform}${suffix}`)
      }
    } catch { /* 单个文件删不掉不挡其余 */ }
  }
  return { json: { ok: true, deleted } }
}

// ═══════════════════════════════════════════════════════════════════════
// Runner orchestration — absorption batch B2.
//
// Login / publish / analytics are driven by the SAME Python runner fleet the
// backend used (`skills/shared/scripts/*.py`), spawned as subprocesses and
// talked to through the file protocol (status JSON + QR png + one-time sms
// code file). The runners are the project's hard asset — they are kept
// verbatim; only the ~300 lines of spawn-and-poll orchestration moved here
// from web/app.py. `python` (+ playwright chromium for the browser runners)
// is therefore an explicit plugin dependency (settings.python).
// ═══════════════════════════════════════════════════════════════════════

export const SHARED_SCRIPTS = settings => join(settings.projectRoot, 'skills', 'shared', 'scripts')
const BROWSER_PROFILES = () => join(homedir(), '.easel-browser-profiles')
const WECHAT_SKILL_DIR = root => join(root, 'skills', 'openclaw', 'skill-wechat-publisher')
const WECHAT_SKILL_SCRIPTS = root => join(WECHAT_SKILL_DIR(root), 'scripts')

/** Live login/publish runner processes: platform key → ChildProcess. */
const loginProcesses = new Map()
/** whoami 真校验缓存（起 headless 浏览器，数秒）：platform → { at, data }。 */
const whoamiCache = new Map()
const WHOAMI_TTL_MS = 600_000
const MEDIA_REQUIRED = new Set(['xiaohongshu', 'douyin', 'kuaishou', 'weixin-channels', 'bilibili'])
const VIDEO_ONLY_PUBLISH = new Set(['douyin', 'weixin-channels', 'bilibili'])
const NO_PROXY_DEFAULT = 'localhost,127.0.0.1,10.*,*.xiaohongshu.com,*.devops.xiaohongshu.com,*.douyin.com,*.kuaishou.com,*.zhihu.com,*.bilibili.com,*.weixin.qq.com,*.qq.com'

/** 子进程环境：应用内代理（雷达设置）> EASEL_PROXY；publish 加禁自动记日历。 */
export async function runnerEnv(settings, { publish = false } = {}) {
  const env = { ...process.env, EASEL_ROOT: settings.projectRoot }
  // Windows 管道默认 GBK：runner 打印 emoji（✅ 等）直接 UnicodeEncodeError，
  // 状态文件中文也会按错编码落盘。强制 UTF-8，一处修全部 Python runner
  // （douyin_publish 扫码成功后打印即崩，2026-10-17 实证）。
  env.PYTHONUTF8 = '1'
  env.PYTHONIOENCODING = 'utf-8'
  const cfg = await readRadarConfig(settings)
  const proxy = (cfg.proxyEnabled ? cfg.proxyUrl : '') || process.env.EASEL_PROXY || ''
  env.EASEL_PROXY = proxy
  if (proxy) {
    if (env.http_proxy === undefined) env.http_proxy = proxy
    if (env.https_proxy === undefined) env.https_proxy = proxy
    if (env.no_proxy === undefined) env.no_proxy = NO_PROXY_DEFAULT
  }
  if (publish) env.EASEL_CALENDAR_AUTORECORD = '0'
  return env
}

/** 公众号 API 子进程 env：固定出口 IP 白名单语义（WECHAT_EGRESS_PROXY 或直连）。 */
async function wechatEnv(settings) {
  const env = await runnerEnv(settings, { publish: true })
  const wxHosts = ['api.weixin.qq.com', 'mp.weixin.qq.com']
  const egress = (process.env.WECHAT_EGRESS_PROXY ?? '').trim()
  if (egress) {
    env.http_proxy = env.https_proxy = env.HTTP_PROXY = env.HTTPS_PROXY = egress
    env.no_proxy = (env.no_proxy ?? '').split(',').filter(h => h && !wxHosts.some(w => h.includes(w))).join(',')
    env.NO_PROXY = env.no_proxy
  } else {
    env.no_proxy = env.no_proxy ? `${env.no_proxy},${wxHosts.join(',')}` : wxHosts.join(',')
    env.NO_PROXY = env.no_proxy
  }
  return env
}

/** Run one runner to completion, capturing output (parity of subprocess.run). */
export function runCapture(cmd, { cwd, env, timeout = 60_000 } = {}) {
  return new Promise(resolve => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const child = spawn(cmd[0], cmd.slice(1), { cwd, env, windowsHide: true })
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeout)
    child.stdout.on('data', chunk => { if (stdout.length < 1_000_000) stdout += chunk.toString('utf8') })
    child.stderr.on('data', chunk => { if (stderr.length < 1_000_000) stderr += chunk.toString('utf8') })
    child.on('error', error => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}`.trim(), timedOut })
    })
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr, timedOut })
    })
  })
}

/** Spawn a long-running login runner with stdout/stderr appended to its log file. */
function spawnRunner(settings, platform, cmd, env) {
  const loginDir = join(settings.projectRoot, 'outputs', '_login')
  mkdirSync(loginDir, { recursive: true })
  const fd = openSync(join(loginDir, `${platform}.log`), 'a')
  const child = spawn(cmd[0], cmd.slice(1), { cwd: settings.projectRoot, env, stdio: ['ignore', fd, fd], windowsHide: true })
  closeSync(fd)
  loginProcesses.set(platform, child)
  child.on('exit', () => { if (loginProcesses.get(platform) === child) loginProcesses.delete(platform) })
  return child
}

function clearWhoamiCache(platform) {
  whoamiCache.delete(platform)
}

/** 登录标记 outputs/_login/<p>.json（与 login_state.write_status 同格式，原子写）。 */
async function writeLoginMarker(settings, platform, state, message = '') {
  const dir = join(settings.projectRoot, 'outputs', '_login')
  await mkdir(dir, { recursive: true })
  await writeJsonFile(join(dir, `${platform}.json`), { state, message, qr: '', ts: Math.floor(Date.now() / 1000) })
}

async function loginStatusData(settings, platform) {
  const loginDir = join(settings.projectRoot, 'outputs', '_login')
  const data = { state: 'unknown', message: '' }
  const raw = await readJsonFile(join(loginDir, `${platform}.json`), null)
  if (raw !== null && typeof raw === 'object') {
    if (typeof raw.state === 'string') data.state = raw.state
    if (typeof raw.message === 'string') data.message = raw.message
  }
  const proc = loginProcesses.get(platform)
  if ((data.state === 'unknown' || data.state === 'starting') && proc !== undefined && proc.exitCode !== null) {
    data.state = 'error'
    data.message = `登录程序异常退出（退出码 ${proc.exitCode}），请查看 outputs/_login/${platform}.log`
  }
  const qrStat = await pathStat(join(loginDir, `${platform}.png`))
  if (qrStat !== null) {
    data.qr = `_login/${platform}.png`
    data.qrTs = Math.floor(qrStat.mtimeMs / 1000)
  } else {
    data.qr = ''
    data.qrTs = 0
  }
  return data
}

async function apiLoginStatus(c) {
  if (!(c.params.p in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  const s = await loginStatusData(c.settings, c.params.p)
  if (s.state === 'success') clearWhoamiCache(c.params.p)
  return { json: { mode: 'qr', ...s } }
}

const LOGIN_WAIT_STATES = new Set(['window_login', 'qr_ready', 'success', 'error', 'expired'])
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms) })

async function apiLoginStart(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  if (cfg.backend === 'wechat-oa') {
    // 公众号不走扫码：前端应改用凭证表单提交到 /api/accounts/{platform}/credentials。
    return { json: { mode: 'credentials', configured: await wechatHasCredentials(c.settings), message: '微信公众号请填写 AppID / AppSecret' } }
  }
  const body = await c.body()
  let mode = typeof body?.mode === 'string' && ['qr', 'manual', 'cdp'].includes(body.mode) ? body.mode : 'qr'
  const radar = await readRadarConfig(c.settings)
  if (mode === 'cdp' && cfg.backend === 'biliup') throw new ApiError(400, 'B站走 TV 端扫码 API，不支持 CDP/手动窗口模式')
  const loginDir = join(c.settings.projectRoot, 'outputs', '_login')
  await mkdir(loginDir, { recursive: true })
  for (const name of [`${platform}.png`, `${platform}.json`]) {
    try { await unlink(join(loginDir, name)) } catch { /* 本来就不在 */ }
  }
  const modeArgs = mode === 'manual' ? ['--headed'] : mode === 'cdp' ? ['--cdp', radar.cdpEndpoint] : []
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  const timeout = 240
  let cmd
  if (cfg.backend === 'xhs') {
    cmd = [py, join(scripts, 'xhs_publish.py'), 'login', '--no-proxy', '--qr-out', join(loginDir, `${platform}.png`), '--status-file', join(loginDir, `${platform}.json`), '--timeout', String(timeout)]
  } else if (cfg.backend === 'biliup') {
    // B站：TV 端扫码登录 API 生成二维码 + 写 biliup cookie（biliup login 需真终端）。
    cmd = [process.execPath, join(scripts, 'bili_login.mjs'), 'login', '--qr-out', join(loginDir, `${platform}.png`), '--status-file', join(loginDir, `${platform}.json`), '--cookie', join(c.settings.projectRoot, 'cookies.json'), '--timeout', String(timeout)]
  } else if (cfg.backend === 'douyin') {
    try { await unlink(join(loginDir, `${platform}.code`)) } catch { /* 无旧码 */ }
    cmd = [py, join(scripts, 'douyin_publish.py'), 'login', '--qr-out', join(loginDir, `${platform}.png`), '--status-file', join(loginDir, `${platform}.json`), '--sms-code-file', join(loginDir, `${platform}.code`), '--timeout', String(timeout)]
  } else {
    cmd = [py, join(scripts, 'web_publisher.py'), 'login-qr', '--platform', cfg.wp, '--qr-out', join(loginDir, `${platform}.png`), '--status-file', join(loginDir, `${platform}.json`), '--timeout', String(timeout)]
  }
  cmd.push(...modeArgs)
  if (mode !== 'qr' && cfg.backend !== 'biliup') {
    // 手动/CDP 模式必须真开窗口或接管真浏览器：撤掉 QR 模式的 --no-proxy。
    cmd = cmd.filter(arg => arg !== '--no-proxy')
  }
  clearWhoamiCache(platform)
  spawnRunner(c.settings, platform, cmd, await runnerEnv(c.settings))
  for (let i = 0; i < 50; i++) {
    await sleep(500)
    const s = await loginStatusData(c.settings, platform)
    if (s.qr || LOGIN_WAIT_STATES.has(s.state)) return { json: { mode, ...s } }
  }
  return { json: { mode, ...(await loginStatusData(c.settings, platform)) } }
}

// ---- whoami（真校验，TTL 缓存）----

async function apiWhoami(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  if (cfg.backend === 'wechat-oa') {
    // 不起浏览器：以 mp 后台会话/AppID 配置判断，名字取配置账号名。
    return { json: { loggedIn: await accountLoggedIn(c.settings, platform, cfg), name: (await wechatWebAccount(c.settings)).name || '微信公众号', avatar: '' } }
  }
  const hit = whoamiCache.get(platform)
  if (hit !== undefined && Date.now() - hit.at < WHOAMI_TTL_MS) return { json: hit.data }
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  let cmd
  if (cfg.backend === 'biliup') {
    cmd = [process.execPath, join(scripts, 'bili_login.mjs'), 'whoami', '--cookie', join(c.settings.projectRoot, 'cookies.json')]
  } else if (cfg.backend === 'xhs') {
    cmd = [py, join(scripts, 'xhs_publish.py'), 'whoami', '--no-proxy']
  } else if (cfg.backend === 'douyin') {
    cmd = [py, join(scripts, 'douyin_publish.py'), 'whoami']
  } else {
    cmd = [py, join(scripts, 'web_publisher.py'), 'whoami', '--platform', cfg.wp]
  }
  const proc = await runCapture(cmd, { cwd: c.settings.projectRoot, env: await runnerEnv(c.settings), timeout: 150_000 })
  let data = { loggedIn: false, name: '', avatar: '' }
  let confident = false // 子进程正常跑出 JSON 且无 error 字段 = 可信结论
  for (const line of proc.stdout.trim().split(/\r?\n/).reverse()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const d = JSON.parse(trimmed)
      data = { loggedIn: Boolean(d.loggedIn), name: d.name || '', avatar: d.avatar || '' }
      confident = !d.error
      break
    } catch { continue }
  }
  if (!confident) {
    // 校验失败/无有效输出 → 不缓存、不删标记，返回「上次已知」登录态（读标记）。
    return { json: { loggedIn: await accountLoggedIn(c.settings, platform, cfg), name: '', avatar: '' } }
  }
  whoamiCache.set(platform, { at: Date.now(), data })
  if (cfg.backend !== 'biliup') {
    if (data.loggedIn) await writeLoginMarker(c.settings, platform, 'success', data.name || '')
    else { try { await unlink(join(c.settings.projectRoot, 'outputs', '_login', `${platform}.json`)) } catch { /* 不在 */ } }
  }
  return { json: data }
}

// ---- 公众号（wechat-oa）：mp 后台会话 + AppID 凭证（mini-YAML 读写）----

/** 公众号 mp 后台登录状态（文件由 weixin_mp_stats.py login 写）。 */
async function mpLoginStatusData(settings) {
  const loginDir = join(settings.projectRoot, 'outputs', '_login')
  const data = { state: 'unknown', message: '' }
  const raw = await readJsonFile(join(loginDir, 'wechat-oa-mp.json'), null)
  if (raw !== null && typeof raw === 'object') {
    if (typeof raw.state === 'string') data.state = raw.state
    if (typeof raw.message === 'string') data.message = raw.message
  }
  const proc = loginProcesses.get('wechat-oa-mp')
  if ((data.state === 'unknown' || data.state === 'starting') && proc !== undefined && proc.exitCode !== null) {
    data.state = 'error'
    data.message = `登录程序退出（码 ${proc.exitCode}），见 outputs/_login/wechat-oa-mp.log`
  }
  const qrStat = await pathStat(join(loginDir, 'wechat-oa-mp.png'))
  if (qrStat !== null) {
    data.qr = '_login/wechat-oa-mp.png'
    data.qrTs = Math.floor(qrStat.mtimeMs / 1000)
  } else {
    data.qr = ''
    data.qrTs = 0
  }
  return data
}

// ponytail: 只解析/生成 wechat-publisher.yaml 的「嵌套 dict + 标量」子集
// （yaml.safe_load/safe_dump 的产物），完整 YAML 解析器等真需要再上。
function parseMiniYaml(text) {
  const root = {}
  const stack = [{ indent: -1, obj: root }]
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ')
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = line.length - line.replace(/^ +/, '').length
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].obj
    if (value === '') {
      parent[key] = {}
      stack.push({ indent, obj: parent[key] })
    } else if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      parent[key] = value.slice(1, -1).replace(/''/g, "'")
    } else {
      parent[key] = value
    }
  }
  return root
}

function dumpMiniYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  const lines = []
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object') {
      lines.push(`${pad}${key}:`, ...dumpMiniYaml(value, indent + 1))
    } else {
      lines.push(`${pad}${key}: '${String(value ?? '').replace(/'/g, "''")}'`)
    }
  }
  return lines
}

async function wechatLoadConfig(settings) {
  try {
    return parseMiniYaml(await readFile(join(WECHAT_SKILL_DIR(settings.projectRoot), 'wechat-publisher.yaml'), 'utf8'))
  } catch {
    return {}
  }
}

async function wechatWebAccount(settings) {
  const cfg = await wechatLoadConfig(settings)
  const accounts = cfg.accounts !== null && typeof cfg.accounts === 'object' ? cfg.accounts : {}
  const account = accounts.web
  return account !== null && typeof account === 'object' ? account : {}
}

async function wechatHasCredentials(settings) {
  const acc = await wechatWebAccount(settings)
  return Boolean(acc.app_id && acc.app_secret)
}

async function wechatSaveCredentials(settings, { appId, appSecret, name, author }) {
  const cfg = await wechatLoadConfig(settings)
  if (cfg.accounts === null || typeof cfg.accounts !== 'object') cfg.accounts = {}
  const acc = cfg.accounts.web !== null && typeof cfg.accounts.web === 'object' ? cfg.accounts.web : {}
  acc.name = name || acc.name || '微信公众号'
  acc.app_id = appId
  acc.app_secret = appSecret
  if (author) acc.author = author
  if (acc.author === undefined) acc.author = ''
  cfg.accounts.web = acc
  if (cfg.default === undefined || cfg.default === '') cfg.default = 'web'
  const target = join(WECHAT_SKILL_DIR(settings.projectRoot), 'wechat-publisher.yaml')
  await mkdir(dirname(target), { recursive: true })
  const tmp = `${target}.tmp`
  await writeFile(tmp, `${dumpMiniYaml(cfg).join('\n')}\n`, 'utf8')
  await rename(tmp, target)
}

async function wechatClearCredentials(settings) {
  const cfg = await wechatLoadConfig(settings)
  if (cfg.accounts !== null && typeof cfg.accounts === 'object' && 'web' in cfg.accounts) {
    delete cfg.accounts.web
    if (cfg.default === 'web') cfg.default = Object.keys(cfg.accounts)[0] ?? ''
    try {
      const target = join(WECHAT_SKILL_DIR(settings.projectRoot), 'wechat-publisher.yaml')
      const tmp = `${target}.tmp`
      await writeFile(tmp, `${dumpMiniYaml(cfg).join('\n')}\n`, 'utf8')
      await rename(tmp, target)
    } catch { /* 配置写不回去就只删缓存 */ }
  }
  const scripts = WECHAT_SKILL_SCRIPTS(settings.projectRoot)
  for (const cache of ['.token_cache_web.json', '.token_cache.json']) {
    try { await unlink(join(scripts, cache)) } catch { /* 不在 */ }
  }
}

async function wechatVerifyToken(settings) {
  // 与 web/app.py _wechat_verify_token 同一段探测代码：调 skill 的官方 token 接口。
  const scripts = WECHAT_SKILL_SCRIPTS(settings.projectRoot)
  const code = [
    "import sys; sys.path.insert(0, r'" + scripts.replace(/'/g, "\\'") + "')",
    "from config import set_account",
    "from wechat_token import get_access_token",
    "set_account('web')",
    "try:",
    "    t = get_access_token(force_refresh=True)",
    "    print('OK' if t else 'EMPTY')",
    "except Exception as e:",
    "    print('ERR:' + str(e))",
  ].join('\n')
  const proc = await runCapture([settings.python, '-c', code], { cwd: scripts, env: await wechatEnv(settings), timeout: 30_000 })
  const lines = proc.stdout.trim().split(/\r?\n/).filter(part => part.trim())
  const last = lines[lines.length - 1] ?? ''
  if (last === 'OK') return { ok: true, message: '' }
  if (last.startsWith('ERR:')) return { ok: false, message: last.slice(4).trim().slice(0, 200) }
  const errLines = proc.stderr.trim().split(/\r?\n/).filter(part => part.trim())
  return { ok: false, message: (errLines[errLines.length - 1] ?? '验证失败').slice(0, 200) }
}

async function apiCredentialsGet(c) {
  const cfg = LOGIN_RUNNERS[c.params.p]
  if (cfg === undefined || cfg.backend !== 'wechat-oa') throw new ApiError(404, '该平台不使用凭证登录')
  const acc = await wechatWebAccount(c.settings)
  const appId = acc.app_id || ''
  return {
    json: {
      configured: Boolean(appId && acc.app_secret),
      appIdMasked: appId.length > 10 ? `${appId.slice(0, 6)}***${appId.slice(-4)}` : (appId ? '***' : ''),
      name: acc.name || '',
      author: acc.author || '',
    },
  }
}

async function apiCredentialsSave(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined || cfg.backend !== 'wechat-oa') throw new ApiError(404, '该平台不使用凭证登录')
  const body = await c.body()
  const appId = String(body?.appId ?? '')
  const appSecret = String(body?.appSecret ?? '')
  const name = String(body?.name ?? '').trim()
  const author = String(body?.author ?? '').trim()
  await wechatSaveCredentials(c.settings, { appId, appSecret, name, author })
  clearWhoamiCache(platform)
  const verdict = await wechatVerifyToken(c.settings)
  if (verdict.ok) {
    await writeLoginMarker(c.settings, platform, 'success', name || '微信公众号')
    return { json: { ok: true, message: '公众号凭证已保存并验证通过' } }
  }
  return { json: { ok: false, message: `凭证已保存但验证未通过：${verdict.message}。若是 40164 请把服务器出口 IP 加入公众号 IP 白名单。` } }
}

async function apiMpLoginStart(c) {
  const cfg = LOGIN_RUNNERS[c.params.p]
  if (cfg === undefined || cfg.backend !== 'wechat-oa') throw new ApiError(404, '该平台不使用公众号后台登录')
  // 重复点击复用正在进行的登录，不能删除其二维码或启动第二个 Chromium。
  const running = loginProcesses.get('wechat-oa-mp')
  if (running !== undefined && running.exitCode === null) return { json: { mode: 'qr', ...(await mpLoginStatusData(c.settings)) } }
  const loginDir = join(c.settings.projectRoot, 'outputs', '_login')
  await mkdir(loginDir, { recursive: true })
  for (const name of ['wechat-oa-mp.png', 'wechat-oa-mp.json']) {
    try { await unlink(join(loginDir, name)) } catch { /* 不在 */ }
  }
  const wxProxy = process.env.EASEL_PROXY || process.env.https_proxy || ''
  const cmd = [c.settings.python, join(SHARED_SCRIPTS(c.settings), 'weixin_mp_stats.py'), 'login',
    '--proxy', wxProxy, '--qr-out', join(loginDir, 'wechat-oa-mp.png'),
    '--status-file', join(loginDir, 'wechat-oa-mp.json'), '--timeout', '240']
  spawnRunner(c.settings, 'wechat-oa-mp', cmd, await runnerEnv(c.settings))
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    const s = await mpLoginStatusData(c.settings)
    if (s.qr || ['qr_ready', 'success', 'error', 'expired'].includes(s.state)) return { json: { mode: 'qr', ...s } }
  }
  return { json: { mode: 'qr', ...(await mpLoginStatusData(c.settings)) } }
}

async function apiMpLoginStatus(c) {
  const cfg = LOGIN_RUNNERS[c.params.p]
  if (cfg === undefined || cfg.backend !== 'wechat-oa') throw new ApiError(404, '该平台不使用公众号后台登录')
  return { json: { mode: 'qr', ...(await mpLoginStatusData(c.settings)) } }
}

// ---- 归因抓取（spawn runner，180s）----

async function apiAnalytics(c) {
  const platform = c.params.p
  if (!ANALYTICS_PLATFORMS.has(platform)) throw new ApiError(404, '该平台暂不支持数据抓取')
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  let cmd
  if (platform === 'bilibili') {
    cmd = [process.execPath, join(scripts, 'bili_login.mjs'), 'stats', '--cookie', join(c.settings.projectRoot, 'cookies.json')]
  } else if (platform === 'wechat-oa') {
    // 公众号走 mp 后台网页端（Playwright 拦数据 XHR）；默认直连，受限网络才需代理。
    const wxProxy = process.env.EASEL_PROXY || process.env.https_proxy || ''
    cmd = [py, join(scripts, 'weixin_mp_stats.py'), 'stats', '--proxy', wxProxy, '--count', '20']
  } else {
    // 代理策略由 account_stats.py 按平台自定（xhs 直连、其它走 env）。
    cmd = [py, join(scripts, 'account_stats.py'), 'fetch', '--platform', platform]
  }
  const proc = await runCapture(cmd, { cwd: c.settings.projectRoot, env: await runnerEnv(c.settings), timeout: 180_000 })
  for (const line of proc.stdout.trim().split(/\r?\n/).reverse()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try { return { json: JSON.parse(trimmed) } } catch { continue }
  }
  const tail = (proc.stderr || proc.stdout || '').trim().split(/\r?\n/).filter(part => part.trim())
  throw new ApiError(502, `未取到数据（可能未登录或平台改版）：${(tail[tail.length - 1] ?? '未取到数据').slice(0, 120)}`)
}

// ---- 发布（runner 保持 Python；抖音异步 + 短信码文件协议）----

async function appendPublishLog(settings, platform, tag, cmd, proc) {
  try {
    const lines = [
      '', `===== ${new Date().toLocaleString('zh-CN', { hour12: false })} ${platform}${tag} =====`,
      `CMD: ${cmd.join(' ')}`,
      'STDOUT:', (proc.stdout || '').slice(-2000), 'STDERR:', (proc.stderr || '').slice(-2000),
    ]
    await appendFile(join(settings.projectRoot, 'outputs', '_publish.log'), `${lines.join('\n')}\n`, 'utf8')
  } catch { /* 日志失败不挡发布 */ }
}

async function writePublishStatus(settings, platform, state, message = '') {
  const dir = join(settings.projectRoot, 'outputs', '_publish')
  await mkdir(dir, { recursive: true })
  await writeJsonFile(join(dir, `${platform}.json`), { state, message, ts: Math.floor(Date.now() / 1000) })
}

/** 抖音式异步发布的后台执行：脚本自写状态文件；结束后兜底补终态 + 日志 + 回流排期。 */
async function runPublishBg(settings, platform, cmd, title, body, cfg, codeFile) {
  const r = await runCapture(cmd, { cwd: settings.projectRoot, env: await runnerEnv(settings, { publish: true }), timeout: 900_000 })
  const ok = r.code === 0
  await appendPublishLog(settings, platform, '(async)', cmd, r)
  const detail = r.timedOut ? '发布超时（>900s）' : '\n'.join(((r.stderr || r.stdout || '').trim().split(/\r?\n/).filter(part => part.trim())).slice(-4))
  const current = await readJsonFile(join(settings.projectRoot, 'outputs', '_publish', `${platform}.json`), null)
  const currentState = current !== null && typeof current === 'object' ? current.state : 'unknown'
  if (currentState !== 'success' && currentState !== 'error') {
    await writePublishStatus(settings, platform, ok ? 'success' : 'error', ok ? '发布成功' : (detail || '发布失败'))
  }
  try { await unlink(codeFile) } catch { /* 不在 */ }
  if (ok) await recordPublishedSchedule(settings, title, cfg.name, body)
}

/** 成功发布回流排期（与 web/app.py 同 schema；脚本侧自动记录已由 EASEL_CALENDAR_AUTORECORD=0 关掉）。 */
async function recordPublishedSchedule(settings, title, platformName, body) {
  try {
    const items = await readStoreList(settings, SCHEDULE_FILE)
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    items.push({
      id: randomBytes(6).toString('hex'),
      title,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      platform: platformName,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      status: 'published',
      note: body.slice(0, 200),
      kind: 'content',
      source: 'publish-page',
    })
    await writeJsonFile(join(settings.projectRoot, 'outputs', SCHEDULE_FILE), items)
  } catch { /* 排期回流失败不挡发布结果 */ }
}

async function apiPublish(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  const body = await c.body()
  const reqTitle = String(body?.title ?? '')
  const reqBody = String(body?.body ?? '')
  const tags = String(body?.tags ?? '')
  const media = Array.isArray(body?.media) ? body.media : []
  if (!reqTitle.trim() && !reqBody.trim()) throw new ApiError(400, '标题/正文不能为空')
  const imgs = []
  const vids = []
  for (const rel of media) {
    const full = await safeOutputPath(c.settings, String(rel))
    const ext = extname(full).toLowerCase()
    if (VIDEO_EXTS.has(ext)) vids.push(full)
    else if (IMAGE_EXTS.has(ext)) imgs.push(full)
  }
  if (MEDIA_REQUIRED.has(platform) && imgs.length === 0 && vids.length === 0) {
    throw new ApiError(400, `${cfg.name} 需附带图片或视频`)
  }
  if (imgs.length > 0 && vids.length > 0) throw new ApiError(400, '同一条内容不能同时发图片和视频，请二选一')
  if (VIDEO_ONLY_PUBLISH.has(platform) && vids.length === 0) {
    throw new ApiError(400, `${cfg.name} 只能发视频，请附带一个视频文件`)
  }
  const title = reqTitle.trim() || reqBody.trim().slice(0, 20)
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  let cmd
  if (platform === 'xiaohongshu') {
    const base = [py, join(scripts, 'xhs_publish.py')]
    cmd = (vids.length > 0
      ? base.concat(['publish-video', '--no-proxy', '--video', vids[0]])
      : base.concat(['publish', '--no-proxy', '--images', imgs.join(',')]))
      .concat(['--title', title, '--content', reqBody, '--tags', tags, '--exec'])
  } else if (platform === 'bilibili') {
    // B站投稿：直接调 biliup CLI（cookies.json + PATH 上的 biliup）。tid=36「知识」；投稿必须 ≥1 标签。
    const biliTag = tags.replace(/#/g, '').replace(/，/g, ',').trim().replace(/^,+|,+$/g, '') || '日常'
    cmd = ['biliup', '-u', join(c.settings.projectRoot, 'cookies.json'), 'upload', vids[0],
      '--title', title.slice(0, 80), '--tid', '36', '--copyright', '1', '--tag', biliTag]
    if (reqBody.trim()) cmd.push('--desc', reqBody.slice(0, 2000))
  } else if (platform === 'douyin') {
    const base = [py, join(scripts, 'douyin_publish.py')]
    cmd = (vids.length > 0
      ? base.concat(['publish-video', '--no-proxy', '--video', vids[0]])
      : base.concat(['publish', '--no-proxy', '--images', imgs.join(',')]))
      .concat(['--title', title, '--content', reqBody, '--tags', tags, '--exec'])
    // 抖音可能触发风控短信墙——异步跑 + 状态/验证码文件，前端轮询到 sms_required 时弹输入框。
    const dir = join(c.settings.projectRoot, 'outputs', '_publish')
    await mkdir(dir, { recursive: true })
    const codeFile = join(dir, 'douyin.code')
    try { await unlink(codeFile) } catch { /* 无旧码 */ }
    await writePublishStatus(c.settings, platform, 'starting', '发布中…（若触发风控会要求短信验证）')
    void runPublishBg(c.settings, platform, cmd.concat(['--status-file', join(dir, 'douyin.json'), '--sms-code-file', codeFile]), title, reqBody, cfg, codeFile)
    // 关键：不返回 ok:true——这只是「已启动」应答，真结果靠轮询 /status（防旧前端假成功）。
    return { json: { async: true, pending: true, message: '发布已启动，请稍候…' } }
  } else if (platform === 'wechat-oa') {
    // 公众号：MD → 公众号 HTML（skill 排版器）→ 后台会话建草稿（内嵌图传 mp CDN）。
    const mp = await mpLoginStatusData(c.settings)
    if (mp.state !== 'success') throw new ApiError(400, '公众号后台未登录：请先在账号页点「登录公众号后台」扫码')
    if (imgs.length === 0) throw new ApiError(400, '公众号文章需要一张封面图，请附带至少一张图片')
    if (vids.length > 0) throw new ApiError(400, '公众号发图文文章，请附带封面/正文图片而非视频')
    const dir = join(c.settings.projectRoot, 'outputs', '_publish')
    await mkdir(dir, { recursive: true })
    const stamp = randomBytes(6).toString('hex')
    const mdPath = join(dir, `wechat-oa-${stamp}.md`)
    const htmlPath = join(dir, `wechat-oa-${stamp}.html`)
    let bodyMd = reqBody || ''
    for (const extra of imgs.slice(1)) bodyMd += `\n\n![](${extra})`
    await writeFile(mdPath, `# ${title}\n\n${bodyMd}\n`, 'utf8')
    const conv = await runCapture([py, join(WECHAT_SKILL_SCRIPTS(c.settings.projectRoot), 'html_converter.py'), mdPath, '-o', htmlPath],
      { cwd: c.settings.projectRoot, env: await runnerEnv(c.settings), timeout: 60_000 })
    if (conv.code !== 0 || !existsSync(htmlPath)) {
      throw new ApiError(500, `排版失败：${((conv.stderr || conv.stdout || '').slice(-200))}`)
    }
    const wxProxy = process.env.EASEL_PROXY || process.env.https_proxy || ''
    cmd = [py, join(scripts, 'weixin_mp_stats.py'), 'publish', '--proxy', wxProxy,
      '--html', htmlPath, '--cover', imgs[0], '--title', title, '--digest', (reqBody || '').trim().slice(0, 100), '--author', '']
  } else {
    cmd = [py, join(scripts, 'web_publisher.py'), 'publish', '--platform', cfg.wp,
      '--title', title, '--desc', reqBody, '--tags', tags, '--exec']
    const media0 = vids[0] ?? imgs[0]
    if (media0 !== undefined) cmd.push('--media', media0)
  }
  const proc = await runCapture(cmd, {
    cwd: c.settings.projectRoot,
    env: await runnerEnv(c.settings, { publish: platform !== 'wechat-oa' }),
    timeout: 600_000,
  })
  const ok = proc.code === 0
  await appendPublishLog(c.settings, platform, ` rc=${proc.code}`, cmd, proc)
  if (ok) await recordPublishedSchedule(c.settings, title, cfg.name, reqBody)
  const tail = (proc.stderr || proc.stdout || '').trim().split(/\r?\n/).filter(part => part.trim())
  return { json: { ok, message: ok ? '发布成功' : '发布失败（见 detail）', detail: tail.slice(-8).join('\n') } }
}

// ---- 日历规划摘要（spawn calendar_ops.py）----

async function apiScheduleContext(c) {
  const daysRaw = Number(c.query.get('days'))
  const days = Math.max(1, Math.min(Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 14, 90))
  try {
    const proc = await runCapture(
      [c.settings.python, join(SHARED_SCRIPTS(c.settings), 'calendar_ops.py'),
        '--data', join(c.settings.projectRoot, 'outputs', SCHEDULE_FILE), 'context', '--days', String(days)],
      { cwd: c.settings.projectRoot, env: await runnerEnv(c.settings), timeout: 20_000 })
    return { json: proc.code === 0 && proc.stdout.trim() ? JSON.parse(proc.stdout) : {} }
  } catch {
    return { json: {} }
  }
}
// ── Routes contributed by this plugin ───────────────────────────────────
export const AUTOMATION_ROUTES = [
  ['GET', ['accounts'], apiAccounts],
  ['GET', ['analytics', 'platforms'], apiAnalyticsPlatforms],
  ['GET', ['login', ':p', 'status'], apiLoginStatus],
  ['POST', ['login', ':p', 'sms'], apiLoginSms],
  ['GET', ['publish', ':p', 'status'], apiPublishStatus],
  ['POST', ['publish', ':p', 'sms'], apiPublishSms],
  ['POST', ['login', ':p'], apiLoginStart],
  ['GET', ['accounts', ':p', 'whoami'], apiWhoami],
  ['POST', ['accounts', ':p', 'mp-login'], apiMpLoginStart],
  ['GET', ['accounts', ':p', 'mp-login', 'status'], apiMpLoginStatus],
  ['GET', ['accounts', ':p', 'credentials'], apiCredentialsGet],
  ['POST', ['accounts', ':p', 'credentials'], apiCredentialsSave],
  ['GET', ['analytics', ':p'], apiAnalytics],
  ['POST', ['publish', ':p'], apiPublish],
  ['GET', ['schedule', 'context'], apiScheduleContext],
  ['POST', ['logout', ':p'], apiLogout],
]

export const name = 'easel-automation'
/** The core plugin's route registry. */
export const inject = ['easelApi']

/**
 * Contribute this plugin's routes for the lifetime of its fiber.
 * @param ctx - host context carrying the easelApi service.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.easelApi.register(AUTOMATION_ROUTES), 'easel-automation: routes')
  ctx.logger?.info?.('easel-automation: platform runners mounted')
}
