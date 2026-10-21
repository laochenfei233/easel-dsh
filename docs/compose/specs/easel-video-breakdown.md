---
feature: easel-video-breakdown
status: in-progress
updated: 2026-10-14
branch: main
commits: （交付时填写）
---

# 爆款拆解 · 视频链路（下载 → 抽帧/转写 → 模型）

## Report

（交付时填写）

## [S1] Problem

爆款拆解现状只支持纯文本输入（B3 后走 dsh 会话，见 easel-dsh-runtime §S2.2 B3）。
用户贴一条**视频**爆款时，agent 拿不到画面与声音——只能凭标题/链接文本泛泛而谈，
钩子画面、节奏、BGM、口播全部丢失。用户需求：贴视频链接（抖音/小红书/B站/油管等）
时，先下载视频，把**画面抽帧 + 声音转写**喂给模型，再产出六点拆解。

下载是本链路的硬点：抖音有签名风控、小红书需要登录态——**yt-dlp 对抖音用户已实测
不可用**、对小红书完全不支持。约束（用户拍板，2026-10-14）：
**① 不外挂任何仓库**（不要 UnifiedDownloader 式的 TikTokDownloader/XHS-Downloader
外部依赖），下载器自包含、在 dsh 会话里直接可用；**② 下载模块尽可能小**；
**③ 模型选择走 dsh 自带的模型管理模块**，不用 Easel 侧的模型注册表组；
**④ 分析模型不锁定**——用户在 dsh 模型管理里自选更好的视觉模型；
**⑤ 抖音只走原生路径**（yt-dlp 已实测不可用，不做 yt-dlp 抖音回退）。

## [S2] Design

**原则（ponytail）**：不在插件里写固定 pipeline——写成 SKILL，让 dsh 会话里的 agent
按技能自己编排（终端/文件工具现成），与 B3 的执行模型一致。

### 看帧与拆解：全走 dsh 模型管理（零 Easel 侧模型配置）

勘察定稿（2026-10-14，dsh worktree + 火山方舟实测）：

- dsh 设置的模型管理（`ui-settings-models`）支持**自定义 OpenAI 兼容 provider**
  （CustomProviderCard：route id + baseURL + protocol + 模型列表，key 存凭据库），
  并有 `discoverModels` Remote——「Ask a provider endpoint what models it serves」，
  即**能从端点拉取模型列表**。
- 火山方舟 Ark（`https://ark.cn-beijing.volces.com/api/v3`）为 OpenAI 兼容端点，
  用户提供的测试 key 实测可拉取 135 个模型：`doubao-seedance-2-0-260128`（视频**生成**
  域，不做理解、别选它看帧）与 `doubao-seed-2-1-lite/pro-260915`、
  `doubao-seed-2-0-lite-260428` 等 **image 输入的理解模型**都在列表里——作为
  自定义 provider 的**已验证样例**。
- dsh 会话原生支持**中途切换会话模型**（model-selection 切换有持久 notice），
  且 session-models 保证「text-only 模型选择下，图片附件保持可用、等后续 vision
  模型」；agent 的 Read 工具原生按图片呈现帧文件。

因此：**不建 vision 组、不写 vision_describe.py，也不锁定具体分析模型**。
看帧 = 用户在 dsh 模型管理里配置**任意视觉模型** provider（方舟 doubao-seed-2.1
只是已验证样例；GLM-4V、Qwen-VL、GPT-4o 等同样可用，用户自选更好的），
拆解会话中把模型切到用户选定的那个，agent 用 Read 工具直接逐帧看图。
技能首步做能力预检，模型看不了图时提示用户切换（一次性配置，key 由用户在
dsh UI 里持有，不进任何 Easel 文件）。ASR 侧实测方舟列表无 ASR 模型 →
维持本地方案（见下）。

### 下载分层（video_fetch.py 单文件自包含，目标 ~200 行）

**不用外挂仓库**。策略：yt-dlp 打底（覆盖 YouTube/B站/TikTok/通用站点）；
**抖音与小红书都走原生最小路径**——抖音 yt-dlp 已实测不可用（用户测过），
小红书 yt-dlp 完全不支持：

| 平台 | 路径 | 依赖 |
|------|------|------|
| YouTube / B站 / TikTok / 通用 | yt-dlp 子进程（`--no-playlist`） | yt-dlp 可执行 |
| 抖音 | 原生路径：解析 v.douyin.com 短链 → 带 ttwid cookie GET 分享页 → 抽页面数据 JSON → 取视频地址下载（~80 行） | cookies.json |
| 小红书 | 原生路径：解析 xhslink 短链 → 带 cookie GET 笔记页 → 抽 `window.__INITIAL_STATE__` JSON → 取视频流地址下载 | cookies.json |
| 全部失败 | 退出码 2 + 指引文案 | — |

- 入参含整段分享文案：脚本内链接切分 + host 识别平台
  （douyin.com/v.douyin.com → douyin；xiaohongshu.com/xhslink.com → xhs；其余 → 通用）。
- cookie 存 `outputs/_deconstruct/cookies.json`（`{"xhs": "...", "douyin": "..."}`），
  首期手动粘贴；缺 cookie → 退出码 3 + 填写指引。
- 落盘 `<batch>/video.<ext>`；标题/作者/时长元信息以 stdout JSON 输出供 source.md 用。
- 退出码协议：0 成功 / 1 参数错 / 2 下载失败 / 3 缺 cookie / 5 缺 yt-dlp。
- 不实现：签名模块内联（体积失控）、yt-dlp 抖音 extractor 依赖（用户实测不可用）、
  半自动 cookie 获取（后续增量）、UnifiedDownloader 外挂布局（用户明确否决）。

### 抽帧 / 转写（现有脚本 + agent 直跑 ffmpeg，不新增抽帧代码）

- **抽帧**：SKILL.md 给命令模板，agent 直接跑 ffmpeg——场景帧
  `select='gt(scene,0.4)'` + 每 N 秒兜底采样（时长自适应），帧存 `<batch>/frames/`，
  上限约 24 帧防上下文爆炸（vision 模型逐帧读图也吃 token）。`video_ops.py frame`
  子命令是单帧抽取，不改它（YAGNI）。
- **转写**：**复用 `skills/shared/scripts/asr.py`**（faster-whisper 本地，
  auto-subtitle 技能同款）：自动抽音轨、JSON 输出自带时间戳（供时间轴对齐）、
  `EASEL_PROXY` 支持模型下载代理。零新配置；方舟列表无 ASR 模型，云端转写不做。

### SKILL 编排（skill-viral-deconstruction）

`skills/openclaw/skill-viral-deconstruction/`（SKILL.md + EASEL-META.md，
零私有脚本——全部调用共享脚本与 ffmpeg），固定流程：

1. **预检**：当前会话模型看不了图 → 提示用户在 dsh 模型管理配置/切换**任意**
   视觉模型（已验证样例：火山方舟 doubao-seed-2.1；不锁定，用户自选）并在对话里
   切换，等待切换后继续；yt-dlp 缺失 → 给安装指引（`pip install yt-dlp`）。
2. **下载**：`python skills/shared/scripts/video_fetch.py <batch> <url...>`；
   按退出码降级（2/5 → 「手动把视频文件放进 `<batch>/`」指引，3 → cookie 指引）。
3. **抽帧**：ffprobe 时长 → ffmpeg 场景帧 + 兜底采样。
4. **转写**：`python skills/shared/scripts/asr.py transcribe video.<ext> --format json`。
5. **看帧**：agent 用 Read 工具逐帧读 `frames/`（每帧一句画面描述，记录时间点）。
6. **合并**：按时间轴把帧描述 + 字幕对齐成 `<batch>/source.md`（帧用相对路径
   引用 + 下载元信息头）。
7. **拆解**：当前模型吃 source.md 产出六点拆解（与 BreakdownPage 现状同构），
   回写 `outputs/_ideas.json`（B3 回写协议不变）。
8. **清理**：删 video.<ext>、frames/、asr 中间 json，保留 source.md 供追溯。

### BreakdownPage 分流

- 输入含 `https?://` 链接 → prompt 追加「使用 skill-viral-deconstruction 技能
  处理该视频链接」+ 原文照传；纯文本 → 现状 prompt 原样。
- 文案更新：副标题补「支持直接贴视频链接（抖音/小红书/B站/YouTube）」；
  首次使用提示「看帧需在 dsh 设置→模型管理 配置视觉模型并在对话中切换
  （模型自选，如火山方舟 doubao-seed-2.1、GLM-4V 等）」。
- 其余（open 推送、回写选题库、running 边沿）不变。

### 中间产物与内容库隔离

- `outputs/_deconstruct/<batch>/`：`video.<ext>`、`frames/`、`source.md`、
  `asr.json`、`cookies.json`。
- `getOutputTree` 已跳过 `_` 前缀条目（index.js:890），「不污染内容库」
  **天然满足**，验收只做回归确认；cookies.json 含登录态，同处隔离目录。

### 风险与边界（T5/T6 实测覆盖）

- 抖音原生分享页路径随平台更新可能失效（字段/风控变化）→ 解析做键容错，
  失败降级「手动放文件」；yt-dlp 抖音已实测不可用，不作回退。
- 小红书页面结构变化（`__INITIAL_STATE__` 键名/风控）→ 原生路径做键容错，
  解析失败返回退出码 2 + 指引。
- faster-whisper CPU 转写 1-3 分钟短视频可接受；长视频（>10min）暂不支持，
  SKILL 里明确提示。
- dsh 会话对模型切换的时点：切模型发生在回合之间（composer 操作），SKILL 在
  看帧前预检，避免回合中途才要求切换。

## [S3] Scope

**In**：`video_fetch.py` 单文件下载脚本（yt-dlp 打底 + 抖音/小红书原生路径）、
skill-viral-deconstruction（SKILL.md + EASEL-META.md，零私有脚本）、
BreakdownPage prompt 分流与引导文案、dsh 模型管理接入验证
（方舟已验证样例；分析模型不锁定，用户自选）。
**Out**：插件侧下载/抽帧代码（全在 agent+skill 层）、任何外挂仓库依赖
（TikTokDownloader / XHS-Downloader，用户否决）、Easel 侧 vision/模型注册表改动
（模型选择归 dsh 模型管理）、锁定具体分析模型（用户自选）、
yt-dlp 抖音回退（用户实测不可用）、vision 脚本（agent Read 工具直读帧）、
半自动 cookie 获取、B 站投稿级清晰度、直播流、批量拆解队列、云端 ASR、
小红书图文/图集笔记（只做视频）。

## Tasks

- [x] T1: dsh 模型管理接入验证——代码侧完成（CustomProviderCard +
      discoverModels Remote 实证、protocol=`openai-completions`、方舟 key 拉取
      135 模型实测）；UI 侧配置 + 会话切模型看图归入 T6（需用户在 dsh UI 操作）
      （depends: none）
- [x] T2: video_fetch.py——链接切分/平台识别/yt-dlp 通用路径/抖音原生路径
      （**移动端 Feed 接口 `aweme/v1/feed` 免签名免 cookie**——分享页
      `_ROUTER_DATA` 抓取实测拿不到 item_list，弃用）/小红书原生路径
      （__INITIAL_STATE__ 解析，键容错）/cookies.json 读取/stdout 元信息 JSON/
      退出码协议/`--selftest`/「手动放文件」检测（depends: none）
- [x] T3: skill-viral-deconstruction SKILL.md + EASEL-META.md——八步流程、
      ffmpeg 命令模板、模型能力预检文案、按退出码降级文案、磁盘清理
      （depends: T1, T2）
- [x] T4: BreakdownPage URL 分流 + 副标题/首次使用引导文案；构建 39/39 过，
      两 profile 硬链接自动同步（depends: T3）
- [x] T5: 下载链路实测——yt-dlp 2026.08.19 已装；**抖音真实链接原生路径
      实测通过**（v.douyin.com/DGHl69ciWp4 → 687s h264+aac 70MB，元信息齐全）；
      **B站 yt-dlp 路径实测通过**（BV1cApB6NEPq → 98s mp4）；
      退出码 3（缺小红书 cookie）实测通过；小红书真实笔记、YouTube 待
      cookie/网络条件下补测（depends: T2）
- [ ] T6: 端到端实测——抖音一条 + 小红书一条 + B站或 YouTube 一条 + 纯文本回归；
      验证 _ideas.json 回写、source.md 产物（帧相对路径引用）、模型切换看帧、
      磁盘清理（depends: T3, T4, T5；**前置：用户在 dsh 设置→模型管理 配置
      视觉模型**）

## [S4] Acceptance

- [ ] 贴一条**抖音**视频链接 → 拆解完成后 `_ideas.json` 新增条目，
      note 含「画面钩子」与「口播/字幕」两个章节（画面+声音真的进了模型）
- [ ] 贴一条**小红书**视频链接 → 同上（原生下载路径验证）
- [ ] 贴一条**B站或 YouTube** 链接 → 同上（yt-dlp 路径验证）
- [ ] 贴纯文本时行为与 B3 现状一致（回归）
- [ ] dsh 模型管理里自定义 provider（方舟为已验证样例）可拉取模型列表；
      拆解会话切换到**用户选定的视觉模型**后 agent 能读帧（不锁定具体模型）
- [ ] 会话模型看不了图时：技能首步给出「去 dsh 模型管理配置/切换视觉模型」的
      明确指引并等待，而非中途失败或凭空描述
- [ ] 缺 cookie / 缺 yt-dlp / 下载失败时：video_fetch.py 返回对应退出码，
      对话里出现对应的填写/安装/「手动放文件」指引
- [ ] source.md 产出且帧引用为相对路径；拆解完成后视频、frames/、asr 中间
      json 被清理，source.md 保留
- [ ] `outputs/_deconstruct`（含 cookies.json）不出现在 /api/outputs
      （getOutputTree `_` 前缀过滤，回归确认）
