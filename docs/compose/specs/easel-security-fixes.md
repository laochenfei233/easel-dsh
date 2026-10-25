---
feature: easel-security-fixes
status: delivered
updated: 2026-10-25
branch: feat/easel-mac-package
commits: uncommitted (base bec60b1414, dirty tree carries pending mac-package work)
---

# Easel Security Fixes (audit run-1)

## Report

**What was built** — `/easel/api/*`, `/easel/status` and `/easel/skills` now admit through the dsh
connection service (Host/Origin fence + live Peer). The five ASR skills keep working through a
per-process runner capability that opens only `POST /easel/api/asr` and is published atomically
(0600, dot-prefixed sidecar) in `outputs/_easel_api.json`. Both output read routes refuse host-owned
state by real path with case-insensitive matching, including atomic-write sidecars, while `_adapt/`,
the login QR and `_deconstruct/<id>/*` stay readable; generated HTML/SVG/XML is served under
`sandbox allow-scripts` plus `nosniff`. `video_fetch.mjs` parses every seed, decides the platform from
the parsed host with dot-bounded suffixes, keeps the cookie on platform hops only, confines platform
fetches to platform domains, and rejects non-public destinations (including IPv4-mapped literals) for
page-derived downloads. The shell drops data-root requests older than ten minutes and refuses
UNC/verbatim and shared system/temp roots; `bundle-runtime.mjs` pins Node, the Windows inspector and
both Dreamina CLIs in `runtime-inputs.json` and verifies skipped or reused trees instead of trusting
leftovers. The needs-validation leads are hardened server-side: trend links are reduced to http(s),
radar URLs require http(s) without credentials, batch ids are validated before joining a path, and a
proxied `web_fetch` hop resolves locally and refuses a non-public answer.

**Verification** — `node --test` in `easel/dsh-plugin-easel` 104/104; `video_fetch.test.mjs` 8/8;
`vitest packages/web/web-fetch-http` 72/72; `cargo test --offline` 40/40; `pnpm run typecheck` 5/5
gates; `pnpm run build` 9/9 gates; `bundle-runtime.mjs --only node|plugins|dreamina` verified the
existing staged runtime against the pins and rebuilt the Dreamina tree byte-identically from a
verified reuse source.

**Journey log** — 1. The first review caught a units bug the tests shared with the producer: the
route wrote `Date.now()` while the shell compared Unix seconds, so every request looked fresh. Fixed
on both sides and pinned by a millisecond-format test. 2. The review also caught the atomic-write
sidecar of the discovery file being readable through `/media` — a token leak introduced by the fix
itself; the sidecar is now dot-prefixed and the guard refuses dot segments and `.tmp` sidecars of
protected stores. 3. The Dreamina CDN serves one mutable `version.json` and edges disagreed on its
bytes, so its digest is advisory and the binaries carry the pin.

## [S1] Problem

`security-audit` run-1 (`~/.security-audit-skill/Easel/run-1`) reported five confirmed and five
needs-validation findings against `bec60b1414`. The three high findings share one root: `/easel/api/*`
is registered as a raw `webServer` prefix whose only gate is `sameOriginAllowed`, which admits any
request without an `Origin` header. That plane also serves `outputs/` bytes, including the stored XHS
cookie (`outputs/_deconstruct/cookies.json`) and the login/SMS state, and it feeds caller URLs to
`video_fetch.mjs`, which attaches that cookie based on a substring match on the raw URL text.

## [S2] Design

- **Admission**: `dsh-plugin-easel` requires the `connection` service and applies
  `connection.requestRejection(req)` to the whole prefix. Unauthenticated callers get 401; a
  cross-site or rebound caller gets 403. The five ASR skills call the API with `curl` and no cookie,
  so `apply` mints a 32-byte per-process runner capability, publishes it only in
  `outputs/_easel_api.json` (already private, already hidden from the content tree), and accepts it
  only for `POST /easel/api/asr`. Every other route stays cookie-only. `sameOriginAllowed` is deleted
  (superseded by the Host/Origin/sec-fetch-site fence inside `requestRejection`).
- **Read plane**: `safeOutputPath` gains an explicit protected-read set for host-owned state
  (`_deconstruct/cookies.json`, `_easel_api.json`, the ideas/schedule/radar stores, the delete-
  protected system directories). It does not reuse the blanket `_` rule: `_adapt/` and the login QR
  PNG are legitimate reads. `apiMedia` alone may read `_login/<platform>.png`.
- **video_fetch**: parse every seed with WHATWG URL, require http(s), refuse userinfo, decide the
  platform from the parsed hostname with dot-bounded suffixes, follow redirects manually with
  per-hop re-validation (cookie re-attached only on allowed hosts, platform hops confined to the
  platform's own domains), and apply a public-address check to page-derived downloads.
- **data-root**: the route is covered by admission; on the consumer side `read_pending_at` refuses a
  request older than 10 minutes (and any entry without `requestedAt`), and `validate_target_at`
  refuses UNC/verbatim paths and shared all-users-writable roots.
- **Runtime inputs**: a tracked `apps/desktop-tauri/runtime-inputs.json` pins the Node version per
  platform (sha256 from the nodejs.org release list), the inspector commit plus a deterministic tree
  hash, and the Dreamina/Canvas versions plus per-target binary and skill digests.
  `bundle-runtime.mjs` verifies each download and aborts on a missing or mismatching entry.
- **Needs-validation hardening** (defense in depth, no behavior change for the documented flows):
  `.html/.htm` media responses get `content-security-policy: sandbox allow-scripts`; trend item URLs
  are emitted only when http(s); radar `rawRequest` refuses non-http(s) and credentialed URLs;
  `readDeconstruct` accepts only a `[A-Za-z0-9_-]+` batch id; a proxied web-fetch hop resolves the
  name locally and refuses a non-public answer set before handing the URL to the proxy.

## [S3] Scope

- In scope: the ten audit records' source sites and their tests.
- Out of scope: the three audit-deferred units (plugin-market index, session-controller openers,
  `apiSkillDetail` traversal); moving credential state out of `outputs/` (a migration, tracked as
  follow-up); Rust-side runtime re-verification (same-user tampering only).

## Tasks

- [x] T1: admission gate + runner capability (depends: none)
- [x] T2: protected read set for output/media routes (depends: none)
- [x] T3: video_fetch destination and cookie scoping (depends: none)
- [x] T4: data-root pending freshness and target validation (depends: T1)
- [x] T5: runtime-inputs pinning (depends: none)
- [x] T6: NV hardening (CSP sandbox, trend URLs, radar URLs, batch id, proxied hop) (depends: T1)
- [x] T7: verification + independent review (depends: T1-T6)

## [S4] Acceptance

- [x] An Origin-less request without a cookie to `/easel/api/*` answers 401; a cross-site Origin
      answers 403; the runner token passes only on `POST /easel/api/asr` — the plugin delegates the
      fence to `connection.requestRejection`, and the fence semantics themselves are covered by
      `packages/client/connection/tests/node-half.host.spec.ts` plus the plugin's own verdict test
      (`api-admission.test.js`).
- [x] `GET output/_deconstruct/cookies.json` and `GET media/_deconstruct/cookies.json` answer 403,
      including upper-case and real-path spellings, while `media/_login/<p>.png`,
      `output/_deconstruct/<id>/report.md` and `_adapt/*.html` still answer 200
      (test `local-api.test.js`).
- [x] `video_fetch` routes `https://attacker.example?xiaohongshu.com` to `generic` and never sends
      the cookie there; `parseHttpUrl` refuses non-http(s) and userinfo; an IPv4-mapped IPv6 literal
      is refused (tests `video_fetch.test.mjs`).
- [x] `read_pending_at` discards a stale, untimestamped, or millisecond-stamped request;
      `validate_target_at` refuses UNC and `C:\Windows\Temp` (cargo unit tests in `layout.rs`), and
      the settings route writes seconds (`data-root.test.js`).
- [x] `bundle-runtime.mjs` aborts when a pinned digest is missing or mismatched, and verifies the
      skip/reuse paths (staged node stamp or `--version`, reused inspector tree, reused/skipped
      Dreamina binaries) instead of trusting leftover bytes.
- [x] Plugin suites (`node --test` 104 pass), `cargo test --offline layout::` (21 pass),
      `packages/web/web-fetch-http` vitest (72 pass), `pnpm run typecheck` (5/5 gates),
      `pnpm run build` (9/9 gates).
