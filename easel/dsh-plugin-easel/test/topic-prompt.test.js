import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickGreenlightPersona, topicPrompt } from '../src/lib/topic-prompt.js'

test('topicPrompt keeps the base prompt and no persona line without a persona', () => {
  const prompt = topicPrompt('测试热点')
  assert.match(prompt, /围绕当前热点「测试热点」/)
  assert.doesNotMatch(prompt, /结合我的画像/)
})

test('topicPrompt appends the persona line for an unscheduled topic', () => {
  const prompt = topicPrompt('测试热点', undefined, false, undefined, '美食号')
  assert.match(prompt, /本次创作结合我的画像「美食号」/)
  assert.match(prompt, /profiles\/美食号\//)
  assert.doesNotMatch(prompt, /本项目已立项/)
})

test('topicPrompt puts the persona line after the project part', () => {
  const prompt = topicPrompt('测试热点', 'projects/测试', false, undefined, '美食号')
  const personaAt = prompt.indexOf('结合我的画像')
  const projectAt = prompt.indexOf('本项目已立项')
  assert.ok(projectAt >= 0, 'project part present')
  assert.ok(personaAt > projectAt, 'persona line comes after the project part')
})

test('topicPrompt keeps the in-project wording when the session cwd is the project', () => {
  const prompt = topicPrompt('测试热点', 'projects/测试', true, undefined, '美食号')
  assert.match(prompt, /先读 项目资料\.md（就在当前目录/)
  assert.match(prompt, /结合我的画像「美食号」/)
})

test('topicPrompt without a persona keeps the legacy prompt byte-identical', () => {
  assert.equal(
    topicPrompt('测试热点', 'projects/测试', false, 'outputs/热点正文/a.md'),
    '围绕当前热点「测试热点」：先判断它适不适合我的账号赛道；若合适，给 2-3 个差异化的二创角度，并把你最推荐的那条写成可直接发布的文案初稿。'
      + '\n\n这条热点的正文已抓取到内容库：outputs/热点正文/a.md。先读它再动笔，不要凭标题臆测内容。'
      + '\n\n本项目已立项：先读 projects/测试/项目资料.md（选题卡、拆解素材、画像快照都在里面，按需参考），本次创作的脚本/文案/成片等产物一律写入 projects/测试/ 目录。',
  )
})

test('pickGreenlightPersona preselects the idea persona while it still exists', () => {
  const personas = [{ name: '美食号' }, { name: '科技号' }]
  assert.equal(pickGreenlightPersona(personas, '科技号'), '科技号')
  assert.equal(pickGreenlightPersona(personas, '已删除号'), '')
})

test('pickGreenlightPersona auto-picks only a single persona', () => {
  assert.equal(pickGreenlightPersona([{ name: '美食号' }], ''), '美食号')
  assert.equal(pickGreenlightPersona([{ name: '美食号' }, { name: '科技号' }], ''), '')
  assert.equal(pickGreenlightPersona([], ''), '')
})
