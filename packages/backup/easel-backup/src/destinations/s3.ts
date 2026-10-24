import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { AwsClient } from 'aws4fetch';
import { BackupError } from '../errors.js';
import { readBodyText, requestRaw, toWebResponse } from './raw-http.js';
import type { Destination, RemoteObject } from '../types.js';

/** How much of an error body to keep in failure reports. */
const ERROR_BODY_BYTES = 512;

/** S3 address material plus the resolved key pair. */
export interface S3Access {
  /** API endpoint; empty string selects the AWS default for the region. */
  endpoint: string;
  /** S3 region. */
  region: string;
  /** Bucket name. */
  bucket: string;
  /** Path-style addressing for MinIO-class gateways. */
  pathStyle: boolean;
  /** Access key id. */
  accessKeyId: string;
  /** Secret access key. */
  secretAccessKey: string;
}

/** One parsed ListObjectsV2 contents element. */
interface ListedObject {
  /** Object key as stored. */
  key: string;
  /** Size in bytes. */
  size: number;
}

/**
 * Parse one ListObjectsV2 XML body with a tolerant scan: single-valued fields
 * are read per `<Contents>` block, which keeps namespacing irrelevant.
 * @param xml - The list response body.
 * @returns The listed objects and whether the listing continues.
 */
export function parseListObjects(xml: string): { objects: ListedObject[]; truncated: boolean; nextToken: string } {
  const objects: ListedObject[] = [];
  const contentsPattern = /<Contents\b[^>]*>([\s\S]*?)<\/Contents>/gi;
  for (const match of xml.matchAll(contentsPattern)) {
    const block = match[1]!;
    const key = /<Key>([\s\S]*?)<\/Key>/i.exec(block)?.[1];
    if (key === undefined) continue;
    const size = Number(/<Size>(\d+)<\/Size>/i.exec(block)?.[1] ?? '0');
    objects.push({ key, size });
  }
  const truncated = /<IsTruncated\s*>\s*true\s*<\/IsTruncated>/i.test(xml);
  const nextToken = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/i.exec(xml)?.[1] ?? '';
  return { objects, truncated, nextToken };
}

/**
 * Derive the bucket root URL from endpoint and addressing style: path-style
 * appends the bucket to the path, virtual-host style prepends it to the host.
 * @param endpoint - Endpoint origin without trailing slash (empty selects the AWS default).
 * @param region - Region for the AWS default endpoint.
 * @param bucket - Bucket name.
 * @param pathStyle - True for path-style addressing.
 * @returns The bucket root URL without trailing slash.
 */
export function s3BucketRoot(endpoint: string, region: string, bucket: string, pathStyle: boolean): string {
  const origin = (endpoint || `https://s3.${region}.amazonaws.com`).replace(/\/+$/, '');
  if (!/^https?:\/\//.test(origin)) {
    throw new BackupError('CONFIG', `S3 endpoint 必须是 http(s) URL：${endpoint}`);
  }
  if (!pathStyle) {
    const url = new URL(origin);
    return `${url.protocol}//${bucket}.${url.host}`;
  }
  return `${origin}/${bucket}`;
}

/**
 * S3 destination over aws4fetch signing: uploads stream from staging files
 * with an explicit `Content-Length` through node's own request path (fetch
 * would switch to chunked transfer, which S3-compatible gateways reject),
 * while listings, deletes, and downloads ride the signed fetch.
 */
export class S3Destination implements Destination {
  /** Signing client. */
  private readonly client: AwsClient;
  /** Bucket root URL without trailing slash. */
  private readonly bucketRoot: string;

  /**
   * @param access - Endpoint, region, bucket, addressing style, and key pair.
   */
  constructor(access: S3Access) {
    this.client = new AwsClient({ accessKeyId: access.accessKeyId, secretAccessKey: access.secretAccessKey, region: access.region, service: 's3' });
    this.bucketRoot = s3BucketRoot(access.endpoint, access.region, access.bucket, access.pathStyle);
  }

  /**
   * Build the URL for one object key.
   * @param key - Key with `/` separators.
   * @returns The absolute object URL.
   */
  private urlFor(key: string): string {
    if (key.split('/').includes('..')) throw new BackupError('CONFIG', `目标端 key 不合法：${JSON.stringify(key)}`);
    return `${this.bucketRoot}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  /**
   * Sign one request and flatten its headers for the raw request path.
   * @param url - Target URL.
   * @param method - HTTP method.
   * @returns Signed headers, including the SigV4 authorization entry.
   */
  private async signedHeaders(url: string, method: string): Promise<Record<string, string>> {
    const signed = await this.client.sign(new Request(url, { method, headers: { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' } }));
    const headers: Record<string, string> = {};
    signed.headers.forEach((value, name) => {
      headers[name] = value;
    });
    return headers;
  }

  /**
   * @inheritdoc Destination.probe
   */
  async probe(): Promise<void> {
    const probeKey = '.easel-backup-probe';
    await this.put(probeKey, Buffer.from('easel-backup probe', 'utf8'));
    await this.del(probeKey);
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
    const headers = await this.signedHeaders(url, 'PUT');
    headers['content-length'] = String(length);
    headers['content-type'] = 'application/octet-stream';
    const response = await requestRaw(new URL(url), 'PUT', headers, body);
    if (response.status < 200 || response.status >= 300) {
      const detail = await readBodyText(response.body, ERROR_BODY_BYTES);
      throw new BackupError('HTTP_ERROR', `S3 PUT ${key} 失败（${String(response.status)}）：${detail.trim() || '无响应体'}`);
    }
    response.body.destroy();
  }

  /**
   * @inheritdoc Destination.get
   */
  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const response = await this.client.fetch(this.urlFor(key), { method: 'GET' });
    if (response.status === 404) {
      throw new BackupError('DESTINATION_MISSING', `目标端没有这个文件：${key}`);
    }
    if (response.status < 200 || response.status >= 300) {
      const detail = await response.text();
      throw new BackupError('HTTP_ERROR', `S3 GET ${key} 失败（${String(response.status)}）：${detail.slice(0, ERROR_BODY_BYTES)}`);
    }
    return response.body as ReadableStream<Uint8Array>;
  }

  /**
   * @inheritdoc Destination.list
   */
  async list(prefix: string): Promise<RemoteObject[]> {
    const objects: RemoteObject[] = [];
    let token = '';
    for (;;) {
      const query = new URLSearchParams({ 'list-type': '2', prefix, 'max-keys': '1000' });
      if (token !== '') query.set('continuation-token', token);
      const response = await this.client.fetch(`${this.bucketRoot}?${query.toString()}`, { method: 'GET' });
      if (response.status < 200 || response.status >= 300) {
        const detail = await response.text();
        throw new BackupError('HTTP_ERROR', `S3 列举 ${prefix} 失败（${String(response.status)}）：${detail.slice(0, ERROR_BODY_BYTES)}`);
      }
      const page = parseListObjects(await response.text());
      for (const object of page.objects) objects.push({ key: object.key, size: object.size });
      if (!page.truncated || page.nextToken === '') break;
      token = page.nextToken;
    }
    return objects;
  }

  /**
   * @inheritdoc Destination.del
   */
  async del(key: string): Promise<void> {
    const response = await this.client.fetch(this.urlFor(key), { method: 'DELETE' });
    if (response.status >= 400 && response.status !== 404) {
      const detail = await response.text();
      throw new BackupError('HTTP_ERROR', `S3 DELETE ${key} 失败（${String(response.status)}）：${detail.slice(0, ERROR_BODY_BYTES)}`);
    }
  }
}
