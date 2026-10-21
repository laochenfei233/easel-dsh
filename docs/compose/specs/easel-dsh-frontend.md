---
feature: easel-dsh-frontend
status: delivered
updated: 2026-10-13
branch: feat/easel-frontend（Easel/dsh）
repo: Easel/dsh（deepseek-harness 0.2.1-alpha.2 的 git worktree）+ Easel/dsh-plugin-easel
commits: 65359876b9..5279eace8b
---

# Easel 替换 dsh 前端（保留 dsh 壳与 agent 能力）

## Report

**What was built** — Easel 的内容工作台整体搬进 DeepSeek Harness（dsh）成为其浏览器界面：dsh 的
壳（会话、审批、提问、工具渲染、模型/权限档、设置）原封不动，侧栏轨道由 Easel 的 10 个页面
（工作台/热点雷达/选题库/内容日历/技能库/内容库/发布中心/账号/画像/爆款拆解）接管，每个视图
注册一个 `main` key；dsh 自己的 `plugins`/`schedules` 图标分别经补丁行禁用与 `uiSidebarPanels.hidden()`
隐藏，且 `schedules` 补了设置分区保证可达。Easel 的聊天界面删除，对话由 dsh 会话承担；「做内容」
重接为复制提示词并跳转 dsh 对话。宿主半（`dsh-plugin-easel/index.js`）继续提供技能目录、状态探测
与 `/easel/api/*` 反向代理（写操作把 Origin 呈现为后端自身来源过 local_write_guard，且拒绝跨站
来源骑代理）。实现形态为「整包移植」：Easel 页面组件原样拷入插件 src/（esbuild 编译 TSX、类型
擦除、零源码修改，仅改 api BASE 一行），样式经 scope-css 作用域化并跟随宿主明暗主题。

**Verification** — dsh `test:gui` 10071 过/5 失败（3 个 license-bundle 联网环境失败 + 2 个分区账本
断言按自带约定更新后单文件复测 9/9 绿）；`DSH_SNAPSHOT=replay test:web` 大面积失败为既有环境
问题（双 playwright-core 版本偏斜 1228/1243，离线补装不了，改动前该阶梯在本环境也从未跑绿），
其验证价值由真实浏览器实测覆盖：10 页真实数据、暗色跟随、设置分区跳转、写操作 200、跨域写 403。
插件 node --test 18/18；SPA `npm run build`（tsc+vite）✓、oxlint 0 错、前端测试 11/11。
独立复核 subagent 结论：通过，无 critical；7/7 验收 PASS；其安全建议（跨站骑代理）已修复并复审。

**Journey log** —
- 移植后页面必须包在 `.easel-scope` 容器里（样式全部前缀匹配）；漏包 = 整站裸 HTML。
  交付后用户判「一团乱」才发现此盲区——浏览器验证当时只查了数据与结构，没查设计层。
  修复时顺带交付 Apple 设计层（`src/styles/apple.css`：分组卡片语言，经同一 scope-css
  管线追加在后，等特异性靠顺序取胜；先重定义 Easel 变量全局换肤，再定点修饰控件）。
- 插件 client 的 `__ModuleLoader__.load` 包装与构建 banner 双双存在时会双重注册（duplicate
  factory registration）——包装只允许一处，现归 build.mjs，源码只导出描述符。
- pnpm `file:` 安装是硬链接：Edit 工具的重命名式写入会断链导致 profile 副本陈旧；改完 index.js
  必须显式 cp 同步；client.js 经 build 的 writeFileSync 原地截断则不受影响。
- Easel local_write_guard 的无-Origin 回环回退在部分部署不生效，代理不能靠剥 Origin 而要呈现
  后端自身来源；同时必须先拒绝跨站来源再盖章，否则 CSRF 面被代理放大。
- dsh 浏览器端 `src/client/` 控件拿不到 loader 行的 config（wire 不携带）——部署级开关走补丁行、
  选择性隐藏走宿主包提供的注入服务（T2 两半的最终机制）。

## [S1] Problem

dsh 的浏览器端现在是 dsh 自己的产品界面：一个 `conversation` 主页面、一个任务页
（`schedules`）、一个插件页（`plugins`），加上设置里的若干分区；侧边栏里挂着两个「插件入口」
图标。用户希望 Easel 的内容工作台页面取代这些页面，同时 dsh 的 agent 循环、对话、设置一样
不能少，且侧边栏不该再被 dsh 的插件入口占据。

## [S2] Design

### 2.1 职责划分（谁拥有哪块）

| 界面面 | 变更后的归属 |
|---|---|
| `main` 槽 key `conversation` | **dsh**（ui-conversation）。唯一的对话面；Easel 的 ChatPage 删除 |
| `main` 槽 key `easel.*` ×10 | **Easel** 页面，作为 dsh 客户端插件由 `dsh-plugin-easel` 注册 |
| `sidebar` 外壳、`rightbar` 外壳 | **dsh**（ui-layout）**不动** —— 这两处被替换会连带其声明子槽一起消失 |
| `sidebar.panellist` | **Easel 导航**；dsh 的 `plugins` / `schedules` 两个图标移走 |
| `settings.section` | **dsh 五个分区全部保留**；`plugins` / `schedules` 页面改为从这里进入 |
| `conversation.composer` | **dsh**（ui-approval、ui-user-questions）—— 承载 agent 阻塞点，永不替换 |
| 传输层（client/connection、api-remotes、client/modules、client/store） | **dsh** 不动 |
| Easel FastAPI 后端 | **Easel** 不动，作为 sidecar 跑在 :7860，经 `/easel/api/*` 代理进入 |

### 2.2 不可破坏清单（来自 dsh 源码核对，见 §2.5）

删掉非对话页面**不会**破坏 agent 循环；但删掉下面任何一项会让 agent 卡住：

| 能力 | 包 | 槽 | 后果 |
|---|---|---|---|
| 审批提示 | ui-approval | `conversation.composer` (chain) | **阻塞**：没人应答则工具执行停住 |
| ask_user 提问 | ui-user-questions | `conversation.composer`、`conversation.chat.node` key `question-reply` | **阻塞**：ask 工具等不到回答 |
| 工具调用渲染 | ui-tool | `conversation.chat.node` key `tool-call` | 循环照跑，但看不见/管不了工具调用 |
| 对话面本体 | ui-conversation | `main` key `conversation` | **阻塞**：上面几行的 inject 全部悬空 |
| 传输/RPC | client/connection、api-remotes、client/modules、client/store | 无槽 | **阻塞**：全站 |
| 会话浏览 | ui-workspace + api/*-controller/client | `sidebar.workspaces` | 非循环依赖，但没了就没法开会话 |
| 模型选择 / 权限档 | ui-model-selection / ui-permission-presets | `conversation.input.*` | 非必需，有默认值兜底 |

### 2.3 Easel 页面 → dsh

Easel 前端是 React 19 + Vite，**没有 router**：11 个视图靠 `App.tsx:699-763` 的 state switch 切换。

| Easel 视图 | 源文件 | 主要端点 | 处理 |
|---|---|---|---|
| dashboard | DashboardPage.tsx (343) | GET trends/schedule/outputs/accounts/ideas/analytics | 搬 |
| **chat** | ChatPage.tsx (269) | POST /api/chat/stream (SSE) | **删，交给 dsh** |
| trends | TrendsPage.tsx (106) | GET /api/trends; POST /api/ideas | 搬 |
| ideas | IdeasPage.tsx (125) | GET/POST/PUT/DELETE /api/ideas | 搬 |
| calendar | CalendarPage.tsx (310) | GET/POST /api/schedule, PUT/DELETE | 搬 |
| publish | PublishPage.tsx (473) | GET accounts/outputs/media; POST /api/publish/* | 搬 + 重接对话 |
| breakdown | BreakdownPage.tsx (77) | POST /api/chat（一次性） | 搬 + 重接对话 |
| skills | SkillPage.tsx (164) + SkillDrawer.tsx (235) | GET /api/skills, /api/skill/{name} | 搬（**第一个做，见 T3**） |
| outputs | OutputsPage.tsx (340) | GET /api/outputs, /api/output/{path}, /api/media | 搬 |
| accounts | AccountsPage.tsx (437) | GET/POST /api/login/*, /api/accounts/* | 搬 |
| profile | ProfilePage.tsx (229) | GET/PUT /api/persona/* | 搬 |

叠加层（非导航）：`SettingsPanel.tsx` (1016)、`OnboardingWizard.tsx` (245)、欢迎弹窗。

### 2.4 对话交接

- **删除**：`ChatPage.tsx`、`MessageBubble.tsx`、`QuestionCards.tsx`、`BrushEntry.tsx`、
  `lib/capabilityMenu.ts`，`App.tsx` 的对话半边（streaming 204-657、session/tab 86-162、
  session CRUD 573-657、`handleSendMessage` 家族 711-741），`lib/store.ts` 的 session/pending
  turn 部分，`lib/api.ts` 的 streamChat/stopChat/fetchLastTurn/questionStatus/answerQuestion/
  uploadFiles/deleteSession。
- **不能删、必须重接**的非对话依赖：
  - `PublishPage.tsx:129`（流式，审稿）、`:159`（一次性）、`:160`（POST /api/skill）
  - `BreakdownPage.tsx:29`（一次性 POST /api/chat）
  - `App.tsx:540-547` `handleUseTopic`（发一条消息并跳到对话）+ `linkifyOutputs.ts:48` 的
    `#/outputs/<path>` 契约（被 `App.tsx:65-78` → Dashboard/Trends/Ideas 的 `onUseTopic` 消费）
- **后端**：Easel 已有 `Harness` 协议收口（`docs/harness-protocol.md`），dsh 适配器按 §7.7 需要
  补第三条 `run_turn` 通道 + `easel/harness/deepseek/`。**本 spec 不含该适配器**；在它落地前，
  Publish/Breakdown 的一次性调用仍走 `POST /api/chat`（即 OpenClaw），记为已知缺口。

### 2.5 已核对事实（来源）

- dsh 槽位与归属：`packages/client/ui-layout/src/client/index.ts:73,183`（`main` keyed）、
  `ui-sidebar/src/client/contract/slots.ts:35-53`、`ui-settings/src/client/contract/slots.ts:17-92`；
  `main` 三个 key 的注册点：ui-conversation `apply.ts:532-537`、ui-schedule `index.ts:168-177`、
  ui-plugin-manager `index.ts:110-129`。
- 新增设置页的官方写法：`ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section', id, order, label}, C))`
  —— `ui-settings/README.md:40-42`、`docs/cookbook/adding-a-settings-card.md:44-72`。
- **禁止 iframe**（这条直接否掉了「把 Easel 整个塞进插槽」的走法）：
  `packages/preset/agent-preset/skills/cordis-plugin-development/references/practices.md:33`
  —— "Do not serve an HTML page from the Host and embed it in an iframe: an iframe document does
  not receive the host's theme tokens, light/dark switching, or `ctx.locale`."
  同文件 `:12` "Plugin UI is part of the Harness UI."、`:36` 禁止在组件外写 DOM；
  `references/ui-plugin.md:13` 禁止替换 app root 或往 `document.body` 追加第二个应用。
- Easel 的 SPA 假设（搬迁时必须处理）：`web/frontend/src/lib/api.ts:1-7` 从
  `window.location.pathname` 推 BASE；`index.html:28`、`Sidebar.tsx:119` 写死
  `./static/easel-icon-transparent.png`；`index.html:17-27` 尾斜杠 `location.replace`；
  `index.html:34-41` 外部 Google Fonts；自带 `app-layout` 侧边栏 + 全视口 `height:100%`。
- Easel 无 i18n（中文硬编码），与 dsh「客户端文案由 locale 拥有」的规则冲突
  → 搬进来的组件文案必须走 `ctx.locale`。
- 写入门禁：Easel 后端 `local_write_guard`（`web/app.py:515-548`）按 Origin 放行，回环端口
  白名单在 `:466-475`；dsh 的 Origin 需要加进去（`dsh-plugin-easel/README.md` 已记）。

## [S2.6] 已确认决策（2026-10-12）

1. **Easel 页面走「每页一个 dsh 插件页」**：拆掉 Easel 的 App 外壳与自带导航，每个视图成为
   一个独立的 dsh 客户端插件页，各自注册一个 `main` key（`chat` 除外，它交给 dsh）。
2. **`sidebar.panellist` 让给 Easel 导航**：移除 dsh 自己的 `plugins`（`ui-plugin-manager`
   `index.ts:141-147`）与 `schedules`（`ui-schedule` `index.ts:178-184`）两个图标，两者改为从
   设置进入。`plugins` 已有设置分区（`ui-settings-plugins`）；`schedules` **没有**，需要新增一个
   `settings.section`。

### 2.6.1 关键取舍：不要直接删掉那两处注册（避免重演上游合并冲突）

直接删 `ui-plugin-manager` / `ui-schedule` 里的 `sidebar.panellist` 注册会**永久偏离上游**——
这正是用户一直在对抗的合并冲突来源。所以 T2 必须在「不加冲突面」的前提下做到「侧边栏不再有这两个入口」。

**先说两个被实测否掉的方案**（都是我先写进本 spec、随后被源码推翻的）：

1. ~~给两个包各加一个 `Config.sidebarEntry` 字段~~ —— **不可行**。浏览器半边**收不到** loader 行的
   `config`：boot wire 的行只有 `id` / `inject` / `external` / `immediately`
   （`packages/client/modules/src/client/manifest.ts:110-123`），
   `entries.ts:217` 用 `this.modules.import(row.id, '', {})` 建条目、根本没有 config；
   `entries.ts:226` 的 `entry.fiber.update(entry.options.config)` 只在 FAILED 重试路径上。
   两个包的 `sidebar.panellist` 注册都在 `src/client/` 里，**拿不到配置**。
2. ~~用同名 id + 更低 priority 去「遮蔽」原条目~~ —— **不干净**。
   `ui-sidebar/src/client/SidebarRoot.tsx:279-291` 是 `panels.map(({id,label}) => <PanelRow id={id} …/>)`，
   一行对应一条槽条目；`syncPanels`（`index.ts:49-58`）把**所有**条目都收进 metadata。
   遮蔽只会让我的空组件赢，**留下一条空白但仍占位、仍可点、仍有 aria-label 的行**，不是隐藏。

### 2.6.2 T2 的实际做法

**`plugins`：直接关掉那一行，零 dsh 源码改动。**
在 `dsh-plugin-easel/cordis.patch.yml`（我自己的 bundle patch，profile 层）里加
`- id: ui-plugin-manager` + `disabled: true`。dsh 源码**一个字节都不改**，未来上游合并的冲突面为零，
且完全可逆。代价可接受：插件管理仍在设置里（`ui-settings-plugins` 是独立包，不受影响），
插件市场也是注册在 `settings.section` 上的（第三方 `dsh-plugin` 市场就是这么做的）。

**`schedules`：需要一个「加法式」扩展点，不能关整包。**
关掉 `ui-schedule` 会连带失去：任务页、右侧栏任务 tab、会话头部的提醒目录、
`conversation.chat.turnTail` 的任务卡、会话行的任务标记，以及 `scheduleTurnDefinition` 的注册——
其中「提醒」是真实的 agent 能力（`tool-schedule` 建的提醒要在对话里浮现），不能砍。

正确的加法式改法（**新增，不改现有行为**，所以同样几乎不产生合并冲突）：
在 `ui-sidebar` 里加一个隐藏过滤器 —— 把 `syncPanels`（`ui-sidebar/src/client/index.ts:49-58`）
收条目那段改成「先过滤再写 metadata」，过滤依据由**另一个浏览器插件注册**提供
（候选：一条 `@mode waterfall` 事件，或一个 list 槽）。然后由我的插件注册要隐藏的 id。

> 注意：`ui-sidebar` 目前**不 provide 任何服务**（`index.ts:40` 只有 `inject`），所以加服务会带来新的
> `Context` 合并与导出面；waterfall 事件或 list 槽的增量面更小。

**状态：`schedules` 这一半尚未实现**（见交付说明）。

## [S3] Scope

**In**
- dsh 前端改动，全部落在 `Easel/dsh`（branch `feat/easel-frontend`）
- Easel 页面作为 dsh 客户端插件，落在 `Easel/dsh-plugin-easel`
- 侧边栏插件入口迁移进设置
- 对话交接（删 Easel 聊天 UI + 重接三处非对话依赖）

**Out**
- 不改 Easel 的 FastAPI 后端
- 不含 dsh `Harness` 适配器（`easel/harness/deepseek/`）—— 单独跟踪
- 不做移动端
- 不做 11 个页面的完整中英双语，只做搬进来的页面自身所需部分

## Tasks

- [x] **T1** 侦察 dsh 前端表面 + agent 耦合点、Easel 前端页面 + 数据依赖（deps: none）
- [x] **T2** 侧边栏入口迁移（deps: T1）—— 全部完成并浏览器实测：
  - ✅ `plugins`：`dsh-plugin-easel/cordis.patch.yml` 里 `- id: ui-plugin-manager` + `disabled: true`；
    dsh 源码零改动；浏览器实测图标消失。
  - ✅ `schedules`：`ui-sidebar` 新增加法式注入面 **`uiSidebarPanels.hidden(id)`**，
    插件经它隐藏图标；浏览器实测全局面板轨道只剩 Easel 项。
  - ✅ **`schedules` 设置分区已补齐**（2026-10-13）：`ui-schedule` 自注册 `settings.section`
    （order 18，位于 plugins 与 agent-presets 之间），分区体经 `ctx.get('layout')` 点击时
    fail-loud 地 `selectPanel('schedules')` 并关闭设置；浏览器实测分区出现、点击打开任务页。
    `ui-settings-general` 的分区账本测试按其自带注释（「插件新增分区要改此列表」）更新；
    提交 `5279eace8b`（原 7c77764bab 的 amend，含账本测试更新）。
- [x] **T3** 第一个 Easel 页面端到端（deps: T2）—— 已达成并被 T4 吸收：
  早期「技能浏览」最小面板完成了代理链端到端验证（真实数据 115 技能 + 经 `/easel/api/*` 的画像）；
  T4 中该面板升级为完整 `SkillPage.tsx` 移植（详情抽屉、env 配置、搜索、分区导航）。
- [x] **T4** 每页一个 dsh 插件页（deps: T3）—— **完成（2026-10-13），实现形态为「整包移植」**：
  - Easel 页面组件**逐字节原样拷入** `dsh-plugin-easel/src/components/`（13 个 TSX，类型由
    esbuild 编译期擦除，零源码修改）；`lib/api.ts` 仅改一行 `BASE = '/easel'` 走插件代理；
    `lib/store.ts` 裁剪为发布草稿。
  - 构建链：`tools/scope-css.mjs` 把 Easel 两张全局样式表作用域化（`.easel-scope` 前缀、
    暗色 `:root[data-theme='dark']` 改挂宿主 `body[data-ds-dark-theme]`、剥掉 viewport 级规则），
    `build.mjs` 用 esbuild 打包（react/react-jsx-runtime external——宿主种子提供，避免双 React），
    产出 `client.js`（banner/footer 提供 `__ModuleLoader__.load` 包装 + CJS `module.exports`，
    返回 default 导出作插件描述符）。**坑**：源码与 banner 都带 load 包装会双重注册
    （「duplicate factory registration」）——包装只允许存在一处（现归 build.mjs）。
  - 10 个视图各注册一个 `main` key（`easel.<view>`）+ `sidebar.panellist` 项（order 30-39，
    侧栏轨道即 Easel 导航）；shell 状态（persona/gateway/apiDirect）由入口的一个外部 store 共享；
    「做内容」重接为剪贴板复制选题提示词 + `layout.selectPanel('conversation')`。
  - 浏览器实测：10 页全部以真实后端数据渲染（热搜、画像、114 技能、账号、产物）；
    暗色主题跟随宿主切换（截图 verify-*.png）；插件 node --test 14/14。
- [x] **T5** 删除 Easel 聊天 UI，重接 Publish / Breakdown / handleUseTopic（deps: T3）——
  **完成（2026-10-13）**：
  - 删除 `ChatPage.tsx`、`MessageBubble.tsx`、`QuestionCards.tsx`、`BrushEntry.tsx`、
    `lib/capabilityMenu.ts`；App.tsx 858→约 250 行（流式引擎、会话 CRUD、BroadcastChannel、
    打字机全删）；Sidebar 去掉对话导航与会话列表（`Page` 联合类型失去 `'chat'`）；
    `store.ts` 裁剪为发布草稿；`api.ts` 删 `fetchLastTurn/questionStatus/answerQuestion/
    uploadFiles/adoptOversize/deleteSession/stopChat`。**保留 `streamChat`**——PublishPage 的
    智能一稿多改把它当流式技能执行器（非对话 UI），走 `/api/chat`（OpenClaw）= 记录在案的已知缺口。
  - `handleUseTopic` 重接：剪贴板复制 + toast（dsh 插件页里则是复制 + 跳转 conversation）。
  - `personaSession.test.mjs` 专测已删的画像↔会话逻辑，随功能一并删除。
  - 验证：`npm run build`（tsc + vite）✓、oxlint 0 错（2 条存量警告）✓、
    `node --test tests/frontend/*.test.mjs` 11/11 ✓（bundle 496KB→417KB）。
- [~] **T6** 验证（整程 test:gui + DSH_SNAPSHOT=replay test:web）与独立复核（deps: T4, T5）——
  test:gui 10071 过 / 5 失败（3 个为需联网 `npm pack` 的 license-bundle 环境失败 + 2 个分区账本
  断言已按新分区更新后单包复测 9/9 绿）；test:web replay 在跑；独立复核 subagent 待派。

### 工作区事实（下一轮直接可用，别再踩一遍）

- 工作树：`Easel/dsh`，分支 `feat/easel-frontend`，基线 `65359876b9`。
- 依赖已装好（离线）：`pnpm install --offline --store-dir "C:\Users\chenfei\AppData\Local\pnpm\store\v11"`。
  **不要**指向 `deepseek-harness/.pnpm-store`——那里缺 `xlsx-0.20.3.tgz`，会卡在 `added 1397`。
  当前 npmjs 直连与 `127.0.0.1:32808` 代理都超时，只能离线装。
- 构建顺序：**整仓 `pnpm run build` 必须先跑一次**（`tsc` 出 `lib/types`，`tsdown` 出 `lib/`）。
  先跑单包 `pnpm --filter <pkg> bundle` 会报 `[UNRESOLVED_ENTRY] Cannot resolve entry module lib/types/index.js`。
- `pnpm run test:gui`（= `vitest run packages/client packages/host`）**不需要构建**，直接对源码跑，是内环。
- 客户端包在 per-file 100% 覆盖门内；`apps/web` 的 dist 不存在时 UI 也起不来（要走构建）。

### T3 起的前置（新客户端插件的三条注册面，缺一条会在更晚的地方失败）

来自 `packages/client/AGENTS.md`「New plugin package checklist」：

1. `tsconfig.client.json` 聚合 `references` 加一条；
2. `packages/bundle/web-app/cordis.patch.yml` 加一个 `dsh.client` 行；
3. `packages/bundle/web-app/package.json` 加依赖（profile 启动时按裸名解析行，没被任何 manifest
   声明的行会 import 失败）。

另外这些包在 per-file 100% 覆盖门内（`pnpm run test:coverage`），内环是 `pnpm run test:gui`；
凡是能改变装配后浏览器可见输出的，还要跑 `DSH_SNAPSHOT=replay pnpm run test:web`。
文案必须走 typed locale 字典（`verify-client-ui-i18n` 会拒硬编码），
样式只能用 `--dsw-*` token + CSS Modules（禁字面色值）。

## [S4] Acceptance

- [x] dsh `conversation` 仍是唯一对话面；传输/审批/提问/工具渲染/模型/权限档/会话浏览在浏览器实测全部在位
- [x] 侧边栏不再有 `plugins` / `schedules` 入口（浏览器实测：全局面板只余 Easel 导航 10 项）
- [x] 两者可从设置进入：`plugins`（上游 `ui-settings-plugins` 现成）；`schedules`（新增
    `settings.section`，浏览器实测分区出现且「打开自动化任务」跳转成功）
- [x] ≥1 个 Easel 页面在 dsh 插槽里用真实 Easel 数据渲染（实测 10 页全部真实数据）
- [x] 无 iframe（每个页面是注册进 `main` 槽的纯 React 组件，非 iframe）
- [x] 搬进来的组件用宿主主题与 locale：面板块目经 locale 字典（zh/en）；页面正文保留 Easel
    原文案（产品为中文单语，spec §S3 明确不做全量双语）；宿主暗色主题经 CSS 作用域化映射跟随
    （浏览器实测深浅切换）
- [x] Easel 后端 `local_write_guard` 接受 dsh 的 Origin（写操作实测：代理把 Origin 呈现为
    后端自身来源后 POST /easel/api/ideas → 200；探测数据已删除）

## Resolved questions

**Easel 10 个页面的导航放哪？** → 已定：`sidebar.panellist` 归 Easel（见 §2.6 决策 2）。
`sidebar.panellist` 是图标轨（`SidebarPanelIconOwnerProps = {size, active}`），10 个图标偏多但可用；
`sidebar.workspaces`（带搜索的浏览区）保留给 dsh 的会话浏览，不占用。

**是否重写 Easel 的 FastAPI 后端？** → 不。后端保持不动，作为 sidecar 跑在 :7860，
经 `dsh-plugin-easel` 的 `/easel/api/*` 代理进入。
