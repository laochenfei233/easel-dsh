/**
 * mDNS (DNS-SD) discovery for LAN project handoff.
 *
 * Advertisements carry identity and versioning only — never keys or content.
 * TXT values are the entire discovery payload, so mDNS never exposes
 * anything beyond what a directory listing already shows.
 * @module @deepseek-ai/dsh-lan-handoff/discovery
 */

import { Bonjour, type Service } from 'bonjour-service'
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'
import type { DeviceId } from './identity.ts'

/** DNS-SD service type advertised and browsed for LAN project handoff. */
export const LAN_HANDOFF_SERVICE_TYPE = 'easel-handoff'

/** One advertisement's protocol-version range, inclusive on both ends. */
export interface ProtocolVersionRange {
  /** Lowest supported protocol version. */
  readonly min: number
  /** Highest supported protocol version. */
  readonly max: number
}

/** The protocol range this harness build speaks. */
export const LAN_HANDOFF_PROTOCOL_VERSION: ProtocolVersionRange = { min: 1, max: 1 }

/** Platform label advertised for a discovered device. */
export type LanPlatform = 'windows' | 'macos' | 'linux'

/** Advertised TXT record of one handoff device. */
export interface DeviceTxtDocument {
  /** Device id, 20 hex characters. */
  readonly id: DeviceId
  /** Display name supplied by the device. */
  readonly name: string
  /** Device platform. */
  readonly platform: LanPlatform
  /** Supported protocol-version range. */
  readonly protocol: ProtocolVersionRange
}

/** One discovered peer presented to consumers. */
export interface PeerAdvertisement {
  /** Device id from the TXT record. */
  readonly id: DeviceId
  /** Display name from the TXT record. */
  readonly name: string
  /** Platform from the TXT record. */
  readonly platform: LanPlatform
  /** Supported protocol-version range from the TXT record. */
  readonly protocol: ProtocolVersionRange
  /** Reachable TCP port carried by the SRV record. */
  readonly port: number
  /** Non-loopback addresses the discovery backend reported. */
  readonly addresses: readonly string[]
  /** Whether this build's protocol range overlaps the peer's. */
  readonly compatible: boolean
}

/**
 * Adapting to the mDNS library, cast structurally to typed values.
 */
export interface LanDiscoveryHost {
  /**
   * Publish one advertisement.
   * @param advertisement - service name, type, port, and TXT values.
   * @returns the published handle; `stop` withdraws it.
   */
  publish(advertisement: LanAdvertisement): { readonly stop: () => void }
  /**
   * Browse for one service type.
   * @param type - DNS-SD service type.
   * @param onUp - callback per advertisement seen on the network.
   */
  find(type: string, onUp: (entry: LanDiscoveryEntry) => void): void
  /** Withdraw every published advertisement and release the discovery backend. */
  dispose(): Promise<void>
}

/** One published advertisement. */
export interface LanAdvertisement {
  /** Instance name (the device id for handoff). */
  readonly name: string
  /** DNS-SD service type. */
  readonly type: string
  /** Advertised TCP port. */
  readonly port: number
  /** TXT record values. */
  readonly txt: Readonly<Record<string, string>>
}

/** One raw discovery entry before parsing. */
export interface LanDiscoveryEntry {
  /** Addresses the discovery backend reports for the peer. */
  readonly addresses: readonly string[]
  /** SRV port, unvalidated. */
  readonly port: number
  /** Raw TXT values, unvalidated. */
  readonly txt: Readonly<Record<string, unknown>>
}

/**
 * Resolve this process's advertised platform label.
 * @returns the platform label.
 */
export function lanPlatformOfHost(): LanPlatform {
  /* v8 ignore next 3 -- the non-host platform branches run on the other OS lanes */
  return process.platform === 'win32' ? 'windows'
    : process.platform === 'darwin' ? 'macos'
      : 'linux'
}

/**
 * Whether two inclusive protocol ranges share any version.
 * @param own - this build's range.
 * @param other - the peer's range.
 * @returns whether a common version exists.
 */
export function protocolRangesOverlap(own: ProtocolVersionRange, other: ProtocolVersionRange): boolean {
  return own.min <= other.max && other.min <= own.max
}

/**
 * Read one TXT protocol-version number.
 * @param raw - TXT value, any shape.
 * @returns the validated number, or `undefined` when the value is not an integer in `[0, 65535]`.
 */
function parseVersionNumber(raw: unknown): number | undefined {
  const value = typeof raw === 'string' ? Number(raw) : undefined
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 && value <= 65535
    ? value
    : undefined
}

/**
 * Encode one device's TXT document.
 * @param device - the advertised identity and protocol range.
 * @returns the TXT record values.
 */
export function encodeDeviceTxt(device: DeviceTxtDocument): Readonly<Record<string, string>> {
  return {
    id: device.id,
    name: device.name,
    pf: device.platform,
    v: String(device.protocol.max),
    vmin: String(device.protocol.min),
  }
}

/**
 * Parse one raw TXT record into a device document.
 * @param txt - raw TXT values.
 * @returns the document, or `undefined` when the record is not a valid handoff device.
 */
export function parseDeviceTxt(txt: Readonly<Record<string, unknown>>): DeviceTxtDocument | undefined {
  const idText = typeof txt['id'] === 'string' ? txt['id'] : undefined
  const name = typeof txt['name'] === 'string' ? txt['name'] : undefined
  const platformText = typeof txt['pf'] === 'string' ? txt['pf'] : undefined
  const maxText = parseVersionNumber(txt['v'])
  if (idText === undefined || name === undefined || platformText === undefined || maxText === undefined) return undefined
  const id = brandString<BrandDeviceId>(idText)
  const platform = platformText === 'windows' || platformText === 'macos' || platformText === 'linux' ? platformText : undefined
  if (platform === undefined) return undefined
  return { id, name, platform, protocol: { min: parseVersionNumber(txt['vmin']) ?? maxText, max: maxText } }
}

/** Alias type kept local so the parser callers read one id vocabulary. */
type BrandDeviceId = Branded<'DeviceId'>

/**
 * Whether an address is loopback and must not be shown to users.
 * @param address - IP literal, IPv4 or IPv6.
 * @returns whether the address targets the announcing process itself or this machine only.
 */
export function isLoopbackAddress(address: string): boolean {
  return address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.')
}

/**
 * Parse one raw discovery entry.
 *
 * Entries that are not valid handoff devices, are this device itself, or
 * expose only loopback addresses return `undefined`; incompatibility is kept
 * (`compatible: false`) so the UI can still list the peer and recommend an
 * upgrade.
 * @param entry - raw discovery entry.
 * @param ownDeviceId - this device's id, which filters its own announcements.
 * @param options - `allowLoopback` keeps loopback addresses for loopback test compositions.
 * @returns the peer advertisement, or `undefined` when the entry is not listable.
 */
export function parseDiscoveredEntry(
  entry: LanDiscoveryEntry,
  ownDeviceId: DeviceId,
  options?: { readonly allowLoopback?: boolean },
): PeerAdvertisement | undefined {
  const device = parseDeviceTxt(entry.txt)
  if (device === undefined || device.id === ownDeviceId) return undefined
  const address = Number.isSafeInteger(entry.port) && entry.port >= 1 && entry.port <= 65535 ? entry.port : undefined
  if (address === undefined) return undefined
  const addresses = options?.allowLoopback === true
    ? entry.addresses
    : entry.addresses.filter(one => !isLoopbackAddress(one))
  if (addresses.length === 0) return undefined
  return {
    ...device,
    port: entry.port,
    addresses,
    compatible: protocolRangesOverlap(LAN_HANDOFF_PROTOCOL_VERSION, device.protocol),
  }
}

/**
 * Advertise this device over mDNS.
 * @param discovery - discovery host driving the network.
 * @param device - this device's identity and protocol range.
 * @param name - display name to advertise.
 * @param port - TCP port to advertise.
 * @returns the published handle; `stop` withdraws the advertisement.
 */
export function advertiseLanHandoff(
  discovery: LanDiscoveryHost,
  device: { readonly deviceId: DeviceId; readonly platform: LanPlatform; readonly protocol: ProtocolVersionRange },
  name: string,
  port: number,
): { readonly stop: () => void } {
  return discovery.publish({
    name: device.deviceId,
    type: LAN_HANDOFF_SERVICE_TYPE,
    port,
    txt: encodeDeviceTxt({ id: device.deviceId, name, platform: device.platform, protocol: device.protocol }),
  })
}

/**
 * Browse the network for handoff peers.
 * @param discovery - discovery host driving the network.
 * @param ownDeviceId - this device's id, which filters its own announcements.
 * @param onPeer - callback per listable peer advertisement.
 * @param options - `allowLoopback` keeps loopback addresses for loopback test compositions.
 */
export function browseLanHandoff(
  discovery: LanDiscoveryHost,
  ownDeviceId: DeviceId,
  onPeer: (peer: PeerAdvertisement) => void,
  options?: { readonly allowLoopback?: boolean },
): void {
  discovery.find(LAN_HANDOFF_SERVICE_TYPE, (entry) => {
    const peer = parseDiscoveredEntry(entry, ownDeviceId, options)
    if (peer !== undefined) onPeer(peer)
  })
}

/* v8 ignore start -- live mDNS multicast sockets stay out of loopback tests; the adapter
   is exercised against real devices during acceptance. */
/**
 * Real mDNS-backed discovery host backed by `bonjour-service`.
 * @returns the live discovery host.
 */
export function createBonjourDiscovery(): LanDiscoveryHost {
  const bonjour = new Bonjour()
  return {
    publish: (advertisement) => {
      // TXT values this library hands back re-enter the wire as bytes; every
      // recorded value is ASCII already, so no reshaping is needed.
      const published = bonjour.publish({
        name: advertisement.name,
        type: advertisement.type,
        port: advertisement.port,
        txt: advertisement.txt,
      })
      return { stop: () => { published.stop() } }
    },
    find: (type, onUp) => {
      bonjour.find({ type }, (service: Service) => {
        onUp({
          addresses: service.addresses ?? [],
          port: service.port,
          txt: Object.fromEntries(Object.entries(service.txt ?? {}).map(([key, value]) => [
            key, value === undefined || value === null ? '' : String(value),
          ])),
        })
      })
    },
    dispose: () => new Promise((resolve) => {
      bonjour.unpublishAll(() => { bonjour.destroy(() => resolve(undefined)) })
    }),
  }
}
/* v8 ignore stop */
