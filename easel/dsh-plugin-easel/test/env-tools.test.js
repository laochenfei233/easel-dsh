// 运行环境自动装配（spec easel-breakdown-env-bootstrap）的引擎测试：
// 解析顺序、下载校验/备源切换、zip 落位、进度状态跨重启语义。清单与 fetch
// 都走注入缝，测试不触碰真实网络与真实 pin 清单。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import {
  EnvToolError, checkEnvTools, envInstallStatus, envPlatformKey, requiresYtDlp, resolveEnvTool, startEnvToolInstall,
} from '../lib/env-tools.js'

function tempRoot(tag) {
  const root = mkdtempSync(join(tmpdir(), `env-tools-${tag}-`))
  mkdirSync(join(root, 'bin'), { recursive: true })
  return root
}

/** 与被测模块同源算法：fixture 字节算出 pin 期望的 sha256。 */
function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** 现实形状的最小 pin 清单：ffmpeg=zip 工件（两源），yt-dlp=file 工件。 */
function fixturePins({ zipBytes, fileBytes, wrongSha }) {
  return {
    schemaVersion: 1,
    tools: {
      ffmpeg: {
        bins: ['ffmpeg', 'ffprobe'],
        files: {
          'windows-amd64': {
            artifacts: [
              {
                kind: 'zip',
                sources: [
                  { url: 'https://mirror.test/ffmpeg.zip', sha256: wrongSha ? 'dead'.repeat(16) : sha256Of(zipBytes), bytes: zipBytes.length },
                  { url: 'https://fallback.test/ffmpeg.zip', sha256: sha256Of(zipBytes), bytes: zipBytes.length },
                ],
                entries: { 'build/bin/ffmpeg.exe': 'ffmpeg.exe', 'build/bin/ffprobe.exe': 'ffprobe.exe' },
              },
            ],
          },
        },
      },
      'yt-dlp': {
        bins: ['yt-dlp'],
        files: {
          'windows-amd64': {
            artifacts: [
              {
                kind: 'file',
                outName: 'yt-dlp.exe',
                sources: [{ url: 'https://mirror.test/yt-dlp.exe', sha256: sha256Of(fileBytes), bytes: fileBytes.length }],
              },
            ],
          },
        },
      },
    },
  }
}

test('envPlatformKey matches the runtime-inputs.json key style', () => {
  assert.equal(envPlatformKey('win32', 'x64'), 'windows-amd64')
  assert.equal(envPlatformKey('darwin', 'arm64'), 'darwin-arm64')
  assert.equal(envPlatformKey('darwin', 'x64'), 'darwin-amd64')
  assert.equal(envPlatformKey('linux', 'x64'), 'linux-amd64')
})

test('requiresYtDlp only for generic-download platforms', () => {
  for (const platform of ['douyin', 'xhs', 'kuaishou', 'sph']) {
    assert.equal(requiresYtDlp(platform), false, platform)
  }
  for (const platform of ['bili', 'youtube', 'other']) {
    assert.equal(requiresYtDlp(platform), true, platform)
  }
})

test('resolveEnvTool prefers PATH then tools/bin then missing', () => {
  const root = tempRoot('resolve')
  try {
    const settings = { envToolsDir: root }
    const pins = fixturePins({ zipBytes: Buffer.alloc(0), fileBytes: Buffer.alloc(0), wrongSha: false })
    const spawnOnPath = bin => ({ status: 0, stdout: `${bin} version 1.0`, stderr: '', error: undefined })
    const deps = { spawnSyncImpl: spawnOnPath, pins }
    const resolved = resolveEnvTool(settings, 'ffmpeg', deps)
    assert.equal(resolved.installed, true)
    assert.equal(resolved.bins.ffmpeg.source, 'path')
    // PATH 探测失败但 tools/bin 有文件 → tools 源（stub 按绝对路径区分两者）。
    const noPath = () => ({ status: null, stdout: '', stderr: '', error: new Error('ENOENT') })
    const localOnly = bin => (bin.includes('/') || bin.includes('\\'))
      ? { status: 0, stdout: `${bin} version 2.0`, stderr: '', error: undefined }
      : noPath()
    writeFileSync(join(root, 'bin', 'ffmpeg.exe'), 'binary')
    const resolvedLocal = resolveEnvTool(settings, 'ffmpeg', { ...deps, spawnSyncImpl: localOnly })
    assert.equal(resolvedLocal.bins.ffmpeg.source, 'tools')
    assert.equal(resolvedLocal.bins.ffmpeg.path, join(root, 'bin', 'ffmpeg.exe'))
    // 两个 bin 只有一个在 → 未就绪，missing 列出缺的。
    const partial = checkEnvTools(settings, ['ffmpeg'], { ...deps, spawnSyncImpl: localOnly })
    assert.equal(partial.ready, false)
    assert.deepEqual(partial.tools[0].missing, ['ffprobe'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('install downloads, verifies sha256, switches source on mismatch, and places zip entries', async () => {
  const root = tempRoot('install-zip')
  try {
    const settings = { envToolsDir: root }
    // PATH 探测一律失败，逼走下载路径。
    const noPath = () => ({ status: null, stdout: '', stderr: '', error: new Error('ENOENT') })
    const zipBytes = zipSync({
      build: { bin: { 'ffmpeg.exe': strToU8('ffmpeg-bytes'), 'ffprobe.exe': strToU8('ffprobe-bytes') } },
    })
    const pins = fixturePins({ zipBytes, fileBytes: Buffer.alloc(0), wrongSha: true })
    const urls = []
    const deps = {
      spawnSyncImpl: noPath,
      pins,
      fetchImpl: async url => {
        urls.push(String(url))
        if (String(url).startsWith('https://fallback.test/')) {
          return new Response(zipBytes, { status: 200, headers: { 'content-length': String(zipBytes.length) } })
        }
        throw new Error('mirror down')
      },
    }
    startEnvToolInstall(settings, ['ffmpeg'], deps)
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const status = await envInstallStatus(settings)
      if (status.phase === 'done' || status.phase === 'failed') break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const status = await envInstallStatus(settings)
    assert.equal(status.phase, 'done', `install should finish, detail: ${status.detail}`)
    assert.deepEqual(urls, [
      'https://mirror.test/ffmpeg.zip', 'https://mirror.test/ffmpeg.zip', 'https://fallback.test/ffmpeg.zip',
    ], 'each source gets its retries, then the next source takes over')
    assert.equal(readFileSync(join(root, 'bin', 'ffmpeg.exe'), 'utf8'), 'ffmpeg-bytes')
    assert.equal(readFileSync(join(root, 'bin', 'ffprobe.exe'), 'utf8'), 'ffprobe-bytes')
    assert.ok(existsSync(join(root, 'state.json')), 'installed tools are recorded')
    assert.ok(!existsSync(join(root, '.staging')), 'staging is cleaned up')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('install of a file artifact lands outName; truncated download fails loud', async () => {
  const root = tempRoot('install-file')
  try {
    const settings = { envToolsDir: root }
    const noPath = () => ({ status: null, stdout: '', stderr: '', error: new Error('ENOENT') })
    const fileBytes = Buffer.from('yt-dlp-binary')
    const pins = fixturePins({ zipBytes: Buffer.alloc(0), fileBytes, wrongSha: false })
    // content-length 声称更大 → 截断检测必须拒绝落位。
    const deps = {
      spawnSyncImpl: noPath,
      pins,
      fetchImpl: async () => new Response(fileBytes.subarray(0, 5), {
        status: 200,
        headers: { 'content-length': String(fileBytes.length) },
      }),
    }
    startEnvToolInstall(settings, ['yt-dlp'], deps)
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const status = await envInstallStatus(settings)
      if (status.phase === 'done' || status.phase === 'failed') break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const status = await envInstallStatus(settings)
    assert.equal(status.phase, 'failed', 'a truncated download must not settle to done')
    assert.equal(existsSync(join(root, 'bin', 'yt-dlp.exe')), false, 'no binary lands on a failed install')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('platform without pins fails loud instead of silently skipping', async () => {
  const root = tempRoot('no-pin')
  try {
    const settings = { envToolsDir: root }
    const pins = fixturePins({ zipBytes: Buffer.alloc(0), fileBytes: Buffer.alloc(0), wrongSha: false })
    assert.throws(() => startEnvToolInstall(settings, ['yt-dlp'], { pins: { schemaVersion: 1, tools: { 'yt-dlp': { bins: ['yt-dlp'], files: {} } } } }),
      error => error instanceof EnvToolError && error.code === 'no-pin')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('install-state.json stuck at running reads back as interrupted', async () => {
  const root = tempRoot('interrupted')
  try {
    const settings = { envToolsDir: root }
    writeFileSync(join(root, 'install-state.json'), JSON.stringify({ phase: 'running', tools: ['ffmpeg'] }))
    const status = await envInstallStatus(settings)
    assert.equal(status.phase, 'interrupted')
    assert.match(String(status.detail), /中断/)
    writeFileSync(join(root, 'install-state.json'), JSON.stringify({ phase: 'failed', detail: 'boom' }))
    const failed = await envInstallStatus(settings)
    assert.equal(failed.phase, 'failed')
    assert.equal(failed.detail, 'boom')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
