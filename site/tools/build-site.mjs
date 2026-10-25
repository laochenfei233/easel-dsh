#!/usr/bin/env node
/**
 * Build the static product site: parse CHANGELOG.md, render the page, and
 * write `index.html`, assets, and the embedded release data into one output
 * directory. The page makes no third-party requests; versioned download
 * metadata comes from the mirror's downloads.json when a deployment provides
 * it, and degrades to a GitHub Release link otherwise.
 */

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseChangelog } from './build-releases.mjs'

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(siteDir, '..')

/** Canonical project links, overridable for a fork or an internal mirror. */
export const REPO_URL = 'https://github.com/laochenfei233/easel-dsh'
export const UPDATE_ENDPOINT = '/updates/latest.json'

const PLATFORMS = [
  ['windows-x86_64', 'x64', 'Windows x64'],
  ['windows-aarch64', 'arm64', 'Windows arm64'],
]

const BRUSH = '<svg class="brush" viewBox="0 0 86 9" aria-hidden="true"><path d="M2 6 Q28 1 52 4 T84 3" stroke="#b45309" stroke-width="4" stroke-linecap="round" fill="none"/></svg>'

/**
 * Escape text for HTML text nodes and quoted attributes.
 * @param {unknown} value - text to escape.
 * @returns {string} HTML-safe text.
 */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Validate the mirror's downloads.json before it is rendered.
 * @param {unknown} value - parsed JSON.
 * @returns {{version: string, pubDate: string | undefined, files: Record<string, {name: string, sha256: string, size: number}>}} Validated metadata.
 * @throws {Error} On an unusable version, file name, checksum, or size.
 */
export function validateDownloads(value) {
  const fail = (message) => {
    throw new Error(`downloads.json: ${message}`)
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('顶层必须是对象')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (typeof record.version !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z.-]*$/.test(record.version)) {
    fail(`版本不可用：${String(record.version)}`)
  }
  if (record.pubDate !== undefined && typeof record.pubDate !== 'string') fail('pubDate 必须是字符串')
  if (record.files === null || typeof record.files !== 'object' || Array.isArray(record.files)) fail('files 必须是对象')
  const cleaned = {}
  for (const [key, entry] of Object.entries(/** @type {Record<string, unknown>} */ (record.files))) {
    if (!PLATFORMS.some(([platform]) => platform === key)) fail(`未知平台：${key}`)
    if (entry === null || typeof entry !== 'object') fail(`平台 ${key} 的条目必须是对象`)
    const file = /** @type {Record<string, unknown>} */ (entry)
    if (typeof file.name !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(file.name)) {
      fail(`平台 ${key} 的文件名不可用：${String(file.name)}`)
    }
    if (typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(file.sha256)) {
      fail(`平台 ${key} 的 sha256 无效`)
    }
    if (!Number.isSafeInteger(file.size) || /** @type {number} */ (file.size) <= 0) {
      fail(`平台 ${key} 的文件大小无效`)
    }
    cleaned[key] = { name: file.name, sha256: /** @type {string} */ (file.sha256).toLowerCase(), size: /** @type {number} */ (file.size) }
  }
  if (Object.keys(cleaned).length === 0) fail('没有任何安装包')
  return {
    version: /** @type {string} */ (record.version),
    pubDate: /** @type {string | undefined} */ (record.pubDate),
    files: cleaned,
  }
}

/**
 * Escape text, rendering backtick spans as inline code. The changelog uses
 * backticks for filenames and commands; anything else stays plain text.
 * @param {unknown} value - source text.
 * @returns {string} HTML-safe text with `<code>` spans.
 */
export function renderInline(value) {
  return String(value)
    .split(/(`[^`]+`)/)
    .map((part) => (part.length > 2 && part.startsWith('`') && part.endsWith('`')
      ? `<code>${escapeHtml(part.slice(1, -1))}</code>`
      : escapeHtml(part)))
    .join('')
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value, fallback) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  return fallback
}

function fileHref(version, name) {
  return `releases/${encodeURIComponent(version)}/${encodeURIComponent(name)}`
}

/**
 * Render the hero download card: the current version and one button per
 * mirrored platform, or a GitHub Release link when no mirror data exists.
 * @param {object} input - latest release plus optional mirror metadata.
 * @returns {string} Card HTML.
 */
export function renderDownloadCard({ latest, downloads }) {
  const highlight = latest.highlight === undefined
    ? ''
    : `<p class="card-highlight">本次重点：${escapeHtml(latest.highlight.replace(/[。.]$/, ''))}</p>`
  if (downloads === undefined) {
    return `<div class="card-top">
  <p class="card-label">最新版本</p>
  <p class="card-date">${escapeHtml(latest.date)}</p>
</div>
<p class="card-version">${escapeHtml(latest.version)}</p>
${BRUSH}
${highlight}
<div class="card-actions">
  <a class="dl-btn is-default" href="${REPO_URL}/releases" rel="noopener"><span>去 GitHub 下载</span><small>Release</small></a>
</div>
<p class="card-note">安装包未签名，Windows 可能提示「未知发布者」；校验和由镜像同步后显示。</p>`
  }

  const buttons = PLATFORMS
    .filter(([platform]) => downloads.files[platform] !== undefined)
    .map(([platform, arch, label], index) => {
      const file = downloads.files[platform]
      const defaultClass = index === 0 ? ' is-default' : ''
      return `<a class="dl-btn${defaultClass}" href="${escapeHtml(fileHref(downloads.version, file.name))}" data-arch="${arch}"><span>下载 ${label}</span><small>${formatSize(file.size)}</small></a>`
    })
    .join('\n  ')

  const behind = latest.version === downloads.version
    ? ''
    : `<p class="card-note">更新日志已包含 ${escapeHtml(latest.version)}，镜像同步中。</p>`

  return `<div class="card-top">
  <p class="card-label">最新版本</p>
  <p class="card-date">${escapeHtml(formatDate(downloads.pubDate, latest.date))}</p>
</div>
<p class="card-version">${escapeHtml(downloads.version)}</p>
${BRUSH}
${highlight}
<div class="card-actions">
  ${buttons}
</div>
<p class="card-note">安装包未签名，Windows 可能提示「未知发布者」。</p>${behind}`
}

/**
 * Render the checksum table under the hero.
 * @param {{downloads?: object, latest: object}} input - mirror metadata when present.
 * @returns {string} Table or degraded hint HTML.
 */
export function renderFiles({ downloads, latest }) {
  if (downloads === undefined) {
    return '<p class="files-empty">镜像同步完成后，这里显示安装包直链与校验和。</p>'
  }
  const rows = PLATFORMS
    .filter(([platform]) => downloads.files[platform] !== undefined)
    .map(([platform, , label]) => {
      const file = downloads.files[platform]
      return `<tr>
  <td><a class="file-name" href="${escapeHtml(fileHref(downloads.version, file.name))}">${escapeHtml(file.name)}</a><br><span class="files-empty">${label}</span></td>
  <td>${formatSize(file.size)}</td>
  <td class="file-sha">${file.sha256}</td>
  <td><button class="copy" type="button" data-copy="${file.sha256}">复制</button></td>
</tr>`
    })
    .join('\n')
  return `<table>
<thead><tr><th>安装包</th><th>大小</th><th>SHA-256</th><th></th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`
}

function renderRelease(release) {
  const label = release.label === undefined ? '' : `<p class="release-label">${escapeHtml(release.label)}</p>`
  const highlight = release.highlight === undefined
    ? ''
    : `<p class="release-highlight">本次重点：${renderInline(release.highlight.replace(/[。.]$/, ''))}</p>`
  const categories = release.categories.map((entry) => {
    const items = entry.items.map((item) => (item.title === undefined
      ? `<p class="log-item log-item--plain">${renderInline(item.body)}</p>`
      : `<p class="log-item"><strong>${escapeHtml(item.title)}</strong>　${renderInline(item.body)}</p>`)).join('\n')
    return `<div class="cat">
  <p class="cat-title">${escapeHtml(entry.title)}</p>
  ${items}
</div>`
  }).join('\n')
  const note = release.note === undefined
    ? ''
    : `<p class="release-note">${release.note.split('\n').map(renderInline).join('<br>')}</p>`
  return `<article class="release">
  <header>
    <p class="release-date">${escapeHtml(release.date)}</p>
    <h3 class="release-version">${escapeHtml(release.version)}</h3>
    ${label}
  </header>
  <div>
    ${highlight}
    ${categories}
    ${note}
  </div>
</article>`
}

/**
 * Render the changelog: the newest release open, older ones behind a details
 * toggle. Content is embedded at build time.
 * @param {{releases: Array<object>}} data - parser output.
 * @returns {string} Changelog HTML.
 */
export function renderChangelog({ releases }) {
  const [latest, ...older] = releases
  const article = renderRelease(latest)
  if (older.length === 0) return article
  const rest = older.map(renderRelease).join('\n')
  return `${article}
<details class="older">
  <summary>更早的版本 · ${older.length}</summary>
  ${rest}
</details>`
}

/**
 * Render the known-limits list.
 * @param {string[]} knownLimits - limitations from the changelog.
 * @returns {string} `<li>` items.
 */
export function renderKnownLimits(knownLimits) {
  return knownLimits.map((entry) => `<li>${renderInline(entry)}</li>`).join('\n')
}

/**
 * Fill the page template.
 * @param {object} input - template text, parsed changelog, optional downloads.
 * @returns {string} Complete HTML.
 * @throws {Error} When a placeholder was left unreplaced.
 */
export function renderSite({ template, data, downloads, repoUrl = REPO_URL, endpoint = UPDATE_ENDPOINT }) {
  const latest = data.releases[0]
  const html = template
    .replace('<!--SITE:DOWNLOAD-->', renderDownloadCard({ latest, downloads }))
    .replace('<!--SITE:FILES-->', renderFiles({ downloads, latest }))
    .replace('<!--SITE:CHANGELOG-->', renderChangelog(data))
    .replace('<!--SITE:KNOWN-->', renderKnownLimits(data.knownLimits))
    .replaceAll('{{REPO_URL}}', escapeHtml(repoUrl))
    .replaceAll('{{RELEASES_URL}}', escapeHtml(`${repoUrl}/releases`))
    .replaceAll('{{ENDPOINT}}', escapeHtml(endpoint))
  const leftover = html.match(/\{\{[A-Z_]+\}\}|<!--SITE:[A-Z]+-->/)
  if (leftover !== null) throw new Error(`模板占位符未替换：${leftover[0]}`)
  return html
}

/**
 * Build the site into `outDir`.
 * @param {object} [options] - inputs; defaults target this checkout.
 * @param {string} [options.source] - CHANGELOG.md path.
 * @param {string} [options.downloadsPath] - mirror downloads.json; ignored when absent.
 * @param {string} [options.outDir] - output directory.
 * @returns {Promise<{outDir: string, version: string, releases: number, mirrored: boolean}>} Build summary.
 */
export async function buildSite({ source, downloadsPath, outDir } = {}) {
  const sourcePath = resolve(source ?? join(repoRoot, 'CHANGELOG.md'))
  const outDirectory = resolve(outDir ?? join(siteDir, 'dist'))
  const mirrorPath = resolve(downloadsPath ?? join(siteDir, 'data', 'downloads.json'))
  const data = parseChangelog(await readFile(sourcePath, 'utf8'))
  const downloads = existsSync(mirrorPath)
    ? validateDownloads(JSON.parse(await readFile(mirrorPath, 'utf8')))
    : undefined
  const template = await readFile(join(siteDir, 'index.template.html'), 'utf8')
  const html = renderSite({ template, data, downloads })
  await mkdir(outDirectory, { recursive: true })
  await writeFile(join(outDirectory, 'index.html'), html)
  await cp(join(siteDir, 'assets'), join(outDirectory, 'assets'), { recursive: true })
  await mkdir(join(outDirectory, 'data'), { recursive: true })
  await writeFile(join(outDirectory, 'data', 'releases.json'), `${JSON.stringify(data, null, 2)}\n`)
  if (downloads !== undefined) {
    await writeFile(join(outDirectory, 'data', 'downloads.json'), `${JSON.stringify(downloads, null, 2)}\n`)
  }
  return { outDir: outDirectory, version: data.releases[0].version, releases: data.releases.length, mirrored: downloads !== undefined }
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`未知参数：${token}`)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${token} 需要一个值`)
    args[token.slice(2)] = value
    index += 1
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const summary = await buildSite({
    source: args.source,
    downloadsPath: args.downloads,
    outDir: args['out-dir'],
  })
  const mirror = summary.mirrored ? '含镜像直链' : '无镜像数据（GitHub 兜底）'
  console.log(`site: ${summary.releases} 个版本，最新 ${summary.version}，${mirror} → ${summary.outDir}`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`build-site: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
