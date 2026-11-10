/**
 * Sending-device path rewriting inside imported session events: separator
 * families, JSON-embedded argument text, case, boundaries, and nesting.
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { expect, it } from 'vitest'
import { remapEventText, remapSessionEvent } from '../src/path-remap.ts'

const PROJECT = 'C:\\Users\\chenfei\\Documents\\Easel-dsh\\workspace\\projects\\衣服淘宝展示'
const MAC_PROJECT = '/Users/feichen/Documents/Easel-dsh/workspace/projects/衣服淘宝展示'

it('rewrites one POSIX directory inside surrounding text', () => {
  expect(remapEventText(
    'opened /srv/work/project/素材/a.png and /srv/work/project',
    [{ from: '/srv/work/project', to: '/home/u/project' }],
  )).toBe('opened /home/u/project/素材/a.png and /home/u/project')
})

it('normalizes Windows separators when the receiving device is POSIX-like', () => {
  expect(remapEventText(`${PROJECT}\\素材\\a.png`, [{ from: PROJECT, to: MAC_PROJECT }]))
    .toBe(`${MAC_PROJECT}/素材/a.png`)
  expect(remapEventText(
    'C:/Users/chenfei/Documents/Easel-dsh/workspace/projects/衣服淘宝展示/素材/a.png',
    [{ from: PROJECT, to: MAC_PROJECT }],
  )).toBe(`${MAC_PROJECT}/素材/a.png`)
})

it('keeps separators when both devices use Windows paths', () => {
  expect(remapEventText(`${PROJECT}\\素材\\a.png`, [{ from: PROJECT, to: 'D:\\项目' }]))
    .toBe('D:\\项目\\素材\\a.png')
})

it('rewrites the escaped spelling inside a stored JSON argument document', () => {
  const argumentsText = JSON.stringify({ file_path: `${PROJECT}\\素材\\a.png` })
  const rewritten = remapEventText(argumentsText, [{ from: PROJECT, to: MAC_PROJECT }])
  expect(JSON.parse(rewritten)).toEqual({ file_path: `${MAC_PROJECT}/素材/a.png` })
  expect(rewritten).not.toContain('C:')
})

it('escapes the receiving directory when the argument document keeps backslashes', () => {
  const argumentsText = JSON.stringify({ file_path: `${PROJECT}\\素材\\a.png` })
  const rewritten = remapEventText(argumentsText, [{ from: PROJECT, to: 'D:\\项目' }])
  expect(JSON.parse(rewritten)).toEqual({ file_path: 'D:\\项目\\素材\\a.png' })
})

it('matches Windows directories without regard to case', () => {
  expect(remapEventText(
    'c:\\users\\chenfei\\documents\\easel-dsh\\workspace\\projects\\衣服淘宝展示\\a.png',
    [{ from: PROJECT, to: MAC_PROJECT }],
  )).toBe(`${MAC_PROJECT}/a.png`)
})

it('leaves a sibling directory and unrelated text untouched', () => {
  expect(remapEventText('C:\\work\\projects2\\a.png', [{ from: 'C:\\work\\projects', to: '/new' }]))
    .toBe('C:\\work\\projects2\\a.png')
  expect(remapEventText('nothing to rewrite', [{ from: PROJECT, to: MAC_PROJECT }]))
    .toBe('nothing to rewrite')
})

it('matches directories containing regular-expression metacharacters', () => {
  expect(remapEventText('C:\\work (1)\\projects\\a.png', [{ from: 'C:\\work (1)\\projects', to: '/new' }]))
    .toBe('/new/a.png')
})

it('applies the longest source directory first', () => {
  const remaps = [
    { from: 'C:\\Users\\chenfei\\Documents\\Easel-dsh\\workspace', to: '/Users/feichen/Documents/Easel-dsh/workspace' },
    { from: PROJECT, to: MAC_PROJECT },
  ]
  expect(remapEventText(`${PROJECT}\\a.png`, remaps)).toBe(`${MAC_PROJECT}/a.png`)
})

it('ignores a repeated directory already covered by its own rewritten region', () => {
  expect(remapEventText('C:\\proj\\C:\\proj\\a', [{ from: 'C:\\proj', to: '/x' }])).toBe('/x/C:/proj/a')
})

it('rewrites nested event fields and leaves non-string values alone', () => {
  const event = JSON.parse(JSON.stringify({
    type: 'turn/start',
    seq: 0,
    time: 1,
    data: {
      turn: 1,
      paths: [`${PROJECT}\\a.png`, 'unrelated'],
      meta: { cwd: PROJECT, ok: true, count: 2, absent: null },
    },
  })) as SessionEvent
  const rewritten = remapSessionEvent(event, [{ from: PROJECT, to: MAC_PROJECT }])
  expect(rewritten).toEqual({
    type: 'turn/start',
    seq: 0,
    time: 1,
    data: {
      turn: 1,
      paths: [`${MAC_PROJECT}/a.png`, 'unrelated'],
      meta: { cwd: MAC_PROJECT, ok: true, count: 2, absent: null },
    },
  })
})

it('returns non-string, non-container event fields unchanged', () => {
  const event = JSON.parse(JSON.stringify({ type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } })) as SessionEvent
  expect(remapSessionEvent(event, [{ from: PROJECT, to: MAC_PROJECT }])).toEqual(event)
})
