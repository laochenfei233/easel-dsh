---
feature: easel-idea-trend-persona-color
status: delivered
updated: 2026-11-23
branch: feat/easel-idea-trend-persona-color
commits: 4c8c7caa9a..HEAD
---

# 选题库与热点雷达的画像上色

## Report

**What was built** — 热点雷达的「收藏到选题库」在有画像时先过共享画像弹窗（确认按钮「收藏」，解析 = 所选 || 默认画像），选题卡带 persona 入库，零画像保持一键收藏，成功 toast 带画像名；选题库卡片把文字 badge 升级为画像色点 + 画像名（与日历同一 personaColor 来源）；新建/编辑选题弹窗加「关联画像（可选）」下拉；服务端 ideas update 对 persona 做三态透传（undefined 保留 / 空串清除 / 非空校验存在否则 404），校验在 mutateIdeas 之前完成。

**Verification** — `node --test`（插件全量）358 tests / 354 pass / 4 pre-existing skips / 0 fail；`node build.mjs` PASS（888.6kb）；行为探针（临时目录直驱 dispatchLocalApi）实证 update 三态 + 未知画像 404 全 PASS。独立复审：S4 四条全 PASS，无 critical，两个 minor（画像删除后的编辑 404、三态无新增回归测试）均属 spec 明选范围，结论 SHIP。

**Journey log** — 在 Object.assign 的对象字面量里写 `await (async () => …)()` 是语法错误（对象方法不是 async 上下文）——带校验的字段更新应把异步解析提到 mutateIdeas 队列之外，回调保持同步。

# 选题库与热点雷达的画像上色

## [S1] Problem

画像颜色已落在内容日历（easel-persona-color），但两张上游选题面还是无画像视觉：选题库卡片只有文字 badge「画像 X」；热点雷达收藏入库时根本不选画像，收藏的选题全部无归属，后续日历排期也就无画像色可继承。用户要求选题库/热点雷达也做画像上色。

## [S2] Design

### S2.1 颜色来源（复用，不新增）

颜色一律走 easel-persona-color 既有链路：`personaColor(name, personaColors)`（显式优先→哈希自动色）+ shell 的 `personaColors`。本特性不新增任何颜色存储或 API。

### S2.2 热点雷达：收藏时选画像

雷达行/聚合卡的「收藏到选题库」改为先弹共享画像选择（复用 TopicPersonaDialog 的画像清单拉取与空选=默认画像语义，但按钮文案为「收藏」）：确认后 `createIdea({ title, source, status: 'pending', persona: 所选||默认 })`；零画像时保持现有一键收藏。成功后 toast「已收藏到选题库（画像 X）」。`saved` 集合按标题去重逻辑不变。

### S2.3 选题库：卡片色点 + 编辑可选画像

- 卡片：把现有文字 badge「画像 X」升级为 色点+画像名（色点用 personaColor），放在标题行下与 source badge 同排；无画像不变。
- 新建/编辑弹窗加「关联画像（可选）」下拉（personas 来自 shell props，空=不关联）。
- 服务端 `apiIdeasUpdate` 透传 persona：与 create 同一校验（非空必须存在→404）；字段缺失（undefined）保留原值、显式空串清除——与 schedule update 的三态一致。IdeaInput 类型加 `persona?: string`。

### S2.4 不改的部分

Dashboard 工作台、立项链路、做内容提示词（easel-topic-persona-switch 已带画像）均不动；雷达「做内容」已有画像弹窗，不动。

## [S3] Scope

- In scope：TrendsPage 收藏弹窗与 payload、IdeasPage 卡片色点与表单下拉、api.ts IdeaInput、服务端 apiIdeasUpdate persona 三态、client.js 重建。
- Out of scope：Dashboard、项目工作区、右键推送入库链路（对话推送仍不带画像）、画像改名同步。

## Tasks

- [x] T1: 服务端 apiIdeasUpdate persona 透传（三态） (depends: none)
- [x] T2: api.ts IdeaInput.persona + TrendsPage 收藏选画像弹窗 (depends: none)
- [x] T3: IdeasPage 卡片色点 badge + 表单画像下拉 (depends: T1)
- [x] T4: node build.mjs 重建 client.js；node --test 全绿 (depends: T1–T3)

## [S4] Acceptance

- [x] 雷达收藏：有画像时先弹画像选择，确认后选题卡带 persona；零画像一键收藏不回归。
- [x] 选题库卡片：有画像的选题显示 色点+画像名，颜色与日历同源（同一 personaColor）。
- [x] 选题库新建/编辑可选关联画像；update 不带 persona 字段不清除原值，显式空串清除，非法名 404。
- [x] node --test 插件全绿；build.mjs 语法门过。
