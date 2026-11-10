/**
 * Rewriting one sending device's absolute directories onto the receiving
 * device inside imported session events.
 *
 * A session log records tool arguments, tool output, and messages that name
 * files by absolute path. The header's `cwd` is replaced by the import, but
 * those event strings would otherwise keep pointing at the exporting machine —
 * `C:\Users\...\projects\<title>\素材\a.png` cannot be opened on macOS, so a
 * continued conversation would fail on files that arrived beside it. Rewriting
 * happens once, at import, and the rewritten events are what this device
 * stores.
 * @module @deepseek-ai/dsh-session-log-import/path-remap
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'

/** One sending-device directory rewritten onto its receiving-device counterpart. */
export interface SessionPathRemap {
  /** Absolute directory as recorded on the sending device. */
  readonly from: string
  /** Absolute directory on the receiving device. */
  readonly to: string
}

/** Characters that end a path region in free text, tool output, or a quoted message. */
const PATH_TERMINATORS = new Set(['"', "'", '\n', '\r', '\t', '<', '>', '|', '*', '?', '\u0000'])

/** A Windows drive- or UNC-rooted directory, whose separators are backslashes. */
const WINDOWS_ROOT = /^(?:[A-Za-z]:[\\/]|\\)/u

/**
 * Whether one directory is written in Windows form.
 * @param path - the directory to classify.
 * @returns true for drive-rooted and UNC paths.
 */
function isWindowsForm(path: string): boolean {
  return WINDOWS_ROOT.test(path)
}

/** One literal spelling to search for, tagged with whether it sits inside a JSON string. */
interface Spelling {
  /** The literal text an event string carries. */
  readonly text: string
  /** Whether separators appear escaped (`\\`) because the value is embedded JSON text. */
  readonly json: boolean
}

/**
 * The spellings of one sending-device directory an event may carry. Node
 * `path` joins on Windows produce backslashes, while paths typed by a model or
 * a user often use forward slashes; both name the same directory. Tool-call
 * `arguments` is a JSON document stored as a string, so a Windows path inside
 * it carries doubled backslashes.
 * @param from - the sending-device directory.
 * @returns the distinct spellings to search for.
 */
function spellingsOf(from: string): readonly Spelling[] {
  const forward = from.replaceAll('\\', '/')
  const plain = forward === from ? [from] : [from, forward]
  const spellings: Spelling[] = []
  for (const text of plain) {
    spellings.push({ text, json: false })
    const escaped = text.replaceAll('\\', '\\\\')
    if (escaped !== text) spellings.push({ text: escaped, json: true })
  }
  return spellings
}

/**
 * Escape one literal for a regular expression.
 * @param value - literal text.
 * @returns the escaped pattern source.
 */
function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Whether a source-directory match ends at a path boundary, so a sibling such
 * as `C:\work\projects2` is not rewritten by a `C:\work\projects` remap.
 * @param text - the whole string value.
 * @param end - index just past the matched spelling.
 * @returns whether the match continues a path.
 */
function endsAtBoundary(text: string, end: number): boolean {
  if (end >= text.length) return true
  const next = text[end]
  return next === '/' || next === '\\'
}

/**
 * End of the path region that starts at `start`, scanning past spaces until a
 * character no file name may contain.
 * @param text - the whole string value.
 * @param start - first character after the rewritten directory.
 * @returns the exclusive end of the region.
 */
function regionEnd(text: string, start: number): number {
  let index = start
  while (index < text.length && !PATH_TERMINATORS.has(text.charAt(index))) index += 1
  return index
}

/**
 * Render a path region with POSIX separators, honoring JSON-escaped doubles.
 * @param region - the text after the rewritten directory.
 * @param json - whether the region is embedded JSON text.
 * @returns the region with every separator run collapsed to one `/`.
 */
function posixSeparators(region: string, json: boolean): string {
  return region.replaceAll(json ? /\\+/gu : /\\/gu, '/')
}

/**
 * Replace every occurrence of one source directory's spellings with the
 * receiving directory. A Windows source on a POSIX-like target also normalizes
 * the separators of the path region that follows, so the rewritten path is
 * valid on the receiving platform. A spelling inside embedded JSON text keeps
 * the target escaped for that context. All spellings share one scan, so a
 * separator-normalized region is never rewritten a second time.
 * @param text - one event string value.
 * @param remap - the directory pair.
 * @returns the rewritten text, unchanged when no spelling matches.
 */
function replaceRemap(text: string, remap: SessionPathRemap): string {
  const spellings = spellingsOf(remap.from)
    .map((spelling, index) => ({ spelling, index }))
    .sort((left, right) => right.spelling.text.length - left.spelling.text.length)
  const alternation = spellings
    .map(({ spelling, index }) => `(?<s${String(index)}>${escapePattern(spelling.text)})`)
    .join('|')
  const pattern = new RegExp(alternation, isWindowsForm(remap.from) ? 'giu' : 'gu')
  const normalizeSeparators = isWindowsForm(remap.from) && !isWindowsForm(remap.to)
  const pieces: string[] = []
  let cursor = 0
  let changed = false
  for (const match of text.matchAll(pattern)) {
    const chosen = spellings.find(({ index }) => match.groups?.[`s${String(index)}`] !== undefined)
    /* v8 ignore next -- the alternation only matches one of the named spellings */
    if (chosen === undefined) continue
    const from = chosen.spelling.text
    const start = match.index
    const end = start + from.length
    // A previous match's path region already covered this occurrence (the
    // directory text repeats inside its own continuation).
    if (start < cursor) continue
    if (!endsAtBoundary(text, end)) continue
    pieces.push(text.slice(cursor, start), chosen.spelling.json ? remap.to.replaceAll('\\', '\\\\') : remap.to)
    cursor = end
    changed = true
    if (normalizeSeparators) {
      const stop = regionEnd(text, end)
      pieces.push(posixSeparators(text.slice(end, stop), chosen.spelling.json))
      cursor = stop
    }
  }
  if (!changed) return text
  pieces.push(text.slice(cursor))
  return pieces.join('')
}

/**
 * Rewrite every remappable directory inside one string value.
 * @param text - one event string value.
 * @param remaps - directory pairs; the longest source is applied first.
 * @returns the rewritten value.
 */
export function remapEventText(text: string, remaps: readonly SessionPathRemap[]): string {
  let out = text
  for (const remap of ordered(remaps)) out = replaceRemap(out, remap)
  return out
}

/** Sort remaps longest source first, so a nested project root wins over its parent. */
function ordered(remaps: readonly SessionPathRemap[]): readonly SessionPathRemap[] {
  return [...remaps].sort((left, right) => right.from.length - left.from.length)
}

/**
 * Rewrite one JSON-shaped value recursively: strings are remapped, arrays and
 * plain objects are rebuilt in place, and every other value is returned as-is.
 * @param value - one event field value.
 * @param remaps - directory pairs, longest source first.
 * @returns the rewritten value.
 */
function remapValue(value: unknown, remaps: readonly SessionPathRemap[]): unknown {
  if (typeof value === 'string') return remapEventText(value, remaps)
  if (Array.isArray(value)) return value.map(item => remapValue(item, remaps))
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) out[key] = remapValue(item, remaps)
    return out
  }
  return value
}

/**
 * Rewrite every absolute path an event carries from the exporting device's
 * directories onto this device's.
 * @param event - one validated session event.
 * @param remaps - directory pairs; the longest source is applied first.
 * @returns the event to store.
 */
export function remapSessionEvent(event: SessionEvent, remaps: readonly SessionPathRemap[]): SessionEvent {
  return remapValue(event, ordered(remaps)) as SessionEvent
}
