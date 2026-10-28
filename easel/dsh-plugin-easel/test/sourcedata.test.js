import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePlatform, readCookies, sourceStatus, writeCookie } from '../lib/sourcedata.js'

test('parsePlatform recognizes the pipeline-supported domains from share text', () => {
  assert.equal(parsePlatform('9.92 复制打开抖音 https://v.douyin.com/m0Brch7gmVQ/'), 'douyin')
  assert.equal(parsePlatform('http://xhslink.com/a/abc'), 'xhs')
  assert.equal(parsePlatform('https://www.xiaohongshu.com/explore/1'), 'xhs')
  assert.equal(parsePlatform('快手 https://v.kuaishou.com/GH7abcD'), 'kuaishou')
  assert.equal(parsePlatform('https://www.chenzhongtech.com/fw/photo/3xabc'), 'kuaishou')
  assert.equal(parsePlatform('https://www.bilibili.com/video/BV1x'), 'bili')
  assert.equal(parsePlatform('https://youtu.be/abc'), 'youtube')
  assert.equal(parsePlatform('https://example.com/video'), 'other')
  assert.equal(parsePlatform(undefined), 'other')
})

test('sourceStatus reports cookie presence without leaking values', async () => {
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-source-'))
  try {
    mkdirSync(join(root, 'outputs', '_deconstruct'), { recursive: true })
    mkdirSync(join(root, 'outputs', '_login'), { recursive: true })
    writeFileSync(
      join(root, 'outputs', '_deconstruct', 'cookies.json'),
      JSON.stringify({ xhs: 'a=b; web_session=secret' }),
    )
    writeFileSync(
      join(root, 'outputs', '_login', 'xhs.json'),
      JSON.stringify({ loggedIn: true }),
    )
    const status = await sourceStatus(root)
    const xhs = status.platforms.find(p => p.platform === 'xhs')
    const douyin = status.platforms.find(p => p.platform === 'douyin')
    const kuaishou = status.platforms.find(p => p.platform === 'kuaishou')
    assert.deepEqual(
      xhs,
      { platform: 'xhs', authRequired: true, cookieSet: true, loggedIn: true },
    )
    assert.deepEqual(
      douyin,
      { platform: 'douyin', authRequired: false, cookieSet: false, loggedIn: false },
    )
    assert.deepEqual(
      kuaishou,
      { platform: 'kuaishou', authRequired: false, cookieSet: false, loggedIn: false },
    )
    assert.equal(status.platforms.length, 5)
    assert.equal(JSON.stringify(status).includes('secret'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('writeCookie merges platforms, clears on empty, and skips no-op writes', async () => {
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-cookie-'))
  try {
    assert.equal(await writeCookie(root, 'xhs', 'a=1'), true)
    assert.deepEqual(await readCookies(root), { xhs: 'a=1' })
    assert.equal(await writeCookie(root, 'xhs', 'a=2'), true)
    assert.equal(await writeCookie(root, 'bili', 'b=2'), true)
    assert.deepEqual(await readCookies(root), { xhs: 'a=2', bili: 'b=2' })
    // no-op rewrite
    assert.equal(await writeCookie(root, 'bili', ' b=2 '), false)
    // clear removes just that platform
    assert.equal(await writeCookie(root, 'xhs', ''), true)
    assert.deepEqual(await readCookies(root), { bili: 'b=2' })
    // clearing an absent platform must not create the file
    const fresh = join(root, 'fresh')
    assert.equal(await writeCookie(fresh, 'xhs', ''), false)
    assert.equal(existsSync(join(fresh, 'outputs', '_deconstruct', 'cookies.json')), false)
    assert.equal(JSON.stringify(readFileSync(join(root, 'outputs', '_deconstruct', 'cookies.json'), 'utf8')).includes('a=2'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
