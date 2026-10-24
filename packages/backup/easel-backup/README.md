# @deepseek-ai/dsh-easel-backup

## Summary

Remote backup engine for Easel: it turns the Easel data root into grouped zip
archives, uploads them to a WebDAV, SMB, or S3 destination, and restores them
back. The package owns no state and no configuration; the Easel host plugin
(`dsh-plugin-easel`) owns settings, credentials, routes, and scheduling, and
calls this package for the engine work.

## Use this package

```ts
import { createDestination, listBackups, runBackupGroup, planRestore, applyRestore } from '@deepseek-ai/dsh-easel-backup'

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
  onProgress: progress => console.log(progress.phase),
})

const backups = await listBackups(destination, 'sites')
const plan = await planRestore({ destination, remoteDir: 'sites', roots, group: 'config', stamp: backups[0].stamp, stagingDir })
await applyRestore(plan)
```

Backups are grouped: `config` (profile patches, credentials, personas, skills,
state stores), `sessions` (session logs and durable attachments), and
`workspace` (projects and the full outputs tree). Each group archives as one
independent zip named `<group>/<stamp>.zip` under `easel-backup/`, keeps the
newest `retention` archives per group, and restores through a verified plan:
download, decrypt, CRC-check, map onto the current data root, then atomically
overwrite per file.

## Understand the implementation

- `src/collections.ts` — walks the data root per group; junctions, symlinks,
  `node_modules`, caches, and temp files are never collected.
- `src/archive.ts` — streaming zip via `fflate`; media stores verbatim, text
  deflates; extraction enforces manifest counts and rejects unsafe paths.
- `src/crypto.ts` — optional passphrase container: scrypt key derivation and
  chunked AES-256-GCM, each block bound to the magic and its index.
- `src/destinations/` — one seam per protocol; uploads stream from staging
  files with explicit `Content-Length` through node's own request path.
- `src/engine.ts` / `src/restore.ts` / `src/schedule.ts` — run, verify, and
  catch-up math as pure functions over injected seams.

## Known limitations and deferred work

Backups are full archives, not incremental mirrors; WebDAV speaks Basic auth
only; SMB rides the OS stack (a reachable UNC or mount), not a protocol
implementation; S3 listings use a tolerant XML scan.
