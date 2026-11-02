// Host half: platform automation — login runners, publishing, WeChat MP, analytics.
// Split out of dsh-plugin-easel so the workbench data API and the Python-runner
// fleet can be enabled, fail and be reasoned about independently. The route table
// registers into the core plugin's easelApi service; shared helpers are imported
// from the core module (no cycle: core never imports this file).
import { createReadStream, existsSync, closeSync, mkdirSync, openSync, readdirSync } from 'node:fs'
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { createAccount, loadAccounts, resolveAccount, saveAccounts, validAccountName } from '../accounts.js'
import {
  ANALYTICS_PLATFORMS, ApiError, IMAGE_EXTS, LOGIN_RUNNERS, SCHEDULE_FILE, VIDEO_EXTS,
  isDirectory, isFile, pathStat, safeOutputPath,
  readEnvFile, readJsonFile, readRadarConfig, readStoreList, writeJsonFile,
} from '../../index.js'

const LOGIN_URLS = {
  xiaohongshu: 'https://creator.xiaohongshu.com',
  douyin: 'https://creator.douyin.com',
  kuaishou: 'https://www.kuaishou.com',
  'weixin-channels': 'https://channels.weixin.qq.com',
  zhihu: 'https://www.zhihu.com',
  bilibili: 'https://www.bilibili.com',
}

async function accountLoggedIn(settings, account, cfg) {
  const root = settings.projectRoot
  if (cfg.backend === 'biliup') return existsSync(accountCookieFile(root, account))
  if (cfg.backend === 'wechat-oa') {
    // mp 后台会话优先；AppID 凭证兜底（B2 起宿主半直读凭证 YAML）。公众号 v1 单账号。
    const mp = await readJsonFile(join(root, 'outputs', '_login', 'wechat-oa-mp.json'), null)
    if (mp !== null && typeof mp === 'object' && mp.state === 'success') return true
    return wechatHasCredentials(settings)
  }
  const status = await readJsonFile(join(root, 'outputs', '_login', `${account.id}.json`), null)
  return status !== null && typeof status === 'object' && status.state === 'success'
}

async function apiAccounts(c) {
  const registry = await loadRegistry(c.settings)
  const result = []
  for (const account of registry.accounts) {
    const cfg = LOGIN_RUNNERS[account.platform]
    if (cfg === undefined) continue
    result.push({
      id: account.id,
      platform: account.platform,
      name: account.name,
      persona: account.persona ?? '',
      backend: cfg.backend,
      profileDir: account.profileDir ?? '',
      loggedIn: await accountLoggedIn(c.settings, account, cfg),
      direct: await accountCdpEndpoint(c.settings, account) !== '',
    })
  }
  return { json: result }
}

async function apiAnalyticsPlatforms(c) {
  const registry = await loadRegistry(c.settings)
  const result = []
  for (const [platform, cfg] of Object.entries(LOGIN_RUNNERS)) {
    if (!ANALYTICS_PLATFORMS.has(platform)) continue
    const account = resolveAccount(registry, platform, '')
    result.push({ platform, name: cfg.name, loggedIn: account !== null && await accountLoggedIn(c.settings, account, cfg) })
  }
  return { json: result }
}

async function writeSmsCode(c, subdir, prefix, body) {
  const code = String(body?.code ?? '').replace(/\D/g, '')
  if (code.length < 4 || code.length > 8) throw new ApiError(400, '验证码应为 4-8 位数字')
  const dir = join(c.settings.projectRoot, 'outputs', subdir)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${prefix}.code`), code, 'utf8')
  return { json: { ok: true } }
}

async function apiLoginSms(c) {
  const platform = c.params.p
  if (!(platform in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  const body = await c.body()
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, typeof body?.account === 'string' ? body.account : '')
  if (account === null) throw new ApiError(400, '该平台还没有账号，请先登录一次')
  return writeSmsCode(c, '_login', account.id, body)
}

async function apiPublishStatus(c) {
  const platform = c.params.p
  if (!(platform in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, c.query.get('account') ?? '')
  const key = account !== null ? account.id : platform
  const raw = await readJsonFile(join(c.settings.projectRoot, 'outputs', '_publish', `${key}.json`), null)
  const state = raw !== null && typeof raw === 'object' && typeof raw.state === 'string' ? raw.state : 'unknown'
  const message = raw !== null && typeof raw === 'object' && typeof raw.message === 'string' ? raw.message : ''
  return { json: { mode: 'publish', state, message } }
}

async function apiPublishSms(c) {
  const platform = c.params.p
  if (!(platform in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  const body = await c.body()
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, typeof body?.account === 'string' ? body.account : '')
  if (account === null) throw new ApiError(400, '该平台还没有账号，请先登录一次')
  return writeSmsCode(c, '_publish', account.id, body)
}

/** 单账号登出清理：杀直启实例、删 profile/cookie、删登录标记。返回删除清单。 */
async function logoutAccountFiles(settings, account, cfg) {
  if (cfg.backend === 'wechat-oa') {
    // 清 AppID 凭证 + 停 mp 登录进程 + 删标记/二维码/日志 + 删 mp 浏览器会话（公众号 v1 单账号）。
    const deleted = []
    await wechatClearCredentials(settings)
    deleted.push('wechat-publisher.yaml:accounts.web')
    const mpProc = loginProcesses.get('wechat-oa-mp')
    if (mpProc !== undefined && mpProc.exitCode === null) {
      try { mpProc.kill() } catch { /* 已死 */ }
    }
    const loginDir = join(settings.projectRoot, 'outputs', '_login')
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
    clearWhoamiCache(account.id)
    return deleted
  }
  const deleted = []
  const inst = directInstances.get(account.id)
  if (inst !== undefined && inst.pid > 0) {
    directInstances.delete(account.id)
    // 浏览器是 detached 真进程，必须 taskkill 整树；进程已死时安静忽略。
    await runCapture(['taskkill', '/PID', String(inst.pid), '/T', '/F'], { timeout: 10_000 })
  }
  const profileName = account.profileDir || cfg.profile
  if (profileName !== undefined) {
    const profilesRoot = resolve(BROWSER_PROFILES())
    const pdir = resolve(profilesRoot, profileName)
    if (pdir.startsWith(profilesRoot + sep) && await isDirectory(pdir)) {
      await rm(pdir, { recursive: true, force: true })
      deleted.push(profileName)
    }
  }
  if (cfg.backend === 'biliup') {
    const cookies = accountCookieFile(settings.projectRoot, account)
    if (existsSync(cookies)) {
      await unlink(cookies)
      deleted.push(account.cookieFile || 'cookies.json')
    }
  }
  const loginDir = join(settings.projectRoot, 'outputs', '_login')
  for (const suffix of ['.json', '.png', '-me.png', '.code']) {
    const file = join(loginDir, `${account.id}${suffix}`)
    try {
      if (await isFile(file)) {
        await unlink(file)
        deleted.push(`${account.id}${suffix}`)
      }
    } catch { /* 单个文件删不掉不挡其余 */ }
  }
  clearWhoamiCache(account.id)
  return deleted
}

async function apiLogout(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  const body = await c.body().catch(() => ({}))
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, typeof body?.account === 'string' ? body.account : '')
  if (account === null) throw new ApiError(404, '该平台还没有可登出的账号')
  const deleted = await logoutAccountFiles(c.settings, account, cfg)
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
// 浏览器 profile 根：EASEL_BROWSER_PROFILES 覆盖（测试注入 fixture / 未来壳层重定位），默认家目录。
const BROWSER_PROFILES = () => process.env.EASEL_BROWSER_PROFILES || join(homedir(), '.easel-browser-profiles')
/** 注册表加载统一走这里：浏览器 profile 根与宿主同源，迁移探测不吃测试机真实 home。 */
export const loadRegistry = settings => loadAccounts(settings.projectRoot, { browserProfilesDir: BROWSER_PROFILES() })
const WECHAT_SKILL_DIR = root => join(root, 'skills', 'openclaw', 'skill-wechat-publisher')
const WECHAT_SKILL_SCRIPTS = root => join(WECHAT_SKILL_DIR(root), 'scripts')

// ---- 多账户：注册表解析 + 账号直启 CDP 实例 ----
// 注册表 outputs/_accounts.json（lib/accounts.js）。默认账号 id = 平台 key，所以
// legacy 的 _login/<platform>.json、_publish/<platform>.json 天然就是默认账号的文件，
// 升级零迁移。直启实例：真实 Chrome 直启（非 Playwright 托管）+ 账号 profile + CDP 端口。

/** 账号在跑的直启实例：accountId → { port, pid }；宿主重启后从登录标记里的 port 恢复。 */
const directInstances = new Map()
/** 直启端口探测失败的短负缓存（端口 → ts）：关掉的窗口不反复拖着 0.7s 超时。 */
const cdpProbeFailAt = new Map()

/** B站账号的 biliup cookie 路径：注册表 cookieFile，缺省根 cookies.json。 */
function accountCookieFile(root, account) {
  return account.cookieFile ? join(root, account.cookieFile) : join(root, 'cookies.json')
}

async function cdpAlive(port) {
  const failedAt = cdpProbeFailAt.get(port)
  if (failedAt !== undefined && Date.now() - failedAt < 5000) return false
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(700) })
    if (res.ok) {
      cdpProbeFailAt.delete(port)
      return true
    }
  } catch { /* 端口没人听 */ }
  cdpProbeFailAt.set(port, Date.now())
  return false
}

/** 账号直启实例的 CDP 端点；内存表没有时从登录标记恢复（宿主重启后窗口可能还开着）。 */
export async function accountCdpEndpoint(settings, account) {
  const inst = directInstances.get(account.id)
  if (inst !== undefined) {
    if (await cdpAlive(inst.port)) return `http://127.0.0.1:${inst.port}`
    directInstances.delete(account.id)
  }
  const raw = await readJsonFile(join(settings.projectRoot, 'outputs', '_login', `${account.id}.json`), null)
  const port = raw !== null && typeof raw === 'object' ? Number(raw.port) : NaN
  if (Number.isInteger(port) && port > 0 && await cdpAlive(port)) {
    directInstances.set(account.id, { port, pid: Number(raw.pid) || 0 })
    return `http://127.0.0.1:${port}`
  }
  return ''
}

/** 账号解析（路由层）：显式 id 必须精确命中平台内条目——陈旧 id 不许静默回落默认账号；
 * 空 id 取平台默认账号（第一条目）。 */
export function resolveAccountStrict(registry, platform, accountId) {
  if (!accountId) return resolveAccount(registry, platform, '')
  return registry.accounts.find(account => account.platform === platform && account.id === accountId) ?? null
}

/** 目标账号的浏览器定位参数：直启实例活着 → 附身（用户可插手验证码）；否则用自己的 profile 无头跑。 */
export async function accountBrowserArgs(settings, account) {
  const endpoint = await accountCdpEndpoint(settings, account)
  if (endpoint) return ['--cdp-endpoint', endpoint]
  if (account.profileDir) return ['--profile-dir', join(BROWSER_PROFILES(), account.profileDir)]
  return []
}

/** 直启器浏览器发现：Playwright 自带 Chromium → 系统 Chrome → Edge。 */
function findBrowserExe() {
  const candidates = []
  const local = process.env.LOCALAPPDATA
  if (local) {
    try {
      for (const dir of readdirSync(join(local, 'ms-playwright')).sort().reverse()) {
        if (!dir.startsWith('chromium-')) continue
        for (const sub of ['chrome-win64', 'chrome-win']) {
          candidates.push(join(local, 'ms-playwright', dir, sub, 'chrome.exe'))
        }
      }
    } catch { /* 没有 playwright 浏览器目录 */ }
  }
  candidates.push(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  )
  return candidates.find(path => { try { return existsSync(path) } catch { return false } }) ?? ''
}

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
    server.on('error', rejectPort)
  })
}

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

/** Spawn a long-running login runner with stdout/stderr appended to its log file. key = 账号 id 或 wechat-oa-mp。 */
function spawnRunner(settings, key, cmd, env) {
  const loginDir = join(settings.projectRoot, 'outputs', '_login')
  mkdirSync(loginDir, { recursive: true })
  const fd = openSync(join(loginDir, `${key}.log`), 'a')
  const child = spawn(cmd[0], cmd.slice(1), { cwd: settings.projectRoot, env, stdio: ['ignore', fd, fd], windowsHide: true })
  closeSync(fd)
  loginProcesses.set(key, child)
  child.on('exit', () => { if (loginProcesses.get(key) === child) loginProcesses.delete(key) })
  return child
}

function clearWhoamiCache(platform) {
  whoamiCache.delete(platform)
}

/** 登录标记 outputs/_login/<key>.json（与 login_state.write_status 同格式，原子写）；extra 带直启 port/pid。 */
async function writeLoginMarker(settings, key, state, message = '', extra = {}) {
  const dir = join(settings.projectRoot, 'outputs', '_login')
  await mkdir(dir, { recursive: true })
  await writeJsonFile(join(dir, `${key}.json`), { state, message, qr: '', ts: Math.floor(Date.now() / 1000), ...extra })
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
  const platform = c.params.p
  if (!(platform in LOGIN_RUNNERS)) throw new ApiError(404, '未知平台')
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, c.query.get('account') ?? '')
  if (account === null) return { json: { mode: 'qr', state: 'unknown', message: '', qr: '', qrTs: 0 } }
  const s = await loginStatusData(c.settings, account.id)
  if (s.state === 'success') clearWhoamiCache(account.id)
  const direct = await accountCdpEndpoint(c.settings, account)
  return { json: { mode: direct !== '' ? 'direct' : 'qr', ...s, direct: direct !== '' } }
}

const LOGIN_WAIT_STATES = new Set(['window_login', 'qr_ready', 'success', 'error', 'expired'])
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms) })

/** 登录目标账号解析：显式 account id → 必须存在；否则平台默认账号；一个都没有 → 现场建号。 */
async function ensureLoginAccount(settings, platform, body) {
  const registry = await loadRegistry(settings)
  const wanted = typeof body?.account === 'string' ? body.account.trim() : ''
  if (wanted) {
    const found = resolveAccountStrict(registry, platform, wanted)
    if (found === null) throw new ApiError(404, `账号「${wanted}」不存在`)
    return { registry, account: found }
  }
  const fallback = resolveAccount(registry, platform, '')
  if (fallback !== null) return { registry, account: fallback }
  if (platform === 'wechat-oa') throw new ApiError(400, '公众号暂只支持一个账号')
  const cfg = LOGIN_RUNNERS[platform]
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : cfg.name
  const account = createAccount(registry, platform, name)
  await saveAccounts(settings.projectRoot, registry)
  return { registry, account }
}

/** 直启窗口登录：真实 Chrome 直启（非 Playwright 托管）+ 账号 profile + CDP 端口，用户在窗口里人工登录。
 * 窗口保持打开：后续 whoami/发布经 --cdp-endpoint 附身同一实例，用户可随时插手。 */
async function directLoginStart(c, registry, account) {
  const cfg = LOGIN_RUNNERS[account.platform]
  if (cfg.backend === 'biliup') throw new ApiError(400, 'B站走 TV 端扫码，不支持直启窗口')
  if (cfg.backend === 'wechat-oa') throw new ApiError(400, '公众号走后台扫码/凭证，不支持直启窗口')
  const existing = await accountCdpEndpoint(c.settings, account)
  if (existing) {
    return { json: { mode: 'direct', state: 'window-open', message: '登录窗口已开着：请在窗口里完成登录后点「校验登录态」' } }
  }
  const exe = findBrowserExe()
  if (!exe) throw new ApiError(500, '未找到可用的 Chrome/Chromium/Edge，无法打开登录窗口')
  if (!account.profileDir) {
    account.profileDir = cfg.profile ?? `${account.platform}__${account.id}`
    await saveAccounts(c.settings.projectRoot, registry)
  }
  const loginDir = join(c.settings.projectRoot, 'outputs', '_login')
  await mkdir(loginDir, { recursive: true })
  const port = await freePort()
  const profilePath = join(BROWSER_PROFILES(), account.profileDir)
  await mkdir(profilePath, { recursive: true })
  const fd = openSync(join(loginDir, `${account.id}.log`), 'a')
  const child = spawn(exe, [
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profilePath}`,
    '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-dev-shm-usage',
    LOGIN_URLS[account.platform] ?? 'about:blank',
  ], { detached: true, stdio: ['ignore', fd, fd], windowsHide: false })
  closeSync(fd)
  child.unref()
  directInstances.set(account.id, { port, pid: child.pid })
  await writeLoginMarker(c.settings, account.id, 'window-open', '正在打开登录窗口…', { port, pid: child.pid })
  for (let i = 0; i < 30; i++) {
    await sleep(400)
    if (await cdpAlive(port)) {
      return { json: { mode: 'direct', state: 'window-open', message: '请在打开的窗口中登录，完成后点「校验登录态」' } }
    }
  }
  directInstances.delete(account.id)
  await writeLoginMarker(c.settings, account.id, 'error', `浏览器窗口未能启动，请查看 outputs/_login/${account.id}.log`)
  throw new ApiError(502, `浏览器窗口未能启动，请查看 outputs/_login/${account.id}.log`)
}

async function apiLoginStart(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  if (cfg.backend === 'wechat-oa') {
    // 公众号不走扫码：前端应改用凭证表单提交到 /api/accounts/{platform}/credentials。
    return { json: { mode: 'credentials', configured: await wechatHasCredentials(c.settings), message: '微信公众号请填写 AppID / AppSecret' } }
  }
  const body = await c.body()
  const mode = typeof body?.mode === 'string' ? body.mode : 'qr'
  if (mode === 'cdp' || mode === 'manual') {
    throw new ApiError(400, '登录模式已改为「扫码」和「直启窗口」（原 CDP 接管/托管窗口已下线，直启窗口见 direct）')
  }
  if (mode !== 'qr' && mode !== 'direct') throw new ApiError(400, `未知登录模式 ${mode}`)
  const { registry, account } = await ensureLoginAccount(c.settings, platform, body)
  const loginDir = join(c.settings.projectRoot, 'outputs', '_login')
  await mkdir(loginDir, { recursive: true })
  if (mode === 'direct') return directLoginStart(c, registry, account)
  // 先探活再清标记：标记里的 port/pid 是窗口开着时的唯一恢复依据，扫前删掉就再也附身不上。
  const live = await accountCdpEndpoint(c.settings, account)
  if (live) throw new ApiError(409, '该账号的登录窗口还开着：请在窗口里完成登录后点「校验登录态」，或先关掉窗口再扫码')
  for (const suffix of ['.png', '.json', '.code']) {
    try { await unlink(join(loginDir, `${account.id}${suffix}`)) } catch { /* 本来就不在 */ }
  }
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  const timeout = 240
  let cmd
  if (cfg.backend === 'xhs') {
    cmd = [py, join(scripts, 'xhs_publish.py'), 'login', '--no-proxy', '--qr-out', join(loginDir, `${account.id}.png`), '--status-file', join(loginDir, `${account.id}.json`), '--timeout', String(timeout)]
  } else if (cfg.backend === 'biliup') {
    // B站：TV 端扫码登录 API 生成二维码 + 写账号 cookie（biliup login 需真终端）。
    cmd = [process.execPath, join(scripts, 'bili_login.mjs'), 'login', '--qr-out', join(loginDir, `${account.id}.png`), '--status-file', join(loginDir, `${account.id}.json`), '--cookie', accountCookieFile(c.settings.projectRoot, account), '--timeout', String(timeout)]
  } else if (cfg.backend === 'douyin') {
    cmd = [py, join(scripts, 'douyin_publish.py'), 'login', '--qr-out', join(loginDir, `${account.id}.png`), '--status-file', join(loginDir, `${account.id}.json`), '--sms-code-file', join(loginDir, `${account.id}.code`), '--timeout', String(timeout)]
  } else {
    cmd = [py, join(scripts, 'web_publisher.py'), 'login-qr', '--platform', cfg.wp, '--qr-out', join(loginDir, `${account.id}.png`), '--status-file', join(loginDir, `${account.id}.json`), '--timeout', String(timeout)]
  }
  if (account.profileDir) cmd.push('--profile-dir', join(BROWSER_PROFILES(), account.profileDir))
  clearWhoamiCache(account.id)
  spawnRunner(c.settings, account.id, cmd, await runnerEnv(c.settings))
  for (let i = 0; i < 50; i++) {
    await sleep(500)
    const s = await loginStatusData(c.settings, account.id)
    if (s.qr || LOGIN_WAIT_STATES.has(s.state)) return { json: { mode, ...s } }
  }
  return { json: { mode, ...(await loginStatusData(c.settings, account.id)) } }
}

// ---- whoami（真校验，TTL 缓存）----

async function apiWhoami(c) {
  const platform = c.params.p
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  if (cfg.backend === 'wechat-oa') {
    // 不起浏览器：以 mp 后台会话/AppID 配置判断，名字取配置账号名。
    return { json: { loggedIn: await accountLoggedIn(c.settings, { id: platform }, cfg), name: (await wechatWebAccount(c.settings)).name || '微信公众号', avatar: '' } }
  }
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, c.query.get('account') ?? '')
  if (account === null) return { json: { loggedIn: false, name: '', avatar: '' } }
  const hit = whoamiCache.get(account.id)
  if (hit !== undefined && Date.now() - hit.at < WHOAMI_TTL_MS) return { json: hit.data }
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  let cmd
  if (cfg.backend === 'biliup') {
    cmd = [process.execPath, join(scripts, 'bili_login.mjs'), 'whoami', '--cookie', accountCookieFile(c.settings.projectRoot, account)]
  } else if (cfg.backend === 'xhs') {
    cmd = [py, join(scripts, 'xhs_publish.py'), 'whoami', '--no-proxy', ...(await accountBrowserArgs(c.settings, account))]
  } else if (cfg.backend === 'douyin') {
    cmd = [py, join(scripts, 'douyin_publish.py'), 'whoami', ...(await accountBrowserArgs(c.settings, account))]
  } else {
    cmd = [py, join(scripts, 'web_publisher.py'), 'whoami', '--platform', cfg.wp, ...(await accountBrowserArgs(c.settings, account))]
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
    return { json: { loggedIn: await accountLoggedIn(c.settings, account, cfg), name: '', avatar: '' } }
  }
  whoamiCache.set(account.id, { at: Date.now(), data })
  if (cfg.backend !== 'biliup') {
    if (data.loggedIn) {
      // 覆写状态但保留标记里的直启 port/pid：宿主重启后靠它恢复附身（状态协议，spec S2）。
      const prev = await readJsonFile(join(c.settings.projectRoot, 'outputs', '_login', `${account.id}.json`), null)
      const port = prev !== null && typeof prev === 'object' ? Number(prev.port) : NaN
      const extras = Number.isInteger(port) && port > 0 ? { port, pid: Number(prev.pid) || 0 } : {}
      await writeLoginMarker(c.settings, account.id, 'success', data.name || '', extras)
    } else if (await accountCdpEndpoint(c.settings, account) === '') {
      // 未登录且直启窗口不在 → 清标记；窗口还开着时不动它（window-open + port/pid 是恢复权威）。
      try { await unlink(join(c.settings.projectRoot, 'outputs', '_login', `${account.id}.json`)) } catch { /* 不在 */ }
    }
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
  // 凭证落了就确保公众号账号条目存在（公众号 v1 单账号，条目仅承载名字/画像绑定）。
  const registry = await loadRegistry(c.settings)
  if (resolveAccount(registry, platform, '') === null) {
    createAccount(registry, platform, name || '微信公众号')
    await saveAccounts(c.settings.projectRoot, registry)
  }
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

/** 参与归档的归因平台：account_stats.py 五家 + 公众号（weixin_mp_stats.py 也调
 * record_snapshot("wechat-oa")，写在同一个 _analytics 目录）。B站走 biliup stats，不写归档。 */
const ARCHIVED_ANALYTICS = new Set(['xiaohongshu', 'douyin', 'kuaishou', 'zhihu', 'weixin-channels', 'wechat-oa'])

/** 读一个账号的归档快照（history 子命令，不起浏览器）；失败降级为「无数据」而不是整表失败。 */
async function readAccountHistory(settings, account) {
  if (!ARCHIVED_ANALYTICS.has(account.platform)) {
    return { archived: false, latest: null, growth: null, points: [], ageDays: null }
  }
  const cmd = [settings.python, join(SHARED_SCRIPTS(settings), 'account_stats.py'),
    'history', '--platform', account.platform, '--history-key', account.id]
  const proc = await runCapture(cmd, { cwd: settings.projectRoot, env: await runnerEnv(settings), timeout: 30_000 })
  for (const line of proc.stdout.trim().split(/\r?\n/).reverse()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const d = JSON.parse(trimmed)
      return {
        archived: true,
        latest: d.latest ?? null,
        growth: d.growth ?? null,
        points: Array.isArray(d.points) ? d.points : [],
        ageDays: typeof d.ageDays === 'number' ? d.ageDays : null,
      }
    } catch { continue }
  }
  return { archived: true, latest: null, growth: null, points: [], ageDays: null }
}

/** 工作台全览：注册表里每个归因平台账号的最新快照 + 增长窗口（只读归档，不启浏览器）。 */
async function apiAnalyticsOverview(c) {
  const registry = await loadRegistry(c.settings)
  const rows = registry.accounts.filter(account => ANALYTICS_PLATFORMS.has(account.platform))
  const result = await Promise.all(rows.map(async account => {
    const cfg = LOGIN_RUNNERS[account.platform]
    const history = await readAccountHistory(c.settings, account)
    return {
      id: account.id,
      platform: account.platform,
      name: account.name,
      persona: account.persona ?? '',
      backend: cfg?.backend ?? '',
      loggedIn: cfg === undefined ? false : await accountLoggedIn(c.settings, account, cfg),
      ...history,
    }
  }))
  return { json: result }
}

async function apiAnalytics(c) {
  const platform = c.params.p
  if (!ANALYTICS_PLATFORMS.has(platform)) throw new ApiError(404, '该平台暂不支持数据抓取')
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, c.query.get('account') ?? '')
  if (account === null) throw new ApiError(400, '该平台还没有账号，请先在账号页登录')
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  let cmd
  if (platform === 'bilibili') {
    cmd = [process.execPath, join(scripts, 'bili_login.mjs'), 'stats', '--cookie', accountCookieFile(c.settings.projectRoot, account)]
  } else if (platform === 'wechat-oa') {
    // 公众号走 mp 后台网页端（Playwright 拦数据 XHR）；默认直连，受限网络才需代理。
    const wxProxy = process.env.EASEL_PROXY || process.env.https_proxy || ''
    cmd = [py, join(scripts, 'weixin_mp_stats.py'), 'stats', '--proxy', wxProxy, '--count', '20']
  } else {
    // 代理策略由 account_stats.py 按平台自定（xhs 直连、其它走 env）；账号参数在末尾。
    // 归档键 = 账号 id：默认账号 id 就是平台 key，既有 <platform>.jsonl 天然是它的历史。
    cmd = [py, join(scripts, 'account_stats.py'), 'fetch', '--platform', platform, '--history-key', account.id, ...(await accountBrowserArgs(c.settings, account))]
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

async function appendPublishLog(settings, label, tag, cmd, proc) {
  try {
    const lines = [
      '', `===== ${new Date().toLocaleString('zh-CN', { hour12: false })} ${label}${tag} =====`,
      `CMD: ${cmd.join(' ')}`,
      'STDOUT:', (proc.stdout || '').slice(-2000), 'STDERR:', (proc.stderr || '').slice(-2000),
    ]
    await appendFile(join(settings.projectRoot, 'outputs', '_publish.log'), `${lines.join('\n')}\n`, 'utf8')
  } catch { /* 日志失败不挡发布 */ }
}

async function writePublishStatus(settings, key, state, message = '') {
  const dir = join(settings.projectRoot, 'outputs', '_publish')
  await mkdir(dir, { recursive: true })
  await writeJsonFile(join(dir, `${key}.json`), { state, message, ts: Math.floor(Date.now() / 1000) })
}

/** 抖音式异步发布的后台执行：脚本自写状态文件；结束后兜底补终态 + 日志 + 回流排期。 */
export async function runPublishBg(settings, key, cmd, title, body, cfg, codeFile, account = null) {
  const r = await runCapture(cmd, { cwd: settings.projectRoot, env: await runnerEnv(settings, { publish: true }), timeout: 900_000 })
  const ok = r.code === 0
  await appendPublishLog(settings, key, '(async)', cmd, r)
  const detail = r.timedOut ? '发布超时（>900s）' : ((r.stderr || r.stdout || '').trim().split(/\r?\n/).filter(part => part.trim())).slice(-4).join('\n')
  const current = await readJsonFile(join(settings.projectRoot, 'outputs', '_publish', `${key}.json`), null)
  const currentState = current !== null && typeof current === 'object' ? current.state : 'unknown'
  if (currentState !== 'success' && currentState !== 'error') {
    await writePublishStatus(settings, key, ok ? 'success' : 'error', ok ? '发布成功' : (detail || '发布失败'))
  }
  try { await unlink(codeFile) } catch { /* 不在 */ }
  if (ok) await recordPublishedSchedule(settings, title, cfg.name, body, account)
}

/** 成功发布回流排期（与 web/app.py 同 schema；脚本侧自动记录已由 EASEL_CALENDAR_AUTORECORD=0 关掉）。 */
async function recordPublishedSchedule(settings, title, platformName, body, account = null) {
  try {
    const items = await readStoreList(settings, SCHEDULE_FILE)
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const item = {
      id: randomBytes(6).toString('hex'),
      title,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      platform: platformName,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      status: 'published',
      note: body.slice(0, 200),
      kind: 'content',
      source: 'publish-page',
    }
    if (account !== null) {
      item.accountId = account.id
      item.accountName = account.name
    }
    items.push(item)
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
  const registry = await loadRegistry(c.settings)
  const account = resolveAccountStrict(registry, platform, typeof body?.account === 'string' ? body.account : '')
  if (account === null && platform !== 'wechat-oa') throw new ApiError(400, '该平台还没有账号，请先在账号页登录')
  const browserArgs = account !== null ? await accountBrowserArgs(c.settings, account) : []
  const py = c.settings.python
  const scripts = SHARED_SCRIPTS(c.settings)
  let cmd
  if (platform === 'xiaohongshu') {
    const base = [py, join(scripts, 'xhs_publish.py')]
    cmd = (vids.length > 0
      ? base.concat(['publish-video', '--no-proxy', '--video', vids[0]])
      : base.concat(['publish', '--no-proxy', '--images', imgs.join(',')]))
      .concat(['--title', title, '--content', reqBody, '--tags', tags, '--exec'])
      .concat(browserArgs)
  } else if (platform === 'bilibili') {
    // B站投稿：直接调 biliup CLI（账号 cookie + PATH 上的 biliup）。tid=36「知识」；投稿必须 ≥1 标签。
    const biliTag = tags.replace(/#/g, '').replace(/，/g, ',').trim().replace(/^,+|,+$/g, '') || '日常'
    cmd = ['biliup', '-u', accountCookieFile(c.settings.projectRoot, account), 'upload', vids[0],
      '--title', title.slice(0, 80), '--tid', '36', '--copyright', '1', '--tag', biliTag]
    if (reqBody.trim()) cmd.push('--desc', reqBody.slice(0, 2000))
  } else if (platform === 'douyin') {
    const base = [py, join(scripts, 'douyin_publish.py')]
    cmd = (vids.length > 0
      ? base.concat(['publish-video', '--no-proxy', '--video', vids[0]])
      : base.concat(['publish', '--no-proxy', '--images', imgs.join(',')]))
      .concat(['--title', title, '--content', reqBody, '--tags', tags, '--exec'])
      .concat(browserArgs)
    // 抖音可能触发风控短信墙——异步跑 + 状态/验证码文件，前端轮询到 sms_required 时弹输入框。
    const dir = join(c.settings.projectRoot, 'outputs', '_publish')
    await mkdir(dir, { recursive: true })
    const codeFile = join(dir, `${account.id}.code`)
    try { await unlink(codeFile) } catch { /* 无旧码 */ }
    await writePublishStatus(c.settings, account.id, 'starting', '发布中…（若触发风控会要求短信验证）')
    void runPublishBg(c.settings, account.id, cmd.concat(['--status-file', join(dir, `${account.id}.json`), '--sms-code-file', codeFile]), title, reqBody, cfg, codeFile, account)
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
    cmd.push(...browserArgs)
  }
  const proc = await runCapture(cmd, {
    cwd: c.settings.projectRoot,
    env: await runnerEnv(c.settings, { publish: platform !== 'wechat-oa' }),
    timeout: 600_000,
  })
  const ok = proc.code === 0
  await appendPublishLog(c.settings, account !== null ? `${platform}/${account.name}` : platform, ` rc=${proc.code}`, cmd, proc)
  if (ok) await recordPublishedSchedule(c.settings, title, cfg.name, reqBody, account)
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
// ---- 账号实体 CRUD（注册表层；登录/登出走 login/logout 路由）----

async function apiAccountCreate(c) {
  const body = await c.body()
  const platform = typeof body?.platform === 'string' ? body.platform.trim() : ''
  const cfg = LOGIN_RUNNERS[platform]
  if (cfg === undefined) throw new ApiError(404, '未知平台')
  if (platform === 'wechat-oa') throw new ApiError(400, '公众号暂只支持一个账号')
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!validAccountName(name)) throw new ApiError(400, '账号名不能为空，且不能超过 40 字或包含路径分隔符')
  const registry = await loadRegistry(c.settings)
  const account = createAccount(registry, platform, name)
  await saveAccounts(c.settings.projectRoot, registry)
  return { json: { id: account.id, platform, name: account.name, persona: '', profileDir: account.profileDir ?? '', loggedIn: false } }
}

async function apiAccountUpdate(c) {
  const registry = await loadRegistry(c.settings)
  const account = registry.accounts.find(item => item.id === c.params.a)
  if (account === undefined) throw new ApiError(404, '账号不存在')
  const body = await c.body()
  if (body?.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!validAccountName(name)) throw new ApiError(400, '账号名不能为空，且不能超过 40 字或包含路径分隔符')
    account.name = name
  }
  if (body?.persona !== undefined) {
    const persona = typeof body.persona === 'string' && body.persona.trim() ? body.persona.trim() : null
    if (persona !== null && !await isDirectory(join(c.settings.projectRoot, 'profiles', persona))) {
      throw new ApiError(404, `画像「${persona}」不存在`)
    }
    account.persona = persona
  }
  await saveAccounts(c.settings.projectRoot, registry)
  clearWhoamiCache(account.id)
  return { json: { ok: true, id: account.id, name: account.name, persona: account.persona ?? '' } }
}

async function apiAccountDelete(c) {
  const registry = await loadRegistry(c.settings)
  const index = registry.accounts.findIndex(item => item.id === c.params.a)
  if (index === -1) throw new ApiError(404, '账号不存在')
  const [account] = registry.accounts.splice(index, 1)
  const cfg = LOGIN_RUNNERS[account.platform]
  const deleted = cfg !== undefined ? await logoutAccountFiles(c.settings, account, cfg) : []
  await saveAccounts(c.settings.projectRoot, registry)
  return { json: { ok: true, deleted } }
}

// ── Routes contributed by this plugin ───────────────────────────────────
export const AUTOMATION_ROUTES = [
  ['GET', ['accounts'], apiAccounts],
  ['POST', ['accounts'], apiAccountCreate],
  ['PUT', ['accounts', ':a'], apiAccountUpdate],
  ['DELETE', ['accounts', ':a'], apiAccountDelete],
  ['GET', ['analytics', 'platforms'], apiAnalyticsPlatforms],
  ['GET', ['analytics', 'overview'], apiAnalyticsOverview],
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
