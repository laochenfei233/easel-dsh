import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectHostUpdateBridge, createUpdateStore } from '../src/lib/hostUpdate.js'

function fakeWindow(globals = {}) {
  return { __easelHostUpdate: globals.__easelHostUpdate }
}

function fakeBridge(rpc) {
  const handlers = {}
  return {
    rpc,
    onEvent: (name, cb) => {
      ;(handlers[name] ??= []).push(cb)
      return () => {}
    },
    emit: (name, payload) => { for (const cb of handlers[name] ?? []) cb(payload) },
  }
}

test('detection is undefined without a window or without the injected bridge', () => {
  assert.equal(detectHostUpdateBridge(undefined), undefined)
  assert.equal(detectHostUpdateBridge(fakeWindow()), undefined)
  assert.equal(detectHostUpdateBridge(fakeWindow({ __easelHostUpdate: {} })), undefined)
})

test('detection returns the bridge when the staged global is complete', () => {
  const host = { rpc: () => {}, onEvent: () => () => {} }
  assert.equal(detectHostUpdateBridge(fakeWindow({ __easelHostUpdate: host })), host)
})

test('a store without the bridge degrades to unsupported and refuses actions', async () => {
  const store = createUpdateStore(undefined)
  assert.equal(store.snapshot().supported, false)
  assert.deepEqual(await store.check(), { status: 'error', detail: 'unsupported' })
  assert.deepEqual(await store.install(), { status: 'error', detail: 'unsupported' })
})

test('refresh applies the shell snapshot and keeps failure text', async () => {
  const bridge = fakeBridge(async (action) => {
    if (action === 'update-state') {
      return {
        ok: true,
        data: {
          version: '0.2.1-alpha.32',
          endpoints: ['https://example.test/latest.json'],
          source: 'override',
          lastCheckMs: 100,
          lastCheckStatus: 'available',
          latest: { version: '0.2.2', notes: 'n', pubDateMs: 50 },
          lastError: undefined,
          notedVersion: '0.2.2',
        },
      }
    }
    throw new Error(`unexpected ${action}`)
  })
  const store = createUpdateStore(bridge)
  await store.refresh()
  const snap = store.snapshot()
  assert.equal(snap.supported, true)
  assert.equal(snap.ready, true)
  assert.equal(snap.version, '0.2.1-alpha.32')
  assert.equal(snap.source, 'override')
  assert.equal(snap.latest?.version, '0.2.2')
})

test('check stores the found release and reports it; errors land in lastError', async () => {
  let response = { ok: true, data: { status: 'available', version: '0.2.2', notes: 'n', pubDateMs: 50 } }
  const bridge = fakeBridge(async () => response)
  const store = createUpdateStore(bridge)
  assert.deepEqual(await store.check(), response.data)
  assert.equal(store.snapshot().lastCheckStatus, 'available')
  assert.equal(store.snapshot().latest?.version, '0.2.2')
  response = { ok: true, data: { status: 'up-to-date' } }
  await store.check()
  assert.equal(store.snapshot().lastCheckStatus, 'up-to-date')
  assert.equal(store.snapshot().latest, undefined)
  response = { ok: true, data: { status: 'error', detail: 'timeout' } }
  await store.check()
  assert.equal(store.snapshot().lastCheckStatus, 'error')
  assert.equal(store.snapshot().lastError, 'timeout')
})

test('install flips progress on start, clears it on up-to-date, and events drive phases', async () => {
  const bridge = fakeBridge(async (action) => (action === 'update-install' ? { ok: true, data: 'started' } : { ok: true, data: {} }))
  const store = createUpdateStore(bridge)
  assert.deepEqual(await store.install(), { status: 'started' })
  assert.equal(store.snapshot().progress?.phase, 'downloading')
  bridge.emit('easel://update-progress', { phase: 'downloading', percent: 42, version: '0.2.2' })
  assert.equal(store.snapshot().progress?.percent, 42)
  bridge.emit('easel://update-progress', { phase: 'installing' })
  assert.equal(store.snapshot().progress?.phase, 'installing')
  bridge.emit('easel://update-progress', { phase: 'failed', version: '0.2.2' })
  assert.equal(store.snapshot().progress?.phase, 'failed')
  // The failed phase re-read the snapshot for the recorded error; give the
  // fire-and-forget refresh its microtask.
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(store.snapshot().ready, true)
})

test('install reports up-to-date and clears the optimistic progress', async () => {
  const bridge = fakeBridge(async () => ({ ok: true, data: 'up-to-date' }))
  const store = createUpdateStore(bridge)
  assert.deepEqual(await store.install(), { status: 'up-to-date' })
  assert.equal(store.snapshot().progress, undefined)
})

test('the availability event opens the dialog and dismiss closes it', () => {
  const bridge = fakeBridge(async () => ({ ok: true, data: {} }))
  const store = createUpdateStore(bridge)
  assert.equal(store.snapshot().announce, undefined)
  bridge.emit('easel://update-available', { version: '0.2.2', notes: 'n', pubDateMs: 50 })
  assert.equal(store.snapshot().announce?.version, '0.2.2')
  assert.equal(store.snapshot().announce?.seq, 1)
  bridge.emit('easel://update-available', { version: '0.2.3' })
  assert.equal(store.snapshot().announce?.seq, 2)
  store.dismiss()
  assert.equal(store.snapshot().announce, undefined)
})

test('subscribers observe every state change until disposed', async () => {
  let seen = 0
  const bridge = fakeBridge(async () => ({ ok: true, data: {} }))
  const store = createUpdateStore(bridge)
  const unsubscribe = store.subscribe(() => { seen += 1 })
  bridge.emit('easel://update-available', { version: '0.2.2' })
  assert.equal(seen, 1)
  unsubscribe()
  bridge.emit('easel://update-available', { version: '0.2.3' })
  assert.equal(seen, 1)
})

test('the client bundle carries the About section and its feedback link', () => {
  const bundle = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(bundle, /easel\.about/)
  assert.match(bundle, /https:\/\/github\.com\/laochenfei233\/easel-dsh\/issues/)
  assert.match(bundle, /feedbackLink/)
})
