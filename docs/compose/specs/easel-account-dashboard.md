---
feature: easel-account-dashboard
status: in-progress
updated: 2026-10-26
branch: feat/easel-account-dashboard
commits: # filled at delivery
---

# 工作台创作数据：账号切换 + 全览

## Report

- Workspace: worktree `.worktrees/easel-account-dashboard`，分支 `feat/easel-account-dashboard`，base = `feat/easel-multi-account` head `d91e3a4153`（栈式分支；多账户功能尚未合并 master）。

## [S1] Problem

多账户上线后，工作台「创作数据」卡片仍按平台寻址：一个平台只能看默认账号，同平台多个号的粉丝/获赞/增长无法分别查看，也没有一眼看全所有账号的视图。归因归档 `outputs/_analytics/<platform>.jsonl` 同样只按平台落盘，多账号的数据会混写进同一份历史，日/周/月对比失真。

## [S2] Design

### 归档按账号（复用注册表的默认账号巧劲）

- 归档文件名键 = **账号 id**：`outputs/_analytics/<accountId>.jsonl`。默认账号 id 就是平台 key，所以既有 `<platform>.jsonl` 天然是默认账号的历史，**零迁移**；新账号各写自己的文件。
- `account_stats.py`：`fetch` 增 `--history-key`（缺省 = `--platform`，行为不变），`load_history`/`record_snapshot` 按 key 落盘。
- 新增 `history` 子命令（**不起浏览器**）：`account_stats.py history --platform <p> [--history-key <k>]` 输出 `{platform, historyKey, latest, growth, points, ageDays}`：
  - `latest` 最后一条快照（ts/followers/likes/posts）；
  - `growth` 复用 `growth_windows(history[:-1], latest)`，与 `fetch` 的语义逐字一致（last=对上一条，day/week/month/year 对窗口前最近快照）；
  - `points` 最近 20 条快照，供全览迷你走势图；
  - `ageDays` = 距最后采集的天数（UI 用它说「3 天前采集」）。

### 全览路由（读归档，不启浏览器）

`GET /easel/api/analytics/overview` → 按注册表逐账号返回：

```
[{ id, platform, name, persona, loggedIn, archived, latest, growth, points, ageDays }]
```

- 只含 `ANALYTICS_PLATFORMS` 内的平台；`archived: false` 表示该平台不参与归档（B 站走 biliup、公众号走 mp 后台，二者都不写 `_analytics`），此时 `latest/growth/points` 为 null/空——UI 如实显示「尚未归档」，点开详情仍走现有实时抓取。
- 每个归档平台 spawn 一次 `history` 子命令（无浏览器，几十毫秒），`Promise.all` 并发；子进程失败该行降级为「无数据」，不影响其它账号。
- 路由注册在 `['GET',['analytics','platforms']]` 之后、`['GET',['analytics',':p']]` 之前（字面量先于参数路由）。
- 详情路由 `GET /api/analytics/:p?account=<id>` 增加把 `account.id` 作为 `--history-key` 传给 `fetch`，使实时抓取写入该账号自己的归档。

### 工作台 UI（沿用既有设计语言）

「创作数据」卡片内：

- **账号 chips**：`全览` + 每个归因平台账号一枚 `平台·账号名` chip（同名平台多号自然并列）。未登录账号灰显但仍可选，点开提示去账号页登录。默认落在 `全览`。
- **全览**：账号卡片网格（`.ana-acct`）。每张卡：平台小标 + 画像徽标、账号名、粉丝大数 + 当前窗口增长（复用 `growthInfo`）、迷你走势图（`points` 的 followers 折线，内联 SVG，无动画）、获赞/关注小字、`N 天前采集` 或「尚未归档」。点卡片切到该账号详情。无任何账号时保留现有「去账号页登录」空态。
- **详情**：现有三栏（概览+增长窗口 / 近 7 日环比 / 最新笔记）不变，只是数据按账索取；卡头显示「平台·账号名」。
- 缓存与自愈：`anaData` 与 localStorage `easel_analytics` 的键从平台改为**账号 id**（默认账号 id = 平台，旧缓存天然命中）；`verifyStale` 以账号 id 为键、`resolve` 回 `{platform, account}` 做登录态自愈，B 站/公众号仍跳过（走 cookie/凭证判定）。
- 详情抓取成功后同步更新全览对应行（避免回全览还要等归档重读）。

### 决策记录（用户不在场，按推荐项）

- 全览读归档快照而非每次实时抓：实时抓每个账号要起一次浏览器（数秒/个），全览会变成几十秒等待；归档本来就在每次详情抓取时更新，足够反映近期状态，且卡片上有采集时间。
- B 站/公众号不纳入归档：它们的采集走 biliup/mp 后台另一条链路，改造它们属于新采集器而非看板适配；如实显示「尚未归档」比造一份假历史诚实。

## [S3] Scope

- In scope：
  - `account_stats.py` 归档键参数化 + `history` 子命令 + selftest
  - `GET /easel/api/analytics/overview` 与详情路由的 `--history-key` 接线
  - 工作台「创作数据」：全览卡片网格、账号 chips 切换、详情按账索取数与缓存/自愈
  - 对应 CSS（全览网格 + 卡内走势图）
- Out of scope：
  - B 站 / 公众号的归档采集（如实显示未归档）
  - 跨账号聚合总量（平台内多号求和）与时间序列图表
  - 全览「一键全部刷新」（实时抓取昂贵；逐账号点开刷新即可）
  - 账号维度的工作台统计卡（已登录账号数已按账号计）

## Tasks

- [ ] T1: `account_stats.py`：`--history-key`（fetch）+ `history` 子命令（复用 growth_windows，输出 latest/growth/points/ageDays）+ selftest 断言（默认键=平台、显式键隔离、无历史时空结果） (depends: none)
- [ ] T2: `automation.js`：详情 `apiAnalytics` 传 `--history-key <account.id>`；新增 `apiAnalyticsOverview` + 路由（字面量先于 `:p`）+ `ARCHIVED_ANALYTICS` 平台集 (depends: T1)
- [ ] T3: 前端 `api.ts` 类型与 `fetchAnalyticsOverview`；`DashboardPage` 账号 chips/全览/详情按账号 + 缓存键与 whoami 自愈迁移 (depends: T2)
- [ ] T4: CSS：`.ana-acct` 卡、网格、迷你走势图、灰显 chip (depends: T3)
- [ ] T5: 验证：插件 node --test、account_stats selftest、client.js 重打包、typecheck；复审 (depends: T3, T4)

## [S4] Acceptance

- [ ] 同平台两个账号的归档各自落 `_analytics/<accountId>.jsonl`；默认账号继续写既有 `<platform>.jsonl`（升级后历史不丢、不需迁移）
- [ ] 详情抓取带 `?account=<id>` 时，增长对比读的是该账号自己的历史
- [ ] 全览一次返回所有归因平台账号的最新快照与增长窗口，不启动浏览器（响应不含浏览器启动延迟，B站/公众号标记未归档）
- [ ] 工作台创作数据卡片默认展示全览；可一键切到任一账号详情，切回全览保留数据
- [ ] 未登录账号在全览/切换中可辨识并指向账号页；无账号时保留原空态
- [ ] 插件测试全绿；`account_stats.py selftest` 通过；client.js 已重打包
