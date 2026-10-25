// 抖音创作者活动源（热点雷达 douyin_activity）的纯逻辑层。数据来自创作服务
// 平台两个免签名接口（2026-10-25 实测定档）：活动广场 pc/list 与创作灵感
// inspiration/activities，登录态（cookie）必需——匿名/失效统一回
// status_code=8「用户未登录」。取数、cookie 提取与降级链在宿主半 index.js，
// 这里保持 node --test 可直接覆盖的纯函数。

import { normalizeTrendTitle } from './trends.js'

/** 活动两个数据面的 URL 模板（query 参数由取数层拼装）。 */
export const DOUYIN_ACTIVITY_URLS = {
  pcList: 'https://creator.douyin.com/web/api/v2/creator/activity/pc/list',
  inspiration: 'https://creator.douyin.com/web/api/creator/inspiration/activities/',
}

/** cookie 缓存落点（outputs 下相对路径，与 _login 的发布登录状态同区）。 */
export const DOUYIN_ACTIVITY_COOKIE_FILE = '_login/douyin_activity_cookies.json'

/** 创作服务平台「用户未登录」的网关码：cookie 失效的判定信号。 */
export const DOUYIN_AUTH_STATUS_CODE = 8

/** 单源容量：活动广场一页 + 创作灵感，截到 60 保护轨迹文件。 */
export const DOUYIN_ACTIVITY_MAX_ITEMS = 60

/**
 * 活动广场的查询窗口：now-90d ~ now+180d。宽窗覆盖进行中与预告期活动；
 * 已结束的由解析层按 show_end_time 过滤，窗口只影响服务端候选集。
 * @param {number} now - 当前时刻（秒）。
 * @returns {{start_time: number, end_time: number}}
 */
export function douyinActivityWindow(now) {
  return { start_time: Math.floor(now - 90 * 86400), end_time: Math.floor(now + 180 * 86400) }
}

/**
 * 判一份创作服务平台响应是否为「用户未登录」（cookie 失效）。
 * @param {unknown} payload - 接口 JSON。
 * @returns {boolean}
 */
export function douyinAuthFailed(payload) {
  return payload !== null && typeof payload === 'object' && payload.status_code === DOUYIN_AUTH_STATUS_CODE
}

/**
 * 解活动跳转链接里的 web 落点：`aweme://webview?url=<编码 https>` 解内嵌 url；
 * `sslocal://`（直播/原生页）无 web 落点回空串；直接 https 原样返回。
 * @param {unknown} link - 接口的 jump_link 字段。
 * @returns {string}
 */
export function decodeDouyinJumpLink(link) {
  if (typeof link !== 'string' || link === '') return ''
  if (/^https?:/i.test(link)) return link
  const match = /^(?:aweme|snssdk1128):\/\/webview\?url=([^&]+)/i.exec(link)
  if (match === null) return ''
  try {
    const url = decodeURIComponent(match[1])
    return /^https?:/i.test(url) ? url : ''
  } catch { /* 百分号残缺按无落点处理 */ }
  return ''
}

/**
 * 截止文案 `至 MM-DD`（活动条目的 hot 字段，创作者最关心的信息）。
 * @param {number} endTime - 活动截止时刻（秒）。
 * @returns {string}
 */
export function formatDouyinDeadline(endTime) {
  if (!Number.isFinite(endTime) || endTime <= 0) return ''
  const date = new Date(endTime * 1000)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `至 ${mm}-${dd}`
}

/** 活动条目的公共整形：过滤已结束、hot=截止文案、url 解 web 落点。 */
function shapeActivity(item, now) {
  if (item === null || typeof item !== 'object') return null
  const title = typeof item.show_name === 'string' ? item.show_name.trim() : ''
  if (!title) return null
  const endTime = typeof item.show_end_time === 'number' ? item.show_end_time
    : (typeof item.end_time === 'number' ? item.end_time : 0)
  if (endTime > 0 && endTime < now) return null
  return { title, hot: formatDouyinDeadline(endTime), url: decodeDouyinJumpLink(item.jump_link) }
}

/**
 * 活动广场（pc/list）→ 条目，保持接口的策展顺序；status_code 非 0（含未登录）
 * 与结构缺失按空处理——失效判定用 douyinAuthFailed，由取数层决定重试。
 * @param {unknown} payload - pc/list 的 JSON。
 * @param {number} now - 当前时刻（秒）。
 * @returns {Array<{title: string, hot: string, url: string}>}
 */
export function parseDouyinActivityPc(payload, now) {
  if (payload === null || typeof payload !== 'object' || payload.status_code !== 0) return []
  const out = []
  for (const item of Array.isArray(payload.list) ? payload.list : []) {
    const shaped = shapeActivity(item, now)
    if (shaped !== null) out.push(shaped)
  }
  return out
}

/**
 * 创作灵感推荐（inspiration/activities）→ 条目，接在活动广场之后；
 * 与广场重名的条目由轨迹层按归一化标题去重（保留广场版本）。
 * @param {unknown} payload - inspiration 的 JSON。
 * @param {number} now - 当前时刻（秒）。
 * @returns {Array<{title: string, hot: string, url: string}>}
 */
export function parseDouyinActivityInspiration(payload, now) {
  if (payload === null || typeof payload !== 'object' || payload.status_code !== 0) return []
  const out = []
  for (const item of Array.isArray(payload.activities) ? payload.activities : []) {
    const shaped = shapeActivity(item, now)
    if (shaped !== null) out.push(shaped)
  }
  return out
}

/**
 * 两份数据合并并截到 DOUYIN_ACTIVITY_MAX_ITEMS（广场在前、灵感补位）。跨数据面
 * 重名（灵感与广场大量重叠）按归一化标题去重、先到先得——预算留给不同活动，
 * 这也是轨迹层去重之外的唯一一处（两处语义不同：这里为预算，那里为榜单整形）。
 * @param {unknown[]} parts - 各数据面的解析输出。
 * @returns {Array<{title: string, hot: string, url: string}>}
 */
export function mergeDouyinActivityItems(parts) {
  const items = []
  const seen = new Set()
  for (const part of Array.isArray(parts) ? parts : []) {
    for (const item of Array.isArray(part) ? part : []) {
      if (item === null || typeof item !== 'object' || typeof item.title !== 'string' || item.title.trim() === '') continue
      const key = normalizeTrendTitle(item.title)
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }
  }
  return items.slice(0, DOUYIN_ACTIVITY_MAX_ITEMS)
}

/**
 * 读 cookie 缓存：`{cookie, at}`，cookie 为空串或结构不合法回 null。
 * @param {unknown} raw - 缓存文件的 JSON 内容。
 * @returns {{cookie: string, at: number}|null}
 */
export function readDouyinCookieCache(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const cookie = typeof raw.cookie === 'string' ? raw.cookie.trim() : ''
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : 0
  if (cookie === '' || at <= 0) return null
  return { cookie, at }
}

/**
 * cookie 缓存的落盘形态。
 * @param {string} cookie - cookie 请求头全量字符串。
 * @param {number} at - 提取时刻（秒）。
 * @returns {{cookie: string, at: number}}
 */
export function serializeDouyinCookieCache(cookie, at) {
  return { cookie, at }
}
