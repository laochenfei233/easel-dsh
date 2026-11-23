---
feature: easel-persona-color
status: delivered
updated: 2026-11-23
branch: feat/easel-persona-color
commits: 3731d74e22..942568e07c
---

# 画像颜色 + 内容日历按画像上色

## Report

**What was built** — 画像有了可辨识的颜色：`outputs/_profile_config.json` 新增 `colors` 映射（`PUT /easel/api/profile/color` 写入/清除，name 与 #RRGGBB 服务端校验），`/easel/api/status` 下发 `personaColors`（只含现存画像）；画像页每个画像名前有色点，点开 10 色板可选色/清除回自动色；未设置显式色的画像按名字哈希从固定色板取色（同名恒同色）。内容日历的排期条目新增可选 `persona` 关联（create/update 透传，partial update 保留语义对齐 repeat），关联后日历 chip 按画像色渲染，未关联维持状态色；图例新增「画像色」说明。

**Verification** — `node --test test/persona-color.test.js` 5/5 PASS；`node --test`（插件全量）358 tests / 354 pass / 4 pre-existing skips / 0 fail；`node build.mjs` PASS（886.8kb，client.js 与 src 同步）。独立复审两轮：首轮抓出 Major（`apiProfileDefaultSet` 整文档覆写会清空 colors，已改为合并写入并做回归实证）与两个 Minor（断线闪变、类型声明缺失，均已修）；复核轮确认全部处置到位，结论 SHIP。

**Journey log** — 复审最有价值的一捕：同文件第二个写方（设默认画像）会静默清掉本特性写入的 `colors`——「本特性不改既有写方」的假设在共享存储文件上不成立，凡是往既有 JSON 加字段的特性都要审同文件其他写方。行为探针（临时目录直驱 dispatchLocalApi）先于复审抓到空名写 `colors[""]` 的边界，比等复审便宜。

## [S1] Problem

多画像运营时，内容日历上所有排期都是同一套状态色，分不清哪条内容是给哪个画像/账号做的；画像本身在界面上也没有可辨识的视觉标识。用户希望画像支持选颜色，日历按画像颜色区分展示。

## [S2] Design

### S2.1 画像颜色存储

`outputs/_profile_config.json` 已有 `defaultPersona`，扩展 `colors` 字段：`{ "画像名": "#RRGGBB" }`。服务端新增 `PUT /easel/api/profile/color`（body `{ name, color }`，name 走 `validPersonaName` + 目录存在校验 404，color 必须匹配 `/^#[0-9a-fA-F]{6}$/` 否则 400；color 传 `''` 清除）。`GET /easel/api/status` 的 payload 增加 `personaColors`（只含现存画像的键，画像被删后残留色自动不可见）。

### S2.2 自动配色

未设置颜色的画像按名字哈希从固定 10 色板取色（前端纯函数 `personaColor(name, colors)`：显式色优先，否则哈希取板），保证同一画像每次渲染同色、不同画像尽量不同色。色板避开状态色语义（不用红绿蓝的状态用色），取中饱和度可区分色。

### S2.3 画像页展示与选色

PersonaBrowser 左侧列表每项名字前加色点（用 S2.2 的解析色）。点色点弹出小色板（10 色 + 清除自定义 → 回到自动色），选中即 `PUT /easel/api/profile/color` 并刷新 status。

### S2.4 日历条目关联画像并上色

`ScheduleItem` 增加可选 `persona` 字段（服务端 create/update 透传存储，不校验画像存在——条目寿命可能长于画像）。日历编辑弹窗加「关联画像（可选）」下拉（personas 来自 shell props；空 = 不关联）。`renderChip` 的颜色决策：条目 `persona` 有解析色 → 用画像色；否则维持现有状态色。当天详情与月格共用 renderChip，自动一致。图例加一项「● 画像色 = 按关联画像着色」说明。

### S2.5 不改的部分

选题库卡片、热点雷达不做画像上色（用户只点名日历）；立项链路、话题提示词不涉及颜色；历史条目无 persona 字段自然落到状态色，无需迁移。

## [S3] Scope

- In scope：_profile_config.json 的 colors 读写 API、status 返回 personaColors、PersonaBrowser 色点+选色、CalendarPage 条目 persona 字段+上色+图例、前端 personaColor 纯函数+单测。
- Out of scope：选题库/热点雷达上色；画像重命名同步色键（改名即视为新画像回自动色）；AccountPage 的账号色。

## Tasks

- [x] T1: 服务端 readProfileConfig 扩展 colors + PUT /easel/api/profile/color + status 带 personaColors (depends: none)
- [x] T2: 前端 api.ts setProfileColor + fetchStatus 类型 + personaColor 纯函数（src/lib/persona-color.js）+ 单测 (depends: none)
- [x] T3: PersonaBrowser 色点+选色弹窗 (depends: T1, T2)
- [x] T4: CalendarPage 编辑弹窗画像下拉 + renderChip 上色 + 图例 (depends: T1, T2)
- [x] T5: shell.tsx 透传 personaColors（PageProps） (depends: T1)
- [x] T6: node build.mjs 重建 client.js；node --test 全绿 (depends: T3–T5)

## [S4] Acceptance

- [x] `PUT /easel/api/profile/color` 合法色写入、非法色 400、不存在画像 404、空串清除；status 返回 personaColors。
- [x] 画像页每个画像有名前色点，可换色/清除；未设置时显示自动分配色。
- [x] personaColor 同名稳定、显式色优先、哈希分布不撞状态色板。
- [x] 日历条目可选关联画像；关联后 chip 用画像色，未关联维持状态色；图例有说明。
- [x] node --test 插件全绿；build.mjs 语法门过。
