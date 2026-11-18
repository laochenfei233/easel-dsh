---
feature: easel-breakdown-env-bootstrap
status: delivered
updated: 2026-11-19
branch: feat/easel-breakdown-env-bootstrap
commits: dd842feb70
---

# 爆款拆解 · 首次运行自动装配运行环境（ffmpeg / yt-dlp）

## Report

**What was built** — 裸机首次运行爆款拆解不再死于「未找到 ffmpeg」：preflight
在平台门控之前先做运行环境快照（`-version` 探测，PATH 优先、数据根
`tools/bin` 兜底），缺 ffmpeg/ffprobe（恒需）或 yt-dlp（仅 `bili/youtube/other`
平台，抖音/小红书/快手/视频号走原生下载路径用不到）时给出「下载运行环境」
门卡并**自动开装**；下载逐源校验 sha256（pin 清单 `env-tools-pins.json` 与
插件同包发布），zip 经 project-archive 的中央目录解压器整包解压后按清单条目
落位，安装完成**自动续跑本次采集**（用户拍板，无需再点按钮）。装好的
`tools/bin` 由壳注入 PATH（`dsh_runner.rs`，在继承 PATH 之后、dreamina/libtv
之前——用户自装保优先），会话内技能 spawn 的裸 `ffmpeg`/`yt-dlp` 同样可用。

**设计要点** —

- **pin 即事实源**：清单字段风格同 `apps/desktop-tauri/runtime-inputs.json`
  （`files` 按 `windows-amd64|windows-arm64|linux-amd64` 键控，darwin 暂无
  条目——evermeet 本机不可达且 `yt-dlp_macos` 已停发，mac 走 PATH/brew 探测，
  缺 pin 时 fail loud 提示手动安装）。Windows 主源 gyan.dev 9.0.2 essentials
  （官方 `.sha256` 摘要钉版），备源 BtbN 直链 + gh-proxy 镜像（GitHub 被墙
  通路，用户既有实践）。**BtbN 是滚动构建，上游刷新会使 sha256 失配——按
  dreamina CDN 漂移先例手工 repin**（`pinnedAt` 记录钉版日期）。
- **状态以 `install-state.json` 为事实源**（数据根 `tools/`，原子写 + 750ms
  节流）：status 路由只读文件，应用重启后卡在 running 的历史态改判
  `interrupted`，前端给「重试下载」。
- **解析顺序 PATH 优先**：用户自装的保优先（与壳侧 dreamina/libtv
  「PATH-last」同一语义），下载产物只兜 PATH 缺失的机器。
- **显式接线**：`asr.js` 的 `ffmpegBin/ffprobeBin` 参数首次有了真实调用方
  （拆解 asr 路由 + transcribe 闭包），抽帧 spawn 用解析后的绝对路径，
  `video_fetch.mjs` 子进程前插 `tools/bin` PATH。`requireFfmpeg` 的 ENOENT
  文案指向自动下载。
- **配置面**：`resolveSettings` 新增验证过的 `envToolsDir`（config →
  `EASEL_TOOLS_DIR` → `<EASEL_DATA_ROOT>/tools`；开发态回退 projectRoot 兄弟
  目录），壳侧同名 env 保持一致。
- **路由**：`POST env/install`（校验同步、下载异步、单飞 409）、
  `GET env/install/status`；preflight 响应新增 `blockedReason: 'env'` 与
  `env` 快照；create/retry 保留后端守卫（preflight 与 create 之间工具可能
  被手动删掉，缺失直接 400）。

**Verification** —

- 插件全量 `node --test` → 346 tests，342 pass / 0 fail / 4 skip（既有跳项）；
  新增 `test/env-tools.test.js` 7 例（平台键、平台-工具矩阵、解析三态、
  zip 安装全链含 sha 失配换源、截断拒绝落位、无 pin fail loud、interrupted
  语义），`local-api/asr/deconstruct` 测试以 `envToolProbeDeps` 注入缝隔离宿主
  是否装了 ffmpeg（测试机无 ffmpeg 也不影响路由走向）。
- 客户端 esbuild 构建门过（`node build.mjs`）。
- `cargo test` → 55 pass（含新增 `env_tools_bin_dir_requires_existing_dir`）。
- 隔离冒烟：`EASEL_TOOLS_DIR` 指向临时目录，真实 pins + 真实网络装 yt-dlp
  （23.5MB，GitHub 直连）：下载 → sha256 校验 → 落位 `bin/yt-dlp.exe` →
  `--version` 出 2026.10.26；install-state.json 进度逐 tick 落盘实证。114.8MB
  的 gyan zip 全量真下载受本机带宽限制未跑（zip 解压与条目落位由单测 +
  中央目录实测条目名覆盖）。

**Journey log** —

- pin 取证：gyan.dev 不发布版本化 URL 的根路径摘要，官方 `.sha256` 在
  `builds/packages/` 前缀下（根路径 404 曾误判为无摘要）；BtbN 与 yt-dlp 的
  GitHub release 资产现自带 `digest` 字段（API 直出 sha256），免下 200MB 即可钉版。
- evermeet.cx 本机 TLS 直连失败（exit 35）——darwin 侧不进 v1 pin 的决定性
  依据；`yt-dlp` 裸资产是 python zipapp（3MB）不是独立二进制，`yt-dlp_macos`
  已停发，mac 补装走既有 pip 指引。
- 测试缝：路由层探测若用真 spawnSync，宿主是否装了 ffmpeg 就决定
  create/preflight 测试走向（实测本机无 ffmpeg 时 3 个文件翻红）→
  `envToolProbeDeps` 显式注入缝，测试换恒成功桩，生产默认真探测。
- 冒烟抓到的真 bug：版本探测用 `-version`，yt-dlp 只认 `--version`
  （`-v` 是 verbose）——装完仍判 missing，preflight 会反复触发安装；
  改用 ffmpeg/yt-dlp 都接受的双横线形式。冒烟还顺带实证了 PATH 优先：
  本机 PATH 已有 yt-dlp 2026.08.19，解析命中 PATH 而非刚装的 10.26。

## Scope

**In**：pin 清单、`lib/env-tools.js` 装配引擎、deconstruct 路由三处接线、
`BreakdownPage` env 门卡与自动续跑、壳侧 PATH 注入、测试与本文档。
**Out**：wxdl 视频号下载器自动安装（需管理员手动装证书，继续琥珀门卡引导）、
Python/cookie 导入链自动装配（云端 ASR 后非拆解硬路径）、whisper 模型（已由
云端 mimo 退役）、通用「环境安装」设置页（`install_tool.py` 仍是手动兜底）、
darwin 自动下载（PATH/brew 探测 + 手动指引）。
