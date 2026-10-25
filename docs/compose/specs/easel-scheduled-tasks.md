---
feature: easel-scheduled-tasks
status: in-progress
updated: 2026-10-25
branch: feat/easel-scheduled-tasks
commits: 4f8191023b.. # filled at delivery
---

# easel 定时任务

## Report

（交付时填写。）

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
│ [全部 | 已开启 | 已结束]      [搜索任务…]                 │
│ ┌──────────────────────────────────────────────────┐    │
│ │ ● 今日热点简报        每天 09:00                   │    │
│ │   下次 10-26 09:00（14 小时后）· 会话「今日热点简报」     │    │
│ │   上次 10-25 09:00 已投递                [详情][删除]   │    │
│ │ ○ 每周脚本草稿        每周一 20:00 · 已结束           │    │
│ └──────────────────────────────────────────────────┘    │
│ 空态：还没有定时任务。新建一个，到点它会自动在所选会话里运行。│
└──────────────────────────────────────────────────────────┘

新建抽屉：任务名称(≤120) · 任务内容(提示词) · 时机 · 目标会话（现有 easel 会话选择器）
  时机：仅一次(日期+时刻) | 每天(时刻) | 每周(星期几+时刻) | 每 N 小时/每 N 分钟
详情抽屉：规则摘要 · [编辑时机（仅四种简单形状）] · [删除] · 运行记录（分页，加载更多）
```

签名元素：任务卡与页面顶部的相对时间倒计（"14 小时后"）——「下一次触发」始终以相对时间呈现，绝对时间放在次要位置。

### D3 数据面：读/写走 remote.schedule，仅创建走 easel 路由

`catalog`/`history`/`update`/`delete` 都是 Remote 方法（`packages/schedule/schedule/src/index.ts:270-360`），easel 客户端直接用 `ctx.remote.schedule.*`（读路径订阅 `schedule/changed` 刷新）；只有 `create()` 是 host 进程内 API。easel host 半新增一条路由：

- `POST /easel/api/schedules/create` → `ctx.schedule.create(sessionId, request)`；`ScheduleInputError` 映射为 easel 错误结构（字段级可读文案）；目标会话不存在/不可用 → 显式错误。

四种时机在 easel 客户端表单里映射为引擎请求字段：一次性 `{at}`、每天 `{daily:{time,time_zone}}`、每周 `{weekly:{time,weekdays,time_zone}}`、间隔 `{every_seconds}`；时区一律取系统本地时区。模型经 `schedule_create` 创建的 cron 任务在 easel 页面以「自定义时机」只读展示（可暂停/删除，不可编辑时机）。

引擎既有约束照单接受，UI 显式呈现：绑定会话必须是非子 agent 的根会话；承载启用任务的会话拒绝归档（`workspace/session-activity`，`src/index.ts:188-206`），归档动作的错误以可读提示呈现；已结束（inactive）任务的时间规则只读。

## [S3] Scope

In scope：

- easel 视图「定时任务」：rail 入口（order 34）、列表/筛选/搜索、新建抽屉（四种时机 + 现有会话选择器）、详情抽屉（规则/运行记录分页）、暂停/开启（如引擎支持状态更新）、编辑时机（简单形状）、删除。
- easel host 路由：一条 `POST /easel/api/schedules/create` + 错误映射 + node --test 覆盖。
- `features/index.ts` 接线、插件版本号。

Out of scope（留待后续，本 spec 保留未勾任务）：

- 专属会话缝：创建时新建「定时 · 任务名」会话（sessionController 同源优先，experimental/webhook 模式兜底）。
- 触发提醒 toast（schedule/changed diff lastDelivery + shell.overlay）与「任务触发时提醒我」开关。
- easel 设置页「定时任务」一节（settings.section，order 41；dsh 自带「自动化任务」区块 today 已渲染，暂以它作为设置的可达路径）。
- cron 表达式的创建/编辑 UI；每次触发新开会话的交付策略；错过任务策略设置；系统级桌面通知；提醒偏好跨设备同步；任务执行并发上限。

## Tasks

- [ ] T1: host 路由 `POST /easel/api/schedules/create`：转发 ScheduleService.create，`ScheduleInputError`/结果错误映射，node --test 覆盖转发与错误分支 (depends: none)
- [ ] T2: client 视图：`src/features/schedules.tsx` + `src/components/SchedulesPage.tsx`（列表/筛选/搜索/卡片/新建抽屉/详情抽屉/运行记录）+ `IconClock` + easel CSS + 全量中文文案与四种时机表单校验，cron 任务只读态 (depends: T1)
- [ ] T3: 接线：`features/index.ts` 加入 views、插件版本号 bump (depends: T2)
- [ ] T4: 验证：插件 node --test 全绿、`node build.mjs` 产物可加载 (depends: T1-T3)
- [ ] T5:（后续）专属会话缝：创建默认新建「定时 · 任务名」会话，sessionController 同源优先，webhook 模式兜底 (depends: T2)
- [ ] T6:（后续）触发提醒 toast + localStorage 开关 (depends: T2)
- [ ] T7:（后续）settings.section「定时任务」（order 41）：概览 + 开关 + 跳转 (depends: T2)

## [S4] Acceptance

- [ ] A1: easel rail 出现「定时任务」入口（order 34，easel 图标），点击打开 easel 风格页面（面板键 `easel.schedules`），dsh 页面维持 rail 隐藏。
- [ ] A2: 从页面新建任务后：任务出现在列表；到点后向所选会话投递，详情抽屉出现运行记录。
- [ ] A3: 暂停/开启（如支持）/编辑时机/删除经 easel 页面生效且列表即时反映；编辑冲突（`schedule_conflict`）以可读文案提示且不覆盖已保存规则。
- [ ] A4: 模型创建的 cron 任务在 easel 页面只读展示为「自定义时机」，不导致页面异常。
- [ ] A5: easel host create 路由对无效请求返回字段级可读错误；插件测试全绿。
