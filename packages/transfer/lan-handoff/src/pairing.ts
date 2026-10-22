/**
 * Pairing handshake over one TLS connection.
 *
 * The dialing device sends `hello`; the listening device answers with
 * `pairChallenge` and both derive the same six-digit confirmation string from
 * the two certificates (already exchanged by TLS) and two fresh nonces. Each
 * user confirms that string, each side sends one `pairConfirm`, and pairing
 * settles only when the peer's confirm is also affirmative. The connection
 * closes after pairing; synchronized transfers use fresh connections.
 * @module @deepseek-ai/dsh-lan-handoff/pairing
 */

import { randomBytes } from 'node:crypto'
import type { TLSSocket } from 'node:tls'
import {
  createFrameReader,
  encodeFrame,
  FRAME_HEADER_MAX_BYTES,
  FrameError,
  type WireMessage,
} from './frame.ts'
import { deviceIdFromCertificate, type DeviceId } from './identity.ts'
import {
  LAN_HANDOFF_PROTOCOL_VERSION,
  lanPlatformOfHost,
  protocolRangesOverlap,
  type LanPlatform,
  type ProtocolVersionRange,
} from './discovery.ts'
import { deriveSas } from './sas.ts'

/** How long one pairing handshake may take before the connection closes. */
export const PAIRING_TIMEOUT_MS = 60_000

/** What one device announces about itself during pairing. */
export interface PairingDeviceInfo {
  /** Display name shown to the other device's user. */
  readonly name: string
  /** Advertised platform. */
  readonly platform: LanPlatform
  /** Supported protocol-version range. */
  readonly protocol: ProtocolVersionRange
}

/** The remote device as established by pairing. */
export interface PairingPeer {
  /** Device id derived from the peer's certificate. */
  readonly id: DeviceId
  /** Display name the peer announced. */
  readonly name: string
  /** Platform the peer announced. */
  readonly platform: LanPlatform
}

/** One in-progress pairing, surfaced to the user for a comparison decision. */
export interface PairingOffer {
  /** The remote device identity and announcement. */
  readonly peer: PairingPeer
  /** Six-digit string both screens must show identically. */
  readonly sas: string
  /** Whether the pairing is the one this device started. */
  readonly direction: 'dialed' | 'received'
  /** Confirm the string matched on both screens; resolves once both sides confirmed. */
  accept(): Promise<void>
  /** Decline the pairing and close the connection. */
  reject(): Promise<void>
}

/** Base class for refused pairing attempts. */
export class PairingError extends Error {
  /**
   * @param reason - the stable failure kind.
   * @param message - the actionable report.
   */
  constructor(readonly reason: 'incompatible' | 'rejected' | 'timeout' | 'protocol', message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** Refusal: the two devices share no protocol version. */
export class PairingIncompatibleError extends PairingError {
  /**
   * @param supported - the peer's advertised version range, when it announced one.
   */
  constructor(readonly supported: ProtocolVersionRange | undefined) {
    super('incompatible', supported === undefined
      ? 'the peer speaks no protocol version this build knows'
      : `no shared protocol version: peer supports ${supported.min}..${supported.max}, this build supports ${LAN_HANDOFF_PROTOCOL_VERSION.min}..${LAN_HANDOFF_PROTOCOL_VERSION.max}`)
  }
}

/** Refusal: the other side declined, or the connection ended mid-pairing. */
export class PairingRejectedError extends PairingError {
  /**
   * @param reason - the peer's own rejection reason, when it sent one.
   */
  constructor(readonly remoteReason: string | undefined) {
    super('rejected', remoteReason === undefined ? 'the other device declined the pairing' : `the other device declined the pairing (${remoteReason})`)
  }
}

/** One resolved frame: the header message plus its binary payload. */
export interface ChannelFrame {
  /** The decoded header. */
  readonly message: WireMessage
  /** The binary payload exactly as declared by the header. */
  readonly binary: Uint8Array
}

/** The socket-facing message plumbing shared by both pairing roles. */
export interface ConnectionChannel {
  /**
   * Resolve the next message matching any listed type; other types are
   * skipped per the compatibility rule (unknown types never close a connection).
   * @param types - accepted type tags.
   * @param timeoutMs - maximum wait.
   */
  next(types: string | readonly string[], timeoutMs: number): Promise<WireMessage>
  /**
   * Resolve the next matching message together with its binary payload.
   * @param types - accepted type tags.
   * @param timeoutMs - maximum wait.
   */
  nextFrame(types: string | readonly string[], timeoutMs: number): Promise<ChannelFrame>
  /**
   * Send one frame.
   * @param message - the header fields; `binaryLength` defaults to the payload length.
   * @param binary - optional payload bytes.
   */
  write(message: WireMessage, binary?: Uint8Array): void
}

/**
 * Attach an inbox to one paired TLS socket.
 * @param socket - the established TLS connection.
 * @returns the channel for payload-free pairing frames.
 */
export function attachChannel(socket: TLSSocket): ConnectionChannel {
  const wanted = (types: string | readonly string[]): readonly string[] =>
    typeof types === 'string' ? [types] : types
  const waiters: {
    readonly types: readonly string[]
    readonly resolve: (frame: ChannelFrame) => void
    readonly reject: (error: Error) => void
  }[] = []
  const queued: ChannelFrame[] = []
  let failed: Error | undefined
  const failAll = (error: Error): void => {
    if (failed !== undefined) return
    failed = error
    for (const entry of waiters.splice(0)) entry.reject(error)
  }
  const reader = createFrameReader((message, binary) => {
    const index = waiters.findIndex(entry => entry.types.includes(message.type))
    if (index === -1) {
      queued.push({ message, binary })
      return
    }
    const [entry] = waiters.splice(index, 1)
    entry?.resolve({ message, binary })
  }, FRAME_HEADER_MAX_BYTES)
  socket.on('data', (chunk: Buffer) => {
    try {
      reader.push(chunk)
    } catch (error) {
      /* v8 ignore next -- the frame reader only throws Error instances */
      failAll(error instanceof Error ? error : new FrameError(String(error)))
    }
  })
  socket.on('error', (error: Error) => { failAll(error) })
  socket.on('close', () => { failAll(new PairingRejectedError(undefined)) })
  return {
    async next(types: string | readonly string[], timeoutMs: number): Promise<WireMessage> {
      return (await this.nextFrame(types, timeoutMs)).message
    },
    nextFrame(types: string | readonly string[], timeoutMs: number): Promise<ChannelFrame> {
      const accepted = wanted(types)
      // Frames that already arrived stay deliverable after the peer closes:
      // a graceful close follows the final protocol frame, not precedes it.
      const queuedIndex = queued.findIndex(frame => accepted.includes(frame.message.type))
      if (queuedIndex !== -1) {
        const [frame] = queued.splice(queuedIndex, 1)
        /* v8 ignore next -- splice of a found index always yields an element */
        if (frame !== undefined) return Promise.resolve(frame)
      }
      if (failed !== undefined) return Promise.reject(failed)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new PairingError('timeout', `connection did not advance within ${timeoutMs} ms`))
        }, timeoutMs)
        waiters.push({
          types: accepted,
          resolve: (frame) => { clearTimeout(timer); resolve(frame) },
          reject: (error) => { clearTimeout(timer); reject(error) },
        })
      })
    },
    write(message: WireMessage, binary?: Uint8Array): void {
      if (failed !== undefined) throw failed
      socket.write(encodeFrame(message, binary))
    },
  }
}

/**
 * Resolve once the TLS handshake finishes, or reject on failure.
 * @param socket - the connecting socket.
 */
async function awaitSecure(socket: TLSSocket): Promise<void> {
  const established = socket.getPeerCertificate()
  if (established.raw !== undefined && established.raw.byteLength > 0) return
  await new Promise<void>((resolve, reject) => {
    socket.once('secureConnect', () => resolve())
    socket.once('error', (error: Error) => reject(error))
  })
}

/**
 * Read a socket's presented certificate as DER, refusing an absent one.
 * @param socket - the established TLS connection.
 * @returns the peer certificate DER.
 */
function peerCertificateOf(socket: TLSSocket): Buffer {
  const certificate = socket.getPeerCertificate()
  if (certificate.raw === undefined || certificate.raw.byteLength === 0) {
    throw new PairingError('protocol', 'the peer presented no identity certificate')
  }
  return Buffer.from(certificate.raw)
}

/**
 * Read one hex nonce field.
 * @param message - a pairing message.
 * @param field - the nonce field name.
 * @returns the 16 nonce bytes.
 */
function nonceOf(message: WireMessage, field: string): Uint8Array {
  const raw = message[field]
  const bytes = typeof raw === 'string' && /^[0-9a-f]{32}$/u.test(raw) ? Buffer.from(raw, 'hex') : undefined
  if (bytes === undefined) throw new PairingError('protocol', `pairing message has no valid ${field} nonce`)
  return bytes
}

/**
 * Read one device announcement.
 * @param message - a hello or pairChallenge message.
 * @returns the announced device description.
 */
function deviceOf(message: WireMessage): PairingDeviceInfo {
  const raw = message['device']
  if (typeof raw !== 'object' || raw === null) throw new PairingError('protocol', 'pairing message has no device announcement')
  const record = raw as Record<string, unknown>
  const name = record['name']
  const platform = record['platform']
  const protocol = record['protocol']
  if (typeof name !== 'string' || (platform !== 'windows' && platform !== 'macos' && platform !== 'linux')
    || typeof protocol !== 'object' || protocol === null) {
    throw new PairingError('protocol', 'pairing device announcement is incomplete')
  }
  const range = protocol as Record<string, unknown>
  const min = range['min']
  const max = range['max']
  if (typeof min !== 'number' || typeof max !== 'number') throw new PairingError('protocol', 'pairing device announcement has no protocol range')
  return { name, platform, protocol: { min, max } }
}

/** This device's half of the handshake. */
export interface PairingIdentity {
  /** This device's id. */
  readonly deviceId: DeviceId
  /** This device's certificate PEM. */
  readonly cert: string
  /** Display name to announce. */
  readonly name: string
  /** Platform to announce. */
  readonly platform: LanPlatform
}

/** State shared by both pairing roles once the challenge nonces exist. */
interface PairingSides {
  readonly inbox: ConnectionChannel
  readonly self: PairingIdentity
  /** The peer certificate DER, already exchanged by TLS. */
  readonly peerCertificate: Buffer
  /** The dialer's nonce. */
  readonly dialerNonce: Uint8Array
  /** The listener's nonce. */
  readonly listenerNonce: Uint8Array
  readonly peer: PairingPeer
  readonly direction: PairingOffer['direction']
  readonly socket: TLSSocket
}

/**
 * Derive the confirmation string for one role.
 * @param sides - the settled handshake sides.
 * @returns the six-digit string both screens display.
 */
function sasOf(sides: PairingSides): string {
  const dialerCert = sides.direction === 'dialed' ? sides.self.cert : sides.peerCertificate
  const listenerCert = sides.direction === 'dialed' ? sides.peerCertificate : sides.self.cert
  return deriveSas(
    { cert: dialerCert, nonce: sides.dialerNonce },
    { cert: listenerCert, nonce: sides.listenerNonce },
  )
}

/**
 * Build the offer record with its accept/reject transitions.
 * @param sides - the settled handshake sides.
 * @returns the offer handed to the user.
 */
function buildOffer(sides: PairingSides): PairingOffer {
  let settled = false
  return {
    peer: sides.peer,
    sas: sasOf(sides),
    direction: sides.direction,
    async accept(): Promise<void> {
      if (settled) throw new PairingError('protocol', 'this pairing already settled')
      settled = true
      try {
        sides.inbox.write({ type: 'pairConfirm', binaryLength: 0, accepted: true })
        const peerConfirm = await sides.inbox.next('pairConfirm', PAIRING_TIMEOUT_MS)
        if (peerConfirm['accepted'] !== true) {
          throw new PairingRejectedError(typeof peerConfirm['reason'] === 'string' ? peerConfirm['reason'] : undefined)
        }
      } finally {
        sides.socket.destroy()
      }
    },
    async reject(): Promise<void> {
      if (settled) return
      settled = true
      try {
        sides.inbox.write({
          type: 'pairConfirm', binaryLength: 0, accepted: false, reason: 'declined',
        })
      } catch (error: unknown) {
        // The peer is already gone; closing the socket is the whole contract.
        /* v8 ignore next -- channel writes only throw Error instances */
        if (!(error instanceof Error)) throw error
      }
      // Flush the decline before the FIN: destroying here would reset the
      // connection and the peer would see a transport error, not the decline.
      sides.socket.end()
    },
  }
}

/**
 * Dial a peer and drive the pairing handshake up to the user decision.
 * @param socket - the connecting TLS socket.
 * @param self - this device's identity and announcement.
 * @returns the offer to show the user.
 * @throws {PairingIncompatibleError} when no protocol version is shared.
 * @throws {PairingError} for protocol or timeout failures.
 */
export async function dialForPairing(socket: TLSSocket, self: PairingIdentity): Promise<PairingOffer> {
  await awaitSecure(socket)
  const peerCertificate = peerCertificateOf(socket)
  const inbox = attachChannel(socket)
  const ownNonce = randomBytes(16)
  inbox.write({
    type: 'hello',
    binaryLength: 0,
    device: { name: self.name, platform: self.platform, protocol: LAN_HANDOFF_PROTOCOL_VERSION },
    intent: 'pair',
    nonce: ownNonce.toString('hex'),
  })
  const answer = await inbox.next(['pairChallenge', 'reject'], PAIRING_TIMEOUT_MS)
  if (answer.type === 'reject') {
    socket.destroy()
    throw new PairingRejectedError(typeof answer['reason'] === 'string' ? answer['reason'] : undefined)
  }
  const peerDevice = deviceOf(answer)
  if (!protocolRangesOverlap(LAN_HANDOFF_PROTOCOL_VERSION, peerDevice.protocol)) {
    inbox.write({ type: 'reject', binaryLength: 0, reason: 'incompatible' })
    socket.destroy()
    throw new PairingIncompatibleError(peerDevice.protocol)
  }
  return buildOffer({
    inbox,
    self,
    peerCertificate,
    dialerNonce: ownNonce,
    listenerNonce: nonceOf(answer, 'nonce'),
    peer: { id: deviceIdFromCertificate(peerCertificate), name: peerDevice.name, platform: peerDevice.platform },
    direction: 'dialed',
    socket,
  })
}

/**
 * Answer a peer's `hello` with a challenge and build the listening offer.
 * @param socket - the accepted TLS socket.
 * @param hello - the peer's hello message.
 * @param self - this device's identity and announcement.
 * @param channel - the connection channel the hello was read from.
 * @returns the offer to show the user.
 * @throws {PairingIncompatibleError} when no protocol version is shared.
 * @throws {PairingError} for protocol failures.
 */
export async function answerPairing(
  socket: TLSSocket,
  hello: WireMessage,
  self: PairingIdentity,
  channel: ConnectionChannel,
): Promise<PairingOffer> {
  const peerCertificate = peerCertificateOf(socket)
  const peerDevice = deviceOf(hello)
  if (!protocolRangesOverlap(LAN_HANDOFF_PROTOCOL_VERSION, peerDevice.protocol)) {
    socket.end(encodeFrame({ type: 'reject', binaryLength: 0, reason: 'incompatible' }))
    throw new PairingIncompatibleError(peerDevice.protocol)
  }
  const inbox = channel
  const ownNonce = randomBytes(16)
  inbox.write({
    type: 'pairChallenge',
    binaryLength: 0,
    device: { name: self.name, platform: self.platform, protocol: LAN_HANDOFF_PROTOCOL_VERSION },
    nonce: ownNonce.toString('hex'),
  })
  return buildOffer({
    inbox,
    self,
    peerCertificate,
    dialerNonce: nonceOf(hello, 'nonce'),
    listenerNonce: ownNonce,
    peer: { id: deviceIdFromCertificate(peerCertificate), name: peerDevice.name, platform: peerDevice.platform },
    direction: 'received',
    socket,
  })
}

/**
 * Resolve this process's pairing identity from a started service state.
 * @param deviceId - this device's id.
 * @param cert - this device's certificate PEM.
 * @param name - resolved display name.
 * @returns the identity to announce.
 */
export function pairingIdentityOf(deviceId: DeviceId, cert: string, name: string): PairingIdentity {
  return { deviceId, cert, name, platform: lanPlatformOfHost() }
}
