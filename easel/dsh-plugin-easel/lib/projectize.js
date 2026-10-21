// 立项工作区资料装配（spec easel-project-materials §S2、easel-project-folders §S2）。
//
// POST /easel/api/projectize：标题清洗 → mkdir projects/<safe>/ → 建固定骨架
// （素材/音乐、视频、人声、图片、音效 与 成品/）→ 播种
// 选题.md 与 项目资料.md；选题带 deconstruct 批次号时装配 拆解/（报告、字幕
// 复制，视频、关键帧硬链接——同卷零拷贝，失败逐项跳过并记入 manifest）；选了
// 画像时把 profiles/<name>/*.md 快照到 画像/<name>/。幂等：文本重写、硬链接
// 已存在跳过、骨架只建不删，重复立项不炸不堆积。

import { copyFile, link, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

/** Windows 目录名清洗（自 IdeasPage 前端迁移，宿主为单一权威）。回退名同样过清洗。 */
export function sanitizeProjectTitle(title, fallback) {
  const clean = Array.from(
    String(title ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim(),
  ).slice(0, 40).join('').replace(/^[.\s。]+|[.\s。]+$/g, '').trim()
  if (clean) return clean
  if (fallback === undefined) return ''
  return sanitizeProjectTitle(fallback) || '未命名项目'
}

/** 拆解批次 id 只允许文件名安全字符，挡住借它做路径穿越。 */
const validBatchId = id => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id)

/** 画像目录名规则与宿主 validPersonaName 一致（这里只挡穿越，不挡 _ 前缀）。 */
const validPersona = name => typeof name === 'string' && name.length > 0
  && !name.startsWith('.') && !/[/\\:]/.test(name)
  && ![...name].some(ch => ch.charCodeAt(0) < 32)

/** 立项固定骨架：素材子分类（manifest 装配清单与播种共用此清单）。 */
const MATERIAL_SUBDIRS = ['音乐', '视频', '人声', '图片', '音效']

async function fileExists(path) {
  return readFile(path).then(() => true, error => error.code !== 'ENOENT')
}

/**
 * 把一个文件装配进项目目录：文本小文件复制，媒体走硬链接（同卷零拷贝）。
 * 失败不炸立项——记一条 note 供 manifest 兜底（agent 可按原路径直读）。
 */
async function bring(srcAbs, destAbs, { hardlink = false } = {}, notes) {
  try {
    await mkdir(dirname(destAbs), { recursive: true })
    if (hardlink) await link(srcAbs, destAbs)
    else await copyFile(srcAbs, destAbs)
    return true
  } catch (error) {
    if (error.code === 'EEXIST') return true
    const missing = error.code === 'ENOENT' || !(await fileExists(srcAbs))
    notes.push(missing
      ? `${basename(destAbs)} 未装配：原件不存在`
      : `${basename(destAbs)} 未能装配（${error.code ?? error.message}），原件：${srcAbs}`)
    return false
  }
}

/**
 * 立项播种。返回 { safe, notes }；notes 同时写进 项目资料.md。
 * @param {object} opts
 * @param {string} opts.projectRoot 项目根（绝对）
 * @param {string} opts.title 选题标题（未清洗）
 * @param {string} [opts.note] 备注原文（老拆解选题的整份报告在这里，必须照存）
 * @param {string} [opts.source] 选题来源（写进 选题.md）
 * @param {string} [opts.fallback] 清洗后为空时的目录名回退（用选题 id）
 * @param {string} [opts.deconstructId] 关联拆解批次号（outputs/_deconstruct/<id>）
 * @param {string} [opts.persona] 带入快照的画像名
 */
export async function seedProjectWorkspace({ projectRoot, title, note = '', source = '', fallback = '未命名项目', deconstructId = '', persona = '' }) {
  const safe = sanitizeProjectTitle(title, fallback)
  const dir = resolve(projectRoot, 'projects', safe)
  await mkdir(dir, { recursive: true })
  // 固定骨架：只建不删——重复立项对用户已放入的素材零影响。
  for (const name of MATERIAL_SUBDIRS) await mkdir(join(dir, '素材', name), { recursive: true })
  await mkdir(join(dir, '成品'), { recursive: true })
  const notes = []

  await writeFile(join(dir, '选题.md'), [
    `# 选题：${title}`,
    '',
    `- 来源：${source || '手动'}`,
    `- 立项：${new Date().toISOString().slice(0, 10)}`,
    ...(note ? ['', '## 备注', '', note, ''] : []),
  ].join('\n'), 'utf8')

  // 拆解装配：job.json 是产物清单的权威（相对路径）。
  let job = null
  if (validBatchId(deconstructId)) {
    const srcDir = resolve(projectRoot, 'outputs', '_deconstruct', deconstructId)
    job = await readFile(join(srcDir, 'job.json'), 'utf8').then(JSON.parse, () => null)
    if (job === null) {
      notes.push(`拆解批次 ${deconstructId} 不存在或无 job.json，未装配`)
    } else {
      const dest = join(dir, '拆解')
      // 原件路径一律绝对：读 manifest 的会话 cwd 可能是项目目录，项目根相对路径会指错。
      if (await fileExists(join(srcDir, 'report.md'))) {
        if (await bring(join(srcDir, 'report.md'), join(dest, 'report.md'), {}, notes)) {
          notes.push(`拆解报告：拆解/report.md（原件 ${join(srcDir, 'report.md')}）`)
        }
      } else notes.push(`拆解批次 ${deconstructId} 尚无 report.md`)
      if (typeof job.srt === 'string' && job.srt) {
        const srtAbs = resolve(projectRoot, job.srt)
        if (await bring(srtAbs, join(dest, basename(job.srt)), {}, notes)) {
          notes.push(`字幕：拆解/${basename(job.srt)}（原件 ${srtAbs}）`)
        }
      }
      if (typeof job.video === 'string' && job.video) {
        const videoAbs = resolve(projectRoot, job.video)
        if (await bring(videoAbs, join(dest, 'video.mp4'), { hardlink: true }, notes)) {
          notes.push(`视频：拆解/video.mp4（硬链接 → 原件 ${videoAbs}）`)
        }
      }
      if (typeof job.framesDir === 'string' && job.framesDir) {
        const framesAbs = resolve(projectRoot, job.framesDir)
        const frames = (await readdir(framesAbs).catch(() => []))
          .filter(name => name.endsWith('.jpg'))
        let linked = 0
        for (const name of frames) {
          if (await bring(join(framesAbs, name), join(dest, 'frames', name), { hardlink: true }, notes)) linked += 1
        }
        notes.push(linked > 0
          ? `关键帧：拆解/frames/（${linked} 张硬链接 → 原件 ${framesAbs}/）`
          : `关键帧未装配，原件 ${framesAbs}/`)
      }
    }
  }

  // 画像快照：md 小文本整体复制；活目录仍在 profiles，manifest 注明不同步。
  if (validPersona(persona)) {
    const srcDir = resolve(projectRoot, 'profiles', persona)
    const files = (await readdir(srcDir).catch(() => [])).filter(name => name.endsWith('.md'))
    if (files.length === 0) {
      notes.push(`画像「${persona}」不存在或无 md 文件，未带入`)
    } else {
      let copied = 0
      for (const name of files) {
        if (await bring(join(srcDir, name), join(dir, '画像', persona, name), {}, notes)) copied += 1
      }
      notes.push(copied > 0
        ? `画像快照：画像/${persona}/（${copied} 个 md，立项时快照；活目录 profiles/${persona}/，不自动同步）`
        : `画像「${persona}」快照全部失败`)
    }
  }

  await writeFile(join(dir, '项目资料.md'), manifest({ title, safe, deconstructId, notes }), 'utf8')
  return { safe, notes }
}

function manifest({ title, safe, deconstructId, notes }) {
  return [
    `# 项目资料：${title}`,
    '',
    `> 本目录是「${title}」的立项工作区（projects/${safe}/）。`,
    '> **产物约定：脚本、文案等创作产物写入本目录，成片与最终交付物写入 成品/，制作素材归入 素材/。**',
    '',
    '## 装配清单',
    '- 选题卡：选题.md',
    `- 素材库：素材/（${MATERIAL_SUBDIRS.join('、')}——制作素材放这里）`,
    '- 成品区：成品/（成片与最终交付物放这里）',
    deconstructId ? `- 拆解素材：拆解/（批次 outputs/_deconstruct/${deconstructId}/）` : '- 拆解素材：暂无（可在爆款拆解页采集入库后重新立项同步）',
    ...notes.map(note => `- ${note}`),
    '',
  ].join('\n')
}
