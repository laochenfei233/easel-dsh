// video_fetch.mjs — 爆款拆解视频下载（yt-dlp 打底 + 抖音/小红书原生路径）。Node ≥22。
//
// usage: node video_fetch.mjs <batch_dir> <分享文案或链接...>
//
// 平台路由：抖音走移动端 Feed 接口原生路径（yt-dlp 抖音实测不可用）、
// 小红书走笔记页 `__INITIAL_STATE__` 原生路径（yt-dlp 不支持），
// YouTube/B站/TikTok/其余站点走 yt-dlp。batch_dir 里已有视频文件则跳过下载
// （支持「手动放文件」流程）。stdout 只输出一行元信息 JSON，日志走 stderr。
//
// 退出码：0 成功 / 1 参数错 / 2 下载失败 / 3 缺 cookie / 5 缺 yt-dlp。
//
// cookie：outputs/_deconstruct/cookies.json，形如 {"xhs": "k=v; k2=v2"}
// （值也可为 dict，自动拼 Cookie 头）。抖音走移动端 Feed 接口免 cookie；
// 小红书必须手动填登录 cookie。

import { strict as assert } from 'node:assert'
import { createWriteStream, statSync } from 'node:fs'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
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

export function detectPlatform(url) {
  const host = (url.match(/^https?:\/\/([^/]+)/) ?? [''])[1].toLowerCase()
  if (host.includes('douyin.com') || host.includes('iesdouyin')) return 'douyin'
  if (host.includes('xiaohongshu.com') || host.includes('xhslink.com')) return 'xhs'
  return 'generic'
}

// ---------- HTTP 小工具 ----------

/** GET/POST 并跟随重定向；返回 (最终 URL, body 文本)。fetch 自动解压 gzip/br。 */
async function http(url, { headers = {}, data, timeout = 30 } = {}) {
  const resp = await fetch(url, {
    method: data === undefined ? 'GET' : 'POST',
    headers,
    body: data,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout * 1000),
  })
  return [resp.url, await resp.text()]
}

/** 流式下载到 dest（大文件不占内存）。 */
async function download(url, headers, dest) {
  const resp = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(120_000) })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  await pipeline(Readable.fromWeb(resp.body), createWriteStream(dest))
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
  const [final] = await http(url, { headers: { 'User-Agent': MOBILE_UA } })
  const m = final.match(/\/(?:video|note)\/(\d+)/)
  if (!m) throw new Error(`无法从链接解析视频 id：${final}`)
  const itemId = m[1]
  const qs = new URLSearchParams({ aweme_id: itemId, aid: '1128' })
  const headers = { 'User-Agent': DOUYIN_APP_UA, Accept: 'application/json, text/plain, */*' }
  let item = null
  for (const host of DOUYIN_FEED_HOSTS) {
    try {
      const [, body] = await http(`${host}/aweme/v1/feed/?${qs}`, { headers, timeout: 15 })
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
  const [final, page] = await http(url, {
    headers: { 'User-Agent': DESKTOP_UA, Cookie: cookie, 'Accept-Encoding': 'gzip' },
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

// ---------- 通用 yt-dlp 路径 ----------

async function fetchGeneric(url, batch) {
  const proc = spawnSync('yt-dlp', [
    '--no-playlist', '--no-warnings', '--quiet', '--no-progress',
    '-o', resolve(batch, 'video.%(ext)s'), '--print-json', url,
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
  assert.equal(detectPlatform('http://xhslink.com，快看'), 'xhs')
  assert.equal(detectPlatform('https://www.bilibili.com/video/BV1GJ411x7h7/'), 'generic')
  assert.equal(detectPlatform('https://www.xiaohongshu.com/explore/abc123'), 'xhs')
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
  const url = urls[0]
  const platform = detectPlatform(url)
  log(`平台=${platform} url=${url}`)

  const cookies = await cookiesFile(batch)
  let meta
  try {
    if (platform === 'douyin') meta = await fetchDouyin(url, batch)
    else if (platform === 'xhs') meta = await fetchXhs(url, cookies.xhs ?? '', batch)
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
