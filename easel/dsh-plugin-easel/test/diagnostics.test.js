import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CORE_ROUTES, dispatchLocalApi } from '../index.js'
import { createDiagnosticsRoutes } from '../lib/plugins/diagnostics.js'

const settings = { projectRoot: mkdtempSync(join(tmpdir(), 'easel-diagnostics-')), basePath: '/easel' }

/** 组一个只含 llm 服务的宿主 ctx；resolveModelInfo 即桩实现。 */
function stubCtx(resolveModelInfo) {
  return { get: name => (name === 'llm' ? { resolveModelInfo } : undefined) }
}

const call = (ctx, query) => dispatchLocalApi(
  settings, 'GET', ['diagnostics', 'context'], new URLSearchParams(query),
  async () => ({}), {}, createDiagnosticsRoutes(ctx))

test('diagnostics/context requires both provider and model', async () => {
  const resolve = async () => ({ name: '不该被调用' })
  await assert.rejects(call(stubCtx(resolve), ''), error => error.status === 400 && error.detail === '需要 provider 与 model 参数')
  await assert.rejects(call(stubCtx(resolve), 'provider=p'), error => error.status === 400)
  await assert.rejects(call(stubCtx(resolve), 'model=m'), error => error.status === 400)
})

test('diagnostics/context projects contextWindow and defaultMaxTokens from the llm service', async () => {
  const calls = []
  const ctx = stubCtx(async (provider, model) => {
    calls.push([provider, model])
    return { id: model, provider, name: '模型', context: { contextWindow: 131072 }, defaultMaxTokens: 8192 }
  })
  const result = await call(ctx, 'provider=my-gateway&model=mimo-v2.5-asr')
  assert.deepEqual(calls, [['my-gateway', 'mimo-v2.5-asr']], 'resolveModelInfo receives the raw query values')
  assert.deepEqual(result.json, {
    provider: 'my-gateway',
    model: 'mimo-v2.5-asr',
    contextWindow: 131072,
    defaultMaxTokens: 8192,
  })
})

test('diagnostics/context nulls absent optional metadata', async () => {
  const ctx = stubCtx(async () => ({ id: 'm', provider: 'p', name: '模型' }))
  const result = await call(ctx, 'provider=p&model=m')
  assert.deepEqual(result.json, { provider: 'p', model: 'm', contextWindow: null, defaultMaxTokens: null })
})

test('diagnostics/context answers 404 when the route cannot be resolved', async () => {
  const ctx = stubCtx(async () => { throw new Error('provider "p" is not registered') })
  await assert.rejects(call(ctx, 'provider=p&model=m'),
    error => error.status === 404 && error.detail === '无法解析模型 p/m')
})

test('diagnostics/context answers 409 when the host has no llm service', async () => {
  await assert.rejects(call({}, 'provider=p&model=m'), error => error.status === 409)
})

test('diagnostics routes compose with the core table and leave other routes untouched', async () => {
  const routes = [...CORE_ROUTES, ...createDiagnosticsRoutes(stubCtx(async () => ({})))]
  const status = await dispatchLocalApi(settings, 'GET', ['status'], new URLSearchParams(),
    async () => ({}), {}, routes)
  assert.equal(status.json.gateway, true, 'the core status route still answers with diagnostics mounted')
  const unmatched = await dispatchLocalApi(settings, 'GET', ['diagnostics'], new URLSearchParams(),
    async () => ({}), {}, routes)
  assert.equal(unmatched, null, 'a path no route claims stays a plain null')
})

test('cleanup removes the fixture root', () => {
  rmSync(settings.projectRoot, { recursive: true, force: true })
})
