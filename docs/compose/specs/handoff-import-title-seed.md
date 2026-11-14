---
feature: handoff-import-title-seed
status: delivered
updated: 2026-11-12
branch: feat/handoff-import-title-seed
commits: 1f2ec9f3af..049d3dcf99
---

# Handoff Import Title Seed

## Report

**What was built** — `SessionLogImporter` now folds every materialized session (root and seeded descendants) once into the listing projection cache right after the log is closed, using the cache's existing `coldSnapshot` path with the stored header, the stored events, and the stored inherited cut. A received handoff therefore lists each imported conversation under its recorded title instead of 「未命名」. The cache is optional and the seed is fail-soft: a fold or checkpoint-write failure only logs a warning, and the imported log stays authoritative.

**Verification** — `vitest run packages/session-query/session-log-import/tests` 29/33 pass with 4 pre-existing macOS-only failures (Windows absolute `targetCwd` values; identical on the pristine baseline). `pnpm run typecheck` 5/5 gates pass. `run-oxlint` on the package: 0 warnings, 0 errors. `pnpm run build` (artifacts + check) 10/10 gates pass; `build:check` again after the version bump 2/2. `verify-version-sync`: 378 manifests carry 0.2.1-rc1.

**Journey log** — The type-only cache import needs a tsconfig project reference; without it tsc pulls the cache's sources into the importer's `rootDir` and fails TS6059/TS6307. The first `tsc -b` run emitted stray `.js`/`.d.ts` files into several `src/` directories; they were deleted before committing. `verify-md-wrap` requires one physical line per paragraph, so the spec was unwrapped, and `verify-translation-pairing --write` re-recorded the README pair after the bilingual edit. Review flagged the cache peer as effectively required; `peerDependenciesMeta.optional` now marks it like the other consumers of this optional service.

## [S1] Problem

A received handoff imports every conversation, but the session list shows all of them as 「未命名」(untitled). The import writes session logs and attachments only; the persisted projection cache (`ctx.sessionProjectionCache`, the `storages/session_projcache` domain) is never populated. `ApiSessionList.summarizeCold` serves cold rows from that cache alone, so a freshly imported row has no `title` projection and the sidebar localizes the empty title as untitled — until the user opens the session, which folds the log and writes the checkpoint.

The titles are already in the imported logs (`session/title` events), so the data is present and only the derived listing row is missing.

## [S2] Design

### S2.1 Seed the cache at import

After a session log is materialized and closed, `SessionLogImporter` calls the mounted `sessionProjectionCache.coldSnapshot(storedHeader, inheritedEventCount, storedEvents)`. That API already folds a complete log, seeds any identity-matching cached rows, and fire-and-forgets the refreshed checkpoint, so the next listing read serves `title` and `sessionListMetadata` without an open. Root and seeded descendants are both seeded, each with the header and events actually written (after path remapping), so the cache identity matches the stored lifecycle.

The cache is optional: the importer reads it through `ctx.get`, so a profile without the cache (headless, CLI) keeps importing exactly as before.

### S2.2 Seeding never fails the import

The projection cache is derived data; the imported log stays authoritative. A folding or cache-write failure is logged and the import still succeeds — the session remains readable and its title returns the first time it is opened. Import stays fail-loud for log, attachment, and persistence failures.

### S2.3 No listing or persistence change

The session list keeps its zero-I/O contract (cold rows still read the cache only), and no new session-format or persistence generation is introduced.

## [S3] Scope

- In scope: `packages/session-query/session-log-import` seeding on import; its package deps, README, and tests.
- Out of scope: backfilling caches for sessions imported before this change (opening such a session still writes its row); changing the session-list read path; transferring projection caches between devices.

## Tasks

- [x] T1: Seed the projection cache after materializing each imported session and descendant, fail-soft, when the cache is mounted (depends: none, covers: S2.1, S2.2)
- [x] T2: Declare the optional cache dependency and update the package READMEs (depends: T1, covers: S2.1)
- [x] T3: Tests: root and descendant seeds carry the stored header/events; a throwing cache leaves the import successful (depends: T1, covers: S2.1, S2.2)
- [x] T4: Verify focused tests, typecheck, lint, and build:check (depends: T3)

## [S4] Acceptance

- [x] An imported session's stored projection-checkpoint identity matches its stored header, so a cold listing read returns its recorded title.
- [x] Seeded descendants are seeded with their own header and inherited cut.
- [x] A projection-cache failure does not fail the import or lose the session.
- [x] The importer still works with no projection cache mounted.
