import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DOUYIN_ACTIVITY_MAX_ITEMS, decodeDouyinJumpLink, douyinActivityWindow, douyinAuthFailed,
  formatDouyinDeadline, mergeDouyinActivityItems, parseDouyinActivityInspiration,
  parseDouyinActivityPc, readDouyinCookieCache,
} from '../lib/trends-douyin-activity.js'

const NOW = 1_800_000_000

// 载荷形态取自 2026-10-25 登录态实抓（活动广场 pc/list 与创作灵感）。
const pcPayload = {
  status_code: 0,
  list: [
    { show_name: '2026美好奇妙夜', hot_score: 100, show_start_time: NOW - 500_000, show_end_time: NOW - 100,
      jump_link: 'sslocal://webcast_redirect?entry=cubic_dy_wonderful26_night_main' },
    { show_name: '活成自己生命里的光', hot_score: 100, show_start_time: NOW - 20_000_000, show_end_time: NOW + 40_000_000,
      jump_link: 'aweme://webview?url=https%3A%2F%2Fapi.amemv.com%2Fmagic%2Feco%2Fruntime%2Frelease%2F6aad71992a21e508233a9c2b%3FappType%3Ddouyin' },
    { show_name: '', show_end_time: NOW + 100 },
    { show_name: '已收官活动', show_end_time: NOW - 10_000 },
  ],
}

const inspirationPayload = {
  status_code: 0,
  activities: [
    { show_name: '活成自己生命里的光', recommendation: '活成自己生命里的光', start_time: NOW - 1000, end_time: NOW + 40_000_000 },
    { show_name: '灵感独有活动', is_hot: true, start_time: NOW - 1000, end_time: NOW + 900_000 },
  ],
}

test('douyinActivityWindow: now-90d ~ now+180d，取整秒', () => {
  const win = douyinActivityWindow(NOW)
  assert.equal(win.start_time, Math.floor(NOW - 90 * 86400))
  assert.equal(win.end_time, Math.floor(NOW + 180 * 86400))
})

test('douyinAuthFailed 只认网关码 8', () => {
  assert.equal(douyinAuthFailed({ status_code: 8, status_msg: '用户未登录' }), true)
  assert.equal(douyinAuthFailed({ status_code: 0, list: [] }), false)
  assert.equal(douyinAuthFailed(null), false)
})

test('decodeDouyinJumpLink: aweme webview 解内嵌 https、sslocal 回空、https 直通', () => {
  assert.equal(
    decodeDouyinJumpLink('aweme://webview?url=https%3A%2F%2Fapi.amemv.com%2Fmagic%2Fx%3Fa%3D1'),
    'https://api.amemv.com/magic/x?a=1')
  assert.equal(decodeDouyinJumpLink('sslocal://webcast_redirect?entry=x'), '')
  assert.equal(decodeDouyinJumpLink('https://www.douyin.com/a'), 'https://www.douyin.com/a')
  assert.equal(decodeDouyinJumpLink('aweme://webview?url=not-a-url'), '')
  assert.equal(decodeDouyinJumpLink('aweme://webview?url=%E4%B8%%BAD'), '', '残缺百分号编码按无落点处理')
  assert.equal(decodeDouyinJumpLink(''), '')
})

test('parseDouyinActivityPc: 过滤已结束、hot=截止文案、url 解 web 落点、保持接口顺序', () => {
  const items = parseDouyinActivityPc(pcPayload, NOW)
  assert.deepEqual(items.map(it => it.title), ['活成自己生命里的光'])
  assert.equal(items[0].url, 'https://api.amemv.com/magic/eco/runtime/release/6aad71992a21e508233a9c2b?appType=douyin')
  assert.equal(items[0].hot, formatDouyinDeadline(NOW + 40_000_000))
})

test('parseDouyinActivityPc: status_code 非 0 与结构缺失回空', () => {
  assert.deepEqual(parseDouyinActivityPc({ status_code: 8, status_msg: '用户未登录' }, NOW), [])
  assert.deepEqual(parseDouyinActivityPc({ status_code: 0 }, NOW), [])
  assert.deepEqual(parseDouyinActivityPc(null, NOW), [])
})

test('parseDouyinActivityInspiration: 无 jump_link 的条目 url 为空、过滤已结束', () => {
  const items = parseDouyinActivityInspiration(inspirationPayload, NOW)
  assert.deepEqual(items.map(it => it.title), ['活成自己生命里的光', '灵感独有活动'])
  assert.ok(items.every(it => it.url === ''))
  assert.equal(items[1].hot, formatDouyinDeadline(NOW + 900_000))
})

test('formatDouyinDeadline: MM-DD 补零、非法值回空', () => {
  assert.equal(formatDouyinDeadline(new Date(2026, 11, 6).getTime() / 1000), '至 12-06')
  assert.equal(formatDouyinDeadline(new Date(2027, 2, 3).getTime() / 1000), '至 03-03')
  assert.equal(formatDouyinDeadline(0), '')
  assert.equal(formatDouyinDeadline(Number.NaN), '')
})

test('mergeDouyinActivityItems: 广场在前、灵感补位、杂项容错、总量截断', () => {
  const merged = mergeDouyinActivityItems([
    parseDouyinActivityPc(pcPayload, NOW),
    parseDouyinActivityInspiration(inspirationPayload, NOW),
    'not-a-list',
  ])
  assert.deepEqual(merged.map(it => it.title), ['活成自己生命里的光', '灵感独有活动'])
  const many = Array.from({ length: DOUYIN_ACTIVITY_MAX_ITEMS + 10 }, (_, i) => ({ title: `活动${i}`, hot: '', url: '' }))
  assert.equal(mergeDouyinActivityItems([many]).length, DOUYIN_ACTIVITY_MAX_ITEMS)
  assert.equal(mergeDouyinActivityItems('x').length, 0)
})

test('合并结果可直接进 decorateFetched 轨迹链（重名按归一化标题去重、保留广场版）', async () => {
  const { decorateFetched } = await import('../lib/trends.js')
  const merged = mergeDouyinActivityItems([
    parseDouyinActivityPc(pcPayload, NOW),
    parseDouyinActivityInspiration(inspirationPayload, NOW),
  ])
  const { items } = decorateFetched(null, merged, NOW)
  assert.deepEqual(items.map(it => it.title), ['活成自己生命里的光', '灵感独有活动'])
  assert.equal(items[0].url, 'https://api.amemv.com/magic/eco/runtime/release/6aad71992a21e508233a9c2b?appType=douyin', '广场版本胜出')
})

test('readDouyinCookieCache: 合法缓存、空 cookie、结构不合法', () => {
  assert.deepEqual(readDouyinCookieCache({ cookie: 'sessionid=x; ttwid=y', at: NOW }), { cookie: 'sessionid=x; ttwid=y', at: NOW })
  assert.equal(readDouyinCookieCache({ cookie: '   ', at: NOW }), null)
  assert.equal(readDouyinCookieCache({ cookie: 'x', at: 0 }), null)
  assert.equal(readDouyinCookieCache(null), null)
  assert.equal(readDouyinCookieCache(['x']), null)
})
