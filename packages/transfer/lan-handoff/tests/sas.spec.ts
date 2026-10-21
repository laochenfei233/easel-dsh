/** SAS derivation determinism, widening, and sensitivity to key and nonce material. */

import { randomBytes } from 'node:crypto'
import { expect, it } from 'vitest'
import { loadDeviceIdentity, type DeviceIdentity } from '../src/identity.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deriveSas, deriveSasFromKeys, SAS_LENGTH, spkiOf } from '../src/sas.ts'

let pair: readonly [DeviceIdentity, DeviceIdentity] | undefined

/** Two identities reused across this suite; each remint costs one RSA generation. */
async function identityPair(): Promise<readonly [DeviceIdentity, DeviceIdentity]> {
  if (pair !== undefined) return pair
  const roots: string[] = []
  try {
    const firstRoot = await mkdtemp(join(tmpdir(), 'dsh-lan-sas-'))
    roots.push(firstRoot)
    const first = await loadDeviceIdentity(firstRoot)
    const secondRoot = await mkdtemp(join(tmpdir(), 'dsh-lan-sas-'))
    roots.push(secondRoot)
    const second = await loadDeviceIdentity(secondRoot)
    pair = [first, second]
  } finally {
    for (const root of roots) await rm(root, { recursive: true, force: true })
  }
  return pair
}

it('derives a stable six-digit string for fixed material', async () => {
  const [first, second] = await identityPair()
  const ownNonce = randomBytes(16)
  const peerNonce = randomBytes(16)
  const again = randomBytes(16)
  expect(deriveSas(first.cert, second.cert, ownNonce, peerNonce))
    .toBe(deriveSas(first.cert, second.cert, ownNonce, peerNonce))
  expect(deriveSasFromKeys(spkiOf(first.cert), spkiOf(second.cert), ownNonce, again))
    .toMatch(/^[0-9]{6}$/u)
  expect(SAS_LENGTH).toBe(6)
})

it('moves when a nonce or a certificate changes', async () => {
  const [first, second] = await identityPair()
  const same = randomBytes(16)
  const other = randomBytes(16)
  const base = deriveSasFromKeys(spkiOf(first.cert), spkiOf(second.cert), same, same)
  const moved = deriveSasFromKeys(spkiOf(first.cert), spkiOf(second.cert), same, other)
  const peerKeyMoved = deriveSasFromKeys(spkiOf(second.cert), spkiOf(first.cert), same, same)
  // P(both hashes collapsing onto the base digits) is about 10^-12.
  expect(new Set([base, moved, peerKeyMoved]).size).toBeGreaterThanOrEqual(2)
})

it('pads low confirmation values to the full digit count', () => {
  expect(deriveSasFromKeys(new Uint8Array(32), new Uint8Array(32), new Uint8Array(16), new Uint8Array(16)))
    .toMatch(/^[0-9]{6}$/u)
})
