// 最小 CalDAV 客户端：只读订阅用。零依赖，协议纯函数（ICS 解析、RRULE 展开、
// multistatus 提取）与请求编排分离，requester 可注入以便离线测试。
// ponytail: RRULE 只支持 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY + INTERVAL/COUNT/UNTIL +
// WEEKLY BYDAY + MONTHLY BYMONTHDAY，TZID 按本地墙钟处理，RECURRENCE-ID 覆盖实例丢弃；
// 不支持的分隔规则回退为仅首实例。升级路径：引 rrule.js 并解 VTIMEZONE。
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

const DAY_MS = 86400000
const MAX_INTERVALS = 1000

// ---- 请求体模板 ----

const XMLNS = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"'

export const PROPFIND_PRINCIPAL_BODY =
  `<?xml version="1.0" encoding="utf-8"?><d:propfind ${XMLNS}><d:prop><d:current-user-principal/></d:prop></d:propfind>`
export const PROPFIND_HOMESET_BODY =
  `<?xml version="1.0" encoding="utf-8"?><d:propfind ${XMLNS}><d:prop><c:calendar-home-set/></d:prop></d:propfind>`
export const PROPFIND_CALENDARS_BODY =
  `<?xml version="1.0" encoding="utf-8"?><d:propfind ${XMLNS}><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>`

/** calendar-query REPORT 请求体，时间范围为 iCalendar UTC 格式。 */
export function calendarQueryBody(fromUtc, toUtc) {
  return `<?xml version="1.0" encoding="utf-8"?><c:calendar-query ${XMLNS}><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${fromUtc}" end="${toUtc}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`
}

// ---- HTTP ----

/** 默认 requester：Node 内建 http/https，返回 {status, text}；网络错误 reject。 */
export function nodeRequester({ url, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const doRequest = target.protocol === 'http:' ? httpRequest : httpsRequest
    const req = doRequest(target, { method, headers }, (res) => {
      const chunks = []
      let size = 0
      res.on('data', (chunk) => {
        size += chunk.length
        if (size > 10 * 1024 * 1024) {
          req.destroy(new Error('CalDAV 响应超过 10MB，已中止'))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.setTimeout(20000, () => req.destroy(new Error('CalDAV 请求超时')))
    if (body !== undefined) req.write(body)
    req.end()
  })
}

/** 带基本认证的 CalDAV 请求；4xx 抛错并带状态码。 */
export async function caldavRequest(account, { url, method, headers = {}, body }, requestImpl = nodeRequester) {
  const auth = account.username
    ? `Basic ${Buffer.from(`${account.username}:${account.password || ''}`).toString('base64')}`
    : undefined
  const res = await requestImpl({
    url,
    method,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', ...(auth ? { Authorization: auth } : {}), ...headers },
    body,
  })
  if (res.status === 401) throw new Error('CalDAV 认证失败（401）：检查用户名与应用专用密码')
  if (res.status >= 400) throw new Error(`CalDAV 请求失败（HTTP ${res.status}）：${method} ${url}`)
  return res
}

// ---- XML 提取（multistatus 为机器生成，按已知标签做命名空间前缀无关提取） ----

function decodeXmlEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, ent) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[ent])
}

function xmlText(fragment, localName) {
  const match = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([^<]*)<`, 'i').exec(fragment)
  return match === null ? '' : decodeXmlEntities(match[1].trim())
}

function stripCdata(text) {
  const match = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(text)
  return match ? match[1] : text
}

/** multistatus 里的 response 块。 */
function responseBlocks(xml) {
  return xml.match(/<(?:[\w.-]+:)?response(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w.-]+:)?response>/gi) || []
}

/** 解析 REPORT multistatus → [{href, calendarData}]（仅含带 calendar-data 的块）。 */
export function parseMultistatus(xml) {
  const result = []
  for (const block of responseBlocks(xml)) {
    const href = xmlText(block, 'href')
    const calendarData = /<(?:[\w.-]+:)?calendar-data(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?calendar-data>/i.exec(block)
    if (href && calendarData) result.push({ href, calendarData: stripCdata(calendarData[1]) })
  }
  return result
}

/** 解析日历集合列表 → [{href, displayname}]（resourcetype 含 calendar 的块）。 */
export function parseCalendarList(xml) {
  const result = []
  for (const block of responseBlocks(xml)) {
    if (!/<(?:[\w.-]+:)?calendar(?:\s[^>]*)?\/?>/i.test(block)) continue
    const href = xmlText(block, 'href')
    if (!href) continue
    const fallback = decodeURIComponent(href.replace(/\/$/, '').split('/').pop() || '') || '日历'
    result.push({ href, displayname: xmlText(block, 'displayname') || fallback })
  }
  return result
}

function firstHref(fragment) {
  return xmlText(fragment, 'href')
}

/** current-user-principal 的 href。 */
export function parsePrincipalHref(xml) {
  const match = /<(?:[\w.-]+:)?current-user-principal(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?current-user-principal>/i.exec(xml)
  return match === null ? '' : firstHref(match[1])
}

/** calendar-home-set 的 href（首个）。 */
export function parseHomeSetHref(xml) {
  const match = /<(?:[\w.-]+:)?calendar-home-set(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?calendar-home-set>/i.exec(xml)
  return match === null ? '' : firstHref(match[1])
}

function resolveHref(base, href) {
  if (/^https?:\/\//i.test(href)) return href
  return new URL(href, base.endsWith('/') ? base : `${base}/`).toString()
}

/**
 * 自动发现可订阅日历。输入 URL 可以是服务器根、principal 或日历集合：
 * 先试 Depth:1 列集合，列不到日历再走 current-user-principal → calendar-home-set 链。
 */
export async function discoverCalendars(account, requestImpl = nodeRequester) {
  const direct = await caldavRequest(account, {
    url: account.url, method: 'PROPFIND', headers: { Depth: '1' }, body: PROPFIND_CALENDARS_BODY,
  }, requestImpl).catch(() => ({ status: 0, text: '' }))
  const directList = parseCalendarList(direct.text || '')
  if (directList.length > 0) return directList
  if (direct.status !== 0 && direct.status !== 207) {
    throw new Error(`CalDAV 服务不可达（HTTP ${direct.status}）：${account.url}`)
  }
  const principalRes = await caldavRequest(account, {
    url: account.url, method: 'PROPFIND', headers: { Depth: '0' }, body: PROPFIND_PRINCIPAL_BODY,
  }, requestImpl)
  const principalHref = parsePrincipalHref(principalRes.text)
  if (!principalHref) throw new Error('未找到 current-user-principal：确认该地址是 CalDAV 服务或日历 URL')
  const principalUrl = resolveHref(account.url, principalHref)
  const homeRes = await caldavRequest(account, {
    url: principalUrl, method: 'PROPFIND', headers: { Depth: '0' }, body: PROPFIND_HOMESET_BODY,
  }, requestImpl)
  const homeHref = parseHomeSetHref(homeRes.text)
  if (!homeHref) throw new Error('未找到 calendar-home-set：该账号可能没有日历服务')
  const homeUrl = resolveHref(principalUrl, homeHref)
  const listRes = await caldavRequest(account, {
    url: homeUrl, method: 'PROPFIND', headers: { Depth: '1' }, body: PROPFIND_CALENDARS_BODY,
  }, requestImpl)
  const list = parseCalendarList(listRes.text).map((cal) => ({ ...cal, href: resolveHref(homeUrl, cal.href) }))
  if (list.length === 0) throw new Error('该账号下没有可订阅的日历')
  return list
}

/** REPORT 拉取并展开时间窗内的全部事件（start/end 为格式化字符串）。 */
export async function syncCalendarEvents(account, windowStart, windowEnd, requestImpl = nodeRequester) {
  const hrefs = Array.isArray(account.calendars) && account.calendars.length > 0 ? account.calendars : [account.url]
  const events = []
  for (const href of hrefs) {
    const res = await caldavRequest(account, {
      url: href,
      method: 'REPORT',
      headers: { Depth: '1' },
      body: calendarQueryBody(icsUtc(windowStart), icsUtc(windowEnd)),
    }, requestImpl)
    for (const { calendarData } of parseMultistatus(res.text)) {
      for (const occurrence of expandEvents(parseIcsEvents(calendarData), windowStart, windowEnd)) {
        events.push({
          uid: occurrence.uid,
          title: occurrence.title,
          allDay: occurrence.allDay,
          start: occurrence.allDay ? formatDate(occurrence.start) : formatDateTime(occurrence.start),
          end: occurrence.allDay ? formatDate(occurrence.end) : formatDateTime(occurrence.end),
          location: occurrence.location,
          description: occurrence.description,
        })
      }
    }
  }
  return events
}

function icsUtc(ms) {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// ---- iCalendar 解析 ----

/** 折叠行展开（RFC 5545：续行以空格/制表符开头）。 */
export function unfoldIcs(text) {
  const lines = []
  for (const raw of text.split(/\r\n|\n|\r/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1)
    } else {
      lines.push(raw)
    }
  }
  return lines
}

function parseIcsDate(value) {
  const compact = value.trim().replace(/[-:]/g, '')
  if (/^\d{8}$/.test(compact)) {
    return { allDay: true, date: localDate(`${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`, null) }
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(compact)
  if (match === null) return null
  const [, y, mo, d, h, mi, s, z] = match
  if (z === 'Z') return { allDay: false, date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) }
  // 浮动时间或 TZID：按本地墙钟处理（ponytail 注明的 v1 简化）
  return { allDay: false, date: new Date(+y, +mo - 1, +d, +h, +mi, +s) }
}

function localDate(ymd, time) {
  const [y, mo, d] = ymd.split('-').map(Number)
  if (time === null) return new Date(y, mo - 1, d)
  const [h, mi] = time.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi)
}

function icsText(value) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

/** 解析一条属性行 → {name, params, value}；冒号在引号外才算分隔。 */
function parsePropLine(line) {
  let inQuote = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuote = !inQuote
    else if (ch === ':' && !inQuote) { colon = i; break }
  }
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const segs = []
  let cur = ''
  inQuote = false
  for (const ch of head) {
    if (ch === '"') inQuote = !inQuote
    if (ch === ';' && !inQuote) { segs.push(cur); cur = '' } else cur += ch
  }
  segs.push(cur)
  const params = {}
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf('=')
    if (eq > 0) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).replace(/^"|"$/g, '')
    else params[seg.toUpperCase()] = ''
  }
  return { name: segs[0].toUpperCase(), params, value }
}

function parseRrule(value) {
  const parts = {}
  for (const seg of value.split(';')) {
    const eq = seg.indexOf('=')
    if (eq > 0) parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1)
  }
  const freq = (parts.FREQ || '').toUpperCase()
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null
  const rule = {
    freq,
    interval: Math.max(1, parseInt(parts.INTERVAL || '1', 10) || 1),
    count: parts.COUNT !== undefined ? parseInt(parts.COUNT, 10) : null,
    until: null,
    untilEndOfDay: false,
    byDay: (parts.BYDAY || '').split(',').filter(Boolean).map((token) => 'MO TU WE TH FR SA SU'.indexOf(token.trim().slice(-2)) / 3).filter((n) => n >= 0),
    byMonthDay: (parts.BYMONTHDAY || '').split(',').filter(Boolean).map(Number).filter((n) => n !== 0),
  }
  if (parts.UNTIL !== undefined) {
    const parsed = parseIcsDate(parts.UNTIL)
    if (parsed !== null) {
      rule.until = parsed.date.getTime()
      rule.untilEndOfDay = parsed.allDay
    }
  }
  return rule
}

/** 解析 ICS 文本中的 VEVENT（忽略 VALARM 等嵌套块、CANCELLED 与 RECURRENCE-ID 覆盖实例）。 */
export function parseIcsEvents(text) {
  const events = []
  let current = null
  let depth = 0
  for (const line of unfoldIcs(text)) {
    const upper = line.toUpperCase()
    if (upper.startsWith('BEGIN:VEVENT') && current === null) {
      current = { exdates: [] }
      depth = 0
      continue
    }
    if (current === null) continue
    if (upper.startsWith('BEGIN:')) { depth++; continue }
    if (upper.startsWith('END:')) {
      if (depth > 0) { depth--; continue }
      if (current.start !== undefined && !current.cancelled && current.recurrenceId === undefined) {
        events.push(current)
      }
      current = null
      continue
    }
    if (depth > 0) continue
    const prop = parsePropLine(line)
    if (prop === null) continue
    const { name, params, value } = prop
    if (name === 'UID') current.uid = value.trim()
    else if (name === 'SUMMARY') current.summary = icsText(value.trim())
    else if (name === 'LOCATION') current.location = icsText(value.trim())
    else if (name === 'DESCRIPTION') current.description = icsText(value.trim())
    else if (name === 'STATUS' && value.trim().toUpperCase() === 'CANCELLED') current.cancelled = true
    else if (name === 'RECURRENCE-ID') current.recurrenceId = value
    else if (name === 'DTSTART') {
      const parsed = parseIcsDate(value)
      if (parsed !== null) current.start = parsed
    } else if (name === 'DTEND') {
      const parsed = parseIcsDate(value)
      if (parsed !== null) current.end = parsed
    } else if (name === 'DURATION') current.duration = value.trim()
    else if (name === 'RRULE') current.rrule = parseRrule(value)
    else if (name === 'EXDATE') {
      for (const piece of value.split(',')) {
        const parsed = parseIcsDate(piece)
        if (parsed !== null) current.exdates.push(parsed)
      }
    }
  }
  return events
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(date) {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function occurrenceKey(date, allDay) {
  return allDay ? formatDate(date) : formatDateTime(date)
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** 加 n 个月并保持日；该月没有这一天（如 1 月 31 日 + 1 月）返回 null。 */
function addMonths(date, n) {
  const d = new Date(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (day > daysInMonth) return null
  d.setDate(day)
  return d
}

/** 加 n 年并保持月/日；闰日落到平年返回 null。 */
function addYears(date, n) {
  const d = new Date(date)
  const day = d.getDate()
  d.setFullYear(d.getFullYear() + n)
  if (d.getDate() !== day) return null
  return d
}

function durationMs(event) {
  if (event.end !== undefined) return Math.max(0, event.end.date.getTime() - event.start.date.getTime())
  if (event.duration !== undefined) {
    const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(event.duration)
    if (match !== null) {
      const [, sign, w, d, h, mi, s] = match
      const total = ((+(w || 0)) * 7 + (+(d || 0))) * DAY_MS
        + (+(h || 0)) * 3600000 + (+(mi || 0)) * 60000 + (+(s || 0)) * 1000
      return (sign === '-' ? -1 : 1) * total
    }
  }
  return event.start.allDay ? DAY_MS : 0
}

function withinUntil(date, rule) {
  if (rule.until === null) return true
  const t = date.getTime()
  return rule.untilEndOfDay ? t <= rule.until + DAY_MS - 1 : t <= rule.until
}

/** 第 i 个间隔产生的实例批（WEEKLY 的 BYDAY 展开为一组；空批 = 该间隔无实例）。 */
function generateBatch(rule, start, i) {
  if (rule.freq === 'DAILY') return [addDays(start, i * rule.interval)]
  if (rule.freq === 'WEEKLY') {
    const anchor = addDays(start, -((start.getDay() + 6) % 7))
    const weekStart = addDays(anchor, i * rule.interval * 7)
    return rule.byDay
      .slice()
      .sort((a, b) => a - b)
      .map((dow) => addDays(weekStart, dow))
      .filter((d) => d.getTime() >= start.getTime())
  }
  if (rule.freq === 'MONTHLY') {
    const monthStart = addMonths(start, i * rule.interval)
    if (monthStart === null) return []
    if (rule.byMonthDay.length > 0) {
      return rule.byMonthDay
        .map((dom) => {
          const d = new Date(monthStart)
          const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
          if (dom > dim || dom < -dim) return null
          d.setDate(dom > 0 ? dom : dim + dom + 1)
          return d
        })
        .filter((d) => d !== null && d.getTime() >= start.getTime())
    }
    return [monthStart]
  }
  const yearly = addYears(start, i * rule.interval)
  return yearly === null ? [] : [yearly]
}

/**
 * RRULE + EXDATE 展开为时间窗 [windowStart, windowEnd) 内的实例。
 * COUNT 从 DTSTART 起算（含窗口外的）；窗口右缘提前终止。
 */
export function expandEvents(events, windowStart, windowEnd) {
  const result = []
  for (const event of events) {
    const dur = durationMs(event)
    const base = {
      uid: event.uid || '',
      title: event.summary || '(无标题)',
      allDay: event.start.allDay,
      location: event.location || '',
      description: event.description || '',
    }
    const exKeys = new Set(event.exdates.map((ex) => occurrenceKey(ex.date, ex.allDay && base.allDay)))
    const rule = event.rrule
    if (rule === undefined) {
      const date = event.start.date
      if (date.getTime() + dur > windowStart && date.getTime() < windowEnd && !exKeys.has(occurrenceKey(date, base.allDay))) {
        result.push({ ...base, start: date, end: new Date(date.getTime() + dur) })
      }
      continue
    }
    if (rule.freq === 'WEEKLY' && rule.byDay.length === 0) {
      rule.byDay = [(event.start.date.getDay() + 6) % 7]
    }
    let generated = 0
    intervalLoop:
    for (let i = 0; i < MAX_INTERVALS; i++) {
      for (const date of generateBatch(rule, event.start.date, i)) {
        if (rule.count !== null && generated >= rule.count) break intervalLoop
        if (!withinUntil(date, rule)) break intervalLoop
        generated++
        if (date.getTime() + dur <= windowStart) continue
        // 批次按时间升序：到窗右缘即结束本事件的展开（不能 return，后续事件还要展开）
        if (date.getTime() >= windowEnd) break intervalLoop
        if (exKeys.has(occurrenceKey(date, base.allDay))) continue
        result.push({ ...base, start: date, end: new Date(date.getTime() + dur) })
      }
    }
  }
  return result
}
