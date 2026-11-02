// 抖音官方规则源（热点雷达 douyin_rule）的纯解析层。三份免登录数据——公约文档
// （bee 发布物 10877）、治理公告与透明度报告（10810，带发布日期，是本源最接近
// 「最新规则」的数据面）、规则中心解读库（/aweme/v3/light/policy/explain/）
// ——各自独立解析成榜单条目 [{title, hot, url}]；取数、代理与降级链在宿主半
// index.js，这里保持 node --test 可直接覆盖的纯函数。

/**
 * 规则中心三个数据面的 URL。两个 bee 发布物 id 引用自规则中心网页端
 * （douyin_security_web 首页加载的 JSON）；抖音重发发布物换 id 时本源整源
 * 失败并走 24h 快照降级，属已知代价。
 */
export const DOUYIN_RULE_URLS = {
  explain: 'https://www.douyin.com/aweme/v3/light/policy/explain/',
  docs: 'https://lf3-beecdn.bytetos.com/obj/ies-fe-bee/bee_prod/biz_1107/bee_prod_1107_bee_publish_10877.json',
  notices: 'https://lf3-beecdn.bytetos.com/obj/ies-fe-bee/bee_prod/biz_1107/bee_prod_1107_bee_publish_10810.json',
}

/** 条目 url 的落点：用户点击后能直接在浏览器里看的规则中心页面。 */
export const DOUYIN_RULE_HOME = 'https://www.douyin.com/rule/encyclopedia'
export const DOUYIN_RULE_POLICY_HOME = 'https://www.douyin.com/rule/policy'

/** 公告预算：公告库百余条只取最新这么多，给解读库留出展示位。 */
export const DOUYIN_NOTICES_MAX = 30
/** 源容量上限：文档 + 公告 + 解读合计截到 100，保护轨迹文件与聚合视图。 */
export const DOUYIN_RULES_MAX_ITEMS = 100

/** bee 发布物统一包一层 `{bee_dsrc_<id>: [...]}`；取唯一键下的数组，形态不符回空。 */
function beeList(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return []
  const first = Object.values(payload)[0]
  return Array.isArray(first) ? first : []
}

/**
 * 公约文档（bee 10877）→ 置顶条目。`type=doc` 落规则中心公约页；
 * `type=redirect` 用自身 redirectUrl（可能为空串，条目仍列出）。
 * @param {unknown} payload - bee 发布物 JSON。
 * @returns {Array<{title: string, hot: string, url: string}>}
 */
export function parseDouyinPolicyDocs(payload) {
  const out = []
  for (const root of beeList(payload)) {
    for (const doc of Array.isArray(root?.policyDocInfo) ? root.policyDocInfo : []) {
      const title = typeof doc?.policyDocTitle === 'string' ? doc.policyDocTitle.trim() : ''
      if (!title) continue
      const redirect = doc.type === 'redirect' && typeof doc.redirectUrl === 'string'
        ? doc.redirectUrl : ''
      out.push({ title, hot: '文档', url: redirect || DOUYIN_RULE_POLICY_HOME })
    }
  }
  return out
}

/**
 * 治理公告与透明度报告（bee 10810）→ 带日期条目，按日期倒序（源数据为
 * yyyy/MM/dd，字典序即时间序）。这是本源唯一带发布时间的数据面：新公告
 * 发布进榜即标「新」。公告库百余条，取用预算见 mergeDouyinRuleItems。
 * @param {unknown} payload - bee 发布物 JSON。
 * @returns {Array<{title: string, hot: string, url: string}>}
 */
export function parseDouyinAnnouncements(payload) {
  const out = []
  for (const item of beeList(payload)) {
    if (item === null || typeof item !== 'object') continue
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!title) continue
    const hot = typeof item.date === 'string' ? item.date.trim() : ''
    const url = typeof item.url === 'string' && /^https?:/i.test(item.url) ? item.url : ''
    out.push({ title, hot, url })
  }
  return out.sort((a, b) => b.hot.localeCompare(a.hot))
}

/**
 * 规则解读库（/aweme/v3/light/policy/explain/）→ `类目｜条目` 标题、hot 带
 * 类目名，url 落规则百科页。status_code 非 0 视为无效载荷，由取数层决定降级。
 * @param {unknown} payload - explain API 的 JSON。
 * @returns {Array<{title: string, hot: string, url: string}>}
 */
export function parseDouyinPolicyExplain(payload) {
  if (payload === null || typeof payload !== 'object' || payload.status_code !== 0) return []
  const policies = Array.isArray(payload.policies) ? payload.policies : []
  const out = []
  for (const policy of policies) {
    const name = typeof policy?.name === 'string' ? policy.name.trim() : ''
    if (!name) continue
    for (const content of Array.isArray(policy.contents) ? policy.contents : []) {
      const title = typeof content?.title === 'string' ? content.title.trim() : ''
      if (!title) continue
      out.push({ title: `${name}｜${title}`, hot: name, url: DOUYIN_RULE_HOME })
    }
  }
  return out
}

/**
 * 三份解析结果按固定顺序合并：公约文档（全量）→ 公告（最新 DOUYIN_NOTICES_MAX
 * 条）→ 解读库（补满到 DOUYIN_RULES_MAX_ITEMS）。公告百余条若不限量会把解读库
 * 整体挤出榜单，预算在这里统一裁决。非数组份与无标题条目跳过。
 * @param {unknown[]} parts - 各数据面的解析输出（元素可为任意值）。
 * @returns {Array<{title: string, hot: string, url: string}>}
 */
export function mergeDouyinRuleItems(parts) {
  const [docs, notices, explain] = Array.isArray(parts) ? parts : []
  const take = (part, budget) => {
    const out = []
    for (const item of Array.isArray(part) ? part : []) {
      if (out.length >= budget) break
      if (item !== null && typeof item === 'object' && typeof item.title === 'string' && item.title.trim() !== '') {
        out.push(item)
      }
    }
    return out
  }
  return [
    ...take(docs, DOUYIN_RULES_MAX_ITEMS),
    ...take(notices, DOUYIN_NOTICES_MAX),
    ...take(explain, Math.max(0, DOUYIN_RULES_MAX_ITEMS - DOUYIN_NOTICES_MAX)),
  ].slice(0, DOUYIN_RULES_MAX_ITEMS)
}
