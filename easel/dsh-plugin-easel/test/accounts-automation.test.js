// 多账户宿主侧回归：异步发布回写账号、直启窗口重启后从登录标记恢复、陈旧账号 id 严格拒绝。
// 复现过的缺陷（2026-10-26 复审）：runPublishBg 漏传 account 导致抖音排期无账号；
// 且其收尾里 '\n'.join(...) 不是 JS API，成功路径也抛 TypeError，收尾四步全部不执行。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { accountCdpEndpoint, resolveAccountStrict, runPublishBg } from '../lib/plugins/automation.js'

const settings = root => ({
  projectRoot: root,
  skillsDir: join(root, 'skills', 'openclaw'),
  python: process.execPath,
})

const account = extra => ({
  id: 'douyin-x1', platform: 'douyin', name: '大号', persona: null, profileDir: 'Douyin__douyin-x1', ...extra,
})

const tmpRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-automation-'))
  mkdirSync(join(root, 'outputs', '_publish'), { recursive: true })
  mkdirSync(join(root, 'outputs', '_login'), { recursive: true })
  return root
}

test('async publish finishes its bookkeeping and writes the account into the schedule', async () => {
  const root = tmpRoot()
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
})

test('a failed async publish records the error state and no schedule entry', async () => {
  const root = tmpRoot()
  const codeFile = join(root, 'outputs', '_publish', 'douyin-x1.code')
  writeFileSync(codeFile, '1234', 'utf8')

  await runPublishBg(settings(root), 'douyin-x1', [process.execPath, '-e', 'console.error("boom"); process.exit(3)'], '标题', '', { name: '抖音' }, codeFile, account())

  const status = JSON.parse(readFileSync(join(root, 'outputs', '_publish', 'douyin-x1.json'), 'utf8'))
  assert.equal(status.state, 'error')
  assert.match(status.message, /boom/)
  assert.throws(() => readFileSync(join(root, 'outputs', '_schedule.json'), 'utf8'))
})

test('a direct-launch window is rediscovered from the login marker after a host restart', async () => {
  const root = tmpRoot()
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"Browser":"Chromium"}')
  })
  await new Promise(done => { server.listen(0, '127.0.0.1', done) })
  const port = server.address().port
  writeFileSync(join(root, 'outputs', '_login', 'douyin-x1.json'),
    JSON.stringify({ state: 'success', message: '', qr: '', ts: 0, port, pid: 4321 }), 'utf8')
  try {
    assert.equal(await accountCdpEndpoint(settings(root), account()), `http://127.0.0.1:${port}`)
  } finally {
    server.close()
  }
})

test('a dead port in the marker does not count as an attached window', async () => {
  const root = tmpRoot()
  writeFileSync(join(root, 'outputs', '_login', 'douyin-x1.json'),
    JSON.stringify({ state: 'success', port: 1, pid: 4321 }), 'utf8')
  assert.equal(await accountCdpEndpoint(settings(root), account()), '')
})

test('stale explicit account ids are refused instead of falling back to the default account', () => {
  const registry = { version: 1, accounts: [account(), account({ id: 'douyin-x2', name: '小号' })] }
  assert.equal(resolveAccountStrict(registry, 'douyin', '')?.id, 'douyin-x1')
  assert.equal(resolveAccountStrict(registry, 'douyin', 'douyin-x2')?.id, 'douyin-x2')
  assert.equal(resolveAccountStrict(registry, 'douyin', 'douyin-gone'), null)
  assert.equal(resolveAccountStrict(registry, 'douyin', 'kuaishou-x1'), null, 'other platform id does not match')
  assert.equal(resolveAccountStrict(registry, 'xiaohongshu', ''), null)
})
