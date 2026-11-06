// 对话右键推送素材库（spec easel-breakdown-persona-push §S2.3）：把对话里的
// 选区/整条消息存成内容库 `outputs/对话素材/<slug>-<hash8>.md`。标题、指纹、
// markdown 组装是纯函数；落盘 IO 由路由注入——单测不碰文件系统，路由接线在
// 宿主半 index.js（照 trends-article 的 handler 工厂模式）。

import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { sanitizeProjectTitle } from './projectize.js'

/** 带 status 的路由错误；index.js 侧转成 ApiError 以走统一的 4xx/5xx 通道。 */
export class ConversationMaterialError extends Error {
  constructor(status, detail) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

/** 单条素材的字符上限；超限 400 而不是静默截断——素材是用户要留存的原文。 */
const MATERIAL_TEXT_CAP = 100_000

/**
 * 推送标题：正文首个非空行，剥掉 Markdown 行首记号（标题/引用/列表），
 * 截 40 字符。素材文件名与「存入选题库」的空标题推导共用。全部剥空时
 * 返回空串，由调用方回退。
 * @param {string} text - 对话正文（选区或整条消息）。
 * @returns {string}
 */
export function firstLineTitle(text) {
  const line = String(text ?? '')
    .split('\n')
    .map(item => item.trim())
    .find(item => item !== '') ?? ''
  const stripped = line.replace(/^#{1,6}\s+|^>\s?|^[-*+]\s+|^\d+[.)]\s+/, '').replace(/^[-=]{3,}$/, '').trim()
  return [...stripped].slice(0, 40).join('')
}

/**
 * 内容库文件名：`<slug>-<textHash8>.md`。slug 复用项目目录清洗（≤24 字符，
 * 空标题回退「对话素材」）；hash 让同一文本稳定同名——重复推送幂等覆盖，
 * 不同文本不撞名。
 * @param {string} title - 素材标题（firstLineTitle 的结果，可为空）。
 * @param {string} text - 完整正文（决定 hash）。
 * @returns {string}
 */
export function materialFileName(title, text) {
  // 码点截断（不是 UTF-16 码元）：代理对跨第 24 位时按码元切会把孤立代理项写进
  // 文件名，Windows 上 writeFile 直接 EINVAL。
  const slug = [...sanitizeProjectTitle(title, '对话素材')].slice(0, 24).join('') || '对话素材'
  const hash = createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex').slice(0, 8)
  return `${slug}-${hash}.md`
}

/**
 * 内容库 markdown 组装。头部用引用块而不是 YAML frontmatter——内容库的
 * markdown 预览会把 `---` 渲染成分隔线（与热点正文同一约定）。
 * @param {{title: string, savedAt: Date|string, body: string}} parts
 * @returns {string}
 */
export function composeMaterialMarkdown({ title, savedAt, body }) {
  const when = savedAt instanceof Date ? savedAt : new Date(savedAt)
  return [
    `# ${title}`,
    '',
    '> 来源：对话',
    `> 存入：${Number.isNaN(when.getTime()) ? String(savedAt) : when.toLocaleString('zh-CN', { hour12: false })}`,
    '',
    body,
    '',
  ].join('\n')
}

/**
 * 创建 `POST /api/library/material` 的 handler。
 * @param {object} deps
 * @param {object} deps.io - 宿主半的 IO 能力：`writeText(path, content)`
 *   （tmp+rename 原子写）、`exists(path)`。
 * @returns {(c: object) => Promise<object>} dispatch 兼容的 handler。
 */
export function createMaterialHandler({ io }) {
  return async function saveMaterial(c) {
    const body = await c.body()
    const text = String(body?.text ?? '').trim()
    if (text === '') throw new ConversationMaterialError(400, '缺少内容：请选中文字或右键单条消息后再推送')
    if (text.length > MATERIAL_TEXT_CAP) {
      throw new ConversationMaterialError(400, `内容过长（上限 ${MATERIAL_TEXT_CAP} 字符），请推送选区或精简后再试`)
    }
    const title = firstLineTitle(text)
    const fileName = materialFileName(title, text)
    const abs = join(c.settings.projectRoot, 'outputs', '对话素材', fileName)
    // 同文本同文件名：已存在就不重写（保住原文件的存入时间，也不搅动 mtime）。
    const reused = await io.exists(abs)
    if (!reused) {
      const markdown = composeMaterialMarkdown({
        title: title || '对话素材',
        savedAt: new Date(),
        body: text,
      })
      try {
        await io.writeText(abs, markdown)
      } catch (error) {
        throw new ConversationMaterialError(500, `素材保存失败（${error?.code ?? error?.message ?? '未知'}）`)
      }
    }
    return { json: { ok: true, path: `对话素材/${fileName}`, chars: text.length, reused } }
  }
}
