/**
 * Short authentication string (SAS) derivation for device pairing.
 *
 * Both screens show the same six digits derived from the two devices'
 * certificate keys and two fresh nonces; the user confirms equality by
 * sight, so a man-in-the-middle presenting its own certificate produces a
 * different string. The hash binds the own device's material first, then
 * the peer's, and both sides derive with the same fixed order.
 * @module @deepseek-ai/dsh-lan-handoff/sas
 */

import { createHash, X509Certificate } from 'node:crypto'

/** Digit count of the confirmation string shown to the user. */
export const SAS_LENGTH = 6

/**
 * Derive the pairing confirmation string from certificate PEMs.
 * @param own - this device's certificate PEM.
 * @param peer - the peer's certificate PEM as received from the wire.
 * @param ownNonce - this device's 16 random bytes also sent to the peer.
 * @param peerNonce - the peer's 16 random bytes received from the wire.
 * @returns the six-digit confirmation string, zero-padded.
 */
export function deriveSas(
  own: string,
  peer: string,
  ownNonce: Uint8Array,
  peerNonce: Uint8Array,
): string {
  return deriveSasFromKeys(spkiOf(own), spkiOf(peer), ownNonce, peerNonce)
}

/**
 * One confirmation bit budget: the first 40 bits of the digest supply the
 * six decimal digits, leaving no reliance on later bytes.
 */
const SAS_BITS_BYTES = 5

/**
 * Derive the pairing confirmation string from the already-extracted key bytes.
 * @param ownKey - this device's SPKI DER.
 * @param peerKey - the peer's SPKI DER.
 * @param ownNonce - this device's nonce bytes.
 * @param peerNonce - the peer's nonce bytes.
 * @returns the six-digit confirmation string, zero-padded.
 */
export function deriveSasFromKeys(
  ownKey: Uint8Array,
  peerKey: Uint8Array,
  ownNonce: Uint8Array,
  peerNonce: Uint8Array,
): string {
  const digest = createHash('sha256')
    .update(Buffer.from(ownKey))
    .update(Buffer.from(peerKey))
    .update(Buffer.from(ownNonce))
    .update(Buffer.from(peerNonce))
    .digest()
  const masked = digest.subarray(0, SAS_BITS_BYTES)
  let bits = 0n
  for (const byte of masked) bits = (bits << 8n) | BigInt(byte)
  return String(bits % 1_000_000n).padStart(SAS_LENGTH, '0')
}

/** SPKI DER of one certificate PEM. @param cert - certificate PEM. @returns the public-key DER bytes. */
export function spkiOf(cert: string): Buffer {
  return Buffer.from(new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' }))
}
