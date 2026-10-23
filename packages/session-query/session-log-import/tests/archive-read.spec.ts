/** Archive classification: entry shapes, ignored unknown entries, and refusals. */

import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { sessionFormatLogFilename } from '@deepseek-ai/dsh-session-format'
import { zipSync } from 'fflate'
import { expect, it } from 'vitest'
import { readSessionArchive } from '../src/archive-read.ts'
import { SessionImportFormatError } from '../src/errors.ts'

const LOG_NAME = sessionFormatLogFilename(SESSION_FORMAT_VERSION)
const encoder = new TextEncoder()

/** ZIP bytes whose entries are exactly the supplied paths. */
function archive(entries: Record<string, string | Uint8Array>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(entries).map(([path, content]) => [
    path, typeof content === 'string' ? encoder.encode(content) : content,
  ])), { level: 0 })
}

it('classifies the root log, subagent logs, images, and files', () => {
  const digest = 'ab'.repeat(32)
  const media = Uint8Array.from([1, 2, 3])
  const file = Uint8Array.from([4, 5, 6])
  const contents = readSessionArchive(archive({
    [LOG_NAME]: '{"root":true}\n',
    [`subagents/child-1/${LOG_NAME}`]: '{"child":true}\n',
    [`subagents/child-2/${LOG_NAME}`]: '{"child":true}\n',
    [`media/sha256:${digest}.png`]: media,
    [`files/${digest.slice(0, 2)}/${digest}/notes.txt`]: file,
    'notes/readme.txt': 'ignored',
  }))
  expect(contents.rootLog).toBe('{"root":true}\n')
  expect(contents.subagentLogs).toEqual(['{"child":true}\n', '{"child":true}\n'])
  expect(contents.media).toEqual([{ id: `sha256:${digest}`, mediaType: 'image/png', data: media }])
  expect(contents.files).toEqual([{ digest, name: 'notes.txt', data: file }])
})

it('maps every accepted image extension to its media type', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['webp', 'image/webp'],
    ['gif', 'image/gif'],
  ]
  for (const [extension, mediaType] of cases) {
    const contents = readSessionArchive(archive({
      [LOG_NAME]: '{}\n',
      [`media/sha256:${'cd'.repeat(32)}.${extension}`]: Uint8Array.from([9]),
    }))
    expect(contents.media[0]?.mediaType).toBe(mediaType)
  }
})

it('refuses an archive without a root log and bytes that are not a ZIP', () => {
  expect(() => readSessionArchive(archive({ [`subagents/child/${LOG_NAME}`]: '{}\n' })))
    .toThrow(SessionImportFormatError)
  expect(() => readSessionArchive(archive({ [`subagents/child/${LOG_NAME}`]: '{}\n' })))
    .toThrow(/no root session log/u)
  expect(() => readSessionArchive(Uint8Array.from([0, 1, 2, 3]))).toThrow(/not a readable ZIP container/u)
})

it('ignores archive entries with unusable subagent, media, and file names', () => {
  const contents = readSessionArchive(zipSync({
    [LOG_NAME]: encoder.encode('{}\n'),
    'subagents/nofile': encoder.encode('x'),
    'subagents/x/other.jsonl': encoder.encode('x'),
    'media/sha256:aa.bmp': Uint8Array.from([1]),
    ['files/zz/' + '0'.repeat(63) + '/short.txt']: Uint8Array.from([1]),
  }, { level: 0 }))
  expect(contents.subagentLogs).toEqual([])
  expect(contents.media).toEqual([])
  expect(contents.files).toEqual([])
})
