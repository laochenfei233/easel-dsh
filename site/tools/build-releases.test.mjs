import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { categoryId, parseChangelog } from './build-releases.mjs'

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const changelogPath = resolve(siteDir, '..', 'CHANGELOG.md')

const FIXTURE = `# 更新日志

介绍段落，不参与渲染。

> 同一天多次构建时，只展示当天最终版本。

## 2026-10-24 · 0.2.1-alpha.31

**本次重点**：内容日历、免卸载升级。

### ✨ 新功能

- **内容日历**：显示法定节假日与农历节日。
- **免卸载升级**：双击安装包覆盖升级。

### 🐛 修复

- 修复备份区文字空白的问题。

> macOS 包仍未签名。

## 2026-10-15 · 0.2.1-alpha.2（基础阶段）

**本次重点**：并入 dsh。

### 🔧 改进

- **后端退役**：安装更简单。

---

## 已知限制

- Windows 安装包未签名。
- 存量会话无法自动补挂。
`

test('parses the three-category format with labels, notes, and limits', () => {
  const data = parseChangelog(FIXTURE)
  assert.equal(data.releases.length, 2)
  const [latest, older] = data.releases
  assert.equal(latest.version, '0.2.1-alpha.31')
  assert.equal(latest.date, '2026-10-24')
  assert.equal(latest.label, undefined)
  assert.equal(latest.highlight, '内容日历、免卸载升级。')
  assert.deepEqual(latest.categories.map((entry) => entry.id), ['features', 'fixes'])
  assert.deepEqual(latest.categories[0].items[0], { title: '内容日历', body: '显示法定节假日与农历节日。' })
  assert.deepEqual(latest.categories[1].items[0], { body: '修复备份区文字空白的问题。' })
  assert.equal(latest.note, 'macOS 包仍未签名。')
  assert.equal(older.version, '0.2.1-alpha.2')
  assert.equal(older.label, '基础阶段')
  assert.deepEqual(older.categories.map((entry) => entry.id), ['improvements'])
  assert.deepEqual(data.knownLimits, ['Windows 安装包未签名。', '存量会话无法自动补挂。'])
})

test('maps category headings to stable ids', () => {
  assert.equal(categoryId('✨ 新功能', 0), 'features')
  assert.equal(categoryId('🔧 改进', 1), 'improvements')
  assert.equal(categoryId('🐛 修复', 2), 'fixes')
  assert.equal(categoryId('📦 其他', 3), 'section-4')
})

test('the real changelog parses and matches its source text', async () => {
  const markdown = await readFile(changelogPath, 'utf8')
  const data = parseChangelog(markdown)
  assert.ok(data.releases.length >= 5, `expected at least 5 releases, got ${data.releases.length}`)
  assert.ok(data.knownLimits.length >= 1)
  for (const release of data.releases) {
    assert.match(release.version, /^\d+\.\d+\.\d+-alpha\.\d+$/)
    assert.ok(markdown.includes(`## ${release.date} · ${release.version}`), `${release.version} heading missing from source`)
    assert.ok(release.categories.length >= 1, `${release.version} has no categories`)
    for (const entry of release.categories) {
      assert.ok(entry.items.length >= 1, `${release.version} category ${entry.title} is empty`)
      for (const item of entry.items) {
        const text = item.body
        assert.ok(text.length > 0)
        assert.ok(markdown.includes(text), `item text missing from source: ${text}`)
      }
    }
  }
})

test('unknown lines fail with their line number', () => {
  const broken = FIXTURE.replace('- **后端退役**：安装更简单。', '- **后端退役** 安装更简单。')
  assert.throws(() => parseChangelog(broken), /CHANGELOG\.md:28: 无法解析的行/)
})

test('items before a category heading are rejected', () => {
  const broken = FIXTURE.replace('### ✨ 新功能\n\n', '')
  assert.throws(() => parseChangelog(broken), /条目缺少分类标题/)
})

test('a release without categories is rejected', () => {
  const broken = FIXTURE.replace(/### ✨ 新功能[\s\S]*?### 🐛 修复\n\n- 修复备份区文字空白的问题。\n/, '')
  assert.throws(() => parseChangelog(broken), /没有任何分类/)
})

test('dates must run newest first', () => {
  const swapped = FIXTURE
    .replace('## 2026-10-24 · 0.2.1-alpha.31', '## 2026-10-01 · 0.2.1-alpha.31')
    .replace('## 2026-10-15 · 0.2.1-alpha.2（基础阶段）', '## 2026-10-20 · 0.2.1-alpha.2（基础阶段）')
  assert.throws(() => parseChangelog(swapped), /必须从新到旧/)
})

test('duplicate versions are rejected', () => {
  const duplicated = `# 更新日志

## 2026-10-24 · 0.2.1-alpha.31

### ✨ 新功能

- 第一条。

## 2026-10-23 · 0.2.1-alpha.31

### ✨ 新功能

- 第二条。
`
  assert.throws(() => parseChangelog(duplicated), /版本重复/)
})

test('a changelog without releases is rejected', () => {
  assert.throws(() => parseChangelog('# 更新日志\n\n没有版本。\n'), /没有解析到任何版本/)
})
