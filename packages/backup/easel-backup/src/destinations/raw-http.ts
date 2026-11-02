import { request as requestHttp } from 'node:http'
import { request as requestHttps } from 'node:https'
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'

/** One completed HTTP exchange with the response body still unconsumed. */
export interface RawResponse {
  /** Status code. */
  status: number
  /** Response headers. */
  headers: IncomingHttpHeaders
  /** Response body stream; the caller must consume or destroy it. */
  body: IncomingMessage
}

/**
 * Issue one HTTP(S) request with full control over headers — node's fetch
 * strips `Content-Length` from stream bodies, which strict WebDAV servers and
 * S3-compatible gateways reject.
 * @param url - Target URL.
 * @param method - HTTP method.
 * @param headers - Headers to send verbatim.
 * @param body - Request body: buffered bytes, a readable to pipe, or nothing.
 * @returns The response with its body stream unconsumed.
 */
export function requestRaw(
  url: URL,
  method: string,
  headers: Record<string, string | number>,
  body?: Readable | Buffer,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? requestHttps : requestHttp
    const req = send(url, { method, headers }, (response) => {
      resolve({ status: response.statusCode as number, headers: response.headers, body: response })
    })
    req.on('error', reject)
    if (body === undefined) {
      req.end()
    } else if (Buffer.isBuffer(body)) {
      req.end(body)
    } else {
      body.pipe(req)
      body.on('error', reject)
    }
  })
}

/**
 * Consume a response body as text, capped so error paths cannot buffer
 * unbounded server output.
 * @param body - Response body to drain.
 * @param maxBytes - Maximum bytes to keep.
 * @returns The drained UTF-8 text, truncated to the cap.
 */
export async function readBodyText(body: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of body) {
    const buffer = chunk as Buffer
    total += buffer.length
    chunks.push(buffer)
    if (total >= maxBytes) break
  }
  body.destroy()
  return Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8')
}

/**
 * Turn a node response into a web byte stream, the currency `Destination.get`
 * returns.
 * @param body - Response body to convert.
 * @returns A web readable stream of the same bytes.
 */
export function toWebResponse(body: IncomingMessage): ReadableStream<Uint8Array> {
  return Readable.toWeb(body) as ReadableStream<Uint8Array>
}
