/** TLS listener binding (including IPv6 fallback), dialer, and teardown. */

import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import type { TLSSocket } from 'node:tls'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { loadDeviceIdentity, type DeviceIdentity } from '../src/identity.ts'
import { dialLanPeer, startLanListener } from '../src/listener.ts'

let identity: DeviceIdentity | undefined

/** One identity reused across this suite: RSA key generation dominates the runtime. */
async function identityOnce(): Promise<DeviceIdentity> {
  if (identity === undefined) {
    const root = await mkdtemp(join(tmpdir(), 'dsh-lan-listener-'))
    identity = await loadDeviceIdentity(root)
    await rm(root, { recursive: true, force: true })
  }
  return identity
}

it('binds loopback, accepts an authenticated TLS dial, and closes', async () => {
  const device = await identityOnce()
  const accepted: TLSSocket[] = []
  const listener = await startLanListener(device, 0, (socket) => { accepted.push(socket) }, ['127.0.0.1'])
  expect(listener.host).toBe('127.0.0.1')
  expect(listener.port).toBeGreaterThan(0)
  const client = dialLanPeer({ host: '127.0.0.1', port: listener.port }, device)
  await once(client, 'secureConnect')
  await vi.waitFor(() => { expect(accepted.length).toBeGreaterThan(0) })
  const [first] = accepted
  expect(first?.remoteAddress).toBeTruthy()
  client.destroy()
  await listener.close()
})

it('falls back to the next listener host when the preferred bind fails', async () => {
  const device = await identityOnce()
  const listener = await startLanListener(device, 0, () => undefined, ['nonexistent.invalid', '127.0.0.1'])
  expect(listener.host).toBe('127.0.0.1')
  expect(listener.port).toBeGreaterThan(0)
  await listener.close()
})

it('dials a presented-certificate-free handshake when this device has no identity yet', async () => {
  const device = await identityOnce()
  const listener = await startLanListener(device, 0, () => undefined, ['127.0.0.1'])
  const client = dialLanPeer({ host: '127.0.0.1', port: listener.port })
  await once(client, 'secureConnect')
  expect(client.getPeerCertificate()).toHaveProperty('subject')
  client.destroy()
  await listener.close()
})
