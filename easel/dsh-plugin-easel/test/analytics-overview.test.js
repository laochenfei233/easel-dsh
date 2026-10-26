// 工作台全览：每个账号读自己的归档快照；未归档平台如实标记；详情抓取把账号 id 当归档键。
// 归档文件的写入由 account_stats.py selftest 覆盖；这里用假 runner 验证 Node 侧的接线与隔离，
// 保证「同平台两个号」不会读到彼此的历史。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AUTOMATION_ROUTES } from '../lib/plugins/automation.js'
import { dispatchLocalApi } from '../index.js'

const HISTORY = {
  douyin: { latest: { ts: 1_700_000_000, followers: 100, likes: 10, posts: 2 }, growth: null, points: [{ ts: 1_700_000_000, followers: 100 }], ageDays: 2.5 },
  'douyin-x2': { latest: { ts: 1_700_000_500, followers: 200, likes: 20, posts: 3 }, growth: null, points: [{ ts: 1_700_000_500, followers: 200 }], ageDays: 0.2 },
}

/** 假 account_stats.py：history 按归档键回不同数据；fetch 把收到的归档键回显出来。 */
const fakeStats = `const argv = process.argv.slice(2)
const pick = flag => { const i = argv.indexOf(flag); return i === -1 ? null : argv[i + 1] }
const key = pick('--history-key')
const history = ${JSON.stringify(HISTORY)}
if (argv[0] === 'history') {
  console.log(JSON.stringify({ platform: pick('--platform'), historyKey: key, ...(history[key] ?? { latest: null, growth: null, points: [], ageDays: null }) }))
} else if (argv[0] === 'fetch') {
  console.log(JSON.stringify({
    platform: pick('--platform'), name: '抖音', nickname: '测试号', loggedIn: true,
    followers: 200, likes: 20, following: 5, posts: 3, metrics: [], notes: [],
    growth: {}, fetched_at: 1700000500, historyKey: key,
  }))
} else {
  process.exit(2)
}
`

const root = mkdtempSync(join(tmpdir(), 'easel-overview-'))
process.env.EASEL_BROWSER_PROFILES = join(root, 'browser-profiles')
mkdirSync(join(root, 'browser-profiles'), { recursive: true })
mkdirSync(join(root, 'outputs', '_login'), { recursive: true })
mkdirSync(join(root, 'skills', 'shared', 'scripts'), { recursive: true })
writeFileSync(join(root, 'skills', 'shared', 'scripts', 'account_stats.py'), fakeStats, 'utf8')
writeFileSync(join(root, 'outputs', '_accounts.json'), JSON.stringify({
  version: 1,
  accounts: [
    { id: 'douyin', platform: 'douyin', name: '抖音', persona: null, profileDir: 'DouyinProfile' },
    { id: 'douyin-x2', platform: 'douyin', name: '小号', persona: '副人格', profileDir: 'Douyin__douyin-x2' },
    { id: 'bilibili-x1', platform: 'bilibili', name: 'B站主号', persona: null, profileDir: null, cookieFile: 'outputs/_accounts/bilibili-x1/cookies.json' },
  ],
}), 'utf8')
writeFileSync(join(root, 'outputs', '_login', 'douyin.json'), JSON.stringify({ state: 'success' }), 'utf8')
writeFileSync(join(root, 'outputs', '_login', 'douyin-x2.json'), JSON.stringify({ state: 'success' }), 'utf8')

const settings = { projectRoot: root, skillsDir: join(root, 'skills', 'openclaw'), python: process.execPath }
const call = (method, path, body, query = '') => dispatchLocalApi(
  settings, method, path.split('/').filter(Boolean), new URLSearchParams(query),
  async () => body ?? {}, {}, AUTOMATION_ROUTES)

test('overview reads each account history separately and marks non-archived platforms', async () => {
  const rows = (await call('GET', 'analytics/overview')).json
  assert.equal(rows.length, 3)
  const [main, second, bili] = rows
  assert.equal(main.id, 'douyin')
  assert.equal(main.archived, true)
  assert.equal(main.loggedIn, true)
  assert.equal(main.latest.followers, 100, 'default account reads its own archive')
  assert.equal(main.ageDays, 2.5)
  assert.equal(second.id, 'douyin-x2')
  assert.equal(second.persona, '副人格')
  assert.equal(second.latest.followers, 200, 'second account on the same platform reads its own archive')
  assert.equal(bili.archived, false, 'bilibili does not write an archive')
  assert.equal(bili.latest, null)
  assert.deepEqual(bili.points, [])
})

test('the overview literal route wins over the platform route', async () => {
  // 若被 ['analytics', ':p'] 抢先，overview 会被当成平台名 → 404「该平台暂不支持数据抓取」。
  const rows = await call('GET', 'analytics/overview')
  assert.ok(Array.isArray(rows.json))
})

test('detail fetch keys the archive by account id', async () => {
  const main = (await call('GET', 'analytics/douyin', null, 'account=douyin')).json
  assert.equal(main.historyKey, 'douyin')
  const second = (await call('GET', 'analytics/douyin', null, 'account=douyin-x2')).json
  assert.equal(second.historyKey, 'douyin-x2', 'a named account must not write into the default archive')
})

test('a stale account id cannot fall back to the default account', async () => {
  await assert.rejects(call('GET', 'analytics/douyin', null, 'account=douyin-gone'), error => error.status === 400)
})

test.after(() => { rmSync(root, { recursive: true, force: true }) })
