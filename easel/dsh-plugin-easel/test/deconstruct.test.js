import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDeconstruct, deconstructBusy, resumeDeconstruct } from '../lib/deconstruct.js'

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

// ---- SRT 落位（T3）：字幕落批次目录，job.srt 存项目相对路径 ----

/** 轮询 job.json 到目标 stage（流水线 fire-and-forget，状态异步落盘）。
 * `updated` 字段出现说明流水线已写过至少一次，避免读到种子 job 误停。 */
async function pollJob(file, stages) {
  const deadline = Date.now() + 10_000
  let state
  while (Date.now() < deadline) {
    try {
      state = JSON.parse(readFileSync(file, 'utf8'))
    } catch { /* 尚未写出或半截读：轮询重试 */ }
    if (state?.updated !== undefined && stages.includes(state?.stage)) return state
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return state
}

test('deconstruct lands its SRT in the batch directory and records the relative path', async () => {
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-srt-'))
  try {
    mkdirSync(join(root, 'skills', 'shared', 'scripts'), { recursive: true })
    writeFileSync(
      join(root, 'skills', 'shared', 'scripts', 'video_fetch.mjs'),
      `import { writeFileSync, mkdirSync } from 'node:fs'\n`
        + `import { join } from 'node:path'\n`
        + `const [batchRel] = process.argv.slice(2)\n`
        + `mkdirSync(batchRel, { recursive: true })\n`
        + `writeFileSync(join(batchRel, 'video.mp4'), 'x')\n`
        + `process.exit(0)\n`,
    )
    let seen
    const job = createDeconstruct({
      projectRoot: root,
      url: 'https://v.douyin.com/fake/',
      transcribe: async ({ input, outDir, outStem }) => {
        seen = { input, outDir, outStem }
        // 按 transcribeToSubtitle 的 outDir/outStem 语义模拟落位。
        const file = `${outDir}/${outStem}.srt`
        mkdirSync(join(root, outDir), { recursive: true })
        writeFileSync(join(root, file), '1\n00:00:00,000 --> 00:00:01,000\nhi\n', 'utf8')
        return { file, segments: [], seconds: 1 }
      },
    })

    const state = await pollJob(join(root, 'outputs', '_deconstruct', job.id, 'job.json'), ['ready', 'failed'])

    assert.equal(state?.stage, 'ready', `pipeline must settle ready, got ${JSON.stringify(state)}`)
    assert.equal(seen?.outDir, `outputs/_deconstruct/${job.id}`, 'transcribe must be pointed at the batch dir')
    assert.equal(seen?.outStem, job.id, 'transcribe stem must be the job id')
    assert.ok(seen?.input?.endsWith('video.mp4'), 'transcribe input is the batch video')
    assert.equal(state?.srt, `outputs/_deconstruct/${job.id}/${job.id}.srt`,
      'job.srt must point into the batch directory, not outputs/<stem>')
    assert.equal(existsSync(join(root, 'outputs', '_deconstruct', job.id, `${job.id}.srt`)), true,
      'the SRT file exists inside the batch directory')
    assert.equal(existsSync(join(root, 'outputs', 'fake')), false, 'no SRT lands under outputs/<input stem>')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---- 拆解 ASR 凭据解析（provider::model → 设置→模型 同一注册表）----

import { resolveDshAsrCredentials } from '../lib/plugins/deconstruct.js'

/** 组一个只含 llm/settings/credentials 三个桩服务的宿主 ctx。 */
function stubCtx({
  routes = [{ provider: 'my-gateway', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'my-gateway'] }],
  profile,
  resolveValue,
  resolvedRefs = [],
} = {}) {
  return {
    get(name) {
      if (name === 'llm') return { listConfigurableProviders: () => routes }
      if (name === 'settings') {
        return { describe: () => [{ ns: 'llm-pi-ai', value: { providers: { 'my-gateway': profile } } }] }
      }
      if (name === 'credentials') {
        return {
          resolve: async ref => {
            resolvedRefs.push(ref)
            return resolveValue === undefined ? undefined : { value: resolveValue, source: 'file' }
          },
        }
      }
      return undefined
    },
  }
}

const CONFIGURED_PROFILE = { apiKeyEnv: 'MY_ASR_KEY', baseURL: 'https://gw.example/v1/' }

test('resolveDshAsrCredentials walks route → settings profile → credential and trims the base URL', async () => {
  const resolvedRefs = []
  const resolved = await resolveDshAsrCredentials(
    stubCtx({ profile: CONFIGURED_PROFILE, resolveValue: 'sk-test', resolvedRefs }), 'my-gateway', 'asr-x')
  assert.deepEqual(resolved, {
    ok: true,
    credentials: { apiKey: 'sk-test', baseUrl: 'https://gw.example/v1', model: 'asr-x' },
  })
  // 解析用的 ref 必须来自 profile 的 apiKeyEnv，而不是别的来源。
  assert.deepEqual(resolvedRefs, ['MY_ASR_KEY'])
})

test('resolveDshAsrCredentials reports the missing piece, not a generic failure', async () => {
  const cases = [
    { ctx: stubCtx({ routes: [] }), provider: 'my-gateway', reason: /不在模型管理目录中/ },
    { ctx: stubCtx({ profile: undefined }), provider: 'my-gateway', reason: /尚未配置/ },
    { ctx: stubCtx({ profile: { baseURL: 'https://gw.example/v1' } }), provider: 'my-gateway', reason: /API Key 未配置/ },
    { ctx: stubCtx({ profile: { apiKeyEnv: 'MY_ASR_KEY', baseURL: ' ' }, resolveValue: 'sk-test' }), provider: 'my-gateway', reason: /Base URL/ },
    { ctx: stubCtx({ profile: CONFIGURED_PROFILE, resolveValue: undefined }), provider: 'my-gateway', reason: /API Key 未配置/ },
    { ctx: {}, provider: 'my-gateway', reason: /模型管理服务/ },
  ]
  for (const { ctx, provider, reason } of cases) {
    const resolved = await resolveDshAsrCredentials(ctx, provider, 'asr-x')
    assert.equal(resolved.ok, false, `${provider} with the case above must fail`)
    assert.match(resolved.reason, reason)
  }
})

test('resolveDshAsrCredentials ignores an apiKeyEnv outside the reference grammar', async () => {
  const resolved = await resolveDshAsrCredentials(
    stubCtx({ profile: { apiKeyEnv: 'not a ref', baseURL: 'https://gw.example/v1' } }),
    'my-gateway', 'asr-x',
  )
  assert.equal(resolved.ok, false)
  assert.match(resolved.reason, /API Key 未配置/)
})

// ---- 段级检查点续跑（T1）：各段入口按产物存在性跳过，retry 只补缺失段 ----

import { dispatchLocalApi } from '../index.js'
import { DECONSTRUCT_ROUTES } from '../lib/plugins/deconstruct.js'

/** 组一个可 resume 的批次目录：video.mp4 已在（fetch 段满足跳过条件）。 */
function seedBatch(root, id, jobExtra = {}) {
  const dir = join(root, 'outputs', '_deconstruct', id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'video.mp4'), 'x')
  writeFileSync(join(dir, 'job.json'), JSON.stringify({
    id,
    url: 'https://v.douyin.com/fake/',
    stage: 'failed',
    error: '视频下载失败（退出码 2）：见对话内技能说明',
    ...jobExtra,
  }))
  return dir
}

/** 模拟 transcribeToSubtitle 的 outDir/outStem 落位，返回其结果形状。 */
function fakeTranscribe(root) {
  return async ({ outDir, outStem }) => {
    const file = `${outDir}/${outStem}.srt`
    mkdirSync(join(root, outDir), { recursive: true })
    writeFileSync(join(root, file), '1\n00:00:00,000 --> 00:00:01,000\nhi\n', 'utf8')
    return { file, segments: [], seconds: 1 }
  }
}

test('resumeDeconstruct skips fetch when video.mp4 exists and completes the remaining stages', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-resume-fetch-'))
  try {
    const id = 'resumefetch'
    const dir = seedBatch(root, id)
    let transcribeCalls = 0
    const job = await resumeDeconstruct(root, id, async params => {
      transcribeCalls += 1
      return fakeTranscribe(root)(params)
    })
    const state = await pollJob(join(dir, 'job.json'), ['ready', 'failed'])

    // video_fetch.mjs 在这个根里不存在：job 若走到 ready，说明 fetch 被跳过
    //（真去下载会因脚本缺失直接 failed）。
    assert.equal(state?.stage, 'ready',
      `video.mp4 present must skip fetch and the rest must complete, got ${JSON.stringify(state)}`)
    assert.equal(state?.video, `outputs/_deconstruct/${id}/video.mp4`)
    assert.equal(transcribeCalls, 1, 'the ASR stage still runs for the missing srt')
    assert.equal('error' in state, false, 'the previous failure must not leak into the resumed job')
    assert.equal(job.stage, 'fetch', 'the snapshot returned at resume start is reset to fetch')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resumeDeconstruct skips frame extraction when frames already exist', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-resume-frames-'))
  try {
    const id = 'resumeframes'
    const dir = seedBatch(root, id)
    mkdirSync(join(dir, 'frames'), { recursive: true })
    writeFileSync(join(dir, 'frames', 'f-001.jpg'), 'jpg')
    await resumeDeconstruct(root, id, fakeTranscribe(root))
    const state = await pollJob(join(dir, 'job.json'), ['ready', 'failed'])

    assert.equal(state?.stage, 'ready', `got ${JSON.stringify(state)}`)
    assert.equal(state?.frames, 1, 'the frame count is recounted from disk on skip')
    assert.equal(state?.framesDir, `outputs/_deconstruct/${id}/frames`)
    assert.equal(state?.framesError, undefined,
      'existing frames mean ffmpeg never ran on the garbage video (a run would record an error)')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resumeDeconstruct skips re-extraction when the previous run recorded a framesError', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-resume-frameserr-'))
  try {
    const id = 'resumeframeserr'
    const dir = seedBatch(root, id, { framesError: '上次抽帧失败的原样记录', frames: 0 })
    await resumeDeconstruct(root, id, fakeTranscribe(root))
    const state = await pollJob(join(dir, 'job.json'), ['ready', 'failed'])

    assert.equal(state?.stage, 'ready', `got ${JSON.stringify(state)}`)
    assert.equal(state?.framesError, '上次抽帧失败的原样记录',
      'a recorded framesError must skip extraction (a real run would overwrite it with the ffmpeg stderr)')
    assert.equal(state?.frames, 0, 'frame extraction failure does not block the rest of the pipeline')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resumeDeconstruct skips ASR when job.srt already points at an existing file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-resume-srt-'))
  try {
    const id = 'resumesrt'
    const dir = seedBatch(root, id, {
      video: `outputs/_deconstruct/${id}/video.mp4`,
      frames: 2,
      framesDir: `outputs/_deconstruct/${id}/frames`,
      srt: `outputs/_deconstruct/${id}/${id}.srt`,
      seconds: 5,
    })
    mkdirSync(join(dir, 'frames'), { recursive: true })
    writeFileSync(join(dir, 'frames', 'f-001.jpg'), 'jpg')
    writeFileSync(join(dir, `${id}.srt`), '1\n00:00:00,000 --> 00:00:01,000\nhi\n')

    await resumeDeconstruct(root, id, async () => {
      throw new Error('transcribe must not run: the srt checkpoint exists')
    })
    const state = await pollJob(join(dir, 'job.json'), ['ready', 'failed'])

    assert.equal(state?.stage, 'ready',
      `every checkpoint present must settle ready without running any stage, got ${JSON.stringify(state)}`)
    assert.equal(state?.srt, `outputs/_deconstruct/${id}/${id}.srt`)
    assert.equal(state?.seconds, 5, 'the recorded seconds survive the skipped ASR stage')
    assert.ok(readdirSync(dir).every(name => !name.endsWith('.tmp')), 'atomic writeJob leaves no .tmp residue')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resumeDeconstruct rejects an unknown job id with a clear error', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-resume-missing-'))
  try {
    await assert.rejects(
      resumeDeconstruct(root, 'nope', async () => {
        throw new Error('unreachable')
      }),
      error => error.message.includes('拆解任务不存在') && error.message.includes('nope'),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('resumeDeconstruct holds the single-flight lock while resuming and releases it on settle', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-resume-lock-'))
  try {
    const id = 'resumelock'
    const dir = seedBatch(root, id)
    let release
    const gate = new Promise(resolve => { release = resolve })
    await resumeDeconstruct(root, id, async () => {
      await gate
      throw new Error('stop here')
    })
    const state = await pollJob(join(dir, 'job.json'), ['asr', 'failed'])
    assert.equal(state?.stage, 'asr', 'the resumed pipeline must reach the ASR stage')
    assert.equal(deconstructBusy(root), true, 'the lock is held while the pipeline is mid-flight')

    release()
    await pollJob(join(dir, 'job.json'), ['failed'])
    assert.equal(deconstructBusy(root), false, 'the lock is released once the pipeline settles')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ---- retry 路由（T1）：404 / 409 / 成功续跑，响应形状同 POST deconstruct ----

const callRetry = (root, id) => dispatchLocalApi(
  { projectRoot: root }, 'POST', ['deconstruct', id, 'retry'], new URLSearchParams(),
  async () => ({}), {}, DECONSTRUCT_ROUTES,
)

test('POST deconstruct/:id/retry answers 404 for an unknown job', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-retry-404-'))
  try {
    await assert.rejects(
      callRetry(root, 'nope'),
      error => error.status === 404 && error.detail.includes('nope'),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('POST deconstruct/:id/retry answers 409 while another pipeline holds the lock', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-retry-409-'))
  try {
    const id = 'retrybusy'
    const dir = seedBatch(root, id)
    let release
    const gate = new Promise(resolve => { release = resolve })
    await resumeDeconstruct(root, id, async () => {
      await gate
      throw new Error('stop')
    })
    await pollJob(join(dir, 'job.json'), ['asr'])

    await assert.rejects(
      callRetry(root, id),
      error => error.status === 409 && error.detail.includes('拆解采集在运行'),
      'a busy pipeline must answer 409, never start a second one',
    )

    release()
    await pollJob(join(dir, 'job.json'), ['failed'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('POST deconstruct/:id/retry resumes from checkpoints and answers the job snapshot', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-retry-ok-'))
  try {
    const id = 'retryok'
    const dir = seedBatch(root, id, {
      video: `outputs/_deconstruct/${id}/video.mp4`,
      frames: 2,
      framesDir: `outputs/_deconstruct/${id}/frames`,
      srt: `outputs/_deconstruct/${id}/${id}.srt`,
      seconds: 5,
    })
    mkdirSync(join(dir, 'frames'), { recursive: true })
    writeFileSync(join(dir, 'frames', 'f-001.jpg'), 'jpg')
    writeFileSync(join(dir, `${id}.srt`), '1\n00:00:00,000 --> 00:00:01,000\nhi\n')

    const response = await callRetry(root, id)
    assert.equal(response.json.id, id, 'the response is the resumed job snapshot')
    assert.equal(response.json.stage, 'fetch', 'the snapshot shows the reset stage, like POST deconstruct')
    assert.equal('error' in response.json, false, 'the previous failure is cleared')

    const state = await pollJob(join(dir, 'job.json'), ['ready', 'failed'])
    assert.equal(state?.stage, 'ready',
      `every checkpoint present must settle ready without running any stage, got ${JSON.stringify(state)}`)
    assert.equal(state?.seconds, 5, 'the recorded seconds survive the skipped ASR stage')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
