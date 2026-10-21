/**
 * LAN project-handoff peer service (`ctx.lanHandoff`): persistent device
 * identity, TLS listener, mDNS discovery, and pairing for transferring
 * project bundles between devices.
 * @module @deepseek-ai/dsh-lan-handoff
 */

import { hostname } from 'node:os'
import type { TLSSocket } from 'node:tls'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {
  advertiseLanHandoff,
  browseLanHandoff,
  createBonjourDiscovery,
  LAN_HANDOFF_PROTOCOL_VERSION,
  lanPlatformOfHost,
  type LanDiscoveryHost,
  type PeerAdvertisement,
} from './discovery.ts'
import { defaultLanHandoffRoot, deviceIdFromCertificate, loadDeviceIdentity, type DeviceId, type DeviceIdentity } from './identity.ts'
import { dialLanPeer, startLanListener, type LanListener } from './listener.ts'
import {
  answerPairing,
  attachChannel,
  dialForPairing,
  pairingIdentityOf,
  PAIRING_TIMEOUT_MS,
  type ConnectionChannel,
  type PairingOffer,
  type PairingPeer,
} from './pairing.ts'
import { loadPairedPeers, savePairedPeers, type PairedPeer } from './peers.ts'
import type { WireMessage } from './frame.ts'

export {
  DeviceIdentityCorruptError,
  defaultLanHandoffRoot,
  LAN_HANDOFF_ROOT_NAME,
  type DeviceId,
  type DeviceIdentity,
} from './identity.ts'
export {
  advertiseLanHandoff,
  browseLanHandoff,
  createBonjourDiscovery,
  encodeDeviceTxt,
  isLoopbackAddress,
  LAN_HANDOFF_PROTOCOL_VERSION,
  LAN_HANDOFF_SERVICE_TYPE,
  lanPlatformOfHost,
  parseDeviceTxt,
  parseDiscoveredEntry,
  protocolRangesOverlap,
  type DeviceTxtDocument,
  type LanAdvertisement,
  type LanDiscoveryEntry,
  type LanDiscoveryHost,
  type LanPlatform,
  type PeerAdvertisement,
  type ProtocolVersionRange,
} from './discovery.ts'
export { dialLanPeer, startLanListener, type LanListener } from './listener.ts'
export {
  answerPairing,
  attachChannel,
  type ChannelFrame,
  dialForPairing,
  PAIRING_TIMEOUT_MS,
  PairingError,
  PairingIncompatibleError,
  PairingRejectedError,
  pairingIdentityOf,
  type ConnectionChannel,
  type PairingDeviceInfo,
  type PairingIdentity,
  type PairingOffer,
  type PairingPeer,
} from './pairing.ts'
export { loadPairedPeers, PairedPeersCorruptError, savePairedPeers, type PairedPeer } from './peers.ts'
export {
  createFrameReader,
  encodeFrame,
  FRAME_BINARY_MAX_BYTES,
  FRAME_HEADER_MAX_BYTES,
  FRAME_UNAUTHENTICATED_HEADER_MAX_BYTES,
  FrameError,
  type FrameReader,
  type WireMessage,
} from './frame.ts'
export { deriveSas, deriveSasFromKeys, SAS_LENGTH, spkiOf, type SasMaterial } from './sas.ts'
export {
  HandoffPreparationError,
  HandoffReceiveError,
  prepareBundle,
  projectDirectoryName,
  receiveHandoff,
  sendPreparedBundle,
  walkProjectTree,
  type HandoffImportHost,
  type PreparedBundle,
  type ProjectTreeFile,
  type ReceivedHandoff,
  type SessionArchiveSource,
} from './handoff.ts'
export {
  computeTreeSummary,
  receiveBundle,
  sendBundle,
  TransferIntegrityError,
  TransferProtocolError,
  TransferRejectedError,
  TRANSFER_CHUNK_BYTES,
  TRANSFER_PROTOCOL_VERSION,
  validateBundleManifest,
  type BundleEntryKind,
  type BundleEntryReader,
  type BundleEntryRef,
  type BundleEntrySink,
  type BundleManifest,
  type OfferDecision,
  type BundleTreeSummary,
  type ReceivedBundle,
  type ReceiveBundleHandlers,
  type SentBundle,
} from './transfer.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** LAN project-handoff peer service. */
    lanHandoff: LanHandoffService
  }
}

/** Configuration for the LAN project-handoff peer service. */
export interface Config {
  /**
   * Display name LAN peers see for this device; an empty string is the
   * schema default and resolves to unset. Unset uses the operating-system
   * host name.
   */
  name?: string
  /**
   * TCP port the handoff listener binds. Omission binds 0 — the OS assigns
   * a free port, and mDNS advertises the assigned value.
   */
  port?: number
}

/** Composition-time overrides for the peer service (loopback/test seams). */
export interface LanHandoffStartOptions {
  /** Identity and peer-state directory overriding the harness home; loopback tests use a temp root. */
  readonly identityRoot?: string
  /** Discovery host replacing live mDNS; loopback tests inject a recording host. */
  readonly discovery?: LanDiscoveryHost
}

/** Stable runtime state of a started peer service. */
export interface LanHandoffState {
  /** This device's id. */
  readonly deviceId: DeviceId
  /** Resolved display name advertised to peers. */
  readonly name: string
  /** TCP port the listener bound. */
  readonly port: number
  /** Host address the listener bound (`::` dual-stack or `0.0.0.0`). */
  readonly host: string
}

/** Handler for a sync (transfer) request from a paired peer; installed by the transfer layer. */
export type SyncConnectionHandler = (
  socket: TLSSocket,
  hello: WireMessage,
  channel: ConnectionChannel,
  peer: PairingPeer,
) => void | Promise<void>

/**
 * LAN peer services: identity, listener, discovery, and pairing.
 *
 * Accepted TLS sockets open with a `hello`; pairing hellos become
 * {@link PairingOffer}s for {@link LanHandoffService.onPairingRequest},
 * transfer hellos reach the installed sync handler, and everything else is
 * refused without payload exchange.
 */
export class LanHandoffService extends Service {
  /** No service dependencies: state lives under the harness home, on disk, and in mDNS. */
  static inject = []

  static Config: z<Config> = z.object({
    name: z.string().default(''),
    port: z.number().min(0).max(65535).default(0),
  })

  /** Runtime state, resolved once on start; device id and bound port never change afterwards. */
  readonly ready: Promise<LanHandoffState>

  private readonly discovered = new Map<string, PeerAdvertisement>()
  private readonly paired = new Map<string, PairedPeer>()
  private identity: DeviceIdentity | undefined
  private root: string | undefined
  private pairingRequestHandler: ((offer: PairingOffer) => void) | undefined
  private syncConnectionHandler: SyncConnectionHandler | undefined

  /**
   * @param ctx - host context owning the fiber that runs peer services.
   * @param config - validated listener and identity configuration.
   * @param options - loopback/test seams recorded for a later start.
   */
  constructor(ctx: Context, config: Config, options?: LanHandoffStartOptions) {
    super(ctx, 'lanHandoff')
    this.ready = new Promise<LanHandoffState>((resolve, reject) => {
      ctx.effect(async () => {
        try {
          const root = options?.identityRoot ?? defaultLanHandoffRoot()
          const identity: DeviceIdentity = await loadDeviceIdentity(options?.identityRoot)
          const name = config.name !== undefined && config.name.trim().length > 0 ? config.name : hostname()
          const discovery = options?.discovery ?? createBonjourDiscovery()
          const listener = await startLanListener(identity, config.port ?? 0, (socket) => { this.serveConnection(socket) })
          const published = advertiseLanHandoff(
            discovery,
            { deviceId: identity.deviceId, platform: lanPlatformOfHost(), protocol: LAN_HANDOFF_PROTOCOL_VERSION },
            name,
            listener.port,
          )
          browseLanHandoff(discovery, identity.deviceId, (peer) => { this.discovered.set(peer.id, peer) })
          this.identity = identity
          this.root = root
          for (const [id, peer] of await loadPairedPeers(root)) this.paired.set(id, peer)
          resolve({
            deviceId: identity.deviceId,
            name,
            port: listener.port,
            host: listener.host,
          })
          return () => this.teardown(published, listener, discovery)
        } catch (error) {
          reject(error)
          throw error
        }
      })
    })
  }

  async [Service.init](): Promise<void> {
    await this.ready
  }

  /**
   * Snapshot every discovered peer, latest advertisement per device id.
   * @returns the current peer list in first-seen order.
   */
  peersSnapshot(): readonly PeerAdvertisement[] {
    return [...this.discovered.values()]
  }

  /**
   * Snapshot every paired device.
   * @returns the current paired list in pairing order.
   */
  pairedPeers(): readonly PairedPeer[] {
    return [...this.paired.values()]
  }

  /**
   * Install the handler receiving each incoming pairing request.
   *
   * Without a handler, incoming requests are declined immediately instead of
   * leaving the peer's socket waiting.
   * @param handler - receiver of a {@link PairingOffer}; the handler owns accept/reject.
   * @returns an uninstaller clearing this handler when it is still installed.
   */
  onPairingRequest(handler: (offer: PairingOffer) => void): () => void {
    this.pairingRequestHandler = handler
    return () => {
      if (this.pairingRequestHandler === handler) this.pairingRequestHandler = undefined
    }
  }

  /**
   * Install the handler for transfer requests from paired peers.
   * @param handler - receiver of the accepted socket, hello, channel, and peer.
   * @returns an uninstaller clearing this handler when it is still installed.
   */
  onSyncConnection(handler: SyncConnectionHandler): () => void {
    this.syncConnectionHandler = handler
    return () => {
      if (this.syncConnectionHandler === handler) this.syncConnectionHandler = undefined
    }
  }

  /**
   * Dial a peer and drive the pairing handshake to a user decision.
   * @param target - the peer's address and port, from discovery or manual entry.
   * @param options - optional cancellation before the socket connects.
   * @returns the offer whose accept() persists the pairing on success.
   * @throws {PairingIncompatibleError} when no protocol version is shared.
   * @throws {PairingRejectedError} when the peer declines.
   * @throws {PairingError} for protocol or timeout failures.
   */
  async pairWithPeer(
    target: { readonly host: string; readonly port: number },
    options?: { readonly signal?: AbortSignal },
  ): Promise<PairingOffer> {
    const state = await this.ready
    const identity = this.identity
    if (identity === undefined) throw new Error('lan handoff identity is not started')
    options?.signal?.throwIfAborted()
    const socket = dialLanPeer(target, identity)
    try {
      const offer = await dialForPairing(socket, pairingIdentityOf(state.deviceId, identity.cert, state.name))
      return this.persisting(offer)
    } catch (error) {
      socket.destroy()
      throw error
    }
  }

  /**
   * Wrap an offer so a successful accept() records the peer durably.
   * @param offer - the handshake offer.
   * @returns an offer with the same identity whose accept persists the peer.
   */
  private persisting(offer: PairingOffer): PairingOffer {
    return {
      ...offer,
      accept: async () => {
        await offer.accept()
        await this.recordPairedPeer(offer.peer)
      },
    }
  }

  /**
   * Persist one paired peer and publish it through {@link pairedPeers}.
   * @param peer - the confirmed peer.
   */
  private async recordPairedPeer(peer: PairingPeer): Promise<void> {
    const root = this.root
    if (root === undefined) throw new Error('lan handoff peer state is not started')
    const record: PairedPeer = { id: peer.id, name: peer.name, platform: peer.platform, pairedAt: Date.now() }
    this.paired.set(peer.id, record)
    await savePairedPeers(root, this.paired)
  }

  /**
   * Route one accepted TLS socket by its opening `hello`.
   * @param socket - the accepted connection after the TLS handshake.
   */
  private serveConnection(socket: TLSSocket): void {
    void this.routeConnection(socket).catch((error: unknown) => {
      this.ctx.logger.warn(`lan-handoff: connection refused: ${error instanceof Error ? error.message : String(error)}`)
      socket.destroy()
    })
  }

  /**
   * Read the opening hello and dispatch pairing or transfer.
   * @param socket - the accepted connection.
   */
  private async routeConnection(socket: TLSSocket): Promise<void> {
    const state = await this.ready
    const identity = this.identity
    if (identity === undefined) throw new Error('lan handoff identity is not started')
    const channel = attachChannel(socket)
    const hello = await channel.next('hello', PAIRING_TIMEOUT_MS)
    const intent = hello['intent']
    if (intent === 'pair') {
      const offer = await answerPairing(socket, hello, pairingIdentityOf(state.deviceId, identity.cert, state.name), channel)
      const handler = this.pairingRequestHandler
      if (handler === undefined) {
        await offer.reject()
        return
      }
      handler(this.persisting(offer))
      return
    }
    if (intent === 'sync') {
      // The claimed peer id must equal the id derived from the certificate
      // this connection actually presented; a paired id alone grants nothing.
      const certificate = socket.getPeerCertificate()
      const presented = certificate.raw === undefined || certificate.raw.byteLength === 0
        ? undefined
        : deviceIdFromCertificate(Buffer.from(certificate.raw))
      const claimed = hello['peer']
      const handler = this.syncConnectionHandler
      if (handler === undefined || presented === undefined || typeof claimed !== 'string'
        || String(presented) !== claimed || !this.paired.has(presented)) {
        const paired = presented !== undefined && this.paired.has(presented)
        channel.write({ type: 'reject', binaryLength: 0, reason: paired ? 'syncUnavailable' : 'notPaired' })
        socket.end()
        return
      }
      const record = this.paired.get(presented)
      /* v8 ignore next -- the membership check above guarantees the record */
      if (record === undefined) return
      await handler(socket, hello, channel, { id: record.id, name: record.name, platform: record.platform })
      return
    }
    channel.write({ type: 'reject', binaryLength: 0, reason: 'incompatible' })
    socket.end()
  }

  /**
   * Withdraw the advertisement, stop the listener, and release discovery.
   * @param published - the running advertisement.
   * @param listener - the running TLS listener.
   * @param discovery - the discovery host this start created.
   */
  private async teardown(
    published: { readonly stop: () => void },
    listener: LanListener,
    discovery: LanDiscoveryHost,
  ): Promise<void> {
    published.stop()
    await listener.close()
    await discovery.dispose()
  }
}
