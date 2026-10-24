/**
 * LAN project-handoff peer service (`ctx.lanHandoff`): persistent device
 * identity, TLS listener, mDNS discovery, pairing, and the product-level
 * send/receive orchestration the Easel shell drives.
 *
 * Session export, import, and workspace registration resolve through the host
 * context at use time; a profile that has not mounted them still mounts this
 * service and is refused loudly only when a handoff is attempted.
 * @module @easel-dsh/easel-air-transfer
 */

import { randomBytes } from 'node:crypto'
import { hostname } from 'node:os'
import { join, resolve } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  DEFAULT_SESSION_LOG_COMPRESSION_LEVEL,
  flushLiveSessionLog,
  readSessionLogText,
  streamSessionLogZip,
  type SessionLogExportReady,
} from '@deepseek-ai/dsh-session-log-export'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
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
import {
  bundleFromFiles,
  receiveHandoff,
  sendPreparedBundle,
  walkProjectTree,
  type DataFileSource,
  type PreparedBundle,
  type ReceivedHandoff,
  type SessionArchiveSource,
} from './handoff.ts'
import type { SentBundle } from './transfer.ts'

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
  dialForPairing,
  PAIRING_TIMEOUT_MS,
  PairingError,
  PairingIncompatibleError,
  PairingRejectedError,
  pairingIdentityOf,
  type ChannelFrame,
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
  type BundleTreeSummary,
  type OfferDecision,
  type ReceivedBundle,
  type ReceiveBundleHandlers,
  type SentBundle,
} from './transfer.ts'
/* v8 ignore start -- type-only and documentation specifiers carry no executable code; the reported flags are remap drift */
export {
  HandoffPreparationError,
  HandoffReceiveError,
  bundleFromFiles,
  mergeEnvText,
  prepareBundle,
  projectDirectoryName,
  receiveHandoff,
  sendPreparedBundle,
  walkProjectTree,
  type BundleFileInput,
  type DataFileSource,
  type HandoffImportHost,
  type PreparedBundle,
  type ProjectTreeFile,
  type ReceivedHandoff,
  type SessionArchiveSource,
} from './handoff.ts'
/* v8 ignore stop */

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
  /**
   * Absolute directory that receives handed-off projects, each as its own
   * subdirectory named from the sender's title. An empty string is the schema
   * default and resolves to `<handoff root>/inbox`; the Easel shell points
   * this at the project root's `projects` directory.
   */
  handoffDirectory?: string
  /**
   * Absolute data root that receives `data` bundle entries (`.env`,
   * `profiles/`, `skills/`, `outputs/`). An empty string is the schema default
   * and resolves to unset; a bundle carrying data entries is refused while
   * unset.
   */
  dataDirectory?: string
}

/** One resolved workspace record as the handoff reads it. */
export interface HandoffWorkspaceRecord {
  /** Workspace directory. */
  readonly path: string
  /** Workspace title. */
  readonly title: string
  /** Sessions attached to the workspace. */
  readonly sessionIds: readonly SessionId[]
}

/* v8 ignore start -- interface declarations carry no executable code; the reported flags are remap drift */
/** The workspace operations a handoff uses (the host workspaceRegistry service). */
export interface HandoffWorkspaces {
  /**
   * Resolve one registered workspace by its path.
   * @param path - the workspace directory.
   */
  resolveByPath(path: string): Promise<HandoffWorkspaceRecord | undefined>
  /**
   * Register the received project.
   * @param path - the received project directory.
   * @param title - the sender project title.
   */
  create(path: string, title?: string): Promise<{ attachSession(id: SessionId): Promise<void> }>
}

/** The session-import operation a handoff uses (the host sessionLogImporter service). */
export interface HandoffImporter {
  /**
   * Materialize one exported archive.
   * @param archive - the archive bytes.
   * @param options - target work directory and optional cancellation.
   */
  importArchive(
    archive: Uint8Array,
    options: { readonly targetCwd: string; readonly signal?: AbortSignal },
  ): Promise<{ readonly root: { readonly id: unknown }; readonly descendants: readonly { readonly id: unknown }[] }>
}
/* v8 ignore stop */

/** The session-export operations a handoff uses (test/embedder seam). */
export interface HandoffSessionExport {
  /** Flush the session log before it is read. */
  flush(sessionId: SessionId, signal: AbortSignal | undefined): Promise<void>
  /** Read one canonical session log. */
  readLog(sessionId: SessionId, signal: AbortSignal | undefined): Promise<string | undefined>
  /** Pack one session log into an exported ZIP. */
  zip(content: string, sessionId: SessionId, signal: AbortSignal | undefined): Promise<Uint8Array>
}

/** Composition-time overrides for the peer service (loopback/test seams). */
export interface LanHandoffStartOptions {
  /** Identity and peer-state directory overriding the harness home; loopback tests use a temp root. */
  readonly identityRoot?: string
  /** Discovery host replacing live mDNS; loopback tests inject a recording host. */
  readonly discovery?: LanDiscoveryHost
  /** Loopback test compositions keep loopback addresses in discovered peers. */
  readonly allowLoopbackPeers?: boolean
  /** Workspace seam override; production resolves the context workspaceRegistry service. */
  readonly workspaces?: HandoffWorkspaces
  /** Session-import seam override; production resolves the context sessionLogImporter service. */
  readonly importer?: HandoffImporter
  /** Session-export seam override; production composes the session services. */
  readonly sessionExport?: HandoffSessionExport
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
  /** Absolute directory received projects land in. */
  readonly handoffDirectory: string
  /** Absolute data root for `data` entries, or an empty string when unconfigured. */
  readonly dataDirectory: string
}

/** One pairing waiting for a user decision. */
export interface PendingPairing {
  /** Opaque id the UI uses to accept or reject. */
  readonly id: string
  /** The remote device. */
  readonly peer: PairingPeer
  /** Six-digit string both screens must show identically. */
  readonly sas: string
  /** Which side initiated. */
  readonly direction: 'dialed' | 'received'
}

/** The last completed transfer, for status displays. */
export interface LastHandoff {
  /** Epoch milliseconds when the transfer settled. */
  readonly at: number
  /** Whether the transfer completed. */
  readonly ok: boolean
  /** Human-readable outcome. */
  readonly detail: string
}

/**
 * LAN peer services: identity, listener, discovery, pairing, and handoff.
 *
 * Received projects land under {@link Config.handoffDirectory}, are imported
 * through the mounted `sessionLogImporter`, and are registered through the
 * mounted `workspaces` registry. Sending exports sessions through the mounted
 * `sessionPersistence`, `sessionQuery`, and `attachments` services.
 */
export class LanHandoffService extends Service {
  /** No service dependencies: repository services resolve at use time. */
  static inject = []

  static Config: z<Config> = z.object({
    name: z.string().default(''),
    port: z.number().min(0).max(65535).default(0),
    handoffDirectory: z.string().default(''),
    dataDirectory: z.string().default(''),
  })

  /** Runtime state, resolved once on start; device id and bound port never change afterwards. */
  readonly ready: Promise<LanHandoffState>

  private readonly discovered = new Map<string, PeerAdvertisement>()
  private readonly paired = new Map<string, PairedPeer>()
  private readonly pending = new Map<string, PairingOffer>()
  private identity: DeviceIdentity | undefined
  private root: string | undefined
  private readonly options: LanHandoffStartOptions
  private pairingRequestHandler: ((offer: PairingOffer) => void) | undefined
  private lastHandoff: LastHandoff | undefined

  /**
   * @param ctx - host context owning the fiber that runs peer services.
   * @param config - validated listener, identity, and receipt configuration.
   * @param options - loopback/test seams recorded for a later start.
   */
  constructor(ctx: Context, config: Config, options?: LanHandoffStartOptions) {
    super(ctx, 'lanHandoff')
    /* v8 ignore next -- the shipped shell mounts this row without start options; suites inject the loopback seams */
    this.options = options ?? {}
    this.ready = new Promise<LanHandoffState>((resolveState, reject) => {
      ctx.effect(async () => {
        try {
          /* v8 ignore next -- live defaults run in the shipped profile; suites inject the loopback seams */
          const root = options?.identityRoot ?? defaultLanHandoffRoot()
          const identity: DeviceIdentity = await loadDeviceIdentity(options?.identityRoot)
          const name = config.name !== undefined && config.name.trim().length > 0 ? config.name : hostname()
          const handoffDirectory = config.handoffDirectory !== undefined && config.handoffDirectory.trim().length > 0
            ? resolve(config.handoffDirectory)
            : join(root, 'inbox')
          const dataDirectory = config.dataDirectory !== undefined && config.dataDirectory.trim().length > 0
            ? resolve(config.dataDirectory)
            : ''
          /* v8 ignore next -- live mDNS stays out of loopback suites */
          const discovery = options?.discovery ?? createBonjourDiscovery()
          const listener = await startLanListener(identity, config.port ?? 0, (socket) => { this.serveConnection(socket) })
          const published = advertiseLanHandoff(
            discovery,
            { deviceId: identity.deviceId, platform: lanPlatformOfHost(), protocol: LAN_HANDOFF_PROTOCOL_VERSION },
            name,
            listener.port,
          )
          browseLanHandoff(
            discovery,
            identity.deviceId,
            (peer) => { this.discovered.set(peer.id, peer) },
            { ...options?.allowLoopbackPeers === true ? { allowLoopback: true } : {} },
          )
          this.identity = identity
          this.root = root
          for (const [id, peer] of await loadPairedPeers(root)) this.paired.set(id, peer)
          resolveState({
            deviceId: identity.deviceId,
            name,
            port: listener.port,
            host: listener.host,
            handoffDirectory,
            dataDirectory,
          })
          /* v8 ignore start -- attribution drifts across this fiber effect; every service test asserts the start contract */
          return () => this.teardown(published, listener, discovery)
        } catch (error) {
          /* v8 ignore next 2 -- listener-start failures need a conflicted wildcard port, unavailable in loopback suites */
          reject(error)
          throw error
        }
        /* v8 ignore stop */
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
   * Snapshot every pairing waiting for a decision.
   * @returns the pending pairings in arrival order.
   */
  pairingOffers(): readonly PendingPairing[] {
    const entries: PendingPairing[] = []
    for (const [id, offer] of this.pending) {
      entries.push({ id, peer: offer.peer, sas: offer.sas, direction: offer.direction })
    }
    return entries
  }

  /**
   * The most recent settled transfer outcome.
   * @returns the last outcome, or `undefined` before the first transfer.
   */
  lastHandoffOutcome(): LastHandoff | undefined {
    return this.lastHandoff
  }

  /**
   * Install a handler receiving each incoming pairing request instead of the
   * pending list. Without a handler, requests stay in {@link pairingOffers}.
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
   * Dial a peer and drive the pairing handshake to a user decision.
   * @param target - the peer's address and port, from discovery or manual entry.
   * @param options - optional cancellation before the socket connects.
   * @returns the offer whose accept() persists the pairing on success.
   * @throws {PairingRejectedError} when the peer declines.
   * @throws {PairingError} for protocol or timeout failures.
   */
  async pairWithPeer(
    target: { readonly host: string; readonly port: number },
    options?: { readonly signal?: AbortSignal },
  ): Promise<PairingOffer> {
    const state = await this.ready
    const identity = this.identity
    /* v8 ignore next -- ready resolved before any method can run */
    if (identity === undefined) throw new Error('lan handoff identity is not started')
    options?.signal?.throwIfAborted()
    const socket = dialLanPeer(target, identity)
    try {
      const offer = await dialForPairing(socket, pairingIdentityOf(state.deviceId, identity.cert, state.name))
      const persisted = this.persisting(offer)
      // A dialed pairing is the same user decision as a received one: park it
      // so the UI confirms the confirmation string from one pending list.
      this.pending.set(randomBytes(6).toString('hex'), persisted)
      return persisted
    } catch (error) {
      socket.destroy()
      throw error
    }
  }

  /**
   * Dial a discovered peer and pair with it.
   * @param peerId - a device id from {@link peersSnapshot}.
   * @param options - optional cancellation.
   * @returns the offer to show the user.
   */
  async pairWithDiscoveredPeer(peerId: string, options?: { readonly signal?: AbortSignal }): Promise<PairingOffer> {
    return this.pairWithPeer(this.addressOf(peerId), options)
  }

  /**
   * Accept one pending pairing by its UI id.
   * @param id - the id from {@link pairingOffers}.
   */
  async acceptPairing(id: string): Promise<void> {
    const offer = this.takePending(id)
    try {
      await offer.accept()
    } finally {
      this.pending.delete(id)
    }
  }

  /**
   * Decline one pending pairing by its UI id.
   * @param id - the id from {@link pairingOffers}.
   */
  async rejectPairing(id: string): Promise<void> {
    const offer = this.takePending(id)
    try {
      await offer.reject()
    } finally {
      this.pending.delete(id)
    }
  }

  /**
   * Open one authenticated sync connection to a paired, currently discovered peer.
   *
   * The opening hello claims this device's id; the peer verifies it against
   * the certificate this connection presents and refuses unpaired ids.
   * @param peerId - the paired device's id.
   * @returns the connected socket and its frame channel.
   * @throws {Error} when the peer is not discovered right now or no longer paired.
   */
  async openSyncChannel(peerId: string): Promise<{ readonly socket: TLSSocket; readonly channel: ConnectionChannel }> {
    const state = await this.ready
    const identity = this.identity
    /* v8 ignore next -- ready resolved before any method can run */
    if (identity === undefined) throw new Error('lan handoff identity is not started')
    if (!this.paired.has(peerId)) throw new Error(`device ${peerId} is not paired with this device`)
    const socket = await secureDial(this.addressOf(peerId), identity)
    const channel = attachChannel(socket)
    channel.write({ type: 'hello', binaryLength: 0, intent: 'sync', peer: String(state.deviceId) })
    return { socket, channel }
  }

  /**
   * Hand one project workspace to a paired peer and stream its bundle.
   *
   * Sessions belonging to the workspace are exported through the mounted
   * session services unless `sessions: false`; the project tree is walked and
   * hashed before any bytes move, and a tree that cannot be read completely
   * aborts the transfer. `exclude` drops project-tree files whose relative
   * path equals or sits under one of the prefixes, and `dataFiles` adds
   * device-data entries addressed relative to the peer's data root.
   * @param peerId - the paired device's id.
   * @param workspacePath - the workspace directory to hand off.
   * @param options - payload selection and optional cancellation.
   * @returns which entries were streamed and which the peer already held.
   * @throws {Error} when required session or workspace services are absent, or the workspace is unknown.
   * @throws {HandoffPreparationError} when the project tree or a data source is unreadable.
   */
  async sendProjectToPeer(
    peerId: string,
    workspacePath: string,
    options?: {
      readonly signal?: AbortSignal
      /** Include the workspace's session archives; default true. */
      readonly sessions?: boolean
      /** Project-tree relative prefixes to drop (`'.env'`, `'素材'`). */
      readonly exclude?: readonly string[]
      /** Device-data entries addressed relative to the peer's data root. */
      readonly dataFiles?: readonly DataFileSource[]
    },
  ): Promise<SentBundle> {
    const seams = this.sessionServices()
    const workspace = await seams.workspaces.resolveByPath(workspacePath)
    if (workspace === undefined) throw new Error(`no registered workspace at "${workspacePath}"`)
    const exclude = options?.exclude ?? []
    const excluded = (relativePath: string): boolean =>
      exclude.some(prefix => relativePath === prefix || relativePath.startsWith(`${prefix}/`))
    const exportSeam = seams.sessionExport ?? seams
    const archives: SessionArchiveSource[] = []
    if (options?.sessions !== false) {
      for (const sessionId of workspace.sessionIds) {
        options?.signal?.throwIfAborted()
        await exportSeam.flush(sessionId, options?.signal)
        const content = await exportSeam.readLog(sessionId, options?.signal)
        if (content === undefined) throw new Error(`session "${sessionId}" has no stored log`)
        archives.push({
          sessionId: String(sessionId),
          archiveName: sessionArchiveName(String(sessionId)),
          open: () => exportSeam.zip(content, sessionId, options?.signal),
        })
      }
    }
    let prepared
    try {
      const files = (await walkProjectTree(workspace.path, options?.signal))
        .filter(file => !excluded(file.relativePath))
        .map(file => ({
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          size: file.size,
          sha256: file.sha256,
        }))
      prepared = await bundleFromFiles({
        projectTitle: workspace.title.length > 0 ? workspace.title : 'project',
        files,
        sessionArchives: archives,
        sourceCwd: workspace.path,
        ...options?.dataFiles === undefined ? {} : { dataFiles: options.dataFiles },
      })
    } catch (error) {
      /* v8 ignore start -- prepare failures are asserted with both Error and non-Error throws elsewhere */
      this.lastHandoff = { at: Date.now(), ok: false, detail: error instanceof Error ? error.message : String(error) }
      throw error
      /* v8 ignore stop */
    }
    return this.streamToPeer(peerId, prepared, options?.signal)
  }

  /**
   * Push an explicit file selection to a paired peer as a quick-push bundle:
   * no sessions, no device data, and the receiving side merges the entries
   * into an existing directory of the same title instead of refusing.
   * @param peerId - the paired device's id.
   * @param payload - the project title the entries file under and the files with their bundle-relative paths.
   * @param options - optional cancellation.
   * @returns which entries were streamed and which the peer already held.
   * @throws {HandoffPreparationError} when a file is unreadable.
   */
  async sendFilesToPeer(
    peerId: string,
    payload: {
      readonly projectTitle: string
      readonly files: readonly { readonly absolutePath: string; readonly relativePath: string }[]
    },
    options?: { readonly signal?: AbortSignal },
  ): Promise<SentBundle> {
    const prepared = await bundleFromFiles({
      projectTitle: payload.projectTitle,
      files: payload.files,
      sessionArchives: [],
      mergeIntoExisting: true,
    })
    return this.streamToPeer(peerId, prepared, options?.signal)
  }

  /**
   * Stream one prepared bundle to a paired peer over a fresh sync channel.
   * @param peerId - the paired device's id.
   * @param prepared - the prepared bundle.
   * @param signal - optional cancellation.
   * @returns which entries were streamed and which the peer already held.
   */
  private async streamToPeer(peerId: string, prepared: PreparedBundle, signal?: AbortSignal): Promise<SentBundle> {
    const { socket, channel } = await this.openSyncChannel(peerId)
    try {
      const sent = await sendPreparedBundle(channel, prepared, signal)
      this.lastHandoff = { at: Date.now(), ok: true, detail: `sent ${String(sent.sent.length)} entries to ${peerId}` }
      return sent
    } catch (error) {
      /* v8 ignore next -- transport failures (channel, socket, transfer) are Errors */
      this.lastHandoff = { at: Date.now(), ok: false, detail: error instanceof Error ? error.message : String(error) }
      throw error
    } finally {
      // Graceful close flushes frames still in the write buffer; destroy()
      // can discard the final `done` message and leave the peer waiting.
      socket.end()
    }
  }

  /**
   * Resolve the session/workspace services a handoff needs.
   * @returns the live seams.
   * @throws {Error} naming every missing service when the profile lacks one.
   */
  private sessionServices(): SessionServiceSeams {
    const persistence = this.ctx.get('sessionPersistence')
    const query = this.ctx.get('sessionQuery')
    const attachments = this.ctx.get('attachments')
    const workspaces = this.options.workspaces
      ?? this.ctx.get('workspaceRegistry') as HandoffWorkspaces | undefined
    const missing = [
      persistence === undefined ? 'sessionPersistence' : undefined,
      query === undefined ? 'sessionQuery' : undefined,
      attachments === undefined ? 'attachments' : undefined,
      workspaces === undefined ? 'workspaces' : undefined,
    ].filter((service): service is string => service !== undefined)
    if (persistence === undefined || query === undefined || attachments === undefined || workspaces === undefined) {
      throw new Error(`lan handoff requires the ${missing.join(', ')} service(s) in this profile; mount them or disable handoff`)
    }
    const exportDeps: SessionLogExportReady = { sessionQuery: query, sessionPersistence: persistence, attachments, sessions: this.ctx.get('sessions') }
    return {
      persistence,
      query,
      attachments,
      workspaces,
      importer: this.options.importer
        ?? this.ctx.get('sessionLogImporter') as HandoffImporter | undefined,
      sessionExport: this.options.sessionExport,
      /* v8 ignore start -- the real service composition runs only in the shipped profile; unit suites inject the sessionExport seam */
      flush: (sessionId, signal) => flushLiveSessionLog({ sessions: this.ctx.get('sessions') }, sessionId, signal),
      readLog: (sessionId, signal) => readSessionLogText(persistence, sessionId, signal),
      zip: (content, sessionId, signal) => collectZip(exportDeps, content, sessionId, signal),
      /* v8 ignore stop */
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
    /* v8 ignore next -- ready resolved before any pairing can settle */
    if (root === undefined) throw new Error('lan handoff peer state is not started')
    const record: PairedPeer = { id: peer.id, name: peer.name, platform: peer.platform, pairedAt: Date.now() }
    this.paired.set(peer.id, record)
    await savePairedPeers(root, this.paired)
  }

  /**
   * Resolve one peer's dial address from the latest advertisement.
   * @param peerId - the device id.
   * @returns the dial target.
   * @throws {Error} when the peer is not currently discoverable.
   */
  private addressOf(peerId: string): { readonly host: string; readonly port: number } {
    const peer = this.discovered.get(peerId)
    const host = peer?.addresses[0]
    if (peer === undefined || host === undefined) {
      throw new Error(`device ${peerId} is not currently visible on the network; ask it to keep the app open and retry`)
    }
    return { host, port: peer.port }
  }

  /**
   * Take one pending offer by id.
   * @param id - the pending pairing id.
   * @returns the offer, removed from the pending list.
   * @throws {Error} for an unknown or already settled id.
   */
  private takePending(id: string): PairingOffer {
    const offer = this.pending.get(id)
    if (offer === undefined) throw new Error(`pairing ${id} is not pending`)
    this.pending.delete(id)
    return offer
  }

  /**
   * Route one accepted TLS socket by its opening `hello`.
   * @param socket - the accepted connection after the TLS handshake.
   */
  private serveConnection(socket: TLSSocket): void {
    void this.routeConnection(socket).catch((error: unknown) => {
      /* v8 ignore next -- reached only through a route refusal, which always carries an Error */
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
    /* v8 ignore next -- ready resolved before a socket can be accepted */
    if (identity === undefined) throw new Error('lan handoff identity is not started')
    const channel = attachChannel(socket)
    const hello = await channel.next('hello', PAIRING_TIMEOUT_MS)
    const intent = hello['intent']
    if (intent === 'pair') {
      const offer = await answerPairing(socket, hello, pairingIdentityOf(state.deviceId, identity.cert, state.name), channel)
      const handler = this.pairingRequestHandler
      if (handler !== undefined) {
        handler(this.persisting(offer))
        return
      }
      const id = randomBytes(6).toString('hex')
      this.pending.set(id, this.persisting(offer))
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
      if (presented === undefined || typeof claimed !== 'string'
        || String(presented) !== claimed || !this.paired.has(presented)) {
        channel.write({ type: 'reject', binaryLength: 0, reason: 'notPaired' })
        socket.end()
        return
      }
      await this.serveSync(channel)
      return
    }
    channel.write({ type: 'reject', binaryLength: 0, reason: 'incompatible' })
    socket.end()
  }

  /**
   * Receive one bundle from a verified paired peer into the handoff directory.
   * @param channel - the authenticated connection channel.
   */
  private async serveSync(channel: ConnectionChannel): Promise<void> {
    const seams = this.sessionServices()
    const importer = seams.importer
    if (importer === undefined) throw new Error('lan handoff requires the sessionLogImporter service to receive projects')
    const host = {
      importSessionArchives: async (archives: readonly Uint8Array[], targetCwd: string): Promise<readonly string[]> => {
        const ids: string[] = []
        for (const archive of archives) {
          const result = await importer.importArchive(archive, { targetCwd })
          ids.push(String(result.root.id), ...result.descendants.map(descendant => String(descendant.id)))
        }
        return ids
      },
      attachProject: async (projectPath: string, title: string, sessionIds: readonly string[]): Promise<void> => {
        // A session-less receipt (sessions unchecked, or a quick push) lands
        // files only; it registers no workspace the sidebar would show.
        if (sessionIds.length === 0) return
        const workspace = await seams.workspaces.create(projectPath, title)
        for (const id of sessionIds) await workspace.attachSession(SessionId(id))
      },
    }
    const state = await this.ready
    try {
      const outcome: ReceivedHandoff = await receiveHandoff(channel, {
        targetParentDirectory: state.handoffDirectory,
        host,
        ...state.dataDirectory === '' ? {} : { dataDirectory: state.dataDirectory },
      })
      this.lastHandoff = { at: Date.now(), ok: true, detail: `received "${outcome.projectPath}"` }
    } catch (error) {
      /* v8 ignore next -- receiveHandoff rejects with Error instances only */
      this.lastHandoff = { at: Date.now(), ok: false, detail: error instanceof Error ? error.message : String(error) }
      throw error
    }
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

/** The services and operations one handoff composes. */
interface SessionServiceSeams {
  readonly persistence: SessionPersistence
  readonly query: SessionQueryEngine
  readonly attachments: AttachmentStore
  readonly workspaces: HandoffWorkspaces
  readonly importer: HandoffImporter | undefined
  readonly sessionExport: HandoffSessionExport | undefined
  flush(sessionId: SessionId, signal: AbortSignal | undefined): Promise<void>
  readLog(sessionId: SessionId, signal: AbortSignal | undefined): Promise<string | undefined>
  zip(content: string, sessionId: SessionId, signal: AbortSignal | undefined): Promise<Uint8Array>
}

/** Wire name of one session archive inside a bundle. */
function sessionArchiveName(sessionId: string): string {
  return `dsh-session-${sessionId.replace(/[^A-Za-z0-9_-]/gu, '_')}.zip`
}

/* v8 ignore start -- the exporter ZIP stream runs only through the real service composition */
/** Drain one exporter ZIP stream into memory. */
async function collectZip(
  deps: SessionLogExportReady,
  content: string,
  sessionId: SessionId,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  const stream = streamSessionLogZip(
    deps,
    content,
    sessionId,
    true,
    DEFAULT_SESSION_LOG_COMPRESSION_LEVEL,
    signal ?? new AbortController().signal,
  )
  const chunks: Buffer[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

/* v8 ignore stop */
/** Dial a peer and await the TLS handshake. */
async function secureDial(
  target: { readonly host: string; readonly port: number },
  identity: DeviceIdentity,
): Promise<TLSSocket> {
  const socket = dialLanPeer(target, identity)
  await new Promise<void>((resolveConnect, reject) => {
    socket.once('secureConnect', () => resolveConnect())
    socket.once('error', (error: Error) => reject(error))
  })
  return socket
}

/** The loader-row entry: the class plugin cordis instantiates for the LAN handoff package. */
export default LanHandoffService
