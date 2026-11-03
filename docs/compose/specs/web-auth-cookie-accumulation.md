---
feature: web-auth-cookie-accumulation
status: in-progress
updated: 2026-11-03
branch: fix/web-auth-cookie-accumulation
commits: 27bfb73504..HEAD
---

# Web Authentication Cookie Accumulation

## Report

## [S1] Problem

The Desktop app fails to start after enough restarts with `desktop welcome: Web authentication failed`, and the dialog only suggests reinstalling or disabling plugins. Reported evidence: `%APPDATA%\@deepseek-ai\dsh-desktop\Network\Cookies` holds one auth cookie per launch, the request header crosses Node's 16384-byte limit at about 70 cookies, the Host answers 431, and the welcome flow reads any non-OK exchange as an authentication failure.

Root cause chain, all confirmed in this tree:

- `apps/desktop-host/src/index.ts:30` launches `dsh web` with `--port 0`, so each Desktop launch listens on a random loopback port.
- `packages/client/connection/src/browser-auth.ts:116` names the browser-session cookie from the request authority, which for plain HTTP is `host:port`.
- Cookie jars ignore the port: a cookie set from `127.0.0.1:51234` is also sent to `127.0.0.1:51235`. Because the name changes with the port, every launch leaves a new cookie in the same jar instead of replacing the previous one.
- Electron's `net.fetch` in the welcome flow uses `session.defaultSession`, whose cookie store is persisted under `userData/Network/Cookies`, so the jar survives restarts (`apps/desktop/src/main.ts:458`).
- The Host's `node:http` server keeps the default 16384-byte header limit and rejects the oversized Cookie header with 431 before routing; `welcome-backend.ts:51` turns that into `desktop welcome: Web authentication failed`.

## [S2] Design

### S2.1 Cookie name follows the cookie scope

The deterministic cookie name is `dsh-auth-` + base64url(HMAC-SHA256(secret, `<scheme>//<hostname>`)): the signing Home, the listener scheme, and the hostname without the port. Browsers partition cookies by scheme and host, never by port, so the name now lives in exactly the same scope as the cookie itself and a later launch on another port replaces the cookie instead of adding one.

Port binding moves entirely to the signed payload, which keeps `authority` at its current spelling (normalized origin for TLS, `host:port` for plain HTTP) and is still compared to the request authority on every request. A cookie minted on one port therefore does not authenticate on another; it is found by name and then rejected by the payload. The signing Home stays in the name so two Harness homes that share a loopback host do not replace each other's cookie.

### S2.2 Desktop purge at startup

Before the Host starts, the Desktop app deletes every `dsh-auth-*` cookie from `session.defaultSession` and then lets the launch-token exchange mint the single cookie for this launch. This is the migration for jars already polluted by earlier releases (their legacy names remain in the jar after the name change) and keeps the jar bounded if the scope formula ever changes again. The purge runs before `reconcileBackend()`; the welcome window has no Host cookie of its own, and the Node `fetch` exchange keeps its cookie in memory, so nothing in this launch needs the deleted values.

### S2.3 Out of scope

- The Tauri shell (`apps/desktop-tauri`) prefers the fixed port 3081 and scans at most 50 fallback ports, so one 30-day cookie lifetime can hold at most 51 cookies (about 11 KB) — below the 16 KB limit. It receives the S2.1 fix through the shared package but gets no purge.
- `dsh web` in an external browser keeps legacy cookies until they expire or the jar is cleared; S2.1 stops new growth, and the 401 body already tells the user to reopen the printed URL.
- The Host keeps Node's default header limit; authentication must not depend on raising a defensive limit.

## [S3] Scope

- In scope: the browser-session cookie name in `@deepseek-ai/dsh-client-connection`, the Desktop startup purge, their tests, and the connection package README pair.
- Out of scope: Tauri shell cookie-store surgery, `node:http` header-limit changes, cookie-jar migrations for external browsers.

## Tasks

- [ ] T1: Scope the cookie name to secret, scheme, and hostname; keep the payload authority check (covers: S2.1)
- [ ] T2: Add cookie-name regression tests for ports, hosts, schemes, and signing homes (depends: T1)
- [ ] T3: Purge `dsh-auth-*` cookies at Desktop startup with a unit test (covers: S2.2)
- [ ] T4: Update `packages/client/connection/README.md` and `README.zh.md` (depends: T1)
- [ ] T5: Run focused tests, typecheck/build check, and independent review (depends: T1, T2, T3, T4)

## [S4] Acceptance

- [ ] Two launches of one Home on different ports emit the same cookie name, and a cookie minted on one port does not authenticate on the other.
- [ ] Hosts, schemes, and signing homes still produce distinct cookie names.
- [ ] A polluted cookie jar is emptied of `dsh-auth-*` cookies before the Host starts, and unrelated cookies survive.
- [ ] `packages/client/connection` and Desktop unit tests pass; typecheck/build check passes on the exact tree.
- [ ] README pair states the current name scope and payload binding.
