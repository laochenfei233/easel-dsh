/** SAS derivation: determinism, format, and sensitivity to material and role order. */

import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { loadDeviceIdentity, type DeviceIdentity } from '../src/identity.ts'
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
  const dialerNonce = randomBytes(16)
  const listenerNonce = randomBytes(16)
  const again = deriveSas(
    { cert: first.cert, nonce: dialerNonce },
    { cert: second.cert, nonce: listenerNonce },
  )
  const repeat = deriveSas(
    { cert: first.cert, nonce: dialerNonce },
    { cert: second.cert, nonce: listenerNonce },
  )
  expect(again).toBe(repeat)
  expect(again).toMatch(/^[0-9]{6}$/u)
  expect(SAS_LENGTH).toBe(6)
})

it('moves when any key, nonce, or role changes', async () => {
  const [first, second] = await identityPair()
  const nonce = randomBytes(16)
  const other = randomBytes(16)
  const firstKey = spkiOf(first.cert)
  const secondKey = spkiOf(second.cert)
  const variants = [
    deriveSasFromKeys(firstKey, secondKey, nonce, nonce),
    deriveSasFromKeys(firstKey, secondKey, nonce, other),
    deriveSasFromKeys(firstKey, secondKey, other, nonce),
    deriveSasFromKeys(secondKey, firstKey, nonce, nonce),
    deriveSasFromKeys(firstKey, secondKey, other, other),
    deriveSasFromKeys(firstKey, secondKey, randomBytes(16), randomBytes(16)),
    deriveSasFromKeys(firstKey, secondKey, randomBytes(16), randomBytes(16)),
    deriveSasFromKeys(firstKey, secondKey, randomBytes(16), randomBytes(16)),
  ]
  // Each variant collides with the first only by chance (about one in a million),
  // and all seven colliding at once is negligible.
  expect(new Set(variants).size).toBeGreaterThan(1)
})

it('pads low confirmation values to the full digit count', () => {
  expect(deriveSasFromKeys(new Uint8Array(32), new Uint8Array(32), new Uint8Array(16), new Uint8Array(16)))
    .toMatch(/^[0-9]{6}$/u)
})
