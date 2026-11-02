/** Device identity minting, reload, and remint-under-deletion behavior. */

import { X509Certificate } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { DeviceIdentityCorruptError, loadDeviceIdentity } from '../src/identity.ts'

const roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-lan-identity-'))
  roots.push(root)
  return root
}

it('mints a parseable identity with a 20-hex-character device id', async () => {
  const root = await tempRoot()
  const identity = await loadDeviceIdentity(root)
  expect(identity.deviceId).toMatch(/^[0-9a-f]{20}$/u)
  expect(() => new X509Certificate(identity.cert)).not.toThrow()
  expect(identity.key).toContain('PRIVATE KEY')
  await rm(root, { recursive: true, force: true })
})

it('reloads the same identity until the file is deleted, then remints', async () => {
  const root = await tempRoot()
  const first = await loadDeviceIdentity(root)
  const reloaded = await loadDeviceIdentity(root)
  expect(reloaded.deviceId).toBe(first.deviceId)
  expect(reloaded.cert).toBe(first.cert)
  await rm(root, { recursive: true, force: true })
  const reminted = await loadDeviceIdentity(root)
  expect(reminted.deviceId).not.toBe(first.deviceId)
  await rm(root, { recursive: true, force: true })
})

it('refuses an unreadable identity file loudly instead of replacing it', async () => {
  const root = await tempRoot()
  await writeFile(join(root, 'identity.json'), 'not json', 'utf8')
  await expect(loadDeviceIdentity(root)).rejects.toThrow(DeviceIdentityCorruptError)
  await rm(root, { recursive: true, force: true })
})

it('refuses an identity record missing key material', async () => {
  const root = await tempRoot()
  await writeFile(join(root, 'identity.json'), JSON.stringify({ cert: 'garbage' }), 'utf8')
  await expect(loadDeviceIdentity(root)).rejects.toThrow(/missing the certificate or the key/u)
  await rm(root, { recursive: true, force: true })
})

it('refuses an identity record whose certificate does not parse', async () => {
  const root = await tempRoot()
  await writeFile(join(root, 'identity.json'), JSON.stringify({ cert: 'garbage', key: 'garbage' }), 'utf8')
  const failure = loadDeviceIdentity(root)
  await expect(failure).rejects.toThrow(DeviceIdentityCorruptError)
  await expect(failure).rejects.toThrow(/delete the file/u)
  await rm(root, { recursive: true, force: true })
})
