import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DOUYIN_NOTICES_MAX, DOUYIN_RULE_HOME, DOUYIN_RULE_POLICY_HOME, DOUYIN_RULES_MAX_ITEMS,
  mergeDouyinRuleItems, parseDouyinAnnouncements, parseDouyinPolicyDocs, parseDouyinPolicyExplain,
} from '../lib/trends-douyin.js'

// bee 发布物/解释 API 的载荷形态取自 2026-10-25 实抓（bee_dsrc 键名会随发布物变）。
const docsPayload = {
  bee_dsrc_12562: [{
    policyDocInfo: [
      { policyDocTitle: '抖音社区自律公约', type: 'doc', redirectUrl: '' },
      { policyDocTitle: '未成年规范', type: 'doc', redirectUrl: '' },
      { policyDocTitle: '电商规则', type: 'redirect', redirectUrl: '' },
      { policyDocTitle: '抖音社区医疗健康公约', type: 'redirect', redirectUrl: 'https://school.jinritemai.com/doudian/web/article/1' },
      { policyDocTitle: '  ', type: 'doc' },
    ],
    bannerInfo: [{ id: 1 }],
  }],
}

const noticesPayload = {
  bee_dsrc_12428: [
    { title: '2020年抖音安全年度报告', date: '2021/10/01', url: 'https://lf9-cdn-tos.draftstatic.com/obj/a.html' },
    { title: '2024年抖音平台透明度报告', date: '2025/04/16', url: 'https://lf9-cdn-tos.draftstatic.com/obj/b.html' },
    { title: '关于违规MCN机构和账号的处置公告', date: '2024/12/24', url: 'https://api.amemv.com/falcon/x.html' },
    { title: '无链接公告', date: '2025/01/02', url: 'about:blank' },
    { title: '', date: '2025/02/02', url: 'https://x.example/c' },
  ],
}

const explainPayload = {
  status_code: 0,
  policies: [
    { name: '低俗', contents: [{ title: '无低俗引导的色情资源及低俗场所', cases: [] }, { title: '', cases: [] }] },
    { name: '政策法规', contents: [{ title: '歪曲解读国家政策', cases: [] }] },
    { name: '  ', contents: [{ title: '会被跳过的条目', cases: [] }] },
  ],
}

test('parseDouyinPolicyDocs: doc 落公约页、redirect 用自身链接、空标题跳过', () => {
  const items = parseDouyinPolicyDocs(docsPayload)
  assert.deepEqual(items.map(it => it.title), ['抖音社区自律公约', '未成年规范', '电商规则', '抖音社区医疗健康公约'])
  assert.ok(items.every(it => it.hot === '文档'))
  assert.equal(items[0].url, DOUYIN_RULE_POLICY_HOME)
  assert.equal(items[1].url, DOUYIN_RULE_POLICY_HOME, 'redirect 但无链接的条目也落公约页')
  assert.equal(items[3].url, 'https://school.jinritemai.com/doudian/web/article/1')
})

test('parseDouyinPolicyDocs: 非 bee 形态回空', () => {
  assert.deepEqual(parseDouyinPolicyDocs(null), [])
  assert.deepEqual(parseDouyinPolicyDocs({ bee_dsrc_x: 'not-a-list' }), [])
  assert.deepEqual(parseDouyinPolicyDocs([1, 2]), [])
})

test('parseDouyinAnnouncements: 按日期倒序、非 http url 置空、无标题跳过', () => {
  const items = parseDouyinAnnouncements(noticesPayload)
  assert.deepEqual(items.map(it => it.title), [
    '2024年抖音平台透明度报告', '无链接公告', '关于违规MCN机构和账号的处置公告', '2020年抖音安全年度报告',
  ])
  assert.deepEqual(items.map(it => it.hot), ['2025/04/16', '2025/01/02', '2024/12/24', '2021/10/01'])
  assert.equal(items[1].url, '', 'about:blank 不是可点的原文链接')
  assert.equal(items[2].url, 'https://api.amemv.com/falcon/x.html')
})

test('parseDouyinPolicyExplain: 类目｜条目标题、hot 带类目、status_code 非 0 拒收', () => {
  const items = parseDouyinPolicyExplain(explainPayload)
  assert.deepEqual(items.map(it => it.title), ['低俗｜无低俗引导的色情资源及低俗场所', '政策法规｜歪曲解读国家政策'])
  assert.equal(items[0].hot, '低俗')
  assert.equal(items[0].url, DOUYIN_RULE_HOME)
  assert.deepEqual(parseDouyinPolicyExplain({ ...explainPayload, status_code: 8 }), [], '网关错误码不给伪数据')
  assert.deepEqual(parseDouyinPolicyExplain({ status_code: 0, policies: [] }), [])
})

test('mergeDouyinRuleItems: 文档全量 → 公告限量 → 解读补满，杂项容错', () => {
  const many = Array.from({ length: DOUYIN_NOTICES_MAX + 20 }, (_, i) => ({ title: `公告${i}`, hot: '', url: '' }))
  const merged = mergeDouyinRuleItems([
    parseDouyinPolicyDocs(docsPayload),
    parseDouyinAnnouncements(noticesPayload),
    parseDouyinPolicyExplain(explainPayload),
  ])
  assert.equal(merged.length, 4 + 4 + 2)
  assert.deepEqual(merged.slice(0, 2).map(it => it.title), ['抖音社区自律公约', '未成年规范'])
  assert.deepEqual(merged.slice(4, 6).map(it => it.title), ['2024年抖音平台透明度报告', '无链接公告'])
  assert.ok(merged.slice(8).every(it => it.url === DOUYIN_RULE_HOME), '解读条目排在最后')
  // 公告超额只留最新预算内的条数（公告本身已按日期倒序传入）
  const budgeted = mergeDouyinRuleItems([[], many, []])
  assert.equal(budgeted.length, DOUYIN_NOTICES_MAX)
  assert.deepEqual(budgeted.slice(0, 2).map(it => it.title), ['公告0', '公告1'])
  assert.equal(mergeDouyinRuleItems('not-a-list').length, 0)
})

test('mergeDouyinRuleItems: 总量超额时按文档 → 公告 → 解读的顺序、靠后的份先让位', () => {
  const docs = Array.from({ length: DOUYIN_RULES_MAX_ITEMS - DOUYIN_NOTICES_MAX + 10 }, (_, i) => ({ title: `文档${i}`, hot: '', url: '' }))
  const notices = Array.from({ length: DOUYIN_NOTICES_MAX }, (_, i) => ({ title: `公告${i}`, hot: '', url: '' }))
  const explain = Array.from({ length: 50 }, (_, i) => ({ title: `解读${i}`, hot: '', url: '' }))
  const merged = mergeDouyinRuleItems([docs, notices, explain])
  assert.equal(merged.length, DOUYIN_RULES_MAX_ITEMS)
  // 真实数据文档只有个位数，这条是防御路径：解读先让位、公告次之。
  assert.equal(merged.filter(it => it.title.startsWith('解读')).length, 0)
  assert.equal(merged.filter(it => it.title.startsWith('公告')).length, DOUYIN_NOTICES_MAX - 10)
})

test('合并结果可直接进 decorateFetched 轨迹链（rank 分配与去重）', async () => {
  const { decorateFetched } = await import('../lib/trends.js')
  const merged = mergeDouyinRuleItems([
    parseDouyinPolicyDocs(docsPayload),
    parseDouyinAnnouncements(noticesPayload),
  ])
  const { items } = decorateFetched(null, merged, 1_800_000_000)
  assert.equal(items.length, merged.length)
  assert.deepEqual(items.map(it => it.rank).slice(0, 3), [1, 2, 3])
})
