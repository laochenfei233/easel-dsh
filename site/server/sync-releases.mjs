#!/usr/bin/env node
/**
 * Mirror the newest published GitHub Release into the site's web root.
 *
 * The updater and the download page read one pointer, `updates/latest.json`.
 * That pointer is written last, after every artifact it names exists on disk
 * and its checksum has been computed, so a failed run leaves the previous
 * version fully usable and the next timer beat retries from scratch.
 *
 * Environment: EASEL_WEBROOT (served directory), EASEL_ORIGIN (absolute site
 * origin used in updater URLs), EASEL_REPO, EASEL_KEEP_VERSIONS, GITHUB_TOKEN,
 * and NODE_USE_ENV_PROXY=1 with HTTPS_PROXY for networks that need a proxy.
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_DEFAULT = 'laochenfei233/easel-dsh'
const API_BASE = 'https://api.github.com'

const PLATFORMS = [
  ['x64', 'windows-x86_64'],
  ['arm64', 'windows-aarch64'],
]

const SAFE_ASSET_NAME = /^[0-9A-Za-z][0-9A-Za-z._-]*$/

/**
 * Split a semver string; returns undefined when it is not semver.
 * @param {string} value - version like `0.2.1-alpha.31`.
 * @returns {{core: number[], pre: string[]} | undefined} Parsed parts.
 */
export function parseVersion(value) {
  if (typeof value !== 'string') return undefined
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value)
  if (match === null) return undefined
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] === undefined ? [] : match[4].split('.'),
  }
}

/**
 * Compare two semver versions (semver §11: release > prerelease, numeric
 * prerelease identifiers sort before alphanumeric ones).
 * @param {string} left - first version.
 * @param {string} right - second version.
 * @returns {-1 | 0 | 1} Ordering of the two versions.
 * @throws {Error} When either side is not semver.
 */
export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === undefined || b === undefined) throw new Error(`版本号无法比较：${left} / ${right}`)
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] < b.core[index] ? -1 : 1
  }
  if (a.pre.length === 0 && b.pre.length === 0) return 0
  if (a.pre.length === 0) return 1
  if (b.pre.length === 0) return -1
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
    const x = a.pre[index]
    const y = b.pre[index]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNumeric = /^\d+$/.test(x)
    const yNumeric = /^\d+$/.test(y)
    if (xNumeric && yNumeric) {
      const delta = Number(x) - Number(y)
      if (delta !== 0) return delta < 0 ? -1 : 1
      continue
    }
    if (xNumeric) return -1
    if (yNumeric) return 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Version from a release tag, without the conventional `v` prefix.
 * @param {object} release - GitHub release JSON.
 * @returns {string} Semver version.
 * @throws {Error} When the tag is not a usable version.
 */
export function releaseVersion(release) {
  const tag = typeof release?.tag_name === 'string' ? release.tag_name.trim() : ''
  const version = tag.replace(/^v/i, '')
  if (parseVersion(version) === undefined) throw new Error(`无法识别的 release tag：${tag}`)
  return version
}

/**
 * Pick the highest published release. Drafts and prereleases never become an
 * update source, and list order is not trusted: a late-published older draft
 * must not hide a newer release.
 * @param {object[]} releases - GitHub release list.
 * @returns {object | undefined} The chosen release.
 */
export function selectPublishedRelease(releases) {
  if (!Array.isArray(releases)) throw new Error('GitHub 返回的 release 列表不是数组')
  let best
  for (const release of releases) {
    if (release?.draft !== false || release?.prerelease !== false) continue
    if (best === undefined || compareVersions(releaseVersion(release), releaseVersion(best)) > 0) best = release
  }
  return best
}

function assertAssetName(name) {
  if (typeof name !== 'string' || !SAFE_ASSET_NAME.test(name)) throw new Error(`不可用的资产名：${String(name)}`)
  return name
}

function assertHttpsUrl(value) {
  if (typeof value !== 'string') throw new Error(`不可用的资产地址：${String(value)}`)
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`不支持的资产地址协议：${value}`)
  return value
}

/**
 * Map one release's assets onto Windows platform entries. A release that
 * carries an installer without its signature (or the reverse) is incomplete
 * and must never reach the pointer.
 * @param {object} release - GitHub release JSON.
 * @returns {{version: string, notes: string, pubDate: string, platforms: Record<string, {arch: string, exe: object, sig: object}>}} Asset plan.
 * @throws {Error} When a platform is incomplete or no Windows installer exists.
 */
export function mapAssets(release) {
  const version = releaseVersion(release)
  const assets = Array.isArray(release?.assets) ? release.assets : []
  const find = (pattern) => assets.find((asset) => typeof asset?.name === 'string' && pattern.test(asset.name))
  const platforms = {}
  for (const [arch, platform] of PLATFORMS) {
    const exe = find(new RegExp(`(?:^|_)${arch}-setup\\.exe$`))
    const sig = find(new RegExp(`(?:^|_)${arch}-setup\\.exe\\.sig$`))
    if (exe === undefined && sig === undefined) continue
    if (exe === undefined || sig === undefined) {
      const missing = exe === undefined ? '安装文件' : '签名文件'
      throw new Error(`版本 ${version} 的 ${arch} 安装包缺少${missing}，发布不完整`)
    }
    platforms[platform] = {
      arch,
      exe: {
        name: assertAssetName(exe.name),
        url: assertHttpsUrl(exe.browser_download_url),
        size: typeof exe.size === 'number' ? exe.size : undefined,
      },
      sig: {
        name: assertAssetName(sig.name),
        url: assertHttpsUrl(sig.browser_download_url),
      },
    }
  }
  if (Object.keys(platforms).length === 0) throw new Error(`版本 ${version} 没有任何 Windows 安装包`)
  return {
    version,
    notes: typeof release?.body === 'string' ? release.body.trim() : '',
    pubDate: typeof release?.published_at === 'string' ? release.published_at : new Date().toISOString(),
    platforms,
  }
}

/**
 * Build the Tauri updater manifest.
 * @param {object} input - version, notes, pub date, public origin, and per-platform files.
 * @returns {object} `latest.json` contents.
 */
export function buildLatestJson({ version, notes, pubDate, origin, platforms }) {
  const base = origin.replace(/\/+$/, '')
  const manifest = { version, notes, pub_date: pubDate, platforms: {} }
  for (const [platform, entry] of Object.entries(platforms)) {
    manifest.platforms[platform] = {
      signature: entry.signature,
      url: `${base}/releases/${encodeURIComponent(version)}/${encodeURIComponent(entry.name)}`,
    }
  }
  return manifest
}

/**
 * Build the download-page metadata written beside the pointer.
 * @param {object} input - version, pub date, and per-platform files with checksums.
 * @returns {object} `downloads.json` contents.
 */
export function buildDownloadsJson({ version, pubDate, platforms }) {
  const files = {}
  for (const [platform, entry] of Object.entries(platforms)) {
    files[platform] = { name: entry.name, sha256: entry.sha256, size: entry.size }
  }
  return { version, pubDate, files }
}

async function readPointer(file, log) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw new Error(`无法读取 ${file}：${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    // A corrupt pointer is already useless to the app; rebuild it from the
    // release, but say so rather than overwriting in silence.
    log(`[sync] ${file} 无法解析，将重建：${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

async function writeAtomic(file, bytes) {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.part-${process.pid}`
  await writeFile(temporary, bytes)
  await rename(temporary, file)
}

async function writeJsonAtomic(file, value) {
  await writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`)
}

async function fetchWithRetry(fetchAsset, url, attempts, delayMs) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchAsset(url)
    } catch (error) {
      lastError = error
      if (attempt < attempts && delayMs > 0) {
        await new Promise((settle) => setTimeout(settle, delayMs * attempt))
      }
    }
  }
  throw lastError
}

async function pruneOldVersions(releasesDir, currentVersion, keep, log) {
  if (!Number.isInteger(keep) || keep < 1) return
  let entries
  try {
    entries = await readdir(releasesDir, { withFileTypes: true })
  } catch {
    return
  }
  const versions = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => parseVersion(name) !== undefined)
    .sort((left, right) => compareVersions(right, left))
  for (const version of versions.slice(keep)) {
    if (version === currentVersion) continue
    await rm(join(releasesDir, version), { recursive: true, force: true })
    log(`[sync] 清理旧版本 ${version}`)
  }
}

/**
 * Mirror one release: download installers and signatures, verify the bytes,
 * then move `latest.json` last. A throw at any point leaves the previous
 * pointer untouched.
 * @param {object} input - release, web root, origin, and injectable IO.
 * @returns {Promise<{status: 'current' | 'updated', version: string, files?: string[]}>} Outcome.
 */
export async function mirrorRelease({
  release,
  webroot,
  origin,
  fetchAsset = defaultFetchAsset,
  keepVersions = 3,
  retryDelayMs = 1_000,
  log = console.log,
}) {
  const plan = mapAssets(release)
  const pointerFile = join(webroot, 'updates', 'latest.json')
  const pointer = await readPointer(pointerFile, log)
  if (typeof pointer?.version === 'string' && parseVersion(pointer.version) !== undefined) {
    if (compareVersions(plan.version, pointer.version) <= 0) {
      log(`[sync] ${pointer.version} 已是最新，跳过 ${plan.version}`)
      return { status: 'current', version: pointer.version }
    }
  }

  const assetDir = join(webroot, 'releases', plan.version)
  await mkdir(assetDir, { recursive: true })
  const files = {}
  for (const [platform, entry] of Object.entries(plan.platforms)) {
    const exeBytes = await fetchWithRetry(fetchAsset, entry.exe.url, 3, retryDelayMs)
    const sigBytes = await fetchWithRetry(fetchAsset, entry.sig.url, 3, retryDelayMs)
    const signature = sigBytes.toString('utf8').trim()
    if (signature.length === 0) throw new Error(`${plan.version} 的 ${platform} 签名文件为空`)
    await writeAtomic(join(assetDir, entry.exe.name), exeBytes)
    await writeAtomic(join(assetDir, entry.sig.name), sigBytes)
    files[platform] = {
      name: entry.exe.name,
      signature,
      sha256: createHash('sha256').update(exeBytes).digest('hex'),
      size: exeBytes.length,
    }
  }

  // Artifacts are on disk; now the pointers. latest.json goes last so the
  // updater never sees a version whose installers are incomplete.
  await writeJsonAtomic(
    join(webroot, 'updates', 'downloads.json'),
    buildDownloadsJson({ version: plan.version, pubDate: plan.pubDate, platforms: files }),
  )
  await writeJsonAtomic(
    pointerFile,
    buildLatestJson({ version: plan.version, notes: plan.notes, pubDate: plan.pubDate, origin, platforms: files }),
  )
  await pruneOldVersions(join(webroot, 'releases'), plan.version, keepVersions, log)
  log(`[sync] ${plan.version} 已镜像：${Object.keys(files).join(', ')}`)
  return { status: 'updated', version: plan.version, files: Object.keys(files) }
}

/**
 * Fetch an asset over HTTPS.
 * @param {string} url - absolute asset URL.
 * @returns {Promise<Buffer>} Response body.
 * @throws {Error} On a non-2xx response.
 */
export async function defaultFetchAsset(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'easel-site-sync' },
  })
  if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}：${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function listPublishedReleases(repo) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'easel-site-sync',
  }
  if (process.env.GITHUB_TOKEN !== undefined && process.env.GITHUB_TOKEN !== '') {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const response = await fetch(`${API_BASE}/repos/${repo}/releases?per_page=20`, { headers })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}：${(await response.text()).slice(0, 200)}`)
  }
  return response.json()
}

/**
 * Timer entry point: read configuration from the environment and mirror the
 * newest published release.
 * @returns {Promise<object>} Mirror outcome.
 */
export async function main() {
  const webroot = process.env.EASEL_WEBROOT
  const origin = process.env.EASEL_ORIGIN
  const repo = process.env.EASEL_REPO ?? REPO_DEFAULT
  const keepVersions = Number.parseInt(process.env.EASEL_KEEP_VERSIONS ?? '3', 10)
  if (webroot === undefined || webroot === '') throw new Error('EASEL_WEBROOT 未设置')
  if (origin === undefined || origin === '') throw new Error('EASEL_ORIGIN 未设置（例如 https://easel.example.cn）')
  const release = selectPublishedRelease(await listPublishedReleases(repo))
  if (release === undefined) {
    console.log('[sync] 没有已发布的版本')
    return { status: 'no-release' }
  }
  return mirrorRelease({ release, webroot: resolve(webroot), origin, keepVersions })
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[sync] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
