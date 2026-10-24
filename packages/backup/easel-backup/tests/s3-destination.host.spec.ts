/**
 * backup S3 destination host path: against a local HTTP endpoint the adapter
 * sends SigV4-signed requests (Authorization schema, UNSIGNED-PAYLOAD, exact
 * Content-Length), switches URL shape with path-style, pages listings through
 * continuation tokens, and maps statuses to structured errors.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { S3Destination, parseListObjects, s3BucketRoot } from '../src/destinations/s3.ts'
import { BackupError } from '../src/errors.ts'
import type { S3Access } from '../src/destinations/s3.ts'

interface CapturedRequest {
  method: string
  url: string
  headers: IncomingMessage['headers']
  body: Buffer
}

type Handler = (request: CapturedRequest, response: ServerResponse) => void

async function withServer(handler: Handler): Promise<{ url: string; requests: CapturedRequest[]; close: () => Promise<void> }> {
  const capturedRequests: CapturedRequest[] = []
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(chunk as Buffer))
    request.on('end', () => {
      const captured = { method: request.method ?? '', url: request.url ?? '', headers: request.headers, body: Buffer.concat(chunks) }
      capturedRequests.push(captured)
      handler(captured, response)
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    requests: capturedRequests,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections()
      server.close(error => (error === undefined ? resolve() : reject(error)))
    }),
  }
}

let cleanup: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const close of cleanup.reverse()) await close()
  cleanup = []
})

const access = (endpoint: string, pathStyle: boolean): S3Access => ({
  endpoint,
  region: 'us-east-1',
  bucket: 'bkt',
  pathStyle,
  accessKeyId: 'AKID',
  secretAccessKey: 'secret',
})

describe('S3Destination', () => {
  it('PUT is SigV4-signed with UNSIGNED-PAYLOAD and the exact Content-Length', async () => {
    const server = await withServer((request, response) => {
      response.writeHead(request.method === 'PUT' ? 200 : 404).end()
    })
    cleanup.push(server.close)
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-s3-'))
    cleanup.push(() => rm(dir, { recursive: true, force: true }))
    const source = join(dir, 'a.zip')
    await writeFile(source, Buffer.from('0123456789'))
    const destination = new S3Destination(access(server.url, true))
    await destination.put('easel-backup/config/x.zip', source)
    const put = server.requests.find(request => request.method === 'PUT')
    expect(put?.url).toBe('/bkt/easel-backup/config/x.zip')
    expect(put?.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /)
    expect(put?.headers['x-amz-content-sha256']).toBe('UNSIGNED-PAYLOAD')
    expect(put?.headers['content-length']).toBe('10')
    expect(put?.body.toString()).toBe('0123456789')
  })

  it('virtual-host style addressing moves the bucket into the host', () => {
    expect(s3BucketRoot('http://10.0.0.5:9000', 'us-east-1', 'bkt', true)).toBe('http://10.0.0.5:9000/bkt')
    expect(s3BucketRoot('http://10.0.0.5:9000', 'us-east-1', 'bkt', false)).toBe('http://bkt.10.0.0.5:9000')
    expect(s3BucketRoot('', 'eu-west-2', 'bkt', true)).toBe('https://s3.eu-west-2.amazonaws.com/bkt')
    expect(() => s3BucketRoot('ftp://bad', 'us-east-1', 'bkt', true)).toThrowError(BackupError)
    expect(() => s3BucketRoot('notaurl', 'us-east-1', 'bkt', true)).toThrowError(BackupError)
  })

  it('get streams the object and maps 404 to DESTINATION_MISSING', async () => {
    const server = await withServer((request, response) => {
      if (request.url === '/bkt/there.zip') {
        response.writeHead(200).end('bytes')
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new S3Destination(access(server.url, true))
    const chunks: Buffer[] = []
    for await (const chunk of await destination.get('there.zip')) chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).toString()).toBe('bytes')
    await expect(destination.get('gone.zip')).rejects.toMatchObject({ code: 'DESTINATION_MISSING' })
  })

  it('list pages through continuation tokens and exposes keys with sizes', async () => {
    const server = await withServer((request, response) => {
      if (request.url.includes('continuation-token')) {
        response.writeHead(200).end(
          '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>easel-backup/config/old.zip</Key><Size>2</Size></Contents></ListBucketResult>',
        )
        return
      }
      response.writeHead(200).end(
        '<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>tok/1</NextContinuationToken>'
        + '<Contents><Key>easel-backup/config/new.zip</Key><Size>10</Size></Contents></ListBucketResult>',
      )
    })
    cleanup.push(server.close)
    const destination = new S3Destination(access(server.url, true))
    await expect(destination.list('easel-backup/config/')).resolves.toEqual([
      { key: 'easel-backup/config/new.zip', size: 10 },
      { key: 'easel-backup/config/old.zip', size: 2 },
    ])
    expect(server.requests[0]?.url).toContain('list-type=2')
    expect(server.requests[1]?.url).toContain('continuation-token=')
  })

  it('delete tolerates 404; list and delete failures surface as HTTP_ERROR', async () => {
    let deletes = 0
    const server = await withServer((request, response) => {
      if (request.method === 'DELETE') {
        deletes += 1
        response.writeHead(deletes === 1 ? 204 : 404).end()
        return
      }
      if (request.method === 'GET') {
        // 403 而非 5xx：aws4fetch 对 5xx/429 自带退避重试，4xx 立即返回。
        response.writeHead(403).end('<Error><Code>AccessDenied</Code></Error>')
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new S3Destination(access(server.url, true))
    await expect(destination.del('a.zip')).resolves.toBeUndefined()
    await expect(destination.del('a.zip')).resolves.toBeUndefined()
    await expect(destination.list('easel-backup/')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  })

  it('parseListObjects tolerates missing sizes, keyless entries, and foreign bodies', () => {
    expect(parseListObjects('<Contents><Key>a.zip</Key></Contents>')).toEqual({
      objects: [{ key: 'a.zip', size: 0 }],
      truncated: false,
      nextToken: '',
    })
    expect(parseListObjects('<Contents><Size>1</Size></Contents>')).toEqual({
      objects: [],
      truncated: false,
      nextToken: '',
    })
    expect(parseListObjects('<html>nope</html>')).toEqual({ objects: [], truncated: false, nextToken: '' })
  })
})

describe('S3Destination remaining paths', () => {
  it('probe writes and removes a canary; unsafe keys fail loudly', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'PUT') {
        response.writeHead(200).end()
        return
      }
      if (request.method === 'DELETE') {
        response.writeHead(204).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new S3Destination(access(server.url, true))
    await expect(destination.probe()).resolves.toBeUndefined()
    await expect(destination.put('../escape', Buffer.alloc(1))).rejects.toMatchObject({ code: 'CONFIG' })
  })

  it('get and delete failures surface as HTTP_ERROR', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'DELETE') {
        response.writeHead(409).end('<Error><Code>Locked</Code></Error>')
        return
      }
      response.writeHead(403).end('<Error><Code>AccessDenied</Code></Error>')
    })
    cleanup.push(server.close)
    const destination = new S3Destination(access(server.url, true))
    await expect(destination.get('a.zip')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
    await expect(destination.del('a.zip')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  })

  it('a failed PUT surfaces as HTTP_ERROR with the empty-body fallback', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'PUT') {
        response.writeHead(403).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new S3Destination(access(server.url, true))
    await expect(destination.put('a.zip', Buffer.alloc(1))).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  })

  it('a foreign endpoint scheme fails at construction', () => {
    expect(() => new S3Destination(access('ftp://bad', true))).toThrowError(BackupError)
  })
})
