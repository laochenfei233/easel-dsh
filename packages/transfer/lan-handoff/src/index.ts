/**
 * LAN project-handoff peer service (`ctx.lanHandoff`): persistent device
 * identity, TLS listener, and mDNS discovery for transferring project
 * bundles between devices.
 * @module @deepseek-ai/dsh-lan-handoff
 */

import { hostname } from 'node:os'
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
import { loadDeviceIdentity, type DeviceId, type DeviceIdentity } from './identity.ts'
import { startLanListener, type LanListener } from './listener.ts'

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
  /** Identity directory overriding the harness home; loopback tests use a temp root. */
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

/**
 * LAN peer services: identity, listener, and mDNS ownership.
 *
 * Accepted TLS sockets carry no protocol session in this build, so the
 * listener closes each one immediately; the pairing and transfer layers own
 * socket consumption.
 */
export class LanHandoffService extends Service {
  /** No service dependencies: state lives under the harness home and in mDNS. */
  static inject = []

  static Config: z<Config> = z.object({
    name: z.string().default(''),
    port: z.number().min(0).max(65535).default(0),
  })

  /** Runtime state, resolved once on start; device id and bound port never change afterwards. */
  readonly ready: Promise<LanHandoffState>

  private readonly discovered = new Map<string, PeerAdvertisement>()

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
          const identity: DeviceIdentity = await loadDeviceIdentity(options?.identityRoot)
          const name = config.name !== undefined && config.name.trim().length > 0 ? config.name : hostname()
          const discovery = options?.discovery ?? createBonjourDiscovery()
          const listener = await startLanListener(identity, config.port ?? 0, (socket) => { socket.destroy() })
          const published = advertiseLanHandoff(
            discovery,
            { deviceId: identity.deviceId, platform: lanPlatformOfHost(), protocol: LAN_HANDOFF_PROTOCOL_VERSION },
            name,
            listener.port,
          )
          browseLanHandoff(discovery, identity.deviceId, (peer) => { this.discovered.set(peer.id, peer) })
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
}
