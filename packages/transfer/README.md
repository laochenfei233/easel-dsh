---
description: "The transfer package group: LAN peer transfer between devices running this harness, each carrying its own device identity."
kind: "package-group"
---

# transfer/ — LAN peer transfer

English | [中文](README.zh.md)

## Summary

The transfer group lets two devices running this harness exchange project bundles over a local network: each device owns a persistent self-signed identity, discovers other devices through mDNS, and pairs with them through a human-confirmed handshake before any payload moves. Handoff transports the workspace files of a project together with the sessions that belong to it, so work started on one device continues on another. The group has one package; this page maps it, and the package README owns the details.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

<a id="packages"></a>
## Packages

| Package | Role |
|---|---|
| [`lan-handoff`](lan-handoff/README.md) | Runs the LAN peer services: persistent device identity, TLS listener on an assigned port, and mDNS advertisement and browsing |

<a id="related-documentation"></a>
## Related documentation

- [LAN project handoff spec](../../docs/compose/specs/easel-lan-handoff.md) — the design document and acceptance criteria for the handoff capability.
- [dsh-session-log-export](../session-query/session-log-export/README.md) — the log-archive format the handoff carries per session.
- [dsh-mime-attachment](../attachment/README.md) — the attachment store that receives the images and files carried inside a session archive.

<a id="dev-note"></a>
## Dev Note

None.
