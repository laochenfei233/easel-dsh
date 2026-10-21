// bili_login.mjs — B站扫码登录（TV 端 QR API，产出 biliup 兼容 cookie）。Node ≥22，零依赖。
//
// 为什么不用 `biliup login`：它需要真终端（无头/子进程里报 `IO error: not a terminal`）。
// 改用 B站 TV 端扫码登录 API（biliup-rs 内部同款）：generate(auth_code+url) →
// 二维码 PNG（vendored qrcode.mjs + node:zlib 手拼 PNG）→ poll → token_info/cookie_info
// → 写 biliup 认的 cookie JSON（默认 cookies.json）。前端复用通用扫码 UI，不起浏览器。
//
// 子命令：login / whoami / stats / check / selftest
// 退出码：0 成功 / 1 一般失败（超时/失效）/ 3 缺二维码库（check 失败）
// 注：直连 B站 API（国内可达）；不走 http(s)_proxy 环境代理（与 Python 版 urllib 行为不同）。

import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { readFile, writeFile, rename, mkdir, unlink, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import qrcode from './vendor/qrcode.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..', '..', '..')
const DEFAULT_QR_OUT = join(PROJECT_ROOT, 'outputs', '_login', 'bilibili.png')
const DEFAULT_COOKIE = join(PROJECT_ROOT, 'cookies.json')

// TV 端 appkey/appsec（公开，biliup-rs 同款）——TV 登录才返回 token_info（app 刷新令牌），
// 这正是 biliup cookie 文件需要的格式；web 端扫码只有网页 cookie、biliup 不完整认。
const APPKEY = '4409e2ce8ffd12b8'
const APPSEC = '59b43e04ad6965f34319062b478f83dd'
const UA = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 BiliDroid/7.0.0'
const GEN_URL = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code'
const POLL_URL = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll'

const STATES = new Set(['starting', 'qr_ready', 'window_login', 'scanned', 'sms_required', 'verifying', 'success', 'expired', 'error'])

const die = (msg, code = 1) => { console.error(`ERROR: ${msg}`); process.exit(code) }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ---------- 状态文件（login_state 协议：{state,message,qr,ts} 原子写） ----------

async function writeStatus(sf, state, message = '', qr) {
  if (!STATES.has(state)) throw new Error(`未知登录状态：${state}`)
  if (!sf) return
  const payload = JSON.stringify({ state, message, ...(qr ? { qr } : {}), ts: Math.floor(Date.now() / 1000) })
  await mkdir(dirname(sf), { recursive: true })
  const tmp = `${sf}.${process.pid}.tmp`
  await writeFile(tmp, payload, 'utf8')
  await rename(tmp, sf)
}

// ---------- 展示辅助（对齐 Python 版输出契约） ----------

function fmt(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  if (Math.abs(v) >= 100_000_000) return `${(v / 1e8).toFixed(1)}亿`
  if (Math.abs(v) >= 10_000) return `${(v / 1e4).toFixed(1)}万`
  return String(v)
}

function vs(n) {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return ''
  if (v > 0) return `+${fmt(v)}`
  if (v < 0) return `-${fmt(-v)}`
  return ''
}

const httpsify = (u) => typeof u === 'string' && u.startsWith('http://') ? 'https://' + u.slice(7) : u

// ---------- TV QR API ----------

/** 按 key 排序拼接 + 追加 appsec 求 md5，返回可直接 POST 的 form body。 */
function sign(params) {
  const q = Object.keys(params).sort()
    .map(k => `${k}=${encodeURIComponent(String(params[k])).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`)
    .join('&')
  const sig = createHash('md5').update(q + APPSEC).digest('hex')
  return q + '&sign=' + sig
}

async function post(url, params, timeoutMs = 20_000) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: sign(params),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return resp.json()
}

async function genQr() {
  const r = await post(GEN_URL, { appkey: APPKEY, local_id: '0', ts: String(Math.floor(Date.now() / 1000)) })
  if (r.code !== 0) die(`申请二维码失败：${r.code} ${r.message}`)
  const d = r.data ?? {}
  if (!d.url || !d.auth_code) die('二维码响应缺 url/auth_code')
  return [d.url, d.auth_code]
}

// ---------- 二维码 PNG（vendored qrcode.mjs + 手拼 PNG：IHDR/IDAT/IEND） ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/** 把登录 url 编码成二维码 PNG（scale=8、border=2，对齐 segno 调用）。 */
function renderQrPng(url, scale = 8, border = 2) {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const n = qr.getModuleCount()
  const size = (n + border * 2) * scale
  const stride = 1 + size * 3 // 每行前置 filter byte 0
  const raw = Buffer.alloc(stride * size, 0xff)
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.isDark(row, col)) continue
      for (let dy = 0; dy < scale; dy++) {
        const y = (row + border) * scale + dy
        for (let dx = 0; dx < scale; dx++) {
          const x = (col + border) * scale + dx
          const at = y * stride + 1 + x * 3
          raw[at] = raw[at + 1] = raw[at + 2] = 0
        }
      }
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 0  // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

async function poll(authCode) {
  const r = await post(POLL_URL, { appkey: APPKEY, auth_code: authCode, local_id: '0', ts: String(Math.floor(Date.now() / 1000)) })
  return [r.code ?? -1, r.data ?? {}]
}

/** 把 poll 成功的 data 写成 biliup 认的 cookie 文件。
 *  ⚠️ 不要加 `platform` 字段——biliup-rs 解析会报「未知平台」（真机实测）。 */
async function writeCookie(data, cookieFile) {
  await mkdir(dirname(cookieFile), { recursive: true })
  const payload = {
    cookie_info: data.cookie_info ?? null,
    sso: data.sso ?? null,
    token_info: data.token_info ?? null,
  }
  await writeFile(cookieFile, JSON.stringify(payload), 'utf8')
}

// ---------- 子命令 ----------

async function cmdLogin(a) {
  const qrOut = resolve(a.qrOut ?? DEFAULT_QR_OUT)
  const cookieFile = resolve(a.cookie ?? DEFAULT_COOKIE)
  const sf = a.statusFile
  const timeoutS = a.timeout ?? 180
  await writeStatus(sf, 'starting')

  const [url, authCode] = await genQr()
  await mkdir(dirname(qrOut), { recursive: true })
  await writeFile(qrOut, renderQrPng(url))
  await writeStatus(sf, 'qr_ready', '用 B站 App 扫码登录', qrOut)
  console.error(`📱 B站二维码已保存：${qrOut}（B站 App 扫码）`)

  const deadline = Date.now() + timeoutS * 1000
  let scanned = false
  while (Date.now() < deadline) {
    const [code, data] = await poll(authCode)
    if (code === 0) {
      await writeCookie(data, cookieFile)
      await writeStatus(sf, 'success', '登录成功')
      console.log(`✅ B站登录成功，cookie 已写入 ${cookieFile}`)
      await unlink(qrOut).catch(() => {})
      return 0
    }
    if (code === 86038) { // 二维码已失效
      await writeStatus(sf, 'expired', '二维码已失效，请重试')
      console.error('⏱️ 二维码已失效，请重跑 login')
      return 1
    }
    if (code === 86090 && !scanned) { // 已扫码、待手机确认
      scanned = true
      await writeStatus(sf, 'scanned', '已扫码，请在手机上确认登录')
      console.error('📲 已扫码，请在手机确认…')
    }
    await sleep(2000)
  }
  await writeStatus(sf, 'expired', '二维码超时未扫')
  console.error(`⏱️ ${timeoutS}s 内未完成扫码`)
  return 1
}

async function loadCookie(cookieFile) {
  if (!existsSync(cookieFile)) return ['', 0]
  try {
    const d = JSON.parse(await readFile(cookieFile, 'utf8'))
    const cks = d.cookie_info?.cookies ?? []
    const header = cks.filter(c => c.name).map(c => `${c.name}=${c.value}`).join('; ')
    const mid = Math.floor(Number(d.token_info?.mid) || 0)
    return [header, mid]
  } catch {
    return ['', 0]
  }
}

async function api(url, cookie, timeoutMs = 15_000) {
  const resp = await fetch(url, { headers: { Cookie: cookie, 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) })
  return resp.json()
}

async function cmdWhoami(a) {
  // 真校验登录态 + 昵称/头像（调 B站 nav API），输出单行 JSON（永远 exit 0）。
  const result = { loggedIn: false, name: '', avatar: '' }
  const cookieFile = resolve(a.cookie ?? DEFAULT_COOKIE)
  const [cookie] = await loadCookie(cookieFile)
  if (cookie) {
    try {
      const nav = (await api('https://api.bilibili.com/x/web-interface/nav', cookie)).data ?? {}
      if (nav.isLogin) {
        result.loggedIn = true
        result.name = (nav.uname ?? '').slice(0, 40)
        result.avatar = nav.face ?? ''
      }
    } catch (e) {
      result.error = String(e?.message ?? e)
    }
  }
  console.log(JSON.stringify(result))
  return 0
}

async function cmdStats(a) {
  // 抓 B站创作数据（粉丝/关注/获赞/总播放/投稿数），输出单行 JSON（对齐 account_stats 结构）。
  const cookieFile = resolve(a.cookie ?? DEFAULT_COOKIE)
  const [cookie, cookieMid] = await loadCookie(cookieFile)
  const r = {
    platform: 'bilibili', name: 'B站', nickname: '', loggedIn: false,
    followers: null, likes: null, following: null, posts: null,
    metrics: [], notes: [],
    growth: { last: { followers: 0, likes: 0, posts: null, since_days: 0 }, day: null, week: null, month: null, year: null },
    fetched_at: Math.floor(Date.now() / 1000),
  }
  if (!cookie) {
    console.log(JSON.stringify(r))
    return 0
  }
  try {
    const nav = (await api('https://api.bilibili.com/x/web-interface/nav', cookie)).data ?? {}
    r.loggedIn = Boolean(nav.isLogin)
    r.nickname = (nav.uname ?? '').slice(0, 40)
    const mid = cookieMid || Math.floor(Number(nav.mid) || 0)
    const stat = (await api('https://api.bilibili.com/x/web-interface/nav/stat', cookie)).data ?? {}
    r.followers = stat.follower
    r.following = stat.following

    // 近7日·环比：创作中心总览 index/stat 给「累计 total_* + 近期增量 incr_*/inc_*」。
    // 字段名不统一（有的 incr_ 有的 inc_），按对逐个取。
    const st = (await api('https://member.bilibili.com/x/web/index/stat', cookie)).data ?? {}
    if (st) {
      r.likes = st.total_like
      const pairs = [ // (标签, 累计键, 增量键)
        ['播放', 'total_click', 'incr_click'],
        ['获赞', 'total_like', 'inc_like'],
        ['评论', 'total_reply', 'incr_reply'],
        ['收藏', 'total_fav', 'inc_fav'],
        ['分享', 'total_share', 'inc_share'],
        ['涨粉', 'total_fans', 'incr_fans'],
      ]
      r.metrics = pairs
        .filter(([, tk]) => st[tk] !== undefined && st[tk] !== null)
        .map(([lab, tk, ik]) => ({ label: lab, value: fmt(st[tk] || 0), vs: vs(st[ik]) }))
    }

    // 最近作品：创作中心稿件列表（cookie 鉴权、无需 wbi 签名）。
    const arc = (await api('https://member.bilibili.com/x/web/archives?status=pubed&pn=1&ps=6', cookie)).data ?? {}
    const items = arc.arc_audits ?? arc.archives ?? []
    r.posts = arc.page?.count ?? r.posts
    r.notes = items.slice(0, 6).map(it => {
      const av = it.Archive ?? it.archive ?? it
      const sv = it.stat ?? {}
      const bvid = av.bvid ?? ''
      return {
        title: av.title || '(无标题)',
        url: bvid ? `https://www.bilibili.com/video/${bvid}` : '',
        cover: httpsify(av.cover ?? ''),
        stat: `▶${fmt(sv.view ?? 0)} 👍${fmt(sv.like ?? 0)} 💬${fmt(sv.reply ?? 0)}`,
      }
    })
  } catch (e) {
    r.error = String(e?.message ?? e)
  }
  console.log(JSON.stringify(r))
  return 0
}

async function cmdCheck() {
  const ck = DEFAULT_COOKIE
  console.log(`✅ 二维码库已内置（vendor/qrcode.mjs）`)
  console.log(`cookie：${existsSync(ck) ? '✅ 已存在 ' + ck : '未登录（login 扫码生成）'}`)
  return 0
}

async function cmdSelftest() {
  console.error('bili_login 自检（离线）...')
  // 签名稳定 + 排序正确
  const body = sign({ b: '2', appkey: 'k', a: '1' })
  assert.ok(body.startsWith('a=1&appkey=k&b=2&sign='), body)
  assert.equal(body.slice(body.lastIndexOf('sign=') + 5).length, 32, 'sign 应为 32 位 md5')
  // cookie 写盘格式
  const tmp = join(PROJECT_ROOT, 'outputs', `_selftest-${process.pid}`, 'cookies.json')
  await writeCookie({ cookie_info: { cookies: [{ name: 'SESSDATA', value: 'x' }] }, sso: ['s'], token_info: { mid: 1, access_token: 't' } }, tmp)
  const d = JSON.parse(await readFile(tmp, 'utf8'))
  assert.equal(d.token_info.access_token, 't')
  assert.equal(d.cookie_info.cookies[0].name, 'SESSDATA')
  assert.ok(!('platform' in d), 'biliup cookie 不能含 platform 字段（会报未知平台）')
  await unlink(dirname(tmp)).catch(() => {})
  // 二维码渲染
  const qp = join(PROJECT_ROOT, 'outputs', `_selftest-${process.pid}`, 'q.png')
  await writeFile(qp, renderQrPng('https://example.com', 4, 2))
  assert.ok((await stat(qp)).size > 100)
  await unlink(dirname(qp)).catch(() => {})
  assert.ok(STATES.has('success') && STATES.has('qr_ready'))
  console.log('✅ selftest 通过（签名/排序 + cookie 格式 + 二维码渲染 + 状态机）')
  return 0
}

import { strict as assert } from 'node:assert'

// ---------- CLI ----------

function parseArgs(argv) {
  const a = { _: argv[0] ?? 'help' }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--qr-out') a.qrOut = argv[++i]
    else if (arg === '--status-file') a.statusFile = argv[++i]
    else if (arg === '--cookie') a.cookie = argv[++i]
    else if (arg === '--timeout') a.timeout = Number(argv[++i])
  }
  return a
}

const a = parseArgs(process.argv.slice(2))
const handlers = { login: cmdLogin, whoami: cmdWhoami, stats: cmdStats, check: cmdCheck, selftest: cmdSelftest }
const handler = handlers[a._]
if (!handler) {
  console.error('usage: node bili_login.mjs <login|whoami|stats|check|selftest> [--qr-out P] [--status-file P] [--cookie P] [--timeout S]')
  process.exit(1)
}
handler(a).then(code => { process.exitCode = code })
