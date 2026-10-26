// 多账户宿主侧回归：异步发布回写账号、直启窗口重启后从登录标记恢复、陈旧账号 id 严格拒绝。
// 复现过的缺陷（2026-10-26 复审）：runPublishBg 漏传 account 导致抖音排期无账号；
// 其收尾里 '\n'.join(...) 不是 JS API（成功路径也抛 TypeError）；apiPublish 调用的
// safeOutputPath 曾未从 index.js 导出（ReferenceError，带媒体发布全 500）。
// 抖音分支的端到端用例通过一个假 runner（node 可执行任意扩展名文件）走真实路由。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AUTOMATION_ROUTES, accountCdpEndpoint, resolveAccountStrict, runPublishBg } from '../lib/plugins/automation.js'
import { dispatchLocalApi } from '../index.js'

const settings = root => ({
  projectRoot: root,
  skillsDir: join(root, 'skills', 'openclaw'),
  python: process.execPath,
})

const account = extra => ({
  id: 'douyin-x1', platform: 'douyin', name: '大号', persona: null, profileDir: 'Douyin__douyin-x1', ...extra,
})

/** 临时数据根；调用方负责在 finally 里 rmSync。 */
const tmpRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-automation-'))
  mkdirSync(join(root, 'outputs', '_publish'), { recursive: true })
  mkdirSync(join(root, 'outputs', '_login'), { recursive: true })
  return root
}

const cleanup = root => rmSync(root, { recursive: true, force: true })

const call = (root, method, path, body, query = '') => dispatchLocalApi(
  settings(root), method, path.split('/').filter(Boolean), new URLSearchParams(query),
  async () => body ?? {}, {}, AUTOMATION_ROUTES)

/** 假 runner：publish 立即成功退出；whoami 输出一行 JSON。参数一律忽略（账号参数由断言单独覆盖）。 */
function fakeRunner(root, name, whoamiJson) {
  const dir = join(root, 'skills', 'shared', 'scripts')
  mkdirSync(dir, { recursive: true })
  const source = [
    ...(whoamiJson === undefined ? [] : [`if (process.argv.includes('whoami')) { console.log(${JSON.stringify(JSON.stringify(whoamiJson))}); process.exit(0) }`]),
    'process.exit(0)',
  ].join('\n')
  writeFileSync(join(dir, name), source, 'utf8')
}

const waitForState = async (file, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      if (raw.state === 'success' || raw.state === 'error') return raw
    } catch { /* 还没写 */ }
    await new Promise(done => { setTimeout(done, 50) })
  }
  throw new Error(`state file never settled: ${file}`)
}

test('async publish finishes its bookkeeping and writes the account into the schedule', async () => {
  const root = tmpRoot()
  try {
    const codeFile = join(root, 'outputs', '_publish', 'douyin-x1.code')
    writeFileSync(codeFile, '1234', 'utf8')

    await runPublishBg(settings(root), 'douyin-x1', [process.execPath, '-e', '0'], '标题', '正文', { name: '抖音' }, codeFile, account())

    const items = JSON.parse(readFileSync(join(root, 'outputs', '_schedule.json'), 'utf8'))
    assert.equal(items.length, 1)
    assert.equal(items[0].platform, '抖音')
    assert.equal(items[0].accountId, 'douyin-x1')
    assert.equal(items[0].accountName, '大号')
    const status = JSON.parse(readFileSync(join(root, 'outputs', '_publish', 'douyin-x1.json'), 'utf8'))
    assert.equal(status.state, 'success')
  } finally {
    cleanup(root)
  }
})

test('a failed async publish records the error state and no schedule entry', async () => {
  const root = tmpRoot()
  try {
    const codeFile = join(root, 'outputs', '_publish', 'douyin-x1.code')
    writeFileSync(codeFile, '1234', 'utf8')

    await runPublishBg(settings(root), 'douyin-x1', [process.execPath, '-e', 'console.error("boom"); process.exit(3)'], '标题', '', { name: '抖音' }, codeFile, account())

    const status = JSON.parse(readFileSync(join(root, 'outputs', '_publish', 'douyin-x1.json'), 'utf8'))
    assert.equal(status.state, 'error')
    assert.match(status.message, /boom/)
    assert.throws(() => readFileSync(join(root, 'outputs', '_schedule.json'), 'utf8'))
  } finally {
    cleanup(root)
  }
})

test('POST /publish/douyin carries the account through the async route into the schedule', async () => {
  const root = tmpRoot()
  try {
    writeFileSync(join(root, 'outputs', '_accounts.json'),
      JSON.stringify({ version: 1, accounts: [account()] }), 'utf8')
    writeFileSync(join(root, 'outputs', 'clip.mp4'), Buffer.from([0x00, 0x00, 0x00, 0x18]))
    fakeRunner(root, 'douyin_publish.py')

    const started = await call(root, 'POST', 'publish/douyin', {
      account: 'douyin-x1', title: '标题', body: '正文', media: ['clip.mp4'],
    })
    assert.equal(started.json.async, true)

    const status = await waitForState(join(root, 'outputs', '_publish', 'douyin-x1.json'))
    assert.equal(status.state, 'success')
    const items = JSON.parse(readFileSync(join(root, 'outputs', '_schedule.json'), 'utf8'))
    assert.equal(items[0].accountId, 'douyin-x1')
    assert.equal(items[0].accountName, '大号')
  } finally {
    cleanup(root)
  }
})

test('a direct-launch window is rediscovered from the login marker after a host restart', async () => {
  const root = tmpRoot()
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"Browser":"Chromium"}')
  })
  await new Promise(done => { server.listen(0, '127.0.0.1', done) })
  const port = server.address().port
  try {
    writeFileSync(join(root, 'outputs', '_login', 'douyin-x1.json'),
      JSON.stringify({ state: 'success', message: '', qr: '', ts: 0, port, pid: 4321 }), 'utf8')
    assert.equal(await accountCdpEndpoint(settings(root), account()), `http://127.0.0.1:${port}`)
  } finally {
    server.close()
    cleanup(root)
  }
})

test('a dead port in the marker does not count as an attached window', async () => {
  const root = tmpRoot()
  try {
    writeFileSync(join(root, 'outputs', '_login', 'douyin-x1.json'),
      JSON.stringify({ state: 'success', port: 1, pid: 4321 }), 'utf8')
    assert.equal(await accountCdpEndpoint(settings(root), account()), '')
  } finally {
    cleanup(root)
  }
})

test('whoami keeps the direct-launch port, leaves a live window marker, and clears a dead one', async () => {
  const root = tmpRoot()
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"Browser":"Chromium"}')
  })
  await new Promise(done => { server.listen(0, '127.0.0.1', done) })
  const port = server.address().port
  const marker = id => join(root, 'outputs', '_login', `${id}.json`)
  try {
    fakeRunner(root, 'douyin_publish.py', { loggedIn: true, name: '测试号', avatar: '' })
    writeFileSync(join(root, 'outputs', '_accounts.json'), JSON.stringify({
      version: 1,
      accounts: [
        account({ id: 'douyin-live' }), account({ id: 'douyin-live-out' }), account({ id: 'douyin-dead' }),
      ],
    }), 'utf8')

    // 登录成功 + 窗口在：状态转 success，但 port/pid 必须留住（重启后靠它恢复附身）。
    writeFileSync(marker('douyin-live'), JSON.stringify({ state: 'window-open', port, pid: 4321 }), 'utf8')
    const ok = await call(root, 'GET', 'accounts/douyin/whoami', null, 'account=douyin-live')
    assert.equal(ok.json.loggedIn, true)
    const kept = JSON.parse(readFileSync(marker('douyin-live'), 'utf8'))
    assert.equal(kept.state, 'success')
    assert.equal(kept.port, port)

    // 未登录 + 窗口在：window-open 标记是恢复权威，不能被删。
    fakeRunner(root, 'douyin_publish.py', { loggedIn: false, name: '', avatar: '' })
    writeFileSync(marker('douyin-live-out'), JSON.stringify({ state: 'window-open', port, pid: 4322 }), 'utf8')
    const out = await call(root, 'GET', 'accounts/douyin/whoami', null, 'account=douyin-live-out')
    assert.equal(out.json.loggedIn, false)
    assert.equal(JSON.parse(readFileSync(marker('douyin-live-out'), 'utf8')).port, port)

    // 未登录 + 端口死：陈旧标记该清掉。
    writeFileSync(marker('douyin-dead'), JSON.stringify({ state: 'success', port: 1, pid: 4323 }), 'utf8')
    const dead = await call(root, 'GET', 'accounts/douyin/whoami', null, 'account=douyin-dead')
    assert.equal(dead.json.loggedIn, false)
    assert.equal(existsSync(marker('douyin-dead')), false)
  } finally {
    server.close()
    cleanup(root)
  }
})

test('stale explicit account ids are refused instead of falling back to the default account', () => {
  const registry = { version: 1, accounts: [account(), account({ id: 'douyin-x2', name: '小号' })] }
  assert.equal(resolveAccountStrict(registry, 'douyin', '')?.id, 'douyin-x1')
  assert.equal(resolveAccountStrict(registry, 'douyin', 'douyin-x2')?.id, 'douyin-x2')
  assert.equal(resolveAccountStrict(registry, 'douyin', 'douyin-gone'), null)
  assert.equal(resolveAccountStrict(registry, 'douyin', 'kuaishou-x1'), null, 'other platform id does not match')
  assert.equal(resolveAccountStrict(registry, 'xiaohongshu', ''), null)
})
