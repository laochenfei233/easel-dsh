/** schedule repeat 字段的路由行为测试：创建校验、更新保留/清除语义。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CORE_ROUTES, dispatchLocalApi } from '../index.js'

const root = mkdtempSync(join(tmpdir(), 'easel-repeat-'))
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

test('创建时 repeat 仅接受 yearly，其余归空', async () => {
  const ok = await call('POST', 'schedule', { title: '公司周年庆', date: '2026-03-01', kind: 'event', event_type: '节日', repeat: 'yearly' })
  assert.equal(ok.json.repeat, 'yearly')
  const bad = await call('POST', 'schedule', { title: '一次性活动', date: '2026-03-02', kind: 'event', repeat: 'monthly' })
  assert.equal(bad.json.repeat, '')
})

test('更新：显式空串清除、缺字段保留原值', async () => {
  const created = await call('POST', 'schedule', { title: '每年盘点', date: '2026-12-31', kind: 'event', repeat: 'yearly' })
  const id = created.json.id
  // 旧调用方（只更新状态）不带 repeat 字段 → 保留
  const kept = await call('PUT', `schedule/${id}`, { title: '每年盘点', date: '2026-12-31', kind: 'event', status: 'draft' })
  assert.equal(kept.json.repeat, 'yearly', '不带 repeat 字段的旧调用方不丢 repeat')
  // 显式空串 → 清除
  const cleared = await call('PUT', `schedule/${id}`, { title: '每年盘点', date: '2026-12-31', kind: 'event', repeat: '' })
  assert.equal(cleared.json.repeat, '')
  // 再设回 yearly
  const reset = await call('PUT', `schedule/${id}`, { title: '每年盘点', date: '2026-12-31', kind: 'event', repeat: 'yearly' })
  assert.equal(reset.json.repeat, 'yearly')
})
