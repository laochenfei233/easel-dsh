---
description: "LAN project handoff peer service: persistent device identity, TLS listener, and mDNS discovery for moving project bundles between devices."
kind: "package-library"
---

# @deepseek-ai/dsh-lan-handoff

English | [中文](README.zh.md)

## Summary

One running harness home builds the LAN half of a project handoff: it mints a persistent self-signed certificate the first time the service starts, binds a TLS listener on an OS-assigned port, and advertises itself over mDNS while browsing for other devices. Advertisements carry only an id, a display name, a platform, and a supported protocol range — never keys or content. Connections confirm peers at the pairing layer; the TLS layer provides confidentiality and integrity with self-signed chains left unvalidated.

## Table of Contents

- [Use this package](#use_this_package)

<a id="use_this_package"></a>
## Use this package

Mount the package as a plugin and read `ctx.lanHandoff.ready` for this device's identity and bound port, plus `peersSnapshot()` for currently discoverable peers. Configuration accepts an optional display name (default: the operating-system host name) and an optional listener port (default: OS-assigned). Deleting `$DSH_HOME/lan-handoff/identity.json` remints the identity, and every peer that recorded the previous key must re-pair — the same lifetime contract as the anonymous user id file.
