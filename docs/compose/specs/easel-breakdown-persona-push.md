---
feature: easel-breakdown-persona-push
status: in-progress
updated: 2026-11-06
branch: feat/easel-breakdown-persona-push
worktree: .worktrees/easel-breakdown-persona-push
---

# 拆解画像归属 + 对话推送入库

## Report

## [S1] Problem

两个断点：

1. 爆款拆解与画像零关联。拆解 prompt 第 6 点用的是画像页「当前选中」的画像（用户无法按次指定）；批次 job.json 与选题卡都不记录归属；立项弹窗要手动重选画像快照——拆解、选题、立项三步的画像信息断链。
2. 对话里打磨出的内容（选中的一段文字或一条完整消息）没有入口进入选题库或素材库，只能手动复制再粘贴。

## [S2] Design

### S2.1 拆解页画像选择与全链路归属

- BreakdownPage 控件行新增「画像」下拉：选项 = `GET /easel/api/status` 的 `personas` + 空选项「跟随画像页当前画像」（默认）。解析值 = `personaPick || props.persona`，未动下拉时行为与现状一致。
- 归属语义：job.json `persona` 是采集时快照；分析与选题归属以分析时下拉解析值为准（下拉在采集完成后保持可改）。
- `POST /easel/api/deconstruct` body 增加 `persona`；宿主校验 `profiles/<persona>/` 目录存在（不存在 404「画像「X」不存在」（与包内画像路由约定一致）），校验通过后写入 job.json `persona` 字段（未指定不写）。
- 拆解 prompt：第 6 点「结合我的画像「X」」改用解析值；指令 b 的选题 JSON 在选定画像时增加 `"persona"` 字段（`JSON.stringify` 字面量，注明必须原样保留）。
- `Idea` schema 增加 `persona?: string`（拆解指定的画像；立项时默认带入快照）；宿主 `POST /easel/api/ideas` 接受 `persona` 并做同样的目录校验。
- 选题卡在来源 badge 旁显示画像 badge；立项弹窗 `personaPick` 预选 `idea.persona`（该画像已不存在时回退现状：仅一个画像时自动选，否则空）。

### S2.2 对话右键推送到选题库

- conversation 面菜单新增「存入选题库」：`createIdea({ title: 首行, note: 全文, source: '对话', status: 'pending' })`；toast 确认并派发 `easel:ideas-changed`。
- 标题自动取正文首行（去 Markdown 前缀符号、截 40 字），不打扰用户；note 存全文（与拆解选题 note 即报告同一约定）。
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

- [ ] T1: `lib/conversation-material.js` 纯逻辑 + 单测 (covers: S2.3)
- [ ] T2: 宿主路由 `POST /library/material` + `apiIdeasCreate` 接受并校验 persona (covers: S2.2, S2.3)
- [ ] T3: `apiDeconstructCreate`/`createDeconstruct` persona 校验与 job.json 记录 (covers: S2.1)
- [ ] T4: BreakdownPage 画像下拉 + prompt 与选题 JSON persona + DeconstructJob 类型 (covers: S2.1)
- [ ] T5: IdeasPage 画像 badge/立项预选/`easel:ideas-changed` 监听；OutputsPage `easel:outputs-changed` 监听 (covers: S2.1, S2.2, S2.3)
- [ ] T6: context-menu conversation 面两项推送 + api.ts 封装 + 雷达动作派发 `easel:ideas-changed` (covers: S2.2, S2.3)
- [ ] T7: README 更新 + 全量验证 (depends: T1-T6)

## [S4] Acceptance

- [ ] 拆解页可选画像（默认「跟随画像页当前画像」）；选定后创建的 job.json 带 persona，未选不写该字段
- [ ] 拆解 prompt 第 6 点与选题 JSON 的 persona 用选定画像；`POST /easel/api/deconstruct` 传不存在的画像 → 404
- [ ] 拆解产出的选题卡显示画像 badge；立项弹窗默认选中该画像；该画像已删除时回退现状逻辑
- [ ] 对话区右键（选区或整条消息）「存入选题库」：`_ideas.json` 新条目 `source='对话'`、`note=全文`、标题=首行；停留在选题库页时新卡自动出现
- [ ] 对话区右键「存入素材库」：`outputs/对话素材/<slug>-<hash8>.md` 生成且内容库页可见；同文本重复推送不产生第二个文件
- [ ] `POST /easel/api/ideas` 传不存在画像 → 404；传有效画像 → 条目含 persona
- [ ] 新单测绿；插件既有测试不回归
