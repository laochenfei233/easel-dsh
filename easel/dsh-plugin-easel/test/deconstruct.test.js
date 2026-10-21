import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createDeconstruct } from '../lib/deconstruct.js'

// Regression guard for the 2026-10-17 accident: the pipeline closure was named
// `run`, shadowing the module-level command helper, so the fetch stage awaited
// a recursive call of itself — no child process ever spawned, job.json stayed
// at stage=fetch and the server spun a core at 100%. This test proves the
// first stage really spawns video_fetch.mjs and the job settles to failed.
test('createDeconstruct spawns the fetch stage and settles failed on a non-zero exit', async () => {
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-deconstruct-'))
  try {
    mkdirSync(join(root, 'skills', 'shared', 'scripts'), { recursive: true })
    const marker = join(root, 'fetch-ran.txt')
    writeFileSync(
      join(root, 'skills', 'shared', 'scripts', 'video_fetch.mjs'),
      `import { writeFileSync } from 'node:fs'\n`
        + `writeFileSync(${JSON.stringify(marker)}, 'ran')\n`
        + `process.exit(2)\n`,
    )
    const job = createDeconstruct({
      projectRoot: root,
      url: 'https://example.invalid/video',
      transcribe: async () => {
        throw new Error('transcribe must not run: the fetch stage must fail first')
      },
    })

    const file = join(root, 'outputs', '_deconstruct', job.id, 'job.json')
    const deadline = Date.now() + 10_000
    let state
    while (Date.now() < deadline) {
      try {
        state = JSON.parse(readFileSync(file, 'utf8'))
      } catch { /* 尚未写出或半截读：轮询重试 */ }
      if (state?.stage === 'failed') break
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    assert.equal(existsSync(marker), true, 'video_fetch.mjs must actually run as a child process')
    assert.equal(state?.stage, 'failed', 'a non-zero download exit must settle the job to failed')
    assert.match(String(state?.error), /退出码 2/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---- 标题捕获（spec easel-deconstruct-title-attach D1）----

import { cleanVideoTitle } from '../lib/deconstruct.js'

test('cleanVideoTitle strips hashtag topics, control chars, caps length, empty falls back', () => {
  assert.equal(cleanVideoTitle('AI指挥AI，你负责当老板 #双Agent #AI智能体'), 'AI指挥AI，你负责当老板')
  assert.equal(cleanVideoTitle('＃全角话题也要剥 探店日记'), '探店日记')
  assert.equal(cleanVideoTitle('#只有话题'), undefined)
  assert.equal(cleanVideoTitle('标题。！ '), '标题')
  assert.equal(cleanVideoTitle('x'.repeat(70) + ' #tag'), 'x'.repeat(60))
  assert.equal(cleanVideoTitle(undefined), undefined)
})

test('fetch stage records the real video title from the downloader metadata line', async () => {
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-title-'))
  try {
    mkdirSync(join(root, 'skills', 'shared', 'scripts'), { recursive: true })
    writeFileSync(
      join(root, 'skills', 'shared', 'scripts', 'video_fetch.mjs'),
      `import { writeFileSync, mkdirSync } from 'node:fs'\n`
        + `import { join } from 'node:path'\n`
        + `const [batchRel] = process.argv.slice(2)\n`
        + `console.log('resolving share link...')\n`
        + `console.log('{truncated partial line')\n`
        + `mkdirSync(batchRel, { recursive: true })\n`
        + `writeFileSync(join(batchRel, 'video.mp4'), 'x')\n`
        + `console.log(JSON.stringify({ platform: 'douyin', title: 'AI指挥AI，你负责当老板 #双Agent #AI智能体', author: 'a', duration_sec: 121, file: '', url: '' }))\n`
        + `process.exit(0)\n`,
    )
    const job = createDeconstruct({
      projectRoot: root,
      url: 'https://v.douyin.com/fake/',
      transcribe: async () => {
        throw new Error('no asr in test')
      },
    })

    const file = join(root, 'outputs', '_deconstruct', job.id, 'job.json')
    const deadline = Date.now() + 10_000
    let state
    while (Date.now() < deadline) {
      try {
        state = JSON.parse(readFileSync(file, 'utf8'))
      } catch { /* 尚未写出：轮询重试 */ }
      if (state?.stage === 'failed') break
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 标题在 fetch 段落账：剥掉 #话题 段后的平台真实标题；前面的坏行不碍事。
    assert.equal(state?.title, 'AI指挥AI，你负责当老板',
      `job.title must be the cleaned platform title, got ${JSON.stringify(state?.title)}`)
    assert.equal(state?.stage, 'failed', 'transcribe refusal must settle the job (lock release)')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
