/** 节假日底图数据层测试：农历换算、法定/农历/固定节日合并、去重与优先级。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solarToLunar, qingmingDay, lunarFestivalsFor } from '../src/lib/lunar.js'
import { festivalsFor } from '../src/lib/festivals.js'
import { HOLIDAYS_CN } from '../src/data/holidays-cn.js'

function names(map, ymd) {
  return (map.get(ymd) || []).map((f) => f.name)
}
function kinds(map, ymd) {
  return (map.get(ymd) || []).map((f) => f.kind)
}

test('法定数据覆盖 2025 与 2026（当年必须有数据）', () => {
  assert.ok(HOLIDAYS_CN[2025], '2025 缺法定数据')
  assert.ok(HOLIDAYS_CN[2026], '2026 缺法定数据')
  // 2026 官方安排锚点：春节 9 天（2/15-23），2/14 与 2/28 调休班
  assert.equal(HOLIDAYS_CN[2026]['2026-02-17'][1], 1)
  assert.equal(HOLIDAYS_CN[2026]['2026-02-14'][1], 0)
  assert.equal(HOLIDAYS_CN[2026]['2026-02-28'][1], 0)
  assert.equal(HOLIDAYS_CN[2026]['2026-01-04'][1], 0, '元旦周日调休班')
})

test('农历换算锚点日期', () => {
  assert.deepEqual(solarToLunar(2026, 2, 17), { year: 2026, month: 1, day: 1, isLeap: false })
  assert.deepEqual(solarToLunar(2025, 1, 29), { year: 2025, month: 1, day: 1, isLeap: false })
  assert.deepEqual(solarToLunar(2026, 9, 25), { year: 2026, month: 8, day: 15, isLeap: false })
  assert.deepEqual(solarToLunar(2026, 6, 19), { year: 2026, month: 5, day: 5, isLeap: false })
  // 2025 闰六月：六月初一 = 2025-06-25
  assert.deepEqual(solarToLunar(2025, 6, 25), { year: 2025, month: 6, day: 1, isLeap: false })
  assert.deepEqual(solarToLunar(2025, 7, 25), { year: 2025, month: 6, day: 1, isLeap: true })
  // 表范围外
  assert.equal(solarToLunar(1899, 12, 31), null)
  assert.equal(solarToLunar(1900, 1, 1), null, '表纪元 1900-01-31 之前')
  assert.equal(solarToLunar(2101, 1, 1), null)
  // 表终点年 2100 全年可用（guard 不能早退一个农历年）
  const edge = solarToLunar(2100, 12, 31)
  assert.ok(edge !== null && edge.year === 2100 && edge.month === 12, '2100 年末仍在表内')
})

test('清明节气公式', () => {
  assert.equal(qingmingDay(2026), 5)
  assert.equal(qingmingDay(2008), 4)
  assert.equal(qingmingDay(2017), 4)
})

test('除夕 = 次日正月初一（腊月最后一天，大小月皆可）', () => {
  assert.deepEqual(names(festivalsFor(2026, 2), '2026-02-16'), ['春节', '除夕'])
  // 2022 年腊月只有廿九（2022-01-31 除夕）
  assert.ok(names(festivalsFor(2022, 1), '2022-01-31').includes('除夕'))
})

test('法定与农历同名去重、不同名并存', () => {
  const m = festivalsFor(2026, 9)
  // 2026-09-25 法定中秋节 + 农历八月十五中秋节 → 一条
  assert.deepEqual(names(m, '2026-09-25'), ['中秋节'])
  assert.deepEqual(kinds(m, '2026-09-25'), ['statutory-rest'])
  // 法定春节与农历春节去重，但除夕保留
  assert.deepEqual(names(festivalsFor(2026, 2), '2026-02-17'), ['春节'])
  assert.deepEqual(names(festivalsFor(2026, 2), '2026-02-16'), ['春节', '除夕'])
})

test('调休班角标与休角标', () => {
  const m = festivalsFor(2026, 2)
  assert.equal(kinds(m, '2026-02-14')[0], 'statutory-work', '2/14 情人节并存，但班角标排第一')
  assert.deepEqual(kinds(m, '2026-02-28'), ['statutory-work'])
  assert.deepEqual(kinds(m, '2026-02-18'), ['statutory-rest'])
})

test('固定与浮日节日', () => {
  const m = festivalsFor(2026, 5)
  assert.ok(names(m, '2026-05-01').includes('劳动节'))
  assert.ok(names(m, '2026-05-10').includes('母亲节'), '2026 母亲节 = 5 月第 2 个周日')
  assert.ok(names(festivalsFor(2026, 11), '2026-11-26').includes('感恩节'), '2026 感恩节 = 11 月第 4 个周四')
  assert.ok(names(festivalsFor(2026, 11), '2026-11-11').includes('双11'))
  assert.ok(names(festivalsFor(2026, 6), '2026-06-18').includes('618'))
})

test('法定覆盖不到的年份用固定节日兜底', () => {
  const m = festivalsFor(2027, 1)
  assert.deepEqual(names(m, '2027-01-01'), ['元旦'])
  assert.deepEqual(kinds(m, '2027-01-01'), ['fixed'])
  // 2027 春节 2/6 仍由农历层给出
  assert.ok(names(festivalsFor(2027, 2), '2027-02-06').includes('春节'))
})

test('春节偏晚的年份元宵不漏（2015 春节 2/19，元宵 3/5）', () => {
  assert.ok(names(festivalsFor(2015, 3), '2015-03-05').includes('元宵节'))
})

test('农历节日扫描覆盖跨月（腊八 2026-01-26）', () => {
  const m = festivalsFor(2026, 1)
  assert.ok(names(m, '2026-01-26').includes('腊八节'))
})

test('lunarFestivalsFor 直接导出可用', () => {
  const m = lunarFestivalsFor(2026, 9)
  assert.equal(m.get('2026-09-25'), '中秋节')
})
