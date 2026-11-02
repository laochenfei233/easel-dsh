// 日历节日底图：法定节假日/调休（vendor 数据）+ 农历传统节日 + 固定公历/国际/电商节日。
// 纯展示数据，不发网络请求。法定数据优先，同名去重。
import { HOLIDAYS_CN } from '../data/holidays-cn.js'
import { lunarFestivalsFor, qingmingDay } from './lunar.js'

export const FESTIVAL_KINDS = ['statutory-rest', 'statutory-work', 'lunar', 'fixed']

// 固定公历节日。元旦/劳动节/国庆节同时受法定数据覆盖，法定年份由去重兜住，
// 未 vendor 法定数据的年份靠它们兜底显示。
const FIXED_FESTIVALS = [
  ['01-01', '元旦'],
  ['02-14', '情人节'],
  ['03-08', '妇女节'],
  ['03-12', '植树节'],
  ['04-01', '愚人节'],
  ['05-01', '劳动节'],
  ['05-04', '青年节'],
  ['05-12', '护士节'],
  ['06-01', '儿童节'],
  ['06-18', '618'],
  ['07-01', '建党节'],
  ['08-01', '建军节'],
  ['09-10', '教师节'],
  ['10-01', '国庆节'],
  ['10-31', '万圣夜'],
  ['11-11', '双11'],
  ['12-12', '双12'],
  ['12-24', '平安夜'],
  ['12-25', '圣诞节'],
]

// 浮日节日：[月份, 第几个星期几(1 起), 星期几(0=周日), 名称]
const FLOATING_FESTIVALS = [
  [5, 2, 0, '母亲节'],
  [6, 3, 0, '父亲节'],
  [11, 4, 4, '感恩节'],
]

function ymdOf(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function floatingDate(year, month, nth, weekday) {
  const first = new Date(year, month - 1, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return 1 + offset + (nth - 1) * 7
}

const computedYearCache = new Map()

/**
 * 某公历年的节日日期集合：农历传统 + 固定 + 浮日（不含法定，法定逐日查 vendor 表）。
 * 农历节日扫全年 12 个月——春节偏晚的年份元宵/龙抬头会落进 3 月。按年缓存。
 * @returns {Map<string, {name: string, kind: string}[]>} ymd → 节日列表
 */
function computedFestivalsForYear(year) {
  const cached = computedYearCache.get(year)
  if (cached) return cached
  const map = new Map()
  const push = (ymd, name, kind) => {
    const list = map.get(ymd) || []
    if (!list.some((f) => f.name === name)) list.push({ name, kind })
    map.set(ymd, list)
  }
  for (const [mmdd, name] of FIXED_FESTIVALS) {
    push(`${year}-${mmdd}`, name, 'fixed')
  }
  for (const [month, nth, weekday, name] of FLOATING_FESTIVALS) {
    push(ymdOf(year, month, floatingDate(year, month, nth, weekday)), name, 'fixed')
  }
  // 清明：法定表已覆盖的年份不重复推算；未覆盖年份按节气公式补上
  const qm = ymdOf(year, 4, qingmingDay(year))
  if (!(year in HOLIDAYS_CN) || !(qm in HOLIDAYS_CN[year])) push(qm, '清明节', 'lunar')
  for (let month = 1; month <= 12; month++) {
    for (const [ymd, name] of lunarFestivalsFor(year, month)) push(ymd, name, 'lunar')
  }
  computedYearCache.set(year, map)
  return map
}

/**
 * 某公历月每天要显示的节日（含休/班角标），按 statutory-rest → statutory-work → lunar → fixed 排序。
 * @returns {Map<string, {name: string, kind: string}[]>} ymd → 节日列表（同一日按优先级去重同名）
 */
export function festivalsFor(year, month) {
  const result = new Map()
  const days = new Date(year, month, 0).getDate()
  const computed = computedFestivalsForYear(year)
  const statutory = HOLIDAYS_CN[year] || {}
  for (let day = 1; day <= days; day++) {
    const ymd = ymdOf(year, month, day)
    const list = []
    const entry = statutory[ymd]
    if (entry) list.push({ name: entry[0], kind: entry[1] === 1 ? 'statutory-rest' : 'statutory-work' })
    for (const f of computed.get(ymd) || []) {
      if (!list.some((x) => x.name === f.name)) list.push(f)
    }
    if (list.length > 0) result.set(ymd, list)
  }
  return result
}
