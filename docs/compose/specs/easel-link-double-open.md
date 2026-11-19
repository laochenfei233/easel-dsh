---
feature: easel-link-double-open
status: in-progress
updated: 2026-11-20
branch: feat/easel-link-double-open
commits: a81a340d75..pending
---

# External link opens once

## Report

## [S1] Problem

Clicking a chat markdown link in the desktop shell opens the target page twice
in the system browser. The bundle-injected host bridge
(`apps/desktop-tauri/scripts/bundle-runtime.mjs` → `injectNotificationBridge`)
has two relay paths that both fire for one click: the capture-phase anchor
listener opens anchors carrying `target="_blank"`, and the `window.open`
override relays the app's own `window.open` call. Markdown anchors carry
`target="_blank"` and their React `onClick` calls `openExternalLink` →
`window.open` (`ui-chat/apply.ts:283-289`), so one click posts the
`dsh-desktop-host` open message twice and the shell invokes the opener plugin
twice. Both paths cancel the default navigation, which is why the Rust
`on_new_window` handler (and its `new-window.log`) never sees these clicks.

## [S2] Design

- The capture listener no longer relays synchronously: it records the URL in a
  `pendingOpen` slot and relays it on a zero-delay task, so a plain anchor that
  nothing else handles still opens. The `window.open` override relays
  synchronously and empties the slot first, so a click that reaches the bridge
  through both paths relays exactly once.
- The slot must be cleared by the override, not by a timer-bound flag: a
  microtask checkpoint runs between listeners inside one dispatch (capture
  listener returns before the app's delegated onClick), so any
  microtask-scheduled clear happens before the app's `window.open`. The
  zero-delay task is immune to that; anything still pending after the dispatch
  settles is by definition an unhandled plain link.
- Out of scope: the `linkOpening: 'sidebar'` default where the system tab and
  the in-app sidebar both show the page (two surfaces, one relay each) — the
  sibling session (prism-agent) is resolving that behavior separately.

## Tasks

- [x] T1: behavioral regression test for the injected bridge (depends: none)
- [x] T2: dedup the double relay in the bridge (depends: T1)

## [S4] Acceptance

- [ ] One markdown click (capture path + `window.open` in the same dispatch,
      with the between-listener microtask checkpoint drained) produces exactly
      one `open` relay; `preventDefault` still applies.
- [ ] A plain external anchor nothing else handles relays once the dispatch
      settles; `window.open` after the dispatch settles still relays; internal
      (same-origin, non-`_blank`) anchors never enter the slot.
- [ ] The relay cases live in the existing `scripts/desktop-host-bridge.spec.ts`
      lane and pass; oxlint clean on the touched files.

## Journey log

- Root cause imported from the sibling investigation (sess_ee91a5f7,
  prism-agent): their `new-window.log` absence proved the Rust
  `on_new_window` path never fires for these clicks, pinning the JS bridge.
- Workspace override as in easel-file-drop: main checkout on a stacked feature
  branch (base = feat/easel-file-drop tip a81a340d75) so both fixes ride one
  repack.
- Review falsified the first design (an `anchorClickOpened` flag cleared by
  `queueMicrotask`): the clear runs at the microtask checkpoint between the
  capture listener and the app's delegated onClick, so the double open
  persisted — reproduced end-to-end with the real bridge code in a real
  engine. Pivoted to the deferred-relay slot above; the regression test now
  drains microtasks between the capture listener and the app's open to
  reproduce that checkpoint in the vm lane.
