---
description: "LAN project handoff peer service: persistent device identity, TLS listener, and mDNS discovery for moving project bundles between devices."
kind: "package-reference"
---

# @easel-dsh/easel-air-transfer

English | [中文](README.zh.md)

## Summary

One running harness home builds the LAN half of a project handoff: it mints a persistent self-signed certificate the first time the service starts, binds a TLS listener on an OS-assigned port, and advertises itself over mDNS while browsing for other devices. Advertisements carry only an id, a display name, a platform, and a supported protocol range — never keys or content. Connections confirm peers at the pairing layer; the TLS layer provides confidentiality and integrity with self-signed chains left unvalidated.

## Table of Contents

- [Use this package](#use_this_package)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="use_this_package"></a>
## Use this package

Mount the package as a plugin and read `ctx.lanHandoff.ready` for this device's identity, bound port, and receipt directory, plus `peersSnapshot()` for currently discoverable peers and `receivingSnapshot()` for the receipt currently streaming in. Configuration accepts an optional display name (default: the operating-system host name), an optional listener port (default: OS-assigned), the absolute `handoffDirectory` received projects land in (the Easel shell points it at the project root's `projects` directory), the absolute `dataDirectory` that receives `data` bundle entries, and `staleReceiptAgeMinutes` (default 30) that removes staging directories left by interrupted receipts at service start; a bundle carrying data entries is refused while `dataDirectory` is unset. Discovered peers are dialed on a same-subnet IPv4 address first, then any other IPv4, then a non-link-local IPv6 address, so virtual adapters and link-local advertisements do not win the dial.

Handoff itself is four service calls: `pairWithPeer` or `pairWithDiscoveredPeer` opens a pairing and parks it in `pairingOffers()`; the UI shows each offer's six-digit string and settles it with `acceptPairing(id)` or `rejectPairing(id)`; `forgetPeer(id)` removes one device from the pairing history (and declines its pending pairing) while leaving it visible as a nearby device for re-pairing. `sendProjectToPeer(peerId, workspacePath, options)` exports the workspace's sessions (disable with `sessions: false`), drops project-tree files matching the `exclude` prefixes, attaches `dataFiles` as data-root-addressed entries, hashes the project tree, and streams the bundle; incoming bundles are received automatically into `handoffDirectory`, imported through the mounted `sessionLogImporter` when they carry sessions, and attached to a workspace through the mounted workspace registry only when sessions arrived. `sendFilesToPeer(peerId, payload)` pushes an explicit file selection as a session-less quick push whose receiving side merges into an existing directory of the same title instead of refusing. `receivingSnapshot()` reports the active receipt's phase (`receiving`, `verifying`, or `importing`), project title, entry counts, and byte counts, and clears when the receipt settles.

Sending waits for the receiving device's completion acknowledgement: `received` after verification, session import, and workspace attachment, or `failed` with the receiver's reason. A send therefore succeeds only when the other device actually imported the bundle; a connection that ends first reports a closed connection instead of a success. The handoff protocol is version 5; a version-4 peer is listed as incompatible and refused before dialing, so both devices must run the same protocol generation.

Resume is at byte granularity: the receiver reports each staged entry's contiguous byte count in its accept, the sender streams only the tail, and the receiver hashes the complete staged file before publishing (a resumed tail cannot reproduce the whole-entry digest). Staged bytes survive a dropped link; corrupt bytes are discarded so the next attempt restarts that entry. `sendRetryAttempts` (default 3) bounds automatic resends: a connection-level failure waits briefly, redials, and continues from the receiver's checkpoint, while refusals and protocol violations are never retried. The content-derived bundle id is what makes a retry land in the same staging group.

A paired peer's last observed endpoint is stored with the pairing record: discovery refreshes it, pairing records the dialed address, and a send falls back to it while mDNS is blind — so a paired device stays reachable without waiting for a new advertisement. A paired peer with no remembered endpoint reports that the address must be entered with "pair by address".

A project send uses `parallelConnections` connections (default 2, 1–8): each worker carries a disjoint stride of the manifest's entries under the same bundle id, the first worker prepares staging and the shared resume report, and the last worker's `done` settles the receipt once for every connection. Parallelism raises throughput on high-latency links; entries never change hands, so a worker can never overwrite another's staged path.

`configDocuments` carries portable configuration instead of files: the receiving device applies each document through its own configuration seams, so a document naming model providers, the default model, and their credential references lands in the receiver's profile patch and credential store rather than overwriting either with the sender's machine-specific files. Received session logs are stored with the sending device's project, data-root, and home paths rewritten onto this device; the manifest's `sourceRoots` supplies the sender's wider roots, and `homeDirectory` (default `$DSH_HOME`) supplies the receiving counterpart a received home-rooted path maps to. Deleting `$DSH_HOME/lan-handoff/identity.json` remints the identity, and every peer that recorded Deleting the previous key must re-pair — the same lifetime contract as the anonymous user id file.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- Resume is at entry granularity only: a partially transferred file restarts from its beginning.
- Received archives are decompressed in memory before their sessions are imported.
- A session-less receipt (a quick push, or a project send with sessions unchecked) lands its files without registering a workspace; the folder shows up in the sidebar only after it gains a session.
- mDNS discovery is unit-tested through injected hosts; real multicast runs on devices and can be blocked by routers, in which case discovery falls back to manual addresses.
- A browsing device repeats its PTR query every 30 seconds: publishers stop announcing about 55 minutes after start, so a peer that came online before this device is still found without restarting either app.
- The agent-facing handoff tool (letting the model initiate a transfer itself) is deferred; transfers are user-driven.

<a id="dev-note"></a>
### Dev Note

None.
