---
description: "LAN project handoff peer service: persistent device identity, TLS listener, and mDNS discovery for moving project bundles between devices."
kind: "package-reference"
---

# @deepseek-ai/dsh-lan-handoff

English | [中文](README.zh.md)

## Summary

One running harness home builds the LAN half of a project handoff: it mints a persistent self-signed certificate the first time the service starts, binds a TLS listener on an OS-assigned port, and advertises itself over mDNS while browsing for other devices. Advertisements carry only an id, a display name, a platform, and a supported protocol range — never keys or content. Connections confirm peers at the pairing layer; the TLS layer provides confidentiality and integrity with self-signed chains left unvalidated.

## Table of Contents

- [Use this package](#use_this_package)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="use_this_package"></a>
## Use this package

Mount the package as a plugin and read `ctx.lanHandoff.ready` for this device's identity, bound port, and receipt directory, plus `peersSnapshot()` for currently discoverable peers. Configuration accepts an optional display name (default: the operating-system host name), an optional listener port (default: OS-assigned), the absolute `handoffDirectory` received projects land in (the Easel shell points it at the project root's `projects` directory), and the absolute `dataDirectory` that receives `data` bundle entries; a bundle carrying data entries is refused while `dataDirectory` is unset.

Handoff itself is four service calls: `pairWithPeer` or `pairWithDiscoveredPeer` opens a pairing and parks it in `pairingOffers()`; the UI shows each offer's six-digit string and settles it with `acceptPairing(id)` or `rejectPairing(id)`. `sendProjectToPeer(peerId, workspacePath, options)` exports the workspace's sessions (disable with `sessions: false`), drops project-tree files matching the `exclude` prefixes, attaches `dataFiles` as data-root-addressed entries, hashes the project tree, and streams the bundle; incoming bundles are received automatically into `handoffDirectory`, imported through the mounted `sessionLogImporter` when they carry sessions, and attached to a workspace through the mounted workspace registry only when sessions arrived. `sendFilesToPeer(peerId, payload)` pushes an explicit file selection as a session-less quick push whose receiving side merges into an existing directory of the same title instead of refusing. Deleting `$DSH_HOME/lan-handoff/identity.json` remints the identity, and every peer that recorded Deleting the previous key must re-pair — the same lifetime contract as the anonymous user id file.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- v1 resumes at entry granularity only: a partially transferred file restarts from its beginning.
- Received archives are decompressed in memory before their sessions are imported.
- A session-less receipt (a quick push, or a project send with sessions unchecked) lands its files without registering a workspace; the folder shows up in the sidebar only after it gains a session.
- mDNS discovery is unit-tested through injected hosts; real multicast runs on devices and can be blocked by routers, in which case discovery falls back to manual addresses.
- The agent-facing handoff tool (letting the model initiate a transfer itself) is deferred; v1 is user-driven.

<a id="dev-note"></a>
### Dev Note

None.
