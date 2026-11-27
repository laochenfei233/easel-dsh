# 爆款拆解首次运行自动下载环境（ffmpeg/ffprobe + 按需 yt-dlp）

## Context

裸机上第一次跑爆款拆解时，抽帧/转写阶段直接报「未找到 ffmpeg…请安装」失败。用户拍板：**首次运行拆解时自动下载环境，下载完成自动继续采集**。ASR 已是云端 mimo 模型（asr.js 直连，无 Python/whisper 依赖），环境缺口只剩：
- **ffmpeg + ffprobe**（硬依赖，抽帧 + 切音轨/静音检测/切分；PATH 裸名解析，无覆写挂钩）
- **yt-dlp**（仅 `bili/youtube/other` 平台走；`douyin/xhs/kuaishou/sph` 原生路径用不到）

视频号 wxdl sidecar 需管理员手动装证书，**不自动化**，继续走既有琥珀门卡。范围按用户选择：ffmpeg 必装、yt-dlp 按需；下载完自动 POST /deconstruct 继续。

## 实现

### 1. Pin 清单（新文件 `easel/dsh-plugin-easel/env-tools-pins.json`）

照 `apps/desktop-tauri/runtime-inputs.json` 的字段风格（`files` 按 `windows-amd64|darwin-arm64|darwin-amd64|linux-amd64` 键控），每个平台条目：
```jsonc
{ "schemaVersion": 1, "tools": { "ffmpeg": { "kind": "zip", "files": { "windows-amd64": {
  "sources": [ {"url": "gyan.dev essentials zip", "sha256": "<实测>", "bytes": 114768076},
               {"url": "gh-proxy.com/…BtbN…", "sha256": "<实测>"} ],   // 多源同序重试
  "zipEntries": ["…/bin/ffmpeg.exe", "…/bin/ffprobe.exe"] } } },
  "yt-dlp": { "kind": "single-file", "files": { … } } } }
```
- ffmpeg win 主源 = gyan.dev 9.0.2 essentials（本机实测可达，zip 114.8MB，只取两个 exe），备源 = BtbN zip 走 gh-proxy.com（用户既有实践，字节镜像共用同一 sha256）。
- yt-dlp = GitHub releases 独立 exe（~18MB）+ gh-proxy 备源。
- 实现期逐源真实下载并记录 sha256 进清单（rolling 上游漂移时按 dreamina CDN 漂移先例手工 repin，spec 记录此约定）。
- 部署可覆写：`resolveSettings` 新增验证过的 Config 字段 `envToolsDir`（config → `EASEL_TOOLS_DIR` env → 默认 `<EASEL_DATA_ROOT>/tools`），可另加 `envToolsSource`（单串 URL 前缀替换主源 host，sha256 仍强制）。遵守 fail-loud：无 pin/校验不过即报错，绝不静默跳过。

### 2. 下载/安装引擎（新文件 `easel/dsh-plugin-easel/lib/env-tools.js`，零依赖同既有约束）

- **check**：`resolveEnvTool(id)` — 先 PATH `spawnSync(<exe> -version)`（用户安装保优先，同 dreamina「PATH-last」语义的反向：工具目录永远在 PATH 之后兜底），再 `<toolsDir>/bin/<exe>` existsSync；返回 `{source:'path'|'tools'|'missing', path, version?}`。
- **install**（单飞，模块级互斥）：staging `<toolsDir>/.staging/<id>`；逐源 fetch 泵下载（复用 `bundle-runtime.mjs:154-177` 的 download+sha256File 形态：流式写盘、content-length 进度、失败删残留、有限重试）；zip 类用 `project-archive.js` 现成 `readCentralDirectory` + `extractEntries`（含 CRC 校验，fflate 经部署闭包已可用）整包解到 staging 后把 `zipEntries` 移入 `bin/`（不改既有 API）；single-file 直接 rename。原子落位 `bin/`，写 `state.json`（版本/sha256/时间），清 staging。
- 进度持久化 `<toolsDir>/install-state.json`（status 路由读它，跨重启可续显）。依赖（fetch/spawn/now）走注入接缝供测试。

### 3. 路由（`lib/plugins/deconstruct.js`，扩 `DECONSTRUCT_ROUTES`）

- `POST deconstruct/preflight`：现平台门控外新增 `env: {tools:[{id,required,installed,source}], ready}`；required = ffmpeg+ffprobe 恒真，yt-dlp 当 `platform ∈ {bili,youtube,other}`。env 缺失 → `blocked:true, blockedReason:'env'`（优先于 cookie/channels 门显示）。
- `POST env/install {tools:[…]}`：409 若已在装；fire-and-forget 启动，立即返回。
- `GET env/install/status`：读内存 + `install-state.json` 快照。
- `apiDeconstructCreate` 加后端守卫：required 工具缺失 → `ApiError(400, '运行环境缺失…')`（防 preflight 与 create 间竞态，fail loud）。

### 4. 绝对路径接线（显式解析，不再裸 PATH 名）

- `apiAsr`/`deconstructTranscribe`（plugins/deconstruct.js:52-58,117-139）传 `resolveEnvTool` 的绝对 `ffmpegBin`/`ffprobeBin`（asr.js:558-559 参数现成，只缺调用方）。
- 抽帧 stage（lib/deconstruct.js:183-186）spawn 绝对 ffmpeg 路径。
- video_fetch.mjs 子进程（lib/deconstruct.js:156-162）spawn env 把 `<toolsDir>/bin` 前插 PATH（yt-dlp 解析）。
- asr.js `requireFfmpeg` 文案补一句「拆解页会自动下载」。

### 5. 壳侧 PATH（小 Rust 改，覆盖技能链路）

- `setup.rs` 仿 `dreamina_bin_dir`（746-749）加 `tools_bin_dir()`（data root + `tools/bin`，目录存在才返回）；`dsh_runner.rs` PATH builder（346-391）在 inherited PATH 之后、dreamina/libtv 之前追加。会话内技能 spawn 的裸 `ffmpeg`/`yt-dlp` 也吃到了下载产物。cargo test 扩 1703-1716 的 PATH 用例。

### 6. 客户端（`src/components/BreakdownPage.tsx`）

- Preflight 类型加 `env`；新门卡变体（现 `.panel`/琥珀卡结构，415-458 旁）：「首次使用：下载运行环境」，逐工具 ✓/⬇ 行 + 进度条（received/total MB）。
- 卡片出现即（useEffect once）POST env/install → 1.5s 轮询 status → 全部就绪后**自动调用与「开始采集」相同的 create 流程**（从 `startCapture` 提出共用的 create 段）。失败显示 detail + 「重试」。文案按本文件既有硬编码中文风格。

### 7. 文档与测试

- spec：`docs/compose/specs/easel-breakdown-env-bootstrap.md`；`easel/README.md` 依赖段与 `skill-viral-deconstruction/SKILL.md` 依赖表补「首次自动下载」说明；install_tool.py 不动（手动兜底保留）。
- 插件测试 `test/env-tools.test.js`：目录解析优先级、注入 spawn 的 check、注入 fetch 的安装全链（fixture zip、sha 不匹配 fail、备源切换、single-file）、路由三端点 + create 守卫；`test/deconstruct.test.js`/`asr.test.js` 回归。fflate 不可用时的 skip 策略照 `project-archive.test.js` 现行模式。
- cargo test（PATH 用例）；客户端走主检出 esbuild 语法门。

## 验证

1. `node --test`（插件全量，含新测试）— 从仓库根用插件的测试入口跑。
2. `cargo test`（apps/desktop-tauri/src-tauri）。
3. 本机隔离验证：临时 `EASEL_TOOLS_DIR` + 收窄 PATH 起一次 headless 冒烟，确认 check→install→preflight ready→create 全链（114.8MB 真下载一次，顺便实证 gyan 主源可用）。
4. UI 语法门 + 插件既有测试全绿后按 dsh-pre-push-checks 匹配面跑（不跑全仓套件）。

## 不做（记录边界）

- wxdl/微信登录不自动化（管理员证书手动装）；Python/cookie 导入链不自动装（非拆解硬路径）；whisper 模型已退役；通用「环境安装」设置页不在本次范围。