/**
 * ASR core for `POST /easel/api/asr` — audio/video file path in, subtitle file
 * out. Zero npm dependencies, Node >= 22 (global fetch, fs/promises).
 *
 * Pipeline (per T4 spec; the whisper stage of skills/shared/scripts/asr.py is
 * replaced by the hosted mimo-v2.5-asr model, everything else is a 1:1 port):
 *
 *   video → ffmpeg extract 16k mono wav (temp under outputs/_asr/, `_`-prefixed
 *   dirs stay out of the content library) → silencedetect (noise=-35dB:d=0.5)
 *   speech ranges → merge short gaps / protect minimum speech / 30s fixed
 *   windows when silence cannot cut a long monologue → per-segment base64 wav
 *   to mimo chat/completions (serial, single input_audio part — the gateway
 *   rejects any extra text part with 400) → segment bounds are the timestamps
 *   → SRT/ASS/TXT/JSON writer ported 1:1 from asr.py (_wrap_line 18-char
 *   Chinese wrapping, _split_long_segment char-proportional timing, ASS header
 *   font size = short side x 0.05) → outputs/<stem>/<stem>.<format> (default;
 *   `outDir`/`outStem` re-route the file, e.g. a deconstruct batch directory).
 *
 * Credentials never live here as defaults: the caller resolves
 * MIMO_BASE_URL / MIMO_API_KEY / MIMO_ASR_MODEL (env, or the project `.env`
 * registry) and passes them in via `credentials`.
 */
import { open, readFile, rename, rm, mkdir, writeFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { spawn } from 'node:child_process'

/** An ASR failure carrying the HTTP status the route should answer with. */
export class AsrError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ── 输入面 ───────────────────────────────────────────────────────────

/** 视频容器（先抽音轨）；与 asr.py `_VIDEO_EXT` 的常用子集 + spec 点名的 mkv/flv。 */
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv', '.flv'])
/** 音频容器；非 wav 一律先转 16k 单声道 wav（mimo 协议实测只认 wav part）。 */
const AUDIO_EXTS = new Set(['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac'])

// ── 分段参数（spec：noise≈-35dB/d=0.5；兜底固定窗 ≈30s）──────────────
const SILENCE_NOISE_DB = '-35dB'
const SILENCE_MIN_D = '0.5'
const MERGE_GAP_SEC = 1.0
const MIN_SPEECH_SEC = 0.4
const MAX_SEGMENT_SEC = 30
const EPS = 0.05

// ── mimo ASR 协议（实测确认；content 只能有这一个 part）──────────────
export const MIMO_DEFAULT_BASE_URL = 'https://api.xiaomimimo.com/v1'
export const MIMO_DEFAULT_MODEL = 'mimo-v2.5-asr'

const ENV_PLACEHOLDER = /replace_me|your[-_]?api[-_]?key|xxx|^\.{3}$|^<.*>$/i

/**
 * Resolve mimo ASR credentials from a flat env-style object.
 * Test key values are never a default here — a missing key yields `apiKey: ''`
 * and the route answers 400 with the setup hint.
 * @param env - merged env mapping (process.env over the project `.env`).
 */
export function resolveMimoCredentials(env = {}) {
  const pick = name => {
    const value = String(env[name] ?? '').trim()
    return value !== '' && !ENV_PLACEHOLDER.test(value) ? value : ''
  }
  return {
    apiKey: pick('MIMO_API_KEY'),
    baseUrl: (pick('MIMO_BASE_URL') || MIMO_DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: pick('MIMO_ASR_MODEL') || MIMO_DEFAULT_MODEL,
  }
}

// ── silencedetect stderr → 静音段（思路同 video_ops._parse_silences）──

/**
 * Parse `silence_start:` / `silence_end:` lines out of silencedetect stderr.
 * Malformed lines are skipped; an unterminated trailing start is dropped.
 * @param stderr - the captured stderr of `ffmpeg -af silencedetect -f null -`.
 * @returns silence ranges as `[start, end]` pairs, in order.
 */
export function parseSilences(stderr) {
  const starts = []
  const silences = []
  const numeric = token => /^[+-]?\d+(?:\.\d+)?$/.test(token) ? Number(token) : NaN
  for (const line of String(stderr).split(/\r?\n/)) {
    if (line.includes('silence_start:')) {
      const token = line.split('silence_start:')[1]?.trim().split(/\s+/)[0] ?? ''
      const value = numeric(token)
      if (Number.isFinite(value)) starts.push(value)
    } else if (line.includes('silence_end:')) {
      const token = line.split('silence_end:')[1]?.split('|')[0].trim().split(/\s+/)[0] ?? ''
      const value = numeric(token)
      if (Number.isFinite(value) && starts.length > 0) silences.push([starts.shift(), value])
    }
  }
  return silences
}

/**
 * Silence ranges → speech ranges to send to ASR.
 * Complement within [0, duration] → merge gaps shorter than `mergeGapSec` →
 * fold segments shorter than `minSpeechSec` into the nearer neighbor (a sole
 * tiny segment is kept — speech is never dropped) → split anything longer than
 * `maxSegmentSec` into fixed windows (the no-silence long-monologue fallback;
 * with no silences at all the whole track is windowed from 0).
 * @returns speech ranges as `[start, end]` pairs.
 */
export function speechSegments(silences, duration, {
  mergeGapSec = MERGE_GAP_SEC,
  minSpeechSec = MIN_SPEECH_SEC,
  maxSegmentSec = MAX_SEGMENT_SEC,
} = {}) {
  let ranges
  if (!Array.isArray(silences) || silences.length === 0) {
    ranges = duration > EPS ? [[0, duration]] : []
  } else {
    ranges = []
    let cursor = 0
    for (const [s, e] of silences) {
      if (s - cursor > EPS) ranges.push([cursor, s])
      cursor = Math.max(cursor, e)
    }
    if (duration - cursor > EPS) ranges.push([cursor, duration])
  }
  // 短间隙合并：间隙（即静音长）小于阈值 → 同一段。
  const merged = []
  for (const [s, e] of ranges) {
    const prev = merged[merged.length - 1]
    if (prev !== undefined && s - prev[1] < mergeGapSec) prev[1] = Math.max(prev[1], e)
    else merged.push([s, e])
  }
  // 最短语音段保护：过短的段并入更近的邻居（时间戳跨过边界静音），绝不丢语音。
  const kept = []
  for (let i = 0; i < merged.length; i++) {
    const [s, e] = merged[i]
    if (e - s >= minSpeechSec) {
      kept.push([s, e])
      continue
    }
    const prev = kept[kept.length - 1]
    const next = merged[i + 1]
    if (prev === undefined && next === undefined) kept.push([s, e])
    else if (prev === undefined) next[0] = s
    else if (next === undefined) prev[1] = e
    else if (s - prev[1] <= next[0] - e) prev[1] = e
    else next[0] = s
  }
  // 长独白兜底：超过上限的段按固定窗切。
  const out = []
  for (const [s, e] of kept) {
    if (e - s <= maxSegmentSec) {
      out.push([s, e])
      continue
    }
    let t = s
    while (t < e - EPS) {
      out.push([t, Math.min(t + maxSegmentSec, e)])
      t += maxSegmentSec
    }
  }
  return out
}

// ── ffmpeg / ffprobe 封装 ────────────────────────────────────────────

/** Run one ffmpeg-family command to completion, capturing stdout/stderr. */
function spawnCapture(cmd, { timeout = 300_000 } = {}) {
  return new Promise(resolve => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let spawnError = null
    let done = false
    const child = spawn(cmd[0], cmd.slice(1), { windowsHide: true })
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeout)
    const finish = result => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(result)
    }
    child.on('error', error => {
      spawnError = error
      finish({ code: -1, stdout, stderr, timedOut, spawnError })
    })
    child.stdout.on('data', chunk => { if (stdout.length < 2_000_000) stdout += chunk.toString('utf8') })
    child.stderr.on('data', chunk => { if (stderr.length < 2_000_000) stderr += chunk.toString('utf8') })
    child.on('close', code => {
      finish({ code: spawnError !== null ? -1 : (code ?? -1), stdout, stderr, timedOut, spawnError })
    })
  })
}

/** The spawn failed because the binary itself is gone → actionable 500. */
function requireFfmpeg(proc) {
  if (proc.spawnError?.code === 'ENOENT') {
    throw new AsrError(500, '未找到 ffmpeg，无法处理音频/视频。请安装 ffmpeg（如 winget install ffmpeg 或 choco install ffmpeg）并确保在 PATH 上后重试')
  }
}

function stderrTail(proc, lines = 10) {
  return (proc.stderr || proc.stdout || '').trim().split(/\r?\n/).slice(-lines).join('\n')
}

/**
 * Extract 16k mono wav from any audio/video input (asr.py `_extract_audio`).
 * @returns the extracted wav path.
 */
export async function extractAudio16kMono(ffmpegBin, src, outWav) {
  const proc = await spawnCapture([ffmpegBin, '-y', '-i', src, '-vn', '-ac', '1', '-ar', '16000', outWav])
  requireFfmpeg(proc)
  if (proc.code !== 0 || !existsSync(outWav)) {
    throw new AsrError(500, `ffmpeg 提取音轨失败:\n${stderrTail(proc)}`)
  }
  return outWav
}

/**
 * Duration of a PCM wav from its RIFF header (data chunk size / byte rate).
 * Returns null for anything unreadable — caller falls back to ffprobe.
 */
export async function wavDurationSeconds(path) {
  let handle
  try {
    handle = await open(path, 'r')
  } catch {
    return null
  }
  try {
    const riff = Buffer.alloc(12)
    if ((await handle.read(riff, 0, 12, 0)).bytesRead < 12) return null
    if (riff.toString('latin1', 0, 4) !== 'RIFF' || riff.toString('latin1', 8, 12) !== 'WAVE') return null
    let offset = 12
    let byteRate = 0
    const head = Buffer.alloc(8)
    for (let guard = 0; guard < 64; guard++) {
      if ((await handle.read(head, 0, 8, offset)).bytesRead < 8) return null
      const id = head.toString('latin1', 0, 4)
      const size = head.readUInt32LE(4)
      if (id === 'fmt ') {
        const fmt = Buffer.alloc(Math.min(size, 16))
        await handle.read(fmt, 0, fmt.length, offset + 8)
        byteRate = fmt.readUInt32LE(8)
      } else if (id === 'data') {
        return byteRate > 0 ? size / byteRate : null
      }
      offset += 8 + size + (size % 2)
    }
    return null
  } catch {
    return null
  } finally {
    await handle.close()
  }
}

/** ffprobe duration fallback (`format=duration`), null when unavailable. */
async function ffprobeDuration(ffprobeBin, path) {
  const proc = await spawnCapture([ffprobeBin, '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', path])
  const value = Number(proc.stdout.trim())
  return Number.isFinite(value) && proc.code === 0 ? value : null
}

/** ffprobe video dimensions (asr.py `_probe_video_wh`), null when unavailable. */
async function probeVideoWH(ffprobeBin, path) {
  const proc = await spawnCapture([ffprobeBin, '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', path])
  if (proc.code !== 0) return null
  const match = /^\s*(\d+)x(\d+)\s*$/.exec(proc.stdout.trim().split(/\r?\n/)[0] ?? '')
  return match !== null ? [Number(match[1]), Number(match[2])] : null
}

/**
 * silencedetect → speech segments for one (16k mono) wav.
 * @returns `{ segments, silences, duration }` — segment bounds are the ASR
 * chunk and subtitle timestamp source of truth.
 */
export async function detectSpeechSegments(ffmpegBin, ffprobeBin, wavPath) {
  const duration = (await wavDurationSeconds(wavPath)) ?? (await ffprobeDuration(ffprobeBin, wavPath)) ?? 0
  const proc = await spawnCapture([ffmpegBin, '-i', wavPath,
    '-af', `silencedetect=noise=${SILENCE_NOISE_DB}:d=${SILENCE_MIN_D}`, '-f', 'null', '-'])
  requireFfmpeg(proc)
  if (proc.timedOut) throw new AsrError(500, 'ffmpeg 静音检测超时')
  if (proc.code !== 0) throw new AsrError(500, `ffmpeg 静音检测失败:\n${stderrTail(proc)}`)
  const silences = parseSilences(proc.stderr)
  return { segments: speechSegments(silences, duration), silences, duration }
}

// ── mimo ASR 调用（串行；协议实测确认）────────────────────────────────

async function transcribeSegment(credentials, wavPath, { timeoutMs = 120_000, fetchImpl = fetch } = {}) {
  // 网关强制 content 只含 input_audio 这一个 part，加 text part 报 400。
  const payload = {
    model: credentials.model,
    messages: [{
      role: 'user',
      content: [{ type: 'input_audio', input_audio: { data: (await readFile(wavPath)).toString('base64'), format: 'wav' } }],
    }],
  }
  let answer
  try {
    answer = await fetchImpl(`${credentials.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${credentials.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new AsrError(502, `mimo ASR 请求失败：${error?.cause?.message ?? error?.message ?? error}`)
  }
  const text = await answer.text()
  if (!answer.ok) {
    let detail = text.slice(0, 300)
    try {
      const parsed = JSON.parse(text)
      detail = parsed?.error?.message ?? parsed?.message ?? detail
    } catch { /* 非 JSON → 用原文 */ }
    throw new AsrError(502, `mimo ASR 调用失败（HTTP ${answer.status}）：${detail}`)
  }
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new AsrError(502, `mimo ASR 返回非 JSON：${text.slice(0, 300)}`)
  }
  const content = body?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new AsrError(502, `mimo ASR 响应缺少 choices[0].message.content：${text.slice(0, 300)}`)
  }
  const billed = Number(body?.usage?.seconds)
  return { text: content, billedSeconds: Number.isFinite(billed) ? billed : null }
}

// ── 字幕写入器（1:1 移植 asr.py）──────────────────────────────────────

// 中文断句标点（这些之后可以切）与句末硬切标点，与 asr.py 一致。
const ZH_PUNCT = '，。！？；、：,.!?;:）】》」'
const ZH_END_PUNCT = '。！？!?…'

/** 秒 → SRT 时间戳 HH:MM:SS,mmm（asr.py `_fmt_srt_ts`）。 */
export function fmtSrtTs(sec) {
  if (sec < 0) sec = 0.0
  let ms = Math.round(sec * 1000)
  const h = Math.floor(ms / 3600_000)
  ms -= h * 3600_000
  const m = Math.floor(ms / 60_000)
  ms -= m * 60_000
  const s = Math.floor(ms / 1000)
  ms -= s * 1000
  const pad = (n, w) => String(n).padStart(w, '0')
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`
}

/** 秒 → ASS 时间戳 H:MM:SS.cc（百分秒，asr.py `_fmt_ass_ts`）。 */
export function fmtAssTs(sec) {
  if (sec < 0) sec = 0.0
  let cs = Math.round(sec * 100)
  const h = Math.floor(cs / 360_000)
  cs -= h * 360_000
  const m = Math.floor(cs / 6_000)
  cs -= m * 6_000
  const s = Math.floor(cs / 100)
  cs -= s * 100
  const pad = (n, w) => String(n).padStart(w, '0')
  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`
}

/**
 * 把一行长文本按 maxChars 断成多行（\N 连接，供字幕换行）。
 * 优先在标点后断；无标点则按长度硬断（1.5x 强制）。中文按字符数（码点），
 * 英文单词尽量不拆。asr.py `_wrap_line` 1:1。
 */
export function wrapLine(text, maxChars) {
  const trimmed = text.trim()
  const chars = [...trimmed]
  if (maxChars <= 0 || chars.length <= maxChars) return trimmed
  const lines = []
  let cur = ''
  let curLen = 0
  for (const ch of chars) {
    cur += ch
    curLen += 1
    // 达到长度且落在标点后 → 断行；或严重超长（1.5x）强制断
    if (curLen >= maxChars && (ZH_PUNCT.includes(ch) || ch === ' ')) {
      lines.push(cur.trim())
      cur = ''
      curLen = 0
    } else if (curLen >= Math.trunc(maxChars * 1.5)) {
      lines.push(cur.trim())
      cur = ''
      curLen = 0
    }
  }
  if (cur.trim()) lines.push(cur.trim())
  return lines.filter(Boolean).join('\\N')
}

/**
 * 一个 ASR segment 若过长（远超 maxChars），按句末标点切成多条字幕，
 * 时间按字符数比例分配。asr.py `_split_long_segment` 1:1。
 * @returns `[start, end, text]` triples.
 */
export function splitLongSegment(text, start, end, maxChars) {
  const trimmed = text.trim()
  if (!trimmed) return []
  const chars = [...trimmed]
  // 未超过 2 行的量级：不拆条，只在渲染时软换行
  if (chars.length <= maxChars * 2) return [[start, end, trimmed]]
  // 按句末标点切分成子句
  const chunks = []
  let buf = ''
  for (const ch of chars) {
    buf += ch
    if (ZH_END_PUNCT.includes(ch) && [...buf.trim()].length >= Math.max(4, Math.trunc(maxChars / 2))) {
      chunks.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  if (chunks.length <= 1) return [[start, end, trimmed]]
  const total = chunks.reduce((n, c) => n + [...c].length, 0) || 1
  const out = []
  let cursor = start
  const span = Math.max(end - start, 0.0)
  for (const c of chunks) {
    const seg = span * ([...c].length / total)
    const e = Math.min(end, cursor + seg)
    out.push([cursor, e, c])
    cursor = e
  }
  // 修正最后一条到 end
  if (out.length > 0) out[out.length - 1] = [out[out.length - 1][0], end, out[out.length - 1][2]]
  return out
}

/**
 * 按目标视频宽高生成 ASS 头：PlayRes=真实宽高，字号按短边（min(w,h)×0.05）——
 * 竖屏与横屏都得到合适字号（≈54）；底边距按高、左右边距按宽，描边/阴影按短边
 * 缩放。asr.py `_ass_header` 1:1。
 */
export function assHeader(w, h) {
  const short = Math.min(w, h)
  const fs = Math.max(16, Math.round(short * 0.05))
  const outline = Math.max(1, Math.round(short * 0.004))
  const shadow = Math.max(0, Math.round(short * 0.0015))
  const mv = Math.round(h * 0.06)
  const mlr = Math.round(w * 0.045)
  return (
    '[Script Info]\nScriptType: v4.00+\n'
    + `PlayResX: ${w}\nPlayResY: ${h}\n`
    + 'WrapStyle: 0\nScaledBorderAndShadow: yes\n\n'
    + '[V4+ Styles]\n'
    + 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, '
    + 'Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, '
    + 'Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
    + `Style: Default,Noto Sans CJK SC,${fs},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,`
    + `-1,0,0,0,100,100,0,0,1,${outline},${shadow},2,${mlr},${mlr},${mv},1\n\n`
    + '[Events]\n'
    + 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
  )
}

/** cues（[start, end, text] 三元组）→ SRT 文本（asr.py `_render_srt`）。 */
export function renderSrt(cues, maxChars) {
  const blocks = cues.map(([s, e, t], i) => {
    const body = wrapLine(t, maxChars).replaceAll('\\N', '\n')
    return `${i + 1}\n${fmtSrtTs(s)} --> ${fmtSrtTs(e)}\n${body}`
  })
  return `${blocks.join('\n\n')}\n`
}

/** cues → ASS 文本（ASS 用 \N 换行；asr.py `_render_ass`，默认竖屏 1080x1920）。 */
export function renderAss(cues, maxChars, w = 1080, h = 1920) {
  const lines = [assHeader(w, h)]
  for (const [s, e, t] of cues) {
    lines.push(`Dialogue: 0,${fmtAssTs(s)},${fmtAssTs(e)},Default,,0,0,0,,${wrapLine(t, maxChars)}`)
  }
  return `${lines.join('\n')}\n`
}

/** cues → 纯文本（asr.py `_render_txt`）。 */
export function renderTxt(cues) {
  return `${cues.map(([, , t]) => t).join('\n')}\n`
}

/** cues + meta → JSON（meta 在前，segments 带 index；asr.py `_render_json`）。 */
export function renderJson(cues, meta) {
  const round3 = x => Math.round(x * 1000) / 1000
  return JSON.stringify({
    ...meta,
    segments: cues.map(([s, e, t], i) => ({ index: i + 1, start: round3(s), end: round3(e), text: t })),
  }, null, 2)
}

// ── 编排：文件 → 字幕 ────────────────────────────────────────────────

/**
 * 原子 JSON 写（tmp + rename）：崩溃最多留下一个点前缀的临时文件，目标文件
 * 永远是完整 JSON（asr.js 依赖方向上不能 import index.js 的 writeJsonFile）。
 */
async function writeJsonAtomic(file, value) {
  const scratch = join(dirname(file), `.${basename(file)}.${process.pid}.${Date.now()}.tmp`)
  await writeFile(scratch, JSON.stringify(value, null, 2), 'utf8')
  await rename(scratch, file)
}

/**
 * Transcribe one audio/video file into a subtitle file.
 *
 * Per-segment checkpoint: every transcribed segment is appended atomically to
 * `<input dir>/<input stem>.asr-partial.json` as
 * `{src: {mtimeMs, size}, segments: [{index, start, end, text}]}`. A failed run
 * keeps the sidecar; the next call re-transcribes only missing indices (reused
 * segments add no billed seconds — they were billed on the earlier run) and the
 * sidecar is deleted once every segment has succeeded. A sidecar whose src
 * identity no longer matches the input is ignored and rebuilt; a missing input
 * takes its sidecar with it.
 *
 * @param options.input - absolute input path (existence checked here → 404).
 * @param options.format - 'srt' | 'ass' | 'txt' | 'json' (default srt).
 * @param options.language - recorded in meta only: the confirmed mimo gateway
 *   takes a single input_audio part and no text part, so there is nowhere to
 *   send a language hint.
 * @param options.projectRoot - output base; file lands at
 *   `outputs/<stem>/<stem>.<format>` (asr.py `-o` default behavior).
 * @param options.outDir - optional output directory, projectRoot-relative with
 *   forward slashes (default `outputs/<input stem>`).
 * @param options.outStem - optional output file stem (default the input stem);
 *   deconstruct passes its batch id so concurrent jobs never overwrite each
 *   other's subtitles.
 * @param options.credentials - `{ apiKey, baseUrl?, model? }` from
 *   `resolveMimoCredentials`; missing key → 400.
 * @returns `{ file, segments, seconds, meta }` — `file` is projectRoot-relative
 *   with forward slashes, `segments` the written cues, `seconds` the total
 *   mimo-billed audio seconds.
 */
export async function transcribeToSubtitle({
  input,
  format = 'srt',
  language,
  projectRoot,
  outDir,
  outStem,
  credentials,
  ffmpegBin = 'ffmpeg',
  ffprobeBin = 'ffprobe',
  maxLineChars = 18,
  fetchImpl = fetch,
}) {
  if (!['srt', 'ass', 'txt', 'json'].includes(format)) {
    throw new AsrError(400, `format 仅支持 srt/ass/txt/json，收到：${format}`)
  }
  if (!credentials?.apiKey) {
    throw new AsrError(400, '未配置 mimo ASR 凭据：请设置 MIMO_API_KEY（环境变量或项目 .env）')
  }
  const src = String(input)
  const srcStem = basename(src, extname(src))
  // 分段检查点 sidecar：与输入同目录，逐段落盘供续跑。
  const partialPath = join(dirname(src), `${srcStem}.asr-partial.json`)
  if (!existsSync(src)) {
    // 输入已不在：检查点随之失效，顺手清掉，不给素材目录留孤儿 sidecar。
    await rm(partialPath, { force: true })
    throw new AsrError(404, `输入文件不存在: ${src}`)
  }
  const ext = extname(src).toLowerCase()
  if (!VIDEO_EXTS.has(ext) && !AUDIO_EXTS.has(ext)) {
    throw new AsrError(400, `不支持的文件类型「${ext || '(无扩展名)'}」：仅支持音频 ${[...AUDIO_EXTS].join(' ')} 与视频 ${[...VIDEO_EXTS].join(' ')}`)
  }

  // 临时产物：outputs/_asr/<run>/（_ 前缀不进内容库），结束即清（asr.py finally 语义）。
  const tempDir = join(projectRoot, 'outputs', '_asr', `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  await mkdir(tempDir, { recursive: true })
  try {
    // 视频与压缩音频先抽 16k 单声道 wav；wav 直用（样音实测 22.05k 单声道可直调）。
    let wav
    if (ext === '.wav') {
      wav = src
    } else {
      wav = await extractAudio16kMono(ffmpegBin, src, join(tempDir, 'audio.wav'))
    }

    const { segments, duration } = await detectSpeechSegments(ffmpegBin, ffprobeBin, wav)

    // 分段检查点：sidecar 存在且 src 身份（mtimeMs 取整 + size）匹配 → 复用
    // 已完成分段，只转缺失 index；身份不匹配（换了输入）或损坏 → 忽略重建。
    const stat = statSync(src)
    const srcId = { mtimeMs: Math.round(stat.mtimeMs), size: stat.size }
    const reused = new Map()
    if (existsSync(partialPath)) {
      try {
        const saved = JSON.parse(await readFile(partialPath, 'utf8'))
        if (saved?.src?.mtimeMs === srcId.mtimeMs && saved?.src?.size === srcId.size && Array.isArray(saved.segments)) {
          for (const seg of saved.segments) {
            if (seg !== null && typeof seg === 'object' && Number.isInteger(seg.index) && typeof seg.text === 'string') {
              reused.set(seg.index, seg)
            }
          }
        }
      } catch { /* 半截或损坏的 sidecar → 当作无检查点，全量重转 */ }
    }

    // 逐段 base64 调 mimo（串行，不并发）；段边界即时间戳。
    const cues = []
    let seconds = 0
    const checkpoint = []
    for (let i = 0; i < segments.length; i++) {
      const [start, end] = segments[i]
      const cached = reused.get(i)
      if (cached !== undefined) {
        // 检查点命中：该段上次已转写成功，直接复用文本（时间戳仍取本次分段
        // 结果），不再切片也不再请求网关。
        if (cached.text) cues.push(...splitLongSegment(cached.text, start, end, maxLineChars))
        checkpoint.push({ index: i, start, end, text: cached.text })
        continue
      }
      const segPath = join(tempDir, `seg-${String(i).padStart(3, '0')}.wav`)
      const cut = await spawnCapture([ffmpegBin, '-y', '-ss', start.toFixed(3), '-i', wav,
        '-t', (end - start).toFixed(3), segPath])
      requireFfmpeg(cut)
      if (cut.code !== 0 || !existsSync(segPath)) {
        throw new AsrError(500, `ffmpeg 切分语音段失败（段 ${i}）:\n${stderrTail(cut)}`)
      }
      try {
        const { text, billedSeconds } = await transcribeSegment(credentials, segPath, { fetchImpl })
        // mimo 会在转写文本里夹自带换行：中文字符间直接拼回，其余场景折成空格。
        const transcript = text
          .replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])\s*\n+\s*([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])/g, '$1$2')
          .replace(/\s*\n+\s*/g, ' ')
          .trim()
        if (transcript) cues.push(...splitLongSegment(transcript, start, end, maxLineChars))
        seconds += billedSeconds ?? (end - start)
        // 成功即原子追加检查点：之后任何一段失败，重跑只补缺失段。
        checkpoint.push({ index: i, start, end, text: transcript })
        await writeJsonAtomic(partialPath, { src: srcId, segments: checkpoint })
      } finally {
        await rm(segPath, { force: true })
      }
    }

    // 全部段成功：检查点使命完成，删除 sidecar；失败路径保留供续跑。
    await rm(partialPath, { force: true })

    const meta = {
      source: src,
      model: credentials.model,
      language: language ?? null,
      duration_sec: Math.round(duration * 1000) / 1000,
      num_segments: cues.length,
    }

    let content
    let assWH = null
    if (format === 'ass') {
      // 字幕样式按目标视频宽高自适应：视频输入探测宽高，纯音频默认竖屏 1080x1920。
      assWH = VIDEO_EXTS.has(ext) ? (await probeVideoWH(ffprobeBin, src)) : null
      content = renderAss(cues, maxLineChars, ...(assWH ?? [1080, 1920]))
    } else if (format === 'txt') {
      content = renderTxt(cues)
    } else if (format === 'json') {
      content = renderJson(cues, meta)
    } else {
      content = renderSrt(cues, maxLineChars)
    }

    // 输出落位：缺省 outputs/<输入名>/<输入名>.<format>（对齐 asr.py -o 缺省
    // 行为）；deconstruct 传 outDir/outStem 把字幕落进批次目录，任务互不覆盖。
    const stem = outStem ?? srcStem
    const dirRel = (outDir ?? ['outputs', stem].join('/')).split('\\').join('/')
    const relFile = `${dirRel}/${stem}.${format}`
    await mkdir(join(projectRoot, dirRel), { recursive: true })
    await writeFile(join(projectRoot, relFile), content, 'utf8')

    const round3 = x => Math.round(x * 1000) / 1000
    return {
      file: relFile,
      segments: cues.map(([s, e, t]) => ({ start: round3(s), end: round3(e), text: t })),
      seconds: Math.round(seconds * 1000) / 1000,
      meta: { ...meta, ass_resolution: assWH },
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

// ── 技能侧发现：本地 API base 落盘 ───────────────────────────────────

/**
 * Write `outputs/_easel_api.json` so agent skills can discover the local API
 * base without knowing the dsh web port (`_` prefix stays out of the content
 * library). Refreshed at plugin activation and on every /asr call, so the port
 * is correct even when activation ran before the server bound its port.
 *
 * `runnerToken` is the per-process capability the ASR route accepts in place of
 * the dsh cookie (`x-easel-runner`). The file carries it because a skill runs as
 * the same user and has no other channel; it never leaves the data root.
 * @param projectRoot - Easel project root (outputs/ lives under it).
 * @param port - the dsh webServer port (`ctx.webServer.port`).
 * @param basePath - this plugin's route base, e.g. `/easel`.
 * @param runnerToken - the easel plugin's runner capability, when it has one.
 */
export async function writeApiDiscovery(projectRoot, port, basePath = '/easel', runnerToken = '') {
  if (!Number.isInteger(port) || port <= 0) return false
  const payload = JSON.stringify({
    base: `http://127.0.0.1:${port}`,
    basePath,
    ...(runnerToken ? { runnerToken } : {}),
    updatedAt: new Date().toISOString(),
  }, null, 2) + '\n'
  const outputs = join(projectRoot, 'outputs')
  await mkdir(outputs, { recursive: true })
  const file = join(outputs, '_easel_api.json')
  // Atomic and owner-only: a skill may read the capability, another local
  // account may not, and a crash must not leave a half-written JSON file.
  const scratch = join(outputs, `.${basename(file)}.${process.pid}.${Date.now()}.tmp`)
  // Dot-prefixed: a leftover sidecar is not content and the read routes refuse
  // dot segments, so a crashed write can never serve the capability.
  await writeFile(scratch, payload, { encoding: 'utf8', mode: 0o600 })
  await rename(scratch, file)
  return true
}
