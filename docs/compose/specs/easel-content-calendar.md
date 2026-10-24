---
feature: easel-content-calendar
status: designed
updated: 2026-10-24
branch: feat/easel-content-calendar
worktree: .worktrees/easel-content-calendar
commits: 5d6def5656..(pending)
---

# 内容日历增强：节假日底图 / CalDAV 订阅 / 右键添加节日

## Report

## [S1] Problem

内容日历页（`src/components/CalendarPage.tsx` + `index.js` schedule 路由）已有排期与平台活动模型，但没有节假日底图：用户看不到哪天放假、哪天调休上班、今天是春节还是双 11，做内容规划全靠脑记。同时：日历事件无法从用户已有的日历服务（iCloud / Fastmail / Nextcloud 等 CalDAV 服务）导入；想在数据集之外补一个自己关心的节日（公司周年庆、行业节点）没有入口。

## [S2] Design

三层叠加：**内置节假日底图**（纯客户端）+ **CalDAV 只读订阅**（服务端同步、客户端展示）+ **右键自定义节日**（复用 schedule 活动模型）。

### 1. 节假日底图（内置离线数据，已拍板）

纯客户端，无新网络请求、无新依赖：

- `src/lib/lunar.js`（plain JS，可被 `node --test` 直测）— 经典位表农历算法（1900–2100），导出 `lunarFestivalsFor(year, month)`：春节、元宵、龙抬头、端午、七夕、中元、中秋、重阳、腊八、除夕，另按节气公式算清明。
- `src/data/holidays-cn.js` — vendor 最近年度法定节假日+调休（holiday-cn 数据转成紧凑映射：`{ 'YYYY-MM-DD': ['名称', 1|0] }`，1=休 0=班），首版覆盖 2025–2026；未公布年份随版本更新数据，无数据年份不显示休/班角标。
- `src/lib/festivals.js` — `festivalsFor(year, month)` 合并三层：法定（休/班）> 农历传统 > 固定公历/国际/电商节日（情人节、妇女节、母亲节/父亲节/感恩节等浮日、儿童节、教师节、万圣节、圣诞、618/双11/双12 等），返回 `Map<ymd, Festival[]>`，`Festival = { name, kind: 'statutory-rest' | 'statutory-work' | 'lunar' | 'fixed' }`。法定数据优先，重名去重。
- `CalendarPage.tsx` 渲染：日期数字旁加角标——法定休=红「休」、调休班=灰「班」、节日=琥珀色短名称标签（截断一行，最多 2 个，悬停看全）；当天详情弹窗顶部列出节日条目；图例补 休/班/节日 三项。样式续用 `cal-*` 前缀（`src/styles/index.css`）。

### 2. 右键添加节日

- 日期格 `onContextMenu` → 本地右键菜单（绝对定位，外点/Esc 关闭）：**添加节日…**（表单预填 `kind=event, event_type=节日`，新增「每年重复」勾选 → `repeat: 'yearly'`）、**添加平台活动…**、**添加排期…**；分隔线下列出当天已有的自定义节日（source=manual 且 event_type=节日），每项带删除。
- 服务端 `apiScheduleCreate/Update` 接受并校验 `repeat: '' | 'yearly'`（其余拒绝/清空）。
- 客户端按渲染窗口展开 `repeat: 'yearly'`（月/日匹配即落格）；编辑/删除始终作用于锚点条目本身。

### 3. CalDAV 只读订阅（单向，已拍板）

服务端（Node 内建 `http/https` 已在 index.js 引入，协议纯函数放独立模块）：

- `caldav.js`（插件根，plain ESM，零依赖）— 纯函数：ICS 行 unfold、VEVENT 解析（SUMMARY/DTSTART/DTEND/RRULE/EXDATE/UID/LOCATION/DESCRIPTION）、RRULE 展开（FREQ=DAILY/WEEKLY/MONTHLY/YEARLY + INTERVAL/COUNT/UNTIL + WEEKLY BYDAY + MONTHLY BYMONTHDAY；不支持的分隔符回退为仅首实例，`ponytail:` 注明升级路径）、multistatus XML 提取（命名空间前缀无关）、HTTP Basic 请求封装（注入 requester 便于测试）。
- 发现链：PROPFIND `current-user-principal` → `calendar-home-set` → Depth:1 列日历集合；输入 URL 本身是日历或直接列出日历时跳过发现。直填日历 URL 与自动发现都支持（用户拍板 1+3）。
- index.js 新路由（沿用路由表与 `outputs/` JSON store 模式）：
  - `GET/PUT caldav/accounts` — 配置存 `_caldav_config.json`（`{ accounts: [{ id, name, url, username, password, enabled, color }] }`）；GET 返回掩码密码（复用 `maskValue`），PUT 空密码保留旧值。
  - `POST caldav/accounts/:aid/discover` — 返回可订阅日历列表 `[{ href, displayname }]`。
  - `POST caldav/accounts/:aid/sync` — REPORT calendar-query，窗口 [今天−60d, 今天+300d]，解析+RRULE 展开写 `_caldav_cache.json`（`{ byAccount: { aid: { syncedAt, events } } }`）。
  - `GET caldav/events` — 返回缓存事件，客户端按月过滤。
- 事件模型：`{ uid, title, start, end?, allDay, location?, description? }`；`VALUE=DATE` 全天；UTC 转本地；TZID 按本地墙钟处理（`ponytail:` VTIMEZONE 解析为升级路径）；CANCELLED 丢弃；RECURRENCE-ID 覆盖不支持（回退首实例）。
- 客户端：页头「订阅日历」按钮 → 弹窗管理账号（增删改、探测日历下拉、单账号立即同步、最近同步时间）；网格上 CalDAV 事件为只读 chip（空心圆点+账号色，与可编辑排期区分），点击进当天详情只读展示；挂载时缓存超过 24h 自动静默同步一次。
- 凭据明文存于工作区 `outputs/_caldav_config.json`（本地桌面应用、本机数据目录），API 响应一律掩码。

### 4. 版本与测试

- 插件版本 0.2.16 → 0.2.18（0.2.17 已被 radar 分支占用）。
- UI 文案延续本插件现状（中文直书，非 locale-owned 管辖面）。

## [S3] Scope

- In scope:
  - 内置节假日/农历/国际节日底图渲染（月网格 + 当天详情 + 图例）
  - 右键菜单添加节日/平台活动/排期，自定义节日支持每年重复
  - CalDAV 账号管理、发现、只读同步、事件叠加展示
  - `caldav.js`/`lunar.js`/`festivals.js` 单测 + 路由行为测试 + 客户端构建
- Out of scope:
  - CalDAV 双向写回、Google OAuth、VTIMEZONE/RECURRENCE-ID 精确解析
  - 周视图/年视图、农历节气整排显示
  - 日历建议（schedule context suggestions）结合节日生成选题
  - 节假日数据在线更新

## Tasks

- [ ] T1: 节假日数据层：`lunar.js` + `holidays-cn.js`（vendor 2025–2026）+ `festivals.js`，单测覆盖关键日期（2026 春节/中秋/清明、浮日节日、法定优先去重）(depends: none)
- [ ] T2: 日历格节假日渲染 + 当天详情节日条目 + 图例 + `cal-*` 样式 (depends: T1)
- [ ] T3: schedule `repeat` 字段（服务端校验 + 客户端年度展开）+ 右键菜单（添加节日/活动/排期、删除已有自定义节日）+ 测试 (depends: T2)
- [ ] T4: `caldav.js` 协议纯函数（ICS/RRULE/multistatus/Basic 请求）+ 单测 (depends: none)
- [ ] T5: 服务端 CalDAV 路由（accounts 掩码读写 / discover / sync / events 缓存）+ 路由行为测试 (depends: T4)
- [ ] T6: 客户端订阅弹窗 + 网格只读 chip + 挂载过期自动同步 + api helpers (depends: T5)
- [ ] T7: 验证与复审：`node --test` 全绿、`node build.mjs` 成功，compose-next review (depends: T2, T3, T6)

## [S4] Acceptance

- [ ] 打开内容日历当月：法定节假日显示红「休」+名称、调休显示灰「班」、农历/国际/电商节日显示名称标签；当天详情与图例同步呈现；无网络时同样显示（纯内置数据）。
- [ ] 测试断言关键日期：2026 春节（2/17 起）、2026 中秋、2026 清明、2026 母亲节（5 月第 2 个周日）标注正确；法定数据与固定节日重名时只出现一条。
- [ ] 右键日期格弹出菜单：三项添加动作可达对应预填表单；「每年重复」的自定义节日当年与次年同月日都落格；右键菜单可删除已有自定义节日。
- [ ] 订阅日历弹窗可添加账号并探测日历；立即同步后事件以只读 chip 出现在网格与当天详情；`GET caldav/accounts` 响应中密码为掩码；PUT 空密码保留原值。
- [ ] 协议单测：ICS unfold、四种 FREQ 的 RRULE 展开（含 INTERVAL/COUNT/UNTIL/BYDAY）、EXDATE 排除、multistatus 解析（无前缀/带前缀）、发现链 fixture。
- [ ] `node --test` 全绿（现有 129+ 用例不回归），`node build.mjs` 构建成功。
