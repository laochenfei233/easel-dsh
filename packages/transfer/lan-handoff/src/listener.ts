/**
 * TLS listener and dialer for LAN project handoff.
 *
 * Transport confidentiality and integrity come from TLS 1.3 with each
 * device's self-signed identity certificate. Peer authentication is NOT the
 * TLS layer's job: self-signed chains are not validated here, and the pairing
 * protocol over each connection confirms the remote device id before any
 * payload is exchanged.
 * @module @deepseek-ai/dsh-lan-handoff/listener
 */

import { EventEmitter } from 'node:events'
import { createServer as createTlsServer, connect as tlsConnect, type Server, type TLSSocket } from 'node:tls'
import type { DeviceIdentity } from './identity.ts'

/** One running TLS listener for handoff connections. */
export interface LanListener {
  /** Bound TCP port; the value mDNS advertises. */
  readonly port: number
  /** Host address the listener bound (`::` dual-stack or `0.0.0.0`). */
  readonly host: string
  /** Stop listening; established sockets are unaffected. */
  close(): Promise<void>
}

/** Listener hosts tried in order: dual-stack first, IPv4-only when IPv6 is unavailable. */
const LISTEN_HOSTS = ['::', '0.0.0.0'] as const

/**
 * Await one promise-form server bind.
 * @param server - server to bind.
 * @param host - host to bind on.
 * @param port - port to bind; 0 lets the OS assign.
 */
function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: unknown): void => reject(error)
    server.once('error', onError)
    server.listen({ host, port }, () => {
      server.off('error', onError)
      resolve()
    })
  })
}

/**
 * Await one event-emitter event.
 * @param source - emitter firing the event.
 * @param event - event name.
 */
function onceEvent(source: EventEmitter, event: string): Promise<void> {
  return new Promise((resolve) => { source.once(event, resolve) })
}

/**
 * Bind one TLS handoff listener.
 *
 * The listener prefers dual-stack `::`; systems without IPv6 fall back to
 * `0.0.0.0`. The OS assigns a port when `port` is 0, and the assigned value
 * returns in the listener for mDNS to advertise.
 * @param identityTls - certificate and key the server presents.
 * @param port - TCP port to bind; 0 lets the OS assign.
 * @param onConnection - callback for each accepted TLS socket; the protocol
 * layer owns every byte exchanged over it.
 * @param hosts - listen hosts tried in order; the explicit value is a test seam.
 * @returns the running listener.
 * @throws when every host fails to bind.
 */
export async function startLanListener(
  identityTls: Pick<DeviceIdentity, 'cert' | 'key'>,
  port: number,
  onConnection: (socket: TLSSocket) => void,
  hosts: readonly string[] = LISTEN_HOSTS,
): Promise<LanListener> {
  const server = createTlsServer({ key: identityTls.key, cert: identityTls.cert }, onConnection)
  let bound: { readonly host: string; readonly port: number } | undefined
  let lastError: unknown
  for (const host of hosts) {
    try {
      await listen(server, host, port)
      const address = server.address()
      bound = { host, port: typeof address === 'object' && address !== null ? address.port : port }
      break
    } catch (error) {
      lastError = error
    }
  }
  /* v8 ignore next 3 -- every LISTEN_HOSTS entry failing is reachable only on hosts with
     neither stack usable, which the loopback suite cannot produce. */
  if (bound === undefined) throw lastError
  return {
    port: bound.port,
    host: bound.host,
    close(): Promise<void> {
      server.close()
      return onceEvent(server, 'close')
    },
  }
}

/**
 * Open one TLS connection to a LAN peer.
 *
 * Chain validation stays off because peers present self-signed identity
 * certificates; the pairing protocol on the connection confirms the remote
 * device id before any payload. The local certificate rides along when this
 * device has one, so a peer can address it through the same id derivation.
 * @param target - host or IP address and TCP port to connect to.
 * @param identityTls - this device's certificate and key, when minted.
 * @returns the connecting socket.
 */
export function dialLanPeer(
  target: { readonly host: string; readonly port: number },
  identityTls?: Pick<DeviceIdentity, 'cert' | 'key'>,
): TLSSocket {
  return tlsConnect({
    host: target.host,
    port: target.port,
    ...identityTls !== undefined ? { cert: identityTls.cert, key: identityTls.key } : {},
    // Peer authentication rides the pairing protocol, not the chain.
    rejectUnauthorized: false,
  })
}
