import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MEDIA_EXTENSIONS, mediaKindOf, workspaceMediaPath } from '../src/lib/media-url.js'

test('mediaKindOf: video/audio split and unknown formats stay out', () => {
  assert.equal(mediaKindOf('中通检测_概念样片_60s_v6.mp4'), 'video')
  assert.equal(mediaKindOf('clip.MOV'), 'video')
  assert.equal(mediaKindOf('a/b/mix.webm'), 'video')
  assert.equal(mediaKindOf('promo.mkv'), 'video')
  assert.equal(mediaKindOf('mimo_mix_v6.wav'), 'audio')
  assert.equal(mediaKindOf('旁白.mp3'), 'audio')
  assert.equal(mediaKindOf('voice.OGG'), 'audio')
  // 浏览器解不了的格式不注册渲染器
  assert.equal(mediaKindOf('legacy.avi'), null)
  assert.equal(mediaKindOf('flash.flv'), null)
  assert.equal(mediaKindOf('media.wmv'), null)
  assert.equal(mediaKindOf('audio.wma'), null)
  assert.equal(mediaKindOf('report.md'), null)
  assert.equal(mediaKindOf('no-extension'), null)
  assert.equal(mediaKindOf('archive.zip'), null)
})

test('media extensions cover the documented sets without overlap', () => {
  assert.ok(MEDIA_EXTENSIONS.includes('mp4'))
  assert.ok(MEDIA_EXTENSIONS.includes('opus'))
  assert.equal(new Set(MEDIA_EXTENSIONS).size, MEDIA_EXTENSIONS.length)
})

test('workspaceMediaPath: inside-root relative path, case-insensitive root, original case kept', () => {
  const root = 'C:\\Users\\chenfei\\AppData\\Local\\Easel'
  assert.equal(
    workspaceMediaPath('C:\\Users\\chenfei\\AppData\\Local\\Easel\\projects\\某项目\\outputs\\concept\\v6.mp4', root),
    'projects/某项目/outputs/concept/v6.mp4',
  )
  assert.equal(
    workspaceMediaPath('C:\\Users\\chenfei\\AppData\\LOCAL\\Easel\\outputs\\video\\成片.mp4', root),
    'outputs/video/成片.mp4',
  )
})

test('workspaceMediaPath: root edge cases', () => {
  const root = 'C:\\work\\easel'
  assert.equal(workspaceMediaPath('C:\\work\\easel', root), null, 'the root itself is not a file')
  assert.equal(workspaceMediaPath('C:\\work\\easel\\a.mp4', root), 'a.mp4', 'direct child')
  assert.equal(workspaceMediaPath('C:\\work\\easel\\..\\secret.mp4', root), null, 'traversal rejected')
  assert.equal(workspaceMediaPath('C:\\work\\easel\\sub\\..\\a.mp4', root), null, 'dot-dot segment rejected')
  assert.equal(workspaceMediaPath('C:\\other\\a.mp4', root), null, 'different drive prefix')
  assert.equal(workspaceMediaPath('C:\\work\\easel-extra\\a.mp4', root), null, 'sibling dir sharing prefix')
  assert.equal(workspaceMediaPath('', root), null)
  assert.equal(workspaceMediaPath('C:\\work\\easel\\a.mp4', ''), null)
})

test('workspaceMediaPath: extended-length and forward-slash inputs normalize', () => {
  assert.equal(
    workspaceMediaPath('\\\\?\\C:\\work\\easel\\media\\v.mp4', 'C:/work/easel'),
    'media/v.mp4',
  )
  assert.equal(
    workspaceMediaPath('C:/work/easel/媒体/a.wav', 'C:\\work\\easel'),
    '媒体/a.wav',
  )
})
