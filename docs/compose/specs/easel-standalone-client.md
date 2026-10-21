---
feature: easel-standalone-client
status: delivered
updated: 2026-10-16
branch: feat/easel-frontend（dsh worktree C:\Users\chenfei\Documents\GitHub\Easel\dsh）
commits: afe26d0644（品牌+splash，含全套图标再生）/ c5e5cb49e5（resolver 提速+4回归测试）/ 5a1636ee6b（L0 home .easel+bin easel；npm 包名留待打包验证）
补充：5639acf21a（hub 收养移植+4 决策测试，cargo test 15/15）。剩余（不阻塞本 spec 交付）：NSIS 全量打包与实机 A/B 计时（T6 尾）；npm 包名改名随打包验证；插件侧立项工作区在 easel-single-workspace 另行推进

### 修复轮（2026-10-16 晚，首包 alpha.2 实机暴露后）

用户装 alpha.2 后发现 UI 仍是旧的（拆解页旧版、无门控）。诊断链：`~/.easel/desktop-server.json`
取端口/token → 303+cookie 取页 → `plugins/??` 合并包指纹（deconstruct/mimo-asr 计数）对副本
→ `/easel/status` 的 projectRoot 暴露 server 实际 profile。**双根因**：①bundle-runtime 的契
约是「仓库先 `pnpm run build` 全量构建，它只 deploy/stage」——alpha.2 打包时只重编了插件，
dsh closure 吃了陈旧 lib（home-paths 仍是 `.dsh` → server 默认 home 落 `~/.dsh`、跑旧 web
profile 旧 patch，壳布好的 `~/.easel` 新档案完全没被用上；web 前端 dist 还是 10-13 的，无
门控无徽章）。②`11256959d8` 引用的 `easel-mode.ts`/`easel-workspace-mode.ts` 从未 git add
（当时测试全绿靠工作区未跟踪副本），后被清理 tsc 产物的 `git clean` 删除，全量 build 时
TS2307 才暴露。**修复**：重建两 helper（dsh `a1f11eb475`）+ 全量 rebuild + tauri bump
`0.2.1-alpha.3`；插件 bump **0.2.1**（Easel `4723ad0`；stamp 门杠杆=`runtime/easel/VERSION`，
bundle-runtime 从插件 package.json 读出写入，壳比对 `.bundle-version` 决定重同步
skills+插件到 `%LOCALAPPDATA%\Easel`——不 bump 版本永远拿到旧内容树）。**产物**：
`Easel-dsh_0.2.1-alpha.3_x64-setup.exe`（126.5MB，19:45 构建）——未安装即被
`Easel-dsh_0.2.1-alpha.4_x64-setup.exe` 取代（追加插件市场退役与向导改造，见
easel-dsh-bundled-install「后续修订」；alpha.4 含本修复轮全部内容）。**前置清单（下次打包先过）**：
①改 src 后确认 lib/ 真被重建再 package（P0）；②`git clean` 前 `git status` 盘点未跟踪源文
件（P1）；③交付验证=fresh 标记 grep（home-paths `.easel`／两包 client 半
`__easelWorkspaceUIMode`／前端 dist 徽章 data-URI）而非只看构建成功（P1）。另已 seed
`%LOCALAPPDATA%\Easel\.env`（MIMO_API_KEY/MIMO_ASR_MODEL/MIMO_BASE_URL，内容树原本无
.env 无 outputs。按 D6 设计属系统 seed，不在重同步白名单内、不会被覆盖）。实机验收待用户：
退出旧实例→装 alpha.3→验 splash/门控/立项/拆解页/`/easel/status` 的 projectRoot
应为 `%LOCALAPPDATA%\Easel`。
---

# Easel-dsh 独立客户端：品牌化 + 安装隔离 + 启动提速 + 启动画面

## [S1] Problem

dsh worktree `feat/easel-frontend` 的桌面壳仍以 DeepSeek Harness 名义交付：产品名/
窗口标题/安装包名/托盘都是 "DeepSeek Harness Desktop"，图标是 dsh 官方 logo，splash
只有 iframe 宿主页里一行状态字；且每次启动都冷 spawn `dsh web`（实测约 4.2s 到
launch URL），窗口在 ready 前不可见。更深一层：CLI 的 npm 包名是 `@deepseek-ai/dsh`、
bin 名是 `dsh`、默认 harness home 是 `~/.dsh`——与官方构建/其他 fork 在同一台机器上
**安装与数据互相踩踏**（`npm i -g` 互顶 bin、共享 profiles/凭据/会话）。

产品名拍板：**Easel-dsh**。参考 prism-agent 的两条已交付工程移植：
[fork 品牌化分叉面] 与 [install-isolation 安装隔离]（bin `prism`/包 `prism-agent`/
home `~/.prism` 的同型方案）。

## [S2] Design

### L0 安装隔离（参照 install-isolation.zh.md D1-D6 映射）

- **D1 范围：安装产物 + 数据根**。更名面 = CLI npm 包名、bin 名、CLI 默认 home，及
  这些名字改变后变假的引用。内部 workspace 命名空间 `@deepseek-ai/*` **不动**（改名
  会整体作废分叉重放清单）；桌面 bundled runtime 布局（`runtime/dsh/` 目录名）、
  `package.json` 的 `dsh.` 前缀清单键（`dsh.bundle`/`dsh.client`）、`DSH_HOME`
  子进程协议变量都保留原名。
- **D2 命名**：npm 包 `easel-dsh`，bin `easel`，默认 home `~/.easel`。home 与桌面端
  一致，一个数据根服务两端；壳级覆盖变量 `EASEL_HOME`（若 setup.rs 已把该名占用给
  内容树，则改用 `EASEL_DSH_HOME`——以现状为准），`DSH_HOME` 仍是子进程协议变量，
  `~/.easel` 是两端零配置根。
- **D3 唯一行为变更 = 默认 home**：`packages/util/home-paths` 的 `DSH_HOME_DIR_NAME`
  变 `.easel`，`DEFAULT_DSH_HOME_DISPLAY`/JSDoc/`dshHomeDisplay` 标签跟随；优先级
  不变（显式配置 → `$DSH_HOME` → 默认）。每个入口（含桌面子进程 spawn）已路由到
  `resolveDshHome`。
- **D4 身份环**（消费点跟随）：`packages/sdk/client/package.json` 与
  `python/sdk-runtime/package.json` 的 `workspace:*` 依赖行；
  `apps/desktop-tauri/scripts/bundle-runtime.mjs` 部署 `--filter`；
  `python/sdk-runtime/src/.../__init__.py` 的 bundled node_modules 路径拼接；
  commander 程序名 `apps/cli/src/args.ts` `.name('dsh')`→`easel`；
  `apps/cli/tests/expected/launcher-help.txt` 重录；根 README 安装行
  `npx easel-dsh web`；CLI 包 `repository` 指向本仓。
- **D5 依赖目录刻意不动**：`docs/dependency-catalog.json` 及生成器记录的是已发布
  `@deepseek-ai/dsh` 的 npm 闭包，fork 未发布无法重放，保持上游故事。
- **D6 存量数据**：**不做自动迁移**（同 prism 立场）。现有 `~/.dsh` 里的会话/凭据/
  插件档案不受影响，官方 dsh 照常可用；Easel-dsh 首启为全新 `~/.easel`（向导重配
  凭据）。交付文档给一行手动迁移命令（robocopy 全量复制）供自用选择。
- **分叉标记**：所有偏离点带 `EASEL-DIVERGENCE` 标记（指本 spec 对应小节）；
  `package.json` 与帮助期望文件无注释语法，只在 spec 索引点名。

### L1 品牌化（shell/client 全链路）

| 站点 | 改动 |
| --- | --- |
| `apps/desktop-tauri/src-tauri/tauri.conf.json:3-5` | productName `Easel-dsh`、identifier `ai.easel.desktop`、窗口 title `Easel-dsh` |
| tauri.conf bundle 描述 | short/longDescription 改 Easel-dsh |
| `src-tauri/icons/*` | 用户素材母版再生 ico/icns/png 全套 + installer header/sidebar bmp |
| `apps/desktop-tauri/ui/dist/index.html` | splash：Easel logo SVG + `Easel-dsh` 标题 + 状态行；iframe/文档 title 同步 |
| `Cargo.toml` | description 改 Easel-dsh（crate 内部名 `dsh-desktop` 保留——taskkill 依赖） |
| `installer-hooks.nsh` | 快捷方式 `Easel-dsh.lnk`、清理路径 `*\Easel-dsh\runtime\node\node.exe` |
| client 品牌层 | `ui-brand-official/locales.ts` name（zh/en）；`packages/client/locale/src/locales/{zh,en}.ts` `brand.localBuild` 改 'Easel-dsh 本地构建' |
| 侧栏/hero 消费点 | `ui-sidebar/SidebarRoot.tsx`、`ui-conversation/skeleton/EmptyHero.tsx` 换 Easel Logo 组件（`ui-primitives` 新增 `EaselLogo.tsx`，参数化几何） |
| `apps/web` | `vite.config.ts` DEFAULT_CLIENT_TITLE、`public/favicon(+dark).svg`、`manifest.webmanifest` name/short_name |
| 应用内既有文案 | locales 里 "DeepSeek Harness" 字样仅改产品指代处；测试 fixture 保留上游原文 |

Logo：用户将提供素材图（PNG/SVG），重绘为圆角白色方底徽章（同 prism badge 底）+
素材主体，产出 `design-assets/app-icons/easel-icon.svg` 母版 + `easel-mark.svg`，
按 prism 流程（1024px 渲染逐级降采样）再生位图。**母版先交用户确认再进 icons/**
（确认前 icons 位保持占位不提交）。

### L2 启动提速（desktop-startup-latency 复刻）

1. **Hub 收养（Layer 1，Rust 壳侧）**：`dsh_runner.rs` 移植 ServerRecord/adopt 机制——
   spawn 后把 port/url/pid/CLI 入口（路径+长度+mtime）写入 `$DSH_HOME/desktop-server.json`；
   下次启动先读记录，三项校验（CLI 运行时身份、launch URL 端口+token、loopback
   `GET /?token=…` 应答）全过则采纳既有 hub，跳过 spawn 直接 ready。重启服务=
   reverify 后按 pid 结束再冷启；退出=结束子树与收养 hub；记录在 hub 停止服务即弃。
   因记录键是本构建 CLI 入口身份 + home 已隔离，永不误收养其他构建的 hub
   （install-isolation A6 同款验收）。
2. **Resolver 提速（Layer 3，`packages/boot/app-boot`）**：`resolver.ts` 的
   `canonicalPath` 改走 carrier `realModuleDirectory`（一次 FS 调用代替逐组件 lstat）；
   `profile.ts` 加 DirectoryListings 门（每个搜索过的 node_modules 目录每次构建只列
   一次）；`profile.spec.ts` 补四个回归测试（大小写折叠、无 manifest 跳过、POSIX/
   Windows ACL 搜索路径探针）。

不做：Layer 2（退出后驻留 hub）；闭包预打包。

### L3 启动画面（新设计）

1. **窗口立刻显示**：`lib.rs` build_main_window 后立即 show 主窗（内容是本地壳页，
   不依赖 hub）；既有 `dsh://ready` 流程不变，ready 后 iframe 加载、splash 淡出。
   需实测确认早 show 不丢帧（16b1253223 的黑屏修复前提是壳页无内容可显示，现
   splash 内容先行；以 GUI 实测为准）。
2. **shell 页 splash**：Easel logo 描边动画 + 标题「Easel-dsh」+ 状态行（沿用既有
   失败/重试文案与宿主桥 hold/reveal）；首启向导页（wizard.html）标题同步品牌。

## [S3] Scope

- In scope：L0 全部身份环；L1 全部站点；L1 logo 母版重绘+位图再生；L2 两刀移植及其
  测试；L3 窗口时序+shell 页 splash+wizard 品牌化；EASEL-DIVERGENCE 标记。
- Out of scope：Easel 业务功能改动（任务1/3 分立 spec）；存量 `~/.dsh` 自动迁移
  （D6，给手动命令）；`docs/dependency-catalog.json`（D5）；内部 `@deepseek-ai/*`
  命名空间；Electron 壳 `apps/desktop`（上游遗留不动）；mac/linux 安装器位图。

## Tasks

- [ ] T0: L0 安装隔离（home-paths 常量与文案、CLI 包/bin/程序名、消费环、帮助期望、
  README 安装行）(depends: none)
- [ ] T1: L1 conf/安装器/壳页/client 品牌层/消费点改造（logo 位图先占位待 T2）
  (depends: none)
- [ ] T2: Easel logo 母版重绘 → 用户确认 → 再生全套位图 + favicon (depends: T1)
- [ ] T3: L2 Layer 1 hub 收养移植（含 adopt 测试） (depends: T0)
- [ ] T4: L2 Layer 3 resolver 提速移植（含 4 回归测试 + A/B 计时） (depends: none)
- [ ] T5: L3 窗口时序 + shell 页 splash + wizard 品牌化 (depends: T1)
- [ ] T6: 全量验证（cargo test + app-boot vitest + home 断言 + NSIS 构建 + 实机启动）
  (depends: T0-T5)

## [S4] Acceptance

- [ ] 既无 `$DSH_HOME` 也无显式配置时，构建产物 `resolveDshHome()` 解析为 `~/.easel`；
  设置 `$DSH_HOME`/`$EASEL_HOME` 仍优先；`npm pack` CLI 产出 `easel-dsh-<v>.tgz`，
  bin `easel`；源码 `--help` 横幅 usage 行写 `easel`。
- [ ] 桌面壳/托盘/安装器/manifest/帮助全链路品牌为 Easel-dsh；bundle id
  `ai.easel.desktop`；`dsh.bundle`/`dsh.client`/`runtime/dsh` 布局名保留。
- [ ] logo 母版经用户确认；icons/ 全套位图由母版再生（产物尺寸逐项核对非零）。
- [ ] 二次启动命中 hub 收养（desktop-server.json 三项校验过，无二次 spawn）；重启
  服务走 reverify→by-pid→冷启；退出后无 hub 存活。
- [ ] `cargo test`（desktop-tauri，含 adopt 新测试）与 `app-boot` vitest（含 4 回归
  测试）全绿；packaged A/B 实测提速（3 轮交错）。
- [ ] 实机启动：立刻见到品牌 splash，ready 后进界面；官方 dsh 与 Easel-dsh 同机
  互不踩踏（home/bin/安装目录三隔离）。
