---
feature: easel-breakdown-fullpage
status: delivered
updated: 2026-10-17
branch: feat/easel-breakdown-page（NSIS 实机验收用 EASEL_REPO 指向本 worktree 打包）（Easel 仓 worktree .worktrees/easel-breakdown-page）
commits: e4c77b4/de85b28/649e429（feat/easel-breakdown-page；含 stdout 排空修复与确定性超时）/ 4723ad0（插件 0.2.1：stamp 门重同步杠杆，配合 alpha.3 打包）；f00479c（pipeline 递归修复+回归测试）/ 86e86c8（0.2.2）/ 79df436（模型下拉+设置页+登录门控；dsh 侧 dcd85ea257 目录 inputModalities；NSIS=alpha.6）
---

# 爆款拆解完整页：链接 → 拆分流程 → agent/LLM 分析 → 报告入库

## [S1] Problem

现有 BreakdownPage 只有 99 行：贴文本/链接 → 前置一段「按 SKILL.md 执行视频链路」的
prompt → pushTask 推给对话回合 → 完成后跳选题库。用户要求完整页面化：从输入链接开始，
**下载视频 → 拆分（抽帧+ASR 转写，可在页面选 ASR 模型与视频阅读模型）→ agent/LLM 分析
→ 输出报告 → 入库（选题库）** 全程可见、可控。页面视觉融合 Easel 现有 Apple 设计层，
信息架构可借鉴 MetaHuman4_V1（链接→文案→改写→成片的步骤流水线 UI：步骤条+分阶段
toast 进度+状态色系）。

执行架构拍板：**混合式**——宿主半直驱机械步骤（下载/抽帧/ASR，真进度），分析回合推给
agent（视觉模型用户选）。

## [S2] Design

### 数据流（混合式三段）

```
[输入] 链接/文本 + 模型选择
   ↓ 宿主直驱（进度实时）
[1 采集] video_fetch 下游产物 → outputs/_deconstruct/<id>/
   ├─ source.mp4（下载失败/不可用时给明确错误+fallback 提示）
   ├─ frames/f-0001.jpg…（ffmpeg 抽帧，1/2s 一帧或关键帧）
   ├─ audio.wav → subtitles.srt（ASR 路由 /easel/api/asr，mimo 默认）
   └─ meta.json（平台/时长/标题/各阶段耗时）
   ↓ pushTask（带产物清单摘要 + 页面选的模型）
[2 分析] agent 会话回合：Read 直读 frames + SRT → 六点拆解报告
   （沿用现有六点协议 + 结果写入选题库 outputs/_ideas.json）
   ↓ 轮次结束（running 边沿）后页面读回
[3 报告] 页内直接渲染完整 Markdown 报告（不只有「去对话看」）+
   同步入库按钮 / 自动入库状态
```

### 页面结构（Apple 设计层内）

单页三区，不引入路由组件新框架（沿用 esbuild TSX + apple.css）：

- **顶区**：大输入框（链接或文案）+ 「开始拆解」主按钮 + 两枚模型下拉（ASR 模型——
  dsh 模型管理 registry 里标 `asr` 能力或用户 provider 自定；视觉模型——`selectModel`
  可达的模型列表拉取，显示当前会话选中）。
- **中区（流程带）**：三步骤条（1 采集 2 分析 3 报告）常驻；采集步展开显示
  下载/抽帧/ASR 三个子进度（字节进度、帧数计数、转写秒数），分析步显示回合状态
  与模型名。失败态就地显示错误+重试（如下载失败给「改用手动上传文件」提示位）。
- **下区（成果）**：报告 Markdown 渲染（沿用 apple.css 既有 Markdown 样式）+
  「已存入选题库」确认行 + 帧画廊（横滑缩略图，来自 frames/）+ 视频预览。

### 宿主半新增路由（index.js）

复用既有 B1 模式（local-first 局部路由，`sameOriginAllowed` 守卫，AI 沙箱下的
node --test 可测），新增：

1. `POST /easel/api/deconstruct` — 收 {url, asrModel?, visionModel?}，创建任务 id，
   后台顺序执行 video_fetch → ffmpeg 抽帧 → ASR 路由 → meta.json 落盘；
   SSE 或轮询两选（**取轮询**，与 B1 风格一致、无长连接状态机）：`GET
   /easel/api/deconstruct/<id>` 返回 {stage, pct, detail}；产物全落
   `outputs/_deconstruct/<id>/`。
2. `GET /easel/api/deconstruct/:id` — 状态轮询（含 stage 状态机：fetch→frames→asr→
   ready/failed，错误信息透传）。
3. `GET /easel/api/models` — 透传 dsh 模型管理 registry（ASR/视觉两用，页面据此
   渲染两个下拉；缓存 60s）。
4. 分析阶段沿用 pushTask（B3 已交付通道）——页面把「模型选择」以 prompt 指令 +
   `selectModel` 组合（若 selectModel 可达；不可达则在 prompt 里指示用户手动
   切换），产物落 `outputs/_deconstruct/<id>/report.md`（agent 写文件）+ 页面
   Read 回来渲染，六点选题入库照旧走 `_ideas.json`。

### ASR/视觉模型接入现实

- ASR：复用 runner-node-port 已交付的 `POST /easel/api/asr`（mimo 网关→ wav→SRT），
  本任务只加「模型可从页面选」：`GET /easel/api/models` 列出的 ASR-capable 模型 id
  传给 asr 路由（其内已支持从 dsh 模型管理读 provider 凭据；mimo 为默认）。
- 视觉模型：`sessions.selectModel`（dsh 已有 Remote）——页面在 pushTask 前对**新分析
  会话**调用，选用户指定模型（catalog 由 `/easel/api/models` 提供，前端只列感知
  图像输入的模型 inputModalities 含 image，后端已做该判定）。

### 视觉规范（frontend-design 内化，不写 code 里）

沿用 Easel apple.css 主题（SF 义体感、白卡、克制色板），借鉴 MetaHuman4 的
**结构词汇**而非配色：步骤条（1 采集 · 2 分析 · 3 报告）、状态色（就绪绿/进行琥珀/
失败红/分析蓝/完成灰）、分区标题「短竖线+粗字」。签名元素=**流程带**：把当前所处的
采集子阶段（下载/抽帧/转写）画成一条有进度的「胶片带」，是这页被记住的唯一视觉修辞。
不动设计层文件，新增样式全部写进组件内联/新增 breakdown.css 小节（apple.css 不追改）。

## [S3] Scope

- In scope：BreakdownPage 全量重写（前端）；index.js 四条 deconstruct/models 路由；
  lib 端 deconstruct 编排器（video_fetch→抽帧→ASR 顺序编排+状态机）；PushTask 联动
  （selectModel+产物协议）；测试；本 spec。
- Out of scope：asr 路由与 video_fetch 本体改造（已交付面，仅消费）；不同平台的
  前置 cookie 补齐（沿用 easel-video-breakdown T6 待办）；选题库页/画像页改动；
  MetaHuman4 代码抄取（只借信息架构与文案词汇）。

## Tasks

- [x] T1: lib/deconstruct.mjs 编排器 + 三态状态机 + 轮询状态路由（node --test）
  (depends: none)
- [x] T2: /easel/api/models 模型列表路由（registry 缓存+ASR/视觉两栏标记）
  (depends: none)
- [x] T3: BreakdownPage 前端重写（顶区表单+流程带+成果区；pushTask+selectModel 接入）
  (depends: T1, T2)
- [x] T4（机械段已验，agent 段待新链接）: MIMO key 已在 Easel/.env；旧验证链接 iRNBho6 已过期（跳转到用户主页，video_fetch 快速明确报错 ✓）。对拍工具就位：worktree 根 smoke-deconstruct.mjs，用户贴新链接跑 `node smoke-deconstruct.mjs` 即得产物/报告。期间修出两个真实缺陷：子进程 stdout 未排空致管道死锁、job.json 半截读。 (depends: T3)
- [ ] T5: spec finalize（评审意见回收）(depends: T4)


## 设计增补（2026-10-17，用户拍板：模型走模型管理、cookie 进设置、无登录不启动）

用户三条硬性要求：①ASR 模型与视觉模型**从 dsh 模型管理里选**（下拉），不手填；
②cookie 在**设置里添加**，且允许先让 agent 登录对应平台再抓取；③缺 cookie/登录时
**拆解工作流不启动**。设计：

- **模型目录数据源**：`remote.session.modelCatalog()`（与模型管理同一份数据，会话无关）。
  dsh 侧 `ModelCatalogModel` 增补可选 `inputModalities`（buildModelCatalog 从
  resolveModelInfo 透传，EASEL-DIVERGENCE 标记）——此前目录不带能力标注，视觉模型
  无法过滤。BreakdownPage 两个 `<select>`（按 provider optgroup 分组）：ASR 默认选
  id/name 含 `asr` 的模型（MiMo-V2.5-ASR），全部模型可选；视觉模型下拉只列
  `inputModalities` 含 `image` 的，目录一个都没标注时回退全列并提示「所选模型必须
  支持图像输入」；空选项 = 跟随会话当前模型。
- **数据源登录态归属账号页**（2026-10-17 用户纠正：cookie 是平台账号态，不单开设置页；
  原独立「设置」轨道页已删）：`AccountsPage` 尾部新增「拆解数据源」section——平台行
  （抖音=免登录直连；小红书=cookie 粘贴/清除 + 已配置/已扫码/未配置状态；B站/YouTube=免
  登录），与既有扫码登录同一页完成。宿主路由不变：`GET /easel/api/source-status`
  （绝不回显 cookie 明文）与 `POST /easel/api/cookies`（`{platform, cookie}` 合并写
  `outputs/_deconstruct/cookies.json`，空串=清除该平台）。纯函数在 `lib/sourcedata.js`
  （parsePlatform/sourceStatus/writeCookie），node:test 覆盖。
- **登录门控**：BreakdownPage 点「开始采集」先查 source-status；平台需要登录
  （小红书）且 cookie 未配置且 `outputs/_login/<platform>.json` 非 loggedIn → 阻断面板
  提供三条路：「去设置填写 cookie」「去账号页扫码登录」（复用 AccountsPage 的 QR 流）、
  「让 Agent 在对话里登录」（pushTask 按技能登录指引执行并回填状态文件）。
  三条路任一完成后回本页重试，preflight 重新检查；**工作流在此之前不创建任务**。


### cookie 回传链（2026-10-17 用户实机反馈：手动登录成功但 cookie 没回传）

发布侧登录与拆解 cookie 原是断链：`_login/xiaohongshu.json` 的 runner 协议形态是
`{state:'success'}`（非 loggedIn 字段），文件名按账号全名（xiaohongshu）而拆解侧叫
xhs——sourceStatus 两处都对不上，登录成功门控也看不见；且登录成功后本就没有任何一步
把 cookie 写给下载器。**补链**：`xhs_publish.py dump-cookies`（whoami 同款 profile 锁，
开持久化登录态取 `context.cookies()` 拼 Cookie 头，单行 JSON 输出）；宿主
`POST /easel/api/cookies/import`（跑 dump→解析末个 JSON 行→writeCookie，未登录 409 带指引）；
账号页登录成功轮询分支对 xiaohongshu 自动导入，数据源 section 增「从登录会话导入」按钮
与窗口聚焦刷新；sourcedata 认 `state==='success'` 与账号侧文件名别名。

## [S4] Acceptance

- [ ] 页面上完成一次完整拆解：输入链接→三步骤实时进度→agent 分析（所选视觉模型）
  →报告页内 Markdown 渲染→选题库出现对应条目。
- [ ] ASR 模型与视觉模型两个下拉均来自 dsh 模型管理真实列表；默认值合理
  （ASR=mimo，视觉=会话当前或有 image 能力的首个模型）。
- [ ] 采集失败（如链接不可用/无下载器路径）有明确失败态+手动重试/提示位，无静默死等。
- [ ] `node --test`（163 既有 + deconstruct/models 新增）全绿；插件 build.mjs 过。
- [ ] 探针实证： outputs/_deconstruct/<id>/ 产物树齐全（source/frames/srt/meta）。
