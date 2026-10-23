/**
 * Parsing one canonical session log (header line plus one JSON event per
 * line) into the storage vocabulary, validating it fail-closed before any
 * write happens.
 *
 * The header field checks deliberately mirror the JSONL backend's header
 * codec: the canonical export text is that backend's physical header line,
 * and this backend-agnostic package must not depend on a single backend
 * implementation. Disagreement would surface as a format refusal here, never
 * as a wrongly interpreted session.
 * @module @deepseek-ai/dsh-session-log-import/parse-log
 */

import { isAbsolute } from 'node:path'
import {
  SESSION_FORMAT_VERSION,
  SessionId,
  type SessionEvent,
  type SessionHeader,
} from '@deepseek-ai/dsh-session'
import { assertContiguous, validateStoredEvents } from '@deepseek-ai/dsh-session-persistence'
import { SessionImportFormatError } from './errors.ts'

/** One archive log parsed and validated against the current session format. */
export interface ParsedSessionLog {
  /** The immutable header as recorded by the exporting device. */
  readonly header: SessionHeader
  /** Validated, adopted, and frozen events in seq order. */
  readonly events: readonly SessionEvent[]
  /** Fork-inherited prefix length for seeded sessions; absent otherwise. */
  readonly inheritedEventCount?: number
}

/**
 * Parse and validate one canonical session log.
 * @param text - canonical JSONL text: header line, then one event per line.
 * @param path - the archive entry name, quoted in refusals.
 * @returns the parsed header, validated events, and seed cut.
 * @throws {SessionImportFormatError} when the text is not a current-format, contiguous, known-vocabulary log.
 */
export function parseSessionLog(text: string, path: string): ParsedSessionLog {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  const [headerLine, ...eventLines] = lines
  if (headerLine === undefined || headerLine.length === 0) {
    throw new SessionImportFormatError(path, 'session log is empty')
  }
  const header = parseHeaderLine(headerLine, path)
  const events: SessionEvent[] = []
  for (const [index, line] of eventLines.entries()) {
    if (line.length === 0) {
      throw new SessionImportFormatError(path, `session log has an empty event line at index ${index + 1}`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch (error) {
      throw new SessionImportFormatError(path, `event line ${index + 1} is not valid JSON`, { cause: error })
    }
    // Storage-contract validation immediately below is the admission gate for
    // every parsed record; nothing reaches a store before it passes.
    events.push(parsed as SessionEvent)
  }
  try {
    assertContiguous(header.id, events, 0)
    validateStoredEvents(header, events)
  } catch (error) {
    throw new SessionImportFormatError(
      path,
      /* v8 ignore next -- the storage contract only throws Error instances */
      `session log was refused by the storage contract: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  const inheritedEventCount = locateSeedCut(header, events, path)
  return inheritedEventCount === undefined
    ? { header, events }
    : { header, events, inheritedEventCount }
}

/**
 * Parse the canonical header line.
 * @param line - the first line of a canonical log.
 * @param path - the archive entry name, quoted in refusals.
 * @returns the immutable header.
 * @throws {SessionImportFormatError} when a field is missing, mistyped, or from another format version.
 */
function parseHeaderLine(line: string, path: string): SessionHeader {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch (error) {
    throw new SessionImportFormatError(path, 'header line is not valid JSON', { cause: error })
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new SessionImportFormatError(path, 'header line is not a JSON object')
  }
  const record = parsed as Record<string, unknown>
  if (record['type'] !== 'session') {
    throw new SessionImportFormatError(path, 'header line is not a session header')
  }
  const version = record['version']
  if (typeof version !== 'number' || version !== SESSION_FORMAT_VERSION) {
    throw new SessionImportFormatError(
      path,
      `session format version ${String(version)} cannot be imported by this build (expected ${SESSION_FORMAT_VERSION}); upgrade the importing harness`,
    )
  }
  const id = record['id']
  const createdAt = record['createdAt']
  const isSeeded = record['isSeeded']
  const delegationDepth = record['delegationDepth']
  const cwd = record['cwd']
  const parentSession = record['parentSession']
  const origin = record['origin']
  const agentPreset = record['agentPreset']
  if (typeof id !== 'string' || id.length === 0) {
    throw new SessionImportFormatError(path, 'header line is missing the session id')
  }
  if (typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt < 0) {
    throw new SessionImportFormatError(path, 'header line has an invalid createdAt')
  }
  if (typeof isSeeded !== 'boolean') {
    throw new SessionImportFormatError(path, 'header line is missing the isSeeded flag')
  }
  if (typeof delegationDepth !== 'number' || !Number.isSafeInteger(delegationDepth) || delegationDepth < 0) {
    throw new SessionImportFormatError(path, 'header line has an invalid delegationDepth')
  }
  if (cwd !== undefined && (typeof cwd !== 'string' || !isAbsolute(cwd))) {
    throw new SessionImportFormatError(path, 'header line carries a non-absolute cwd')
  }
  if (parentSession !== undefined && typeof parentSession !== 'string') {
    throw new SessionImportFormatError(path, 'header line has an invalid parentSession')
  }
  if (origin !== undefined && origin !== 'subagent') {
    throw new SessionImportFormatError(path, 'header line has an unsupported origin')
  }
  if (agentPreset !== undefined && typeof agentPreset !== 'string') {
    throw new SessionImportFormatError(path, 'header line has an invalid agentPreset')
  }
  return {
    version: SESSION_FORMAT_VERSION,
    id: SessionId(id),
    createdAt,
    ...cwd !== undefined ? { cwd } : {},
    ...parentSession !== undefined ? { parentSession: SessionId(parentSession) } : {},
    isSeeded,
    ...origin !== undefined ? { origin } : {},
    delegationDepth,
    ...agentPreset !== undefined ? { agentPreset } : {},
  }
}

/**
 * Resolve the fork-inherited prefix length for a seeded log.
 *
 * The seed log layout is fixed by construction: real copied events starting
 * at seq 0, then one `session/end-seed` marker with `inherited: true` whose
 * seq equals the inherited prefix length, then the child's own closers.
 * @param header - the parsed header.
 * @param events - contiguous validated events.
 * @param path - the archive entry name, quoted in refusals.
 * @returns the inherited prefix length, or `undefined` for an unseeded log.
 * @throws {SessionImportFormatError} when the seed markers and the header disagree.
 */
function locateSeedCut(
  header: SessionHeader,
  events: readonly SessionEvent[],
  path: string,
): number | undefined {
  const markers: number[] = []
  for (const event of events) {
    if (event.type === 'session/end-seed' && event.data.inherited === true) markers.push(event.seq)
  }
  if (!header.isSeeded) {
    if (markers.length > 0) {
      throw new SessionImportFormatError(path, 'unseeded session log carries an inherited seed marker')
    }
    return undefined
  }
  const [first] = markers
  if (first === undefined) {
    throw new SessionImportFormatError(path, 'seeded session log is missing its inherited seed marker')
  }
  if (markers.length > 1) {
    throw new SessionImportFormatError(path, 'seeded session log carries more than one inherited seed marker')
  }
  return first
}
