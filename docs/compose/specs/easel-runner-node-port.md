---
feature: easel-runner-node-port
status: designed
updated: 2026-10-14
branch: main
commits: （未开工）
---

# runner 舰队与媒体脚本 Node 化（Easel 去 Python 运行时）

## Report

（交付时填写）

**进度快照（2026-10-14，分支 feat/easel-runner-node-port）**：T1①③、T2、T4、T5b
完成（T1 剩② browser-use 最小流待 dsh 环境联调）；T3/T5 解锁待 T1②/T1① 产物
落地；Python 退役进度：video_fetch.py、asr.py 已删，video_ops.py/audio_ops.py
待散点引用清零（T7）。宿主半新增：POST /easel/api/asr + outputs/_easel_api.json
发现文件。凭据结论：dsh 模型管理凭据插件侧暂读不到（inject 仅 webServer）→
MIMO_* env/.env 兜底，模型管理接线是 T4 遗留小项。

## [S1] Problem

B4 后 Easel 执行层仍有一半是 Python：runner 舰队（46 个 Playwright 脚本：
平台登录/发布/数据抓取）+ 共享媒体脚本（asr.py、video_fetch.py、video_ops.py 等
约 47 个）。用户目标：这些也 Node/原生化的方案评估并落 spec，**后续对话逐步替代**，
终态 Easel 仓库不再依赖 Python 运行时。

## [S2] Design

### 评估结论（2026-10-14，结合 UnifiedDownloader + dsh 原生能力勘察）

UnifiedDownloader 的关键哲学：**平台交互优先走 HTTP API 层，浏览器只是兜底**——
抖音 = 移动端 Feed 接口（免签名免 cookie，已在 video_fetch.py 验证）、小红书 = 笔记页
`__INITIAL_STATE__` 解析，全程无浏览器。它的签名模块虽是 Python（TikTokDownloader /
XHS-Downloader），但签名算法本身源自**web JS 逆向**，Node 侧存在社区 JS 实现
（实勘确认：抖音 a_bogus 有 [ylcangel/a_bogus](https://github.com/ylcangel/a_bogus)、
[idinging/douyin-abogus](https://github.com/idinging/douyin-abogus) 等 JS 实现；
小红书 x-s/x-s-common 有 [xhshow-js](https://github.com/renmu123/xhshow-js) TypeScript
实现；注意 x-bogus 旧算法已失效，抖音现行是 a_bogus，且实现分「补环境」与「纯算」
两派，T1 验证以纯算优先）。

dsh 原生能力盘点（实勘修正）：
- **`packages/browser-use`** 本身只是独占注册表服务（无任何工具）；真工具来自
  `packages/experimental/browser-use-*` provider，**默认全关**，需 cordis.patch.yml
  显式 mount。Playwright MCP provider 挂载后 agent 工具名为
  `mcp__playwright-mcp__browser_*`（navigate/click/type/screenshot/
  network_requests 等，按 session 隔离）；另有 chrome-devtools-mcp 与
  stagehand-native 两个 provider 备选。浏览器内核由 MCP 侧自装——
  **Python playwright 退役，浏览器依赖换宿主不变**。
- **`packages/experimental/speech-to-text`**：`ctx.speechToText` 是 Cordis 服务，
  实勘定性：**agent 工具面不可达**（无 tool 定义，唯一消费者是 Client 麦克风），
  且 `Transcript {text, audioSeconds, inferenceSeconds}` **无时间戳无分段**——
  该服务本体装不下 SRT 需求，**不作为 Easel ASR 的执行通道**；但 dsh
  **模型服务（模型管理）有原生 ASR 模型**（用户拍板 2026-10-14：ASR 路线使用
  原生）——mimo 实测通过（见 T1③/T4），凭据与模型配置走 dsh 模型管理，
  执行通道为宿主半 ASR 路由。

三条替换路径，按脚本族分派：

| 现存 Python | 替换路径 |
|------|------|
| video_fetch.py（stdlib HTTP 下载） | **video_fetch.mjs**（Node fetch，1:1 移植，链接切分/平台识别/退出码协议不变） |
| 登录/发布舰队（xhs_publish、douyin_publish、zhihu_answer 等 Playwright 脚本） | **SKILL.md + dsh browser-use**：把脚本里的流程知识（选择器、等待、确认弹窗）改写成技能文档，agent 用 browser-use 工具驱动；登录态沿用 B2 的文件协议（login_state.json + png/code） |
| 数据抓取（account_stats、social_stats、xhs_comment 等） | **Node fetch + 平台 web API**（UnifiedDownloader 路线）；签名用社区 JS 实现，失效的平台回退 browser-use 路径 |
| asr.py（faster-whisper） | **dsh 模型服务原生**（用户拍板 2026-10-14）：mimo-v2.5-asr 实测通过（OpenAI 兼容 chat/completions + input_audio，转写准确但无时间戳）→ 宿主半 `/easel/api/asr` 路由（ffmpeg silencedetect 分段补时间戳 + 逐段调 API + 移植 SRT/ASS 写入器），**零新脚本、零新 npm 依赖**，凭据/模型走 dsh 模型管理 |
| video_ops.py / audio_ops.py 等 ffmpeg 包装 | **混合策略（用户拍板 2026-10-14）：能硬写的 SKILL 硬写，必须写脚本的用 Node 替代**。纯命令子命令 → SKILL.md 直接硬写 ffmpeg 命令模板；含踩坑逻辑的子命令 → **video_ops.mjs / audio_ops.mjs**（Node 单文件移植，保留子命令 CLI 形态），9 个技能只改脚本引用，SKILL.md 结构不动 |
| login_state.py / persona_gate.py 等编排 | B2 已把编排移植 TS（宿主半），剩文件协议读写随对应舰队迁移 |

原则：**按平台逐个迁移，迁移一个下线一个，任何时候仓库保持可用**；browser-use
路径与 HTTP 路径并存（技能里写降级顺序：API 优先 → 浏览器兜底 → 手动放文件）。

### 施工设计（2026-10-14 第二轮四路实勘后定稿）

#### 0. 实勘底账（修正评估轮口径）

- **舰队实为 12 个 Playwright 脚本**（S1 的 46 系口径误差），全部在
  `skills/shared/scripts/`：平台舰队 8（zhihu_answer 353 行、zhihu_comments_fetch
  104、xhs_publish 1075、xhs_comment 1104、douyin_publish 1510、web_publisher
  1532[快手/视频号/知乎专栏配置引擎]、weixin_mp_stats 800、account_stats 971
  [五平台]）+ 本地渲染 3（doc_convert、mindmap、render_card，HTML→图/PDF）
  + install_tool。**bili_login(332) 纯 API 无浏览器**（urllib+segno）；
  **快手无独立脚本**——它是 web_publisher 里打磨最久的配置，属最难迁移档。
- 其余 36 个 = 无浏览器协议库 8（login_state/content_guard/platform_readback/
  human_pace/social_stats/persona_gate/manifest/output_paths/calendar_ops 等）
  + ffmpeg 包装 2 + 媒体/API 调用器 26（asr/tts/ai_video/ai_image/ai_music/
  image_ops[Pillow]/voice_clone/multivoice/batch_process/subtitle_ops 等）。
- **SKILL.md 引用面**：openclaw 57 个技能共 **276 处**引用 shared/scripts，形态
  统一为项目根相对直调 `python skills/shared/scripts/<x>.py <子命令>`。平台舰队
  被引用的技能：skill-zhihu-answer / skill-zhihu-publisher / skill-xhs-publisher /
  skill-xhs-comment-reply / skill-douyin-upload / skill-kuaishou-upload /
  skill-channels-upload / skill-bilibili-upload / skill-wechat-publisher /
  skill-my-account（即：**SKILL 化 = 重写这批现有技能文档，不建新目录**）。
- 子命令分类：video_ops 12 个——纯 9（cut/concat/aspect/frame/gif/compress/bgm/
  watermark/info）、踩坑 3（text=中文字体查找+drawtext 转义、speed=atempo 级联、
  silence-cut=silencedetect 解析；**无 scale 子命令**，缩放在 aspect/compress
  内联）；audio_ops 9 个——纯 7（info/trim/convert/normalize/extract/concat/
  fade）、踩坑 2（speed 级联、denoise 三级+RNNoise 模型管理）。
- 运行时：dsh 要求 Node ≥22.19（global fetch 内置）；`.mjs` 裸 node 直跑是
  dsh 仓既有约定。**舰队 .mjs 一律零 npm 依赖**（skills 目录无 node_modules）。

#### 1. 处置框架（四类规则，覆盖全部 48 脚本）

| 类 | 范围 | 处置 | 任务 |
|---|---|---|---|
| A 平台舰队 | 8 个 Playwright 平台脚本 | SKILL.md 重写 + browser-use；协议库随迁 | T3/T5/T6 |
| B ffmpeg 包装 | video_ops/audio_ops | 纯命令 SKILL 硬写；踩坑 5 子命令 → 2 个 .mjs | T5b |
| C API/HTTP 调用器 | video_fetch、bili_login、tts、ai_video/ai_image/ai_music、voice_clone、account_stats 可 API 化部分 | .mjs 单文件移植（零依赖） | T2/T5/T7 |
| D 本地渲染与重型库 | doc_convert/mindmap/render_card（playwright 渲染）、image_ops 等（Pillow）、remove_bg（rembg） | 渲染类 → chrome headless CLI 硬写或 20 行 .mjs spawn cft；Pillow/rembg 类 → **豁免清单**机制（每项一行理由+替代路径+回头再议） | T6/T7 |

#### 2. 迁移不变量（协议面，前端与既有流程零改动）

- **登录文件协议**：`outputs/_login/<p>.{png,json,code,log}` 四件套；状态 JSON
  `{state, message, qr, ts}`；状态集（starting/qr_ready/window_login/scanned/
  sms_required/verifying/success/expired/error）不变。success 时可附加
  `name/avatar` 字段（新增字段，向后兼容）。前端 AccountsPage/PublishPage 的
  2s 轮询**不改一行**。
- **whoami 契约**：`{"loggedIn","name","avatar","error"?}` 永远可用。宿主不再
  spawn 校验，改读登录标记 + TTL（600s 不变）；「重新验证」入口降级为技能推送
  或平台 API fetch。
- **退出码语义**沿用 0/1/3(内核缺失)/4(环境级)/5(未确认)/6(需登录)/7
  (content_guard 拦截)；**dry-run 默认、--exec 真动作**不变；发布前
  content_guard 前置不变。
- **stdout 单行 JSON** 契约不变；宿主解析沿用「首{..末}整体截取」教训
  （account-insights 评审 C1）。
- **成功判定三档哲学**不变：界面信号只是旁证 → 平台读回对账才是权威 →
  未核实不冒报成功、不盲目重发。

#### 3. browser-use 接线与宿主半编排改造

- cordis.patch.yml 显式 mount `browser-use-playwright-mcp` provider（仿
  voice-input-bundle 挂载先例）；浏览器内核用 MCP 自装渠道，install_tool 的
  pw/cft 配方随 T7 退役（cft 留给 D 类渲染）。
- **登录/发布驱动改为 pushTask**（`src/lib/task.ts` 现成通道：sessions.create
  + running 边沿判完成）：宿主 8 条 spawn 编排链逐个换执行末端，**编排逻辑
  不重写**——文件协议、轮询、状态机全部保留，只是「起 Python 子进程」变成
  「推技能 prompt 给 agent，agent 用 browser 工具执行并写状态文件」：

| index.js 调用点 | 现状 | 去向 |
|---|---|---|
| apiLoginStart :1657 | spawn `<p>_publish.py login` | pushTask(登录技能节)；QR 由 `browser_take_screenshot` 落 `<p>.png`；状态 JSON 由 agent 文件工具写；sms_required 时 agent 轮读 `.code`（douyin 沿用 .resend 信号） |
| apiWhoami :1697 | runCapture whoami | 读登录标记 + TTL（600s 不变）；不再 spawn |
| wechatVerifyToken :1856 | `python -c` 内联 | 公众号 token 是纯 HTTPS API → 宿主直 fetch（唯一 python -c，随 T6 微信批迁） |
| apiMpLoginStart :1925 | spawn weixin_mp_stats login | pushTask(mp 登录技能)（T6 末批） |
| apiAnalytics :1950 | spawn account_stats 等 | 宿主直 fetch（签名 .mjs，T5）优先；无 API 平台 pushTask 兜底 |
| runPublishBg :1991 | spawn douyin publish | pushTask(抖音发布技能)；`_publish/<p>.json` + `.code` 协议不变；读回对账 = 技能末步调平台 API（a_bogus）或 `browser_network_requests` |
| apiPublish :2054 | spawn publish 舰队 | pushTask(各平台发布技能)；**biliup 是 pip 包** → 换 biliupR 独立二进制（T7） |
| apiScheduleContext :2124 | spawn calendar_ops.py context | 宿主直读同一 JSON（20 行内，随 T7） |

- 网络捕获类知识（快手借页面签名 XHR、mp 后台拦截 Vue 自发请求）→ 对应
  `browser_network_requests` 工具指令；OOPIF iframe（视频号创作器）是
  browser-use 已知风险点，见 T6。

#### 4. 分任务施工设计

**T1 三项可行性验证（按实勘收窄）**
- ①签名 JS：各建 `tools/verify/` 最小脚本（验证用，不入 skills）：douyin 用
  纯算实现跑通一个真实 web API 请求（评论列表或 work_list，a_bogus + 正确
  UA/cookie 组合）；xhs 用 xhshow-js 跑通笔记 API（x-s + x-s-common）。
  **通过标准 = 真实请求返回业务 JSON**（非签名报错）。任一平台失败 → 该平台
  数据抓取降级 browser-use，不阻塞其余任务。
- ②browser-use 最小流：mount provider → pushTask 一个验证技能：打开知乎创作
  页 → 截图落盘 → 写 status JSON → 读回。验证四点：工具可达性、截图文件落盘、
  headless/有头形态（manual 登录模式依赖）、agent 轮内 wait+重读文件（douyin
  短信 `.code` 依赖）。通过标准 = 前端登录页轮询 UI 能看到状态推进。
- ③ASR 路线验证——**已完成（2026-10-14，用户拍板改原生路线）**：MiMo 开放平台
  `https://api.xiaomimimo.com/v1` 实测——`GET /models` 有 `mimo-v2.5-asr`
  （另有 tts/tts-voiceclone/tts-voicedesign 系）；转写走
  `POST /v1/chat/completions`，content = **单个 `input_audio` part**
  （base64 wav，网关强制：不得带 text part，prompt 由网关注入）；
  两段 SAPI 合成中文样音频**逐字转写全对**；响应为纯文本
  `choices[0].message.content`，**无时间戳无分段**（usage.seconds 为音频计费
  秒数）。结论：模型可用，SRT 时间戳由宿主路由侧 silencedetect 分段解决；
  sherpa-onnx-node / nodejs-whisper 本地引擎方案废弃。

**T2 video_fetch.mjs**：单文件零依赖，1:1 映射——urllib→fetch（自动解压
gzip，redirect:follow，`resp.url`=最终 URL）、`_download`→body reader 流式
写盘、yt-dlp 仍 spawnSync（**通用路径保留 yt-dlp 为外部可选依赖，文档注明用
独立发行版 yt-dlp.exe 则整机无 Python**）；退出码 0/1/2/3/5、stdout 单行 JSON、
手动放文件跳过、cookies.json 读取全部不变；`--selftest` 移植（split_urls/
detect_platform 纯函数）+ `node --test` 一件。改 skill-viral-deconstruction
的 1 处引用，video_fetch.py 删除。

**T3 首个平台 = 知乎**（修正评估轮建议：快手恰是最难档，不能第一个）：
- 重写 `skill-zhihu-answer/SKILL.md`（skill-zhihu-publisher 专栏发布可选同批），
  按「SKILL 化五段模板」——①前置：读 `outputs/_login/zhihu.json` 判登录态，
  过期走登录节；②登录节：browser_navigate → 登录检测（.SignContainer 系）→
  QR 截图落盘 → 写状态 → 轮询成功；③主流程节：原脚本知识逐条转指令
  （WriteAnswerButton 三策略点击、Draft.js `.public-DraftEditor-content`
  五候选、Ctrl+A 清草稿、逐段 type）；④dry-run 契约：默认停在发布前一步
  截图交用户，prompt 带 --exec 才点「发布回答」；⑤失败处置：截图 + DOM
  摘要落 `outputs/_login/` 供校准。
- 宿主 apiLoginStart/apiPublish 知乎分支切 pushTask（§3 表）。
- zhihu_answer.py、zhihu_comments_fetch.py 删除；login_state 协议由 agent
  文件工具直写（不依赖 Python 库）。

**T4 原生 ASR 路由**（路线按用户拍板改 dsh 模型服务，mimo 已实测）：
- 宿主半新增 `POST /easel/api/asr` 路由（dsh-plugin-easel index.js，B1 文件 IO
  面同层）：入参=音频/视频文件路径 + `--format srt|ass|txt|json` + 可选语言；
  内部流程：视频先 ffmpeg 抽 16k 单声道 wav → `silencedetect`（noise≈-35dB/
  d=0.5，复用 silence_cut 的解析思路）切语音段 → 无静音可切的长独白兜底固定窗
  （≈30s）→ 逐段 base64 调 `mimo-v2.5-asr`（chat/completions + 单 input_audio
  part，串行）→ 段边界即时间戳 → segments 输出。**零新脚本、零新 npm 依赖**
  （ffmpeg/dsh 既有），agent 侧 SKILL.md 直接写 curl 调用，asr.mjs 不再需要。
- SRT/ASS 写入器三段逻辑 1:1 搬自 asr.py：`_wrap_line`（18 字中文断行）、
  `_split_long_segment`（按字符比例分时间）、ASS header（字号=短边×0.05、
  边距自适应）——落在路由实现里。
- 凭据与模型走 **dsh 模型管理**：自定义 provider 配 baseURL/apiKey（mimo 平台
  `https://api.xiaomimimo.com/v1`，模型默认 `mimo-v2.5-asr` 可配）。T4 首步
  核对宿主半能否读到 custom provider 凭据（inject settings/credentials），
  读不到则 env 兜底并在 spec 报告记录。
- 改写引用：auto-subtitle(3)、video-to-article(1)、subtitle-translate 等
  asr 全部 21 处 → 路由调用；asr.py 退役。

**T5 数据抓取 Node 化**（依赖 T1① 产物，按依赖度排序）：
- bili_login.mjs：纯 API 移植（TV QR 接口 + MD5 sign）；segno QR 生成 →
  vendored 单文件 QR 编码器（公版实现，保持脚本零 npm 依赖）；
  biliup 兼容 cookies.json 写出不变。
- account_stats 分平台：douyin（web API + a_bogus）→ xhs（x-s）→ 快手/视频号/
  知乎 browser-use 兜底；快照分层保留与环比逻辑随迁宿主半（本就是宿主编排）。
- xhs_comment fetch/notes 分支 API 化；reply/delete 写操作留 T6。
- 宿主 apiAnalytics 切宿主直 fetch + 缓存（180s 超时语义不变）。

**T5b video_ops.mjs + audio_ops.mjs**：
- video_ops.mjs：**只移植 text / speed / silence-cut 三个子命令** + --selftest，
  1:1 搬 `_find_font`（字体候选表+查找）、`_escape_drawtext`（反斜杠/冒号/
  单引号/百分号转义）、`_atempo_chain`（0.5–2.0 拆分）、`_parse_silences`
  （silencedetect stderr 解析+保留段反推）；CLI 形态 `node video_ops.mjs <sub> ...`
  不变。
- audio_ops.mjs：**只移植 speed / denoise**；RNNoise 模型定位/下载/降级链
  （缺模型自动降 Tier2）原样保留。
- 9 个 ffmpeg 类技能 SKILL.md 改写（只改引用行，结构不动）：video-editing
  12 条示例（纯命令→ffmpeg 模板、3 个踩坑子命令→node 引用）；audio-editing
  15 处（speed/denoise→node，其余→ffmpeg 模板）；audio-denoise denoise→node；
  ai-music / tts-voiceover 的 bgm/trim/normalize→ffmpeg 模板；auto-subtitle
  烧录本就手写 ffmpeg（转义知识硬写进 SKILL）；batch-process 委派表改 agent
  循环指令（零脚本）；ai-video-gen 仅 :64 提及行；video-to-article frame→
  ffmpeg。其余 48 技能中 audio_ops/image_ops/asr 的散点引用随 T4/T7 各批改。

**T6 剩余平台舰队逐个迁移**（每平台一提交，顺序=难度升序）：
1. skill-xhs-comment-reply 写操作（reply/delete：按昵称定位评论 6 层上溯、
   文本匹配菜单、绝不用坐标——对 agent 是天然指令）
2. skill-xhs-publisher（login→publish：话题 # 联想逐字输入、Shadow DOM 62%
   坐标点击——agent 看得见按钮，比硬编码更稳）
3. skill-douyin-upload（最重：QR 几何定位 10s 重截、短信墙弹窗定位、
   读回对账保留为技能末步）
4. skill-my-account + account_stats 剩余平台
5. skill-kuaishou-upload（web_publisher 快手配置：双 token、joyride 清理、
   转码 waitfor 180s）
6. skill-channels-upload + skill-wechat-publisher（**OOPIF 风险档**：视频号
   创作器 iframe 若合成点击不被信任 → 降级 chrome-devtools-mcp attach 真
   Chrome；再不行入豁免清单）+ wechatVerifyToken 宿主直 fetch +
   html_converter.py（gzh 技能内）同步 .mjs 化。

每平台 checklist：SKILL.md 重写 → dry-run 实测 → --exec 真发（小号）→
宿主调用点切换 → 删脚本 → 提交。

**T7 Python 终局**：
- index.js spawn 面清零（§3 表逐行核销）；`settings.python`/`EASEL_PYTHON`/
  runCapture-spawnRunner 的 .py 路径全部移除。
- install_tool.mjs：配方缩到 node / ffmpeg / cft（Chrome for Testing，供
  D 类渲染）；python/fw/pw/model/rmdeps/biliup(pip) 配方删除，biliup →
  biliupR 独立二进制。
- C/D 类剩余脚本逐个 .mjs 化或入豁免清单（tts=edge-tts 协议移植，或复用 T4
  路由模式走 mimo-v2.5-tts——模型列表已见；ai_video/ai_image/ai_music/
  voice_clone=纯 HTTP、image_ops 等 Pillow 类=sharp 或豁免）；social_stats/content_guard/persona_gate/human_pace
  等纯函数库随消费者 SKILL 指令化或 .mjs。
- tests/ 的 pytest 删除，关键移植件补 `node --test`；`easel/` 残包（22 文件）
  **不在本 spec 内**——与悬空提交 5d4da08 的处置联动，单列用户拍板。

### 风险与边界（施工轮更新）

- 平台签名 JS 实现随平台更新失效快（小红书尤甚）→ 每平台保留 browser-use
  兜底；签名 .mjs 集中放 `skills/shared/scripts/signatures/` 便于热修。
- browser-use provider 是实验性、默认关闭 → mount 属 dsh 侧配置变更（只消费
  不改包），T1② 在真 profile 验证；SKILL.md 里浏览器工具名勿进 toolOrder
  （MCP provider README 约定，留 `<unlisted-tools>`）。
- 登录/发布改 agent 驱动后，长流程（抖音扫码+短信 ≈ 数分钟、几十次工具调用）
  token 成本显著高于脚本 → 抖音登录节写「最快路径」指令（减少探索）；这是
  用确定性换零 Python 的自觉取舍。
- agent 轮内轮询文件（.code）依赖 agent 等待能力 → T1② 验证 wait+重读。
- mimo-v2.5-asr 无时间戳 → 宿主路由 silencedetect 分段补齐；无静音的长独白
  兜底固定窗，段内时间粒度粗（验收按语义等价不按逐字一致，同 faster-whisper
  差异条款）。
- 长音频成本与耗时：逐段串行 API 调用，计费按音频秒数（实测 12s 音频
  usage.seconds=12）→ 视频拆解场景（1-10 分钟）可接受；超长转写暂不承诺，
  路由侧留超时与分段上限。
- mimo API 不可用/换协议 → 变化面收敛在路由一层，模型管理里换 provider
  baseURL/模型名即可切换（OpenAI 兼容的任意 ASR 通道）。
- OOPIF（视频号）与 XHR 捕获依赖（快手/mp 后台）是 browser-use 最可能翻车
  的两类 → 排最后，留豁免清单出口。
- 豁免清单机制：确实无 Node 等价的重型库（rembg 类）允许显式豁免（每项一行
  理由+替代路径），验收改为「无**未申报**的 Python 依赖」。

## [S3] Scope

**In**：可行性验证（签名 JS、browser-use 最小流；ASR 已实测完成）、video_fetch.mjs、
按平台的舰队 SKILL 化迁移（含宿主半编排链执行末端 pushTask/直 fetch 化）、
原生 ASR 路由（宿主半 /easel/api/asr + dsh 模型管理凭据）、video_ops.mjs/
audio_ops.mjs + 9 技能引用改写、数据抓取 API 化、install_tool.mjs 缩减、
Python 依赖最终移除（无未申报依赖）。
**Out**：一次性全量重写（逐平台渐进）、宿主半编排逻辑重写（B2 已是 TS，只换
执行末端）、dsh 侧 browser-use / speech-to-text 包的功能开发（只消费不修改）、
`easel/` 残包处置（联动悬空提交，单列拍板）、Easel 仓 git 结构调整。

## Tasks

- [ ] T1: 可行性验证——①douyin a_bogus（纯算实现优先）与 xhs x-s/x-s-common
      （xhshow-js）各跑通一个真实 web API 请求；②mount browser-use playwright-mcp
      后 pushTask 最小流（打开页面+截图落盘+状态文件写入+前端轮询可见），含
      headless/有头形态与 agent 轮内轮询文件验证；③~~ASR 引擎选型~~ **已完成
      （2026-10-14）**：mimo-v2.5-asr 实测通过（chat/completions + 单 input_audio
      part，中文逐字全对，无时间戳→分段定 ffmpeg silencedetect）
      （depends: none）
      **分项进度（2026-10-14）**：①douyin 网关验证 **PASS**（hot/search/list
      HTTP 200 status_code=0 + 热词业务数据；comment/detail 对游客静默风控→按
      降级路线走 browser-use 或带 cookie 复跑）；xhs 签名头生成 **PASS**、
      guest 被 jarvis-gateway 拒（API 已迁 www 同源，edith 404）→ 真实 cookie
      复跑或降级。验证脚本入库 `tools/verify/`。②**已完成（2026-10-15）**：
      dsh headless profile + `--patch` insert 行挂载 browser-use playwright-mcp
      （executablePath 指向既有 chromium-1243，免下载）→ `dsh headless` 一次性
      任务实测：browser 工具可达（navigate/screenshot/wait_for/run_code）、
      截图落盘、状态 JSON 写入、wait 3s 后重读——四点全过。**关键约束发现**：
      browser_take_screenshot 的 filename 只收工作区相对路径（绝对路径被拒），
      pushTask 会话 cwd=projectRoot 时直接传 `outputs/_login/xx.png` 即可。
- [x] T2: video_fetch.mjs——1:1 移植（fetch/流式下载/退出码 0/1/2/3/5/
      --selftest）+ node --test；skill-viral-deconstruction 引用改一行；
      video_fetch.py 删除（depends: T1①）
      **完成（2026-10-14）**：真实链接对拍 douyin 7498720869088513337，
      mjs 下载 108MB 完整视频，platform/title/author/duration_sec 与 py 全
      MATCH；单测 4/4。
- [x] T3: 知乎舰队 SKILL 化——skill-zhihu-answer SKILL.md 按「五段模板」重写
      （登录节/主流程节/dry-run 契约/失败处置），宿主 apiLoginStart/apiPublish
      知乎分支切 pushTask；zhihu_answer.py、zhihu_comments_fetch.py 删除
      （depends: T1②）
      **完成（2026-10-15）**：五段模板重写 + commands.md 浏览器流程速查 +
      两 py 删除（宿主零 spawn 引用）；评论抓取主通道按 §3 改 network_requests
      抓 api/v4/comments、DOM 兜底原序保留。**范围调整**：宿主 zhihu 分支切
      pushTask 移至 T6（web_publisher 批次）——apiPublish 是同步契约（600s 等
      结果），宿主侧会话等待面要在 web_publisher 退役时一并切换；T3 后知乎
      agent 路径登录节自含，web_publisher.py 分支保留为回退。
- [x] T4: 原生 ASR 路由——宿主半 `POST /easel/api/asr`（ffmpeg 抽 16k wav +
      silencedetect 分段 + 逐段调 mimo-v2.5-asr + SRT/ASS 写入器移植
      _wrap_line/_split_long_segment/ASS header），凭据接 dsh 模型管理
      custom provider（读不到则 env 兜底）；21 处 asr 引用改写为路由调用；
      asr.py 退役（depends: none，T1③ 已完成）
      **完成（2026-10-14）**：lib/asr.js（零依赖）+ apiAsr 路由 + 发现文件
      outputs/_easel_api.json（webServer.port 写入/刷新）；模型管理凭据插件侧
      读不到（inject 仅 webServer）→ env/.env 兜底（MIMO_* 进写白名单），
      接线待 dsh 侧评估；node --test 59/59 含真实 mimo srt；5 技能 asr 引用
      全部切路由（auto-subtitle/viral-deconstruction/video-chapters/
      video-highlights/video-to-article）；asr.py 已删（SKILL.md 引用清零后退役；
      EASEL-META 历史溯源字样保留）。video_ops.py/audio_ops.py 仍被其余技能
      散点引用，随 T7 批次清点。
- [ ] T5: 数据抓取 Node 化——bili_login.mjs（vendored QR 编码器）、account_stats
      分平台 API 化（douyin a_bogus → xhs x-s → 其余 browser-use 兜底）、
      xhs_comment fetch/notes API 化；宿主 apiAnalytics 切直 fetch
      （depends: T1①, T3）
      **分项进度（2026-10-15）**：bili 部分**完成**——bili_login.mjs（vendored
      qrcode-generator + zlib 手拼 PNG；签名/cookie 协议/状态机 selftest 过；
      gen QR + 游客 poll 真实冒烟过；whoami 契约 JSON 过），宿主三处 spawn
      切 process.execPath+.mjs，bili_login.py 退役。**其余被凭据阻塞**：xhs
      cookie 待用户填、抖音会话过期待重扫——盲写签名请求无法验证，按「迁移
      一个验证一个」原则挂起，等凭据就绪继续；account_stats 知乎/快手/视频号
      兜底归 T6 批次。
- [x] T5b: video_ops.mjs（text/speed/silence-cut）+ audio_ops.mjs（speed/
      denoise）1:1 移植 + --selftest；9 个 ffmpeg 类技能 SKILL.md 引用改写
      （纯命令→ffmpeg 模板、踩坑子命令→node）（depends: none）
      **完成（2026-10-14）**：对拍全 MATCH（speed 6.720s/silence-cut 5.240s/
      text 10.000s/denoise tier2 3.000s/音频 speed 2.006875s，py vs mjs 同参数；
      ffmpeg 7.0.1）。已知怪癖 1:1 保留并注释（cut 的 -ss/-to 语义）；唯一非
      1:1 点：tts-voiceover ①处原模板对纯音频输入必失败，改为正确 amix。
- [ ] T6: 剩余平台舰队逐个迁移，每平台一提交：xhs 评论写操作 → xhs_publish →
      douyin_publish（读回对账保留）→ account_stats 剩余 → 快手（web_publisher
      配置）→ 视频号/公众号（OOPIF 风险档，不行入豁免）；含 wechatVerifyToken
      宿主直 fetch、biliup→biliupR（depends: T3）
- [ ] T7: Python 终局——index.js spawn 面 §3 表逐行核销、settings.python/
      EASEL_PYTHON 移除、install_tool.mjs 缩配方、C/D 类剩余脚本 .mjs 化或
      豁免清单、pytest→node --test 换防（depends: T2, T4, T5, T5b, T6）

## [S4] Acceptance

- [ ] 干净机器（无 Python）跑通：视频拆解全链路 + 至少一个平台的登录→发布 dry-run
- [ ] video_fetch.mjs 与 Python 版对同一链接产出一致（平台/标题/时长/文件）
- [ ] 迁移后的发布技能在真实平台完成一次内容发布（先小号）
- [ ] 转写：同一音频在新路径下 SRT 输出与旧 asr.py 语义等价（时间戳粒度可不同）
- [ ] video_ops.mjs（text/speed/silence-cut）与 audio_ops.mjs（speed/denoise）
      对同一输入与 Python 版产出一致；9 个 ffmpeg 类技能全部可用（SKILL 硬写
      + Node 脚本混合）
- [ ] 登录文件协议零破坏：outputs/_login 四件套 + 状态 JSON 字段不变
      （success 可加 name/avatar），AccountsPage/PublishPage 轮询逻辑 diff 为零
- [ ] index.js 无 .py spawn 残留（§3 表逐行核销有 grep 证据）；settings.python/
      EASEL_PYTHON 面移除
- [ ] `grep -r python` 宿主半 spawn 面无残留 runner 引用；仓库无 requirements
      声明；如有豁免清单，每项有一行理由+替代路径
- [ ] 纯文本拆解、技能抽屉、发布预检等既有功能回归通过
