---
feature: easel-single-workspace
status: delivered
updated: 2026-10-16
branch: feat/easel-frontend（dsh worktree，UI/模式口）+ feat/easel-breakdown-page（Easel 仓 worktree，插件侧立项/设置）
commits: dsh 侧 11256959d8（feat/easel-frontend）；插件侧 de85b28（feat/easel-breakdown-page：立项列+立项按钮+聊天方式开关+启动注入）
---

# 工作区与话题：单主工作区为底，立项即工作区，模式可调

## [S1] Problem

dsh 原生工作区体系（自由添加/重命名/删除/选择）对 Easel 的内容创作场景过重，但**工作区
本身不该抹掉**——它正好承载「视频选题立项」的生产语义。期望形态：

- 平时：**话题优先**。侧栏以会话/话题列表为主体，工作区只是容器；会话默认落在
  主项目（默认工作区）或临时文件夹。
- 立项：一个视频选题确认立项后，**设一个专属工作区**（以选题命名），该项目的
  创作会话都归入其中。
- 可调：用户在设置里能切回 dsh 原生的完整多工作区模式（自定义聊天方式）。

## [S2] Design

### D1 模式开关（一切隐藏的前置）

- 存储：`localStorage['easel.workspace.mode']`（`'single' | 'full'`，默认 `single`）；
  由 Easel 插件 `apply()` 在启动时读出并注入 dsh 核心。
- dsh 侧开一个唯一模式口：`packages/client/ui-workspace` 导出
  `setWorkspaceUIMode(mode: 'single'|'full')` + 内部 `workspaceUIMode`（EASEL-DIVERGENCE
  标记，指本 spec）。ui-workspace 的各隐藏点统一读这个口——**full 模式下零差异还原原生**。
- 设置 UI 落在 Easel 插件的设置分区（若插件尚无设置分区则建最小一节）：
  「聊天方式：单工作区（主项目+立项）｜完整模式（自由多工作区）」，切换即时生效
  （写 localStorage + 调 setWorkspaceUIMode，无重载要求）。

### D2 single 模式：入口下线（改动点与上游行号，见勘察）

1. 「添加工作区」按钮：`WorkspaceBrowser.tsx:1287-1302`，mode gate 下不渲染。
2. 重命名/删除：`Rows.tsx:239-240` 菜单项不渲染；连带删除死代码
   `WorkspaceBrowser.tsx:1134-1162`（rename）、`:1174-1205`（delete）、`:1422-1481`
   （两个 Modal）与 `src/client/index.ts:244-256` 中失去消费者的 rename/delete 注入
   （createWorkspace 注入保留——立项流要用 create）。
3. 空态：`src/client/index.ts:320-328` 停注 `conversation.hero.workspace` slot；
   `ui-conversation/skeleton/ConversationContent.tsx:112-118` 的 WorkspaceChip
   改为**仅当工作区数 >1 时渲染**（full 模式或多项目并存时仍有信息量）。
4. 导航兜底：`navigation.ts:267` 顺序（显式 → 当前会话工作区 → recentWorkspace）保留；
   recentWorkspace 为空时取 list 首项，不再弹「请先选择工作区」。

### D3 主项目 / 临时 / 立项工作区

- **主项目 = 默认工作区**，显示名由「默认工作区」改为「主项目」
  （`packages/client/locale/src/locales/zh.ts:35` `workspace.defaultName`，en 同步，
  EASEL-DIVERGENCE）。并探明 `workspaces.initializeDefault` 的 Remote 是否接受目录参数：
  若接受，**默认工作区目录钉为 EASEL 项目根**（`%LOCALAPPDATA%\Easel`）——pushTask 会话
  （cwd=项目根）在按工作区视图下即归主项目，「未分组」段消失；若 Remote 不支持目录参数，
  退化为现状 bootstrap 行为，flat 默认视图下无感（记入风险不阻塞）。
- **临时**：插件在会话行菜单（`sidebar.workspaces.session.menu.item` slot）加一条
  「移入临时」——首次使用时自动创建临时工作区（标题「临时」，目录
  `<项目根>/temp-workspace/`），把会话 attach 进去（走 `insertSessionBefore` 挂接，
  不改会话 cwd，B3 文件协议不受影响）。full 模式下该菜单项依然可见（无害）。
- **立项工作区**（Easel 插件侧）：IdeasPage 选题卡加「立项」动作——
  ①选题 status 置立项值（沿用 status 字段字符串，不新增存储面）；
  ②`workspaces.create('<项目根>/projects/<slug>/', 选题标题)` 幂等创建项目工作区
  （slug 用选题 id，避免标题特殊字符）；③把该选题关联的历史会话（若有记录）
  attach 进项目工作区；④立项后从选题卡发起的创作会话挂接该工作区（同样保持
  cwd=项目根）。侧栏「按工作区」视图里出现以选题命名的工作区组，即立项的可见形态。

### D4 话题优先展示

single 模式下，**侧栏视图默认从「按工作区」改为「单列表」**（`stores.ts:84-91` 初始
groupBy 依 mode 分支；已存持久化偏好 `dsh.workspace.view.v5` 的用户尊重其选择）。
full 模式保持 dsh 原生默认（按工作区分组）。视图切换器本身不动——立项后用户可自行
切回「按工作区」看项目分组。

## [S3] Scope

- In scope（dsh worktree）：D1 模式口、D2 全部隐藏/清理点、D3 的 locale 与
  initializeDefault 目录探明、D4 视图默认分支；本 spec。
- In scope（Easel 仓 worktree）：设置开关、IdeasPage 立项动作、行菜单「移入临时」
  与 attach 编排。
- Out of scope：server Remote 拒绝式钉死；`session.create` cwd 通道改动；存量
  工作区数据迁移；选题库数据模型扩展。

## Tasks

- [ ] T1 (dsh): 模式口 + D2 全部隐藏/清理点 + chip 门控 + D3 locale「主项目」
  + D4 视图默认分支 (depends: none)
- [ ] T2 (dsh): initializeDefault 目录参数探明与主项目目录钉扎 (depends: T1)
- [ ] T3 (dsh): ui-workspace / ui-conversation 相关 vitest 全绿 (depends: T1, T2)
- [x] T4 (Easel): 聊天方式开关落 Dashboard 头部（读写 localStorage + globalThis 键 + 即时 reload） (depends: T1)
- [x] T5 (Easel): IdeasPage「立项」列+动作（宿主 create 幂等建 <项目根>/projects/<标题>/，目录名即工作区名）——「移入临时」菜单项顺延（会话行菜单 slot 接线另行小任务）
  (depends: T2 探明结论)
- [ ] T6 (Easel): 插件 node --test + build.mjs + GUI 探针（single/full 两态切换实测）
  (depends: T4, T5)

## [S4] Acceptance

- [ ] single 模式：侧栏无添加/重命名/删除入口；空态无工作区 chips；hero chip 隐藏；
  默认视图为单列表（话题优先）；默认工作区显示「主项目」；行菜单有「移入临时」。
- [ ] 选题立项后：侧栏出现选题同名工作区，立项选题的创作会话归入其中；未立项
  会话留在主项目；会话 cwd 均为项目根（agent 文件协议不破坏）。
- [ ] 设置切「完整模式」：dsh 原生添加/重命名/删除/选择全部恢复，无残留。
- [ ] 切换不丢数据：single→full→single 往返后工作区/会话归属不变。
- [ ] dsh 侧 vitest、Easel 侧 node --test / build.mjs 全绿。
