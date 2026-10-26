---
feature: easel-account-dashboard
status: delivered
updated: 2026-10-26
branch: feat/easel-account-dashboard
commits: d91e3a4153..486bc033bf
---

# 工作台创作数据：账号切换 + 全览

## Report

**What was built** — 归因归档按账号隔离：`outputs/_analytics/<accountId>.jsonl`，默认账号 id 就是平台 key，既有 `<platform>.jsonl` 无需迁移；`account_stats.py fetch` 新增 `--history-key`，并新增只读的 `history` 子命令（复用 `growth_windows`，不起浏览器，返回 latest/growth/points/ageDays）。宿主新增 `GET /easel/api/analytics/overview`（注册在 `analytics/platforms` 之后、`analytics/:p` 之前），逐账号 spawn `history` 并用 `Promise.all` 汇总；详情 `GET /api/analytics/:p?account=<id>` 把账号 id 作为归档键写入。公众号由 `weixin_mp_stats.py` 写同一目录、因此同样进全览；B 站 `biliup stats` 不写归档，全览如实标记。

工作台「创作数据」卡改为两态：默认**全览**（每个账号一张卡：平台 + 画像徽标 + 账号名 + 粉丝大数 + 当前窗口增长 + 迷你走势 + 获赞/关注/采集时间），chips 可在「全览」与任一账号间切换；详情沿用原三栏（概览与多窗口增长 / 近 7 日环比 / 最新笔记），标题带「平台·账号名」。账号清单直接来自 overview，不再叠加 `/api/accounts` 与 `/api/analytics/platforms`；未登录账号灰虚线并跳账号页，未采集/不归档各有独立文案。顺带修掉两处既有类型缺陷（`PersonaFile` 未声明、`DashboardPage` 从并不存在的 `./Sidebar` 导入 `Page`）。

**Verification** — 插件 `node --test test/*.test.js`：**267 pass / 0 fail**（新增 `test/analytics-overview.test.js` 5 例：归档按账号隔离、公众号归档可读、子进程失败只降级该行、字面量路由优先、详情传账号 id 作归档键、陈旧 id 严格 400）；`python account_stats.py selftest` 通过；`node build.mjs` 重打包 client.js；对 `DashboardPage.tsx` 手动 `tsc --noEmit --strict` 零诊断（插件无自带类型门）；仓库 `pnpm run typecheck` 5/5。视觉：Playwright + 假 API 独立预览页（1280×1000 全览/详情、430×900 窄屏），无 pageerror、横向溢出 0。独立复审两轮：首轮 2 MAJOR（公众号归档被误判为不存在并对外显示假文案；B 站 whoami 跳过误用 backend 值导致回归），修复后复审用真脚本端到端验证闭环，裁决 SHIP；第二轮另指出「失败隔离测试守卫写错、永不触发」，已修并用临时回退证明该测试会变红。

**Journey log** — ① 归档键复用注册表「默认账号 id = 平台 key」的巧劲，让既有 `<platform>.jsonl` 零迁移；② 想当然地把公众号归入「不写归档」，复审直接找到 `weixin_mp_stats.py` 里的 `record_snapshot("wechat-oa")`——跨脚本的写入点必须核实，不能从平台分类推断；③ 同理 `backend` 是枚举（`biliup`）不是平台 key（`bilibili`），跳过逻辑写错字段就静默失效；④ 新增的失败隔离测试最初断言「有数据行恰好 3 行」，但失败分支守卫写错了键名，绿的是空归档兜底——测试名不副实比没有测试更危险，需要回退验证；⑤ `--help`/docstring/README/spec 与实现同批更新，避免「读归档不校验平台」这类放宽无处可查。

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

- 只含 `ANALYTICS_PLATFORMS` 内的平台；`archived: true` 表示该平台会写 `_analytics`（`account_stats.py` 五家 + 公众号：`weixin_mp_stats.py` 同样调 `record_snapshot("wechat-oa")`）。`archived: false` 只有 B 站（`biliup stats` 不写归档），此时 `latest/growth/points` 为 null/空——UI 如实显示「该平台不写归档」，点开详情仍走现有实时抓取。
- 每个归档平台 spawn 一次 `history` 子命令（无浏览器，几十毫秒），`Promise.all` 并发；子进程失败该行降级为「无数据」，不影响其它账号。
- 路由注册在 `['GET',['analytics','platforms']]` 之后、`['GET',['analytics',':p']]` 之前（字面量先于参数路由）。
- 详情路由 `GET /api/analytics/:p?account=<id>` 增加把 `account.id` 作为 `--history-key` 传给 `fetch`，使实时抓取写入该账号自己的归档。

### 工作台 UI（沿用既有设计语言）

「创作数据」卡片内：

- **账号 chips**：`全览` + 每个归因平台账号一枚 `平台·账号名` chip（同名平台多号自然并列）。未登录账号灰显但仍可选，点开提示去账号页登录。默认落在 `全览`。
- **全览**：账号卡片网格（`.ana-acct`）。每张卡：平台小标 + 画像徽标、账号名、粉丝大数 + 当前窗口增长（复用 `growthInfo`）、迷你走势图（`points` 的 followers 折线，内联 SVG，无动画）、获赞/关注小字、`N 天前采集` 或「尚未归档」。点卡片切到该账号详情。无任何账号时保留现有「去账号页登录」空态。
- **详情**：现有三栏（概览+增长窗口 / 近 7 日环比 / 最新笔记）不变，只是数据按账索取；卡头显示「平台·账号名」。
- 缓存与自愈：`anaData` 与 localStorage `easel_analytics` 的键从平台改为**账号 id**（默认账号 id = 平台，旧平台键缓存仍可命中）；`verifyStale` 以账号 id 为键、`resolve` 回 `{platform, account}` 做登录态自愈，B 站（`biliup`）与公众号仍跳过（走 cookie / mp 会话判定）。
- 数据源：账号清单直接来自 overview 行（含 id/平台/名字/画像/登录态），不再叠加 `/api/accounts` 与 `/api/analytics/platforms` 两个请求，少一处「某接口失败就卡在加载中」的耦合。
- 归档快照增补 `following`（新增快照才有；旧条目为缺省），供全览卡片显示「获赞 / 关注」。
- 详情抓取成功后同步更新全览对应行（避免回全览还要等归档重读）。

### 决策记录（用户不在场，按推荐项）

- 全览读归档快照而非每次实时抓：实时抓每个账号要起一次浏览器（数秒/个），全览会变成几十秒等待；归档本来就在每次详情抓取时更新，足够反映近期状态，且卡片上有采集时间。
- B 站不纳入归档：它的采集走 biliup CLI、不写 `_analytics`；改造它属于新采集器而非看板适配，如实显示「该平台不写归档」比造一份假历史诚实。

## [S3] Scope

- In scope：
  - `account_stats.py` 归档键参数化 + `history` 子命令 + selftest
  - `GET /easel/api/analytics/overview` 与详情路由的 `--history-key` 接线
  - 工作台「创作数据」：全览卡片网格、账号 chips 切换、详情按账索取数与缓存/自愈
  - 对应 CSS（全览网格 + 卡内走势图）
- Out of scope：
  - B 站的归档采集（如实显示未归档）
  - 跨账号聚合总量（平台内多号求和）与时间序列图表
  - 全览「一键全部刷新」（实时抓取昂贵；逐账号点开刷新即可）
  - 账号维度的工作台统计卡（已登录账号数已按账号计）

## Tasks

- [x] T1: `account_stats.py`：`--history-key`（fetch）+ `history` 子命令（复用 growth_windows，输出 latest/growth/points/ageDays）+ selftest 断言（默认键=平台、显式键隔离、无历史时空结果） (depends: none)
- [x] T2: `automation.js`：详情 `apiAnalytics` 传 `--history-key <account.id>`；新增 `apiAnalyticsOverview` + 路由（字面量先于 `:p`）+ `ARCHIVED_ANALYTICS` 平台集 (depends: T1)
- [x] T3: 前端 `api.ts` 类型与 `fetchAnalyticsOverview`；`DashboardPage` 账号 chips/全览/详情按账号 + 缓存键与 whoami 自愈迁移 (depends: T2)
- [x] T4: CSS：`.ana-acct` 卡、网格、迷你走势图、灰显 chip (depends: T3)
- [x] T5: 验证：插件 node --test、account_stats selftest、client.js 重打包、typecheck；复审 (depends: T3, T4)

## [S4] Acceptance

- [x] 同平台两个账号的归档各自落 `_analytics/<accountId>.jsonl`；默认账号继续写既有 `<platform>.jsonl`（升级后历史不丢、不需迁移）
- [x] 详情抓取带 `?account=<id>` 时，增长对比读的是该账号自己的历史
- [x] 全览一次返回所有归因平台账号的最新快照与增长窗口，不启动浏览器（公众号读 `_analytics/wechat-oa.jsonl`，B 站标记未归档）
- [x] 工作台创作数据卡片默认展示全览；可一键切到任一账号详情，切回全览保留数据
- [x] 未登录账号在全览/切换中可辨识并指向账号页；无账号时保留原空态
- [x] 插件测试全绿；`account_stats.py selftest` 通过；client.js 已重打包
