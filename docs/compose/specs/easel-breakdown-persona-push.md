---
feature: easel-breakdown-persona-push
status: delivered
updated: 2026-11-07
branch: feat/easel-breakdown-persona-push
worktree: .worktrees/easel-breakdown-persona-push
commits: 27da80cad6..bfa34e897d
---

# 拆解画像归属 + 对话推送入库

## Report

**What was built** — 拆解页新增「画像」下拉（空选项 = **默认画像**：画像页显式设置优先，未设置回退最初创建的画像；见 S2.1 增补），解析值进采集请求体（宿主校验后写 job.json `persona`）、拆解 prompt 第 6 点与入库选题 JSON 的 `persona` 字段；选题卡带画像 badge，立项弹窗默认带入该画像快照（画像已删除回退原逻辑）。对话区右键（选区或整条消息）新增「存入选题库」（标题留空由宿主从 note 首行推导，`source:'对话'`，全文进备注）与「存入素材库」（`outputs/对话素材/<slug>-<hash8>.md`，同文本 sha256 指纹幂等复用）；选题库/内容库页监听 `easel:ideas-changed` / `easel:outputs-changed` 刷新，热点雷达入库动作同派 ideas 事件——补上入库后停留在选题库页新卡不出现的既有缺口。

**Verification** — `node --test`（easel/dsh-plugin-easel 全量）：334 tests / 330 pass / 0 fail / 4 skip（skip 既有；含增补后新增的默认画像用例）；`node build.mjs`（esbuild 语法门）成功（3 个既有 es2024 target 警告）；`pnpm run test:docs` 6 门红与 master 基线（27da80cad6）逐门同构、无一指向本次文件；`pnpm run duplication` 2 克隆均在 backup//scripts/（既有，扫描域不含 easel/）；recorded-session 快照不覆盖拆解 prompt（grep snapshots/ 无命中，无需更新）。独立复审：spec compliance 7/7 PASS、correctness 无 critical、consistency PASS；三项跟进已处理（spec 404 笔误、slug 码点截断修复+回归测试、归属语义写入 S2.1）。2026-11-07 增补（默认画像语义）后 local-api 37 pass 含新用例、全量复跑 0 fail。

**Journey log** —
- 拆解 prompt 的选题 JSON 由 agent 按 prompt 指令落盘（宿主不校验 agent 是否照写）——`persona` 字段延续既有 `deconstruct` 字段机制，属既有架构边界，本次未改变。
- 「存入选题库」的标题推导最终收敛在宿主 `apiIdeasCreate`（空标题 → note 首行），避免客户端重复实现 `firstLineTitle`；既有调用方不受影响（表单强制非空、saveTrendTitle 传非空、热点 upsert 走 mutateIdeas 不经该路由）。
- `materialFileName` 的 slug 截断必须按码点：UTF-16 码元切会把孤立代理项写进文件名，Windows writeFile 直接 EINVAL——回归测试用「孤立代理项」正则钉住（完整代理对合法）。
- 本仓库根 .gitignore 的 `lib/` 会吞插件源 `easel/dsh-plugin-easel/lib/`，提交需 `git add -f`（复踩 hotspot-radar 记录的坑）；lefthook pre-commit 本机崩（0xC0000142），按既有惯例 --no-verify + 手动 `git diff --check`。

## [S1] Problem

两个断点：

1. 爆款拆解与画像零关联。拆解 prompt 第 6 点用的是画像页「当前选中」的画像（用户无法按次指定）；批次 job.json 与选题卡都不记录归属；立项弹窗要手动重选画像快照——拆解、选题、立项三步的画像信息断链。
2. 对话里打磨出的内容（选中的一段文字或一条完整消息）没有入口进入选题库或素材库，只能手动复制再粘贴。

## [S2] Design

### S2.1 拆解页画像选择与全链路归属

- BreakdownPage 控件行新增「画像」下拉：选项 = `GET /easel/api/status` 的 `personas` + 空选项「默认画像」（默认）。解析值 = `personaPick || defaultPersona`。
- 默认画像（2026-11-07 增补，用户拍板：不选时不用「画像页当前选中」）：`/easel/api/status` 回解析后的 `defaultPersona`——`outputs/_profile_config.json` 的显式设置（`PUT /easel/api/profile/default`，body `{name}`，不存在 404；空名清除）优先；未设置时按画像目录创建时间（birthtime）取最早的一个（「最初创建」的画像，刻意不是名字序第一个）；设置的画像被删除后自动回退到最初创建；一个画像都没有时为空串。画像页（PersonaBrowser）列表给默认画像带「默认」徽标，ProfilePage 详情头部可「设为默认画像」（onRefresh 重读 /status 同步）。
- 归属语义：job.json `persona` 是采集时快照；分析与选题归属以分析时下拉解析值为准（下拉在采集完成后保持可改）。
- `POST /easel/api/deconstruct` body 增加 `persona`；宿主校验 `profiles/<persona>/` 目录存在（不存在 404「画像「X」不存在」（与包内画像路由约定一致）），校验通过后写入 job.json `persona` 字段（未指定不写）。
- 拆解 prompt：第 6 点「结合我的画像「X」」改用解析值；指令 b 的选题 JSON 在选定画像时增加 `"persona"` 字段（`JSON.stringify` 字面量，注明必须原样保留）。
- `Idea` schema 增加 `persona?: string`（拆解指定的画像；立项时默认带入快照）；宿主 `POST /easel/api/ideas` 接受 `persona` 并做同样的目录校验。
- 选题卡在来源 badge 旁显示画像 badge；立项弹窗 `personaPick` 预选 `idea.persona`（该画像已不存在时回退现状：仅一个画像时自动选，否则空）。

### S2.2 对话右键推送到选题库

- conversation 面菜单新增「存入选题库」：`createIdea({ title: '', note: 全文, source: '对话', status: 'pending' })`；标题留空由宿主 `apiIdeasCreate` 从 note 首行推导（`firstLineTitle`：剥 Markdown 行首记号、截 40 字）；toast 确认并派发 `easel:ideas-changed`。
- 既有 createIdea 调用方不受影响：IdeasPage 表单强制非空标题、saveTrendTitle 传非空标题、热点正文 upsert 走 `mutateIdeas` 注入不经该路由。
- IdeasPage 监听 `easel:ideas-changed` 触发 `load()`；热点雷达 `captureTrend`/`saveTrendTitle` 同步派发该事件（修复入库后停留在选题库页不刷新的既有缺口）。

### S2.3 对话右键推送到素材库（内容库目录）

- conversation 面菜单新增「存入素材库」：`POST /easel/api/library/material` body `{ text }`。
- 宿主：标题 = 正文首行、slug ≤24、正文 sha256 前 8 位作指纹 → 写 `outputs/对话素材/<slug>-<hash8>.md`（tmp+rename 原子写；同文本同文件名幂等，返回 `reused` 标记）；Markdown 组装带来源头（照热点正文 `composeArticleMarkdown` 模板：引用块头部，不用 frontmatter）。
- 纯逻辑（首行标题/slug/hash/markdown 组装/文件名）放 `lib/conversation-material.js`，路由挂 `CORE_ROUTES`（`['POST', ['library', 'material'], …]`）。
- 客户端 `api.ts` 封装 `pushConversationMaterial`；OutputsPage 监听 `easel:outputs-changed` 刷新，推送动作派发该事件。

## [S3] Scope

- In scope:
  - 拆解页画像下拉 + job.json/选题卡/立项弹窗全链路 persona
  - 对话面右键两项推送（选题库 / 素材库→内容库 `outputs/对话素材/`）
  - 选题库、内容库页的刷新事件
  - `lib/conversation-material.js` 单测；deconstruct persona 与 ideas persona 用例
  - `easel/dsh-plugin-easel/README.md` 相应段落
- Out of scope:
  - `outputs/_deconstruct` 按画像分桶与旧批次迁移
  - 推送到项目素材目录（`projects/<safe>/素材/文本/`）
  - 推送时弹窗改标题
  - dsh 会话/工作区数据模型的 persona 字段（SessionHeader/WorkspaceRecord 不动）
  - 热点雷达正文抓取逻辑本身

## Tasks

- [x] T1: `lib/conversation-material.js` 纯逻辑 + 单测 (covers: S2.3)
- [x] T2: 宿主路由 `POST /library/material` + `apiIdeasCreate` 接受并校验 persona (covers: S2.2, S2.3)
- [x] T3: `apiDeconstructCreate`/`createDeconstruct` persona 校验与 job.json 记录 (covers: S2.1)
- [x] T4: BreakdownPage 画像下拉 + prompt 与选题 JSON persona + DeconstructJob 类型 (covers: S2.1)
- [x] T5: IdeasPage 画像 badge/立项预选/`easel:ideas-changed` 监听；OutputsPage `easel:outputs-changed` 监听 (covers: S2.1, S2.2, S2.3)
- [x] T6: context-menu conversation 面两项推送 + api.ts 封装 + 雷达动作派发 `easel:ideas-changed` (covers: S2.2, S2.3)
- [x] T7: README 更新 + 全量验证 (depends: T1-T6)
- [x] T8: 宿主默认画像——`_profile_config.json`、`/status defaultPersona`、`PUT /profile/default`、保护名单 (covers: S2.1 增补)
- [x] T9: shell store `defaultPersona` + PersonaBrowser 默认徽标 + ProfilePage「设为默认画像」 (covers: S2.1 增补)
- [x] T10: BreakdownPage 空选项切「默认画像」语义 + 默认画像测试 (covers: S2.1 增补)

## [S4] Acceptance

- [x] 拆解页可选画像（空选项 = 默认画像，见 S2.1 增补）；选定后创建的 job.json 带 persona，未选不写该字段
- [x] 拆解 prompt 第 6 点与选题 JSON 的 persona 用选定画像；`POST /easel/api/deconstruct` 传不存在的画像 → 404
- [x] 拆解产出的选题卡显示画像 badge；立项弹窗默认选中该画像；该画像已删除时回退现状逻辑
- [x] 对话区右键（选区或整条消息）「存入选题库」：`_ideas.json` 新条目 `source='对话'`、`note=全文`、标题=首行；停留在选题库页时新卡自动出现
- [x] 对话区右键「存入素材库」：`outputs/对话素材/<slug>-<hash8>.md` 生成且内容库页可见；同文本重复推送不产生第二个文件
- [x] `POST /easel/api/ideas` 传不存在画像 → 404；传有效画像 → 条目含 persona
- [x] 拆解页空选项 = 默认画像：显式设置立即生效（`/status` 回解析值）、未设置回退最初创建（birthtime 最早，非名字序）、设置的画像被删后回退、清除设置回到回退值；画像页可设默认（徽标 + 设为默认按钮）；`PUT /profile/default` 传不存在画像 → 404
- [x] 新单测绿；插件既有测试不回归
