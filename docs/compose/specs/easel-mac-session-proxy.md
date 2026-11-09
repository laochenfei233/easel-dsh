---
feature: easel-mac-session-proxy
status: delivered
updated: 2026-11-09
branch: fix/easel-mac-session
commits: fix/easel-mac-session（1 次提交，未推送）
---

# macOS 应用窗口会话代理恢复

## Report

**What was built** — 恢复 `apps/desktop-tauri/src-tauri/src/proxy.rs`（loopback 会话代理）：交换得到的 dsh 会话被注入每个代理请求与 WebSocket 握手的 `Cookie`，`Host`/`Origin`/`Referer` 改写到真实上游；app 窗口加载 `http://127.0.0.1:<代理端口>/`，服务重启只更新 session、窗口不跳转。同时恢复 `Info.plist` 的 `NSAllowsLocalNetworking`、`mod proxy`、`tokio` 的 `net` feature，并保留窗口创建的 oneshot 串行化。

**Verification** — `cargo check` 通过；`cargo test` 54 通过、1 失败（`plain_config_rows_convert_keeping_project_root`，只在 Windows 成立的路径断言，`src/setup.rs` 未改动，PRE-EXISTING）。装到 `/Applications` 后实机验证：直连 `127.0.0.1:3081/` 无 cookie 返回 401；经代理 `127.0.0.1:<port>/` 返回 200 与 43 KB UI；`/easel/api/backup/config` 返回 `engineReady: true`；`/easel/api/handoff/status` 返回 `available: true`；启动日志出现 `app proxy listening` 与 `app window ... (proxy <port> -> 3081)`。

**Journey log** — ①「mac session rework」用预装 `SameSite=Lax` cookie 替换代理，实机 cookie store 始终为空（`cookie store for app origin: []`），app 窗口只显示 `dsh web authentication required`；②恢复代理时把重写用的 proxy origin 从 `localhost` 改成 `127.0.0.1`，与窗口 origin 及 `app-window` capability 的 `http://127.0.0.1:*` 保持一致，也避开 `localhost` 解析到 ::1 的风险；③代理只在 127.0.0.1 监听，本机同用户进程可借它访问已认证 API，与原出货设计一致。

## [S1] Problem

macOS 桌面版的 app 窗口停在 `dsh web authentication required; reopen the URL printed by dsh web.`。`open_app_window` 预装 cookie 后加载 clean URL，但 WKWebView 的 cookie store 对该 origin 为空（启动日志实测），窗口请求因此没有会话。

## [S2] Design

### S2.1 恢复 loopback 代理

「mac session rework」这次提交删除的 `proxy.rs` 是此前实机验证可用的方案：WKWebView 存不住/不发会话 cookie，于是窗口改由 shell 自己的代理转发——代理为每个请求补上交换来的会话，并重写 `Host`/`Origin`/`Referer`；非 upgrade 请求加 `Connection: close`，WebSocket upgrade 转为双向管道。代理端口在 app 生命周期内固定，服务换端口只更新 session。

### S2.2 与既有改动对齐

- 代理与窗口都用 `127.0.0.1`（不用 `localhost`）：窗口 origin 与 `capabilities/app-window.json` 的 `http://127.0.0.1:*` 一致。
- 恢复 `Info.plist` 的 `NSAppTransportSecurity → NSAllowsLocalNetworking`。
- `tokio` 增加 `net` feature；`append_startup_log` 提升为 `pub(crate)`。
- 移除 cookie 预装、`AUTH_RETRY_SCRIPT` 与 `log_cookie_store`，cookie 导入改为 Windows-only。

## [S3] Scope

- In scope：`apps/desktop-tauri/src-tauri/{src/proxy.rs,src/dsh_runner.rs,src/lib.rs,Cargo.toml,Info.plist}`。
- Out of scope：Windows 的 iframe + cookie 流程；签名/公证；代理的鉴权增强（仍只监听 127.0.0.1）。

## Tasks

- [x] T1: 恢复 `proxy.rs` 与 `Info.plist`（depends: none）
- [x] T2: `open_app_window` 改为代理路径并移除 cookie 预装（depends: T1）
- [x] T3: `cargo check`/`cargo test` 与本机安装实测（depends: T2）

## [S4] Acceptance

- [x] `cargo check` 通过，proxy 单测随 `cargo test` 通过（54/55，另一条为基线 Windows-only 断言）
- [x] 实机：直连 401、经代理 200；备份 `engineReady: true`；隔空传送 `available: true`
- [x] app 窗口 origin 与 `app-window` capability 匹配；代理端口固定、服务重启不换窗口 origin
