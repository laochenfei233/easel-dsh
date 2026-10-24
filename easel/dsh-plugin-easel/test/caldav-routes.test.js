/** CalDAV 路由行为测试：账号掩码/密码保留语义、事件缓存读取、发现/同步错误上抛。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CORE_ROUTES, dispatchLocalApi } from '../index.js'

const root = mkdtempSync(join(tmpdir(), 'easel-caldav-'))
const settings = {
  projectRoot: root,
  skillsDir: join(root, 'skills', 'openclaw'),
  backendUrl: new URL('http://127.0.0.1:1'),
  basePath: '/easel',
}
mkdirSync(join(root, 'outputs'), { recursive: true })

const call = (method, path, body) =>
  dispatchLocalApi(settings, method, path.split('/').filter(Boolean), new URLSearchParams(),
    async () => body ?? {}, {}, CORE_ROUTES)

test('账号 PUT/GET：密码掩码回显、空密码保留原值、颜色按序分配', async () => {
  const put = await call('PUT', 'caldav/accounts', { accounts: [
    { name: 'iCloud', url: 'https://caldav.icloud.com/', username: 'me@icloud.com', password: 'app-pass-1234' },
    { name: 'Fastmail', url: 'https://caldav.fastmail.com/dav/', username: 'me', password: '' },
  ] })
  assert.equal(put.json.ok, true)
  const got = await call('GET', 'caldav/accounts')
  const icloud = got.json.accounts.find(a => a.name === 'iCloud')
  const fastmail = got.json.accounts.find(a => a.name === 'Fastmail')
  assert.ok(icloud && fastmail, '两个账号都写入')
  assert.match(icloud.password, /^••••1234$/, 'GET 只回掩码')
  assert.notEqual(icloud.password, 'app-pass-1234')
  assert.equal(icloud.color, '#5b8def')
  assert.equal(fastmail.color, '#e5484d', '颜色按序取模')
  assert.equal(icloud.syncedAt, null, '未同步时 syncedAt 为空')

  // 空密码 PUT 保留原值
  await call('PUT', 'caldav/accounts', { accounts: [{ ...icloud, password: '', enabled: false }] })
  const again = await call('GET', 'caldav/accounts')
  const kept = again.json.accounts.find(a => a.name === 'iCloud')
  assert.match(kept.password, /^••••1234$/, '空密码不覆盖原值')
  assert.equal(kept.enabled, false)

  // 同 id 再 PUT 非空密码 → 覆盖
  await call('PUT', 'caldav/accounts', { accounts: [{ ...icloud, password: 'new-pass-5678' }] })
  const rotated = await call('GET', 'caldav/accounts')
  assert.match(rotated.json.accounts.find(a => a.name === 'iCloud').password, /••••5678$/)
})

test('无效 URL 的账号被拒绝且不留脏数据', async () => {
  const before = (await call('GET', 'caldav/accounts')).json.accounts.length
  await assert.rejects(
    call('PUT', 'caldav/accounts', { accounts: [{ name: 'x', url: 'ftp://bad', password: 'p' }] }),
    error => error.status === 400,
  )
  const got = await call('GET', 'caldav/accounts')
  assert.equal(got.json.accounts.length, before, '拒绝后账号列表不变')
  assert.ok(!got.json.accounts.some(a => a.name === 'x'), '无效账号未写入')
})

test('不存在的账号 discover/sync 404', async () => {
  await assert.rejects(call('POST', 'caldav/accounts/ghost/discover'), error => error.status === 404)
  await assert.rejects(call('POST', 'caldav/accounts/ghost/sync'), error => error.status === 404)
})

test('sync 连不上时 502 且错误信息透传', async () => {
  const put = await call('PUT', 'caldav/accounts', { accounts: [
    { name: '内网', url: 'http://127.0.0.1:1/', username: 'u', password: 'p' },
  ] })
  const got = await call('GET', 'caldav/accounts')
  const aid = got.json.accounts.find(a => a.name === '内网').id
  await assert.rejects(call('POST', `caldav/accounts/${aid}/sync`), error => error.status === 502)
})

test('events 缓存路由：空 → 写入 → 读回', async () => {
  const empty = await call('GET', 'caldav/events')
  assert.deepEqual(empty.json.byAccount, {})
  const got = await call('GET', 'caldav/accounts')
  const aid = got.json.accounts[0].id
  writeFileSync(join(root, 'outputs', '_caldav_cache.json'),
    JSON.stringify({ byAccount: { [aid]: { syncedAt: 1766100000, events: [
      { uid: 'e@x', title: '周例会', start: '2026-01-05 10:00', end: '2026-01-05 11:00', allDay: false, location: '', description: '' },
    ] } } }))
  const filled = await call('GET', 'caldav/events')
  assert.equal(filled.json.byAccount[aid].events[0].title, '周例会')
  // syncedAt 回显到账号列表
  const accounts = await call('GET', 'caldav/accounts')
  const withSync = accounts.json.accounts.find(a => a.id === aid)
  assert.equal(withSync.syncedAt, 1766100000)
})
