// 爆款拆解的运行环境自动装配（spec easel-breakdown-env-bootstrap）。
//
// 首次运行拆解时宿主按 pin 清单（env-tools-pins.json）把缺失工具下载到
// 数据根 tools/bin/：ffmpeg/ffprobe 恒为硬依赖，yt-dlp 仅 B站/YouTube/通用
// 链接需要（douyin/xhs/kuaishou/sph 走 video_fetch 原生路径）。解析顺序
// PATH 优先——用户自装的保优先，与壳侧 dreamina/libtv「PATH-last」同一
// 语义；下载产物只兜 PATH 缺失的机器。下载逐源校验 sha256（pin 即事实
// 源），zip 经 project-archive 的中央目录解压器整包解到 staging 后按清单
// 条目落位；全程 fail loud，绝不静默跳过。

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCentralDirectory, extractEntries } from './project-archive.js'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const PINS_FILE = resolve(MODULE_DIR, '..', 'env-tools-pins.json')

/** 下载单源停滞判定：这么多字节没进来就断掉本次尝试（弱网早期失败早换源）。 */
const STALL_TIMEOUT_MS = 120_000
/** 每个源的下载尝试次数（源顺序内重试，重试耗尽再换下一源）。 */
const SOURCE_ATTEMPTS = 2
/** zip 解压字节上限（gyan essentials 解压约 300MB，留量给同量级备源）。 */
const EXTRACT_BYTE_LIMIT = 3 * 1024 ** 3
/** tar 解包上限（linux 备源 tar.xz 约 1.6GB 解压）。 */
const TAR_TIMEOUT_MS = 10 * 60_000

/**
 * 平台键，与 apps/desktop-tauri/runtime-inputs.json 的 files 键同风格：
 * windows-amd64 / windows-arm64 / darwin-arm64 / darwin-amd64 / linux-amd64。
 * @param platform - 目标平台（缺省当前进程）。
 * @param arch - 目标架构（缺省当前进程）。
 */
export function envPlatformKey(platform = process.platform, arch = process.arch) {
  const os = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'darwin' : 'linux'
  return `${os}-${arch === 'x64' ? 'amd64' : arch}`
}

/**
 * 拆解平台是否走 yt-dlp 通用下载路径。douyin/xhs/kuaishou/sph 都有
 * video_fetch 原生路径，补装 yt-dlp 只会浪费下载。
 * @param platform - parsePlatform 的平台 id。
 */
export function requiresYtDlp(platform) {
  return platform === 'bili' || platform === 'youtube' || platform === 'other'
}

/** 环境装配的结构化失败；路由层映射成 ApiError 的 status + 中文 detail。 */
export class EnvToolError extends Error {
  /**
   * @param {string} code - busy / unknown-tool / no-pin / download / checksum / extract / interrupted。
   * @param {string} message - 面向用户的中文原因。
   */
  constructor(code, message) {
    super(message)
    this.name = 'EnvToolError'
    this.code = code
  }
}

/**
 * Pin 清单（env-tools-pins.json 与本模块同包发布，payload 每次启动重拷）。
 * 读取即校验：缺文件/缺条目在这里响，而不是等到下载半路。
 * @returns {{schemaVersion: number, tools: Record<string, object>}} pin 清单。
 */
function loadPins() {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(PINS_FILE, 'utf8'))
  } catch (error) {
    throw new EnvToolError('no-pin', `环境工具 pin 清单缺失或损坏：${error instanceof Error ? error.message : error}`)
  }
  if (parsed?.schemaVersion !== 1 || typeof parsed.tools !== 'object' || parsed.tools === null) {
    throw new EnvToolError('no-pin', '环境工具 pin 清单格式不正确（schemaVersion ≠ 1）')
  }
  return parsed
}

/** 工具 pin 的某平台条目；没有 pin 的平台响明确的「不支持自动下载」。 */
function platformEntry(pins, toolId) {
  const tool = pins.tools[toolId]
  if (tool === undefined) throw new EnvToolError('unknown-tool', `未知的环境工具：${toolId}`)
  const entry = tool.files?.[envPlatformKey()]
  if (entry === undefined || !Array.isArray(entry.artifacts) || entry.artifacts.length === 0) {
    throw new EnvToolError('no-pin', `${toolId} 在 ${envPlatformKey()} 上未提供自动下载，请手动安装`)
  }
  return entry
}

/**
 * 下载工具的落位目录：settings.envToolsDir（resolveSettings 解析 config →
 * EASEL_TOOLS_DIR → 数据根 tools）下的 bin/。
 * @param settings - resolveSettings 的插件设置。
 * @returns 绝对目录路径（不探测存在性）。
 */
export function envToolsBinDir(settings) {
  return join(settings.envToolsDir, 'bin')
}

/** `--version` 探测：退出码 0 视为可用，返回首行（版本串）。ffmpeg 与 yt-dlp 都认双横线形式（yt-dlp 的 `-v` 是 verbose，单横线会失败）。 */
function probeVersion(binPath, spawnSyncImpl) {
  const proc = spawnSyncImpl(binPath, ['--version'], { timeout: 8000, windowsHide: true, encoding: 'utf8' })
  if (proc.error !== undefined || proc.status !== 0) return null
  const first = String(proc.stdout ?? '').split(/\r?\n/)[0]?.trim()
  return first === '' ? null : first
}

/**
 * 解析一个工具的各个可执行文件：PATH 优先，tools/bin 兜底。
 * @param settings - resolveSettings 的插件设置。
 * @param toolId - pin 清单里的工具 id（ffmpeg / yt-dlp）。
 * @param deps - 测试注入：spawnSyncImpl 替换进程探测，pins 替换清单文件。
 * @returns `{ id, installed, bins }`；bins 值为
 *   `{ source: 'path'|'tools'|'missing', path, version? }`。
 */
export function resolveEnvTool(settings, toolId, deps = {}) {
  const spawnSyncImpl = deps.spawnSyncImpl ?? spawnSync
  const pins = deps.pins ?? loadPins()
  const tool = pins.tools[toolId]
  if (tool === undefined) throw new EnvToolError('unknown-tool', `未知的环境工具：${toolId}`)
  if (!Array.isArray(tool.bins) || tool.bins.length === 0) {
    throw new EnvToolError('no-pin', `pin 清单里 ${toolId} 未声明 bins`)
  }
  const binDir = envToolsBinDir(settings)
  const ext = process.platform === 'win32' ? '.exe' : ''
  const bins = {}
  for (const bin of tool.bins) {
    const pathVersion = probeVersion(bin, spawnSyncImpl)
    if (pathVersion !== null) {
      bins[bin] = { source: 'path', path: bin, version: pathVersion }
      continue
    }
    const localPath = join(binDir, `${bin}${ext}`)
    const localVersion = existsSync(localPath) ? probeVersion(localPath, spawnSyncImpl) : null
    bins[bin] = localVersion !== null
      ? { source: 'tools', path: localPath, version: localVersion }
      : { source: 'missing', path: localPath }
  }
  return { id: toolId, installed: Object.values(bins).every(bin => bin.source !== 'missing'), bins }
}

/**
 * 拆解页 preflight 的环境快照：逐工具 installed / 缺哪些可执行文件。
 * @param settings - resolveSettings 的插件设置。
 * @param toolIds - 本平台需要的工具 id（ffmpeg 恒需，yt-dlp 按平台）。
 * @param deps - 测试注入，透传 resolveEnvTool。
 * @returns `{ tools: Array<{id, installed, missing}>, ready }`。
 */
export function checkEnvTools(settings, toolIds, deps = {}) {
  const tools = toolIds.map(id => {
    const resolved = resolveEnvTool(settings, id, deps)
    const missing = Object.entries(resolved.bins)
      .filter(([, bin]) => bin.source === 'missing')
      .map(([name]) => name)
    return { id, installed: resolved.installed, missing }
  })
  return { tools, ready: tools.every(tool => tool.installed) }
}

// ---- 安装引擎：下载（sha256 边下边算）→ 解压/落位 → state.json ----

/** 同一进程内同时只允许一次安装；状态以 install-state.json 为事实源。 */
let activeInstall = null

/** 安装进度态（install-state.json 原子落盘：status 路由与跨重启续显都读它）。 */
function initialState(toolIds) {
  return {
    phase: 'running',
    tools: [...toolIds],
    current: null,
    /** 当前工件的进度（字节）；totalBytes 来自 pin 声明或响应头。 */
    receivedBytes: 0,
    totalBytes: 0,
    detail: '',
    startedAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// 进度落盘节流：下载 tick 每 750ms 至多一次，相位切换/收场强制落。串行链
// 保证 tmp+rename 不被并发写互相踩。
let persistChain = Promise.resolve()
let lastPersistAt = 0
let persistTimer = null

function persistInstallState(settings, state, { force = false } = {}) {
  const due = force || Date.now() - lastPersistAt >= 750
  if (!due) {
    persistTimer ??= setTimeout(() => {
      persistTimer = null
      if (activeInstall !== null) persistInstallState(settings, activeInstall.state, { force: true })
    }, 750)
    return
  }
  lastPersistAt = Date.now()
  state.updatedAt = Date.now()
  persistChain = persistChain.then(async () => {
    await mkdir(settings.envToolsDir, { recursive: true })
    const file = join(settings.envToolsDir, 'install-state.json')
    const scratch = `${file}.tmp`
    await writeFile(scratch, JSON.stringify(state, null, 2), 'utf8')
    await rename(scratch, file)
  }).catch(() => {})
}

/**
 * 流式下载一个源到 dest，边写边算 sha256。content-length 缺失或与实收
 * 不符都算失败；STALL_TIMEOUT_MS 无字节进账即 abort（弱网早失败早换源）。
 * @param deps.fetchImpl - 可注入的 fetch。
 * @returns 十六进制 sha256。
 */
async function downloadVerified(deps, url, dest, { onProgress }) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  let timer = setTimeout(() => controller.abort(new EnvToolError('stall', `下载停滞超过 ${Math.round(STALL_TIMEOUT_MS / 1000)}s：${url}`)), STALL_TIMEOUT_MS)
  const resetTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(new EnvToolError('stall', `下载停滞超过 ${Math.round(STALL_TIMEOUT_MS / 1000)}s：${url}`)), STALL_TIMEOUT_MS)
  }
  let response
  try {
    response = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok || response.body === null) {
      throw new EnvToolError('download', `HTTP ${response.status}：${url}`)
    }
    const total = Number(response.headers.get('content-length')) || 0
    const reader = response.body.getReader()
    const handle = openSync(dest, 'w')
    const hash = createHash('sha256')
    let received = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        resetTimer()
        if (done) break
        writeSync(handle, value)
        hash.update(value)
        received += value.length
        onProgress(received, total)
      }
    } finally {
      closeSync(handle)
      controller.abort()
    }
    if (total !== 0 && received !== total) {
      throw new EnvToolError('download', `下载不完整（${received}/${total} 字节）：${url}`)
    }
    return { sha256: hash.digest('hex'), bytes: received }
  } catch (error) {
    // 停滞 abort 的 reason 是 EnvToolError，其余（网络错/取消）归一为 download。
    throw error instanceof EnvToolError
      ? error
      : new EnvToolError('download', `下载失败：${url}（${error instanceof Error ? error.message : error}）`)
  } finally {
    clearTimeout(timer)
  }
}

/** tar.xz 备源（linux）：系统 tar 带 xz 支持（mac/linux 都有）；Windows 不走这条。 */
function extractTar(deps, archive, staging) {
  const spawnSyncImpl = deps.spawnSyncImpl ?? spawnSync
  const proc = spawnSyncImpl('tar', ['-xJf', archive, '-C', staging], { timeout: TAR_TIMEOUT_MS, windowsHide: true })
  if (proc.error !== undefined || proc.status !== 0) {
    throw new EnvToolError('extract', `tar 解包失败（退出码 ${proc.status ?? proc.error?.code}）：${archive}`)
  }
}

/**
 * 装一个工具的全部工件：逐工件 → 逐源下载校验；zip/tar 解到 staging 后按
 * entries 把清单条目 rename 进 bin/。任何工件装不上都整工具失败（不落半套）。
 */
async function installOneTool(settings, state, toolId, deps, pins) {
  const entry = platformEntry(pins, toolId)
  const binDir = envToolsBinDir(settings)
  state.current = toolId
  const stagingRoot = join(settings.envToolsDir, '.staging', toolId)
  rmSync(stagingRoot, { recursive: true, force: true })
  mkdirSync(stagingRoot, { recursive: true })
  mkdirSync(binDir, { recursive: true })
  try {
    for (let artifactIndex = 0; artifactIndex < entry.artifacts.length; artifactIndex += 1) {
      const artifact = entry.artifacts[artifactIndex]
      await installArtifact(settings, state, artifact, artifactIndex, stagingRoot, binDir, deps)
    }
  } finally {
    // 连父目录一起清：单飞下整个 .staging 都属于本次安装（也收走中断残留）。
    rmSync(join(settings.envToolsDir, '.staging'), { recursive: true, force: true })
  }
  // 装完回读版本进 state.json（探测失败不回滚安装——bin 已可执行）。
  const resolved = resolveEnvTool(settings, toolId, deps)
  const stateFile = join(settings.envToolsDir, 'state.json')
  const previous = await readFile(stateFile, 'utf8').then(
    text => {
      try {
        return JSON.parse(text)
      } catch {
        return undefined
      }
    },
    () => undefined,
  )
  const merged = previous !== null && typeof previous === 'object' && previous.tools !== undefined ? previous : { schemaVersion: 1, tools: {} }
  merged.tools ??= {}
  merged.tools[toolId] = {
    version: Object.values(resolved.bins)[0]?.version ?? 'unknown',
    installedAt: Date.now(),
  }
  await writeFile(stateFile, JSON.stringify(merged, null, 2), 'utf8')
}

async function installArtifact(settings, state, artifact, artifactIndex, stagingRoot, binDir, deps) {
  if (artifact.kind !== 'zip' && artifact.kind !== 'file' && artifact.kind !== 'tar.xz') {
    throw new EnvToolError('no-pin', `pin 清单出现未知工件类型：${artifact.kind}`)
  }
  const archivePath = join(stagingRoot, `artifact-${artifactIndex}`)
  let lastError = null
  for (const source of artifact.sources) {
    for (let attempt = 1; attempt <= SOURCE_ATTEMPTS; attempt += 1) {
      state.phase = 'downloading'
      state.receivedBytes = 0
      state.totalBytes = source.bytes ?? 0
      try {
        const { sha256 } = await downloadVerified(deps, source.url, archivePath, {
          onProgress: (receivedBytes, totalBytes) => {
            state.receivedBytes = receivedBytes
            state.totalBytes = totalBytes || source.bytes || 0
            // 进度节流落盘：status 路由只读文件，重启也接得上进度条。
            persistInstallState(settings, state)
          },
        })
        if (sha256 !== source.sha256) {
          throw new EnvToolError('checksum', `sha256 不匹配（期望 ${source.sha256.slice(0, 12)}…，实得 ${sha256.slice(0, 12)}…）：${source.url}`)
        }
        await placeArtifact(settings, state, artifact, artifactIndex, archivePath, stagingRoot, binDir, deps)
        return
      } catch (error) {
        lastError = error
        rmSync(archivePath, { force: true })
      }
    }
  }
  throw lastError ?? new EnvToolError('download', '全部下载源失败')
}

/** 校验通过后的落位：zip/tar 解到 staging 再按 entries rename；file 直接改名。 */
async function placeArtifact(settings, state, artifact, artifactIndex, archivePath, stagingRoot, binDir, deps) {
  if (artifact.kind === 'file') {
    if (typeof artifact.outName !== 'string' || artifact.outName === '') {
      throw new EnvToolError('no-pin', 'file 工件缺少 outName')
    }
    state.phase = 'extracting'
    persistInstallState(settings, state, { force: true })
    await persistChain
    const target = join(binDir, artifact.outName)
    // Windows rename 不覆盖已存在目标（修复/重装语义），先清再落。
    rmSync(target, { force: true })
    renameSync(archivePath, target)
    if (process.platform !== 'win32') chmodSync(target, 0o755)
    return
  }
  state.phase = 'extracting'
  persistInstallState(settings, state, { force: true })
  await persistChain
  const extractDir = join(stagingRoot, `extract-${artifactIndex}`)
  if (artifact.kind === 'tar.xz') {
    extractTar(deps, archivePath, extractDir)
  } else {
    const expected = await readCentralDirectory(archivePath)
    await extractEntries(archivePath, extractDir, EXTRACT_BYTE_LIMIT, () => {}, expected)
  }
  if (typeof artifact.entries !== 'object' || artifact.entries === null) {
    throw new EnvToolError('no-pin', '压缩包工件缺少 entries 映射')
  }
  for (const [archiveEntry, binName] of Object.entries(artifact.entries)) {
    const extracted = join(extractDir, ...archiveEntry.split('/'))
    if (!existsSync(extracted)) {
      throw new EnvToolError('extract', `压缩包里找不到清单条目：${archiveEntry}`)
    }
    const target = join(binDir, binName)
    rmSync(target, { force: true })
    renameSync(extracted, target)
    if (process.platform !== 'win32') chmodSync(target, 0o755)
  }
}

/**
 * 启动一次环境安装（单飞）。校验在启动前同步做（未知工具/无 pin 立即 400），
 * 下载解压异步跑，进度强制+节流落 install-state.json（status 路由与跨重启
 * 续显都读它）。
 * @param settings - resolveSettings 的插件设置。
 * @param toolIds - 要装的工具 id。
 * @param deps - 测试注入：fetchImpl / spawnSyncImpl / pins 替换清单文件。
 * @returns 启动时的进度快照。
 * @throws {EnvToolError} 已有安装在跑（busy）、工具未知（unknown-tool）、平台无 pin（no-pin）。
 */
export function startEnvToolInstall(settings, toolIds, deps = {}) {
  if (activeInstall !== null) throw new EnvToolError('busy', '环境安装已在进行，请等它完成')
  const pins = deps.pins ?? loadPins()
  const uniqueIds = [...new Set(toolIds)]
  if (uniqueIds.length === 0) throw new EnvToolError('unknown-tool', '没有指定要安装的工具')
  for (const id of uniqueIds) platformEntry(pins, id)
  const state = initialState(uniqueIds)
  activeInstall = { state }
  void (async () => {
    try {
      rmSync(join(settings.envToolsDir, '.staging'), { recursive: true, force: true })
      persistInstallState(settings, state, { force: true })
      for (const toolId of uniqueIds) {
        await installOneTool(settings, state, toolId, deps, pins)
      }
      state.phase = 'done'
      state.current = null
    } catch (error) {
      state.phase = 'failed'
      state.detail = error instanceof Error ? error.message : String(error)
    } finally {
      activeInstall = null
      persistInstallState(settings, state, { force: true })
      await persistChain
    }
  })()
  return { ...state }
}

/**
 * 安装状态快照：install-state.json 是事实源（节流落盘保证贴近实时）；卡在
 * running 的历史态改判 interrupted——没有活进程在装。
 * @param settings - resolveSettings 的插件设置。
 * @returns `{ phase: 'idle'|'running'|'done'|'failed'|'interrupted', … }`。
 */
export async function envInstallStatus(settings) {
  if (activeInstall !== null) return { ...activeInstall.state }
  const file = join(settings.envToolsDir, 'install-state.json')
  const saved = await readFile(file, 'utf8').then(
    text => {
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    },
    () => null,
  )
  if (saved === null || typeof saved !== 'object') return { phase: 'idle' }
  if (saved.phase === 'running') return { ...saved, phase: 'interrupted', detail: '上次安装被中断（应用重启），可重新下载' }
  return saved
}
