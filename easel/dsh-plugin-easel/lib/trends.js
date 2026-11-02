// 热点雷达 v2 的纯逻辑（spec easel-hotspot-radar §D1/D3/D4）：榜单轨迹的合并与
// 裁剪、跨平台标题聚类、关注词匹配。全部无 IO——落盘与路由接线在宿主半 index.js，
// 这里保持 node --test 可直接覆盖的纯函数。

/**
 * 热点标题归一化：NFKC、小写、只保留字母与数字（空白与标点全去），截断 120。
 * 标题是热榜里最稳定的字段；URL 带跳转参数，不做条目键。
 * @param {unknown} title - 原始标题。
 * @returns {string} 归一化键，可能为空串。
 */
export function normalizeTrendTitle(title) {
  return String(title ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 120)
}

/**
 * 关注词规范化：按空白/中英文逗号分号切分，trim，1–24 字符，大小写不敏感去重，最多 20 个。
 * @param {unknown} raw - 字符串或字符串数组。
 * @returns {string[]}
 */
export function normalizeKeywords(raw) {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(/[\s,，、;；]+/)
  const seen = new Set()
  const out = []
  for (const part of parts) {
    const word = String(part ?? '').trim().slice(0, 24)
    if (word.length === 0) continue
    const lower = word.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(word)
    if (out.length >= 20) break
  }
  return out
}

/** 历史文件的结构基线：版本不合规或损坏时调用方当空历史处理。 */
export const RADAR_HISTORY_VERSION = 1
/** 上一份快照比这更旧就不算 isNew/delta，重建基线（隔夜重启不整屏标新）。 */
const BASELINE_MAX_AGE_SECONDS = 30 * 60
/** 落盘条目的在榜保留窗口与每源容量。 */
export const HISTORY_TTL_SECONDS = 72 * 60 * 60
const HISTORY_MAX_ITEMS_PER_SOURCE = 200

/**
 * 读轨迹文件，任何异常/版本不符/结构不合法都回空历史（它是缓存，可随时删除）。
 * @param {string} projectRoot - Easel 项目根。
 * @param {(path: string) => Promise<unknown>} readJson - 读 JSON 的 IO 函数。
 * @returns {Promise<{version: number, sources: Record<string, {at: number, items: object[]}>}>}
 */
export async function readRadarHistory(projectRoot, readJson) {
  const raw = await readJson(`${projectRoot}/outputs/_radar_history.json`)
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyHistory()
  if (raw.version !== RADAR_HISTORY_VERSION || typeof raw.sources !== 'object' || raw.sources === null) {
    return emptyHistory()
  }
  const sources = {}
  for (const [key, value] of Object.entries(raw.sources)) {
    if (typeof key !== 'string' || key === '' || value === null || typeof value !== 'object') continue
    const at = typeof value.at === 'number' && Number.isFinite(value.at) ? value.at : 0
    if (!Array.isArray(value.items)) continue
    sources[key] = { at, items: value.items.filter(isHistoryEntry) }
  }
  return { version: RADAR_HISTORY_VERSION, sources }
}

function isHistoryEntry(item) {
  return item !== null && typeof item === 'object' && typeof item.key === 'string'
    && item.key !== '' && typeof item.firstSeen === 'number' && typeof item.lastSeen === 'number'
}

function emptyHistory() {
  return { version: RADAR_HISTORY_VERSION, sources: {} }
}

/**
 * 用上一份快照装饰本轮抓取结果：rank、isNew、delta、ageMin、firstSeen，
 * 同时产出要落盘的条目列表。去重按归一化键。上一份快照缺失或超过 30 分钟
 * （新基线）时不打 isNew/delta——首轮与隔夜重启都不整屏标「新」。
 * @param {{at: number, items: object[]}|null} prev - 上一份落盘快照（可为 null）。
 * @param {Array<{title: string, hot: string|number, url: string}>} fetched - 本轮抓到的完整榜单。
 * @param {number} now - 本次抓取时刻（秒）。
 * @returns {{items: object[], entries: object[]}} items 供响应与内存缓存，entries 供落盘。
 */
export function decorateFetched(prev, fetched, now) {
  const freshBaseline = prev === null || !Number.isFinite(prev.at) || now - prev.at > BASELINE_MAX_AGE_SECONDS
  const prevByKey = new Map()
  if (!freshBaseline && Array.isArray(prev.items)) {
    for (const entry of prev.items) {
      if (isHistoryEntry(entry)) prevByKey.set(entry.key, entry)
    }
  }
  const items = []
  const entries = []
  const seen = new Set()
  for (const raw of fetched) {
    if (raw === null || typeof raw !== 'object') continue
    const title = typeof raw.title === 'string' ? raw.title.trim() : ''
    if (!title) continue
    const key = normalizeTrendTitle(title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const rank = items.length + 1
    const prior = prevByKey.get(key)
    const firstSeen = prior ? prior.firstSeen : now
    const hot = typeof raw.hot === 'string' || typeof raw.hot === 'number' ? String(raw.hot) : ''
    const url = typeof raw.url === 'string' ? raw.url : ''
    items.push({
      title, key, firstSeen, hot, url, rank,
      ...(!freshBaseline
        ? (prior ? { delta: prior.lastRank - rank, isNew: false } : { isNew: true })
        : {}),
      ageMin: Math.max(0, Math.floor((now - firstSeen) / 60)),
    })
    entries.push({ key, title, hot, url, firstSeen, lastSeen: now, lastRank: rank })
  }
  return { items, entries }
}

/**
 * 落盘前的裁剪：丢掉超过 72h 未见的条目，每源最多留 200 条。
 * @param {{at: number, items: object[]}} snapshot - 单个源的快照。
 * @param {number} now - 当前时刻（秒）。
 * @returns {{at: number, items: object[]}} 裁剪后的快照。
 */
export function pruneSnapshot(snapshot, now) {
  const alive = (Array.isArray(snapshot.items) ? snapshot.items : [])
    .filter(entry => isHistoryEntry(entry) && now - entry.lastSeen <= HISTORY_TTL_SECONDS)
  return { at: snapshot.at, items: alive.slice(-HISTORY_MAX_ITEMS_PER_SOURCE) }
}

/**
 * 失败链的最后一环：读落盘快照里 24h 内的条目当离线数据。
 * @param {{at: number, items: object[]}|undefined} snapshot - 落盘快照。
 * @param {number} now - 当前时刻（秒）。
 * @returns {object[]|null} 可展示的条目（rank 取 lastRank），没有就 null。
 */
export function staleItemsFromHistory(snapshot, now) {
  if (!snapshot || !Number.isFinite(snapshot.at) || now - snapshot.at > 24 * 60 * 60) return null
  const items = (Array.isArray(snapshot.items) ? snapshot.items : [])
    .filter(entry => now - entry.lastSeen <= 24 * 60 * 60)
    .map(entry => ({
      title: entry.title, hot: entry.hot ?? '', url: entry.url ?? '',
      rank: entry.lastRank, firstSeen: entry.firstSeen,
      ageMin: Math.max(0, Math.floor((now - entry.firstSeen) / 60)),
    }))
    .sort((a, b) => a.rank - b.rank)
  return items.length > 0 ? items : null
}

/** 字符 bigram 集合（聚类相似度用）；单字串没有 bigram 时退化为单字集合。 */
function bigrams(text) {
  const set = new Set()
  for (let i = 0; i < text.length - 1; i += 1) set.add(text.slice(i, i + 2))
  if (set.size === 0 && text.length > 0) set.add(text)
  return set
}

const CLUSTER_MIN_SIMILARITY = 0.6
const CLUSTER_MIN_SHARED_BIGRAMS = 2
const CLUSTER_SHORT_TITLE = 4

/**
 * 两份归一化标题是否指同一事件：短标题（<4 字）只认完全相同；否则 bigram
 * 相似度 ≥0.6 且共享 bigram ≥2（分母取较小集合，短标题被长标题包含时仍命中）。
 */
function isSameTitle(keyA, keyB) {
  if (keyA === keyB) return true
  if (keyA.length < CLUSTER_SHORT_TITLE || keyB.length < CLUSTER_SHORT_TITLE) return false
  const a = bigrams(keyA)
  const b = bigrams(keyB)
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let shared = 0
  for (const gram of small) {
    if (large.has(gram)) shared += 1
  }
  return shared >= CLUSTER_MIN_SHARED_BIGRAMS && shared / small.size >= CLUSTER_MIN_SIMILARITY
}

/**
 * 跨平台聚类（spec §D3）：按源顺序、榜位从高到低扫描，与已有簇的代表标题比较。
 * 无模型、可解释；误并/漏并明显时再换全成员比较。
 * @param {Array<{platform: string, label: string, items: object[]}>} groups - 已装饰的源列表。
 * @param {{maxClusters?: number}} [options]
 * @returns {Array<object>} 簇列表，item 带 platform/label（卡体行与右键直接可用），
 *   不带内部字段 key/firstSeen；含单平台簇，多平台在前。
 */
export function clusterTrends(groups, { maxClusters = 60 } = {}) {
  const clusters = []
  for (const group of groups) {
    const items = [...(group.items ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    for (const item of items) {
      if (!item.title) continue
      const key = normalizeTrendTitle(item.title)
      if (!key) continue
      const normalizedUrl = typeof item.url === 'string' && /^https?:/i.test(item.url) ? item.url : ''
      const target = clusters.find((cluster) => {
        if (normalizedUrl !== '' && cluster.normalizedUrl === normalizedUrl) return true
        return isSameTitle(cluster.key, key)
      })
      // 卡体行与右键都需要来源：扫描时就把平台与展示名盖在条目上（TrendRef）。
      const ref = { ...item, platform: group.platform, label: group.label }
      if (target === undefined) {
        clusters.push({
          key, normalizedUrl, title: item.title, items: [ref],
          platforms: [group.platform], labels: [group.label],
        })
      } else {
        target.items.push(ref)
        if (!target.platforms.includes(group.platform)) {
          target.platforms.push(group.platform)
          target.labels.push(group.label)
        }
      }
    }
  }
  const shaped = clusters.map((cluster) => {
    const items = [...cluster.items].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    const ranks = items.map(item => item.rank).filter(rank => typeof rank === 'number' && rank > 0)
    return {
      id: cluster.key,
      title: cluster.title,
      platforms: cluster.platforms,
      labels: cluster.labels,
      bestRank: ranks.length > 0 ? Math.min(...ranks) : 1,
      firstSeen: Math.min(...items.map(item => item.firstSeen ?? Number.MAX_SAFE_INTEGER)),
      isNew: items.some(item => item.isNew === true),
      items: items.map(({ key, firstSeen, ...rest }) => rest),
    }
  })
  shaped.sort((a, b) =>
    b.platforms.length - a.platforms.length
    || a.bestRank - b.bestRank
    || a.firstSeen - b.firstSeen)
  return shaped.slice(0, maxClusters)
}

/**
 * 给一份已装饰的条目列表标注命中的关注词（归一化后的子串匹配）。
 * 无命中时删掉 watch：换词/清词后，缓存与离线快照里的旧命中不再外泄。
 * @param {object[]} items - decorateFetched 的输出。
 * @param {string[]} keywords - normalizeKeywords 的输出。
 */
export function applyWatch(items, keywords) {
  const prepared = keywords
    .map(keyword => ({ keyword, key: normalizeTrendTitle(keyword) }))
    .filter(prepared_ => prepared_.key !== '')
  for (const item of items) {
    const key = typeof item.key === 'string' && item.key !== '' ? item.key : normalizeTrendTitle(item.title)
    const hits = prepared.filter(({ key: wordKey }) => key.includes(wordKey)).map(({ keyword }) => keyword)
    if (hits.length > 0) item.watch = hits
    else delete item.watch
  }
}

/**
 * 汇总关注命中（spec §D4）：按关键词分组，组内 isNew 优先、真实名次升序。
 * 前置条件：items 已经过 applyWatch。
 * @param {Array<{platform: string, label: string, items: object[]}>} groups - 响应里的源列表。
 * @param {{maxPerKeyword?: number}} [options]
 * @returns {Array<{keyword: string, items: object[]}>}
 */
export function buildWatchGroups(groups, { maxPerKeyword = 10 } = {}) {
  const byKeyword = new Map()
  for (const group of groups) {
    for (const item of group.items ?? []) {
      for (const keyword of item.watch ?? []) {
        if (!byKeyword.has(keyword)) byKeyword.set(keyword, [])
        byKeyword.get(keyword).push({ ...item, platform: group.platform, label: group.label })
      }
    }
  }
  const groupsOut = []
  for (const [keyword, items] of byKeyword) {
    items.sort((a, b) => (b.isNew === true) - (a.isNew === true) || (a.rank ?? 0) - (b.rank ?? 0))
    groupsOut.push({ keyword, items: items.slice(0, maxPerKeyword) })
  }
  return groupsOut
}
