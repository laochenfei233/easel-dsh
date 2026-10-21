---
feature: easel-dsh-rc2-sync
status: delivered
updated: 2026-10-21
branch: feat/easel-upgrade-layout（deepseek-harness 工作树）
commits: b96b76b055..f5fab30f46
---

# Easel dsh rc.2 同步

## Report

**What was built** — Easel 发货分支的 dsh 内核从 `0.2.1-alpha.2` 升到
`0.2.1-rc.2`，一次跨过 alpha.3、alpha.4、alpha.5、rc.1、rc.2 五个上游发布
（992 个提交、3701 个文件）。合并保留了三处 Easel 分歧的语义：

- **workspace 成员判定**：上游把 `sessionPath` 改成 `candidateMatches`，并新增
  “目录缺失时保留会话归属”。Easel 的 `canonicalPath` 原样保留，实体和诊断都改为
  `candidateMatches(id, canonicalPath)`，于是 junction 规范化与缺失目录保留同时
  生效。
- **profile 解析**：同时保留上游的 `realSpellings`（JS + native realpath）和
  Easel 的 carrier `realModuleDirectory` 前缀规范化，补回 `realpathSync` import。
- **SDK 会话恢复**：上游的显式 `resume` 分支与 Easel 的 “create 报 already exists
  时自动 resume” 回退合并为同一实现。
- 其余为 import 并集、`dsh`→`easel` 的 help 快照、以及两处测试 fixture。

**Verification** — `pnpm run typecheck` 5/5；`pnpm run build` 9/9；目标 vitest
40 文件 / 6263 passed / 2 skipped（workspace、workspace-controller、app-boot、
sdk/server、ui-workspace）；`dsh-plugin-easel` node 测试 92/92；desktop-tauri
`cargo test` 21/21；`bundle:runtime` 与 `tauri build` 均 exit 0。运行时载荷为
dsh `0.2.1-rc.2` + Easel 插件 `0.2.16`，新增 `web-deepseek-api`、
`ui-deepseek-model-label-1017` 等包，`canonicalWorkspacePaths`、
`missingSessionPaths`、`realSpellings`、`uiSidebarPanels` 均进入部署闭包。

**Canary** — 用 alpha.24 载荷换入已安装的 `app\`（保留旧卸载器）跑真实数据：
`/easel/api/status` 返回 `data\workspace`、116 个技能；侧栏“普法小剧场”工作区
展开出既有会话；EP01–03 媒体卡片正常渲染；右侧 `发布文案.md` 从
`data\workspace\projects\...` 正常预览；无插件市场入口；`_ideas.json` SHA256
仍为 `C138466E…B395`。验证后已恢复 alpha.23 载荷与注册表版本，应用重新运行。
截图在 `gui-test-screenshots/canary-alpha24.png`、`canary-media.png`。

**Journey log**

- 直接对 `master` 做 dry-run 合并只报了 8 个冲突文件/9 处冲突，但真正的风险是
  8 处里有 3 处落在 Easel 自己修过的语义上；按“取上游、丢 Easel”解会把
  alpha.23 修好的 junction 归组问题原样带回来。
- alpha.4 之后全局 slot props 新增了 `useRemoteAccess`、`useSessionAccess` 等
  必填 hook，分支自有的 `SchedulesSettingsSection` 测试 fixture 需要补齐；这类
  只在分支存在的测试不会出现在上游冲突里，只能靠 typecheck 发现。
- 官方安装器仍需管理员权限，本次 canary 用同载荷换入 `app\` 验证；alpha.24
  安装包已生成，提权安装的 E2E 仍留作手工步骤。

## [S1] Problem

Easel 的 dsh 内核停在 alpha.2，而上游已到 rc.2。发货分支与上游 master 的
merge base 是 `65359876b9`，落后 992 个提交；直接合并会跨过 vendor 升级、
workspace registry 重构、SDK 显式 resume、模型标签、账号通知、Web 搜索 API
直连等一批变化。需要在不破坏 Easel 的 junction 规范路径、单工作区门控、
插件市场退役和安装布局的前提下完成同步。

## [S2] Design

- 在独立的 `sync/easel-rc2` 工作树合并 `master`，解决冲突后再快进发货分支，
  避免在发货分支上直接暴露冲突状态。
- workspace：保留 Easel 的 `canonicalPath` 和 `canonicalWorkspacePaths`，把上游
  `candidateMatches` 的接口与“缺失目录保留”语义接在规范路径上；诊断同样使用
  规范路径，避免 junction 场景误报。
- resolver：上游 `realSpellings` 与 Easel carrier 规范化并存，前者服务 native
  realpath 双拼写，后者服务打包运行时的一次调用/目录。
- SDK：显式 `resume` 走上游分支，未显式 resume 时保留 “already exists” 回退。
- UI/shell：`uiSidebarPanels`、单工作区门控、安装器钩子、app/data 迁移均保持
  不动；新增上游 UI 面按默认配置出现，插件市场保持禁用。

## [S3] Scope

- In scope: 上游 alpha.3–rc.2 合并、冲突语义合并、类型/构建/测试、运行时与
  canary 安装包、真实数据 canary 验证。
- Out of scope: 提权安装器 E2E、全新 VM 安装、上游 rc.2 之后的新提交、模型
  provider 的凭据迁移（只记录行为变化）。

## Tasks

- [x] T1: 创建 sync 工作树并合并 master（depends: none）
- [x] T2: 合并 workspace 规范化路径与 `candidateMatches`（depends: T1）
- [x] T3: 合并 resolver `realSpellings` 与 SDK resume（depends: T1）
- [x] T4: 合并 import/help/测试冲突并修复全局 slot props（depends: T1）
- [x] T5: 快进发货分支、安装依赖、typecheck/build/tests（depends: T2,T3,T4）
- [x] T6: 重建 runtime 与 alpha.24 canary 安装包（depends: T5）
- [x] T7: 真实数据 canary 验证并恢复 alpha.23（depends: T6）

## [S4] Acceptance

- [x] `pnpm run typecheck` 5/5、`pnpm run build` 9/9。
- [x] workspace/workspace-controller/app-boot/sdk/ui-workspace 目标测试通过。
- [x] `dsh-plugin-easel` 92/92、desktop-tauri `cargo test` 21/21。
- [x] 运行时 dsh 为 `0.2.1-rc.2`，Easel 插件为 `0.2.16`，合并后的修复都在
      部署闭包中。
- [x] 真实数据 canary：工作区分组、媒体卡片、Markdown 预览、技能数、
      `_ideas.json` 校验和均正常。
- [x] 验证后恢复 alpha.23 载荷与注册表版本，应用重新运行。
- [x] alpha.24 安装包生成：
      `apps/desktop-tauri/src-tauri/target/release/bundle/nsis/Easel-dsh_0.2.1-alpha.24_x64-setup.exe`。
- [ ] 提权运行 alpha.24 安装包的官方安装 E2E（手工步骤，需 UAC）。
