import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  composeMaterialMarkdown, createMaterialHandler, ConversationMaterialError,
  materialFileName, firstLineTitle,
} from '../lib/conversation-material.js'

test('firstLineTitle: 首个非空行、剥 Markdown 记号、截 40', () => {
  assert.equal(firstLineTitle('第一行标题\n第二行'), '第一行标题')
  assert.equal(firstLineTitle('\n\n  ## 二级标题内容'), '二级标题内容')
  assert.equal(firstLineTitle('> 引用行'), '引用行')
  assert.equal(firstLineTitle('- 列表项'), '列表项')
  assert.equal(firstLineTitle('3. 编号项'), '编号项')
  assert.equal(firstLineTitle('一'.repeat(60)), '一'.repeat(40))
  assert.equal(firstLineTitle(''), '')
  assert.equal(firstLineTitle('---'), '')
  assert.equal(firstLineTitle(null), '')
})

test('materialFileName: slug+hash8、同文本同名、非法字符清洗、空标题回退', () => {
  const a = materialFileName('标题', '正文甲')
  assert.match(a, /^标题-[0-9a-f]{8}\.md$/)
  assert.equal(a, materialFileName('标题', '正文甲'), '同文本必须稳定同名')
  assert.notEqual(a, materialFileName('标题', '正文乙'), '不同文本不得撞名')
  assert.match(materialFileName('标/题:非法*?', 'x'), /^标题非法-/)
  assert.equal(materialFileName('', 'x'), materialFileName(null, 'x'), '空标题回退到「对话素材」')
  assert.match(materialFileName('', 'x'), /^对话素材-/)
  const long = materialFileName('一'.repeat(60), 'x')
  assert.ok([...long.slice(0, long.indexOf('-'))].length <= 24, 'slug 截 24')
})

test('composeMaterialMarkdown: 标题、来源、存入时间、正文原文', () => {
  const markdown = composeMaterialMarkdown({ title: '钩子写法', savedAt: new Date(0), body: '正文内容' })
  assert.match(markdown, /^# 钩子写法\n/)
  assert.match(markdown, /^> 来源：对话$/m)
  assert.match(markdown, /^> 存入：/m)
  assert.match(markdown, /\n正文内容\n$/)
})

function makeIo(root) {
  return {
    writes: [],
    async writeText(path, content) {
      this.writes.push({ path, content })
    },
    async exists(path) {
      return this.writes.some(entry => entry.path === path)
    },
  }
}

function handlerWith(root) {
  const io = makeIo(root)
  return {
    io,
    handler: createMaterialHandler({ io }),
  }
}

test('createMaterialHandler: 写入 outputs/对话素材/、重复推送复用不重写', async () => {
  const root = mkdtempSync(join(tmpdir(), '.tmp-conv-material-'))
  try {
    const { io, handler } = handlerWith(root)
    const call = () => handler({ body: async () => ({ text: '钩子文案草稿\n细节…' }), settings: { projectRoot: root } })

    const first = await call()
    assert.deepEqual(first.json, {
      ok: true, path: expectName(io, root), chars: '钩子文案草稿\n细节…'.length, reused: false,
    })
    assert.equal(io.writes.length, 1)
    assert.match(io.writes[0].path, /[\\/]outputs[\\/]对话素材[\\/]/)

    const second = await call()
    assert.equal(second.json.reused, true, '同文本第二次推送必须复用既有文件')
    assert.equal(io.writes.length, 1, '复用路径不得重写文件')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function expectName(io, root) {
  const written = io.writes[0]?.path ?? ''
  const fileName = written.split(/[\\/]/).pop()
  return `对话素材/${fileName}`
}

test('createMaterialHandler: 空内容 400、超长 400、写盘失败 500', async () => {
  const root = mkdtempSync(join(tmpdir(), '.tmp-conv-material-'))
  try {
    const { handler } = handlerWith(root)
    await assert.rejects(
      handler({ body: async () => ({ text: '   ' }), settings: { projectRoot: root } }),
      error => error instanceof ConversationMaterialError && error.status === 400,
    )
    await assert.rejects(
      handler({ body: async () => ({ text: '一'.repeat(100_001) }), settings: { projectRoot: root } }),
      error => error instanceof ConversationMaterialError && error.status === 400,
    )

    const io = { writeText: async () => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }) }, exists: async () => false }
    const failing = createMaterialHandler({ io })
    await assert.rejects(
      failing({ body: async () => ({ text: '内容' }), settings: { projectRoot: root } }),
      error => error instanceof ConversationMaterialError && error.status === 500 && /ENOSPC/.test(error.detail),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
