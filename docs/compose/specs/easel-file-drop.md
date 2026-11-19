---
feature: easel-file-drop
status: delivered
updated: 2026-11-20
branch: feat/easel-file-drop
commits: d7ac94184f..a81a340d75
---

# Desktop file drag-and-drop

## Report

**What was built** — Dragging files and folders into the Easel desktop
(Tauri/WebView2 shell) works end to end. The shell disables Tauri's native
drag-drop handler on both window builders (`build_main_window`, the WebKit app
window), which is the documented requirement for HTML5 drag-and-drop on
Windows; without it WebView2 delivered no `dragover`/`drop` to the page at
all. The Windows shell page and the first-run wizard cancel stray drops so a
file dropped on the splash/error surfaces cannot navigate those documents to
the dropped file. The composer now resolves the harness-host path from the
WebView2 nonstandard `File.path` when the Electron preload bridge
(`__DSH_HOST_PATHS__`) is absent — dropped or picked folders with a path
become `@"path/"` folder chips, non-image files with a path become `@path`
references, images keep uploading, and both prior refusal messages stay in
place for their original cases. The composer file-drop contract sentences in
the package README describe both path sources, EN/ZH paired, with the
translation-pairing record re-recorded.

**Verification** — `apply-inject.client.spec.tsx` 31/31 including the new
regression test (confirmed red with the desktop-only refusal before the fix);
`input-bar` + `ui-attachment` 196/196; `pnpm run typecheck` 5 gates PASS;
`cargo check` and `cargo test` in `apps/desktop-tauri/src-tauri` PASS;
`pnpm verify-translation-pairing` on the pair PASS; `doc-sync` failed-gate set
identical to a master baseline run (15 pre-existing failures, zero new).

**Journey log**

- The referenced prior attempt (client-only `fileHostPath` redo on a sibling
  clone) would have left the user's complaint intact: with Tauri's native
  handler active, WebView2 delivers no HTML5 drop events at all, so the client
  fix is unreachable. The shell switch is the missing layer, verified against
  Tauri's documented behavior and the official docs wording.
- Workspace override: implementation runs in the main checkout on a feature
  branch instead of a `.worktrees/` worktree — a junctioned `node_modules`
  there poisons the main checkout when any `pnpm` command runs (known repo
  hazard), and the main checkout gives a full-fidelity verification
  environment.
- Review passed all three conclusions (SHIP) and caught one real gap in this
  change: the first-run wizard shares the main window whose native handler is
  now disabled, so it needed the same stray-drop guard — added in a81a340d75.

## [S1] Problem

In the shipped Easel desktop (Tauri/WebView2), dragging a file or folder onto the
window does nothing: the Tauri shell installs its native drag-drop handler
(`dragDropEnabled` defaults to true), which on Windows replaces WebView2's own
handler, so the page never receives HTML5 `dragover`/`drop`. Even where events
flow, folder chips resolve paths only through the `__DSH_HOST_PATHS__` bridge,
which only the (unshipped) Electron preload installs; WebView2's nonstandard
`File.path` on dropped files goes unread, so a folder drop inside the desktop app
is refused with the browser-facing "desktop only" message.

## [S2] Design

### S2.1 Shell: let HTML5 drag-and-drop reach the page

- `build_main_window` (lib.rs) and the WebKit app window builder (dsh_runner.rs)
  call `disable_drag_drop_handler()`. Nothing in the shell listens to Tauri
  `DragDropEvent`s, so nothing is lost; this is the documented requirement for
  HTML5 drag-and-drop on Windows and restores the same behavior in WKWebView.
- The Windows shell page (ui/dist/app.js) cancels document-level `dragover` and
  `drop`: the splash overlay and any shell chrome sit outside the iframe, and a
  canceled drop prevents WebView2 from navigating the shell page to the dropped
  file. The dsh UI document already cancels its own drop events.

### S2.2 Client: accept files that carry their own host path

- `ui-conversation/apply.ts` reads the nonstandard `File.path` (WebView2) as the
  fallback host path after the `__DSH_HOST_PATHS__` bridge: an explicit
  `bridge?.pathFor(file) ?? fileHostPath(file)` precedes the folder rejection.
  A bridge answer of `''` stays authoritative (the bridge refuses first); the
  fallback only fills the gap where no bridge is installed. Desktop drops of
  folders become `@"path/"` folder chips, non-image files with a path become
  `@path` references, and images keep uploading as before.

## [S3] Scope

- In scope: the two Tauri window builders, the shell page drop guard,
  `ui-conversation/apply.ts` host-path fallback, its regression test, and the
  composer file-drop contract sentences in the package README (EN/ZH paired,
  `README.i18n.yaml` re-recorded).
- Out of scope: Electron preload bridge changes (upstream desktop), browser-side
  expansion upload for pathless folders (rejected there, as today), the file
  picker's directory selection, macOS folder chips (WKWebView exposes no
  `File.path`; files upload and folders keep the clear refusal), repackaging.

## Tasks

- [x] T1: shell disables the native drag-drop handler on both window builders (depends: none)
- [x] T2: shell page cancels stray dragover/drop (depends: T1)
- [x] T3: failing regression test, then the `fileHostPath` fallback in apply.ts (depends: none)
- [x] T4: README.md / README.zh.md contract sentences + i18n pairing record (depends: T3)
- [x] T5: first-run wizard stray-drop guard (review finding) (depends: T1)

## [S4] Acceptance

- [x] With no bridge installed, a `File` carrying `path` accepted as a directory
      becomes a `@"path/"` folder chip; a non-image file with `path` becomes an
      `@path` reference; without any path source the folder refusal stays.
- [x] apply-inject, input-bar, and ui-attachment client suites pass; typecheck
      passes; `cargo check` passes for the shell crate.
- [x] The README contract describes both path sources and reads identically in
      EN and ZH; doc-sync gates show no new failures against the master baseline.
