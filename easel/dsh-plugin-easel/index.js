/**
 * Host half of the Easel plugin for DeepSeek Harness.
 *
 * Three contributions, all on documented dsh extension points:
 *
 * - `GET <basePath>/status` — the workbench availability probe and skill count
 *   the sidebar panel renders on mount. It answers even when the Easel backend
 *   is down, so the panel can say *why* it is empty instead of spinning.
 * - `GET <basePath>/skills` — a read-only browse catalog of Easel's skills read
 *   straight off disk. This is a UI projection, deliberately not a skill
 *   provider: loading, validation, and invocation policy belong to the shipped
 *   `@deepseek-ai/dsh-skill-filesystem` row that the deployment's patch layer
 *   mounts separately (the desktop shell writes it; see the bundled-install
 *   spec), and this catalog still browses files that loader would reject.
 * - `<basePath>/api/*` — the Easel API surface, answered entirely by the host
 *   half (B1 file IO + B2 runner orchestration + B3-era client conversation
 *   pushes). The Python backend and the reverse proxy are retired: a request
 *   no local route claims gets a plain 404, and the workbench keeps working
 *   with no Easel process on the machine.
 *
 * Deployment-varying values are the `config` block of this plugin's loader row;
 * nothing here is a constant a deployment cannot change.
 */
import { createReadStream, existsSync, closeSync, mkdirSync, openSync, realpathSync } from 'node:fs'
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { lookup as dnsLookup } from 'node:dns/promises'
import { randomBytes } from 'node:crypto'
import net from 'node:net'
import tls from 'node:tls'
import { seedProjectWorkspace } from './lib/projectize.js'
import {
  applyWatch, buildWatchGroups, clusterTrends, decorateFetched, normalizeKeywords,
  pruneSnapshot, readRadarHistory, staleItemsFromHistory,
} from './lib/trends.js'
import { RadarArticleError, createCaptureHandler } from './lib/trends-article.js'
import { discoverCalendars, syncCalendarEvents } from './caldav.js'

/** Cordis plugin name; also the `name` of this plugin's loader row. */
export const name = 'easel'

/** The route table is the one service this host half requires. */
export const inject = ['webServer']

const DEFAULT_BASE_PATH = '/easel'
const SKILL_FILE = 'SKILL.md'
const PROXY_SUFFIX = '/api'
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/

/**
 * Resolve the deployment-varying settings of this plugin.
 *
 * `projectRoot` is canonicalized through `fs.realpath`. The desktop layout
 * migration parks the data behind a junction at the old path, while dsh's
 * `workspaceFiles.stat` reports canonical absolute paths; keeping the junction
 * spelling here made every project-root prefix check (the sidebar media URL in
 * the client half) compare two spellings of the same directory and fail.
 * A root that does not exist yet keeps its configured spelling so startup
 * still reports the real error from the route that reads it.
 *
 * @param config - the `config` block of this plugin's loader row, possibly empty.
 * @returns absolute project and skill roots, the backend URL, and the route base path.
 */
export function resolveSettings(config) {
  const configured = resolve(config.projectRoot ?? process.env.EASEL_PROJECT_ROOT ?? process.cwd())
  let projectRoot = configured
  try {
    projectRoot = realpathSync.native(configured)
  } catch {
    // Missing root: leave the configured path for the failing read to report.
  }
  return {
    projectRoot,
    skillsDir: resolve(config.skillsDir ?? join(projectRoot, 'skills', 'openclaw')),
    basePath: normalizeBasePath(config.basePath ?? DEFAULT_BASE_PATH),
    // runner 舰队（skills/shared/scripts，B2 起由宿主半直接 spawn）用的解释器。
    python: config.pythonExecutable ?? process.env.EASEL_PYTHON ?? 'python',
  }
}

/**
 * Normalize a configured route base into an absolute path with no trailing slash.
 * @param value - the configured base path.
 * @returns the pathname every route of this plugin hangs off.
 */
function normalizeBasePath(value) {
  const trimmed = value.replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

// YAML folded/literal block-indicator scalars (`>`, `>-`, `|`, `|-`): the value
// lives on the following indented lines, which this projection does not read.
// Showing the indicator as the description would be junk, so the description
// displays empty instead — the real skill reader parses these correctly.
const BLOCK_MARKER = /^[>|][+-]?$/

/**
 * Read the flat `key: value` pairs of a Markdown frontmatter block.
 *
 * Enumeration only: nested structures and block scalars are skipped rather than
 * parsed, because the catalog displays scalars and the skill loader owns real
 * parsing.
 * @param markdown - the whole instruction file.
 * @returns the header scalar fields found.
 */
function parseFrontmatter(markdown) {
  const block = FRONTMATTER.exec(markdown)
  if (block === null) return {}
  const fields = {}
  for (const line of block[1].split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator <= 0 || line.startsWith(' ') || line.startsWith('\t')) continue
    const value = line.slice(separator + 1).trim()
    if (BLOCK_MARKER.test(value)) continue
    fields[line.slice(0, separator).trim()] = value.replace(/^["']|["']$/g, '')
  }
  return fields
}

/**
 * Read one skill directory or `<name>.md` file into a browse entry.
 * @param skillsDir - the skill root the entry came from.
 * @param entry - one directory entry of that root.
 * @returns the browse entry, or null when the instruction file is unreadable.
 */
async function readSkillEntry(skillsDir, entry) {
  const isDirectory = entry.isDirectory()
  const path = isDirectory ? join(skillsDir, entry.name, SKILL_FILE) : join(skillsDir, entry.name)
  const markdown = await readFile(path, 'utf8').then(text => text, () => null)
  if (markdown === null) return null
  const fields = parseFrontmatter(markdown)
  return {
    name: fields.name ?? (isDirectory ? entry.name : basename(entry.name, extname(entry.name))),
    description: fields.description ?? '',
    layer: fields.layer ?? null,
    path,
  }
}

/**
 * Read the browse catalog of one skill root.
 * @param skillsDir - absolute skill root to enumerate.
 * @returns the entries sorted by name, and whether the root itself exists.
 */
async function readSkillCatalog(skillsDir) {
  const entries = await readdir(skillsDir, { withFileTypes: true }).then(found => found, () => null)
  if (entries === null) return { directory: skillsDir, present: false, count: 0, skills: [] }
  const candidates = entries.filter(entry => !entry.name.startsWith('.') && !entry.name.startsWith('_')
    && (entry.isDirectory() || (entry.isFile() && entry.name.endsWith('.md'))))
  const resolved = await Promise.all(candidates.map(entry => readSkillEntry(skillsDir, entry)))
  const skills = resolved.filter(entry => entry !== null)
  skills.sort((left, right) => left.name.localeCompare(right.name))
  return { directory: skillsDir, present: true, count: skills.length, skills }
}

/**
 * Write one JSON response.
 * @param res - the response this route owns.
 * @param status - HTTP status to send.
 * @param body - the JSON-serializable body.
 */
function sendJson(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body, null, 2))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(payload.byteLength),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

/**
 * Reject a read-only route's non-GET request.
 * @param req - the incoming request.
 * @param res - the response this route owns.
 * @returns whether the caller may continue with its GET handling.
 */
function requireGet(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') return true
  res.writeHead(405, { allow: 'GET, HEAD', 'content-length': '0' })
  res.end()
  return false
}

/**
 * Decide whether a proxied request's browser-supplied `Origin` is one this
 * workbench itself serves. The proxy stamps the backend's own origin onto
 * forwarded writes (Easel's local_write_guard judges that header), so a
 * cross-site page must not be able to ride the proxy: only origins identical
 * to dsh's own (`http://<Host>` of the incoming request) pass. Requests
 * without an Origin — dsh's server-side callers, curl, the tests — are not
 * browser cross-site traffic and pass.
 *
 * Known residuals, deliberate: the scheme is hardcoded to `http://` (dsh's
 * webserver is plain HTTP; behind an HTTPS-terminating proxy same-origin
 * writes would be refused — extend here first), and a DNS-rebound hostname
 * passes (its Origin equals its Host after rebinding; add a host allowlist
 * if dsh is ever exposed beyond loopback — Chromium's Private Network Access
 * blocks the public-web route today).
 * @param origin - the request's `Origin` header, or undefined.
 * @param host - the request's `Host` header (dsh's own host:port).
 * @returns whether the request may be forwarded.
 */
export function sameOriginAllowed(origin, host) {
  if (origin === undefined) return true
  return host !== undefined && origin === `http://${host}`
}

// ═══════════════════════════════════════════════════════════════════════
// Local API — absorption batch B1 of the Easel backend retirement.
//
// These handlers answer `/easel/api/*` straight off the project directory:
// pure file IO, JSON stores, trends fetching, and the login/publish status
// files. Anything the route table does not claim returns `null` and falls
// through to the proxy, so the Python backend keeps serving the rest until a
// later batch absorbs (browser automation, B2) or retires it (chat, B3/B4).
//
// Hybrid-period caveats, deliberate: a login runner's death is only visible
// to the process that spawned it, so local login status cannot report the
// actionable "runner exited" error while login starts still go through the
// proxy; the wechat-oa credential/logout flows (YAML config + verify
// subprocess + mp process ownership) also stay proxied until B2.
// ═══════════════════════════════════════════════════════════════════════

/** An HTTP error carrying the FastAPI `{detail}` shape the client surfaces. */
export class ApiError extends Error {
  constructor(status, detail) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

const PROFILE_FILE_ORDER = ['identity.md', 'style.md', 'audience.md', 'platforms.md', 'preferences.md', 'memory.md']
const PROTECTED_OUTPUTS = new Set(['_login', '_analytics', '_schedule.json', '_ideas.json',
  '_publish', '_publish.log', '_sessions', '_profile_build', '_debug', '_inbox',
  '_caldav_config.json', '_caldav_cache.json'])

const TEXT_EXTS = new Set(['.txt', '.md', '.json', '.csv', '.log', '.py', '.js', '.ts', '.html', '.htm', '.css', '.xml', '.yaml', '.yml', '.srt', '.vtt'])
export const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'])
export const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'])
// workspace-media 只服务侧栏播放器能放的格式：项目根下还有 .env、画像、脚本等，
// 不限扩展名就等于把它们暴露成一个通用文件服务器。
const PLAYABLE_MEDIA_EXTS = new Set([
  '.mp4', '.mov', '.webm', '.m4v', '.mkv',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.opus',
])

const MEDIA_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.opus': 'audio/ogg',
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json', '.csv': 'text/csv', '.xml': 'application/xml',
}

function fileKind(name) {
  const ext = extname(name).toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (TEXT_EXTS.has(ext)) return 'text'
  return 'binary'
}

export async function pathStat(path) {
  try {
    return await stat(path)
  } catch {
    return null
  }
}

export async function isFile(path) {
  const found = await pathStat(path)
  return found !== null && found.isFile()
}

export async function isDirectory(path) {
  const found = await pathStat(path)
  return found !== null && found.isDirectory()
}

export async function readJsonFile(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

/** Atomic JSON write via `<path>.tmp` + rename, matching the backend's own writes. */
export async function writeJsonFile(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, path)
}

/**
 * Match decoded path segments against a pattern. `':name'` captures one
 * segment; `':path...'` captures the remaining segments joined with '/'.
 * @returns the captured params, or null when the shape does not fit.
 */
function matchRoute(segments, pattern) {
  const params = {}
  for (let i = 0; i < pattern.length; i++) {
    const part = pattern[i]
    if (part.endsWith('...')) {
      params[part.slice(1, -3)] = segments.slice(i).join('/')
      return params
    }
    if (i >= segments.length) return null
    if (part.startsWith(':')) params[part.slice(1)] = segments[i]
    else if (part !== segments[i]) return null
  }
  return segments.length === pattern.length ? params : null
}

// ---- .env：模型/API key 注册表（移植 web/app.py + skills/shared/scripts/model_registry.py）----

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const ENV_PLACEHOLDER = /replace_me|your[-_]?api[-_]?key|xxx|^\.{3}$|^<.*>$/i
const ENV_VALUE_OK = /^[A-Za-z0-9_.:/@+=~,%?#[\]-]*$/

const k = (env, label, required = true, secret = true, aliases = [], choices = []) =>
  ({ env, label, required, secret, aliases, choices })

const MODEL_GROUPS = {
  image: {
    label: 'AI 生图',
    settings: [],
    providers: [{
      id: 'openai',
      name: 'OpenAI 兼容 / apimart / 小红书 MaaS',
      keys: [
        k('IMG_API_KEY', 'API Key', true, true, ['OPENAI_API_KEY', 'API_KEY']),
        k('IMG_BASE_URL', 'API 根地址', true, false, ['OPENAI_BASE_URL', 'OPENAI_API_BASE', 'BASE_URL']),
        k('IMG_MODEL', '模型', false, false),
        k('IMG_API_KEY_HEADER', '鉴权头名', false, false),
        k('IMG_API_VERSION', 'api-version', false, false),
        k('IMG_NO_PROXY', '内网直连（填 1）', false, false),
      ],
    }],
  },
  video: {
    label: 'AI 视频生成',
    settings: [
      k('VIDEO_PROVIDER', '默认视频 provider', false, false, [], ['dashscope', 'ark', 'kling', 'openai-compatible', 'xhs-maas', 'agnes', 'minimax']),
      k('VIDEO_CAPABILITIES_JSON', '模型能力覆盖 JSON', false, false),
    ],
    providers: [
      {
        id: 'dashscope', name: '阿里通义万相 Wan', keys: [
          k('DASHSCOPE_API_KEY', 'DashScope API Key', true, true, ['DASHSCOPE_KEY', 'ALIYUN_API_KEY']),
          k('DASHSCOPE_VIDEO_MODEL', '视频模型', false, false, ['DASHSCOPE_MODEL']),
          k('DASHSCOPE_BASE_URL', '根地址', false, false),
        ],
      },
      {
        id: 'ark', name: '火山引擎 Seedance', keys: [
          k('ARK_API_KEY', 'Ark API Key', true, true, ['VOLCENGINE_API_KEY', 'VOLC_ARK_API_KEY']),
          k('ARK_MODEL', '视频模型', false, false),
          k('ARK_BASE_URL', '根地址', false, false),
        ],
      },
      {
        id: 'kling', name: '快手可灵', keys: [
          k('KLING_ACCESS_KEY', 'Access Key'),
          k('KLING_SECRET_KEY', 'Secret Key'),
          k('KLING_BASE_URL', '根地址', false, false),
        ],
      },
      {
        id: 'openai-compatible', name: 'OpenAI 兼容 /videos', keys: [
          k('VIDEO_API_KEY', 'API Key', true, true, ['OPENAI_API_KEY', 'API_KEY']),
          k('VIDEO_BASE_URL', 'API 根地址', true, false, ['OPENAI_BASE_URL', 'BASE_URL']),
          k('VIDEO_MODEL', '视频模型', false, false, ['VIDEO_MODEL_NAME']),
        ],
      },
      {
        id: 'xhs-maas', name: '小红书 MaaS（happyhorse）', keys: [
          k('XHS_MAAS_API_KEY', 'MaaS api-key'),
          k('XHS_MAAS_VIDEO_BASE', '视频端点根地址', false, false),
          k('XHS_MAAS_T2V_MODEL', '文生视频模型', false, false),
          k('XHS_MAAS_I2V_MODEL', '图生视频模型', false, false),
          k('XHS_MAAS_RESOLUTION', '分辨率', false, false),
        ],
      },
      {
        id: 'agnes', name: 'Agnes Video', keys: [
          k('AGNES_API_KEY', 'Agnes API Key'),
          k('AGNES_BASE_URL', '创建端点根地址', false, false),
          k('AGNES_POLL_BASE', '轮询端点', false, false),
          k('AGNES_MODEL', '视频模型', false, false),
          k('AGNES_SIZE', '分辨率', false, false),
        ],
      },
      {
        // 与 voice 组的 MiniMax 共用同一把 MINIMAX_API_KEY（同一开放平台）。
        id: 'minimax', name: 'MiniMax H3（视频生成，原生音频）', keys: [
          k('MINIMAX_API_KEY', 'MiniMax API Key'),
          k('MINIMAX_VIDEO_BASE', '根地址', false, false),
          k('MINIMAX_VIDEO_MODEL', '视频模型', false, false),
          k('MINIMAX_VIDEO_RESOLUTION', '分辨率（768P/2K）', false, false),
        ],
      },
    ],
  },
  music: {
    label: 'AI 音乐 / BGM',
    settings: [
      k('MUSIC_PROVIDER', '默认音乐 provider', false, false, [], ['dashscope', 'suno-compatible']),
    ],
    providers: [
      {
        id: 'dashscope', name: '阿里 DashScope', keys: [
          k('DASHSCOPE_API_KEY', 'DashScope API Key', true, true, ['DASHSCOPE_KEY', 'ALIYUN_API_KEY']),
          k('DASHSCOPE_MUSIC_MODEL', '音乐模型', false, false, ['DASHSCOPE_MODEL']),
          k('DASHSCOPE_BASE_URL', '根地址', false, false),
        ],
      },
      {
        id: 'suno-compatible', name: 'Suno 类第三方 API', keys: [
          k('MUSIC_API_KEY', 'API Key', true, true, ['SUNO_API_KEY', 'API_KEY']),
          k('MUSIC_BASE_URL', 'API 根地址', true, false, ['SUNO_BASE_URL', 'BASE_URL']),
          k('MUSIC_MODEL', '音乐模型', false, false),
        ],
      },
    ],
  },
  voice: {
    label: '云端语音 / 声音克隆',
    settings: [
      k('VOICE_PROVIDER', '默认语音 provider', false, false, [], ['dashscope', 'minimax', 'fish-audio', 'openai-compatible', 'gemini']),
      k('VOICE_NARRATOR_VOICE_ID', '默认旁白 voice-id', false, false),
    ],
    providers: [
      {
        id: 'dashscope', name: '阿里 CosyVoice', keys: [
          k('DASHSCOPE_API_KEY', 'DashScope API Key', true, true, ['DASHSCOPE_KEY', 'ALIYUN_API_KEY']),
          k('DASHSCOPE_TTS_MODEL', 'TTS 模型', false, false),
          k('DASHSCOPE_BASE_URL', '根地址', false, false),
        ],
      },
      {
        id: 'minimax', name: 'MiniMax', keys: [
          k('MINIMAX_API_KEY', 'API Key'),
          k('MINIMAX_GROUP_ID', 'Group ID', true, false),
          k('MINIMAX_MODEL', 'TTS 模型', false, false),
          k('MINIMAX_BASE_URL', '根地址', false, false),
        ],
      },
      {
        id: 'fish-audio', name: 'Fish Audio', keys: [
          k('FISH_API_KEY', 'API Key'),
          k('FISH_BASE_URL', '根地址', false, false),
        ],
      },
      {
        id: 'openai-compatible', name: 'OpenAI 兼容 /audio/speech', keys: [
          k('VOICE_API_KEY', 'API Key', true, true, ['OPENAI_API_KEY', 'API_KEY']),
          k('VOICE_BASE_URL', 'API 根地址', true, false, ['OPENAI_BASE_URL', 'BASE_URL']),
          k('VOICE_MODEL', 'TTS 模型', false, false),
          k('VOICE_INSTRUCT_MODE', '情感指令模式', false, false, [], ['field', 'inline']),
          k('VOICE_INSTRUCT_DELIM', '内联指令分隔符', false, false),
        ],
      },
      {
        id: 'gemini', name: 'Google Gemini TTS', keys: [
          k('GEMINI_API_KEY', 'Gemini API Key', true, true, ['GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY']),
          k('GEMINI_TTS_MODEL', 'TTS 模型', false, false),
          k('GEMINI_VOICE', '预置音色', false, false),
          k('GEMINI_BASE_URL', '根地址', false, false),
          k('GEMINI_TTS_RATE', '采样率', false, false),
        ],
      },
    ],
  },
}

const modelSpec = (group, label = null) => {
  const spec = MODEL_GROUPS[group]
  return { label: label ?? spec.label, settings: spec.settings, providers: spec.providers }
}

function shortDramaSpec() {
  // Image is required; video and cloud voice settings remain optional enhancements.
  const image = MODEL_GROUPS.image
  const optional = []
  for (const groupName of ['video', 'voice']) {
    const group = MODEL_GROUPS[groupName]
    optional.push(...group.settings.map(key => ({ ...key, required: false })))
    for (const provider of group.providers) optional.push(...provider.keys.map(key => ({ ...key, required: false })))
  }
  const seen = new Set()
  const deduped = optional.filter(key => {
    if (seen.has(key.env)) return false
    seen.add(key.env)
    return true
  })
  return {
    label: 'AI 短剧（生图必需 + 生视频/云配音可选）',
    settings: [],
    providers: [{
      id: 'drama',
      name: '关键帧生图（必需）+ 视频生成与闭源配音（可选）',
      keys: [...image.providers[0].keys, ...deduped],
    }],
  }
}

const SKILL_API_REQUIREMENTS = {
  'ai-image-gen': modelSpec('image'),
  'ecom-details-image': modelSpec('image', '电商配图（AI 生图）'),
  'ai-video-gen': modelSpec('video'),
  'ai-music': modelSpec('music'),
  'voice-clone': modelSpec('voice', '声音克隆 / 云端 TTS'),
  // AI 短剧：以生图为「已配置」基线（缺生图无法出关键帧）；生视频 key 同框可选填。
  'short-drama': shortDramaSpec(),
  // 论文解读：全 key 可选 → 不误报感叹号；仍进注册表以便就地填 MINERU_API_TOKEN。
  'paper-explainer': {
    label: '论文解读（MinerU / 生图 均可选）',
    providers: [{
      id: 'paper',
      name: 'MinerU 解析(可选, 缺则 pdfplumber) + 封面/概念生图(可选)',
      keys: [
        k('MINERU_API_TOKEN', 'MinerU API Token（可选，缺则用 pdfplumber 兜底）', false),
        k('IMG_API_KEY', '生图 API Key（可选，用于封面/概念图）', false, true, ['OPENAI_API_KEY', 'API_KEY']),
        k('IMG_BASE_URL', '生图 API 根地址（可选）', false, false, ['OPENAI_BASE_URL', 'OPENAI_API_BASE', 'BASE_URL']),
      ],
    }],
  },
}

const ENV_ALLOWLIST = new Set(['EASEL_DIRECT_API_BASE_URL', 'EASEL_DIRECT_API_KEY', 'EASEL_DIRECT_API_MODEL'])
for (const spec of Object.values(SKILL_API_REQUIREMENTS)) {
  for (const key of spec.settings ?? []) {
    ENV_ALLOWLIST.add(key.env)
    for (const alias of key.aliases ?? []) ENV_ALLOWLIST.add(alias)
  }
  for (const provider of spec.providers) {
    for (const key of provider.keys) {
      ENV_ALLOWLIST.add(key.env)
      for (const alias of key.aliases ?? []) ENV_ALLOWLIST.add(alias)
    }
  }
}
// 语音转字幕（POST /easel/api/asr，lib/asr.js 调 mimo-v2.5-asr）凭据走同一 .env 注册表。
for (const key of ['MIMO_API_KEY', 'MIMO_BASE_URL', 'MIMO_ASR_MODEL']) ENV_ALLOWLIST.add(key)

export async function readEnvFile(envFile) {
  // 宽松解析 KEY=value：跳过注释与非赋值行（与 web/app.py `_read_env` 同语义）。
  const result = {}
  let text = ''
  try {
    text = await readFile(envFile, 'utf8')
  } catch {
    return result
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    if (IDENTIFIER.test(key) || IDENTIFIER.test(key.replace(/-/g, '_'))) result[key] = trimmed.slice(separator + 1).trim()
  }
  return result
}

function guardEnvValues(updates) {
  // .env 值是裸写 KEY=value 且会被 `source .env`：值里带换行能追加任意行，
  // 带 `$()` 能执行命令——字符集必须在入口收死（与 web/app.py 同一收紧）。
  for (const [rawKey, rawValue] of Object.entries(updates)) {
    const key = rawKey ?? ''
    if (/[\r\n=]/.test(key) || !IDENTIFIER.test(key)) {
      throw new ApiError(400, `非法的配置键名：${JSON.stringify(key.slice(0, 40))}`)
    }
    const value = rawValue ?? ''
    if (/[\r\n\x00]/.test(value)) throw new ApiError(400, `配置值不能包含换行符：${key}`)
    if (!ENV_VALUE_OK.test(value)) {
      const bad = [...new Set([...value].filter(ch => !ENV_VALUE_OK.test(ch)))].sort().join('')
      throw new ApiError(400, `配置值含不允许的字符（${JSON.stringify(bad)}）：${key}`)
    }
  }
}

async function writeEnvFile(envFile, updates) {
  const allowed = Object.fromEntries(Object.entries(updates).filter(([key]) => ENV_ALLOWLIST.has(key)))
  guardEnvValues(allowed)
  if (Object.keys(allowed).length === 0) return
  let lines = []
  try {
    lines = (await readFile(envFile, 'utf8')).split(/\r?\n/)
    if (lines[lines.length - 1] === '') lines.pop()
  } catch { /* 新 .env */ }
  const seen = new Set()
  const out = []
  for (const line of lines) {
    const trimmed = line.trim()
    let matched = null
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
      if (key in allowed) matched = key
    }
    if (matched !== null) {
      seen.add(matched)
      const value = allowed[matched]
      if (value.trim() === '') continue
      out.push(`${matched}=${value}`)
      continue
    }
    out.push(line)
  }
  const appended = Object.entries(allowed).filter(([key, value]) => !seen.has(key) && value.trim() !== '')
  if (appended.length > 0) {
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('')
    out.push('# ---- Easel API keys (added via Web) ----')
    for (const [key, value] of appended) out.push(`${key}=${value}`)
  }
  const tmp = `${envFile}.tmp`
  await writeFile(tmp, `${out.join('\n')}\n`, 'utf8')
  await rename(tmp, envFile)
}

const isSet = value => typeof value === 'string' && value.trim().length > 0 && !ENV_PLACEHOLDER.test(value.trim())

function maskValue(value) {
  const trimmed = value.trim()
  return trimmed.length <= 4 ? '••••' : `••••${trimmed.slice(-4)}`
}

const keyConfigured = (key, env) => isSet(env[key.env]) || (key.aliases ?? []).some(alias => isSet(env[alias]))

function skillApiConfigured(skill, env) {
  const spec = SKILL_API_REQUIREMENTS[skill]
  if (!spec) return true
  return spec.providers.some(provider =>
    provider.keys.filter(key => key.required).every(key => keyConfigured(key, env)))
}

function apiSpecStatus(skill, env) {
  const spec = SKILL_API_REQUIREMENTS[skill]
  const keyStatus = key => {
    const raw = env[key.env] ?? ''
    return {
      env: key.env,
      label: key.label,
      required: key.required,
      secret: key.secret,
      choices: [...(key.choices ?? [])],
      configured: keyConfigured(key, env),
      masked: key.secret ? (isSet(raw) ? maskValue(raw) : '') : raw,
    }
  }
  return {
    label: spec.label,
    settings: (spec.settings ?? []).map(keyStatus),
    providers: spec.providers.map(provider =>
      ({ id: provider.id, name: provider.name, keys: provider.keys.map(keyStatus) })),
  }
}

async function apiEnvSave(c) {
  const body = await c.body()
  const updates = body !== null && typeof body === 'object' && body.updates !== null && typeof body.updates === 'object' ? body.updates : {}
  const bad = Object.keys(updates).filter(key => !ENV_ALLOWLIST.has(key))
  if (bad.length > 0) throw new ApiError(400, `不允许写入的变量：${bad.join(', ')}`)
  const envFile = join(c.settings.projectRoot, '.env')
  await writeEnvFile(envFile, updates)
  const env = await readEnvFile(envFile)
  const skills = {}
  for (const name of Object.keys(SKILL_API_REQUIREMENTS)) skills[name] = skillApiConfigured(name, env)
  return { json: { ok: true, skills } }
}

// ---- 画像（profiles/<name>/*.md）----

const validPersonaName = name => typeof name === 'string' && name.length > 0
  && !name.startsWith('.') && !name.startsWith('_')
  && !/[/\\:]/.test(name)
  && ![...name].some(ch => ch.charCodeAt(0) < 32)

function personaDir(settings, name) {
  return { root: resolve(settings.projectRoot, 'profiles'), dir: resolve(settings.projectRoot, 'profiles', name) }
}

async function listPersonas(settings) {
  const profiles = join(settings.projectRoot, 'profiles')
  const entries = await readdir(profiles, { withFileTypes: true }).catch(() => [])
  const result = []
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (!entry.isDirectory() || !validPersonaName(entry.name)) continue
    let description = ''
    try {
      const identity = await readFile(join(profiles, entry.name, 'identity.md'), 'utf8')
      for (const raw of identity.split(/\r?\n/)) {
        const line = raw.trim()
        if (line && !line.startsWith('#') && !line.startsWith('<!--')) {
          description = line.slice(0, 80)
          break
        }
      }
    } catch { /* 无 identity.md → 空描述 */ }
    result.push({ name: entry.name, description })
  }
  return result
}

async function apiPersonaFiles(c) {
  // profile_exists（valid && isdir）为假一律 404——与 web/app.py 一致。
  const { dir } = personaDir(c.settings, c.params.name)
  if (!validPersonaName(c.params.name) || !(await isDirectory(dir))) throw new ApiError(404, '画像不存在')
  const ordered = new Set(PROFILE_FILE_ORDER)
  const rest = (await readdir(dir)).filter(name => name.endsWith('.md') && !ordered.has(name)).sort()
  const files = []
  for (const filename of [...PROFILE_FILE_ORDER, ...rest]) {
    let content = ''
    try {
      content = await readFile(join(dir, filename), 'utf8')
    } catch { /* 六维文件可缺失 → 空串 */ }
    files.push({ filename, content })
  }
  return { json: { name: c.params.name, files } }
}

async function apiPersonaSave(c) {
  const { root, dir } = personaDir(c.settings, c.params.name)
  if (!validPersonaName(c.params.name) || !(await isDirectory(dir))) throw new ApiError(404, '画像不存在')
  const body = await c.body()
  const filename = typeof body?.filename === 'string' ? body.filename : ''
  const content = typeof body?.content === 'string' ? body.content : ''
  if (!filename.endsWith('.md') || filename.includes('/') || filename.includes('\\') || filename.startsWith('.')) {
    throw new ApiError(400, '文件名非法')
  }
  const fp = resolve(dir, filename)
  if (dirname(fp) !== dir || !dir.startsWith(root + sep)) throw new ApiError(403, '非法路径')
  const tmp = `${fp}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, fp)
  return { json: { ok: true, filename } }
}

async function apiPersonaDelete(c) {
  const { root, dir } = personaDir(c.settings, c.params.name)
  if (!validPersonaName(c.params.name)) throw new ApiError(400, '画像名非法')
  if (!dir.startsWith(root + sep) || !(await isDirectory(dir))) throw new ApiError(404, '画像不存在')
  await rm(dir, { recursive: true, force: true })
  return { json: { ok: true, deleted: c.params.name } }
}

// ---- 技能（skills/openclaw/*/SKILL.md）----

/**
 * 解析 SKILL.md → {description, layer, body}。正确处理 YAML 块标量 description
 * （`>` / `|` 后跟缩进多行）——与 web/app.py `_parse_skill_md` 同语义。
 */
function parseSkillMd(text) {
  let description = ''
  let layer = ''
  let body = text
  const lines = text.split(/\r?\n/)
  if (!(lines.length > 0 && lines[0].trim() === '---')) return { description, layer, body }
  let end = null
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end === null) return { description, layer, body }
  body = lines.slice(end + 1).join('\n').trim()
  const fm = lines.slice(1, end)
  for (let i = 0; i < fm.length; i++) {
    const line = fm[i].trim()
    if (line.startsWith('layer:')) {
      layer = line.slice(6).trim().replace(/^["']|["']$/g, '')
    } else if (line.startsWith('description:')) {
      const value = line.slice(12).trim()
      if (value.startsWith('|') || value.startsWith('>')) {
        const block = []
        let j = i + 1
        while (j < fm.length) {
          if (fm[j].trim() === '') {
            block.push('')
            j++
            continue
          }
          const indent = fm[j].length - fm[j].replace(/^\s+/, '').length
          if (indent === 0) break
          block.push(fm[j].trim())
          j++
        }
        description = block.filter(part => part).join(' ').trim()
        i = j - 1
      } else {
        description = value.replace(/^["']|["']$/g, '')
      }
    }
  }
  return { description, layer, body }
}

async function findSkill(settings, name) {
  const candidates = name.startsWith('skill-') ? [name] : [name, `skill-${name}`]
  for (const candidate of candidates) {
    if (existsSync(join(settings.skillsDir, candidate, 'SKILL.md'))) return candidate
  }
  return null
}

async function getSkills(settings) {
  const env = await readEnvFile(join(settings.projectRoot, '.env'))
  const entries = await readdir(settings.skillsDir, { withFileTypes: true }).catch(() => [])
  const result = []
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (!entry.isDirectory()) continue
    let text = ''
    try {
      text = await readFile(join(settings.skillsDir, entry.name, 'SKILL.md'), 'utf8')
    } catch {
      continue
    }
    const { description, layer } = parseSkillMd(text)
    const needsApi = Object.hasOwn(SKILL_API_REQUIREMENTS, entry.name)
    result.push({
      name: entry.name,
      description,
      layer,
      needsApi,
      apiConfigured: needsApi ? skillApiConfigured(entry.name, env) : true,
    })
  }
  return result
}

async function apiStatus(c) {
  const [skills, personas] = await Promise.all([getSkills(c.settings), listPersonas(c.settings)])
  // dsh 自己就是对话运行时：网关恒在线；transport 标 'dsh'（前端 apiDirect 判 'api'，保持 false）。
  // projectRoot 供 client 半的 pushTask 决定会话工作目录（agent 的文件工具由此读写仓库）。
  return { json: { gateway: true, transport: 'dsh', projectRoot: c.settings.projectRoot, skills, personas } }
}

async function apiSkillDetail(c) {
  const full = await findSkill(c.settings, c.params.name)
  if (full === null) throw new ApiError(404, `SKILL '${c.params.name}' 不存在`)
  let text = ''
  try {
    text = await readFile(join(c.settings.skillsDir, full, 'SKILL.md'), 'utf8')
  } catch { /* 上面 findSkill 已确认存在，竞态时降级为空 */ }
  const { description, layer, body } = parseSkillMd(text)
  const needsApi = Object.hasOwn(SKILL_API_REQUIREMENTS, full)
  const env = await readEnvFile(join(c.settings.projectRoot, '.env'))
  return {
    json: {
      name: full,
      layer,
      description,
      body,
      needsApi,
      apiConfigured: needsApi ? skillApiConfigured(full, env) : true,
      apiSpec: needsApi ? apiSpecStatus(full, env) : null,
    },
  }
}

// ---- 内容库（outputs/）----

async function buildOutputNode(path, rel) {
  const found = await pathStat(path)
  if (found === null) return { name: basename(path), path: rel, kind: 'binary', mtime: 0, size: 0, type: 'file' }
  if (!found.isDirectory()) {
    return {
      name: basename(path), path: rel, type: 'file', kind: fileKind(basename(path)),
      mtime: Math.floor(found.mtimeMs / 1000), size: found.size,
    }
  }
  const entries = await readdir(path, { withFileTypes: true })
  const visible = entries.filter(entry => !entry.name.startsWith('.'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const children = []
  for (const entry of visible) children.push(await buildOutputNode(join(path, entry.name), `${rel}/${entry.name}`))
  const own = Math.floor(found.mtimeMs / 1000)
  const mtime = children.length > 0 ? children.reduce((max, node) => Math.max(max, node.mtime ?? 0), 0) : own
  const fileCount = children.reduce((count, node) => count + (node.type === 'dir' ? (node.fileCount ?? 1) : 1), 0)
  return { name: basename(path), type: 'dir', path: rel, mtime, children, fileCount }
}

async function readProjectMeta(projDir, projName) {
  // .easel.json 展示头：只取展示字段；cover 解析优先级 声明 → 首个成品媒体 → 首媒体。
  const data = await readJsonFile(join(projDir, '.easel.json'), null)
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null
  const meta = {}
  for (const key of ['title', 'summary', 'platform', 'kind', 'status', 'tags', 'deliverables']) {
    const value = data[key]
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue
    meta[key] = value
  }
  if (Object.keys(meta).length === 0) return null
  const deliverables = Array.isArray(data.deliverables) ? data.deliverables : []
  let cover = ''
  if (data.cover && await isFile(join(projDir, data.cover))) cover = `${projName}/${data.cover}`
  if (!cover) {
    for (const name of deliverables) {
      if (['image', 'video'].includes(fileKind(name)) && await isFile(join(projDir, name))) {
        cover = `${projName}/${name}`
        break
      }
    }
  }
  if (cover) meta.cover = cover
  meta.deliverablePaths = []
  for (const name of deliverables) {
    if (await isFile(join(projDir, name))) meta.deliverablePaths.push(`${projName}/${name}`)
  }
  return meta
}

async function getOutputTree(settings) {
  const outputs = join(settings.projectRoot, 'outputs')
  const entries = await readdir(outputs, { withFileTypes: true }).catch(() => [])
  const items = []
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
    if (!entry.isDirectory() || entry.name === 'analytics') continue
    const node = await buildOutputNode(join(outputs, entry.name), entry.name)
    const meta = await readProjectMeta(join(outputs, entry.name), entry.name)
    if (meta !== null) node.meta = meta
    items.push(node)
  }
  return items.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
}

async function safeOutputPath(settings, rel) {
  const root = resolve(settings.projectRoot, 'outputs')
  const full = resolve(root, rel)
  if (full !== root && !full.startsWith(root + sep)) throw new ApiError(403, '非法路径')
  if (!(await isFile(full))) throw new ApiError(404, '文件不存在')
  return full
}

async function apiOutputContent(c) {
  const full = await safeOutputPath(c.settings, c.params.path)
  const kind = fileKind(basename(full))
  if (kind !== 'text') return { json: { path: c.params.path, content: '', kind, isBinary: true } }
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(full))
    return { json: { path: c.params.path, content, kind: 'text', isBinary: false } }
  } catch {
    return { json: { path: c.params.path, content: '', kind: 'binary', isBinary: true } }
  }
}

async function apiMedia(c) {
  const full = await safeOutputPath(c.settings, c.params.path)
  const ext = extname(full).toLowerCase()
  const headers = {}
  const type = MEDIA_TYPES[ext]
  if (type !== undefined) headers['content-type'] = type
  // HTML 预览会被就地重生成（gzh-design 重排/内联），必须禁缓存，否则 iframe 开到过期版本。
  if (ext === '.html' || ext === '.htm') {
    headers['cache-control'] = 'no-cache, no-store, must-revalidate'
    headers.pragma = 'no-cache'
  }
  return { file: full, headers, range: c.headers?.range }
}

// EASEL-DIVERGENCE(easel-media-renderer): 侧栏媒体渲染器的流源。/easel/api/media 被
// safeOutputPath 钉死在 outputs/ 下，而会话工作区遍布 projects/<项目>/…；本路由以
// projectRoot 为域，守卫同款（根前缀 + isFile），流式交给 streamFile（单 Range）。
async function apiWorkspaceMedia(c) {
  const rel = c.params.path
  if (!rel) throw new ApiError(404, '文件不存在')
  const root = resolve(c.settings.projectRoot)
  const full = resolve(root, rel)
  if (full !== root && !full.startsWith(root + sep)) throw new ApiError(403, '非法路径')
  const ext = extname(full).toLowerCase()
  if (!PLAYABLE_MEDIA_EXTS.has(ext)) throw new ApiError(404, '文件不存在')
  if (!(await isFile(full))) throw new ApiError(404, '文件不存在')
  const headers = {}
  const type = MEDIA_TYPES[ext]
  if (type !== undefined) headers['content-type'] = type
  return { file: full, headers, range: c.headers?.range }
}

async function apiOutputDelete(c) {
  const root = resolve(c.settings.projectRoot, 'outputs')
  const full = resolve(root, c.params.path)
  if (full === root || !full.startsWith(root + sep)) throw new ApiError(403, '非法路径')
  const found = await pathStat(full)
  if (found === null) throw new ApiError(404, '不存在')
  const first = relative(root, full).split(sep)[0]
  if (first.startsWith('_') || first.startsWith('.') || PROTECTED_OUTPUTS.has(first)
    || ['analytics', 'wechat'].includes(first.toLowerCase())) {
    throw new ApiError(403, '系统数据受保护，不可从内容库删除')
  }
  const wasDir = found.isDirectory()
  await rm(full, { recursive: true })
  return { json: { ok: true, deleted: c.params.path, kind: wasDir ? 'dir' : 'file' } }
}

// ---- 热点雷达配置 / 选题 / 排期（outputs 下的 JSON store）----

const RADAR_SOURCE_KINDS = new Set(['rss', 'json'])
export const SCHEDULE_FILE = '_schedule.json'
const IDEAS_FILE = '_ideas.json'
const RADAR_CONFIG_FILE = '_radar_config.json'
const RADAR_HISTORY_FILE = '_radar_history.json'
const SCHEDULE_STATUSES = new Set(['idea', 'draft', 'scheduled', 'published'])
const SCHEDULE_KINDS = new Set(['content', 'event'])
const SCHEDULE_SOURCES = new Set(['manual', 'publish-page', 'chat', 'scheduler'])
// 'project' = 已立项（easel-single-workspace D3）：缺了它立项状态会被下面的
// 更新路由静默回退，选题刷新后跳回原列（2026-10-17 勘察实证）。
const IDEA_STATUSES = new Set(['pending', 'doing', 'project', 'done'])

export async function readStoreList(settings, file) {
  const value = await readJsonFile(join(settings.projectRoot, 'outputs', file), null)
  return Array.isArray(value) ? value : []
}

export async function readRadarConfig(settings) {
  const cfg = { proxyUrl: '', proxyEnabled: false, cdpEndpoint: 'http://127.0.0.1:9222', sources: [], keywords: [] }
  const raw = await readJsonFile(join(settings.projectRoot, 'outputs', RADAR_CONFIG_FILE), null)
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return cfg
  if (typeof raw.proxyUrl === 'string') cfg.proxyUrl = raw.proxyUrl.trim()
  cfg.proxyEnabled = raw.proxyEnabled === true && cfg.proxyUrl.length > 0
  if (typeof raw.cdpEndpoint === 'string' && raw.cdpEndpoint.trim()) cfg.cdpEndpoint = raw.cdpEndpoint.trim()
  cfg.keywords = normalizeKeywords(raw.keywords)
  const sources = []
  for (const item of Array.isArray(raw.sources) ? raw.sources : []) {
    if (item === null || typeof item !== 'object') continue
    const name = String(item.name ?? '').trim().slice(0, 40)
    const url = String(item.url ?? '').trim()
    const kind = String(item.kind ?? 'rss').trim().toLowerCase()
    if (!name || !url || !RADAR_SOURCE_KINDS.has(kind)) continue
    const category = String(item.category ?? '自定义').trim().slice(0, 20)
    sources.push({ name, url, kind, category: category || '自定义', enabled: item.enabled !== false })
  }
  cfg.sources = sources
  return cfg
}

async function apiRadarConfigGet(c) {
  const cfg = await readRadarConfig(c.settings)
  return { json: { proxyUrl: cfg.proxyUrl, proxyEnabled: cfg.proxyEnabled, cdpEndpoint: cfg.cdpEndpoint, proxyEnv: process.env.EASEL_PROXY ?? '', sources: cfg.sources, keywords: cfg.keywords } }
}

async function apiRadarConfigSet(c) {
  const body = await c.body()
  const proxyUrl = String(body?.proxyUrl ?? '').trim()
  const cdp = typeof body?.cdpEndpoint === 'string' && body.cdpEndpoint.trim() ? body.cdpEndpoint.trim() : 'http://127.0.0.1:9222'
  const keywords = normalizeKeywords(body?.keywords)
  const sources = (Array.isArray(body?.sources) ? body.sources : []).map(item => ({
    name: String(item?.name ?? ''),
    url: String(item?.url ?? ''),
    kind: String(item?.kind ?? 'rss'),
    category: String(item?.category ?? '自定义'),
    enabled: item?.enabled !== false,
  }))
  await writeJsonFile(join(c.settings.projectRoot, 'outputs', RADAR_CONFIG_FILE), {
    proxyUrl,
    proxyEnabled: body?.proxyEnabled === true && proxyUrl.length > 0,
    cdpEndpoint: cdp,
    keywords,
    sources,
  })
  return { json: { ok: true } }
}

async function apiIdeasList(c) {
  return { json: await readStoreList(c.settings, IDEAS_FILE) }
}

// _ideas.json 的读改写串行队列：选题 CRUD、立项置位与热点正文入库都会改这
// 一个文件，并发交织会互相覆盖丢条目。队列保证同一进程内一次只有一个写者。
let ideasQueue = Promise.resolve()
export async function mutateIdeas(settings, mutator) {
  const run = ideasQueue.then(async () => {
    const result = await mutator(await readStoreList(settings, IDEAS_FILE))
    if (Array.isArray(result.items)) {
      await writeJsonFile(join(settings.projectRoot, 'outputs', IDEAS_FILE), result.items)
    }
    return result
  })
  ideasQueue = run.catch(() => {})
  return run
}

async function apiIdeasCreate(c) {
  const body = await c.body()
  const item = {
    id: randomBytes(6).toString('hex'),
    title: String(body?.title ?? '').trim() || '未命名选题',
    note: String(body?.note ?? ''),
    source: String(body?.source ?? ''),
    status: IDEA_STATUSES.has(body?.status) ? body.status : 'pending',
    created: Math.floor(Date.now() / 1000),
  }
  const { json } = await mutateIdeas(c.settings, items => ({ items: [item, ...items], json: item }))
  return { json }
}

async function apiIdeasUpdate(c) {
  const body = await c.body()
  const { json } = await mutateIdeas(c.settings, (items) => {
    const item = items.find(entry => entry.id === c.params.iid)
    if (item === undefined) throw new ApiError(404, '选题不存在')
    Object.assign(item, {
      title: String(body?.title ?? '').trim() || (typeof item.title === 'string' && item.title ? item.title : '未命名选题'),
      note: String(body?.note ?? ''),
      source: String(body?.source ?? ''),
      status: IDEA_STATUSES.has(body?.status) ? body.status : (typeof item.status === 'string' && item.status ? item.status : 'pending'),
    })
    return { items, json: item }
  })
  return { json }
}

async function apiIdeasDelete(c) {
  const { json } = await mutateIdeas(c.settings, (items) => {
    const rest = items.filter(entry => entry.id !== c.params.iid)
    if (rest.length === items.length) throw new ApiError(404, '选题不存在')
    return { items: rest, json: { ok: true, deleted: c.params.iid } }
  })
  return { json }
}

async function apiScheduleList(c) {
  return { json: await readStoreList(c.settings, SCHEDULE_FILE) }
}

async function apiScheduleCreate(c) {
  const body = await c.body()
  const items = await readStoreList(c.settings, SCHEDULE_FILE)
  const kind = SCHEDULE_KINDS.has(body?.kind) ? body.kind : 'content'
  const item = {
    id: randomBytes(6).toString('hex'),
    title: String(body?.title ?? '').trim() || (kind === 'event' ? '未命名活动' : '未命名'),
    date: String(body?.date ?? ''),
    platform: String(body?.platform ?? ''),
    time: String(body?.time ?? ''),
    status: SCHEDULE_STATUSES.has(body?.status) ? body.status : 'idea',
    note: String(body?.note ?? ''),
    kind,
    url: String(body?.url ?? ''),
    source: SCHEDULE_SOURCES.has(body?.source) ? body.source : 'manual',
    event_type: String(body?.event_type ?? ''),
    end_date: String(body?.end_date ?? ''),
    repeat: body?.repeat === 'yearly' ? 'yearly' : '',
  }
  items.push(item)
  await writeJsonFile(join(c.settings.projectRoot, 'outputs', SCHEDULE_FILE), items)
  return { json: item }
}

async function apiScheduleUpdate(c) {
  const body = await c.body()
  const items = await readStoreList(c.settings, SCHEDULE_FILE)
  const item = items.find(entry => entry.id === c.params.sid)
  if (item === undefined) throw new ApiError(404, '排期不存在')
  // 注意：与 web/app.py 一致，更新不回写 source（来源在创建时定格）。
  Object.assign(item, {
    title: String(body?.title ?? '').trim() || (typeof item.title === 'string' && item.title ? item.title : '未命名'),
    date: String(body?.date ?? ''),
    platform: String(body?.platform ?? ''),
    time: String(body?.time ?? ''),
    status: SCHEDULE_STATUSES.has(body?.status) ? body.status : (typeof item.status === 'string' && item.status ? item.status : 'idea'),
    note: String(body?.note ?? ''),
    kind: SCHEDULE_KINDS.has(body?.kind) ? body.kind : (typeof item.kind === 'string' && item.kind ? item.kind : 'content'),
    url: String(body?.url ?? ''),
    event_type: String(body?.event_type ?? ''),
    end_date: String(body?.end_date ?? ''),
    // repeat 仅 yearly 合法；旧调用方不带该字段时保留原值，显式空串清除
    repeat: body?.repeat === 'yearly' ? 'yearly'
      : (body?.repeat === undefined && typeof item.repeat === 'string' ? item.repeat : ''),
  })
  await writeJsonFile(join(c.settings.projectRoot, 'outputs', SCHEDULE_FILE), items)
  return { json: item }
}

async function apiScheduleDelete(c) {
  const items = await readStoreList(c.settings, SCHEDULE_FILE)
  const rest = items.filter(entry => entry.id !== c.params.sid)
  if (rest.length === items.length) throw new ApiError(404, '排期不存在')
  await writeJsonFile(join(c.settings.projectRoot, 'outputs', SCHEDULE_FILE), rest)
  return { json: { ok: true, deleted: c.params.sid } }
}

// ---- 热点榜（内置源 + 自定义 RSS/JSON 源，300s 缓存，支持应用内代理）----

const TREND_SOURCES = {
  weibo: ['https://v2.xxapi.cn/api/weibohot', 'https://60s.viki.moe/v2/weibo'],
  douyin: ['https://v2.xxapi.cn/api/douyinhot', 'https://60s.viki.moe/v2/douyin'],
  zhihu: ['https://api.zhihu.com/topstory/hot-list?limit=50', 'https://60s.viki.moe/v2/zhihu'],
  bilibili: ['https://v2.xxapi.cn/api/bilibilihot', 'https://60s.viki.moe/v2/bili'],
  baidu: ['https://v2.xxapi.cn/api/baiduhot', 'https://60s.viki.moe/v2/baidu/hot'],
  toutiao: ['https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', 'https://60s.viki.moe/v2/toutiao'],
}
const TREND_LABELS = { weibo: '微博', douyin: '抖音', zhihu: '知乎', bilibili: 'B站', baidu: '百度', toutiao: '头条' }
const TREND_CACHE = new Map()
const HOT_TITLE_KEYS = ['title', 'Title', 'word', 'name', 'keyword']
const HOT_HOT_KEYS = ['hot', 'hot_value', 'HotValue', 'hotValue', 'num', 'detail_text']
const HOT_URL_KEYS = ['url', 'Url', 'link', 'mobil_url']
const FETCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36'

function pickStr(data, keys) {
  if (data === null || typeof data !== 'object') return ''
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function trendWebUrl(url) {
  const match = /^https?:\/\/api\.zhihu\.com\/questions\/(\d+)$/.exec(url)
  return match !== null ? `https://www.zhihu.com/question/${match[1]}` : url
}

export function parseHotJson(payload) {
  let data = payload !== null && typeof payload === 'object' ? payload.data : null
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    data = data.data ?? data.list ?? []
  }
  const out = []
  if (!Array.isArray(data)) return out
  for (const item of data) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ title: item.trim(), hot: '', url: '' })
      continue
    }
    if (item === null || typeof item !== 'object') continue
    const target = item.target !== null && typeof item.target === 'object' ? item.target : {}
    const title = pickStr(item, HOT_TITLE_KEYS) || pickStr(target, HOT_TITLE_KEYS)
    if (!title) continue
    const hot = pickStr(item, HOT_HOT_KEYS) || pickStr(target.metrics_area, ['text'])
    const url = pickStr(item, HOT_URL_KEYS) || pickStr(target, HOT_URL_KEYS)
    out.push({ title, hot, url: trendWebUrl(url) })
  }
  return out
}

function unwrapCdata(text) {
  const match = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(text)
  return (match !== null ? match[1] : text).trim()
}

function unescapeXml(text) {
  // ponytail: 五个具名实体 + 数字实体，覆盖 RSS 标题足够；完整 XML 解析器等真碰到再换。
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function tagValue(block, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block)
  return match !== null ? unescapeXml(unwrapCdata(match[1])) : ''
}

/** 解析 RSS 2.0 / Atom（RSSHub 等）→ [{title, hot, url}]。 */
export function parseRssItems(text) {
  const cleaned = text.replace(/^﻿/, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  const items = []
  for (const block of cleaned.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/g)) {
    const body = block[1]
    const title = tagValue(body, 'title')
    if (!title) continue
    let url = tagValue(body, 'link')
    if (!url) {
      const href = /<link(?:\s[^>]*)?href="([^"]+)"/.exec(body)
      url = href !== null ? unescapeXml(href[1]) : ''
    }
    items.push({ title, hot: tagValue(body, 'hot') || tagValue(body, 'hot_value'), url })
  }
  return items
}

/**
 * GET 一个 URL，可选走正向代理（http 目标用绝对 URI；https 目标先 CONNECT 隧道再 TLS）。
 * @returns {Promise<{status: number, body: Buffer}>}
 */
function rawRequest(urlStr, { timeout = 8000, headers = {}, proxyUrl = '' } = {}) {
  return new Promise((resolveRequest, rejectRequest) => {
    const target = new URL(urlStr)
    const send = (overrides = {}, extra = {}) => {
      const options = {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method: 'GET',
        path: `${target.pathname}${target.search}`,
        headers: { 'user-agent': FETCH_UA, ...headers },
        timeout,
        ...overrides,
        ...extra,
      }
      const transport = options.protocol === 'https:' ? httpsRequest : httpRequest
      const request = transport(options, answer => {
        const chunks = []
        let total = 0
        answer.on('data', chunk => {
          total += chunk.length
          if (total > 20 * 1024 * 1024) {
            request.destroy(new Error('响应过大'))
            return
          }
          chunks.push(chunk)
        })
        answer.on('end', () => resolveRequest({ status: answer.statusCode ?? 0, headers: answer.headers ?? {}, body: Buffer.concat(chunks) }))
        answer.on('error', rejectRequest)
      })
      request.on('timeout', () => request.destroy(new Error('timeout')))
      request.on('error', rejectRequest)
      request.end()
    }
    if (!proxyUrl) {
      send()
      return
    }
    const proxy = new URL(proxyUrl)
    if (target.protocol === 'http:') {
      // 正向代理取 http 目标：请求行直接写绝对 URI（RFC 7230 §5.3.2）。
      send({
        hostname: proxy.hostname,
        port: proxy.port || 80,
        path: urlStr,
        headers: { 'user-agent': FETCH_UA, ...headers, host: target.host },
      })
      return
    }
    // https 目标：先 CONNECT 隧道，再在隧道上跑 TLS + 请求。
    const tunnel = net.connect({ host: proxy.hostname, port: Number(proxy.port || 80) })
    const fail = error => {
      tunnel.destroy()
      rejectRequest(error)
    }
    tunnel.setTimeout(timeout, fail)
    tunnel.once('error', fail)
    const head = []
    tunnel.on('data', function onData(chunk) {
      head.push(chunk)
      const text = Buffer.concat(head).toString('latin1')
      const end = text.indexOf('\r\n\r\n')
      if (end === -1) return
      tunnel.removeListener('data', onData)
      tunnel.removeListener('error', fail)
      tunnel.setTimeout(0)
      if (!/^HTTP\/1\.[01] 200/.test(text)) {
        fail(new Error(text.split('\r\n')[0]))
        return
      }
      const tlsSocket = tls.connect({ socket: tunnel, servername: target.hostname })
      tlsSocket.once('error', rejectRequest)
      send({}, { createConnection: () => tlsSocket })
    })
  })
}

async function fetchText(url, proxyUrl, timeout, accept) {
  const { status, body } = await rawRequest(url, { timeout, proxyUrl, headers: { accept } })
  if (!(status >= 200 && status < 300)) throw new Error(`HTTP ${status}`)
  return body.toString('utf8')
}

async function fetchPlatformTrend(platform, proxyUrl) {
  for (const url of TREND_SOURCES[platform] ?? []) {
    try {
      const { status, body } = await rawRequest(url, { timeout: 8000, proxyUrl, headers: { accept: 'application/json, text/plain, */*' } })
      if (!(status >= 200 && status < 300)) continue
      const items = parseHotJson(JSON.parse(body.toString('utf8')))
      if (items.length > 0) return items
    } catch { /* 主源失败 → 试备用源 */ }
  }
  return []
}

async function fetchCustomSource(src, proxyUrl) {
  if (src.kind === 'json') {
    const { status, body } = await rawRequest(src.url, { timeout: 8000, proxyUrl, headers: { accept: 'application/json, text/plain, */*' } })
    if (!(status >= 200 && status < 300)) throw new Error(`HTTP ${status}`)
    return parseHotJson(JSON.parse(body.toString('utf8')))
  }
  return parseRssItems(await fetchText(src.url, proxyUrl, 10000, 'application/rss+xml, application/xml, text/xml, */*'))
}

// 离线兜底的快照年龄上限：更旧的热榜宁可空着，不冒充实时数据。
const TREND_STALE_MAX_AGE_SECONDS = 24 * 60 * 60

/**
 * 单个源的取数链（spec easel-hotspot-radar §D2）：新鲜缓存 → 抓取并合并轨迹 →
 * 失败时回退内存/落盘快照（≤24h，标 stale）→ 空。
 * @returns {Promise<{at: number|undefined, items: object[], entries?: object[], stale: boolean, ok: boolean}>}
 */
async function loadTrendSource({ now, force, cached, prev, fetcher }) {
  if (cached !== undefined && !force && now - cached.at < 300) {
    return { at: cached.at, items: cached.items, stale: false, ok: true }
  }
  let fresh = null
  try {
    const fetched = await fetcher()
    if (fetched.length > 0) {
      const { items, entries } = decorateFetched(prev, fetched, now)
      fresh = { at: Math.floor(now), items, entries, stale: false, ok: true }
    }
  } catch { /* 抓取失败 → 走降级链 */ }
  if (fresh !== null) return fresh
  if (cached !== undefined && now - cached.at <= TREND_STALE_MAX_AGE_SECONDS) {
    return { at: cached.at, items: cached.items, stale: true, ok: true }
  }
  const disk = staleItemsFromHistory(prev, now)
  if (disk !== null) return { at: prev.at, items: disk, stale: true, ok: true }
  return { at: undefined, items: [], stale: false, ok: false }
}

/** 响应条目：剥掉内部字段（key/firstSeen 只服务聚类与徽标计算）。 */
function trendPayload(items, limit) {
  return items.slice(0, limit).map(({ key, firstSeen, ...rest }) => rest)
}

async function apiTrends(c) {
  const platforms = c.query.get('platforms') ?? 'weibo,douyin,zhihu'
  const view = c.query.get('view') === 'cluster' ? 'cluster' : 'list'
  const force = c.query.get('force') === '1'
  const limitRaw = Number(c.query.get('limit'))
  const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 12, 30))
  const cfg = await readRadarConfig(c.settings)
  const proxyUrl = cfg.proxyEnabled ? cfg.proxyUrl : ''
  const now = Date.now() / 1000
  const history = await readRadarHistory(c.settings.projectRoot, path => readJsonFile(path, null))
  const result = []
  const decoratedGroups = []
  let historyDirty = false
  const sources = [
    ...platforms.split(',').map(p => p.trim()).filter(p => p in TREND_SOURCES)
      .map(platform => ({ key: platform, label: TREND_LABELS[platform] ?? platform, fetcher: () => fetchPlatformTrend(platform, proxyUrl) })),
    // 自定义源与内置源同缓存同出口；失败降级 ok:false，绝不因一条源炸掉整页。
    ...cfg.sources.filter(src => src.enabled).map(src => ({
      key: `custom:${src.name}`, label: src.name, category: src.category,
      fetcher: () => fetchCustomSource(src, proxyUrl),
    })),
  ]
  for (const source of sources) {
    const cached = TREND_CACHE.get(source.key)
    const prev = history.sources[source.key] ?? null
    const loaded = await loadTrendSource({ now, force, cached, prev, fetcher: source.fetcher })
    if (loaded.entries !== undefined) {
      history.sources[source.key] = pruneSnapshot({ at: loaded.at, items: loaded.entries }, now)
      historyDirty = true
      TREND_CACHE.set(source.key, { at: loaded.at, items: loaded.items })
    }
    // 关注匹配作用于完整榜单（不是截断后的可见切片），关注组自己再截 10 条。
    applyWatch(loaded.items, cfg.keywords)
    decoratedGroups.push({ platform: source.key, label: source.label, items: loaded.items })
    result.push({
      platform: source.key,
      label: source.label,
      ...(source.category !== undefined ? { category: source.category } : {}),
      ...(loaded.at !== undefined ? { at: loaded.at } : {}),
      ...(loaded.stale ? { stale: true } : {}),
      ok: loaded.ok,
      items: trendPayload(loaded.items, limit),
    })
  }
  if (historyDirty) {
    try {
      await writeJsonFile(join(c.settings.projectRoot, 'outputs', RADAR_HISTORY_FILE), history)
    } catch { /* 轨迹是缓存，写失败只丢徽标，不影响本次响应 */ }
  }
  const ats = result.map(group => group.at).filter(at => typeof at === 'number')
  return {
    json: {
      trends: result,
      updated: ats.length > 0 ? Math.max(...ats) : Math.floor(now),
      watch: buildWatchGroups(decoratedGroups),
      ...(view === 'cluster' ? { clusters: clusterTrends(decoratedGroups) } : {}),
    },
  }
}

// ---- 右键抓取正文（spec easel-hotspot-radar §D6）：正文进内容库，选题进 _ideas.json ----

const ARTICLE_FETCH_TIMEOUT_MS = 15_000
const ARTICLE_MAX_BYTES = 5 * 1024 * 1024

async function fetchArticlePage(url, { proxyUrl }) {
  const { status, headers, body } = await rawRequest(url, {
    timeout: ARTICLE_FETCH_TIMEOUT_MS,
    proxyUrl,
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9',
    },
  })
  if (body.length > ARTICLE_MAX_BYTES) throw new Error('页面过大')
  return { status, headers, body }
}

const captureArticle = createCaptureHandler({
  fetchPage: fetchArticlePage,
  lookupHost: dnsLookup,
  io: {
    writeText: async (path, content) => {
      await mkdir(dirname(path), { recursive: true })
      const tmp = `${path}.tmp`
      await writeFile(tmp, content, 'utf8')
      await rename(tmp, path)
    },
    mutateIdeas,
    readIdeas: async (settings) => readStoreList(settings, IDEAS_FILE),
    proxyUrl: async (settings) => {
      const cfg = await readRadarConfig(settings)
      return cfg.proxyEnabled ? cfg.proxyUrl : ''
    },
  },
})

async function apiRadarArticle(c) {
  try {
    return await captureArticle(c)
  } catch (error) {
    if (error instanceof RadarArticleError) throw new ApiError(error.status, error.detail)
    throw error
  }
}

// ---- 账号/登录/发布状态（文件协议；登录与发布的「启动」在 B2 前仍走代理）----

export const LOGIN_RUNNERS = {
  xiaohongshu: { name: '小红书', backend: 'xhs', profile: 'XiaohongshuProfile' },
  kuaishou: { name: '快手', backend: 'web', wp: 'kuaishou', profile: 'KuaishouProfile' },
  'weixin-channels': { name: '微信视频号', backend: 'web', wp: 'weixin-channels', profile: 'ChannelsProfile' },
  zhihu: { name: '知乎', backend: 'web', wp: 'zhihu', profile: 'ZhihuProfile' },
  bilibili: { name: 'B站', backend: 'biliup' },
  douyin: { name: '抖音', backend: 'douyin', profile: 'DouyinProfile' },
  // 微信公众号：扫码登录后台会话（发布+数据都走它），backend=='wechat-oa' 各处单独分支。
  'wechat-oa': { name: '微信公众号', backend: 'wechat-oa' },
}
export const ANALYTICS_PLATFORMS = new Set(['xiaohongshu', 'douyin', 'kuaishou', 'zhihu', 'weixin-channels', 'bilibili', 'wechat-oa'])


// ---- 画像构建：基线（确定性，宿主半直写）；AI 增强由向导页推 dsh 会话（方案 B）----

async function apiProfileBuild(c) {
  const body = await c.body()
  const name = String(body?.name ?? '').trim()
  const form = body?.form !== null && typeof body?.form === 'object' ? body.form : {}
  if (!name) throw new ApiError(400, '画像名不能为空（去掉首尾空格后为空，请输入有效名称）')
  if (name.includes('/') || name.includes('\\')) throw new ApiError(400, '画像名不能包含 / 或 \\ 字符，请改掉后重试')
  if (name.startsWith('.') || name.startsWith('_')) throw new ApiError(400, '画像名不能以 . 或 _ 开头，请换个开头')
  const pd = join(c.settings.projectRoot, 'profiles', name)
  if (existsSync(pd)) throw new ApiError(409, `画像「${name}」已存在，请换一个名字`)
  await writeBaselineProfile(c.settings, name, form)
  return { json: { created: true, name, async: false } }
}

function formField(form, key, fallback = '') {
  const value = form[key]
  if (Array.isArray(value)) return value.length > 0 ? value.join('、') : fallback
  return value !== null && value !== undefined && String(value).trim() !== '' ? String(value).trim() : fallback
}

async function writeBaselineProfile(settings, name, form) {
  // 从表单确定性生成六维基线（与 web/app.py _write_baseline_profile 同模板）。
  const pd = join(settings.projectRoot, 'profiles', name)
  await mkdir(pd, { recursive: true })
  const g = (key, fallback = '') => formField(form, key, fallback)
  const direction = g('direction') || '[待补充]'
  const reason = g('reason') || '[待补充]'
  const goal = g('goal')
  const formats = g('formats')
  const tone = g('tone') || '[待分析]'
  const likes = g('likes')
  const avoid = g('avoid')
  const platforms = Array.isArray(form.platforms) ? form.platforms : []
  const links = form.links !== null && typeof form.links === 'object' ? form.links : {}
  const files = {
    'identity.md': `# 身份定位\n\n## 我是谁\n\n${direction}\n\n## 差异化\n\n${reason}\n\n## 内容方向\n\n${direction}${formats ? `（形式：${formats}）` : ''}\n${goal ? `运营目标：${goal}` : ''}\n`,
    'style.md': `# 内容风格\n\n## 语气\n\n${tone}\n\n## 开头结构\n\n[待 AI 分析已发内容]\n\n## 视觉风格\n\n[待 AI 分析]\n\n## 内容节奏\n\n${formats || '[待补充]'}\n\n## 标志性元素\n\n[待 AI 分析]\n`,
    'audience.md': '# 目标受众\n\n## 核心人群\n\n[待 AI 分析/待补充]\n\n## 兴趣标签\n\n[待补充]\n\n## 痛点\n\n[待补充]\n\n## 互动特征\n\n[待 AI 分析已发内容]\n',
    'platforms.md': `# 平台运营\n\n${platforms.length > 0 ? platforms.map(p => `## ${p}\n\n主页：${links[p] || '[待补充]'}\n粉丝量级 / 内容形式：[待补充]\n`).join('\n') : '[待补充]\n'}`,
    'preferences.md': `# 偏好与红线\n\n## 要做的\n\n${direction}\n\n## 不做的\n\n${avoid || '[待补充]'}\n\n## 合规底线\n\n${avoid || '[待补充]'}\n`,
    'memory.md': `# 经验沉淀\n\n## 内容洞察\n\n${likes ? `喜欢的内容/对标：${likes}` : '[待 AI 分析已收藏/点赞]'}\n\n## 踩过的坑\n\n[待积累]\n`,
  }
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(join(pd, filename), content, 'utf8')
  }
}


// 立项前置：在项目根下建相对目录（dsh 的 workspace.create 只 realpath 不建目录）。
// rel 必须是项目内相对路径：拒绝对路径分隔符开头的绝对形态与任何 .. 段。
async function apiMkdir(c) {
  const body = await c.body()
  const rel = typeof body?.rel === 'string' ? body.rel.trim() : ''
  const parts = rel.split(/[\/]+/).filter(Boolean)
  if (!rel || rel.startsWith('/') || /^[a-zA-Z]:/.test(rel) || parts.includes('..')) {
    throw new ApiError(400, 'rel 必须是项目根内的相对路径')
  }
  await mkdir(join(c.settings.projectRoot, ...parts), { recursive: true })
  return { json: { ok: true } }
}

// 立项工作区资料装配（spec easel-project-materials）：建 projects/<safe>/ 并播种
// 选题.md/项目资料.md/拆解/画像快照，随后把选题卡置 project + projectDir。
// dsh 侧的 workspace.create 由前端拿 safe 后发起（工作区服务在浏览器侧）。
async function apiProjectize(c) {
  const body = await c.body()
  const title = String(body?.title ?? '').trim()
  if (!title) throw new ApiError(400, '缺少选题标题')
  const result = await seedProjectWorkspace({
    projectRoot: c.settings.projectRoot,
    title,
    note: String(body?.note ?? ''),
    source: String(body?.source ?? ''),
    fallback: String(body?.fallback ?? body?.ideaId ?? '').trim() || '未命名项目',
    deconstructId: String(body?.deconstruct ?? '').trim(),
    persona: String(body?.persona ?? '').trim(),
  })
  if (typeof body?.ideaId === 'string' && body.ideaId) {
    await mutateIdeas(c.settings, (items) => {
      const item = items.find(entry => entry.id === body.ideaId)
      if (item !== undefined) {
        item.status = 'project'
        item.projectDir = `projects/${result.safe}`
      }
      return { items }
    })
  }
  return { json: { safe: result.safe } }
}

// ---- CalDAV 只读订阅（账号配置存 _caldav_config.json，事件缓存存 _caldav_cache.json）----

const CALDAV_CONFIG_FILE = '_caldav_config.json'
const CALDAV_CACHE_FILE = '_caldav_cache.json'
// 同步窗口：过去 60 天 ~ 未来 300 天，客户端按可见月份过滤
const CALDAV_SYNC_BACK_DAYS = 60
const CALDAV_SYNC_FORWARD_DAYS = 300
const CALDAV_COLORS = ['#5b8def', '#e5484d', '#30a46c', '#b7791f', '#8e4ec6', '#0f766e']

function isValidHttpUrl(value) {
  return /^https?:\/\//i.test(value)
}

export async function readCaldavConfig(settings) {
  const raw = await readJsonFile(join(settings.projectRoot, 'outputs', CALDAV_CONFIG_FILE), null)
  const accounts = []
  for (const item of Array.isArray(raw?.accounts) ? raw.accounts : []) {
    if (item === null || typeof item !== 'object') continue
    const url = String(item.url ?? '').trim()
    if (!isValidHttpUrl(url)) continue
    accounts.push({
      id: String(item.id ?? '').trim() || randomBytes(6).toString('hex'),
      name: String(item.name ?? '').trim().slice(0, 40) || '日历账号',
      url,
      username: String(item.username ?? '').trim(),
      // ponytail: 凭据明文存工作区 outputs（本地桌面应用、本机数据目录）；API 响应一律掩码
      password: String(item.password ?? ''),
      enabled: item.enabled !== false,
      calendars: Array.isArray(item.calendars) ? item.calendars.map(String).filter(isValidHttpUrl) : [],
    })
  }
  return { accounts }
}

async function writeCaldavConfig(settings, accounts) {
  await writeJsonFile(join(settings.projectRoot, 'outputs', CALDAV_CONFIG_FILE), { accounts })
}

async function readCaldavCache(settings) {
  const raw = await readJsonFile(join(settings.projectRoot, 'outputs', CALDAV_CACHE_FILE), null)
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)
    || raw.byAccount === null || typeof raw.byAccount !== 'object' || Array.isArray(raw.byAccount)) return {}
  // 耐久文件：条目形状不合规的直接丢弃，不让坏缓存打穿客户端渲染
  const byAccount = {}
  for (const [aid, bucket] of Object.entries(raw.byAccount)) {
    if (bucket === null || typeof bucket !== 'object' || !Array.isArray(bucket.events)) continue
    byAccount[aid] = {
      syncedAt: typeof bucket.syncedAt === 'number' ? bucket.syncedAt : null,
      events: bucket.events.filter((ev) => ev !== null && typeof ev === 'object'),
    }
  }
  return byAccount
}

async function apiCaldavAccountsGet(c) {
  const cfg = await readCaldavConfig(c.settings)
  const cache = await readCaldavCache(c.settings)
  const accounts = cfg.accounts.map((account, index) => ({
    ...account,
    password: account.password ? maskValue(account.password) : '',
    color: CALDAV_COLORS[index % CALDAV_COLORS.length],
    syncedAt: cache[account.id]?.syncedAt ?? null,
  }))
  return { json: { accounts } }
}

async function apiCaldavAccountsPut(c) {
  const body = await c.body()
  const existing = await readCaldavConfig(c.settings)
  const accounts = []
  for (const item of Array.isArray(body?.accounts) ? body.accounts : []) {
    if (item === null || typeof item !== 'object') continue
    const url = String(item.url ?? '').trim()
    if (!isValidHttpUrl(url)) throw new ApiError(400, `无效的 CalDAV URL：${url || '(空)'}`)
    const id = String(item.id ?? '').trim() || randomBytes(6).toString('hex')
    const old = existing.accounts.find((account) => account.id === id)
    // 空密码或掩码 = 未改动（GET 只回掩码，客户端会原样带回来），保留原值
    const incomingPassword = String(item.password ?? '').trim()
    const password = (incomingPassword === '' || incomingPassword.startsWith('••••')) ? (old?.password ?? '') : incomingPassword
    accounts.push({
      id,
      name: String(item.name ?? '').trim().slice(0, 40) || '日历账号',
      url,
      username: String(item.username ?? '').trim(),
      password,
      enabled: item.enabled !== false,
      calendars: Array.isArray(item.calendars) ? item.calendars.map(String).filter(isValidHttpUrl) : [],
    })
  }
  await writeCaldavConfig(c.settings, accounts)
  return { json: { ok: true } }
}

async function apiCaldavDiscover(c) {
  const cfg = await readCaldavConfig(c.settings)
  const saved = cfg.accounts.find((account) => account.id === c.params.aid)
  if (saved === undefined) throw new ApiError(404, '账号不存在')
  const body = await c.body()
  // 表单未保存时可用请求体里的 URL/凭据直接探测
  const account = {
    ...saved,
    url: isValidHttpUrl(String(body?.url ?? '').trim()) ? String(body.url).trim() : saved.url,
    username: typeof body?.username === 'string' && body.username.trim() ? body.username.trim() : saved.username,
    password: typeof body?.password === 'string' && body.password.trim() ? body.password : saved.password,
  }
  try {
    return { json: { calendars: await discoverCalendars(account) } }
  } catch (error) {
    throw new ApiError(502, error?.message ?? 'CalDAV 发现失败')
  }
}

async function apiCaldavSync(c) {
  const cfg = await readCaldavConfig(c.settings)
  const account = cfg.accounts.find((entry) => entry.id === c.params.aid)
  if (account === undefined) throw new ApiError(404, '账号不存在')
  const now = Date.now()
  let events
  try {
    events = await syncCalendarEvents(account, now - CALDAV_SYNC_BACK_DAYS * 86400000, now + CALDAV_SYNC_FORWARD_DAYS * 86400000)
  } catch (error) {
    throw new ApiError(502, error?.message ?? 'CalDAV 同步失败')
  }
  const cache = await readCaldavCache(c.settings)
  cache[account.id] = { syncedAt: Math.floor(now / 1000), events }
  await writeJsonFile(join(c.settings.projectRoot, 'outputs', CALDAV_CACHE_FILE), { byAccount: cache })
  return { json: { ok: true, count: events.length } }
}

async function apiCaldavEventsGet(c) {
  return { json: { byAccount: await readCaldavCache(c.settings) } }
}

// ---- 路由表与调度：命中即本地应答，未命中返回 null → 回落代理 ----

/**
 * Routes owned by the workbench core (file/data plane). Platform automation and
 * the breakdown pipeline contribute their own tables through the `easelApi`
 * service (lib/plugins/*), so each feature can be enabled or fail independently.
 */
export const CORE_ROUTES = [
  ['GET', ['status'], apiStatus],
  ['GET', ['skills'], c => getSkills(c.settings).then(json => ({ json }))],
  ['GET', ['skill', ':name'], apiSkillDetail],
  ['GET', ['persona', ':name', 'files'], apiPersonaFiles],
  ['PUT', ['persona', ':name', 'file'], apiPersonaSave],
  ['DELETE', ['persona', ':name'], apiPersonaDelete],
  ['POST', ['env'], apiEnvSave],
  ['GET', ['radar', 'config'], apiRadarConfigGet],
  ['POST', ['radar', 'config'], apiRadarConfigSet],
  ['GET', ['trends'], apiTrends],
  ['POST', ['radar', 'article'], apiRadarArticle],
  ['GET', ['outputs'], c => getOutputTree(c.settings).then(json => ({ json }))],
  ['GET', ['output', ':path...'], apiOutputContent],
  ['DELETE', ['output', ':path...'], apiOutputDelete],
  ['GET', ['media', ':path...'], apiMedia],
  ['GET', ['workspace-media', ':path...'], apiWorkspaceMedia],
  ['GET', ['ideas'], apiIdeasList],
  ['POST', ['ideas'], apiIdeasCreate],
  ['PUT', ['ideas', ':iid'], apiIdeasUpdate],
  ['DELETE', ['ideas', ':iid'], apiIdeasDelete],
  ['GET', ['schedule'], apiScheduleList],
  ['POST', ['schedule'], apiScheduleCreate],
  ['PUT', ['schedule', ':sid'], apiScheduleUpdate],
  ['DELETE', ['schedule', ':sid'], apiScheduleDelete],
  ['GET', ['caldav', 'accounts'], apiCaldavAccountsGet],
  ['PUT', ['caldav', 'accounts'], apiCaldavAccountsPut],
  ['POST', ['caldav', 'accounts', ':aid', 'discover'], apiCaldavDiscover],
  ['POST', ['caldav', 'accounts', ':aid', 'sync'], apiCaldavSync],
  ['GET', ['caldav', 'events'], apiCaldavEventsGet],
  ['POST', ['profile', 'build'], apiProfileBuild],
  ['POST', ['mkdir'], apiMkdir],
  ['POST', ['projectize'], apiProjectize],
]

/**
 * Route registry shared with feature plugins (the `easelApi` service).
 * @param settings - resolved deployment settings, handed to every handler.
 */
export function createRouteRegistry(settings) {
  let tables = []
  let snapshot = []
  return {
    settings,
    /** @returns the merged table, in registration order. */
    snapshot: () => snapshot,
    /**
     * @param routes - one feature plugin's route table.
     * @returns the disposer that withdraws it.
     */
    register(routes) {
      tables = [...tables, routes]
      snapshot = tables.flat()
      let active = true
      return () => {
        if (!active) return
        active = false
        tables = tables.filter(table => table !== routes)
        snapshot = tables.flat()
      }
    },
  }
}

/**
 * Answer one `/easel/api/*` request locally when a route claims it.
 * @param routes - merged route table (core plus every mounted feature plugin).
 * @returns {Promise<{json: unknown, status?: number}|{file: string, headers?: object, range?: string}|null>}
 *   null means "nothing absorbed the request".
 */
export async function dispatchLocalApi(settings, method, segments, query, readJson, headers = {}, routes = CORE_ROUTES) {
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method && !(routeMethod === 'GET' && method === 'HEAD')) continue
    const params = matchRoute(segments, pattern)
    if (params === null) continue
    return handler({ settings, params, query, body: readJson, headers })
  }
  return null
}

async function readJsonBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > 10 * 1024 * 1024) throw new ApiError(413, '请求体过大')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, '请求体不是合法 JSON')
  }
}

/** Stream one file with single-range support (media seeking) and explicit headers. */
async function streamFile(res, { file, status = 200, headers = {}, range }) {
  const found = await pathStat(file)
  if (found === null || !found.isFile()) {
    sendJson(res, 404, { detail: '文件不存在' })
    return
  }
  const size = found.size
  const base = { 'accept-ranges': 'bytes', ...headers }
  const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null
  if (match !== null && (match[1] !== '' || match[2] !== '')) {
    let start
    let end
    if (match[1] === '') {
      const suffix = Number(match[2])
      start = Math.max(0, size - suffix)
      end = size - 1
    } else {
      start = Number(match[1])
      end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      res.writeHead(416, { 'content-range': `bytes */${size}`, 'content-length': '0' })
      res.end()
      return
    }
    res.writeHead(206, { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) })
    createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.writeHead(status, { ...base, 'content-length': String(size) })
  createReadStream(file).pipe(res)
}

/**
 * Serve `/easel/api/*` from the mounted route registry: absorbed routes answer
 * off the project directory, and a request no plugin claims is a plain 404.
 */
async function serveApi(api, req, res) {
  const settings = api.settings
  if (!sameOriginAllowed(req.headers.origin, req.headers.host)) {
    sendJson(res, 403, { ok: false, error: 'cross-origin api use is not allowed' })
    return
  }
  let segments
  let query
  try {
    const url = new URL(req.url ?? '/', 'http://dsh.local')
    segments = url.pathname.slice(settings.basePath.length + PROXY_SUFFIX.length)
      .split('/').filter(part => part.length > 0).map(decodeURIComponent)
    query = url.searchParams
  } catch {
    sendJson(res, 400, { detail: '非法路径编码' })
    return
  }
  let cachedBody
  const readJson = async () => {
    if (cachedBody === undefined) cachedBody = await readJsonBody(req)
    return cachedBody
  }
  let result
  try {
    result = await dispatchLocalApi(settings, req.method ?? 'GET', segments, query, readJson, req.headers, api.snapshot())
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const detail = error instanceof ApiError ? error.detail : `本地 API 错误：${error?.message ?? error}`
    sendJson(res, status, { detail })
    return
  }
  if (result === null) {
    // B4：代理已退役——没有本地路由认领的接口随 Easel 后端一起下线。
    sendJson(res, 404, { detail: '该接口已随 Easel 后端退役' })
    return
  }
  if (result.file !== undefined) {
    await streamFile(res, result)
    return
  }
  sendJson(res, result.status ?? 200, result.json)
}

/**
 * Routes for LAN project handoff.
 *
 * The handoff backend lives in the `@easel-dsh/easel-air-transfer` plugin row;
 * this table only relays through the runtime service, so the Easel plugin
 * keeps its staged payload free of harness imports.
 * @param ctx - host context that may carry the `lanHandoff` service.
 * @returns route rows in the {@link CORE_ROUTES} shape.
 */
export function createHandoffRoutes(ctx) {
  const lan = () => ctx.get?.('lanHandoff')
  const requireLan = () => {
    const service = lan()
    if (service === undefined) throw new ApiError(409, '隔空传送未启用：profile 未挂载 @easel-dsh/easel-air-transfer')
    return service
  }
  return [
    ['GET', ['handoff', 'status'], async () => {
      const service = lan()
      if (service === undefined) {
        return { json: { available: false, reason: 'LAN handoff is not enabled in this profile' } }
      }
      const state = await service.ready
      return { json: {
        available: true,
        device: {
          id: String(state.deviceId),
          name: state.name,
          port: state.port,
          handoffDirectory: state.handoffDirectory,
        },
        paired: service.pairedPeers().map(peer => ({
          id: String(peer.id), name: peer.name, platform: peer.platform, pairedAt: peer.pairedAt,
        })),
        discovered: service.peersSnapshot().map(peer => ({
          id: String(peer.id),
          name: peer.name,
          platform: peer.platform,
          port: peer.port,
          addresses: peer.addresses,
          compatible: peer.compatible,
        })),
        pending: service.pairingOffers().map(offer => ({
          id: offer.id,
          sas: offer.sas,
          direction: offer.direction,
          peer: { id: String(offer.peer.id), name: offer.peer.name, platform: offer.peer.platform },
        })),
        last: service.lastHandoffOutcome() ?? null,
      } }
    }],
    ['POST', ['handoff', 'pair'], async (c) => {
      const service = requireLan()
      const body = await c.body()
      const before = new Set(service.pairingOffers().map(offer => offer.id))
      if (typeof body?.peerId === 'string' && body.peerId.length > 0) {
        await service.pairWithDiscoveredPeer(body.peerId)
      } else {
        const host = String(body?.host ?? '').trim()
        const port = Number(body?.port)
        if (host.length === 0 || !Number.isInteger(port) || port < 1 || port > 65535) {
          throw new ApiError(400, 'host 与 port 必填（或提供 peerId）')
        }
        await service.pairWithPeer({ host, port })
      }
      const pending = service.pairingOffers().find(offer => !before.has(offer.id))
      if (pending === undefined) throw new ApiError(502, '配对未能进入待确认状态')
      return { json: {
        id: pending.id,
        sas: pending.sas,
        direction: pending.direction,
        peer: { id: String(pending.peer.id), name: pending.peer.name, platform: pending.peer.platform },
      } }
    }],
    ['POST', ['handoff', 'pair', ':id', 'accept'], async (c) => {
      await requireLan().acceptPairing(String(c.params.id))
      return { json: { ok: true } }
    }],
    ['POST', ['handoff', 'pair', ':id', 'reject'], async (c) => {
      await requireLan().rejectPairing(String(c.params.id))
      return { json: { ok: true } }
    }],
    ['GET', ['handoff', 'workspaces'], async () => {
      const registry = ctx.get?.('workspaceRegistry')
      if (registry === undefined) return { json: { workspaces: [] } }
      return { json: {
        workspaces: registry.list().map(workspace => ({ path: workspace.path, title: workspace.title })),
      } }
    }],
    ['POST', ['handoff', 'send'], async (c) => {
      const service = requireLan()
      const body = await c.body()
      const peerId = String(body?.peerId ?? '')
      const workspacePath = String(body?.workspacePath ?? '')
      if (peerId.length === 0 || workspacePath.length === 0) {
        throw new ApiError(400, 'peerId 与 workspacePath 必填')
      }
      // 载荷勾选（spec easel-handoff-payload §S2）：会话默认带；项目素材默认带；
      // 内容库与配置项（.env/画像/技能，含密钥）按勾选装配成 data 条目。
      const payload = body?.payload !== null && typeof body?.payload === 'object' ? body.payload : {}
      const dataFiles = [
        ...(payload.library === true ? await collectLibraryDataFiles(c.settings) : []),
        ...(payload.config === true ? await collectConfigDataFiles(c.settings) : []),
      ]
      const result = await service.sendProjectToPeer(peerId, workspacePath, {
        sessions: payload.sessions !== false,
        exclude: ['.env', ...(payload.materials === false ? ['素材'] : [])],
        ...(dataFiles.length > 0 ? { dataFiles } : {}),
      })
      return { json: { ok: true, sent: result.sent, skipped: result.skipped } }
    }],
    ['POST', ['handoff', 'push'], async (c) => {
      const service = requireLan()
      const body = await c.body()
      const peerId = String(body?.peerId ?? '')
      const rawPath = String(body?.path ?? '')
      if (peerId.length === 0 || rawPath.length === 0) {
        throw new ApiError(400, 'peerId 与 path 必填')
      }
      const target = resolve(rawPath)
      const found = await pathStat(target)
      if (found === null) throw new ApiError(404, '文件不存在')
      const canonical = realpathSync.native(target)
      // 最长前缀的已注册工作区决定标题与相对路径；不在任何工作区时以自身名入包。
      const registry = ctx.get?.('workspaceRegistry')
      const workspaces = registry === undefined ? [] : registry.list()
      let chosen = null
      for (const workspace of workspaces) {
        const ws = resolve(String(workspace.path))
        if (canonical !== ws && !canonical.startsWith(ws + sep)) continue
        if (chosen === null || ws.length > chosen.ws.length) chosen = { workspace, ws }
      }
      const relativeBase = chosen === null
        ? ''
        : relative(chosen.ws, found.isDirectory() ? canonical : dirname(canonical)).split(sep).join('/')
      const projectTitle = chosen === null
        ? basename(canonical)
        : (String(chosen.workspace.title).length > 0 ? String(chosen.workspace.title) : basename(chosen.ws))
      const files = []
      if (found.isDirectory()) {
        await collectPushFiles(target, '', files)
      } else {
        files.push({ absolutePath: target, relativePath: basename(canonical) })
      }
      const result = await service.sendFilesToPeer(peerId, {
        projectTitle,
        files: files.map(file => ({
          absolutePath: file.absolutePath,
          relativePath: relativeBase === '' ? file.relativePath : `${relativeBase}/${file.relativePath}`,
        })),
      })
      return { json: { ok: true, sent: result.sent, skipped: result.skipped } }
    }],
  ]
}

/**
 * Walk one directory into quick-push file entries, refusing anything a bundle
 * cannot carry faithfully (no silently dropped symlinks or special files).
 * @param dir - directory to walk.
 * @param rel - bundle-relative path of this directory ('' at the root).
 * @param files - accumulator for `{ absolutePath, relativePath }` entries.
 */
async function collectPushFiles(dir, rel, files) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => {
    throw new ApiError(400, `无法读取目录「${rel || basename(dir)}」`)
  })
  for (const item of entries) {
    const next = rel === '' ? item.name : `${rel}/${item.name}`
    const absolute = join(dir, item.name)
    if (item.isDirectory()) await collectPushFiles(absolute, next, files)
    else if (item.isFile()) files.push({ absolutePath: absolute, relativePath: next })
    else throw new ApiError(400, `「${next}」不是常规文件，无法推送`)
  }
}

/**
 * 内容库（outputs/）随「素材库」勾选上包的 data 条目。可见性与内容库页同规则：
 * 跳过 `.`/`_` 前缀条目与顶层 analytics/（登录态与分析数据不出设备）。
 * @param settings - resolved plugin settings carrying the project root.
 * @returns data-file sources with data-root-relative paths.
 */
async function collectLibraryDataFiles(settings) {
  const files = []
  const walk = async (dir, rel) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const item of entries) {
      if (item.name.startsWith('.') || item.name.startsWith('_')) continue
      const next = rel === '' ? item.name : `${rel}/${item.name}`
      const absolute = join(dir, item.name)
      if (item.isDirectory()) {
        if (rel === '' && item.name.toLowerCase() === 'analytics') continue
        await walk(absolute, next)
      } else if (item.isFile()) {
        files.push({ path: `outputs/${next}`, absolutePath: absolute })
      }
    }
  }
  await walk(join(settings.projectRoot, 'outputs'), '')
  return files
}

/**
 * 配置项（.env / 画像 / 技能）随「配置项」勾选上包的 data 条目。`.env` 只带
 * 白名单内且已设置的 key（密钥按需上包）；画像走有效画像目录；技能走配置的
 * skillsDir（相对数据根的路径前缀从 skillsDir 推导）。
 * @param settings - resolved plugin settings carrying the project root and skills dir.
 * @returns data-file sources with data-root-relative paths.
 */
async function collectConfigDataFiles(settings) {
  const files = []
  const env = await readEnvFile(join(settings.projectRoot, '.env'))
  const lines = Object.entries(env)
    .filter(([key, value]) => ENV_ALLOWLIST.has(key) && isSet(value))
    .map(([key, value]) => `${key}=${value}`)
  if (lines.length > 0) {
    files.push({ path: '.env', bytes: new TextEncoder().encode(`${lines.join('\n')}\n`) })
  }
  const profiles = join(settings.projectRoot, 'profiles')
  const personaEntries = await readdir(profiles, { withFileTypes: true }).catch(() => [])
  for (const persona of personaEntries) {
    if (!persona.isDirectory() || !validPersonaName(persona.name)) continue
    const dir = join(profiles, persona.name)
    const inner = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const item of inner) {
      if (!item.isFile()) continue
      files.push({ path: `profiles/${persona.name}/${item.name}`, absolutePath: join(dir, item.name) })
    }
  }
  const skillPrefix = relative(settings.projectRoot, settings.skillsDir).split(sep).join('/')
  if (skillPrefix.startsWith('..')) {
    throw new ApiError(400, `技能目录 ${settings.skillsDir} 不在数据根内，无法随配置项推送`)
  }
  const walkSkills = async (dir, rel) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const item of entries) {
      if (item.name.startsWith('.')) continue
      const next = rel === '' ? item.name : `${rel}/${item.name}`
      const absolute = join(dir, item.name)
      if (item.isDirectory()) await walkSkills(absolute, next)
      else if (item.isFile()) files.push({ path: `${skillPrefix}/${next}`, absolutePath: absolute })
    }
  }
  await walkSkills(settings.skillsDir, '')
  return files
}

/**
 * Register the Easel routes.
 * @param ctx - the host context providing the route table.
 * @param config - the `config` block of this plugin's loader row.
 */
export function apply(ctx, config = {}) {
  const settings = resolveSettings(config)
  // Feature plugins (automation, deconstruct) mount their own routes into this
  // registry; clicking a row off in the profile turns one feature off cleanly.
  const api = createRouteRegistry(settings)
  ctx.provide('easelApi', api)
  ctx.effect(() => api.register(CORE_ROUTES), 'easel: core routes')
  ctx.effect(() => api.register(createHandoffRoutes(ctx)), 'easel: handoff routes')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${settings.basePath}/status`,
    handler: async (req, res) => {
      if (!requireGet(req, res)) return
      const catalog = await readSkillCatalog(settings.skillsDir)
      sendJson(res, 200, {
        plugin: name,
        projectRoot: settings.projectRoot,
        basePath: settings.basePath,
        backend: { retired: true },
        skills: { directory: catalog.directory, present: catalog.present, count: catalog.count },
      })
    },
  }), 'easel: workbench status route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${settings.basePath}/skills`,
    handler: async (req, res) => {
      if (!requireGet(req, res)) return
      sendJson(res, 200, await readSkillCatalog(settings.skillsDir))
    },
  }), 'easel: skill browse route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: `${settings.basePath}${PROXY_SUFFIX}`,
    handler: (req, res) => serveApi(api, req, res),
  }), 'easel: api routes (all local; unmatched paths are 404)')

  ctx.logger?.info?.(`easel: project root ${settings.projectRoot}, skills ${settings.skillsDir}, python ${settings.python}`)
}
