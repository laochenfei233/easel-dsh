/** CalDAV 协议层测试：ICS 解析、RRULE 展开、multistatus 提取、发现链与同步编排（注入 requester）。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  unfoldIcs, parseIcsEvents, expandEvents, parseMultistatus, parseCalendarList,
  parsePrincipalHref, parseHomeSetHref, discoverCalendars, syncCalendarEvents,
  calendarQueryBody, caldavRequest,
} from '../caldav.js'

const WINDOW_START = new Date(2026, 0, 1).getTime()
const WINDOW_END = new Date(2026, 2, 1).getTime() // 2026-01-01 .. 2026-03-01

function datesOf(occurrences) {
  return occurrences.map((o) => (o.allDay ? o.start : `${o.start} ${o.title}`))
}

test('折叠行展开', () => {
  const lines = unfoldIcs('BEGIN:VEVENT\r\nSUMMARY:很长很长的标题\r\n 续行内容\r\nDESCRIPTION:x')
  assert.deepEqual(lines, ['BEGIN:VEVENT', 'SUMMARY:很长很长的标题续行内容', 'DESCRIPTION:x'])
})

test('解析基础 VEVENT：全天与带时间（UTC 转本地）', () => {
  const events = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:a@x',
    'SUMMARY:全天事件',
    'DTSTART;VALUE=DATE:20260217',
    'DTEND;VALUE=DATE:20260219',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:b@x',
    'SUMMARY:定时事件',
    'DTSTART:20260216T160000Z',
    'DTEND:20260216T170000Z',
    'LOCATION:线上',
    'END:VEVENT',
  ].join('\r\n'))
  assert.equal(events.length, 2)
  assert.equal(events[0].summary, '全天事件')
  assert.equal(events[0].start.allDay, true)
  const occurrences = expandEvents(events, WINDOW_START, WINDOW_END)
  assert.equal(occurrences[0].start.getFullYear(), 2026)
  assert.equal(occurrences[0].start.getMonth(), 1, '2 月')
  assert.equal(occurrences[0].start.getDate(), 17)
  // UTC 16:00 在东八区是 17 日 0 点；在负偏移时区则是 16 日 —— 用相对断言
  assert.equal(occurrences[1].start.getTime(), Date.UTC(2026, 1, 16, 16, 0))
  assert.equal(occurrences[1].location, '线上')
})

test('解析文本转义与 VALARM 嵌套、CANCELLED、RECURRENCE-ID', () => {
  const events = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:c@x',
    'SUMMARY:含\\,逗号\\;分号',
    'DTSTART:20260105T090000',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:d@x',
    'STATUS:CANCELLED',
    'DTSTART:20260106T090000',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:e@x',
    'RECURRENCE-ID:20260110T090000',
    'DTSTART:20260110T100000',
    'END:VEVENT',
  ].join('\r\n'))
  assert.equal(events.length, 1)
  assert.equal(events[0].summary, '含,逗号;分号')
})

test('RRULE WEEKLY BYDAY 展开 + COUNT', () => {
  // 2026-01-05 是周一
  const events = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:w@x',
    'SUMMARY:周会',
    'DTSTART:20260105T100000',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5',
    'END:VEVENT',
  ].join('\r\n'))
  const occurrences = expandEvents(events, WINDOW_START, WINDOW_END)
  assert.equal(occurrences.length, 5)
  assert.deepEqual(occurrences.map((o) => o.start.getDay()), [1, 3, 1, 3, 1])
  assert.equal(occurrences[4].start.getDate(), 19, '第 5 次是 2026-01-19 周一')
})

test('RRULE 双周（INTERVAL=2）与无 BYDAY 缺省', () => {
  const events = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:w2@x',
    'SUMMARY:双周会',
    'DTSTART:20260106T100000',
    'RRULE:FREQ=WEEKLY;INTERVAL=2',
    'END:VEVENT',
  ].join('\r\n'))
  const occurrences = expandEvents(events, WINDOW_START, WINDOW_END)
  // 2026-01-06 周二起，每两周一次：1/6, 1/20, 2/3, 2/17
  assert.deepEqual(occurrences.map((o) => o.start.getDate()), [6, 20, 3, 17])
})

test('RRULE UNTIL 与 EXDATE', () => {
  const events = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:u@x',
    'SUMMARY:晨站会',
    'DTSTART:20260101T090000',
    'RRULE:FREQ=DAILY;UNTIL=20260110T090000Z',
    'EXDATE:20260103T090000',
    'END:VEVENT',
  ].join('\r\n'))
  const occurrences = expandEvents(events, WINDOW_START, WINDOW_END)
  // 1/1..1/10 共 10 次减 1/3 排除 = 9；UNTIL 是 UTC 时间，东八区会含 1/10 次日……
  // 这里按运行时区无关断言：有序且不含 1/3
  assert.ok(!occurrences.some((o) => o.start.getDate() === 3 && o.start.getMonth() === 0))
  assert.ok(occurrences.length >= 9)
  const sorted = occurrences.map((o) => o.start.getDate())
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a - b))
})

test('RRULE MONTHLY（月末 31 日跳过小月）与 YEARLY（闰日跳平年）', () => {
  const monthly = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:m@x',
    'SUMMARY:月结',
    'DTSTART:20260131T120000',
    'RRULE:FREQ=MONTHLY',
    'END:VEVENT',
  ].join('\r\n'))
  const m = expandEvents(monthly, new Date(2026, 0, 1).getTime(), new Date(2026, 6, 1).getTime())
  assert.deepEqual(m.map((o) => o.start.getDate()), [31, 31, 31], 'RFC 语义：2/4 月无 31 日整例跳过，不缩到月末')

  const yearly = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:y@x',
    'SUMMARY:生日',
    'DTSTART:20240229T000000',
    'RRULE:FREQ=YEARLY',
    'END:VEVENT',
  ].join('\r\n'))
  const y = expandEvents(yearly, new Date(2024, 0, 1).getTime(), new Date(2028, 0, 1).getTime())
  assert.equal(y.length, 1, '2025-2027 平年闰日跳过，只 2024 一 hit 在窗内')
})

test('DURATION 缺 DTEND 的事件', () => {
  const events = parseIcsEvents([
    'BEGIN:VEVENT',
    'UID:du@x',
    'SUMMARY:一小时',
    'DTSTART:20260101T100000',
    'DURATION:PT1H30M',
    'END:VEVENT',
  ].join('\r\n'))
  const occurrences = expandEvents(events, WINDOW_START, WINDOW_END)
  assert.equal(occurrences[0].end.getHours(), 11)
  assert.equal(occurrences[0].end.getMinutes(), 30)
})

test('multistatus 提取（带前缀/无前缀/CDATA）', () => {
  const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:href>/cal/1.ics</d:href><d:propstat><d:prop><c:calendar-data><![CDATA[BEGIN:VCALENDAR\r\nEND:VCALENDAR]]></c:calendar-data></d:prop></d:propstat></d:response>
<response><href>/cal/2.ics</href><propstat><prop><calendar-data>BEGIN:VCALENDAR\r\nX:2</calendar-data></prop></propstat></response>
<d:response><d:href>/cal/3.ics</d:href></d:response>
</d:multistatus>`
  const parsed = parseMultistatus(xml)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].href, '/cal/1.ics')
  assert.ok(parsed[0].calendarData.includes('BEGIN:VCALENDAR'))
  assert.ok(parsed[1].calendarData.includes('X:2'))
})

test('日历集合列表与发现链提取', () => {
  const listXml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:href>/home/personal/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>个人</d:displayname></d:prop></d:propstat></d:response>
<d:response><d:href>/home/work/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
</d:multistatus>`
  const list = parseCalendarList(listXml)
  assert.equal(list.length, 1)
  assert.equal(list[0].displayname, '个人')

  const principalXml = '<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/principals/me/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>'
  assert.equal(parsePrincipalHref(principalXml), '/principals/me/')
  const homeXml = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>/home/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>'
  assert.equal(parseHomeSetHref(homeXml), '/home/')
})

/** 按方法+URL 路由的假 requester。 */
function fakeRequester(routes) {
  return async ({ url, method }) => {
    const key = `${method} ${url}`
    const handler = routes[key] || routes[key.replace(/\/$/, '')]
    if (handler === undefined) throw new Error(`fakeRequester 未路由: ${key}`)
    return typeof handler === 'number' ? { status: handler, text: '' } : { status: 207, text: handler }
  }
}

test('发现链：根 URL 走 principal → home-set → 列表', async () => {
  const account = { url: 'https://caldav.example.com/', username: 'me', password: 'pw' }
  const calendars = await discoverCalendars(account, fakeRequester({
    'PROPFIND https://caldav.example.com/': `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/p/me/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>`,
    'PROPFIND https://caldav.example.com/p/me/': `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/p/me/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>/home/me/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>`,
    'PROPFIND https://caldav.example.com/home/me/': `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/home/me/personal/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>私人</d:displayname></d:prop></d:propstat></d:response></d:multistatus>`,
  }))
  assert.deepEqual(calendars, [{ href: 'https://caldav.example.com/home/me/personal/', displayname: '私人' }])
})

test('发现链：直填日历 URL 直接返回', async () => {
  const account = { url: 'https://caldav.example.com/home/me/personal/', username: 'me', password: 'pw' }
  const calendars = await discoverCalendars(account, fakeRequester({
    'PROPFIND https://caldav.example.com/home/me/personal/': `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/home/me/personal/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>私人</d:displayname></d:prop></d:propstat></d:response></d:multistatus>`,
  }))
  assert.equal(calendars.length, 1)
})

test('同步编排：REPORT 请求体带时间窗，事件按窗口展开', async () => {
  let seenBody = ''
  const requester = async ({ url, method, body, headers }) => {
    assert.equal(method, 'REPORT')
    assert.equal(headers.Depth, '1')
    assert.match(headers.Authorization, /^Basic /)
    seenBody = body
    return {
      status: 207,
      text: `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/cal/a</d:href><d:propstat><d:prop><c:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:s@x\r\nSUMMARY:同步事件\r\nDTSTART:20260115T080000Z\r\nDTEND:20260115T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>`,
    }
  }
  const events = await syncCalendarEvents(
    { url: 'https://caldav.example.com/home/me/personal/', username: 'me', password: 'pw' },
    WINDOW_START, WINDOW_END, requester,
  )
  assert.match(seenBody, /start="20251231T160000Z"/, '窗口起点为本地 2026-01-01 对应 UTC')
  assert.equal(events.length, 1)
  assert.equal(events[0].title, '同步事件')
  assert.match(events[0].start, /^2026-01-15/)
})

test('caldavRequest：401 与 4xx 抛错、认证头正确', async () => {
  const b64 = Buffer.from('me:pw').toString('base64')
  await assert.rejects(caldavRequest({ url: 'https://x/', username: 'me', password: 'pw' }, {
    url: 'https://x/', method: 'PROPFIND',
  }, async () => ({ status: 401, text: '' })), /401/)
  await assert.rejects(caldavRequest({ url: 'https://x/', username: 'me', password: 'pw' }, {
    url: 'https://x/', method: 'PROPFIND',
  }, async () => ({ status: 503, text: '' })), /503/)
  let seen = null
  await caldavRequest({ url: 'https://x/', username: 'me', password: 'pw' }, {
    url: 'https://x/', method: 'PROPFIND',
  }, async (req) => { seen = req; return { status: 207, text: '' } })
  assert.equal(seen.headers.Authorization, `Basic ${b64}`)
})

test('calendarQueryBody 时间窗格式', () => {
  assert.match(calendarQueryBody('20260101T000000Z', '20261028T000000Z'), /start="20260101T000000Z" end="20261028T000000Z"/)
})
