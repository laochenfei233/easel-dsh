import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseSilences, speechSegments,
  wrapLine, splitLongSegment, fmtSrtTs, fmtAssTs, assHeader,
  renderSrt, renderAss, renderTxt, renderJson,
  resolveMimoCredentials, AsrError,
  extractAudio16kMono, detectSpeechSegments, transcribeToSubtitle,
} from '../lib/asr.js'
import { dispatchLocalApi } from '../index.js'
import { DECONSTRUCT_ROUTES } from '../lib/plugins/deconstruct.js'

// ── 环境探测：ffmpeg / 样音 / 测试 key ────────────────────────────────
const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0
const SAMPLE_WAV = process.env.ASR_TEST_WAV
  ?? 'C:\\Users\\chenfei\\AppData\\Local\\Temp\\asr_sample.wav'
const hasSample = existsSync(SAMPLE_WAV)
const hasMimoKey = typeof process.env.MIMO_API_KEY === 'string' && process.env.MIMO_API_KEY.trim() !== ''

// ── ① silencedetect stderr 解析 ──────────────────────────────────────

const DETECT_STDERR = [
  'ffmpeg version 7.0.1 Copyright (c) 2000-2024 the FFmpeg developers',
  "Input #0, wav, from 'audio.wav':",
  '  Duration: 00:00:15.00, start: 0.000000, bitrate: 256 kb/s',
  '[silencedetect @ 000001c2e6f7bd80] silence_start: 2.5',
  '[silencedetect @ 000001c2e6f7bd80] silence_end: 3.0 | silence_duration: 0.5',
  '[silencedetect @ 000001c2e6f7bd80] silence_start: 10',
  '[silencedetect @ 000001c2e6f7bd80] silence_end: 12.75 | silence_duration: 2.75',
  'size=N/A time=00:00:15.00 bitrate=N/A speed=  999x',
  '',
].join('\n')

test('parseSilences extracts [start, end] pairs from silencedetect stderr', () => {
  assert.deepEqual(parseSilences(DETECT_STDERR), [[2.5, 3.0], [10, 12.75]])
})

test('parseSilences tolerates garbage lines and drops unterminated starts', () => {
  const noisy = [
    '[silencedetect @ x] silence_start: not_a_number',
    '[silencedetect @ x] silence_start: 1.25',
    'total_size=12345',
    '[silencedetect @ x] silence_end: bad | silence_duration: 1',
    '[silencedetect @ x] silence_start: 4',
    '[silencedetect @ x] silence_end: 5.5 | silence_duration: 1.5',
    '[silencedetect @ x] silence_start: 9.75', // 无 silence_end → 丢弃
  ].join('\n')
  assert.deepEqual(parseSilences(noisy), [[1.25, 5.5]])
  assert.deepEqual(parseSilences(''), [])
})

// ── 分段：静音反推 + 短间隙合并 + 最短段保护 + 固定窗兜底 ─────────────

test('speechSegments inverts silences and merges gaps shorter than 1s', () => {
  // 静音 [2.5,3.0]（0.5s 短间隙 → 合并）、[10,12.75]（2.75s → 保留边界）
  const segments = speechSegments(parseSilences(DETECT_STDERR), 15)
  assert.deepEqual(segments, [[0, 10], [12.75, 15]])
})

test('speechSegments falls back to 30s fixed windows when no silence detected', () => {
  assert.deepEqual(speechSegments([], 75), [[0, 30], [30, 60], [60, 75]])
  assert.deepEqual(speechSegments([], 30), [[0, 30]])
  assert.deepEqual(speechSegments([], 0), [])
})

test('speechSegments folds too-short segments into the nearer neighbor', () => {
  // [3, 3.2] 是 0.2s 微段：距后段 1.8s < 距前段 2.5s → 并入后段时间轴
  const segments = speechSegments([[0.5, 3], [3.2, 5]], 6)
  assert.deepEqual(segments, [[0, 0.5], [3, 6]])
  // 唯一且过短的段保留（时长未知 → 只剩静音间的微段；语音绝不丢）
  assert.deepEqual(speechSegments([[0.3, 0.6]], 0), [[0, 0.3]])
})

test('speechSegments splits an over-long speech run into fixed windows', () => {
  // 一整段 70s 语音（仅首尾有静音）→ 30s 固定窗
  const segments = speechSegments([[0, 0.5], [70.5, 71]], 71)
  assert.deepEqual(segments, [[0.5, 30.5], [30.5, 60.5], [60.5, 70.5]])
})

// ── ② SRT/ASS 写入器（asr.py 1:1 移植）───────────────────────────────

test('timestamp formatters match the Python writers', () => {
  assert.equal(fmtSrtTs(0), '00:00:00,000')
  assert.equal(fmtSrtTs(3661.5), '01:01:01,500')
  assert.equal(fmtSrtTs(-3), '00:00:00,000')
  assert.equal(fmtSrtTs(79.1234), '00:01:19,123')
  assert.equal(fmtAssTs(0), '0:00:00.00')
  assert.equal(fmtAssTs(3661.5), '1:01:01.50')
  assert.equal(fmtAssTs(-3), '0:00:00.00')
})

test('wrapLine breaks long Chinese text at punctuation or 1.5x hard limit', () => {
  // 短文本原样
  assert.equal(wrapLine('短句', 18), '短句')
  // 有标点：达到 18 字后，在下一个标点处断行（asr.py 语义：先攒满再找断点）
  const punctuated = '一二三四五六七八九十abcdefghij，尾'
  const wrapped = wrapLine(punctuated, 18)
  const lines = wrapped.split('\\N')
  assert.deepEqual(lines.map(line => [...line].length), [21, 1])
  assert.ok(lines[0].endsWith('，'), 'break lands right after the comma')
  assert.equal(lines.join(''), punctuated, 'no characters lost or reordered')
  // 无标点：1.5x（27 字）硬断
  const solid = '甲'.repeat(40)
  assert.deepEqual(wrapLine(solid, 18).split('\\N').map(line => line.length), [27, 13])
})

test('splitLongSegment splits by sentence punctuation with char-proportional times', () => {
  // 短文本不拆
  assert.deepEqual(splitLongSegment('短句', 0, 4, 18), [[0, 4, '短句']])
  // 长文本（40 字 > 18x2）按句末标点拆成 3 条，时间按字符比例（15/21/4 字）
  const text = '一二三四五六七八九十甲乙丙丁。' + '乙'.repeat(20) + '。' + '丙丁戊。'
  const cues = splitLongSegment(text, 10, 20, 18)
  assert.equal(cues.length, 3)
  assert.equal(cues[0][0], 10)
  assert.ok(Math.abs(cues[0][1] - (10 + 10 * 15 / 40)) < 1e-9, 'first cue spans chars/total of the span')
  assert.ok(Math.abs(cues[1][0] - cues[0][1]) < 1e-9, 'cues are contiguous')
  assert.ok(Math.abs(cues[1][1] - (10 + 10 * 36 / 40)) < 1e-9)
  assert.equal(cues[2][1], 20, 'last cue is corrected to end')
  assert.equal(cues[2][2], '丙丁戊。')
})

test('assHeader scales font by the short side and margins by width/height', () => {
  const portrait = assHeader(1080, 1920)
  assert.ok(portrait.includes('PlayResX: 1080\nPlayResY: 1920\n'))
  assert.ok(portrait.includes('Style: Default,Noto Sans CJK SC,54,'), 'short side 1080 x 0.05 = 54')
  assert.ok(portrait.includes(',1,4,2,2,49,49,115,1'), 'outline 4 / shadow 2 / margins 49,49,115')
  // 横屏同字号（短边仍是 1080），边距换轴
  const landscape = assHeader(1920, 1080)
  assert.ok(landscape.includes('Style: Default,Noto Sans CJK SC,54,'))
  assert.ok(landscape.includes(',1,4,2,2,86,86,65,1'), 'marginL/R by width 1920, marginV by height 1080')
  // 小分辨率字号下限 16
  assert.ok(assHeader(320, 240).includes('Noto Sans CJK SC,16,'))
})

test('renderSrt numbers blocks, timestamps and unwraps \\N to real newlines', () => {
  const srt = renderSrt([[0, 2.5, '第一句'], [3, 6, '第二句']], 18)
  assert.equal(
    srt,
    '1\n00:00:00,000 --> 00:00:02,500\n第一句\n\n2\n00:00:03,000 --> 00:00:06,000\n第二句\n',
  )
  // 超长 body 的 \N 在 SRT 里展开为真实换行
  const longSrt = renderSrt([[0, 9, 'x'.repeat(40)]], 18)
  assert.ok(longSrt.includes(`${'x'.repeat(27)}\n${'x'.repeat(13)}`))
  assert.ok(!longSrt.includes('\\N'))
})

test('renderAss keeps \\N breaks and renderTxt/renderJson follow asr.py shapes', () => {
  const cues = [[0, 2.5, '第一句'], [3, 6, '第二句']]
  const ass = renderAss(cues, 18)
  assert.ok(ass.startsWith(assHeader(1080, 1920)), 'default resolution is portrait 1080x1920')
  assert.ok(ass.includes('Dialogue: 0,0:00:00.00,0:00:02.50,Default,,0,0,0,,第一句\n'))
  assert.ok(ass.endsWith('\n'))
  assert.equal(renderTxt(cues), '第一句\n第二句\n')
  const json = JSON.parse(renderJson(cues, { source: 'x.wav', num_segments: 2 }))
  assert.equal(json.source, 'x.wav')
  assert.deepEqual(json.segments, [
    { index: 1, start: 0, end: 2.5, text: '第一句' },
    { index: 2, start: 3, end: 6, text: '第二句' },
  ])
})

// ── 凭据解析 ─────────────────────────────────────────────────────────

test('resolveMimoCredentials defaults are protocol constants, never a key', () => {
  assert.deepEqual(resolveMimoCredentials({}), {
    apiKey: '',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.5-asr',
  })
  assert.deepEqual(resolveMimoCredentials({
    MIMO_API_KEY: 'sk-test', MIMO_BASE_URL: 'https://gw.example/v1/', MIMO_ASR_MODEL: 'mimo-v2.5-asr-turbo',
  }), { apiKey: 'sk-test', baseUrl: 'https://gw.example/v1', model: 'mimo-v2.5-asr-turbo' })
  // 占位值视为未配置
  assert.equal(resolveMimoCredentials({ MIMO_API_KEY: 'your-api-key' }).apiKey, '')
  assert.equal(resolveMimoCredentials({ MIMO_API_KEY: '  ' }).apiKey, '')
})

// ── ③ 路由接线（无网络：入参校验与凭据门）────────────────────────────

const routeRoot = mkdtempSync(join(tmpdir(), 'easel-asr-route-'))
mkdirSync(join(routeRoot, 'media'), { recursive: true })
writeFileSync(join(routeRoot, 'media', 'talk.wav'), 'RIFF....', 'utf8')
const routeSettings = { projectRoot: routeRoot, skillsDir: join(routeRoot, 'skills', 'openclaw'), basePath: '/easel' }
const callAsr = body => dispatchLocalApi(routeSettings, 'POST', ['asr'], new URLSearchParams(),
  async () => body, {}, DECONSTRUCT_ROUTES)

test('asr route validates path, format and input file before doing any work', async () => {
  await assert.rejects(callAsr({}), error => error.status === 400 && error.detail.includes('path'), 'missing path')
  await assert.rejects(callAsr({ path: '../escape.wav' }), error => error.status === 400 && error.detail.includes('..'), 'traversal path')
  await assert.rejects(callAsr({ path: 'media\\..\\escape.wav' }), error => error.status === 400, 'windows traversal path')
  await assert.rejects(callAsr({ path: 'media/talk.wav', format: 'vtt' }),
    error => error.status === 400 && error.detail.includes('srt/ass/txt/json'), 'bad format')
  await assert.rejects(callAsr({ path: 'media/missing.wav' }), error => error.status === 404, 'missing input file')
})

test('asr route gates on credentials before the pipeline runs', async () => {
  const result = await callAsr({ path: 'media/talk.wav' }).then(() => null, error => error)
  assert.ok(result !== null, 'garbage wav cannot produce a success response')
  if (!hasMimoKey) {
    assert.equal(result.status, 400)
    assert.match(result.detail, /MIMO_API_KEY/, 'setup hint names the env var')
  } else {
    // 测试进程带了真 key：凭据门放行，垃圾 wav 在 ffmpeg 静音检测处失败 → 500
    assert.equal(result.status, 500)
  }
})

// ── ffmpeg 真跑（本机有 ffmpeg 且有样音才执行）───────────────────────

test('extractAudio16kMono + detectSpeechSegments run the real ffmpeg chain', { skip: !hasFfmpeg || !hasSample ? 'needs ffmpeg and the sample wav' : false }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-asr-ffmpeg-'))
  try {
    // 视频路径：wav → mp4（aac）→ 抽回 16k 单声道 wav
    const mp4 = join(root, 'talk.mp4')
    const pack = spawnSync('ffmpeg', ['-y', '-i', SAMPLE_WAV, '-c:a', 'aac', mp4], { windowsHide: true })
    assert.equal(pack.status, 0, 'sample wav packs into mp4')
    const wav = await extractAudio16kMono('ffmpeg', mp4, join(root, 'audio.wav'))
    assert.ok(existsSync(wav))
    const { segments, duration } = await detectSpeechSegments('ffmpeg', 'ffprobe', wav)
    assert.ok(duration > 10, `duration parsed from wav header (${duration}s)`)
    assert.ok(segments.length >= 1, 'speech segments detected')
    assert.ok(segments[0][0] <= 1, 'speech starts near the beginning')
    for (const [s, e] of segments) {
      assert.ok(e > s, 'segment is non-empty')
      assert.ok(e - s <= 30, 'segment respects the 30s cap')
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('transcribeToSubtitle answers 500 with install hint when ffmpeg is missing', { skip: !hasSample ? 'needs the sample wav' : false }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-asr-noffmpeg-'))
  try {
    await assert.rejects(
      transcribeToSubtitle({
        input: SAMPLE_WAV, format: 'srt', projectRoot: root,
        credentials: { apiKey: 'sk-test' }, ffmpegBin: 'definitely-not-ffmpeg-xyz',
      }),
      error => error instanceof AsrError && error.status === 500 && error.message.includes('安装 ffmpeg'),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('transcribeToSubtitle rejects bad format, missing files, unsupported types and missing keys', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-asr-props-'))
  try {
    const note = join(root, 'note.txt')
    writeFileSync(note, 'text', 'utf8')
    // format 白名单（模块层同样拦截，路由层先行）
    await assert.rejects(
      transcribeToSubtitle({ input: note, format: 'mp3', projectRoot: root, credentials: { apiKey: 'k' } }),
      error => error instanceof AsrError && error.status === 400 && error.message.includes('srt/ass/txt/json'),
    )
    // 凭据缺失 → 400（先于文件存在性检查）
    await assert.rejects(
      transcribeToSubtitle({ input: join(root, 'whatever.wav'), projectRoot: root, credentials: { apiKey: '' } }),
      error => error instanceof AsrError && error.status === 400 && error.message.includes('MIMO_API_KEY'),
    )
    // 文件不存在 → 404
    await assert.rejects(
      transcribeToSubtitle({ input: join(root, 'nope.wav'), projectRoot: root, credentials: { apiKey: 'k' } }),
      error => error instanceof AsrError && error.status === 404,
    )
    // 不支持的扩展名 → 400
    await assert.rejects(
      transcribeToSubtitle({ input: note, projectRoot: root, credentials: { apiKey: 'k' } }),
      error => error instanceof AsrError && error.status === 400 && error.message.includes('不支持的文件类型'),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ── ④ 真实 mimo 调用（只在 env 带 MIMO_API_KEY 且有样音时执行）───────

test('real mimo ASR on the sample wav produces a timed SRT', {
  skip: !hasMimoKey || !hasSample || !hasFfmpeg ? 'requires MIMO_API_KEY env and the sample wav' : false,
}, async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-asr-live-'))
  try {
    const result = await transcribeToSubtitle({
      input: SAMPLE_WAV,
      format: 'srt',
      projectRoot: root,
      credentials: resolveMimoCredentials(process.env),
    })
    assert.ok(result.segments.length > 0, 'transcript is non-empty')
    assert.ok(result.seconds > 0, 'billed seconds reported')
    assert.equal(result.file, 'outputs/asr_sample/asr_sample.srt')
    const srt = readFileSync(join(root, 'outputs', 'asr_sample', 'asr_sample.srt'), 'utf8')
    assert.ok(srt.includes('-->'), 'SRT has timestamps')
    assert.ok(srt.trim().split('\n').length > 2, 'SRT has cue bodies')
    // 时间戳单调且首段从 0 附近开始
    for (let i = 1; i < result.segments.length; i++) {
      assert.ok(result.segments[i].start >= result.segments[i - 1].start)
    }
    assert.ok(result.segments[0].start <= 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ── 技能侧发现：outputs/_easel_api.json ──────────────────────────────
test('writeApiDiscovery writes base/basePath, the runner token, and ignores invalid ports', async () => {
  const { writeApiDiscovery } = await import('../lib/asr.js')
  const root = mkdtempSync(join(tmpdir(), 'easel-discovery-'))
  try {
    assert.equal(await writeApiDiscovery(root, 3081, '/easel', 'a'.repeat(64)), true)
    const written = JSON.parse(readFileSync(join(root, 'outputs', '_easel_api.json'), 'utf8'))
    assert.equal(written.base, 'http://127.0.0.1:3081')
    assert.equal(written.basePath, '/easel')
    assert.equal(written.runnerToken, 'a'.repeat(64))
    assert.ok(written.updatedAt)
    assert.equal(await writeApiDiscovery(root, 0, '/easel'), false)
    assert.equal(await writeApiDiscovery(root, undefined, '/easel'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
