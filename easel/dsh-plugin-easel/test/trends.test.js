import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyWatch, buildWatchGroups, clusterTrends, decorateFetched, normalizeKeywords,
  normalizeTrendTitle, pruneSnapshot, readRadarHistory, staleItemsFromHistory,
} from '../lib/trends.js'

const NOW = 1_800_000_000

function fetched(...titles) {
  return titles.map(title => ({ title, hot: '', url: '' }))
}

test('normalizeTrendTitle keeps letters/digits only and truncates', () => {
  assert.equal(normalizeTrendTitle(' 苹果 iPhone 17 发布！'), '苹果iphone17发布')
  assert.equal(normalizeTrendTitle('ＡＢＣ／ｄｅｆ'), 'abcdef')
  assert.equal(normalizeTrendTitle('A'.repeat(200)).length, 120)
  assert.equal(normalizeTrendTitle(undefined), '')
})

test('decorateFetched: first round is a baseline with no badges', () => {
  const { items, entries } = decorateFetched(null, fetched('话题A', '话题B'), NOW)
  assert.equal(items.some(it => it.isNew || it.delta !== undefined), false, 'no history → no mass isNew')
  assert.deepEqual(items.map(it => it.rank), [1, 2])
  assert.deepEqual(entries.map(e => [e.key, e.firstSeen, e.lastRank]), [['话题a', NOW, 1], ['话题b', NOW, 2]])
})

test('decorateFetched: second round computes rank deltas and flags new titles', () => {
  const prev = { at: NOW - 120, items: [
    { key: '话题a', title: '话题A', firstSeen: NOW - 3600, lastSeen: NOW - 120, lastRank: 3 },
    { key: '话题b', title: '话题B', firstSeen: NOW - 7200, lastSeen: NOW - 120, lastRank: 2 },
  ] }
  const { items } = decorateFetched(prev, fetched('话题B', '新话题', '话题A'), NOW)
  assert.deepEqual(items.map(it => [it.title, it.rank, it.delta, it.isNew]), [
    ['话题B', 1, 1, false],
    ['新话题', 2, undefined, true],
    ['话题A', 3, 0, false],
  ])
  assert.equal(items[2].firstSeen, NOW - 3600, 'prior entry keeps its original firstSeen')
  assert.equal(items[0].ageMin, Math.floor(7200 / 60))
  assert.equal(items[1].firstSeen, NOW)
})

test('decorateFetched: stale previous snapshot rebuilds the baseline (no mass isNew)', () => {
  const prev = { at: NOW - 3600, items: [{ key: '话题a', title: '话题A', firstSeen: NOW - 7200, lastSeen: NOW - 3600, lastRank: 1 }] }
  const { items } = decorateFetched(prev, fetched('话题A', '话题B'), NOW)
  assert.equal(items.some(it => it.isNew || it.delta !== undefined), false, 'over 30min gap → no badges')
  assert.equal(items[0].firstSeen, NOW, 'baseline reset stamps firstSeen=now')
})

test('decorateFetched dedupes by normalized key', () => {
  const { items } = decorateFetched(null, fetched('话题A', '话题 a！'), NOW)
  assert.equal(items.length, 1)
})

test('pruneSnapshot drops entries unseen for 72h and caps per-source size', () => {
  const snapshot = { at: NOW, items: [
    { key: '旧', title: '旧', firstSeen: NOW - 100 * 3600, lastSeen: NOW - 80 * 3600, lastRank: 1 },
    { key: '新', title: '新', firstSeen: NOW - 3600, lastSeen: NOW, lastRank: 2 },
  ] }
  const pruned = pruneSnapshot(snapshot, NOW)
  assert.deepEqual(pruned.items.map(entry => entry.key), ['新'])
  const many = { at: NOW, items: Array.from({ length: 260 }, (_, i) => (
    { key: `k${i}`, title: `k${i}`, firstSeen: NOW, lastSeen: NOW, lastRank: i + 1 }
  )) }
  assert.equal(pruneSnapshot(many, NOW).items.length, 200)
})

test('readRadarHistory: valid file, wrong version, and garbage all behave', async () => {
  const good = await readRadarHistory('/root', async () => ({ version: 1, sources: { weibo: { at: NOW, items: [
    { key: 'a', title: 'A', firstSeen: NOW, lastSeen: NOW, lastRank: 1 },
    { key: 'bad' },
  ] } } }))
  assert.equal(good.sources.weibo.items.length, 1, 'malformed entries filtered')
  assert.deepEqual(await readRadarHistory('/root', async () => ({ version: 9, sources: {} })).then(h => h.sources), {})
  assert.deepEqual((await readRadarHistory('/root', async () => null)).sources, {})
})

test('staleItemsFromHistory serves a 24h-offline snapshot and refuses older ones', () => {
  const snapshot = { at: NOW - 3600, items: [
    { key: 'b', title: 'B', firstSeen: NOW - 7200, lastSeen: NOW - 3600, lastRank: 2 },
    { key: 'a', title: 'A', firstSeen: NOW - 7200, lastSeen: NOW - 1800, lastRank: 1 },
    { key: 'old', title: 'OLD', firstSeen: NOW - 40 * 3600, lastSeen: NOW - 30 * 3600, lastRank: 3 },
  ] }
  const items = staleItemsFromHistory(snapshot, NOW)
  assert.deepEqual(items.map(it => it.title), ['A', 'B'], 'sorted by rank, >24h entries dropped')
  assert.equal(staleItemsFromHistory({ at: NOW - 25 * 3600, items: snapshot.items }, NOW), null)
  assert.equal(staleItemsFromHistory(undefined, NOW), null)
})

test('clusterTrends merges cross-platform same titles and keeps singletons', () => {
  const groups = [
    { platform: 'weibo', label: '微博', items: [
      { title: '神舟二十号发射成功', url: 'https://weibo.com/a', hot: '100万', rank: 1, isNew: true, firstSeen: NOW },
      { title: '完全不相关的话题', url: '', hot: '', rank: 2, isNew: false, firstSeen: NOW - 60 },
    ] },
    { platform: 'toutiao', label: '头条', items: [
      { title: '神舟二十号发射圆满成功！', url: 'https://toutiao.com/b', hot: '80万', rank: 1, isNew: false, firstSeen: NOW - 30 },
    ] },
    { platform: 'zhihu', label: '知乎', items: [
      { title: '如何看待神舟二十号发射成功', url: '', hot: '', rank: 4, isNew: false, firstSeen: NOW },
    ] },
  ]
  const clusters = clusterTrends(groups)
  assert.equal(clusters[0].platforms.join(','), 'weibo,toutiao,zhihu')
  assert.equal(clusters[0].bestRank, 1)
  assert.equal(clusters[0].isNew, true)
  assert.deepEqual(clusters[0].items.map(it => [it.platform, it.label, it.rank]), [
    ['weibo', '微博', 1],
    ['toutiao', '头条', 1],
    ['zhihu', '知乎', 4],
  ], 'cluster body rows carry their source for the card and the right-click payload')
  assert.ok(clusters[0].items.every(it => !('key' in it) && !('firstSeen' in it)), 'internal fields stripped from cluster payload')
  assert.equal(clusters[0].items.length, 3)
  assert.equal(clusters.length, 2, 'unrelated topic stays its own cluster')
  assert.equal(clusters[1].platforms.length, 1)
  assert.deepEqual(clusters[1].items[0].title, '完全不相关的话题')
})

test('clusterTrends: short titles only merge on exact match', () => {
  const groups = [
    { platform: 'weibo', label: '微博', items: [{ title: '官宣', url: '', hot: '', rank: 1, firstSeen: NOW }] },
    { platform: 'douyin', label: '抖音', items: [{ title: '官宣!', url: '', hot: '', rank: 2, firstSeen: NOW }] },
    { platform: 'zhihu', label: '知乎', items: [{ title: 'депутат', url: '', hot: '', rank: 3, firstSeen: NOW }] },
  ]
  const clusters = clusterTrends(groups)
  assert.equal(clusters.length, 2, '官宣 merges (same key), депутат separate')
})

test('clusterTrends: identical non-empty URLs merge regardless of title', () => {
  const groups = [
    { platform: 'weibo', label: '微博', items: [{ title: '标题甲版本', url: 'https://x.com/1', hot: '', rank: 1, firstSeen: NOW }] },
    { platform: 'douyin', label: '抖音', items: [{ title: '完全不同的说法', url: 'https://x.com/1', hot: '', rank: 2, firstSeen: NOW }] },
  ]
  assert.equal(clusterTrends(groups).length, 1)
})

test('normalizeKeywords: split, trim, dedupe case-insensitively, cap at 20', () => {
  assert.deepEqual(normalizeKeywords('AI, 人工智能；大模型  ai 、'), ['AI', '人工智能', '大模型'])
  assert.deepEqual(normalizeKeywords(['a b', 'c']), ['a b', 'c'])
  assert.equal(normalizeKeywords(Array.from({ length: 30 }, (_, i) => `词${i}`)).length, 20)
  assert.equal(normalizeKeywords('   ,，，').length, 0, 'no empty keywords')
  assert.deepEqual(normalizeKeywords(undefined), [])
})

test('applyWatch + buildWatchGroups: per-keyword groups, isNew first, rank order', () => {
  const groups = [
    { platform: 'weibo', label: '微博', items: [
      { title: '苹果发布会定了', key: normalizeTrendTitle('苹果发布会定了'), rank: 3, isNew: false, firstSeen: NOW },
      { title: '苹果新品曝光', key: normalizeTrendTitle('苹果新品曝光'), rank: 8, isNew: true, firstSeen: NOW },
    ] },
    { platform: 'zhihu', label: '知乎', items: [
      { title: '华为苹果之争', key: normalizeTrendTitle('华为苹果之争'), rank: 1, isNew: false, firstSeen: NOW },
      { title: '无关', key: '无关', rank: 2, isNew: false, firstSeen: NOW },
    ] },
  ]
  for (const group of groups) applyWatch(group.items, ['苹果', '华为'])
  assert.deepEqual(groups[0].items[0].watch, ['苹果'])
  assert.deepEqual(groups[1].items[0].watch, ['苹果', '华为'])
  const watch = buildWatchGroups(groups)
  assert.equal(watch.length, 2)
  assert.deepEqual(watch[0].items.map(it => it.title), ['苹果新品曝光', '华为苹果之争', '苹果发布会定了'])
  assert.equal(watch[0].items[0].platform, 'weibo')
  assert.equal(watch[0].items[1].platform, 'zhihu')
  assert.equal(watch[1].items.length, 1)
  assert.deepEqual(buildWatchGroups([{ platform: 'p', label: 'P', items: [{ title: '无关', rank: 1 }] }]), [])
})
