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

### S2.3 部署闭包

审查发现 `apps/cli` 的 manifest 在同步上游时丢掉了 `@easel-dsh/easel-air-transfer`（`df6d262ff7` 引入、后被上游同步覆盖），因此从当前 master 出的包根本不带隔空传送插件；peer-only 拷贝兜底也救不了不在闭包里的包。修复：把 `@easel-dsh/easel-air-transfer` 与 `@deepseek-ai/dsh-session-log-import` 重新/新增到 `apps/cli` 的 `dependencies`，同步 `pnpm-lock.yaml`。部署闭包是 loader 行能解析的前提，缺包时 app-boot 只对非 required 行告警，不会响亮失败——所以必须在打包前用闭包断言守住这一段（本轮用 manifest + lockfile 证据）。

### S2.4 目录产物

新增 `apply` 让该包从 library 变成可加载插件，`docs/config-catalog.{md,zh.md}` 与 `cordis-composition-reference/references/packages.md` 需要重新生成（`gen-config-catalog` / `gen-plugin-packages`），否则 `doc-sync` 红门。

## [S3] Scope

- In scope: importer 包的 `apply`/`inject` 入口与其单测、Easel 壳的 profile 行与 Rust 测试断言、部署闭包的 manifest/lockfile、生成目录产物、README 双语说明。
- Out of scope: 发送端关闭含义的措辞修正（把「对方拒绝配对」改成传输层断开，另立）；Mac 端取证工具。

## Tasks

- [x] T1: `session-log-import` 增加 `apply` 函数插件入口与模块级 `inject`（depends: none）
- [x] T2: 单测：模块命名空间经 `ctx.plugin` 提供 `ctx.sessionLogImporter`，dispose 后卸载（depends: T1）
- [x] T3: 壳 patch 插入 `easel-session-log-import` 行，Rust 测试断言该行（depends: none）
- [x] T4: `apps/cli` 依赖补回 `@easel-dsh/easel-air-transfer` 并新增 importer，更新 lockfile（depends: none）
- [x] T5: 重新生成 config catalog 与 plugin packages 目录产物（depends: T1）
- [x] T6: 包 README 双语说明 loader 行入口并重录 i18n（depends: T1）

## [S4] Acceptance

- [x] `ctx.plugin(<模块命名空间>)` 后 `ctx.get('sessionLogImporter')` 是 `SessionLogImporter` 实例，fiber dispose 后消失（单测）
- [x] 壳生成的 `cordis.patch.yml` 含 `easel-session-log-import` 行（cargo test）
- [x] `apps/cli` 的部署闭包声明两个包（manifest + lockfile diff）
- [x] importer 包 100% 覆盖率、全仓 typecheck、两个目录产物校验保持绿
