/** Canonical session-log parsing: field checks, contract validation, and seed cuts. */

import { expect, it } from 'vitest'
import { SessionImportFormatError } from '../src/errors.ts'
import { parseSessionLog } from '../src/parse-log.ts'

/** One valid `turn/start` event at the requested seq. */
function turn(seq: number): Record<string, unknown> {
  return { type: 'turn/start', seq, time: 1_000 + seq, data: { turn: 1 } }
}

/** One inherited seed marker at the requested seq. */
function seedMarker(seq: number): Record<string, unknown> {
  return { type: 'session/end-seed', seq, time: 1_000 + seq, data: { inherited: true } }
}

/** A canonical header line with overrides applied. */
function header(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'session',
    version: 4,
    id: 'session-a',
    createdAt: 1_000,
    isSeeded: false,
    delegationDepth: 0,
    ...overrides,
  })
}

/** Canonical JSONL text from raw lines. */
function text(...lines: readonly string[]): string {
  return `${lines.join('\n')}\n`
}

/** Serialize event fixtures into canonical lines. */
function eventLine(event: Record<string, unknown>): string {
  return JSON.stringify(event)
}

it('parses a root log with its optional header fields absent', () => {
  const parsed = parseSessionLog(text(header(), eventLine(turn(0)), eventLine(turn(1))), 'root')
  expect(parsed.header).toMatchObject({ id: 'session-a', createdAt: 1_000, isSeeded: false, delegationDepth: 0 })
  expect(parsed.header.cwd).toBeUndefined()
  expect(parsed.events.map(event => event.seq)).toEqual([0, 1])
  expect(parsed.inheritedEventCount).toBeUndefined()
})

it('keeps optional header fields and resolves the seed cut', () => {
  const parsed = parseSessionLog(text(
    header({
      cwd: 'C:\\work\\project',
      parentSession: 'session-parent',
      origin: 'subagent',
      agentPreset: 'reader',
      isSeeded: true,
      delegationDepth: 1,
    }),
    eventLine(turn(0)),
    eventLine(seedMarker(1)),
  ), 'subagent')
  expect(parsed.header).toMatchObject({
    cwd: 'C:\\work\\project',
    parentSession: 'session-parent',
    origin: 'subagent',
    agentPreset: 'reader',
    isSeeded: true,
    delegationDepth: 1,
  })
  expect(parsed.inheritedEventCount).toBe(1)
})

it('refuses header lines that are not session headers of this format', () => {
  const cases: readonly (readonly [string, RegExp])[] = [
    ['{not json', /not valid JSON/u],
    ['[]', /not a JSON object/u],
    [JSON.stringify({ type: 'event' }), /not a session header/u],
    [header({ version: 3 }), /version 3 cannot be imported/u],
    [header({ id: '' }), /missing the session id/u],
    [header({ createdAt: -1 }), /invalid createdAt/u],
    [header({ isSeeded: 'yes' }), /missing the isSeeded flag/u],
    [header({ delegationDepth: -1 }), /invalid delegationDepth/u],
    [header({ cwd: 'relative/path' }), /non-absolute cwd/u],
    [header({ parentSession: 4 }), /invalid parentSession/u],
    [header({ origin: 'fork' }), /unsupported origin/u],
    [header({ agentPreset: 4 }), /invalid agentPreset/u],
  ]
  for (const [line, message] of cases) {
    expect(() => parseSessionLog(text(line), 'root')).toThrow(message)
  }
  expect(() => parseSessionLog('', 'root')).toThrow(SessionImportFormatError)
  expect(() => parseSessionLog('', 'root')).toThrow(/session log is empty/u)
})

it('refuses event lines that are unparsable, empty, non-contiguous, or unknown', () => {
  expect(() => parseSessionLog(text(header(), '{oops'), 'root')).toThrow(/event line 1 is not valid JSON/u)
  expect(() => parseSessionLog(text(header(), eventLine(turn(0)), '', eventLine(turn(1))), 'root'))
    .toThrow(/empty event line at index 2/u)
  expect(() => parseSessionLog(text(header(), eventLine(turn(3))), 'root')).toThrow(/refused by the storage contract/u)
  expect(() => parseSessionLog(text(header(), eventLine({ type: 'future/unknown', seq: 0, time: 1, data: {} })), 'root'))
    .toThrow(/refused by the storage contract/u)
})

it('refuses seed markers that disagree with the header', () => {
  expect(() => parseSessionLog(text(header({ isSeeded: true }), eventLine(turn(0))), 'subagent'))
    .toThrow(/missing its inherited seed marker/u)
  expect(() => parseSessionLog(text(header(), eventLine(turn(0)), eventLine(seedMarker(1))), 'root'))
    .toThrow(/carries an inherited seed marker/u)
  expect(() => parseSessionLog(text(
    header({ isSeeded: true }),
    eventLine(turn(0)),
    eventLine(seedMarker(1)),
    eventLine({ type: 'session/end-seed', seq: 2, time: 1_002, data: { inherited: true } }),
  ), 'subagent')).toThrow(/more than one inherited seed marker/u)
})

it('accepts a canonical log without a trailing newline', () => {
  const parsed = parseSessionLog(header() + '\n' + eventLine(turn(0)), 'root')
  expect(parsed.events).toHaveLength(1)
})
