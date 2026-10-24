/**
 * Wire framing for LAN handoff: one length-prefixed JSON header followed by a
 * declared number of binary bytes, over the TLS stream.
 *
 * `binaryLength` travels inside the JSON header, so the reader never needs a
 * message boundary from TLS. Unknown message types are skipped by consumers,
 * never by the frame layer.
 * @module @easel-dsh/easel-air-transfer/frame
 */

/** JSON header cap after authentication, matching a bundle manifest's practical size. */
export const FRAME_HEADER_MAX_BYTES = 4 * 1024 * 1024

/** JSON header cap before pairing completes, sized for a device hello. */
export const FRAME_UNAUTHENTICATED_HEADER_MAX_BYTES = 64 * 1024

/** Binary payload cap per frame. */
export const FRAME_BINARY_MAX_BYTES = 100 * 1024 * 1024

/** One decoded wire message. */
export interface WireMessage {
  /** Discriminant tag; consumers skip tags they do not know. */
  readonly type: string
  /** Declared binary payload length in bytes. */
  readonly binaryLength: number
  /** Every other message field. */
  readonly [key: string]: unknown
}

/** Incremental frame reader over one stream. */
export interface FrameReader {
  /**
   * Feed one socket chunk; complete frames are delivered in stream order.
   * @param chunk - bytes in stream order.
   */
  push(chunk: Buffer): void
}

/** Failure for frames that cannot be decoded; the connection must close. */
export class FrameError extends Error {
  /**
   * @param reason - what the stream violated.
   * @param cause - the underlying parse failure, when one exists.
   */
  constructor(reason: string, cause?: unknown) {
    super(`LAN handoff frame violation: ${reason}`, cause === undefined ? undefined : { cause })
  }
}

/**
 * Parse one JSON header object into a wire message.
 * @param value - parsed JSON.
 * @returns the typed message.
 * @throws {FrameError} when the header is not an object with a string type and a valid binary length.
 */
function asWireMessage(value: unknown): WireMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FrameError('header is not a JSON object')
  }
  const record = value as Record<string, unknown>
  const type = record['type']
  const binaryLength = record['binaryLength']
  if (typeof type !== 'string' || type.length === 0) throw new FrameError('header has no type tag')
  if (typeof binaryLength !== 'number' || !Number.isSafeInteger(binaryLength) || binaryLength < 0) {
    throw new FrameError('header has no valid binaryLength')
  }
  if (binaryLength > FRAME_BINARY_MAX_BYTES) throw new FrameError(`binary payload of ${binaryLength} bytes exceeds the cap`)
  return { ...record, type, binaryLength }
}

/**
 * Encode one message.
 * @param message - typed fields; `binaryLength` must equal the payload length.
 * @param binary - payload bytes.
 * @returns the frame bytes in stream order.
 * @throws {FrameError} when the declared length disagrees with the payload.
 */
export function encodeFrame(message: Omit<WireMessage, 'binaryLength'> & { readonly binaryLength?: number }, binary?: Uint8Array): Buffer {
  const payload = binary ?? new Uint8Array(0)
  const declared = message.binaryLength ?? payload.byteLength
  if (declared !== payload.byteLength) {
    throw new FrameError(`binaryLength ${declared} does not match the payload (${payload.byteLength})`)
  }
  const header = Buffer.from(JSON.stringify({ ...message, binaryLength: declared }), 'utf8')
  if (header.byteLength > FRAME_HEADER_MAX_BYTES) throw new FrameError(`header of ${header.byteLength} bytes exceeds the cap`)
  const prefix = Buffer.alloc(4)
  prefix.writeUInt32BE(header.byteLength, 0)
  return Buffer.concat([prefix, header, Buffer.from(payload)])
}

/**
 * Create an incremental frame reader.
 *
 * Chunks may split frames anywhere. A zero-length or oversized header, an
 * unparsable header, or an invalid binary length fails the connection.
 * @param onMessage - receiver of each complete message and its payload copy.
 * @param maxHeaderBytes - header cap; omit for the post-authentication cap.
 * @returns the reader to feed socket chunks into.
 */
export function createFrameReader(
  onMessage: (message: WireMessage, binary: Uint8Array) => void,
  maxHeaderBytes: number = FRAME_HEADER_MAX_BYTES,
): FrameReader {
  let buffered: Buffer = Buffer.alloc(0)
  let headerLength: number | undefined
  let message: WireMessage | undefined
  return {
    push(chunk: Buffer): void {
      buffered = buffered.byteLength === 0 ? chunk : Buffer.concat([buffered, chunk])
      for (;;) {
        if (message === undefined) {
          if (headerLength === undefined) {
            if (buffered.byteLength < 4) return
            headerLength = buffered.readUInt32BE(0)
            if (headerLength === 0 || headerLength > maxHeaderBytes) {
              throw new FrameError(`header length ${headerLength} is outside 1..${maxHeaderBytes}`)
            }
            buffered = buffered.subarray(4)
          }
          if (buffered.byteLength < headerLength) return
          let parsed: unknown
          try {
            parsed = JSON.parse(buffered.subarray(0, headerLength).toString('utf8'))
          } catch (error) {
            throw new FrameError('header is not valid JSON', error)
          }
          buffered = buffered.subarray(headerLength)
          headerLength = undefined
          message = asWireMessage(parsed)
        }
        if (buffered.byteLength < message.binaryLength) return
        const binary = Buffer.from(buffered.subarray(0, message.binaryLength))
        buffered = buffered.subarray(message.binaryLength)
        const settled = message
        message = undefined
        onMessage(settled, binary)
        if (buffered.byteLength === 0) return
      }
    },
  }
}
