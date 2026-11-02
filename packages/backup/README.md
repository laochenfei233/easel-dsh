---
description: "Package map for Easel remote backup: the engine behind the Easel settings page's backup section."
kind: "package-group"
---

# backup/ — Easel remote backup

English | [中文](README.zh.md)

## Summary

The `backup/` group holds the engine the Easel desktop app uses to back up and restore its data root over user-owned WebDAV, SMB, and S3 destinations. It owns no state: the host plugin `dsh-plugin-easel/backup` owns settings, credentials, routes, and scheduling, and delegates the archive, encryption, transfer, and restore work to the packages here.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role |
|---|---|
| [`easel-backup/`](easel-backup/README.md) | Grouped zip archives over WebDAV/SMB/S3 with optional passphrase encryption, retention pruning, and verified restore |

-----

<a id="related-documentation"></a>
## Related documentation

- [Root package map](../README.md) — where `backup/` sits among all package groups.
- [Feature spec](../../docs/compose/specs/easel-settings-backup.md) — the scope table, remote layout, and design decisions.

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The desktop runtime resolves the group's packages through the CLI deploy closure (`apps/cli/package.json` carries the `workspace:*` dependency), not through a cordis service; the host plugin imports the engine lazily and reports a missing engine as one actionable error.

</details>
