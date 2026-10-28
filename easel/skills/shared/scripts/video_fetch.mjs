// video_fetch.mjs — 爆款拆解视频下载（yt-dlp 打底 + 抖音/小红书/快手/视频号路径）。Node ≥22。
//
// usage: node video_fetch.mjs <batch_dir> <分享文案或链接...>
//
// 平台路由：抖音走移动端 Feed 接口原生路径（yt-dlp 抖音实测不可用）、
// 小红书走笔记页 `__INITIAL_STATE__` 原生路径（yt-dlp 不支持）、
// 快手走详情页 `__APOLLO_STATE__` 原生路径（免登录），
// 视频号走 staging 拾取（wx_channels_download 下载器在微信里点下载，
// 本脚本轮询拾取 wxdl_* 新文件，spec easel-breakdown-channels），
// YouTube/B站/TikTok/其余站点走 yt-dlp。batch_dir 里已有视频文件则跳过下载
// （支持「手动放文件」流程）。stdout 只输出一行元信息 JSON，日志走 stderr。
//
// 退出码：0 成功 / 1 参数错 / 2 下载失败 / 3 缺 cookie / 5 缺 yt-dlp。
//
// cookie：outputs/_deconstruct/cookies.json，形如 {"xhs": "k=v; k2=v2"}
// （值也可为 dict，自动拼 Cookie 头）。抖音走移动端 Feed 接口免 cookie；
// 小红书必须手动填登录 cookie；快手免登录，可选填网页版游客 cookie；
// 视频号免 cookie（登录态在微信客户端里，由微信登录门控保证）。

import { strict as assert } from 'node:assert'
import { createWriteStream, copyFileSync, statSync } from 'node:fs'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { homedir } from 'node:os'
import { extname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv', '.flv'])

const [EX_OK, EX_ARGS, EX_DOWNLOAD, EX_COOKIE, EX_YTDLP] = [0, 1, 2, 3, 5]

const log = (msg) => console.error(`[video_fetch] ${msg}`)

function die(code, msg) {
  log(msg)
  process.exit(code)
}

// ---------- 链接切分与平台识别 ----------

// 从分享文案（含中文/emoji 干扰）中提取链接，去掉尾部标点。
const URL_RE = /https?:\/\/[^\s<>"'，。！？；：、（）【】《》]+/g
const TAIL_PUNCT = /[.,;:!?)\]}，。！？；：、）》】]+$/

export function splitUrls(text) {
  return [...text.matchAll(URL_RE)].map(m => m[0].replace(TAIL_PUNCT, ''))
}

// 平台只认「解析后的主机名 + 点边界后缀」：分享文案里出现 xiaohongshu.com 不代表
// 目标就是小红书，按子串判定会把 Cookie 送去任何域名。
const PLATFORM_HOSTS = {
  douyin: ['douyin.com', 'iesdouyin.com'],
  xhs: ['xiaohongshu.com', 'xhslink.com'],
  kuaishou: ['kuaishou.com', 'kuaishou.cn', 'chenzhongtech.com'],
  // 精确到 channels 子域：mp.weixin.qq.com（公众号）不是视频号。
  sph: ['channels.weixin.qq.com'],
}

/**
 * 解析一条待抓取链接：只允许 http(s)，拒绝带用户名/密码的 URL。
 * @param raw - 分享文案里取出的链接。
 * @returns {URL}
 */
export function parseHttpUrl(raw) {
  let url
  try {
    url = new URL(String(raw))
  } catch {
    throw new Error(`不是合法链接：${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`只支持 http/https 链接：${raw}`)
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('链接不能携带用户名/密码')
  }
  return url
}

/**
 * 主机名是否等于某个后缀，或落在它的子域里（`evil-xiaohongshu.com` 不算）。
 * @param url - 已解析的 URL。
 * @param suffixes - 允许的注册域列表。
 */
export function hostMatches(url, suffixes) {
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  return suffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`))
}

export function detectPlatform(raw) {
  let url
  try {
    url = parseHttpUrl(raw)
  } catch {
    return 'generic'
  }
  if (hostMatches(url, PLATFORM_HOSTS.douyin)) return 'douyin'
  if (hostMatches(url, PLATFORM_HOSTS.xhs)) return 'xhs'
  if (hostMatches(url, PLATFORM_HOSTS.kuaishou)) return 'kuaishou'
  if (hostMatches(url, PLATFORM_HOSTS.sph)) return 'sph'
  return 'generic'
}

// ---------- HTTP 小工具 ----------

const MAX_REDIRECTS = 6
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])

/**
 * GET/POST 并手动跟随重定向；返回 (最终 URL, body 文本)。
 *
 * 手动逐跳而不是 `redirect: 'follow'`：短链（v.douyin.com、xhslink.com）跳到
 * 平台域是正常的，但任何一跳都可以把请求带去别处。这里每一跳都重新校验，
 * `allowHosts` 把平台页面的抓取钉在平台自己的域内，`cookie` 只在主机匹配时
 * 附上——Cookie 不会被带到第三方跳转目标上。
 * @param rawUrl - 起始链接。
 * @param options.cookie - {value, hosts}：值与该值可发送的主机后缀。
 * @param options.allowHosts - 允许的最终/中间主机后缀（缺省不限）。
 * @returns {Promise<[string, string]>} 最终 URL 与响应文本。
 */
export async function fetchFollowing(rawUrl, { cookie = null, allowHosts = null, ...options } = {}) {
  let current = parseHttpUrl(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (allowHosts !== null && !hostMatches(current, allowHosts)) {
      throw new Error(`链接跳出了平台域：${current.hostname}`)
    }
    const headers = { ...(options.headers ?? {}) }
    if (cookie !== null) {
      if (hostMatches(current, cookie.hosts)) headers.Cookie = cookie.value
      else delete headers.Cookie
    }
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new Error(`请求超时 ${options.timeout ?? 30}s`)),
      (options.timeout ?? 30) * 1000,
    )
    try {
      const response = await fetch(current, {
        method: options.data === undefined ? 'GET' : 'POST',
        headers,
        body: options.data,
        redirect: 'manual',
        signal: controller.signal,
      })
      if (!REDIRECT_STATUS.has(response.status)) return [current.href, await response.text()]
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (location === null) throw new Error(`HTTP ${response.status} 没有 Location`)
      current = parseHttpUrl(new URL(location, current).href)
    } finally {
      // 响应体消费完/取消后才解除定时器：die() 的 process.exit 撞上仍未触发的
      // abort 定时器加连接池套接字时，Windows 会以 libuv 断言崩溃、退出码
      // 变成 127（Node v24 实测复现）；解除后退出走正常收尾。
      clearTimeout(timer)
    }
  }
  throw new Error('重定向次数过多')
}

/** 流式下载到 dest（大文件不占内存）；只允许公开地址，逐跳校验。 */
async function download(rawUrl, headers, dest) {
  let current = parseHttpUrl(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicDestination(current)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('下载超时 120s')), 120_000)
    try {
      const response = await fetch(current, {
        headers, redirect: 'manual', signal: controller.signal,
      })
      if (!REDIRECT_STATUS.has(response.status)) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
        return
      }
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (location === null) throw new Error(`HTTP ${response.status} 没有 Location`)
      current = parseHttpUrl(new URL(location, current).href)
    } finally {
      clearTimeout(timer) // 同 fetchFollowing：别让未触发的 abort 定时器送 process.exit 上路
    }
  }
  throw new Error('重定向次数过多')
}

/** 非公网单播地址段：回环、私网、链路本地、保留与组播。 */
const PRIVATE_IPV4 = [
  [/^0\./], [/^10\./], [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./], [/^127\./],
  [/^169\.254\./], [/^172\.(1[6-9]|2\d|3[01])\./], [/^192\.0\.0\./], [/^192\.0\.2\./],
  [/^192\.88\.99\./], [/^192\.168\./], [/^198\.(1[89])\./], [/^198\.51\.100\./], [/^203\.0\.113\./],
  [/^22[4-9]\./], [/^23\d\./], [/^24\d\./], [/^25[0-5]\./],
]

/**
 * 地址是否落在非公网单播段。IPv4-mapped IPv6 按内嵌 IPv4 判定——WHATWG 会把
 * `[::ffff:127.0.0.1]` 规范成 `::ffff:7f00:1`，两种写法都得认。
 * @param address - IPv4/IPv6 文本地址（不带方括号）。
 * @returns true 表示必须拒绝。
 */
export function isPrivateAddress(address) {
  const family = isIP(address)
  if (family === 4) return PRIVATE_IPV4.some(([pattern]) => pattern.test(address))
  if (family !== 6) return true
  const normalized = address.toLowerCase()
  if (normalized === '::' || normalized === '::1') return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized)
  if (mapped !== null) return isPrivateAddress(mapped[1])
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized)
  if (mappedHex !== null) {
    const high = parseInt(mappedHex[1], 16)
    const low = parseInt(mappedHex[2], 16)
    return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }
  if (/^f[cd]/.test(normalized)) return true // unique local fc00::/7
  if (/^fe[89ab]/.test(normalized)) return true // link local fe80::/10
  if (/^fe[c-f]/.test(normalized)) return true // site local fec0::/10 (deprecated)
  if (/^ff/.test(normalized)) return true // multicast ff00::/8
  if (normalized.startsWith('2001:db8:')) return true // documentation
  if (/^2001:0{0,4}:/.test(normalized)) return true // Teredo 2001::/32
  if (/^2002:/.test(normalized)) return true // 6to4
  if (/^64:ff9b:/.test(normalized)) return true // NAT64 well-known prefix
  return false
}

/**
 * 目标必须是公开地址：解析一次全部 A/AAAA，任一落在私网/保留段就拒绝。
 * 这是对「页面里的播放地址」这类第三方文本的 SSRF 下限；解析与连接之间
 * 仍可能被 DNS 换答案，真正需要钉死地址的场合要自己做 lookup。
 * @param url - 已解析的 http(s) URL。
 */
async function assertPublicDestination(url) {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) !== 0 ? [{ address: host }] : await lookup(host, { all: true })
  if (addresses.length === 0) throw new Error(`域名解析为空：${host}`)
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw new Error(`目标地址不是公网单播：${address}`)
  }
}

/** 读 outputs/_deconstruct/cookies.json → {platform: Cookie 头字符串}。 */
export async function cookiesFile(batchDir) {
  let raw
  try {
    raw = JSON.parse(await readFile(resolve(batchDir, '..', 'cookies.json'), 'utf8'))
  } catch {
    return {}
  }
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    let v = value
    if (v !== null && typeof v === 'object') {
      v = Object.entries(v).map(([k, val]) => `${k}=${val}`).join('; ')
    }
    if (typeof v === 'string' && v.trim()) out[key] = v.trim()
  }
  return out
}

// ---------- 抖音原生路径 ----------

// 移动端 Feed 接口：不经过 PC Web 的 Argus 网关，免签名免 cookie（yt-dlp 抖音
// 已实测不可用，此为用户验证过的兜底主通道；图文 Note 不在此流中）。
const DOUYIN_APP_UA = 'com.ss.android.ugc.aweme/290101 (Linux; U; Android 10; zh_CN; Pixel 4; ' +
  'Build/QQ3A.200805.001; Cronet/TTNetVersion:5f9037be 2023-01-13 ' +
  'QuicVersion:4668bb42 2022-11-21)'
const DOUYIN_FEED_HOSTS = ['https://api5-normal-c-hl.amemv.com', 'https://aweme.snssdk.com']

async function fetchDouyin(url, batch) {
  const [final] = await fetchFollowing(url, {
    headers: { 'User-Agent': MOBILE_UA },
    allowHosts: PLATFORM_HOSTS.douyin,
  })
  const m = final.match(/\/(?:video|note)\/(\d+)/)
  if (!m) throw new Error(`无法从链接解析视频 id：${final}`)
  const itemId = m[1]
  const qs = new URLSearchParams({ aweme_id: itemId, aid: '1128' })
  const headers = { 'User-Agent': DOUYIN_APP_UA, Accept: 'application/json, text/plain, */*' }
  let item = null
  for (const host of DOUYIN_FEED_HOSTS) {
    try {
      const [, body] = await fetchFollowing(`${host}/aweme/v1/feed/?${qs}`, { headers, timeout: 15 })
      const data = JSON.parse(body)
      item = (data.aweme_list ?? []).find(a => String(a.aweme_id) === itemId) ?? null
      if (item !== null || (data.aweme_list !== undefined && data.aweme_list !== null)) {
        break // 通道正常；未命中=该作品不收录（图文/已删），换节点也没用
      }
    } catch (exc) {
      log(`feed 节点失败（${host}）：${exc?.cause?.message ?? exc.message ?? exc}`)
    }
  }
  if (item === null) throw new Error('Feed 接口未收录该作品（可能是图文/已删除/私密）')
  const play = (item?.video?.play_addr?.url_list ?? [''])[0]
  if (!play) throw new Error('返回数据里没有播放地址')
  const dest = resolve(batch, 'video.mp4')
  await download(play.replace('/playwm/', '/play/'), { 'User-Agent': DOUYIN_APP_UA }, dest)
  return {
    platform: 'douyin',
    title: item.desc ?? '',
    author: item.author?.nickname ?? '',
    duration_sec: Math.floor((item.video?.duration || item.duration || 0) / 1000),
    file: dest, url: final,
  }
}

// ---------- 小红书原生路径 ----------

async function fetchXhs(url, cookie, batch) {
  if (!cookie) {
    die(EX_COOKIE, '小红书必须登录 cookie：把网页版 Cookie 粘贴到 ' +
      'outputs/_deconstruct/cookies.json 的 "xhs" 字段后重试')
  }
  const [final, page] = await fetchFollowing(url, {
    headers: { 'User-Agent': DESKTOP_UA, 'Accept-Encoding': 'gzip' },
    cookie: { value: cookie, hosts: PLATFORM_HOSTS.xhs },
    allowHosts: PLATFORM_HOSTS.xhs,
  })
  const data = page.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*<\/script>/s)
  if (!data) throw new Error('笔记页未找到 __INITIAL_STATE__（cookie 失效或字段变更）')
  const state = JSON.parse(data[1])
  const detailMap = state.note?.noteDetailMap ?? {}
  const note = Object.values(detailMap).find(v => v && typeof v === 'object' && v.note)?.note ?? null
  if (!note) throw new Error('笔记数据为空（笔记可能已删除/需登录/仅图片）')
  const streams = note.video?.media?.stream ?? {}
  const entry = ['h264', 'h265', 'av1']
    .flatMap(key => streams[key] ?? [])
    .find(s => s.master_url)
  if (!entry) throw new Error('笔记里没有视频流（可能是图文笔记，本技能只支持视频）')
  const dest = resolve(batch, 'video.mp4')
  await download(entry.master_url, { 'User-Agent': DESKTOP_UA, Referer: 'https://www.xiaohongshu.com/' }, dest)
  const duration = note.video?.caps?.video?.duration
  return {
    platform: 'xhs',
    title: note.title || note.desc || '',
    author: note.user?.nickname ?? '',
    duration_sec: Math.floor((duration || 0) / 1000),
    file: dest, url: final,
  }
}

// ---------- 快手原生路径 ----------

/**
 * 从快手详情页 HTML 提取 `window.__APOLLO_STATE__` 的 JSON。
 * 脚本内容以页面自移除片段 `;(function(){...}());` 或 `</script>` 结尾，
 * JSON 里正常不会出现这两种序列；解析失败按没有数据处理。
 * @param page - 详情页 HTML 文本。
 * @returns 解析后的 Apollo 缓存对象；页面没有该脚本或 JSON 损坏时返回 null。
 */
export function parseApolloState(page) {
  const marker = 'window.__APOLLO_STATE__='
  const start = page.indexOf(marker)
  if (start < 0) return null
  let text = page.slice(start + marker.length)
  const stop = text.search(/;\(function|<\/script>/)
  if (stop >= 0) text = text.slice(0, stop)
  try {
    const state = JSON.parse(text)
    return state !== null && typeof state === 'object' ? state : null
  } catch {
    return null
  }
}

/**
 * 快手 web 详情页路径：`__APOLLO_STATE__` 的 GraphQL 缓存里 `photoUrl` 就是
 * 无水印 mp4。游客态可取，cookie 可选（风控收紧时填网页版游客 cookie）；
 * 图集作品没有 VisionVideoDetailPhoto 键，按下载失败降级。
 * @param url - 已校验的快手链接（短链或详情页）。
 * @param cookie - cookies.json 的 "kuaishou" 值，可为空串。
 */
async function fetchKuaishou(url, cookie, batch) {
  const hint = cookie ? '' :
    '；也可在 outputs/_deconstruct/cookies.json 填 "kuaishou" 网页版游客 cookie 后重试'
  const [final, page] = await fetchFollowing(url, {
    headers: { 'User-Agent': DESKTOP_UA, Referer: 'https://www.kuaishou.com/' },
    cookie: cookie ? { value: cookie, hosts: PLATFORM_HOSTS.kuaishou } : null,
    allowHosts: PLATFORM_HOSTS.kuaishou,
  })
  const m = final.match(/\/(?:short-video|fw\/photo)\/([\w-]+)/)
  if (!m) throw new Error(`无法从链接解析作品 id：${final}`)
  const client = parseApolloState(page)?.defaultClient ?? {}
  const photo = client[`VisionVideoDetailPhoto:${m[1]}`] ?? null
  const photoUrl = typeof photo?.photoUrl === 'string' && photo.photoUrl ? photo.photoUrl : ''
  if (!photoUrl) throw new Error(`详情页没有视频地址（可能是图集/已删除/风控）${hint}`)
  const author = Object.entries(client)
    .find(([key]) => key.startsWith('VisionVideoDetailAuthor:'))?.[1] ?? null
  const dest = resolve(batch, 'video.mp4')
  await download(photoUrl, { 'User-Agent': DESKTOP_UA, Referer: 'https://www.kuaishou.com/' }, dest)
  return {
    platform: 'kuaishou',
    title: typeof photo.caption === 'string' ? photo.caption : '',
    author: typeof author?.name === 'string' ? author.name : '',
    duration_sec: Math.floor((Number(photo.duration) || 0) / 1000),
    file: dest, url: final,
  }
}

// ---------- 视频号 staging 拾取路径 ----------

// wx_channels_download 下载器的产物命名锚点（其 config.yaml filenameTemplate
// 带 wxdl_ 前缀）。视频号视频流带签名且加密，必须经微信客户端 + 下载器代理
// 才能拿到直链并解密，所以本路径不发任何网络请求，只轮询拾取新文件。
const CHANNELS_PREFIX = 'wxdl_'
const CHANNELS_POLL_MS = 2_000
const CHANNELS_MTIME_SLACK_MS = 15_000

/**
 * staging 目录里 mtime ≥ since 的最新 wxdl_* 视频文件；没有返回 null。
 * @param dir - 下载器落盘目录（EASEL_CHANNELS_DIR 或用户 Downloads）。
 * @param since - 只认这个时刻（毫秒）之后落盘的文件，旧下载不拾取。
 */
export async function pickStagedChannelsFile(dir, since) {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }
  const candidates = entries.filter(name => name.startsWith(CHANNELS_PREFIX)
    && VIDEO_EXTS.has(extname(name).toLowerCase()))
  let picked = null
  for (const name of candidates) {
    const full = resolve(dir, name)
    try {
      const stat = statSync(full)
      if (stat.mtimeMs < since - CHANNELS_MTIME_SLACK_MS) continue
      if (picked === null || stat.mtimeMs > picked.mtimeMs) {
        picked = { path: full, name, mtimeMs: stat.mtimeMs, size: stat.size }
      }
    } catch { /* 拾取瞬间被移走的文件按不存在处理 */ }
  }
  return picked
}

/** 文件名回推标题：`wxdl_真香现场_1080P.mp4` → `真香现场`。 */
function stagedTitle(name) {
  return name.slice(CHANNELS_PREFIX.length).replace(/\.[^.]+$/, '').replace(/_[^_]*$/, '')
}

/**
 * 视频号路径：轮询下载器 staging 目录等新文件（用户在微信里点「下载」），
 * 命中后复制进 batch。微信登录门控由宿主 preflight/create 负责，这里只认文件。
 * @param batch - 批次目录。
 * @param env - 进程环境（EASEL_CHANNELS_DIR / EASEL_CHANNELS_WAIT）。
 */
async function fetchSph(batch, env = process.env) {
  const dir = env.EASEL_CHANNELS_DIR || resolve(homedir(), 'Downloads')
  const waitSec = Number(env.EASEL_CHANNELS_WAIT) > 0 ? Number(env.EASEL_CHANNELS_WAIT) : 480
  const since = Date.now()
  log(`视频号走下载器拾取：在微信 PC 端打开该视频，点播放器下方的「下载」按钮；` +
    `监听 ${dir} 里的 wxdl_* 新文件（最长等 ${Math.round(waitSec / 60)} 分钟）`)
  const deadline = since + waitSec * 1000
  while (Date.now() < deadline) {
    const hit = await pickStagedChannelsFile(dir, since)
    if (hit !== null) {
      // 落盘稳定性：隔 1.5s 字节数不变才算下载完成，避免复制到写了一半的文件
      //（下载器若不落临时名再改名，final name 会先于完成出现）。
      await new Promise(r => setTimeout(r, 1500))
      let stable = null
      try {
        stable = statSync(hit.path)
      } catch { /* 文件消失（被改名/移动）→ 回到轮询等下一个形态 */ }
      if (stable !== null && stable.size === hit.size) {
        const dest = resolve(batch, 'video.mp4')
        copyFileSync(hit.path, dest)
        log(`拾取到下载器产物：${hit.name}`)
        return {
          platform: 'sph',
          title: stagedTitle(hit.name),
          author: '',
          duration_sec: 0,
          file: dest, url: '',
        }
      }
    }
    await new Promise(r => setTimeout(r, CHANNELS_POLL_MS))
  }
  throw new Error(`等待超时：staging 目录 ${dir} 里一直没有新的 wxdl_* 文件` +
    `（确认下载器在运行、微信已登录，或手动把视频放入批次目录后重跑）`)
}

// ---------- 通用 yt-dlp 路径 ----------

/**
 * 通用 yt-dlp 路径。种子链接已由 main 过 parseHttpUrl；yt-dlp 自己跟随跳转，
 * 这里只能保证交出去的是一个 http(s)、无凭据的 URL。
 * @param url - 已校验的链接（string 形态）。
 */
async function fetchGeneric(url, batch) {
  const seed = parseHttpUrl(url).href
  const proc = spawnSync('yt-dlp', [
    '--no-playlist', '--no-warnings', '--quiet', '--no-progress',
    '-o', resolve(batch, 'video.%(ext)s'), '--print-json', seed,
  ], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
  if (proc.error?.code === 'ENOENT') {
    die(EX_YTDLP, '未找到 yt-dlp：请先 pip install yt-dlp（或 winget install yt-dlp）')
  }
  if (proc.status !== 0) {
    const lines = ((proc.stderr || proc.stdout) ?? '').trim().split('\n').slice(-3)
    throw new Error('yt-dlp 失败：' + (lines.join(' / ') || (proc.stderr ?? '').slice(-300)))
  }
  const infoLine = proc.stdout.split('\n').reverse().find(l => l.trim().startsWith('{')) ?? '{}'
  const info = JSON.parse(infoLine)
  const files = (await readdir(batch))
    .filter(f => VIDEO_EXTS.has(extname(f).toLowerCase()))
    .map(f => resolve(batch, f))
  if (!files.length) throw new Error('yt-dlp 报成功但没有产出视频文件')
  files.sort((a, b) => statSync(b).size - statSync(a).size)
  return {
    platform: 'generic',
    title: info.title ?? '',
    author: info.uploader || info.channel || '',
    duration_sec: Math.floor(info.duration || 0),
    file: files[0], url,
  }
}

// ---------- 入口 ----------

async function manualFile(batch) {
  try {
    const entries = (await readdir(batch)).sort()
    return entries.map(f => resolve(batch, f))
      .find(f => VIDEO_EXTS.has(extname(f).toLowerCase())) ?? null
  } catch {
    return null
  }
}

export async function selftest() {
  const share = '7.43 pQA:/ 复制打开抖音，看看【xxx的作品】真香！ https://v.douyin.com/iRNBho6/ 😄'
  const urls = splitUrls(share)
  assert.equal(urls.length, 1)
  assert.equal(urls[0], 'https://v.douyin.com/iRNBho6/')
  assert.equal(detectPlatform(urls[0]), 'douyin')
  assert.equal(detectPlatform('http://xhslink.com/a2bC'), 'xhs')
  assert.equal(detectPlatform('http://xhslink.com/a2bC，快看'), 'xhs')
  assert.equal(detectPlatform('https://www.bilibili.com/video/BV1GJ411x7h7/'), 'generic')
  assert.equal(detectPlatform('https://www.xiaohongshu.com/explore/abc123'), 'xhs')
  assert.equal(detectPlatform('https://v.kuaishou.com/GH7abcD'), 'kuaishou')
  assert.equal(detectPlatform('https://www.kuaishou.com/short-video/3xkpubc9def'), 'kuaishou')
  assert.equal(detectPlatform('https://www.chenzhongtech.com/fw/photo/3xkpubc9def'), 'kuaishou')
  assert.equal(detectPlatform('https://channels.weixin.qq.com/web/pages/feed?profile=1'), 'sph')
  // 公众号域不是视频号。
  assert.equal(detectPlatform('https://mp.weixin.qq.com/s/abc123'), 'generic')
  // 主机名子串不算平台：Cookie 只认解析后的主机与点边界后缀。
  assert.equal(detectPlatform('https://attacker.example?xiaohongshu.com'), 'generic')
  assert.equal(detectPlatform('https://evil-xiaohongshu.com/note'), 'generic')
  assert.equal(detectPlatform('https://evil-kuaishou.com/short-video/1'), 'generic')
  assert.equal(detectPlatform('javascript:alert(1)'), 'generic')
  assert.equal(parseHttpUrl('https://www.xiaohongshu.com/explore/abc').hostname, 'www.xiaohongshu.com')
  assert.throws(() => parseHttpUrl('file:///etc/passwd'))
  assert.throws(() => parseHttpUrl('https://user:pass@example.com/'))
  assert.equal(hostMatches(new URL('https://www.xiaohongshu.com/x'), PLATFORM_HOSTS.xhs), true)
  assert.equal(hostMatches(new URL('https://evil-xiaohongshu.com/'), PLATFORM_HOSTS.xhs), false)
  assert.deepEqual(Object.keys(await cookiesFile('nonexistent-dir-x')), [])
  console.log('selftest ok')
  return EX_OK
}

const stemOf = (p) => p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '')

async function main(argv) {
  if (argv[0] === '--selftest') return selftest()
  if (argv.length < 2) {
    die(EX_ARGS, 'usage: node video_fetch.mjs <batch_dir> <分享文案或链接...>')
  }
  const batch = resolve(argv[0])
  await mkdir(batch, { recursive: true })
  const text = argv.slice(1).join(' ')

  const placed = await manualFile(batch)
  if (placed !== null) {
    log(`发现已放置文件，跳过下载：${placed.split(/[\\/]/).pop()}`)
    console.log(JSON.stringify({ platform: 'manual', title: stemOf(placed), author: '', duration_sec: 0, file: placed, url: '' }))
    return EX_OK
  }

  const urls = splitUrls(text)
  if (!urls.length) die(EX_ARGS, '文案里没有找到链接')
  if (urls.length > 1) log(`找到 ${urls.length} 条链接，只处理第一条；其余忽略`)
  let url
  try {
    url = parseHttpUrl(urls[0]).href
  } catch (exc) {
    die(EX_ARGS, exc.message)
  }
  const platform = detectPlatform(url)
  log(`平台=${platform} url=${url}`)

  const cookies = await cookiesFile(batch)
  let meta
  try {
    if (platform === 'douyin') meta = await fetchDouyin(url, batch)
    else if (platform === 'xhs') meta = await fetchXhs(url, cookies.xhs ?? '', batch)
    else if (platform === 'kuaishou') meta = await fetchKuaishou(url, cookies.kuaishou ?? '', batch)
    else if (platform === 'sph') meta = await fetchSph(batch)
    else meta = await fetchGeneric(url, batch)
  } catch (exc) { // 网络失败/字段变更/风控 → 统一按下载失败降级
    die(EX_DOWNLOAD, `下载失败（${exc.constructor.name}）：${exc.message}。` +
      `可手动把视频文件放入 ${batch} 后重跑本脚本`)
  }
  console.log(JSON.stringify(meta))
  return EX_OK
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code })
}
