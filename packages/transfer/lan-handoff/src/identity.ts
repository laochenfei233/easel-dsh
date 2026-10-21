/**
 * Device identity for LAN project handoff.
 *
 * Each harness home owns one persistent self-signed certificate. The identity
 * file is minted on first boot and never rotated by the service; deleting it
 * remints the identity and therefore the device id, which unpaired every
 * peer that recorded the previous key — the same lifetime contract as the
 * anonymous user id file.
 * @module @deepseek-ai/dsh-lan-handoff/identity
 */

import { createHash, X509Certificate } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generate } from 'selfsigned'
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** Stable LAN address of one device: 20 hex characters of `SHA-256(<certificate SPKI DER>)`. */
export type DeviceId = Branded<'DeviceId'>

/** Directory under the harness home holding the LAN handoff state. */
export const LAN_HANDOFF_ROOT_NAME = 'lan-handoff'

/** One device's persistent TLS identity. */
export interface DeviceIdentity {
  /** The device id peers address this device by, and that the service advertises. */
  readonly deviceId: DeviceId
  /** The identity certificate in PEM form; also the self-issued TLS server certificate. */
  readonly cert: string
  /** The unencrypted PEM private key matching {@link DeviceIdentity.cert}. */
  readonly key: string
}

/** Device-id width in hex characters. */
const DEVICE_ID_HEX_LENGTH = 20

/** Common name stamped into the minted certificate. */
const COMMON_NAME = 'easel-handoff'

/** Lifetime of the minted certificate in days; aligned with the identity file being unreplaced. */
const CERT_LIFETIME_DAYS = 3650

/** RSA key size of the minted certificate (reused fixture standard for N-allowable TLS servers). */
const CERT_KEY_SIZE = 2048

/** On-disk name of the identity record inside {@link LAN_HANDOFF_ROOT_NAME}. */
const IDENTITY_FILE_NAME = 'identity.json'

/** Failure contract for a readable-but-invalid identity file. */
export class DeviceIdentityCorruptError extends Error {
  /**
   * @param path - the unusable identity file, quoted in the message.
   * @param cause - the original parse or certificate failure.
   */
  constructor(readonly path: string, cause: unknown) {
    super(`LAN handoff identity at ${path} is unreadable (${String(cause)}); delete the file to remint this device's identity`)
  }
}

/** One persisted identity record: certificate PEM and its unencrypted key PEM. */
interface StoredIdentity {
  readonly cert: string
  readonly key: string
}

/**
 * Derive the branded device id from one certificate PEM.
 * @param cert - certificate PEM.
 * @returns the 20-hex-character device id.
 * @throws when the PEM is not a parsable certificate.
 */
function deviceIdOf(cert: string): DeviceId {
  const spki = new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' })
  const hex = createHash('sha256').update(Buffer.from(spki)).digest('hex')
  return brandString<DeviceId>(hex.slice(0, DEVICE_ID_HEX_LENGTH))
}

/**
 * Default harness-home location of the LAN handoff state.
 * @returns the absolute directory that stores `identity.json` and other peer state.
 */
export function defaultLanHandoffRoot(): string {
  return join(resolveDshHome(), LAN_HANDOFF_ROOT_NAME)
}

/**
 * Read the persisted identity record.
 * @param file - identity file path.
 * @returns the parsed record, or `undefined` when the file is absent.
 * @throws {DeviceIdentityCorruptError} when the file parses but is not a usable identity.
 */
async function readStoredIdentity(file: string): Promise<StoredIdentity | undefined> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new DeviceIdentityCorruptError(file, error)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new DeviceIdentityCorruptError(file, new TypeError('identity record is not an object'))
  }
  const { cert, key } = parsed as { readonly cert?: unknown; readonly key?: unknown }
  if (typeof cert !== 'string' || typeof key !== 'string') {
    throw new DeviceIdentityCorruptError(file, new TypeError('identity record is missing the certificate or the key'))
  }
  try {
    deviceIdOf(cert)
  } catch (error) {
    throw new DeviceIdentityCorruptError(file, error)
  }
  return { cert, key }
}

/**
 * Mint a fresh identity and persist it exclusively. Losing the exclusive
 * create means another minted first; both racers finish holding the on-disk
 * identity, so in-memory views never diverge.
 * @param file - identity file path to create.
 * @param root - directory holding the file, created when missing.
 * @returns the winning on-disk identity record.
 */
async function mintIdentity(file: string, root: string): Promise<StoredIdentity> {
  await mkdir(root, { recursive: true })
  const { cert, private: key } = generate([{ name: 'commonName', value: COMMON_NAME }], {
    keySize: CERT_KEY_SIZE,
    days: CERT_LIFETIME_DAYS,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
    ],
  })
  const minted: StoredIdentity = { cert, key }
  try {
    await writeFile(file, JSON.stringify(minted), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  return (await readStoredIdentity(file)) ?? minted
}

/**
 * Load this device's identity, minting and persisting it on first boot.
 *
 * An existing-but-unreadable identity file is a loud refusal: the stored bytes
 * are the device's only key material, so nothing is silently replaced.
 * @param root - absolute directory holding the identity file; defaults to {@link defaultLanHandoffRoot}.
 * @returns the loaded or minted identity.
 * @throws {DeviceIdentityCorruptError} when an existing identity file is not usable.
 */
export async function loadDeviceIdentity(root = defaultLanHandoffRoot()): Promise<DeviceIdentity> {
  const file = join(root, IDENTITY_FILE_NAME)
  const stored: StoredIdentity = (await readStoredIdentity(file)) ?? (await mintIdentity(file, root))
  return { deviceId: deviceIdOf(stored.cert), cert: stored.cert, key: stored.key }
}
