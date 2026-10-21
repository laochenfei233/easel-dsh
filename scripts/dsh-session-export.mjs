// Dump or migrate a dsh session log (multi-frame zstd JSONL).
//
//   node dsh-session-export.mjs <session-dir|session.v4.jsonl.zstd>            # → JSONL on stdout
//   node dsh-session-export.mjs <target> -o out.jsonl                          # → JSONL to a file
//   node dsh-session-export.mjs <target> --set-cwd 'C:\new\root' -o out.zstd   # rewrite the header cwd
//
// A dsh session artifact is a concatenation of individually checksummed zstd
// frames (a header frame, then one frame per durable batch); Node's zstd API
// decodes one frame at a time, so frames are walked by header — a port of
// dsh's own scanZstdFrames (packages/session/session-persistence-jsonl/src/zstd.ts).
// --set-cwd edits only the first JSONL line (the session header) and keeps
// every other frame byte-identical; install the result over the original with
// dsh shut down.
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib'

const MAGIC = 0xFD2FB528
const LOG_NAME = 'session.v4.jsonl.zstd'

function frameRanges(buffer) {
  const ranges = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4 || buffer.readUInt32LE(offset) !== MAGIC) {
      throw new Error(`invalid zstd frame magic at byte ${offset}`)
    }
    offset += 4
    const descriptor = buffer.readUInt8(offset); offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    for (;;) {
      const blockHeader = buffer.readUIntLE(offset, 3); offset += 3
      const last = (blockHeader & 1) !== 0
      const type = (blockHeader >>> 1) & 0x03
      const size = blockHeader >>> 3
      offset += type === 0x01 ? 1 : size
      if (last) break
    }
    if (checksum) offset += 4
    ranges.push([start, offset])
  }
  return ranges
}

const args = process.argv.slice(2)
let out, setCwd
const positional = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o') out = args[++i]
  else if (args[i] === '--set-cwd') setCwd = args[++i]
  else positional.push(args[i])
}
const target = positional[0]
if (!target) {
  console.error('usage: dsh-session-export.mjs <session-dir|session.v4.jsonl.zstd> [-o out] [--set-cwd <path>]')
  process.exit(2)
}
if (setCwd !== undefined && out === undefined) {
  console.error('--set-cwd writes a new artifact; pass -o <file>')
  process.exit(2)
}

const file = statSync(target).isDirectory() ? join(target, LOG_NAME) : target
const buffer = readFileSync(file)
const ranges = frameRanges(buffer)
const frames = ranges.map(([s, e]) => zstdDecompressSync(buffer.subarray(s, e)))
const plaintext = Buffer.concat(frames)

let result
if (setCwd === undefined) {
  result = plaintext
} else {
  const lines = frames[0].toString('utf8').split('\n')
  if (!lines[0]) throw new Error('first frame has no header line')
  const header = JSON.parse(lines[0])
  header.cwd = setCwd
  lines[0] = JSON.stringify(header)
  const checksum = constants.ZSTD_c_checksumFlag !== undefined
    ? { params: { [constants.ZSTD_c_checksumFlag]: 1 } }
    : {}
  result = Buffer.concat([
    zstdCompressSync(Buffer.from(lines.join('\n'), 'utf8'), checksum),
    ...ranges.slice(1).map(([s, e]) => buffer.subarray(s, e)),
  ])
}

if (out === undefined) {
  // `| head` and friends close the pipe early; that is not an error.
  process.stdout.on('error', (error) => {
    if (error.code === 'EPIPE') process.exit(0)
    throw error
  })
  process.stdout.write(plaintext)
} else {
  writeFileSync(out, result)
  console.error(`wrote ${out} (${result.length} bytes, ${ranges.length} frame(s))`)
}
