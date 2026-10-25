import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseChangelog } from './build-releases.mjs'
import {
  buildSite,
  escapeHtml,
  renderDownloadCard,
  renderFiles,
  renderInline,
  renderSite,
  validateDownloads,
} from './build-site.mjs'

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const changelogPath = resolve(siteDir, '..', 'CHANGELOG.md')

const DOWNLOADS = {
  version: '0.2.1-alpha.31',
  pubDate: '2026-10-24T15:20:00Z',
  files: {
    'windows-x86_64': {
      name: 'Easel-dsh_0.2.1-alpha.31_x64-setup.exe',
      sha256: 'a'.repeat(64),
      size: 132_120_576,
    },
    'windows-aarch64': {
      name: 'Easel-dsh_0.2.1-alpha.31_arm64-setup.exe',
      sha256: 'b'.repeat(64),
      size: 128_974_848,
    },
  },
}

async function template() {
  return readFile(join(siteDir, 'index.template.html'), 'utf8')
}

test('escapes HTML in text and attributes', () => {
  assert.equal(escapeHtml('<script> & "x"'), '&lt;script&gt; &amp; &quot;x&quot;')
})

test('renders backtick spans as inline code with escaped contents', () => {
  assert.equal(renderInline('合并 `.env` 文件'), '合并 <code>.env</code> 文件')
  assert.equal(renderInline('`<b>`'), '<code>&lt;b&gt;</code>')
  assert.equal(renderInline('`a` 与 `b`'), '<code>a</code> 与 <code>b</code>')
  assert.equal(renderInline('没有代码'), '没有代码')
})

test('renders the download card with relative mirror links and defaults x64', () => {
  const html = renderDownloadCard({
    latest: { version: '0.2.1-alpha.31', date: '2026-10-24', highlight: '内容日历。' },
    downloads: DOWNLOADS,
  })
  assert.match(html, /releases\/0\.2\.1-alpha\.31\/Easel-dsh_0\.2\.1-alpha\.31_x64-setup\.exe/)
  assert.match(html, /releases\/0\.2\.1-alpha\.31\/Easel-dsh_0\.2\.1-alpha\.31_arm64-setup\.exe/)
  assert.match(html, /data-arch="x64"/)
  assert.match(html, /data-arch="arm64"/)
  assert.match(html, /class="dl-btn is-default" href="releases\/0\.2\.1-alpha\.31\/Easel-dsh_0\.2\.1-alpha\.31_x64-setup\.exe"/)
  assert.match(html, /126\.0 MB/)
  assert.match(html, /本次重点：内容日历/)
  assert.match(html, /安装包未签名/)
})

test('degrades to the GitHub release link without mirror data', () => {
  const card = renderDownloadCard({ latest: { version: '0.2.1-alpha.31', date: '2026-10-24' } })
  assert.match(card, /去 GitHub 下载/)
  assert.match(card, /https:\/\/github\.com\/laochenfei233\/easel-dsh\/releases/)
  const files = renderFiles({ downloads: undefined, latest: { version: '0.2.1-alpha.31' } })
  assert.match(files, /files-empty/)
  assert.match(files, /镜像同步完成后/)
})

test('renders the checksum table with copy buttons', () => {
  const files = renderFiles({ downloads: DOWNLOADS, latest: { version: '0.2.1-alpha.31' } })
  assert.match(files, /data-copy="a{64}"/)
  assert.match(files, /data-copy="b{64}"/)
  assert.match(files, /Windows x64/)
  assert.match(files, /Windows arm64/)
})

test('validates mirror metadata before rendering', () => {
  assert.throws(() => validateDownloads({ ...DOWNLOADS, version: 'v 0.2.1' }), /版本不可用/)
  assert.throws(() => validateDownloads({ ...DOWNLOADS, files: {} }), /没有任何安装包/)
  assert.throws(
    () => validateDownloads({ ...DOWNLOADS, files: { 'windows-x86_64': { ...DOWNLOADS.files['windows-x86_64'], name: '../x.exe' } } }),
    /文件名不可用/,
  )
  assert.throws(
    () => validateDownloads({ ...DOWNLOADS, files: { 'windows-x86_64': { ...DOWNLOADS.files['windows-x86_64'], sha256: 'xyz' } } }),
    /sha256 无效/,
  )
  assert.throws(
    () => validateDownloads({ ...DOWNLOADS, files: { 'windows-x86_64': { ...DOWNLOADS.files['windows-x86_64'], size: 0 } } }),
    /文件大小无效/,
  )
  assert.throws(
    () => validateDownloads({ ...DOWNLOADS, files: { 'linux-x86_64': DOWNLOADS.files['windows-x86_64'] } }),
    /未知平台/,
  )
  const cleaned = validateDownloads(DOWNLOADS)
  assert.equal(cleaned.version, '0.2.1-alpha.31')
  assert.equal(Object.keys(cleaned.files).length, 2)
})

test('fills every template placeholder and embeds escaped release data', async () => {
  const data = parseChangelog(await readFile(changelogPath, 'utf8'))
  const html = renderSite({ template: await template(), data })
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}|<!--SITE:[A-Z]+-->/)
  assert.ok(html.includes(data.releases[0].version))
  assert.ok(html.includes(data.releases[0].categories[0].items[0].body))
  assert.ok(html.includes('/updates/latest.json'))
  assert.ok(html.includes('https://github.com/laochenfei233/easel-dsh'))
})

test('escapes changelog content through the whole render', async () => {
  const data = parseChangelog(`# 更新日志

## 2026-10-24 · 0.2.1-alpha.31

**本次重点**：<b>加粗</b>。

### ✨ 新功能

- **注入**：<script>alert("x")</script>
`)
  const html = renderSite({ template: await template(), data })
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
})

test('builds the full site into an output directory', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'easel-site-'))
  try {
    const summary = await buildSite({ outDir })
    assert.equal(summary.mirrored, false)
    const html = await readFile(join(outDir, 'index.html'), 'utf8')
    const expected = parseChangelog(await readFile(changelogPath, 'utf8'))
    assert.equal(summary.releases, expected.releases.length)
    assert.ok(html.includes(expected.releases[0].version))
    assert.ok(existsSync(join(outDir, 'assets', 'site.css')))
    assert.ok(existsSync(join(outDir, 'assets', 'easel-hero.svg')))
    const releases = JSON.parse(await readFile(join(outDir, 'data', 'releases.json'), 'utf8'))
    assert.equal(releases.releases.length, expected.releases.length)
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})

test('builds with mirror metadata and embeds the download links', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'easel-site-'))
  const downloadsPath = join(outDir, 'downloads.json')
  try {
    await writeFile(downloadsPath, JSON.stringify(DOWNLOADS))
    const summary = await buildSite({ outDir, downloadsPath })
    assert.equal(summary.mirrored, true)
    const html = await readFile(join(outDir, 'index.html'), 'utf8')
    assert.match(html, /releases\/0\.2\.1-alpha\.31\/Easel-dsh_0\.2\.1-alpha\.31_x64-setup\.exe/)
    assert.ok(existsSync(join(outDir, 'data', 'downloads.json')))
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
})
