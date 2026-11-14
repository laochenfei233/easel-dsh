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

import { randomBytes, createHash } from 'node:crypto'
import { open, rm } from 'node:fs/promises'
import { hostname, networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import type { TLSSocket } from 'node:tls'
import { Context, Service } from '@deepseek-ai/cordis'
import { applyModelConfigDocuments } from './model-config.ts'
import z from '@deepseek-ai/schemastery'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { sendWithResends } from './resend.ts'
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
  selectDialAddress,
  type LanDiscoveryHost,
  type LocalIpv4Network,
  type PeerAdvertisement,
} from './discovery.ts'
import { defaultLanHandoffRoot, deviceIdFromCertificate, loadDeviceIdentity, type DeviceId, type DeviceIdentity } from './identity.ts'
import { dialLanPeer, startLanListener, type LanListener } from './listener.ts'
import { loadSavedPort, saveSavedPort } from './port.ts'
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
  cleanupStaleReceipts,
  preparedEntryReader,
  receiveHandoff,
  SharedReceipt,
  sendPreparedBundle,
  walkProjectTree,
  type ConfigDocumentSource,
  type DataFileSource,
  type HandoffPathRemap,
  type HandoffReceiveProgress,
  type PreparedBundle,
  type ReceivedConfigDocument,
  type ReceivedHandoff,
  type SessionArchiveSource,
} from './handoff.ts'
import type { SentBundle } from './transfer.ts'
import {
  awaitBundleCompletion,
  receiveBundleFrom,
  receiveOffer,
  sendEntries,
  sendOffer,
  type ReceivedOffer,
} from './transfer.ts'

/** How long a resend waits before redialing the peer. */

/* The plugin entry re-exports only its Error family: everything else lives in
 * the submodules (verify-plugin-entry-exports keeps the Loader surface minimal).
 */
export { DeviceIdentityCorruptError } from './identity.ts'
export { ChannelClosedError, PairingError, PairingIncompatibleError, PairingRejectedError } from './pairing.ts'
export { PairedPeersCorruptError } from './peers.ts'
export { FrameError } from './frame.ts'
export { TransferCompletionError, TransferIntegrityError, TransferProtocolError, TransferRejectedError } from './transfer.ts'
export { HandoffPreparationError, HandoffReceiveError } from './handoff.ts'


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
  /**
   * Minutes after which a staging directory left by an interrupted receipt is
   * removed at service start. The default 30 minutes keeps a concurrently
   * running instance's active receipt safe; `0` removes every staging group
   * at startup.
   */
  staleReceiptAgeMinutes?: number
  /**
   * Total send attempts per bundle, counting the first. A connection-level
   * failure (dropped link, idle stall) resends from the receiver's staged
   * bytes after a short delay; refusals and protocol violations are never
   * retried. The default 3 attempts covers a flaky link; `1` disables
   * resending.
   */
  sendRetryAttempts?: number
  /**
   * Connections a project send may use in parallel (1–8; default 2). Workers
   * stream disjoint entry slices of one bundle, which raises throughput on
   * high-latency links; `1` keeps the single-connection path.
   */
  parallelConnections?: number
}

/** Live state of the receipt currently streaming into this device. */
export interface ReceivingHandoff extends HandoffReceiveProgress {
  /** Epoch milliseconds when this receipt started. */
  readonly startedAt: number
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
    options: {
      readonly targetCwd: string
      readonly pathRemaps?: readonly HandoffPathRemap[]
      readonly signal?: AbortSignal
    },
  ): Promise<{ readonly root: { readonly id: unknown }; readonly descendants: readonly { readonly id: unknown }[] }>
}
/* v8 ignore stop */

/** The session-export operations a handoff uses (test/embedder seam). */
export interface HandoffSessionExport {
  /** Flush the session log before it is read. */
  flush(sessionId: SessionId, signal: AbortSignal | undefined): Promise<void>
  /** Read one canonical session log. */
  readLog(sessionId: SessionId, signal: AbortSignal | undefined): Promise<string | undefined>
  /**
   * Stream one session's exported ZIP into `absolutePath`, which the caller
   * created, and report its byte count and digest. Writing to a file instead of
   * returning bytes keeps an attachment-heavy archive out of the sender's
   * memory for the whole transfer.
   * @param content - the session log text to pack.
   * @param sessionId - the session the archive describes.
   * @param absolutePath - spool file to write.
   * @param signal - optional cancellation.
   * @returns the written byte count and its SHA-256.
   */
  writeArchive(
    content: string,
    sessionId: SessionId,
    absolutePath: string,
    signal: AbortSignal | undefined,
  ): Promise<{ readonly size: number; readonly sha256: string }>
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
  /** Harness home override; production resolves `$DSH_HOME` or `~/.easel`. */
  readonly homeDirectory?: string
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
  /** Absolute harness home (`$DSH_HOME`), the target for home-rooted received paths. */
  readonly homeDirectory: string
  /** Total send attempts per bundle, counting the first; resolved from config. */
  readonly sendRetryAttempts: number
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
    staleReceiptAgeMinutes: z.number().min(0).max(43200).default(30),
    sendRetryAttempts: z.number().min(1).max(10).default(3),
    parallelConnections: z.number().min(1).max(8).default(2),
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
  private localNetworks: readonly LocalIpv4Network[] = []
  /** Total send attempts per bundle; resolved from config at start. */
  private sendRetryAttempts = 3
  /** Connections per project send; resolved from config at start. */
  private parallelConnections = 2
  /** Receipts streaming in over several connections, keyed by bundle id. */
  private readonly sharedReceipts = new Map<string, SharedReceipt>()
  private receiving: ReceivingHandoff | undefined
  private receivingId: string | undefined

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
          const homeDirectory = resolve(options?.homeDirectory ?? resolveDshHome())
          this.localNetworks = localIpv4Networks()
          this.sendRetryAttempts = config.sendRetryAttempts ?? 3
          this.parallelConnections = config.parallelConnections ?? 2
          try {
            const removed = await cleanupStaleReceipts(handoffDirectory, (config.staleReceiptAgeMinutes ?? 30) * 60_000)
            if (removed.length > 0) ctx.logger.warn(`lan-handoff: removed ${String(removed.length)} staging group(s) from interrupted receipts`)
          } catch {
            /* v8 ignore next -- staging removal fails only on a permission error the start path cannot force */
            ctx.logger.warn(`lan-handoff: could not clean stale receipts under "${handoffDirectory}"`)
          }
          /* v8 ignore next -- live mDNS stays out of loopback suites */
          const discovery = options?.discovery ?? createBonjourDiscovery()
          const preferredPort = config.port ?? 0
          // Rebind the port this root last used so a stored endpoint stays
          // valid across restarts; a port taken by another process falls back
          // to an OS-assigned one and is remembered in turn.
          const rememberedPort = preferredPort === 0 ? await loadSavedPort(root) : undefined
          const listen = (port: number): Promise<LanListener> =>
            startLanListener(identity, port, (socket) => { this.serveConnection(socket) })
          let listener: LanListener
          if (rememberedPort !== undefined) {
            try {
              listener = await listen(rememberedPort)
            } catch {
              /* v8 ignore next -- a remembered port taken by another process needs an OS-level port conflict */
              listener = await listen(preferredPort)
            }
          } else {
            listener = await listen(preferredPort)
          }
          if (preferredPort === 0) {
            // Await the write so a restart that begins right after `ready`
            // still finds the port; an unwritable root must not fail the start.
            try {
              await saveSavedPort(root, listener.port)
            } catch (error) {
              /* v8 ignore next -- remembering the port needs a write failure on the handoff root */
              ctx.logger.warn(`lan-handoff: could not remember the listener port: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
          const published = advertiseLanHandoff(
            discovery,
            { deviceId: identity.deviceId, platform: lanPlatformOfHost(), protocol: LAN_HANDOFF_PROTOCOL_VERSION },
            name,
            listener.port,
          )
          browseLanHandoff(
            discovery,
            identity.deviceId,
            (peer) => {
              this.discovered.set(peer.id, peer)
              void this.rememberEndpoint(peer)
            },
            {
              ...options?.allowLoopbackPeers === true ? { allowLoopback: true } : {},
              onPeerGone: (deviceId) => { this.discovered.delete(deviceId) },
            },
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
            homeDirectory,
            sendRetryAttempts: this.sendRetryAttempts,
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
   * The receipt currently streaming into this device.
   * @returns live progress, or `undefined` when no receipt is in flight.
   */
  receivingSnapshot(): ReceivingHandoff | undefined {
    return this.receiving
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
   * @throws {ChannelClosedError} when the connection closes before the decision.
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
      const persisted = this.persisting(offer, target)
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
   * Remove one device from this device's pairing history.
   *
   * A pending pairing for the same device is declined with it; discovery
   * keeps listing the device as nearby, so it can be paired again. The former
   * peer keeps its own record and is refused as unpaired until both sides
   * pair again.
   * @param peerId - the device id to forget.
   */
  async forgetPeer(peerId: string): Promise<void> {
    const root = this.root
    /* v8 ignore next -- ready resolved before any pairing can settle */
    if (root === undefined) throw new Error('lan handoff peer state is not started')
    for (const [id, offer] of this.pending) {
      if (String(offer.peer.id) !== peerId) continue
      this.pending.delete(id)
      /* v8 ignore next -- a peer already gone makes the rejection throw on a dead socket */
      void offer.reject().catch(() => undefined)
    }
    if (!this.paired.delete(peerId)) return
    await savePairedPeers(root, this.paired)
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
   * @throws {Error} when the peer is not discovered right now, no longer paired, or speaks an incompatible protocol.
   */
  async openSyncChannel(peerId: string): Promise<{ readonly socket: TLSSocket; readonly channel: ConnectionChannel }> {
    const state = await this.ready
    const identity = this.identity
    /* v8 ignore next -- ready resolved before any method can run */
    if (identity === undefined) throw new Error('lan handoff identity is not started')
    if (!this.paired.has(peerId)) throw new Error(`device ${peerId} is not paired with this device`)
    const peer = this.discovered.get(peerId)
    if (peer !== undefined && !peer.compatible) {
      throw new Error(`device ${peerId} speaks an incompatible Air Transfer protocol; update both devices and retry`)
    }
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
   * path equals or sits under one of the prefixes, `dataFiles` adds device-data
   * entries addressed relative to the peer's data root, and `configDocuments`
   * adds portable configuration the peer applies through its own seams.
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
      /** Portable config documents the peer applies through its own seams. */
      readonly configDocuments?: readonly ConfigDocumentSource[]
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
          writeTo: (absolutePath, signal) => exportSeam.writeArchive(content, sessionId, absolutePath, signal),
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
      const state = await this.ready
      prepared = await bundleFromFiles({
        projectTitle: workspace.title.length > 0 ? workspace.title : 'project',
        files,
        sessionArchives: archives,
        sourceCwd: workspace.path,
        sourceRoots: {
          ...state.dataDirectory === '' ? {} : { data: state.dataDirectory },
          home: state.homeDirectory,
        },
        ...options?.dataFiles === undefined ? {} : { dataFiles: options.dataFiles },
        ...options?.configDocuments === undefined ? {} : { configDocuments: options.configDocuments },
      })
    } catch (error) {
      /* v8 ignore start -- prepare failures are asserted with both Error and non-Error throws elsewhere */
      this.lastHandoff = { at: Date.now(), ok: false, detail: error instanceof Error ? error.message : String(error) }
      throw error
      /* v8 ignore stop */
    }
    return this.sendToPeer(peerId, prepared, options?.signal)
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
    return this.sendToPeer(peerId, prepared, options?.signal)
  }

  /**
   * Stream one prepared bundle to a paired peer, resending from the peer's
   * staged bytes when a connection-level failure interrupts the transfer.
   *
   * An unstable Wi-Fi link stalls mid-transfer (the receiver's idle timeout
   * reports it); the bundle id is content-derived, so each attempt continues
   * from what the peer already holds instead of restarting the transfer.
   * Receiver refusals (`TransferRejectedError`) and protocol/integrity errors
   * are deterministic and never retried.
   * @param peerId - the paired device's id.
   * @param prepared - the prepared bundle.
   * @param signal - optional cancellation.
   * @returns which entries were streamed and which the peer already held.
   */
  private async sendToPeer(peerId: string, prepared: PreparedBundle, signal?: AbortSignal): Promise<SentBundle> {
    try {
      return await sendWithResends(
        () => this.streamToPeer(peerId, prepared, signal),
        this.sendRetryAttempts,
        signal,
      )
    } finally {
      if (prepared.spoolDirectory !== undefined) {
        try {
          await rm(prepared.spoolDirectory, { recursive: true, force: true })
        } catch (error) {
          /* v8 ignore start -- releasing a temporary directory fails only under
             a concurrent delete or a locked file, which the suite cannot force */
          // A spool directory the OS holds open costs disk only until the
          // temporary directory is swept; it must not fail a finished send.
          this.ctx.logger?.warn?.(`lan handoff: removing the spool directory failed (${error instanceof Error ? error.message : String(error)})`)
          /* v8 ignore stop */
        }
      }
    }
  }

  /**
   * Stream one prepared bundle to a paired peer over a fresh sync channel.
   * @param peerId - the paired device's id.
   * @param prepared - the prepared bundle.
   * @param signal - optional cancellation.
   * @returns which entries were streamed and which the peer already held.
   */
  private async streamToPeer(peerId: string, prepared: PreparedBundle, signal?: AbortSignal): Promise<SentBundle> {
    let socket: TLSSocket | undefined
    try {
      const opened = await this.openSyncChannel(peerId)
      socket = opened.socket
      const sent = this.parallelConnections > 1
        ? await this.streamParallel(peerId, opened, prepared, signal)
        : await sendPreparedBundle(opened.channel, prepared, signal)
      this.lastHandoff = { at: Date.now(), ok: true, detail: `sent ${String(sent.sent.length)} entries to ${peerId}` }
      return sent
    } catch (error) {
      /* v8 ignore next -- transport failures (channel, socket, transfer) are Errors */
      this.lastHandoff = { at: Date.now(), ok: false, detail: error instanceof Error ? error.message : String(error) }
      throw error
    } finally {
      // Graceful close flushes frames still in the write buffer; destroy()
      // can discard the final `done` message and leave the peer waiting.
      socket?.end()
    }
  }

  /**
   * Stream one bundle over several connections, each carrying a disjoint
   * stride of the entry list. Workers open after the primary's accept, so the
   * receiver's shared receipt already holds the resume report they all use.
   * @param peerId - the paired device's id.
   * @param primary - the first connection, which also waits for completion.
   * @param prepared - the prepared bundle.
   * @param signal - optional cancellation.
   * @returns the union of skipped and streamed entries across workers.
   */
  private async streamParallel(
    peerId: string,
    primary: Awaited<ReturnType<LanHandoffService['openSyncChannel']>>,
    prepared: PreparedBundle,
    signal?: AbortSignal,
  ): Promise<SentBundle> {
    // No benefit in more connections than entries; one connection stays the floor.
    const total = Math.max(1, Math.min(this.parallelConnections, prepared.manifest.entries.length))
    const worker = (index: number): { index: number; total: number } => ({ index, total })
    signal?.throwIfAborted()
    const opened: Awaited<ReturnType<LanHandoffService['openSyncChannel']>>[] = [primary]
    const controller = new AbortController()
    const onAbort = (): void => { abort() }
    const abort = (): void => {
      controller.abort()
      for (const connection of opened) connection.socket.destroy()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const resume = await sendOffer(primary.channel, prepared.manifest, worker(0))
      for (let index = 1; index < total; index += 1) opened.push(await this.openSyncChannel(peerId))
      await Promise.all(opened.slice(1).map(async (connection, index) => {
        await sendOffer(connection.channel, prepared.manifest, worker(index + 1))
      }))
      const reader = preparedEntryReader(prepared)
      const results = await Promise.all(opened.map(async (connection, index) =>
        sendEntries(connection.channel, prepared.manifest, worker(index), resume, reader, controller.signal)))
      await awaitBundleCompletion(primary.channel)
      return {
        skipped: results.flatMap(result => result.skipped),
        sent: results.flatMap(result => result.sent),
      }
    } catch (error) {
      abort()
      throw error
    } finally {
      signal?.removeEventListener('abort', onAbort)
      for (const connection of opened.slice(1)) connection.socket.end()
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
      writeArchive: (content, sessionId, absolutePath, signal) => spoolZip(exportDeps, content, sessionId, absolutePath, signal),
      /* v8 ignore stop */
    }
  }

  /**
   * Wrap an offer so a successful accept() records the peer durably.
   * @param offer - the handshake offer.
   * @returns an offer with the same identity whose accept persists the peer.
   */
  private persisting(offer: PairingOffer, dialTarget?: { readonly host: string; readonly port: number }): PairingOffer {
    return {
      ...offer,
      accept: async () => {
        await offer.accept()
        await this.recordPairedPeer(offer.peer, dialTarget)
      },
    }
  }

  /**
   * Persist one paired peer and publish it through {@link pairedPeers}.
   * @param peer - the confirmed peer.
   */
  private async recordPairedPeer(peer: PairingPeer, dialTarget?: { readonly host: string; readonly port: number }): Promise<void> {
    const root = this.root
    /* v8 ignore next -- ready resolved before any pairing can settle */
    if (root === undefined) throw new Error('lan handoff peer state is not started')
    const seen = this.discovered.get(peer.id)
    const addresses = seen?.addresses ?? (dialTarget === undefined ? undefined : [dialTarget.host])
    const port = seen?.port ?? dialTarget?.port
    const record: PairedPeer = {
      id: peer.id,
      name: peer.name,
      platform: peer.platform,
      pairedAt: Date.now(),
      ...addresses === undefined ? {} : { addresses },
      ...port === undefined ? {} : { port },
      ...seen === undefined ? {} : { lastSeenAt: Date.now() },
    }
    this.paired.set(peer.id, record)
    await savePairedPeers(root, this.paired)
  }

  /**
   * Refresh one paired peer's stored endpoint from a discovery report, so a
   * later send can dial it while mDNS is blind. Only a changed endpoint is
   * written; discovery re-emits unchanged advertisements often.
   * @param peer - the discovered peer.
   */
  private async rememberEndpoint(peer: PeerAdvertisement): Promise<void> {
    const root = this.root
    const record = this.paired.get(peer.id)
    if (root === undefined || record === undefined) return
    if (record.port === peer.port
      && record.addresses !== undefined
      && record.addresses.length === peer.addresses.length
      && record.addresses.every((address, index) => address === peer.addresses[index])) {
      return
    }
    const next: PairedPeer = {
      ...record,
      addresses: [...peer.addresses],
      port: peer.port,
      lastSeenAt: Date.now(),
    }
    this.paired.set(peer.id, next)
    try {
      await savePairedPeers(root, this.paired)
    } catch (error) {
      // The in-memory record still serves this session's sends.
      /* v8 ignore next -- persisting needs a write failure on the handoff root */
      this.ctx.logger.warn(`lan-handoff: could not persist the endpoint for ${peer.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Resolve one peer's dial address from the latest advertisement.
   * @param peerId - the device id.
   * @returns the dial target.
   * @throws {Error} when the peer is not currently discoverable.
   */
  private addressOf(peerId: string): { readonly host: string; readonly port: number } {
    const peer = this.discovered.get(peerId)
    const addresses = peer?.addresses ?? this.paired.get(peerId)?.addresses
    const port = peer?.port ?? this.paired.get(peerId)?.port
    if (addresses === undefined || port === undefined) {
      throw new Error(this.paired.has(peerId)
        ? `device ${peerId} is paired but not currently discoverable and has no remembered address; use "pair by address" with the peer's address and port, or wait for its advertisement`
        : `device ${peerId} is not currently visible on the network; ask it to keep the app open and retry`)
    }
    const host = selectDialAddress(addresses, this.localNetworks, {
      ...this.options.allowLoopbackPeers === true ? { allowLoopback: true } : {},
    })
    if (host === undefined) {
      throw new Error(`device ${peerId} advertises no dialable address on this network; ask it to reconnect and retry`)
    }
    // A stored endpoint is the last advertised one; the caller's dial and
    // resend then decide whether the peer is still reachable there.
    return { host, port }
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
      // Flush the terminal `failed` frame before closing; destroy() can drop
      // it and leave the sender reporting a bare closed connection.
      socket.destroySoon()
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
      importSessionArchives: async (
        archives: readonly (() => Promise<Uint8Array>)[],
        targetCwd: string,
        remaps: readonly HandoffPathRemap[],
      ): Promise<readonly string[]> => {
        const ids: string[] = []
        // Read and import one archive at a time: the staged files stay on disk
        // between iterations, so only the archive in flight is held in memory.
        for (const read of archives) {
          const result = await importer.importArchive(await read(), { targetCwd, pathRemaps: remaps })
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
      applyConfigDocuments: async (documents: readonly ReceivedConfigDocument[]): Promise<void> => {
        await applyModelConfigDocuments(this.ctx, documents)
      },
    }
    const state = await this.ready
    const offer = await receiveOffer(channel)
    const receiptId = randomBytes(6).toString('hex')
    const startedAt = Date.now()
    const report = (progress: HandoffReceiveProgress): void => {
      this.receivingId = receiptId
      this.receiving = { ...progress, startedAt }
    }
    try {
      const outcome: ReceivedHandoff = offer.worker.total === 1
        ? await receiveHandoff(channel, {
            targetParentDirectory: state.handoffDirectory,
            host,
            ...state.dataDirectory === '' ? {} : { dataDirectory: state.dataDirectory },
            homeDirectory: state.homeDirectory,
            onProgress: report,
            offer,
          })
        : await this.serveShared(channel, offer, host, report)
      this.lastHandoff = { at: Date.now(), ok: true, detail: `received "${outcome.projectPath}"` }
    } catch (error) {
      /* v8 ignore next -- receiveHandoff rejects with Error instances only */
      this.lastHandoff = { at: Date.now(), ok: false, detail: error instanceof Error ? error.message : String(error) }
      throw error
    } finally {
      // Only this receipt clears the live progress; a later concurrent
      // receipt owns the snapshot once its first update arrives.
      if (this.receivingId === receiptId) {
        this.receiving = undefined
        this.receivingId = undefined
      }
    }
  }

  /**
   * Join the shared receipt for one parallel worker: the first worker
   * prepares staging, each worker stages its slice, and the last worker's
   * `done` settles the receipt and reports to every connected worker.
   * @param channel - this worker's authenticated connection.
   * @param offer - the offer read for this connection.
   * @param host - product seams for the settling worker.
   * @param report - progress observer for the receiving snapshot.
   * @returns the settled receipt.
   */
  private async serveShared(
    channel: ConnectionChannel,
    offer: ReceivedOffer,
    host: Parameters<typeof receiveHandoff>[1]['host'],
    report: (progress: HandoffReceiveProgress) => void,
  ): Promise<ReceivedHandoff> {
    const state = await this.ready
    const bundleId = offer.manifest.bundleId
    let shared = this.sharedReceipts.get(bundleId)
    if (offer.worker.index === 0) {
      /* v8 ignore next -- a second index-0 connection for one bundle needs a misbehaving sender */
      if (shared !== undefined) throw new Error(`bundle ${bundleId} already has a first worker`)
      shared = new SharedReceipt(
        offer.manifest,
        state.handoffDirectory,
        state.dataDirectory === '' ? undefined : state.dataDirectory,
        state.homeDirectory,
        host,
        offer.worker.total,
        report,
      )
      this.sharedReceipts.set(bundleId, shared)
      const settling = shared
      void settling.completion.catch(() => undefined).finally(() => {
        /* v8 ignore next -- only a misbehaving sender can register one bundle twice */
        if (this.sharedReceipts.get(bundleId) === settling) this.sharedReceipts.delete(bundleId)
      })
    } else {
      // Workers open after the primary's accept, but tolerate a slow LAN by
      // waiting briefly for the receipt to register.
      for (let attempt = 0; shared === undefined && attempt < 20; attempt += 1) {
        await new Promise<void>(resolveWait => { setTimeout(resolveWait, 100) })
        shared = this.sharedReceipts.get(bundleId)
      }
      if (shared === undefined) throw new Error(`bundle ${bundleId} has no first worker`)
    }
    const receipt = shared
    receipt.channels.add(channel)
    try {
      const bundle: Awaited<ReturnType<typeof receiveBundleFrom>> = await receiveBundleFrom(channel, offer, {
        decideOffer: (_manifest, worker) => worker.index === 0 ? receipt.start() : receipt.decide(worker),
        openEntry: (entry, startOffset) => receipt.openEntry(entry, startOffset),
      })
      receipt.record(offer.worker, bundle.entries)
      return await receipt.completion
    } catch (error) {
      /* v8 ignore next -- channel failures are Error instances */
      receipt.fail(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      receipt.channels.delete(channel)
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

/**
 * Collect this host's non-internal IPv4 addresses and masks.
 * @returns one entry per configured IPv4 interface address.
 */
function localIpv4Networks(): LocalIpv4Network[] {
  const networks: LocalIpv4Network[] = []
  for (const addresses of Object.values(networkInterfaces())) {
    /* v8 ignore next -- networkInterfaces() enumerates present interfaces only; the fallback satisfies the optional index type */
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        networks.push({ address: address.address, netmask: address.netmask })
      }
    }
  }
  return networks
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
  writeArchive(
    content: string,
    sessionId: SessionId,
    absolutePath: string,
    signal: AbortSignal | undefined,
  ): Promise<{ readonly size: number; readonly sha256: string }>
}

/** Wire name of one session archive inside a bundle. */
function sessionArchiveName(sessionId: string): string {
  return `dsh-session-${sessionId.replace(/[^A-Za-z0-9_-]/gu, '_')}.zip`
}

/* v8 ignore start -- the exporter ZIP stream runs only through the real service composition */
/**
 * Stream one exporter ZIP into a spool file, hashing as it goes.
 * @param deps - session export services.
 * @param content - the session log text to pack.
 * @param sessionId - the session the archive describes.
 * @param absolutePath - spool file to write.
 * @param signal - optional cancellation.
 * @returns the written byte count and its SHA-256.
 */
async function spoolZip(
  deps: SessionLogExportReady,
  content: string,
  sessionId: SessionId,
  absolutePath: string,
  signal: AbortSignal | undefined,
): Promise<{ readonly size: number; readonly sha256: string }> {
  const stream = streamSessionLogZip(
    deps,
    content,
    sessionId,
    true,
    DEFAULT_SESSION_LOG_COMPRESSION_LEVEL,
    signal ?? new AbortController().signal,
  )
  const handle = await open(absolutePath, 'w')
  const hash = createHash('sha256')
  let size = 0
  try {
    const reader = stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      size += value.byteLength
      await handle.write(value)
    }
  } finally {
    await handle.close()
  }
  return { size, sha256: hash.digest('hex') }
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
