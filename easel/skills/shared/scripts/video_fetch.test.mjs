// video_fetch.test.mjs — 纯函数单测 + --selftest 冒烟（node --test）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitUrls, detectPlatform, cookiesFile } from './video_fetch.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

test('splitUrls extracts links from noisy share text and strips tail punctuation', () => {
  const share = '7.43 pQA:/ 复制打开抖音，看看【xxx的作品】真香！ https://v.douyin.com/iRNBho6/ 😄'
  assert.deepEqual(splitUrls(share), ['https://v.douyin.com/iRNBho6/'])
  assert.deepEqual(splitUrls('看这个 https://xhslink.com/a2bC，快看'), ['https://xhslink.com/a2bC'])
  assert.deepEqual(splitUrls('没有链接'), [])
})

test('detectPlatform routes douyin/xhs and everything else to generic', () => {
  assert.equal(detectPlatform('https://v.douyin.com/iRNBho6/'), 'douyin')
  assert.equal(detectPlatform('https://www.iesdouyin.com/share/video/123'), 'douyin')
  assert.equal(detectPlatform('http://xhslink.com，快看'), 'xhs')
  assert.equal(detectPlatform('https://www.bilibili.com/video/BV1GJ411x7h7/'), 'generic')
})

test('cookiesFile maps dict/string values and tolerates missing file', async () => {
  assert.deepEqual(Object.keys(await cookiesFile('nonexistent-dir-x')), [])
  const dir = mkdtempSync(join(tmpdir(), 'vf-test-'))
  try {
    writeFileSync(join(dir, 'cookies.json'), JSON.stringify({
      xhs: 'a=1; b=2',
      douyin: { k: 'v', k2: 'v2' },
      empty: '   ',
    }))
    const cookies = await cookiesFile(join(dir, 'batch'))
    assert.equal(cookies.xhs, 'a=1; b=2')
    assert.equal(cookies.douyin, 'k=v; k2=v2')
    assert.ok(!('empty' in cookies))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--selftest passes', () => {
  const proc = spawnSync(process.execPath, [join(HERE, 'video_fetch.mjs'), '--selftest'],
    { encoding: 'utf8', windowsHide: true })
  assert.equal(proc.status, 0, proc.stderr)
  assert.match(proc.stdout, /selftest ok/)
})
