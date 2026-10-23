/**
 * Short authentication string (SAS) derivation for device pairing.
 *
 * Both screens show the same six digits derived from the two devices'
 * certificate keys and two fresh nonces; the user confirms equality by
 * sight, so a man-in-the-middle presenting its own certificate produces a
 * different string. Role order is fixed — the dialing device's key and nonce
 * first, then the listening device's — so both sides hash identical input in
 * identical order.
 * @module @deepseek-ai/dsh-lan-handoff/sas
 */

import { createHash, X509Certificate } from 'node:crypto'

/** Digit count of the confirmation string shown to the user. */
export const SAS_LENGTH = 6

/** One side's contribution to the confirmation string. */
export interface SasMaterial {
  /** This side's certificate PEM text or DER bytes. */
  readonly cert: string | Buffer
  /** This side's fresh nonce bytes. */
  readonly nonce: Uint8Array
}

/**
 * Derive the pairing confirmation string from both sides' material.
 * @param dialer - the dialing device's certificate and nonce.
 * @param listener - the listening device's certificate and nonce.
 * @returns the six-digit confirmation string, zero-padded.
 */
export function deriveSas(dialer: SasMaterial, listener: SasMaterial): string {
  return deriveSasFromKeys(spkiOf(dialer.cert), spkiOf(listener.cert), dialer.nonce, listener.nonce)
}

/** Bytes of digest material supplying the six decimal digits. */
const SAS_BITS_BYTES = 5

/**
 * Derive the pairing confirmation string from already-extracted key material.
 * @param dialerKey - the dialing device's SPKI DER.
 * @param listenerKey - the listening device's SPKI DER.
 * @param dialerNonce - the dialing device's nonce bytes.
 * @param listenerNonce - the listening device's nonce bytes.
 * @returns the six-digit confirmation string, zero-padded.
 */
export function deriveSasFromKeys(
  dialerKey: Uint8Array,
  listenerKey: Uint8Array,
  dialerNonce: Uint8Array,
  listenerNonce: Uint8Array,
): string {
  const digest = createHash('sha256')
    .update(Buffer.from(dialerKey))
    .update(Buffer.from(listenerKey))
    .update(Buffer.from(dialerNonce))
    .update(Buffer.from(listenerNonce))
    .digest()
  const masked = digest.subarray(0, SAS_BITS_BYTES)
  let bits = 0n
  for (const byte of masked) bits = (bits << 8n) | BigInt(byte)
  return String(bits % 1_000_000n).padStart(SAS_LENGTH, '0')
}

/**
 * SPKI DER of one certificate.
 * @param cert - certificate PEM text or DER bytes.
 * @returns the public-key DER bytes.
 */
export function spkiOf(cert: string | Buffer): Buffer {
  return Buffer.from(new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' }))
}
