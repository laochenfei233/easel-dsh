---
feature: easel-topic-persona-switch
status: delivered
updated: 2026-11-21
branch: feat/easel-topic-persona-switch
commits: b8870de87f..bc368a31fe
---

# 选题画像切换（做内容 / 立项带画像）

## Report

**What was built** — 三张选题面（选题库、内容日历、热点雷达）的「做内容」现在都先过共享画像弹窗 `TopicPersonaDialog`（空选 = 默认画像，解析 = 所选 || 宿主默认画像；还没建任何画像时保持原一键直进），确认后进入新会话，提示词末尾追加「本次创作结合我的画像「X」（画像资料在 profiles/X/，动笔前先读取）。」。内容日历与热点雷达新增「🚩 立项」入口：日历在内容条目编辑弹窗底部（吃当前表单值，source=内容日历），雷达在行/关注卡/聚合卡的动作区（source 沿用雷达来源文案）；立项弹窗抽成共享 `GreenlightDialog`（选题库预选规则与「不带入」语义原样保留），服务端 projectize 无改动。`topicPrompt` 抽成 `src/lib/topic-prompt.js` 纯模块并带单测；api.ts 的 `projectizeTopic.ideaId` 放宽为可选。

**Verification** — `node --test test/topic-prompt.test.js` 7/7 PASS；`node --test`（插件全量）353 tests / 349 pass / 4 pre-existing skips / 0 fail（复审独立复跑一致）；`node build.mjs` PASS（881.4kb，2 个既有 es2024 tsconfig warning），重跑后 `git status` 干净证明提交的 client.js 与源码产物逐字节一致。复审（独立 subagent）三结论：spec 符合度高（S4 五条全 PASS + 一处 minor 当场修复）、无正确性 bug、一致性良好，总评 SHIP。

**Journey log** — 立项端点 `POST /easel/api/projectize` 早已支持 persona 与无 ideaId 播种，本特性纯客户端接线、零服务端改动。Dashboard 工作台的做内容点击是第四个同语义入口，用户点名三页故明确排除。client 插件无类型检查门，esbuild 只验语法——纯函数抽到 `.js` 模块（context-menu-model.js 先例）换来了 node --test 可跑的 7 条单测。

## [S1] Problem

画像目前只在两处可作用于创作：爆款拆解页的采集下拉（进 job.json 与拆解提示词）和选题库的立项弹窗（预选拆解带入的画像、可改选后快照进项目）。三张选题面的「做内容」——选题库卡片、热点雷达行、内容日历条目——都不带画像，进会话的提示词不知道该以哪个人设动笔；内容日历与热点雷达也没有立项入口，想把日历排期或热点直接立项只能先入库再回选题库操作。

## [S2] Design

### S2.1 「做内容」画像弹窗

新增共享组件 `TopicPersonaDialog`（复用既有 overlay/modal 样式）：打开时 `fetchStatus` 取画像列表与宿主默认画像；下拉空选项 =「默认画像（X）」（无画像时文案「不带画像」），确认后把解析画像 = 所选 || 默认画像 交给调用方——与拆解页空选语义一致。画像列表为空（装好还没建画像）时，页面跳过弹窗直接走原流程，不弹无意义的确认。

### S2.2 提示词注入

`topicPrompt` 从 shell.tsx 抽到 `src/lib/topic-prompt.js` 纯 JS 模块（context-menu-model.js 先例：为 node --test 可导入），shell 改为导入使用；仓库内无其他消费者，不做 re-export。新增 persona 参数：非空时在既有 base/body/project 三段后追加一行「本次创作结合我的画像「X」（画像资料在 profiles/X/，动笔前先读取）。」；空则不追加。`useTopic` / `PageProps.onUseTopic` 增加第 4 参 persona，既有调用方（DashboardPage 等）不传 = 行为不变。

### S2.3 共享立项弹窗

把 IdeasPage 的立项弹窗抽成共享 `GreenlightDialog`：打开时 `fetchStatus`，预选逻辑沿用现状（ideaPersona 仍存在则带入，否则唯一画像自动选，再否则空）；空选项仍是「不带入」；确认 = POST /easel/api/projectize（服务端已支持 persona 与无 ideaId）+ ws.create，失败在弹窗内显示错误。api.ts 的 `projectizeTopic` 类型 `ideaId` 放宽为可选（服务端早已按可选处理）。

### S2.4 三页接线

- 选题库 IdeasPage：做内容改走 TopicPersonaDialog（确认后 `onUseTopic(title, projectDir, bodyPath, 画像)`）；立项弹窗换用共享 GreenlightDialog，本页 personas/personaPick 状态与 fetchStatus 采集随之删除。
- 内容日历 CalendarPage：内容类条目（非活动）在编辑弹窗底部加「做内容」「🚩 立项」按钮，用当前表单值做动作，点开先关编辑弹窗；立项 source 固定「内容日历」。日历条目无 projectDir/ideaId。
- 热点雷达 TrendsPage：行与聚合卡在「做内容」旁加「立项」按钮（复用 trend-use 样式），做内容改走 TopicPersonaDialog；立项 source 沿用行自带来源文案（微博热搜等）；立项成功补 toast 反馈。

### S2.5 服务端

无改动。POST /easel/api/projectize 的 persona 校验、画像快照、无 ideaId 直播种均已存在。

## [S3] Scope

- In scope：上述两弹窗、topicPrompt 注入、三页接线、api.ts 类型放宽、topic-prompt 纯模块单测。
- Out of scope：工作台 DashboardPage 的做内容点击（用户点名三页，维持现状）；对话右键推送入库链路；日历条目立项后的状态回写（条目无 projectDir 字段，不加新列）；选题库做内容后回写画像到选题卡。

## Tasks

- [x] T1: 抽 `src/lib/topic-prompt.js`（topicPrompt 加 persona 参数 + pickGreenlightPersona 纯函数），shell.tsx 改导入，新增 test/topic-prompt.test.js (depends: none)
- [x] T2: shell.tsx useTopic/topicPrompt/PageProps 加 persona 参数；api.ts ideaId 可选 (depends: T1)
- [x] T3: 新建 `src/components/PersonaDialogs.tsx`（TopicPersonaDialog + GreenlightDialog） (depends: T1)
- [x] T4: IdeasPage 接线：做内容弹窗、立项换共享组件、删本地画像状态 (depends: T2, T3)
- [x] T5: CalendarPage 内容条目加 做内容/立项 (depends: T2, T3)
- [x] T6: TrendsPage 行/聚合加 立项、做内容弹窗 (depends: T2, T3)
- [x] T7: node build.mjs 重打 client.js；node --test 全绿 (depends: T4–T6)

## [S4] Acceptance

- [x] 选题库点「做内容」：有画像时弹画像下拉，确认后新会话提示词含「结合我的画像「X」」；无画像时行为与现在一致。
- [x] 热点雷达行/聚合卡：做内容同上；新增「立项」按钮，立项后 projects/&lt;safe&gt;/ 出现且含画像快照（选了画像时）。
- [x] 内容日历内容条目：编辑弹窗出现「做内容」「🚩 立项」；立项 source=内容日历。
- [x] 选题库立项弹窗行为不回归：预选拆解画像、空选不带入、重复立项幂等。
- [x] node --test 插件全绿；build.mjs 语法门过。
