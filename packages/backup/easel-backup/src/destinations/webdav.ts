import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { BackupError } from '../errors.js';
import { readBodyText, requestRaw, toWebResponse } from './raw-http.js';
import type { Destination, RemoteObject } from '../types.js';

/** How much of an error body to keep in failure reports. */
const ERROR_BODY_BYTES = 512;

/** WebDAV address material plus the resolved Basic-auth password. */
export interface WebDavAccess {
  /** Base URL such as `https://dav.example.com/dav`; no trailing slash. */
  endpoint: string;
  /** Account name sent with Basic auth. */
  username: string;
  /** Directory under the endpoint that holds `easel-backup/`. */
  remoteDir: string;
  /** Basic-auth password. */
  password: string;
}

/** One parsed PROPFIND entry. */
interface PropfindEntry {
  /** Decoded last path segment. */
  name: string;
  /** Reported size in bytes, 0 when the server omits it. */
  size: number;
}

/**
 * Parse a multistatus PROPFIND body with a tolerant scan: namespace prefixes
 * vary between servers, so each element is matched with an optional prefix.
 * @param xml - The 207 response body.
 * @param selfPathname - Decoded request pathname without trailing slash; entries equal to it are the collection itself.
 * @returns The child file entries of the collection.
 */
export function parsePropfind(xml: string, selfPathname: string): PropfindEntry[] {
  const entries: PropfindEntry[] = [];
  const responsePattern = /<(?:[\w.-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?response>/gi;
  for (const match of xml.matchAll(responsePattern)) {
    const block = match[1]!;
    const href = /<(?:[\w.-]+:)?href\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?href>/i.exec(block)?.[1] ?? '';
    let decoded = decodeURIComponent(href.trim()).replace(/&amp;/g, '&');
    const isCollection = decoded.endsWith('/');
    decoded = decoded.replace(/\/+$/, '');
    if (isCollection || decoded === selfPathname) continue;
    const name = decoded.slice(decoded.lastIndexOf('/') + 1);
    if (name === '') continue;
    const size = Number(/<(?:[\w.-]+:)?getcontentlength\b[^>]*>(\d+)</i.exec(block)?.[1] ?? '0');
    entries.push({ name, size });
  }
  return entries;
}

/**
 * WebDAV destination speaking the verbs NAS gateways and cloud drives accept:
 * `PROPFIND`/`MKCOL`/`PUT`/`GET`/`DELETE` with Basic auth. Digest-only servers
 * are out of scope.
 */
export class WebDavDestination implements Destination {
  /** Base URL of the remote directory. */
  private readonly base: URL;
  /** Authorization header value. */
  private readonly authorization: string;

  /**
   * @param access - Endpoint, account, directory, and password.
   */
  constructor(access: WebDavAccess) {
    const endpoint = access.endpoint.replace(/\/+$/, '');
    if (!/^https?:\/\//.test(endpoint)) {
      throw new BackupError('CONFIG', `WebDAV 地址必须是 http(s) URL：${access.endpoint}`);
    }
    const dir = access.remoteDir.split('/').filter(Boolean);
    this.base = new URL(dir.length === 0 ? endpoint : `${endpoint}/${dir.map(encodeURIComponent).join('/')}`);
    this.authorization = `Basic ${Buffer.from(`${access.username}:${access.password}`, 'utf8').toString('base64')}`;
  }

  /**
   * Encode one key's segments onto the base URL.
   * @param key - Key with `/` separators.
   * @returns The absolute object URL.
   */
  private urlFor(key: string): URL {
    if (key.split('/').includes('..')) throw new BackupError('CONFIG', `目标端 key 不合法：${JSON.stringify(key)}`);
    return new URL(`${this.base.pathname}/${key.split('/').map(encodeURIComponent).join('/')}${this.base.search}`, this.base);
  }

  /**
   * Issue one authenticated request and drain+report error bodies.
   * @param url - Target URL.
   * @param method - HTTP method.
   * @param extraHeaders - Additional headers beyond Authorization.
   * @param body - Request body when present.
   * @returns The raw response; error responses are drained and thrown as {@link BackupError}.
   */
  private async request(
    url: URL,
    method: string,
    extraHeaders: Record<string, string | number> = {},
    body?: Readable | Buffer,
  ): Promise<Awaited<ReturnType<typeof requestRaw>>> {
    const response = await requestRaw(url, method, { Authorization: this.authorization, ...extraHeaders }, body);
    if (response.status >= 400) {
      const detail = await readBodyText(response.body, ERROR_BODY_BYTES);
      throw new BackupError('HTTP_ERROR', `WebDAV ${method} ${url.pathname} 失败（${String(response.status)}）：${detail.trim() || '无响应体'}`);
    }
    return response;
  }

  /**
   * @inheritdoc Destination.probe
   */
  async probe(): Promise<void> {
    let status = await this.propfindStatus(this.base, 0);
    if (status === 404) {
      await this.mkcolHierarchy();
      status = await this.propfindStatus(this.base, 0);
    }
    if (status !== 207 && status !== 200) {
      throw new BackupError('DESTINATION_UNREACHABLE', `WebDAV 目录不可达（PROPFIND ${String(status)}）`);
    }
    const probeKey = '.easel-backup-probe';
    await this.put(probeKey, Buffer.from('easel-backup probe', 'utf8'));
    await this.del(probeKey);
  }

  /**
   * Run one PROPFIND and report only the status code, draining the body.
   * @param url - Collection to inspect.
   * @param depth - WebDAV Depth header value.
   * @returns The response status.
   */
  private async propfindStatus(url: URL, depth: 0 | 1): Promise<number> {
    const response = await requestRaw(url, 'PROPFIND', { Authorization: this.authorization, Depth: depth });
    await readBodyText(response.body, ERROR_BODY_BYTES);
    return response.status;
  }

  /** Create the remote directory hierarchy; servers answer 405 for existing collections. */
  private async mkcolHierarchy(): Promise<void> {
    const endpoint = this.base.origin;
    const segments = decodeURIComponent(this.base.pathname).split('/').filter(Boolean);
    for (let count = 1; count <= segments.length; count++) {
      const url = new URL(`/${segments.slice(0, count).map(encodeURIComponent).join('/')}`, endpoint);
      const response = await requestRaw(url, 'MKCOL', { Authorization: this.authorization });
      await readBodyText(response.body, ERROR_BODY_BYTES);
      const created = response.status >= 200 && response.status < 400;
      if (!created && response.status !== 405) {
        throw new BackupError('DESTINATION_UNREACHABLE', `WebDAV MKCOL ${url.pathname} 失败（${String(response.status)}）`);
      }
    }
  }

  /**
   * @inheritdoc Destination.put
   */
  async put(key: string, source: string | Uint8Array): Promise<void> {
    const url = this.urlFor(key);
    let body: Readable | Buffer;
    let length: number;
    if (typeof source === 'string') {
      length = (await stat(source)).size;
      body = createReadStream(source);
    } else {
      body = Buffer.from(source);
      length = body.length;
    }
    await this.request(url, 'PUT', { 'Content-Type': 'application/octet-stream', 'Content-Length': length }, body);
  }

  /**
   * @inheritdoc Destination.get
   */
  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const url = this.urlFor(key);
    const response = await requestRaw(url, 'GET', { Authorization: this.authorization });
    if (response.status === 404) {
      response.body.destroy();
      throw new BackupError('DESTINATION_MISSING', `目标端没有这个文件：${key}`);
    }
    if (response.status < 200 || response.status >= 300) {
      const detail = await readBodyText(response.body, ERROR_BODY_BYTES);
      throw new BackupError('HTTP_ERROR', `WebDAV GET ${url.pathname} 失败（${String(response.status)}）：${detail.trim() || '无响应体'}`);
    }
    return toWebResponse(response.body);
  }

  /**
   * @inheritdoc Destination.list
   */
  async list(prefix: string): Promise<RemoteObject[]> {
    const dirKey = prefix.replace(/\/$/, '');
    const url = this.urlFor(dirKey);
    const response = await requestRaw(url, 'PROPFIND', { Authorization: this.authorization, Depth: 1 });
    if (response.status === 404) {
      await readBodyText(response.body, ERROR_BODY_BYTES);
      return [];
    }
    if (response.status !== 207 && response.status !== 200) {
      const detail = await readBodyText(response.body, ERROR_BODY_BYTES);
      throw new BackupError('HTTP_ERROR', `WebDAV PROPFIND ${url.pathname} 失败（${String(response.status)}）：${detail.trim() || '无响应体'}`);
    }
    const xml = await readBodyText(response.body, 4 * 1024 * 1024);
    const selfPathname = decodeURIComponent(url.pathname);
    return parsePropfind(xml, selfPathname).map(entry => ({
      key: `${dirKey}/${entry.name}`,
      size: entry.size,
    }));
  }

  /**
   * @inheritdoc Destination.del
   */
  async del(key: string): Promise<void> {
    const url = this.urlFor(key);
    const response = await requestRaw(url, 'DELETE', { Authorization: this.authorization });
    await readBodyText(response.body, ERROR_BODY_BYTES);
    if (response.status >= 400 && response.status !== 404) {
      throw new BackupError('HTTP_ERROR', `WebDAV DELETE ${url.pathname} 失败（${String(response.status)}）`);
    }
  }
}
