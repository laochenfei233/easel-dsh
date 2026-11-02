---
description: "Remote backup for the Easel data root: grouped zip archives over WebDAV, SMB, or S3, with optional passphrase encryption, retention pruning, and verified restore."
kind: "package-reference"
---

# @deepseek-ai/dsh-easel-backup

English | [中文](README.zh.md)

## Summary

Use this package to back up the Easel data root as grouped zip archives and restore them. The Easel host plugin (`dsh-plugin-easel/backup`) owns settings, credentials, routes, and scheduling; this package owns the engine work — collection, archiving, optional encryption, upload, pruning, and verified restore — as pure functions over an injected destination seam. It mounts nothing and holds no state.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Use this package

<a id="use-this-package"></a>

Backups are grouped: `config` (profile patches, credentials, personas, skills, state stores), `sessions` (session logs and durable attachments), and `workspace` (projects and the full outputs tree). Each group archives as one independent zip under `easel-backup/<group>/<stamp>.zip` and keeps the newest `retention` archives.

| You are writing | Use |
|---|---|
| A destination for one protocol | `createDestination(config, secrets)` — `smb` (filesystem root), `webdav`, or `s3` |
| One group backup | `runBackupGroup(options)` — collect, archive, encrypt, upload, prune |
| A listing of archives | `listBackups(destination, remoteDir)` |
| A restore | `planRestore(options)` then `applyRestore(plan)`; `discardRestore(plan)` to drop it |
| A catch-up decision | `computeDue(schedule, lastRunAt, now)` |

```ts
import { createDestination, listBackups, planRestore, applyRestore, runBackupGroup } from '@deepseek-ai/dsh-easel-backup'

const destination = createDestination(
  { protocol: 'webdav', endpoint: 'https://dav.example.com/dav', username: 'me', remoteDir: 'sites' },
  { protocol: 'webdav', password: '…' },
)

const result = await runBackupGroup({
  destination,
  roots: { home: '/data-root/home', workspace: '/data-root/workspace' },
  group: 'config',
  remoteDir: 'sites',
  retention: 10,
  encryption: { enabled: false },
  stagingDir: '/data-root/home/cache/backup-staging',
})
```

`runBackupGroup` stages the archive locally (`stagingDir`), uploads with explicit `Content-Length`, deletes the remote object when an upload fails, and removes the staging file no matter how the run ends. `planRestore` downloads, decrypts, CRC-checks, and maps every entry onto the current data root without touching live files; `applyRestore` overwrites atomically per file.

## Understand the implementation

<a id="understand-the-implementation"></a>

<a id="design-philosophy"></a>
### Design philosophy

Every byte crosses one seam: a destination answers `probe`/`put`/`get`/`list`/`del`, and everything else is pure computation over it. That is what makes a mock destination the whole test surface for the engine and a new protocol a single file.

<a id="source-map"></a>
### Source map

- `src/collections.ts` — per-group walkers; junctions, symlinks, `node_modules`, caches, and temp files are never collected.
- `src/archive.ts` — streaming zip via `fflate`; media stores verbatim, text deflates; extraction enforces manifest counts and rejects unsafe paths.
- `src/crypto.ts` — optional passphrase container: scrypt key derivation plus chunked AES-256-GCM, each block AAD-bound to the magic and its index.
- `src/destinations/` — one implementation per protocol; uploads stream from staging files with explicit `Content-Length` through node's own request path.
- `src/engine.ts`, `src/restore.ts`, `src/schedule.ts` — run, verify, and catch-up math over the injected seams.

## Further Exploration

<a id="further-exploration"></a>

- [docs/compose/specs/easel-settings-backup.md](../../../docs/compose/specs/easel-settings-backup.md) — the feature spec: scope table, remote layout, and design decisions.
- `packages/session-query/session-log-export` — the house streaming-zip precedent this package reuses (`fflate`).

## Model Experience

None, as infrastructure only: backups are user-initiated through the Easel settings page and register no tool, prompt, or model-visible text.

#### KV Cache effect

No direct invalidation: the package contributes no request tokens and never mutates a request prefix, so provider cache reuse is unaffected.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when the package is a poor fit. They are current package constraints.

- **Full archives, not incremental mirrors** — every run re-uploads each enabled group in full. Incremental upload needs per-protocol listings plus a diff engine and is deferred; retention pruning bounds the remote footprint.
- **WebDAV speaks Basic auth only** — digest-only servers are out of scope; most NAS gateways and cloud drives accept Basic over TLS.
- **SMB rides the OS stack** — the destination is a UNC, mapped-drive, or mounted path that must already be reachable; there is no SMB protocol implementation and no macOS credential wiring (`net use` is Windows-only, in the host plugin).
- **S3 listings use a tolerant XML scan** — single-valued fields per `<Contents>` block; servers that answer exotic shapes may need the real parser.
- **Restore is whole-archive** — a plan overwrites every file the archive contains; there is no per-file picking.

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The desktop runtime resolves this package through the `home/node_modules` junction into the CLI deploy closure (`apps/cli/package.json` carries the `workspace:*` dependency). A missing engine surfaces as one actionable API error from the host plugin, never as a broken settings page. Coverage runs on the Linux lane; the POSIX-only cleanup-failure tests are skipped on Windows by design.

</details>
