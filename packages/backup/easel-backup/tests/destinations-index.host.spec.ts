/**
 * backup destination factory host path: the config/secrets pair must agree on
 * the protocol, each protocol constructs its implementation, and the closed
 * union's unreachable default still fails loudly when forced at runtime.
 */

import { describe, expect, it } from 'vitest'
import { createDestination } from '../src/destinations/index.ts'
import { FsDestination } from '../src/destinations/fs.ts'
import { S3Destination } from '../src/destinations/s3.ts'
import { WebDavDestination } from '../src/destinations/webdav.ts'
import { BackupError } from '../src/errors.ts'
import type { DestinationConfig, DestinationSecrets } from '../src/index.ts'

describe('createDestination', () => {
  it('builds the matching implementation per protocol', () => {
    expect(createDestination({ protocol: 'smb', root: '\\\\srv\\share' }, { protocol: 'smb' })).toBeInstanceOf(FsDestination)
    expect(
      createDestination(
        { protocol: 'webdav', endpoint: 'https://dav.example.com', username: 'u', remoteDir: '' },
        { protocol: 'webdav', password: 'p' },
      ),
    ).toBeInstanceOf(WebDavDestination)
    expect(
      createDestination(
        { protocol: 's3', region: 'r', bucket: 'b', pathStyle: true },
        { protocol: 's3', accessKeyId: 'A', secretAccessKey: 'S' },
      ),
    ).toBeInstanceOf(S3Destination)
  })

  it('rejects a pair whose protocols disagree and missing secret shapes', () => {
    expect(() =>
      createDestination({ protocol: 'smb', root: 'x' }, { protocol: 'webdav', password: 'p' }),
    ).toThrow(BackupError)
    expect(() =>
      createDestination(
        { protocol: 'webdav', endpoint: 'https://d.example.com', username: 'u', remoteDir: '' },
        { protocol: 'webdav', password: 'p' },
      ),
    ).not.toThrow()
    expect(() =>
      createDestination(
        { protocol: 's3', region: 'r', bucket: 'b', pathStyle: true },
        { protocol: 's3', accessKeyId: 'A', secretAccessKey: 'S' },
      ),
    ).not.toThrow()
  })

  it('the exhaustive default fails loudly when a foreign protocol slips through', () => {
    const foreign = JSON.parse('{"protocol":"gopher"}') as DestinationConfig
    const secrets = JSON.parse('{"protocol":"gopher"}') as DestinationSecrets
    expect(() => createDestination(foreign, secrets)).toThrow(BackupError)
  })
})

describe('createDestination secret mismatches', () => {
  it('webdav and s3 reject secrets of the wrong protocol', () => {
    expect(() =>
      createDestination(
        { protocol: 'webdav', endpoint: 'https://d.example.com', username: 'u', remoteDir: '' },
        { protocol: 's3', accessKeyId: 'A', secretAccessKey: 'S' },
      ),
    ).toThrow(BackupError)
    expect(() =>
      createDestination(
        { protocol: 's3', region: 'r', bucket: 'b', pathStyle: true },
        { protocol: 'webdav', password: 'p' },
      ),
    ).toThrow(BackupError)
  })
})
