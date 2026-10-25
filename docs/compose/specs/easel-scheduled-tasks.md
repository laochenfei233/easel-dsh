---
feature: easel-scheduled-tasks
status: delivered
updated: 2026-10-25
branch: feat/easel-scheduled-tasks
commits: 4f8191023b..5c92cc3c85
---

# easel 定时任务

## Report

**What was built** — easel rail 新增「定时任务」视图（order 34，面板键 `easel.schedules`）：easel 风格的列表页（状态/搜索/筛选、下次触发相对时间倒计、最近投递），新建弹窗（四种时机形状 + 目标会话选择器），详情弹窗（规则摘要、编辑时机、删除、运行记录分页）。数据面全部复用 Host schedule 引擎：目录/编辑/删除/运行记录走 `remote.schedule` 并由 `schedule/changed` 驱动刷新；只有引擎的 host-only `create()` 经新增的 `POST /easel/api/automation/tasks` 中继（四种时机在宿主侧映射为 ScheduleCreateRequest，引擎错误码映射为可读中文；创建前用 `sessionController.list` 的只读投影确认目标会话存在）。cron 任务在 easel 页面只读展示，深度编辑指向 dsh 自带的自动化任务页（rail 保持隐藏）。插件版本 0.2.25 → 0.2.26。

**Verification** — `node --test`（easel/dsh-plugin-easel）：232 tests，232 pass，0 fail（新增 11 项：时机映射/表单校验/错误码映射/会话存在性）。`node build.mjs`：exit 0，client.js 重新生成（含新页面与 `.sch-*` 样式）。两轮独立评审：首轮 FIX-FIRST（history 游标字段错、失败信封当成功、stale entries 三处 major），修复后复审判定 SHIP，无新 critical/major。**实机（装包 alpha.32 + 热替换插件负载）经 CDP 端到端验证**：建任务 → 卡片（会话标题、相对时间、时机摘要）→ 删除，零 console 异常；到点触发链路走引擎（用户自测）。

**Journey log** —

1. 摸底发现 dsh 上游已有完整调度引擎与「自动化任务」管理页（easel 只隐藏了它的 rail 图标）；设计从"自研调度器"收敛为"复用引擎 + easel 自有视图"，引擎的持久化/重启恢复/错过合并/时区规则全部白拿。
2. 既有 `GET/POST /easel/api/schedule` 是内容日历的排期存储（`_schedule.json`，字段是 date/platform/kind），新路由改用 `automation` 命名避让；`create()` 不在 remote 面，读/写其余方法都在。
3. worktree 无 node_modules 导致 build.mjs 找不到 esbuild；用 PowerShell Junction 复用主检出依赖（easel 插件按设计零 workspace import，安全）。
4. 首轮评审纠正三处 major：history 分页游标字段（引擎是 `before`/`nextBefore`，不是 `cursor`）、remote 错误信封与 tool-error 值被当成保存成功、保存后详情用 render 捕获的旧 entries 刷新；同时补上 D3 要求的目标会话存在性守卫。
5. 引擎码 → 中文文案表在宿主与客户端各留一份（两半边不能互相 import），表内容锁定同一组稳定 code，评审已核对逐项一致。
6. 实机冒出两个渲染级 bug：页面把 `remote` 当 `remote.schedule` 用；更关键的是 dsh 的 `ctx.remote` 是按 fiber 注入的代理，访问 `remote.schedule` 未在 inject 列表声明会抛 "cannot get property without inject"，main 槽兜底后整片空白。正解 = feature 插件声明 `remote.schedule` 并把绑定方法经 slot inject 面传给页面（ui-schedule 同款）；CDP 探针（WebView2 远程调试端口）当场定位。

## [S1] Problem

easel 用户有大量按时间表重复执行的提示词任务：每天早上的热点简报、每周的视频脚本草稿、每小时的素材巡检。这套能力在 harness 里已经存在——`@deepseek-ai/dsh-schedule` 引擎（一次性/固定间隔/每天/每周/五字段 cron，持久化、重启恢复、错过合并、投递历史）加 `@deepseek-ai/dsh-client-ui-schedule` 管理页（目录/搜索/详情/规则编辑/运行记录，全套中文文案）——但 easel 在 `easel/dsh-plugin-easel/src/client.tsx:50` 隐藏了它的 rail 入口，且该页没有用户侧创建表单（ui-schedule 的创建路径是"在会话里让模型创建"，`create()` 不是 Remote 方法，客户端无法直接创建）。结果：引擎在 easel 桌面里静默运行，用户找不到入口、建不了任务，只能通过设置页一个跳转区块碰到它。

## [S2] Design

用户拍板的轻量范围：直接把「定时任务」作为 easel 视图挂上 rail，页面按 easel 设计语言做漂亮；专属会话创建、触发 toast、easel 设置区块留待后续（spec 保留为未勾任务）。

### D1 引擎：复用，不自研

所有调度语义复用 `ctx.schedule`（`@deepseek-ai/dsh-schedule`，`packages/schedule/schedule/src/index.ts:99`）：五种时机、持久化（`schedule` 存储域 v1）、重启恢复、错过合并（只补最近一次，不累积）、投递历史（默认 30 天 / 200 条）、`schedule/changed` 变更事件。时机校验全部交给引擎的请求 schema（`ScheduleCreateRequest`，`packages/schedule/schedule/src/types.ts:370-387`），easel 主机半与客户端都不做时间数学；`ScheduleInputError` 由 easel 路由层映射为可读错误。

### D2 入口：easel 自有视图

新增 easel 视图 `定时任务`：`easel/dsh-plugin-easel/src/features/schedules.tsx`（模板照 `calendar.tsx`），`view: 'schedules'`、`order: 34`（排在内容日历 33 之后）、面板键 `easel.schedules`、`IconClock`（`src/components/icons.tsx` 描边风格）。dsh 的 `TaskManagerPage`（面板键 `schedules`）维持 rail 隐藏现状，保留全部 ambient 面（会话行标记/悬停卡片/会话头部目录/turn 卡片/右栏任务 tab），作为高级详情页。

页面信息架构（easel 设计语言，中文文案，页面主体按 easel 既有豁免保留中文常量）：

```
┌ 定时任务 ──────────────────────────────────── [新建任务] ┐
│ 下一次触发 · 今日热点简报 · 14 小时后                     │
│ [全部 | 已开启 | 已结束]      [搜索任务…]                 │
│ ┌──────────────────────────────────────────────────┐    │
│ │ ● 今日热点简报        每天 09:00                   │    │
│ │   10-26 09:00 · 14 小时后                          │    │
│ │   会话「今日热点简报」· 上次 10-25 09:00 已投递    [›][🗑]│
│ │ ○ 每周脚本草稿        每周一 20:00 · 已结束          │    │
│ └──────────────────────────────────────────────────┘    │
│ 空态：还没有定时任务。新建一个，到点它会自动在所选会话里运行。│
└──────────────────────────────────────────────────────────┘

新建弹窗：任务名称(≤120) · 任务内容(提示词) · 时机 · 目标会话（现有 easel 会话选择器）
  时机：仅一次(日期+时刻) | 每天(时刻) | 每周(星期几+时刻) | 每 N 小时/每 N 分钟
详情弹窗：规则摘要 · [编辑时机（仅四种简单形状）] · [删除] · 运行记录（分页，加载更多）
```

签名元素：任务卡与页面顶部的相对时间倒计（"14 小时后"）——「下一次触发」始终以相对时间呈现，绝对时间放在次要位置。

### D3 数据面：读写走 remote.schedule，仅创建走 easel 路由

`catalog`/`history`/`update`/`delete` 都是 Remote 方法（`packages/schedule/schedule/src/index.ts:270-374`），easel 客户端直接用 `ctx.remote.schedule.*`（订阅 `schedule/changed` 刷新，运行记录分页用引擎的 `before` 游标）；只有 `create()` 是 host 进程内 API。easel host 半新增一条路由：

- `POST /easel/api/automation/tasks` → 校验字段与时机 → `sessionController.list` 只读投影确认目标会话存在（不存在 400；会话服务不可用 409 / 读取失败 502）→ `ctx.schedule.create(sessionId, request)`；`ScheduleInputError` 映射为字段级可读文案，未知错误 500 不泄露内部异常。
- 路径段 `automation` 与既有 `/easel/api/schedule/*`（内容日历排期存储 `_schedule.json`）区分。

四种时机在 easel 客户端表单里映射为引擎请求字段：一次性 `{at}`、每天 `{daily:{time,time_zone}}`、每周 `{weekly:{time,weekdays,time_zone}}`、间隔 `{every_seconds}`；时区一律取系统本地时区。模型经 `schedule_create` 创建的 cron 任务在 easel 页面以「自定义时机」只读展示（可删除，不可编辑时机）。

引擎既有约束照单接受，UI 显式呈现：绑定会话必须是非子 agent 的根会话；承载启用任务的会话拒绝归档（`workspace/session-activity`，`src/index.ts:188-206`），归档动作的错误以可读提示呈现；已结束（inactive）任务的时间规则只读。

## [S3] Scope

In scope：

- easel 视图「定时任务」：rail 入口（order 34）、列表/筛选/搜索、新建弹窗（四种时机 + 现有会话选择器）、详情弹窗（规则/运行记录分页）、编辑时机（简单形状）、删除。
- easel host 路由：一条 `POST /easel/api/automation/tasks` + 字段校验 + 引擎错误映射 + 目标会话存在性守卫 + node --test 覆盖。
- `features/index.ts` 接线、`IconClock`、`.sch-*` 样式、插件版本号、README 更新。

Out of scope（留待后续，本 spec 保留未勾任务）：

- 专属会话缝：创建时新建「定时 · 任务名」会话（sessionController 同源优先，experimental/webhook 模式兜底）。
- 触发提醒 toast（schedule/changed diff lastDelivery + shell.overlay）与「任务触发时提醒我」开关。
- easel 设置页「定时任务」一节（settings.section，order 41；dsh 自带「自动化任务」区块今天已渲染，暂以它作为设置的可达路径）。
- cron 表达式的创建/编辑 UI；每次触发新开会话的交付策略；错过任务策略设置；系统级桌面通知；提醒偏好跨设备同步；任务执行并发上限。

## Tasks

- [x] T1: host 路由 `POST /easel/api/automation/tasks`：转发 ScheduleService.create，`ScheduleInputError`/结果错误映射，目标会话存在性守卫，node --test 覆盖转发与错误分支 (depends: none)
- [x] T2: client 视图：`src/features/schedules.tsx` + `src/components/SchedulesPage.tsx`（列表/筛选/搜索/卡片/新建弹窗/详情弹窗/运行记录）+ `IconClock` + easel CSS + 全量中文文案与四种时机表单校验，cron 任务只读态 (depends: T1)
- [x] T3: 接线：`features/index.ts` 加入 views、插件版本号 bump、README 路由与视图说明 (depends: T2)
- [x] T4: 验证：插件 node --test 232/232、`node build.mjs` 产物可加载、两轮独立评审（FIX-FIRST → SHIP） (depends: T1-T3)
- [ ] T5:（后续）专属会话缝：创建默认新建「定时 · 任务名」会话，sessionController 同源优先，webhook 模式兜底 (depends: T2)
- [ ] T6:（后续）触发提醒 toast + localStorage 开关 (depends: T2)
- [ ] T7:（后续）settings.section「定时任务」（order 41）：概览 + 开关 + 跳转 (depends: T2)

## [S4] Acceptance

- [x] A1: easel rail 出现「定时任务」入口（order 34，easel 图标），点击打开 easel 风格页面（面板键 `easel.schedules`），dsh 页面维持 rail 隐藏。（代码级已验证：槽注册契约与 calendar 视图同构；浏览器渲染待实机冒烟）
- [x] A2: 从页面新建任务后任务出现在列表；到点投递由引擎负责（复用路径），详情抽屉（弹窗）出现运行记录。（路由与列表刷新单测覆盖；端到端触发待实机冒烟）
- [x] A3: 编辑时机/删除经 easel 页面生效且列表即时反映；编辑冲突（`schedule_conflict`）与拒绝的编辑（tool-error 值）以可读文案提示且不覆盖已保存规则；引擎无暂停概念，状态只读展示。
- [x] A4: 模型创建的 cron 任务在 easel 页面只读展示为「自定义时机」，不导致页面异常。
- [x] A5: easel host create 路由对无效请求返回字段级可读错误、对不存在的目标会话返回显式 400；插件测试 232/232 全绿。
