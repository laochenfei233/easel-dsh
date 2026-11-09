/**
 * mDNS (DNS-SD) discovery for LAN project handoff.
 *
 * Advertisements carry identity and versioning only — never keys or content.
 * TXT values are the entire discovery payload, so mDNS never exposes
 * anything beyond what a directory listing already shows.
 * @module @easel-dsh/easel-air-transfer/discovery
 */

import { Bonjour, type Browser, type Service } from 'bonjour-service'
import { brandString, type Branded } from '@deepseek-ai/dsh-brand'
import type { DeviceId } from './identity.ts'

/** DNS-SD service type advertised and browsed for LAN project handoff. */
export const LAN_HANDOFF_SERVICE_TYPE = 'easel-handoff'

/**
 * How often a browsing device repeats its PTR query.
 *
 * Publishers stop re-announcing about 55 minutes after start, so a browser
 * that missed its single startup query would otherwise never see them again.
 */
export const LAN_HANDOFF_RESCAN_MS = 30_000

/** One advertisement's protocol-version range, inclusive on both ends. */
export interface ProtocolVersionRange {
  /** Lowest supported protocol version. */
  readonly min: number
  /** Highest supported protocol version. */
  readonly max: number
}

/**
 * The protocol range this harness build speaks.
 *
 * Version 2 adds the receiver completion acknowledgement; a v1 peer cannot
 * confirm that it imported a bundle, so the two are deliberately incompatible.
 */
export const LAN_HANDOFF_PROTOCOL_VERSION: ProtocolVersionRange = { min: 2, max: 2 }

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
   * @param onDown - optional callback per advertisement withdrawn or expired.
   */
  find(type: string, onUp: (entry: LanDiscoveryEntry) => void, onDown?: (entry: LanDiscoveryEntry) => void): void
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

/** One local non-internal IPv4 address and the mask that scopes its subnet. */
export interface LocalIpv4Network {
  /** Dotted IPv4 address. */
  readonly address: string
  /** Dotted IPv4 netmask. */
  readonly netmask: string
}

/**
 * Parse one dotted IPv4 literal into its unsigned 32-bit value.
 * @param address - dotted IPv4 candidate.
 * @returns the value, or `undefined` when the text is not four decimal octets.
 */
function ipv4Value(address: string): number | undefined {
  const octets = address.split('.')
  if (octets.length !== 4) return undefined
  let value = 0
  for (const octet of octets) {
    if (!/^\d{1,3}$/u.test(octet)) return undefined
    const part = Number(octet)
    if (part > 255) return undefined
    value = value * 256 + part
  }
  return value
}

/**
 * Extract the IPv4 literal when the address is IPv4 or IPv4-mapped IPv6.
 * @param address - IP literal.
 * @returns the dotted IPv4 literal, or `undefined` for a real IPv6 address.
 */
function ipv4LiteralOf(address: string): string | undefined {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(address)
  const literal = mapped?.[1] ?? address
  return ipv4Value(literal) === undefined ? undefined : literal
}

/**
 * Whether an address is link-local and therefore not dialable across a LAN.
 * @param address - IP literal, IPv4 or IPv6.
 * @returns whether it is IPv4 169.254.0.0/16 or IPv6 fe80::/10.
 */
export function isLinkLocalAddress(address: string): boolean {
  const ipv4 = ipv4LiteralOf(address)
  if (ipv4 !== undefined) return ipv4.startsWith('169.254.')
  return /^fe[89ab][0-9a-f]{0,2}:/iu.test(address)
}

/**
 * Choose the address to dial for a discovered peer.
 *
 * A peer commonly advertises its LAN address beside virtual adapters
 * (Hyper-V, WSL, VMware), IPv4 link-local addresses, and IPv6 link-local
 * addresses. Dialing the first advertisement is a coin flip, so prefer an
 * IPv4 address inside one of this device's own subnets, then any public IPv4,
 * then a non-link-local IPv6 address.
 * @param addresses - every address the discovery backend reported for the peer.
 * @param localNetworks - this device's non-internal IPv4 addresses and masks.
 * @param options - `allowLoopback` keeps loopback addresses for loopback test compositions.
 * @returns the preferred address, or `undefined` when none can carry a connection.
 */
export function selectDialAddress(
  addresses: readonly string[],
  localNetworks: readonly LocalIpv4Network[],
  options?: { readonly allowLoopback?: boolean },
): string | undefined {
  const dialable = addresses.filter(address => (options?.allowLoopback === true || !isLoopbackAddress(address))
    && !isLinkLocalAddress(address)
    && address !== '0.0.0.0'
    && address !== '::'
    && !address.startsWith('ff'))
  const ipv4: { readonly original: string; readonly literal: string }[] = []
  for (const address of dialable) {
    const literal = ipv4LiteralOf(address)
    if (literal !== undefined) ipv4.push({ original: address, literal })
  }
  for (const candidate of ipv4) {
    /* v8 ignore next -- ipv4LiteralOf only returns parsed literals */
    const value = ipv4Value(candidate.literal)
    /* v8 ignore next -- ipv4LiteralOf only returns parsed literals */
    if (value === undefined) continue
    for (const network of localNetworks) {
      const local = ipv4Value(network.address)
      const mask = ipv4Value(network.netmask)
      if (local !== undefined && mask !== undefined && (value & mask) === (local & mask)) return candidate.original
    }
  }
  const firstIpv4 = ipv4[0]
  if (firstIpv4 !== undefined) return firstIpv4.original
  return dialable.find(address => address.includes(':'))
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
 * @param options - `allowLoopback` keeps loopback addresses for loopback test
 * compositions; `onPeerGone` reports a peer withdrawn from the network.
 */
export function browseLanHandoff(
  discovery: LanDiscoveryHost,
  ownDeviceId: DeviceId,
  onPeer: (peer: PeerAdvertisement) => void,
  options?: {
    readonly allowLoopback?: boolean
    readonly onPeerGone?: (deviceId: DeviceId) => void
  },
): void {
  const onPeerGone = options?.onPeerGone
  discovery.find(LAN_HANDOFF_SERVICE_TYPE, (entry) => {
    const peer = parseDiscoveredEntry(entry, ownDeviceId, options)
    if (peer !== undefined) onPeer(peer)
  }, onPeerGone === undefined ? undefined : (entry) => {
    // A withdrawal may omit addresses, so only the identity is readable here.
    const device = parseDeviceTxt(entry.txt)
    if (device !== undefined && device.id !== ownDeviceId) onPeerGone(device.id)
  })
}

/* v8 ignore start -- live mDNS multicast sockets stay out of loopback tests; the adapter
   wiring is pinned by discovery-adapter.spec.ts against a mocked library. */
/**
 * Real mDNS-backed discovery host backed by `bonjour-service`.
 * @returns the live discovery host.
 */
export function createBonjourDiscovery(): LanDiscoveryHost {
  const bonjour = new Bonjour()
  const timers = new Set<NodeJS.Timeout>()
  const browsers = new Set<Browser>()
  const entryOf = (service: Service): LanDiscoveryEntry => ({
    addresses: service.addresses ?? [],
    port: service.port,
    txt: Object.fromEntries(Object.entries(service.txt ?? {}).map(([key, value]) => [
      key, value === undefined || value === null ? '' : String(value),
    ])),
  })
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
    find: (type, onUp, onDown) => {
      const browser = bonjour.find({ type }, (service: Service) => { onUp(entryOf(service)) })
      browsers.add(browser)
      // Port and TXT changes arrive as updates, not as a second `up`.
      browser.on('srv-update', (service: Service) => { onUp(entryOf(service)) })
      browser.on('txt-update', (service: Service) => { onUp(entryOf(service)) })
      if (onDown !== undefined) browser.on('down', (service: Service) => { onDown(entryOf(service)) })
      const timer = setInterval(() => { browser.update() }, LAN_HANDOFF_RESCAN_MS)
      timer.unref()
      timers.add(timer)
    },
    dispose: () => new Promise((resolve) => {
      for (const timer of timers) clearInterval(timer)
      timers.clear()
      for (const browser of browsers) browser.stop()
      browsers.clear()
      bonjour.unpublishAll(() => { bonjour.destroy(() => resolve(undefined)) })
    }),
  }
}
/* v8 ignore stop */
