#!/usr/bin/env node
/**
 * Parse the repository CHANGELOG.md into the release index the product site
 * renders. The changelog is the single source of truth: three user-facing
 * categories per version, newest first, with an optional note.
 *
 * The parser is strict on purpose. An unrecognized line fails the build with
 * its line number instead of silently dropping a release entry, because the
 * site publishes exactly what this file says.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const RELEASE_HEADING = /^## (\d{4}-\d{2}-\d{2}) · ([0-9A-Za-z][0-9A-Za-z.-]*)(?:（([^）]+)）)?\s*$/
const CATEGORY_HEADING = /^### (.+?)\s*$/
const HIGHLIGHT = /^\*\*本次重点\*\*[：:]\s*(.+)$/
const ITEM_WITH_TITLE = /^- \*\*(.+?)\*\*[：:]\s*(.*)$/
const ITEM = /^- (.+)$/
const QUOTE = /^>\s?(.*)$/
const KNOWN_LIMITS_HEADING = /^## 已知限制\s*$/

/**
 * Map a category heading to a stable id the stylesheet can target.
 * @param {string} title - the heading text, emoji included.
 * @param {number} index - position within the release (fallback id).
 * @returns {string} `features`, `improvements`, `fixes`, or `section-N`.
 */
export function categoryId(title, index) {
  if (title.includes('新功能')) return 'features'
  if (title.includes('改进')) return 'improvements'
  if (title.includes('修复')) return 'fixes'
  return `section-${index + 1}`
}

/**
 * Parse the changelog markdown.
 * @param {string} markdown - full CHANGELOG.md contents.
 * @returns {{releases: Array<object>, knownLimits: string[]}} Releases newest first.
 * @throws {Error} On a malformed line, an empty release, or out-of-order dates.
 */
export function parseChangelog(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const releases = []
  const knownLimits = []
  /** @type {object | undefined} */
  let current
  /** @type {object | undefined} */
  let category
  let mode = 'head'

  const fail = (lineNo, message) => {
    throw new Error(`CHANGELOG.md:${lineNo}: ${message}`)
  }

  const finishRelease = () => {
    if (current === undefined) return
    if (current.categories.length === 0) fail(current.line, `版本 ${current.version} 没有任何分类`)
    for (const entry of current.categories) {
      if (entry.items.length === 0) fail(current.line, `版本 ${current.version} 的「${entry.title}」没有条目`)
    }
    delete current.line
    releases.push(current)
    current = undefined
    category = undefined
  }

  for (const [index, rawLine] of lines.entries()) {
    const lineNo = index + 1
    const line = rawLine.trimEnd()
    if (line.trim() === '') continue

    if (mode === 'head') {
      if (line.startsWith('# ') || QUOTE.test(line)) continue
      const heading = line.match(RELEASE_HEADING)
      if (heading !== null) {
        mode = 'release'
        current = {
          version: heading[2],
          date: heading[1],
          label: heading[3],
          categories: [],
          line: lineNo,
        }
        continue
      }
      if (KNOWN_LIMITS_HEADING.test(line)) {
        mode = 'limits'
        continue
      }
      // Narrative intro before the first release is not rendered; skip it.
      if (!line.startsWith('## ')) continue
      fail(lineNo, `无法识别的二级标题：${line}`)
    }

    if (mode === 'release') {
      if (line === '---') {
        finishRelease()
        mode = 'limits-scan'
        continue
      }
      if (KNOWN_LIMITS_HEADING.test(line)) {
        finishRelease()
        mode = 'limits'
        continue
      }
      const heading = line.match(RELEASE_HEADING)
      if (heading !== null) {
        finishRelease()
        current = {
          version: heading[2],
          date: heading[1],
          label: heading[3],
          categories: [],
          line: lineNo,
        }
        continue
      }
      if (line.startsWith('## ')) fail(lineNo, `无法识别的二级标题：${line}`)
      const categoryHeading = line.match(CATEGORY_HEADING)
      if (categoryHeading !== null) {
        const id = categoryId(categoryHeading[1], current.categories.length)
        if (current.categories.some((entry) => entry.id === id)) {
          fail(lineNo, `版本 ${current.version} 的「${categoryHeading[1]}」分类重复`)
        }
        category = { id, title: categoryHeading[1].trim(), items: [] }
        current.categories.push(category)
        continue
      }
      const highlight = line.match(HIGHLIGHT)
      if (highlight !== null) {
        current.highlight = highlight[1].trim()
        continue
      }
      const quote = line.match(QUOTE)
      if (quote !== null) {
        current.note = current.note === undefined ? quote[1].trim() : `${current.note}\n${quote[1].trim()}`
        continue
      }
      const titledItem = line.match(ITEM_WITH_TITLE)
      if (titledItem !== null) {
        if (category === undefined) fail(lineNo, `版本 ${current.version} 的条目缺少分类标题`)
        category.items.push({ title: titledItem[1].trim(), body: titledItem[2].trim() })
        continue
      }
      // A bold item without the full-width colon is a format slip, not a
      // plain bullet; publishing it would leak the asterisks onto the page.
      if (line.startsWith('- **')) fail(lineNo, `无法解析的行：${line}`)
      const item = line.match(ITEM)
      if (item !== null) {
        if (category === undefined) fail(lineNo, `版本 ${current.version} 的条目缺少分类标题`)
        category.items.push({ body: item[1].trim() })
        continue
      }
      fail(lineNo, `无法解析的行：${line}`)
    }

    if (mode === 'limits-scan') {
      if (KNOWN_LIMITS_HEADING.test(line)) mode = 'limits'
      continue
    }

    if (mode === 'limits') {
      const item = line.match(ITEM)
      if (item !== null) knownLimits.push(item[1].trim())
    }
  }

  finishRelease()

  if (releases.length === 0) {
    throw new Error('CHANGELOG.md: 没有解析到任何版本')
  }

  const seen = new Set()
  let previousDate = '9999-99-99'
  for (const release of releases) {
    if (seen.has(release.version)) throw new Error(`CHANGELOG.md: 版本重复：${release.version}`)
    seen.add(release.version)
    if (Number.isNaN(Date.parse(`${release.date}T00:00:00Z`))) {
      throw new Error(`CHANGELOG.md: 日期无效：${release.date}`)
    }
    if (release.date > previousDate) {
      throw new Error(`CHANGELOG.md: 版本 ${release.version} 的日期晚于上一条，更新日志必须从新到旧`)
    }
    previousDate = release.date
    if (release.label === undefined) delete release.label
  }

  return { releases, knownLimits }
}

/**
 * Write the release index as JSON.
 * @param {{releases: Array<object>, knownLimits: string[]}} data - parser output.
 * @param {string} outPath - destination file.
 * @returns {Promise<void>} Resolves once the file is written.
 */
export async function writeReleasesJson(data, outPath) {
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`)
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
  const source = resolve(args.source ?? resolve(siteDir, '..', 'CHANGELOG.md'))
  const out = resolve(args.out ?? resolve(siteDir, 'dist', 'data', 'releases.json'))
  const data = parseChangelog(await readFile(source, 'utf8'))
  await writeReleasesJson(data, out)
  console.log(`releases.json: ${data.releases.length} 个版本 → ${out}`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`build-releases: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
