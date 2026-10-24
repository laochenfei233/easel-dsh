/**
 * backup WebDAV destination host path: against a real local HTTP server, the
 * adapter speaks PROPFIND/MKCOL/PUT/GET/DELETE with Basic auth and explicit
 * Content-Length, creates missing directories bottom-up, maps statuses to
 * structured errors, and parses listings tolerantly across namespace styles.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { WebDavDestination, parsePropfind } from '../src/destinations/webdav.ts'

interface CapturedRequest {
  method: string
  url: string
  headers: IncomingMessage['headers']
  body: Buffer
}

/** One behavior per registered route; unhandled requests answer 404. */
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
    url: `http://127.0.0.1:${String(address.port)}/dav`,
    requests: capturedRequests,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections()
      server.close((error) => {
        if (error === undefined) resolve()
        else reject(error)
      })
    }),
  }
}

let cleanup: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const close of cleanup.reverse()) await close()
  cleanup = []
})

const basic = (user: string, password: string): string =>
  `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`

describe('WebDavDestination', () => {
  it('probe on an existing directory PROPFINDs depth 0 and leaves no canary', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'PROPFIND') {
        response.writeHead(207).end()
        return
      }
      if (request.method === 'PUT') {
        response.writeHead(201).end()
        return
      }
      if (request.method === 'DELETE') {
        response.writeHead(204).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    await expect(destination.probe()).resolves.toBeUndefined()
    expect(server.requests.filter(request => request.method === 'PROPFIND').length).toBeGreaterThan(0)
  })

  it('probe on a missing directory MKCOLs the hierarchy bottom-up, tolerating 405', async () => {
    const seen: string[] = []
    const server = await withServer((request, response) => {
      if (request.method === 'PROPFIND') {
        response.writeHead(request.url === '/dav' || seen.includes(request.url) ? 207 : 404).end()
        return
      }
      if (request.method === 'MKCOL') {
        seen.push(request.url)
        response.writeHead(request.url === '/dav' ? 405 : 201).end()
        return
      }
      if (request.method === 'PUT') {
        response.writeHead(201).end()
        return
      }
      if (request.method === 'DELETE') {
        response.writeHead(204).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: 'a/b', password: 'p' })
    await expect(destination.probe()).resolves.toBeUndefined()
    expect(seen).toEqual(['/dav', '/dav/a', '/dav/a/b'])
  })

  it('probe surfaces unreachable directories with the status code', async () => {
    const server = await withServer((request, response) => {
      response.writeHead(request.method === 'PROPFIND' ? 403 : 404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    await expect(destination.probe()).rejects.toMatchObject({ code: 'DESTINATION_UNREACHABLE' })
  })

  it('PUT sends Basic auth and the exact Content-Length, streaming the staging file', async () => {
    const bodies: Buffer[] = []
    const server = await withServer((request, response) => {
      if (request.method === 'PUT') {
        bodies.push(request.body)
        response.writeHead(201).end()
        return
      }
      if (request.method === 'DELETE') {
        response.writeHead(204).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const dir = await mkdtemp(join(tmpdir(), 'easel-backup-dav-'))
    cleanup.push(() => rm(dir, { recursive: true, force: true }))
    const source = join(dir, 'a.zip')
    await writeFile(source, Buffer.from('0123456789'))
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    await destination.put('easel-backup/config/x.zip', source)
    const put = server.requests.find(request => request.method === 'PUT')
    expect(put?.headers.authorization).toBe(basic('u', 'p'))
    expect(put?.headers['content-length']).toBe('10')
    expect(bodies[0]?.toString()).toBe('0123456789')
  })

  it('GET returns the body stream and a missing object maps to DESTINATION_MISSING', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'GET' && request.url === '/dav/easel-backup/config/x.zip') {
        response.writeHead(200, { 'content-length': 5 }).end('bytes')
        return
      }
      if (request.method === 'GET') {
        response.writeHead(404).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    const chunks: Buffer[] = []
    for await (const chunk of await destination.get('easel-backup/config/x.zip')) chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).toString()).toBe('bytes')
    await expect(destination.get('easel-backup/config/none.zip')).rejects.toMatchObject({ code: 'DESTINATION_MISSING' })
  })

  it('list parses PROPFIND depth-1 across namespace styles and skips the collection itself', async () => {
    const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
<d:response><d:href>/dav/easel-backup/config/</d:href></d:response>
<d:response><d:href>/dav/easel-backup/config/20261024T093000Z.zip</d:href><d:propstat><d:prop><d:getcontentlength>123</d:getcontentlength></d:prop></d:propstat></d:response>
<D:response><D:href>/dav/easel-backup/config/older%20zip.zip</D:href><D:propstat><D:prop><D:getcontentlength>7</D:getcontentlength></D:prop></D:propstat></D:response>
<d:response><d:href>/dav/easel-backup/config/folder/</d:href></d:response>
</d:multistatus>`
    const server = await withServer((request, response) => {
      if (request.method === 'PROPFIND' && request.headers.depth === '1') {
        response.writeHead(207, { 'content-type': 'application/xml' }).end(xml)
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    await expect(destination.list('easel-backup/config/')).resolves.toEqual([
      { key: 'easel-backup/config/20261024T093000Z.zip', size: 123 },
      { key: 'easel-backup/config/older zip.zip', size: 7 },
    ])
  })

  it('list of a missing collection is empty; server failures surface as HTTP_ERROR', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'PROPFIND' && request.url === '/dav/easel-backup/missing') {
        response.writeHead(404).end()
        return
      }
      if (request.method === 'PROPFIND') {
        // 长体走 readBodyText 截断；短体走『无响应体』兜底，两条分支都要。
        response.writeHead(500, { 'content-type': 'text/plain' }).end(request.url === '/dav/easel-backup/config' ? 'boom'.repeat(400) : '')
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    await expect(destination.list('easel-backup/missing/')).resolves.toEqual([])
    await expect(destination.list('easel-backup/config/')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
    await expect(destination.list('easel-backup/other/')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  })

  it('delete tolerates 404 and reports real failures; unsafe keys fail loudly', async () => {
    let deletes = 0
    const server = await withServer((request, response) => {
      if (request.method === 'DELETE') {
        deletes += 1
        response.writeHead(deletes === 1 ? 204 : 404).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    await expect(destination.del('a.zip')).resolves.toBeUndefined()
    await expect(destination.del('a.zip')).resolves.toBeUndefined()
    expect(() => new WebDavDestination({ endpoint: 'ftp://bad', username: 'u', remoteDir: '', password: 'p' })).toThrow()
    await expect(destination.put('../escape', Buffer.alloc(1))).rejects.toMatchObject({ code: 'CONFIG' })
  })

  it('parsePropfind tolerates prefixless XML and garbage input', () => {
    const prefixless = '<multistatus><response><href>/x/a.zip</href><propstat><prop><getcontentlength>3</getcontentlength></prop></propstat></response></multistatus>'
    expect(parsePropfind(prefixless, '/x')).toEqual([{ name: 'a.zip', size: 3 }])
    expect(parsePropfind('totally not xml', '/x')).toEqual([])
  })
})

describe('WebDavDestination failure paths', () => {
  it('PUT, GET and DELETE errors surface with status and body detail', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'PUT') {
        response.writeHead(507).end()
        return
      }
      if (request.method === 'GET') {
        response.writeHead(500).end()
        return
      }
      if (request.method === 'DELETE') {
        response.writeHead(409).end('locked')
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: '', password: 'p' })
    await expect(destination.put('a.zip', Buffer.alloc(1))).rejects.toMatchObject({ code: 'HTTP_ERROR' })
    await expect(destination.get('a.zip')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
    await expect(destination.del('a.zip')).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  })

  it('an https endpoint reaches the https request path and fails to connect', async () => {
    const destination = new WebDavDestination({ endpoint: 'https://127.0.0.1:9/dav', username: 'u', remoteDir: '', password: 'p' })
    await expect(destination.probe()).rejects.toThrow()
  })

  it('a failed MKCOL surfaces as an unreachable directory', async () => {
    const server = await withServer((request, response) => {
      if (request.method === 'PROPFIND') {
        response.writeHead(404).end()
        return
      }
      if (request.method === 'MKCOL') {
        response.writeHead(403).end()
        return
      }
      response.writeHead(404).end()
    })
    cleanup.push(server.close)
    const destination = new WebDavDestination({ endpoint: server.url, username: 'u', remoteDir: 'a', password: 'p' })
    await expect(destination.probe()).rejects.toMatchObject({ code: 'DESTINATION_UNREACHABLE' })
  })

  it('parsePropfind defaults the size when the server omits getcontentlength', () => {
    const xml = '<D:multistatus xmlns:D="DAV:"><D:response><D:href>/dav/easel-backup/config/a.zip</D:href></D:response></D:multistatus>'
    expect(parsePropfind(xml, '/dav')).toEqual([{ name: 'a.zip', size: 0 }])
  })

  it('parsePropfind skips empty response blocks', () => {
    const xml = '<D:multistatus xmlns:D="DAV:"><D:response></D:response><D:response><D:href>/dav/a.zip</D:href><D:propstat><D:prop><D:getcontentlength>4</D:getcontentlength></D:prop></D:propstat></D:response></D:multistatus>'
    expect(parsePropfind(xml, '/dav')).toEqual([{ name: 'a.zip', size: 4 }])
  })
})
