// 农历换算与农历节日：经典压缩位表法，覆盖 1900–2100。
// 数据源自紫金山天文台《中国天文年历》推算结果（业内通用表），每个条目一位压缩：
//   bit0-3   闰月月份（0 = 无闰月）
//   bit16    闰月大小（1 = 30 天）
//   bit15-4  正月至腊月的大小月（1 = 30 天），第 m 月取 0x10000 >> m
export const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
]

const BASE_UTC = Date.UTC(1900, 0, 31) // 1900-01-31 = 光绪廿六年正月初一，表纪元起点

/** 闰月月份（1-12），无闰月返回 0。 */
export function lunarLeapMonth(year) {
  return LUNAR_INFO[year - 1900] & 0xf
}

/** 闰月天数；无闰月返回 0。 */
export function lunarLeapDays(year) {
  if (lunarLeapMonth(year) === 0) return 0
  return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29
}

/** 农历 year 年第 month 月（1-12 平月序号）的天数。 */
export function lunarMonthDays(year, month) {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29
}

/** 农历 year 年（含闰月）总天数。 */
export function lunarYearDays(year) {
  let sum = 348
  for (let mask = 0x8000; mask > 0x8; mask >>= 1) sum += (LUNAR_INFO[year - 1900] & mask) ? 1 : 0
  return sum + lunarLeapDays(year)
}

/**
 * 公历转农历。年月日按墙钟日期解释，不做时区换算。
 * @returns {{year: number, month: number, day: number, isLeap: boolean} | null} 超出表范围返回 null
 */
export function solarToLunar(year, month, day) {
  if (year < 1900 || year > 2100) return null
  let offset = Math.round((Date.UTC(year, month - 1, day) - BASE_UTC) / 86400000)
  if (offset < 0) return null // 表纪元 1900-01-31 之前
  let i = 1900
  let temp = 0
  for (; i < 2101 && offset > 0; i++) {
    temp = lunarYearDays(i)
    offset -= temp
  }
  if (i > 2100) return null // 表终点之后
  if (offset < 0) {
    offset += temp
    i--
  }
  const lunarYear = i
  const leap = lunarLeapMonth(lunarYear)
  let isLeap = false
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) {
      --i
      isLeap = true
      temp = lunarLeapDays(lunarYear)
    } else {
      temp = lunarMonthDays(lunarYear, i)
    }
    if (isLeap && i === leap + 1) isLeap = false
    offset -= temp
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) isLeap = false
    else {
      isLeap = true
      --i
    }
  }
  if (offset < 0) {
    offset += temp
    --i
  }
  return { year: lunarYear, month: i, day: offset + 1, isLeap }
}

/** 清明节气所在日（21 世纪内精确；表外年份无意义）。 */
export function qingmingDay(year) {
  const y = year % 100
  return Math.floor(y * 0.2422 + 4.81) - Math.floor(y / 4)
}

// 农历月/日 → 节日名。除夕无固定月日（腊月最后一天），单独由「次日是春节」判定。
const LUNAR_FESTIVALS = new Map([
  ['1-1', '春节'],
  ['1-15', '元宵节'],
  ['2-2', '龙抬头'],
  ['5-5', '端午节'],
  ['7-7', '七夕节'],
  ['7-15', '中元节'],
  ['8-15', '中秋节'],
  ['9-9', '重阳节'],
  ['12-8', '腊八节'],
])

function ymdOf(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 某 month 农历节日落在本公历 year 年的日期映射（含跨年：腊八/除夕可能落在公历次年 1 月，
 * 因此按「公历年的每一天反查农历」实现，而不是按农历年正推）。
 * @returns {Map<string, string>} ymd → 节日名
 */
export function lunarFestivalsFor(year, month) {
  const result = new Map()
  const first = Date.UTC(year, month - 1, 1)
  const last = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)
  for (let t = first; t < last; t += 86400000) {
    const d = new Date(t)
    const ymd = ymdOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    const lunar = solarToLunar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    if (lunar === null) continue
    const name = LUNAR_FESTIVALS.get(`${lunar.month}-${lunar.day}`)
    if (name !== undefined && !lunar.isLeap) result.set(ymd, name)
    // 除夕 = 明天是正月初一
    const next = new Date(t + 86400000)
    const nextLunar = solarToLunar(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
    if (nextLunar !== null && nextLunar.month === 1 && nextLunar.day === 1) result.set(ymd, '除夕')
  }
  return result
}
