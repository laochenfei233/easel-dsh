import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { download, fetchFollowing, limitedStream, readBodyText } from '../../skills/shared/scripts/video_fetch.mjs'

// 响应体体量封顶的安全不变量：远端不可信，下载与页面文本必须可被掐断，
// 且半成品不留盘。fetch 全部打桩，测试不碰网络；下载目标的 IP 字面量取
// 公网单播段（assertPublicDestination 对 IP 直判、不查 DNS）。

const PUBLIC_URL = 'http://93.184.216.34/v.mp4'

test('readBodyText rejects an oversized body with a fixed message', async () => {
  const response = new Response(Readable.toWeb(Readable.from([
    Buffer.alloc(10, 'a'),
    Buffer.alloc(10, 'b'),
  ])))
  await assert.rejects(readBodyText(response, 16), /响应体超过 16 字节上限/)
})

test('readBodyText returns the text under the limit and tolerates a null body', async () => {
  assert.equal(await readBodyText(new Response('页面正文'), 16), '页面正文')
  assert.equal(await readBodyText(new Response(null, { status: 204 })), '')
})

test('limitedStream passes bytes under the limit and trips at the overflow', async () => {
  const under = limitedStream(16)
  under.on('error', () => {}) // 错误经 write 回调断言，事件面只需不再 unhandled
  const first = await new Promise(resolve => {
    under.write(Buffer.alloc(10, 'x'), error => resolve(error === null || error === undefined))
  })
  assert.equal(first, true)
  const failure = await new Promise(resolve => {
    under.write(Buffer.alloc(10, 'y'), error => resolve(error))
  })
  assert.match(String(failure), /响应体超过 16 字节上限/)
})

test('fetchFollowing rejects an oversized page body through the default cap', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const half = 8 * 1024 * 1024 + 1
  globalThis.fetch = async () => new Response(Readable.toWeb(Readable.from([
    Buffer.alloc(half, 'a'),
    Buffer.alloc(half, 'b'),
  ])))
  await assert.rejects(fetchFollowing(PUBLIC_URL), /响应体超过 16777216 字节上限/)
})

test('fetchFollowing returns the page text when the body is within the cap', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response('页面正文')
  const [href, text] = await fetchFollowing(PUBLIC_URL)
  assert.equal(href, PUBLIC_URL)
  assert.equal(text, '页面正文')
})

test('download refuses a declared content-length over the cap before writing', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-vf-caps-'))
  const dest = join(root, 'video.mp4')
  try {
    globalThis.fetch = async () => new Response(Readable.toWeb(Readable.from([Buffer.alloc(10)])), {
      headers: { 'content-length': '999999' },
    })
    await assert.rejects(download(PUBLIC_URL, {}, dest, { maxBytes: 100 }), /响应体超过 100 字节上限/)
    assert.equal(existsSync(dest), false, 'rejected download must leave no partial file')
  } finally {
    await rmSync(root, { recursive: true, force: true })
  }
})

test('download aborts mid-stream over the cap and removes the partial file', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-vf-caps-'))
  const dest = join(root, 'video.mp4')
  try {
    globalThis.fetch = async () => new Response(Readable.toWeb(Readable.from([
      Buffer.alloc(60, 'a'),
      Buffer.alloc(60, 'b'),
    ])))
    await assert.rejects(download(PUBLIC_URL, {}, dest, { maxBytes: 100 }), /响应体超过 100 字节上限/)
    assert.equal(existsSync(dest), false, 'aborted download must leave no partial file')
  } finally {
    await rmSync(root, { recursive: true, force: true })
  }
})

test('download writes the file when the body is within the cap', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-vf-caps-'))
  const dest = join(root, 'video.mp4')
  try {
    globalThis.fetch = async () => new Response(Readable.toWeb(Readable.from([Buffer.from('hello-video')])))
    await download(PUBLIC_URL, {}, dest, { maxBytes: 100 })
    assert.equal(readFileSync(dest, 'utf8'), 'hello-video')
  } finally {
    await rmSync(root, { recursive: true, force: true })
  }
})
