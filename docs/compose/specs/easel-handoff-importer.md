---
feature: easel-handoff-importer
status: in-progress
updated: 2026-11-09
branch: fix/easel-handoff-importer（worktree）
commits: # filled at delivery
---

# 隔空传送：接收端缺失 sessionLogImporter 的挂载

## Report

## [S1] Problem

两台设备配对成功后发送项目必然失败：发送端报 `the other device declined the pairing`，Easel 界面显示「本地 API 错误」。

实机取证（2026-11-09）：

- 对 Mac 的监听端口发未知 intent 的 `hello`，得到 `reject{incompatible}` —— 监听、帧通道、拒绝帧都正常。
- 发 `intent: 'sync'` 的 `hello`，连接被直接关闭、没有任何帧。`notPaired` 分支会回 `reject` 帧，所以配对校验已通过；关闭来自 `routeConnection` 的异常兜底。
- `serveSync` 在读到 `offer` 之前只做两件事：`sessionServices()` 与 `importer === undefined` 检查。两者都要求 `ctx.sessionLogImporter`。
- 仓库里 **没有任何 bundle patch 或壳 patch 挂载** `@deepseek-ai/dsh-session-log-import`（22 个 bundle patch 全查过），该包也没有 `apply`/default 导出，无法作为 loader 行挂载。

结论：出货 profile 里 `ctx.sessionLogImporter` 不存在，接收端在同步握手后立刻抛错断连；发送端把这次断连误报成「对方拒绝配对」。双侧都受影响（Easel 发送可用、接收不可用）。

## [S2] Design

### S2.1 让服务可作为 loader 行挂载

`packages/session-query/session-log-import` 增加函数插件入口 `apply(ctx)`，内部 `ctx.plugin(SessionLogImporter)`。这与 `dsh-session-log-export` 的 `apply` 形态对称：loader 对没有 default 导出的模块直接使用模块命名空间作为插件对象，命名空间里有 `apply` 才会被当作函数插件。

### S2.2 挂载点：Easel 壳 patch

在 `apps/desktop-tauri/src-tauri/src/setup.rs` 的 `easel-lan-handoff` 行之后插入 `easel-session-log-import` 行（`name: '@deepseek-ai/dsh-session-log-import'`）。隔空传送是 Easel 专属能力，提供者与消费者在同一处挂载；不改通用 `web-app` bundle。壳每次启动都会用 `ensure_bundle_row` 重写 patch，已装用户升级壳后自动补上该行。

### S2.3 闭包与失败行为

runtime 闭包已包含该包：`bundle-runtime.mjs` 对 peer-only 包有单独拷贝兜底，`@easel-dsh/easel-air-transfer` 的 peerDependency 会把它带进部署闭包（当前装机 runtime 的 `node_modules` 里已有）。若某天包缺失，profiles 解析失败是响亮的启动错误，不会静默跳过。

## [S3] Scope

- In scope: importer 包的 `apply` 入口与其单测、Easel 壳的 profile 行与 Rust 测试断言。
- Out of scope: 发送端关闭含义的措辞修正（把「对方拒绝配对」改成传输层断开，另立）；Mac 端取证工具。

## Tasks

- [ ] T1: `session-log-import` 增加 `apply` 函数插件入口（depends: none）
- [ ] T2: 单测：`apply(ctx)` 在 persistence/attachments 就绪后提供 `ctx.sessionLogImporter`（depends: T1）
- [ ] T3: 壳 patch 插入 `easel-session-log-import` 行，Rust 测试断言该行（depends: none）

## [S4] Acceptance

- [ ] `ctx.plugin(apply)` 后 `ctx.get('sessionLogImporter')` 是 `SessionLogImporter` 实例（单测）
- [ ] 壳生成的 `cordis.patch.yml` 含 `easel-session-log-import` 行（cargo test）
- [ ] importer 包 100% 覆盖率与全仓 typecheck 保持绿
