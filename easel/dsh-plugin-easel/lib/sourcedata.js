// 拆解数据源门控（spec easel-breakdown-fullpage 设计增补）：平台判定、
// cookie 状态与写入。video_fetch.mjs 的既有约定是 outputs/_deconstruct/cookies.json
// （{platform: Cookie 头字符串}，值也可为 dict）；抖音免 cookie，小红书必需。
// 扫码登录的状态文件在 outputs/_login/<platform>.json（runner 舰队四件套）。

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** cookies.json 与 _login 状态的落点（projectRoot 相对）。 */
export function cookiesFile(projectRoot) {
  return join(projectRoot, 'outputs', '_deconstruct', 'cookies.json')
}

/**
 * 拆解平台 id → 账号体系平台 id（outputs/_login/<账号id>.json）。
 * 账号侧用全名 xiaohongshu，拆解侧沿用 video_fetch 的 cookies.json 约定叫 xhs。
 */
const LOGIN_FILE_ALIASES = {
  xhs: ['xiaohongshu', 'xhs'],
  douyin: ['douyin'],
  bili: ['bili', 'bilibili'],
  youtube: ['youtube'],
}

function loginStatusFile(projectRoot, platform) {
  return join(projectRoot, 'outputs', '_login', `${platform}.json`)
}

/** 平台是否已有可用登录态：扫码状态文件的 state==='success'（runner 协议）或遗留 loggedIn 字段。 */
async function platformLoggedIn(projectRoot, platform) {
  for (const name of LOGIN_FILE_ALIASES[platform] ?? [platform]) {
    const statusFile = loginStatusFile(projectRoot, name)
    if (!existsSync(statusFile)) continue
    try {
      const data = JSON.parse(await readFile(statusFile, 'utf8'))
      if (data?.state === 'success' || data?.loggedIn === true) return true
    } catch { /* 半截状态文件按未登录处理 */ }
  }
  return false
}

/**
 * 从分享链接/口令文本判平台。只认拆解流水线真实支持的域：
 * 抖音（含 v.douyin.com 短链与口令文本）、小红书（xiaohongshu/xhslink）、
 * 快手（kuaishou/chenzhongtech，免登录）；
 * bilibili/youtube 免登录直连；认不出按 'other'（免登录，让下载器自己报错）。
 */
export function parsePlatform(raw) {
  const text = String(raw ?? '')
  if (/douyin|iesdouyin|amemv|snssdk/i.test(text)) return 'douyin'
  if (/xiaohongshu|xhslink/i.test(text)) return 'xhs'
  if (/kuaishou|chenzhongtech/i.test(text)) return 'kuaishou'
  if (/bilibili|b23\.tv/i.test(text)) return 'bili'
  if (/youtube|youtu\.be/i.test(text)) return 'youtube'
  return 'other'
}

/** 各平台是否需要登录态（cookies.json 或扫码登录）才能抓取。 */
const AUTH_REQUIRED = new Set(['xhs'])

/**
 * 读 cookies.json（不存在/坏 JSON 当空表）。返回原始映射，调用方自行取字段。
 */
export async function readCookies(projectRoot) {
  const file = cookiesFile(projectRoot)
  if (!existsSync(file)) return {}
  try {
    const data = JSON.parse(await readFile(file, 'utf8'))
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

/** cookie 值是否非空（字符串取 trim，dict 取键数）。 */
function cookieSet(value) {
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0
  return false
}

/**
 * 各平台门控状态（给 GET /easel/api/source-status；绝不回显 cookie 明文）。
 * loggedIn 读 outputs/_login/<platform>.json 的 loggedIn 字段（扫码登录成功后由 runner 写）。
 */
export async function sourceStatus(projectRoot) {
  const cookies = await readCookies(projectRoot)
  const platforms = ['douyin', 'xhs', 'kuaishou', 'bili', 'youtube']
  const rows = await Promise.all(platforms.map(async (platform) => ({
    platform,
    authRequired: AUTH_REQUIRED.has(platform),
    cookieSet: cookieSet(cookies[platform]),
    loggedIn: await platformLoggedIn(projectRoot, platform),
  })))
  return { platforms: rows }
}

/**
 * 合并写入一个平台的 cookie；空串/空白 = 清除该平台键。保持文件其余平台不动。
 * @returns 是否真的写盘（值未变化时不写）。
 */
export async function writeCookie(projectRoot, platform, value) {
  const cookies = await readCookies(projectRoot)
  const trimmed = String(value ?? '').trim()
  if (trimmed) cookies[platform] = trimmed
  else delete cookies[platform]
  const file = cookiesFile(projectRoot)
  const existed = existsSync(file)
  if (existed) {
    try {
      if (JSON.stringify(JSON.parse(await readFile(file, 'utf8'))) === JSON.stringify(cookies)) return false
    } catch { /* 坏文件直接覆写 */ }
  } else if (Object.keys(cookies).length === 0) {
    return false // 清一个本就不存在的平台，别凭空造文件
  }
  const { mkdir } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(cookies, null, 2)}\n`, 'utf8')
  return true
}
