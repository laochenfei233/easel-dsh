import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { seedProjectWorkspace, sanitizeProjectTitle } from '../lib/projectize.js'
import { dispatchLocalApi } from '../index.js'

function tmpRoot() {
  const root = mkdtempSync(join(import.meta.dirname, '.tmp-projectize-'))
  return root
}

function deconstructFixture(root) {
  const dir = join(root, 'outputs', '_deconstruct', 'abc123def456')
  mkdirSync(join(dir, 'frames'), { recursive: true })
  writeFileSync(join(dir, 'job.json'), JSON.stringify({
    id: 'abc123def456',
    video: `outputs/_deconstruct/abc123def456/video.mp4`,
    srt: `outputs/_deconstruct/abc123def456/口播.srt`,
    framesDir: `outputs/_deconstruct/abc123def456/frames`,
  }), 'utf8')
  writeFileSync(join(dir, 'report.md'), '# 拆解报告', 'utf8')
  writeFileSync(join(dir, 'video.mp4'), 'fake-video-bytes', 'utf8')
  writeFileSync(join(dir, '口播.srt'), '1\n00:00:00,000 --> 00:00:01,000\n你好\n', 'utf8')
  writeFileSync(join(dir, 'frames', 'f-001.jpg'), 'frame-1', 'utf8')
  writeFileSync(join(dir, 'frames', 'f-002.jpg'), 'frame-2', 'utf8')
  return dir
}

test('sanitizeProjectTitle strips illegal chars, caps length, trims trailing dots, falls back', () => {
  assert.equal(sanitizeProjectTitle('探店:最好的<b「火锅」?', 'id1'), '探店最好的b「火锅」')
  assert.equal(sanitizeProjectTitle('x'.repeat(50), 'id1'), 'x'.repeat(40))
  assert.equal(sanitizeProjectTitle('标题。. ', 'id1'), '标题')
  assert.equal(sanitizeProjectTitle('???', 'id1'), 'id1')
  // 回退名同样过清洗：带穿越段的 fallback 不得原样成为目录名。
  assert.equal(sanitizeProjectTitle('???', '../../x'), 'x')
})

test('seedProjectWorkspace lays out 选题/manifest, copies texts and hardlinks media', async () => {
  const root = tmpRoot()
  try {
    deconstructFixture(root)
    mkdirSync(join(root, 'profiles', '我的账号'), { recursive: true })
    writeFileSync(join(root, 'profiles', '我的账号', 'identity.md'), '人设：成都美食探店', 'utf8')

    const { safe, notes } = await seedProjectWorkspace({
      projectRoot: root,
      title: '火锅探店:二创',
      note: '# 拆解报告（备注原文）',
      source: '爆款拆解',
      fallback: 'idea1',
      deconstructId: 'abc123def456',
      persona: '我的账号',
    })

    const dir = join(root, 'projects', safe)
    assert.equal(safe, '火锅探店二创')
    const topicCard = readFileSync(join(dir, '选题.md'), 'utf8')
    assert.equal(topicCard.includes('- 来源：爆款拆解'), true)
    // 老拆解选题的整份报告就存在备注里——必须照存（评审 critical 修复点）。
    assert.equal(topicCard.includes('## 备注'), true)
    assert.equal(topicCard.includes('# 拆解报告（备注原文）'), true)
    const manifestText = readFileSync(join(dir, '项目资料.md'), 'utf8')
    assert.match(manifestText, /产物约定/)
    // 固定骨架：素材五子目录 + 成品区（easel-project-folders）。
    for (const name of ['音乐', '视频', '人声', '图片', '音效']) {
      assert.equal(existsSync(join(dir, '素材', name)), true, `素材/${name} must be scaffolded`)
    }
    assert.equal(existsSync(join(dir, '成品')), true)
    assert.match(manifestText, /素材库：素材\/（音乐、视频、人声、图片、音效/)
    assert.match(manifestText, /成品区：成品\//)
    // 原件路径是绝对的（读 manifest 的会话 cwd 可能在项目目录里）。
    assert.match(manifestText, /硬链接 → 原件 .*abc123def456[/\\]video\.mp4/)
    assert.match(manifestText, /画像快照/)

    // 文本复制 + 媒体硬链接（同 inode：硬链接数 >1 且不占双份空间）。
    assert.equal(existsSync(join(dir, '拆解', 'report.md')), true)
    assert.equal(existsSync(join(dir, '拆解', '口播.srt')), true)
    const src = statSync(join(root, 'outputs', '_deconstruct', 'abc123def456', 'video.mp4'))
    const dest = statSync(join(dir, '拆解', 'video.mp4'))
    assert.equal(dest.nlink > 1, true, 'video.mp4 must be a hardlink, not a copy')
    assert.equal(dest.ino, src.ino, 'hardlink must share the inode with the original')
    assert.equal(existsSync(join(dir, '拆解', 'frames', 'f-001.jpg')), true)
    assert.equal(existsSync(join(dir, '画像', '我的账号', 'identity.md')), true)
    assert.equal(notes.some(note => note.includes('未能装配')), false, JSON.stringify(notes))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('seedProjectWorkspace is idempotent and degrades gracefully on missing batch/persona', async () => {
  const root = tmpRoot()
  try {
    deconstructFixture(root)
    const opts = { projectRoot: root, title: '火锅探店', source: '', fallback: 'idea2', deconstructId: 'abc123def456', persona: '不存在' }
    await seedProjectWorkspace(opts)
    // 用户已放入骨架的文件：重复立项只建不删，必须原样保留。
    writeFileSync(join(root, 'projects', '火锅探店', '素材', '音乐', 'bgm.mp3'), 'user-data', 'utf8')
    writeFileSync(join(root, 'projects', '火锅探店', '成品', '成片.mp4'), 'user-data', 'utf8')
    // 第二次：硬链接 EEXIST / 文本重写都不得抛错。
    const second = await seedProjectWorkspace(opts)
    const dir = join(root, 'projects', '火锅探店')
    assert.equal(existsSync(join(dir, '拆解', 'video.mp4')), true)
    assert.equal(existsSync(join(dir, '素材', '音乐', 'bgm.mp3')), true, 'user files in scaffold dirs must survive re-projectize')
    assert.equal(existsSync(join(dir, '成品', '成片.mp4')), true)
    assert.equal(second.notes.some(note => note.includes('不存在或无 md 文件')), true, 'missing persona must be noted, not thrown')
    assert.equal(second.notes.some(note => note.includes('画像快照')), false)

    // 无关联拆解：只有 选题.md + 项目资料.md，无 拆解/ 目录。
    const bare = await seedProjectWorkspace({ projectRoot: root, title: '纯手选选题', source: '热点雷达', fallback: 'idea3' })
    const bareDir = join(root, 'projects', bare.safe)
    assert.equal(existsSync(join(bareDir, '拆解')), false)
    assert.match(readFileSync(join(bareDir, '项目资料.md'), 'utf8'), /拆解素材：暂无/)
    // 裸立项（无拆解无画像）同样有固定骨架：七目录一个不少。
    for (const name of ['音乐', '视频', '人声', '图片', '音效']) {
      assert.equal(existsSync(join(bareDir, '素材', name)), true, `bare 素材/${name} must be scaffolded`)
    }
    assert.equal(existsSync(join(bareDir, '成品')), true)

    // 批次号带穿越段：不装配也不越出 projects/。
    const evil = await seedProjectWorkspace({ projectRoot: root, title: 'evil', source: '', fallback: 'idea4', deconstructId: '../outputs' })
    assert.equal(existsSync(join(root, 'projects', evil.safe, '拆解')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// 路由级：宿主必须把选题卡置 project + projectDir（「做内容」落点注入的依据），
// 且缺标题 400。立项状态曾被 IDEA_STATUSES 白名单静默回退——这条是它的回归门。
test('POST projectize seeds materials and flips the idea card to project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-proj-route-'))
  try {
    const settings = { projectRoot: root, skillsDir: join(root, 'skills'), basePath: '/easel' }
    const call = (method, path, body) =>
      dispatchLocalApi(settings, method, path.split('/').filter(Boolean), new URLSearchParams(),
        async () => body ?? {}, {})
    mkdirSync(join(root, 'outputs'), { recursive: true })
    writeFileSync(join(root, 'outputs', '_ideas.json'), JSON.stringify([
      { id: 'idea9', title: '夜市烧烤探店', note: '', source: '爆款拆解', status: 'doing', created: 1 },
    ]), 'utf8')

    const result = await call('POST', 'projectize', {
      ideaId: 'idea9', title: '夜市烧烤:探店', note: '钩子是现切现烤', source: '爆款拆解', persona: '',
    })
    assert.equal(result.json.safe, '夜市烧烤探店')
    assert.equal(existsSync(join(root, 'projects', '夜市烧烤探店', '项目资料.md')), true)
    assert.equal(readFileSync(join(root, 'projects', '夜市烧烤探店', '选题.md'), 'utf8').includes('钩子是现切现烤'), true)

    const ideas = JSON.parse(readFileSync(join(root, 'outputs', '_ideas.json'), 'utf8'))
    assert.equal(ideas[0].status, 'project', 'greenlit status must survive the store write')
    assert.equal(ideas[0].projectDir, 'projects/夜市烧烤探店')

    // IDEA_STATUSES 白名单门：PUT ideas 更新通道里 'project' 不得被静默回退。
    const put = await call('PUT', 'ideas/idea9', { title: '夜市烧烤:探店', note: '', source: '爆款拆解', status: 'project' })
    assert.equal(put.json.status, 'project', 'the status whitelist must accept project (regression gate)')

    // 清洗后为空的标题：回退到 idea id，不与「未命名项目」合并。
    writeFileSync(join(root, 'outputs', '_ideas.json'), JSON.stringify([
      { id: 'ideaX', title: '???', note: '', source: '', status: 'pending', created: 2 },
    ]), 'utf8')
    const anon = await call('POST', 'projectize', { ideaId: 'ideaX', title: '???' })
    assert.equal(anon.json.safe, 'ideaX')

    await assert.rejects(call('POST', 'projectize', { ideaId: 'idea9', title: '  ' }),
      error => error.status === 400, 'missing title rejected')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
