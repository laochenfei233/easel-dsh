// 热点雷达右键抓取正文（spec easel-hotspot-radar §D6）：URL 安全门、HTML 正文
// 提取、内容库文件命名与选题 upsert。抓取与 DNS 做成注入依赖——单测用本地
// fixture，不联网；路由接线（真实 fetchPage/proxy/mutateIdeas）在宿主半 index.js。

import { createHash, randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { sanitizeProjectTitle } from './projectize.js'

/** 带 status 的路由错误；index.js 侧转成 ApiError 以走统一的 4xx/5xx 通道。 */
export class RadarArticleError extends Error {
  constructor(status, detail) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

// ---- URL 安全（热榜链接来自第三方，不能当本地可信输入）----

const PRIVATE_IPV4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|100\.6[4-9]\.|100\.[7-9]\d\.|100\.1[01]\d\.|100\.12[0-7]\.|172\.(1[6-9]|2\d|3[01])\.)/
const PRIVATE_IPV6 = /^(::1$|f[cd][0-9a-f]{2}:|fe80:)/i

/**
 * Whether one resolved IP address (v4/v6, IPv4-mapped normalized) is private,
 * loopback, or link-local.
 * @param {string} address - the resolved address.
 * @returns {boolean} true when the address must be refused.
 */
export function isPrivateAddress(address) {
  let value = String(address ?? '').toLowerCase()
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value)
  if (mapped !== null) value = mapped[1]
  return value.includes(':') ? PRIVATE_IPV6.test(value) : PRIVATE_IPV4.test(value)
}

/**
 * 校验一条抓取目标 URL：仅 http/https、无凭据、主机不是 localhost/.local，
 * IP 字面量主机不得指向内网。域名主机的解析校验在 assertPublicHost。
 * @param {string} urlStr - 候选 URL。
 * @returns {URL} 解析后的 URL。
 * @throws {RadarArticleError} 400 当 URL 不合格。
 */
export function assertPublicHttpUrl(urlStr) {
  let url
  try {
    url = new URL(String(urlStr ?? '').trim())
  } catch {
    throw new RadarArticleError(400, '原文链接不合法')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new RadarArticleError(400, '仅支持 http/https 链接')
  if (url.username || url.password) throw new RadarArticleError(400, '链接不能携带凭据')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local')) throw new RadarArticleError(400, '拒绝访问本机地址')
  if (isPrivateAddress(host)) throw new RadarArticleError(400, '拒绝访问内网地址')
  return url
}

/**
 * 解析域名并确认全部 A/AAAA 记录都是公网地址；解析失败按普通抓取失败处理
 * （降级为标题+链接），解析到内网才是 400。IP 字面量主机无需解析。
 * @param {URL} url - 已通过 assertPublicHttpUrl 的 URL。
 * @param {Function} lookupHost - node:dns/promises 的 lookup 注入点。
 */
export async function assertPublicHost(url, lookupHost) {
  if (/^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) return
  let records
  try {
    records = await lookupHost(url.hostname, { all: true, verbatim: true })
  } catch (error) {
    throw new Error(`域名无法解析（${error?.code ?? error?.message ?? '未知'}）`)
  }
  if (records.some(record => isPrivateAddress(record.address))) {
    throw new RadarArticleError(400, '拒绝访问内网地址')
  }
}

/** 跟随上限（每跳重新过安全门）。 */
const MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * 抓正文文档：跟随 ≤3 次跳转，每跳重新校验公网性。fetchPage 不跟随重定向。
 * @param {string} urlStr - 入口 URL。
 * @param {{fetchPage: Function, lookupHost: Function, proxyUrl?: string}} deps
 * @returns {Promise<{url: string, status: number, contentType: string, body: Buffer}>}
 * @throws {RadarArticleError} 400 安全门拒绝。
 * @throws {Error} 网络/跳转失败（调用方降级）。
 */
export async function fetchArticleDocument(urlStr, { fetchPage, lookupHost, proxyUrl = '' }) {
  let current = urlStr
  for (let hop = 0; ; hop += 1) {
    const url = assertPublicHttpUrl(current)
    await assertPublicHost(url, lookupHost)
    const res = await fetchPage(current, { proxyUrl })
    if (REDIRECT_STATUSES.has(res.status)) {
      if (hop >= MAX_REDIRECTS) throw new Error('跳转过多')
      const location = res.headers?.location
      if (!location) throw new Error('跳转缺少目标')
      current = new URL(location, current).toString()
      continue
    }
    return { url: current, status: res.status, contentType: String(res.headers?.['content-type'] ?? ''), body: res.body }
  }
}

// ---- HTML → 正文（无 DOM、无依赖的正则提取）----

const NAMED_ENTITIES = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&', nbsp: ' ' }

/** 解具名与数字 HTML 实体；&amp; 最后替换避免二次解包。 */
export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&quot;|&apos;|&lt;|&gt;|&nbsp;/g, name => NAMED_ENTITIES[name.slice(1, -1)])
    .replace(/&amp;/g, '&')
}

function safeCodePoint(code) {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
}

/** 去标签：块级闭合转段落分隔，行内压空白。 */
function stripTags(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section|article)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const ARTICLE_BODY_FLOOR = 200
const ARTICLE_BODY_CAP = 100_000

/**
 * 从 HTML 提取正文：article → main → 全页；<p> 段落优先，不足 200 字符退化为
 * 整页去标签。同时取 og:title/<title> 与 og:description/meta description。
 * @param {string} html - 原始 HTML。
 * @returns {{title: string, description: string, text: string}}
 */
export function extractArticle(html) {
  const text = String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|iframe|form|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, '')
  const metaContent = (name) => {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i').exec(text)
    const content = tag !== null ? /content=["']([^"']*)["']/i.exec(tag[0]) : null
    return content !== null ? decodeEntities(content[1]).trim() : ''
  }
  const rawTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1] ?? ''
  const title = metaContent('og:title') || decodeEntities(rawTitle).replace(/\s+/g, ' ').trim()
  const description = metaContent('og:description') || metaContent('description')

  const container = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(text)?.[1]
    ?? /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(text)?.[1]
    ?? text
  const paragraphs = []
  for (const match of container.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const paragraph = stripTags(match[1])
    if (paragraph !== '') paragraphs.push(paragraph)
  }
  let body = paragraphs.join('\n\n')
  if (body.replace(/\s/g, '').length < ARTICLE_BODY_FLOOR) {
    const whole = stripTags(container)
    if (whole.replace(/\s/g, '').length > body.replace(/\s/g, '').length) body = whole
  }
  return { title, description, text: body.slice(0, ARTICLE_BODY_CAP) }
}

const LOGIN_WALL = /验证码|扫码登录|请登录|登录后查看|密码登录|账号登录|立即注册|\/login|sign\s?in/i

/**
 * 登录/验证码墙启发式：命中登录特征且正文很短。这类页面绝不写进内容库。
 * @param {string} title - 页面标题。
 * @param {string} text - 提取的正文。
 * @returns {boolean}
 */
export function looksLikeLoginWall(title, text) {
  return LOGIN_WALL.test(`${title}\n${text}`) && text.length < 600
}

/**
 * 按响应头 / meta charset 解码 HTML（UTF-8 优先；解码器不支持该标签时回退 UTF-8）。
 * @param {{headers: object, body: Buffer}} res
 * @returns {string}
 */
export function decodeHtmlBody(res) {
  const buffer = res.body ?? Buffer.alloc(0)
  let charset = /charset=["']?([\w-]+)/i.exec(String(res.headers?.['content-type'] ?? ''))?.[1]?.toLowerCase()
  if (!charset) {
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buffer.subarray(0, 2048).toString('latin1'))?.[1]?.toLowerCase()
  }
  if (charset !== undefined) {
    try {
      return new TextDecoder(charset).decode(buffer)
    } catch { /* 未知编码标签 → UTF-8 兜底 */ }
  }
  return new TextDecoder('utf-8').decode(buffer)
}

// ---- 内容库文件与选题 upsert ----

/**
 * 内容库文件名：`<slug>-<urlHash8>.md`。slug 复用项目目录清洗（≤24 字符，
 * 空标题回退「热点」）；hash 让同一 URL 稳定、不同 URL 不撞名。
 * @param {string} title - 文章标题。
 * @param {string} url - 最终 URL（决定 hash）。
 * @returns {string}
 */
export function articleFileName(title, url) {
  const slug = sanitizeProjectTitle(title, '热点').slice(0, 24) || '热点'
  const hash = createHash('sha256').update(String(url ?? '')).digest('hex').slice(0, 8)
  return `${slug}-${hash}.md`
}

/**
 * 内容库 markdown 组装。头部用引用块而不是 YAML frontmatter——内容库的
 * markdown 预览会把 `---` 渲染成分隔线。
 * @param {{title: string, source: string, rank?: number|string, hot?: string, url: string, fetchedAt: Date|string, body: string}} parts
 * @returns {string}
 */
export function composeArticleMarkdown({ title, source, rank, hot, url, fetchedAt, body }) {
  const sourceBits = [source, rank !== undefined && rank !== '' ? `第 ${rank} 名` : '', hot ? `热度 ${hot}` : '']
    .filter(Boolean).join(' · ')
  const when = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt)
  const lines = [
    `# ${title}`,
    '',
    ...(sourceBits !== '' ? [`> 来源：${sourceBits}`] : []),
    ...(url ? [`> 原文：${url}`] : []),
    `> 抓取：${Number.isNaN(when.getTime()) ? String(fetchedAt) : when.toLocaleString('zh-CN', { hour12: false })}`,
    '',
    body,
    '',
  ]
  return lines.join('\n')
}

/**
 * 选题 upsert（纯函数）：按 url 精确匹配。命中复用（更新 url/bodyPath，
 * 仅在 note 为空时填摘要，不动用户改过的 title/note/status）；未命中 unshift 新条目。
 * @param {object[]} items - _ideas.json 现有内容。
 * @param {{id: string, title: string, note: string, source: string, url: string, bodyPath?: string, created: number}} entry
 * @returns {{items: object[], idea: object, reused: boolean}}
 */
export function upsertIdeaEntry(items, { id, title, note, source, url, bodyPath, created }) {
  const list = Array.isArray(items) ? items : []
  const index = list.findIndex(item => item !== null && typeof item === 'object' && item.url === url)
  if (index === -1) {
    const idea = {
      id, title, note,
      source: source || '热点雷达',
      status: 'pending', created, url,
      ...(bodyPath ? { bodyPath } : {}),
    }
    return { items: [idea, ...list], idea, reused: false }
  }
  const idea = { ...list[index], url }
  if (bodyPath) idea.bodyPath = bodyPath
  if (!idea.note && note) idea.note = note
  const next = [...list]
  next[index] = idea
  return { items: next, idea, reused: true }
}

// ---- 路由 handler 工厂（依赖注入，测试不联网）----

/** content-type 不是网页时的降级提示。 */
const NON_HTML_TYPES = /html|xml|plain/i

/**
 * 创建 `POST /api/radar/article` 的 handler。
 * @param {object} deps
 * @param {(url: string, opts: {proxyUrl: string}) => Promise<{status: number, headers: object, body: Buffer}>} deps.fetchPage
 *   单跳抓取（不跟随重定向），网络错误直接抛。
 * @param {Function} deps.lookupHost - dns lookup 注入点。
 * @param {object} deps.io - 宿主半的 IO 能力：`writeText(path, content)`、
 *   `mutateIdeas(settings, mutator)`、`readIdeas(settings)`、`proxyUrl(settings)`。
 * @returns {(c: object) => Promise<object>} dispatch 兼容的 handler。
 */
export function createCaptureHandler({ fetchPage, lookupHost, io }) {
  return async function captureArticle(c) {
    const body = await c.body()
    const title = String(body?.title ?? '').trim()
    if (!title) throw new RadarArticleError(400, '缺少标题')
    const urlRaw = String(body?.url ?? '').trim()
    const proxyUrl = await io.proxyUrl(c.settings)

    const warnings = []
    let html = null
    let resolvedUrl = ''
    if (urlRaw !== '') {
      try {
        const res = await fetchArticleDocument(urlRaw, { fetchPage, lookupHost, proxyUrl })
        resolvedUrl = res.url
        if (res.status < 200 || res.status >= 300) {
          warnings.push(`上游返回 ${res.status}`)
        } else if (!NON_HTML_TYPES.test(res.contentType)) {
          warnings.push('非 HTML 页面')
        } else {
          html = decodeHtmlBody(res)
        }
      } catch (error) {
        if (error instanceof RadarArticleError) throw error
        warnings.push(/timeout/i.test(String(error?.message)) ? '抓取超时' : (error?.message ?? '链接无法访问'))
      }
    }

    let text = ''
    let description = ''
    if (html !== null) {
      const extracted = extractArticle(html)
      description = extracted.description
      if (looksLikeLoginWall(extracted.title, extracted.text)) {
        warnings.push('需登录')
      } else if (extracted.text.replace(/\s/g, '') === '') {
        warnings.push('未提取到正文')
      } else {
        text = extracted.text
        if (extracted.text.replace(/\s/g, '').length < ARTICLE_BODY_FLOOR) warnings.push('正文过短')
      }
    }

    let bodyPath
    if (text !== '') {
      // 同 URL 再抓复用既有 bodyPath：同一选题改标题也不新建第二个文件（spec D6 边界）。
      // 查重用最终 URL（首抓即存 finalUrl），在写文件前完成。
      const existingIdea = resolvedUrl === '' ? undefined : (await io.readIdeas(c.settings))
        .find(item => item !== null && typeof item === 'object' && item.url === resolvedUrl)
      bodyPath = existingIdea?.bodyPath ?? `热点正文/${articleFileName(title, resolvedUrl)}`
      const markdown = composeArticleMarkdown({
        title, source: String(body?.source ?? ''), rank: body?.rank, hot: body?.hot,
        url: resolvedUrl, fetchedAt: new Date(), body: text,
      })
      try {
        await io.writeText(join(c.settings.projectRoot, 'outputs', ...bodyPath.split('/')), markdown)
      } catch {
        bodyPath = undefined
        warnings.push('正文保存失败')
      }
    }

    const { idea, reused } = await io.mutateIdeas(c.settings, items => upsertIdeaEntry(items, {
      id: randomBytes(6).toString('hex'),
      title,
      note: description.trim().slice(0, 200),
      source: String(body?.source ?? '').trim(),
      url: resolvedUrl,
      bodyPath,
      created: Math.floor(Date.now() / 1000),
    }))
    return {
      json: {
        ok: true, idea, bodyPath, reused,
        ...(text !== '' ? { chars: text.length } : {}),
        ...(warnings.length > 0 ? { warning: warnings.join('；') } : {}),
      },
    }
  }
}
