---
feature: easel-app-update
status: delivered
updated: 2026-10-25
branch: feat/easel-app-update
commits: 4f8191023b..e712bd73a5
worktree: .worktrees/easel-app-update
---

# Easel 应用内更新器（设置·关于 + 延迟更新弹窗）

## Report

**What was built** — 三个面：①设置·关于节（`settings.section` id `easel.about`，order 90）：当前版本、检查更新（五态按钮：检查中/已最新/可更新·立即更新/重试/检查更新）、下载进度条、最近检查时间、更新源卡片（default/override/error 徽标 + 生效端点）、官网与更新日志链接；非桌面环境降级为一行「仅桌面版提供」静态文案，不出死按钮。②延迟更新弹窗（`shell.overlay` id `easel.update-notice`）：发现新版满 24h 才提醒一次，常驻注册、无 announce 渲染 null；「暂不 / 立即更新」，下载中显示进度，失败态显示原因并可重试。③壳内更新器 `app_update.rs`：tauri-plugin-updater Rust API（endpoints 可被 `update-source.json` 整体覆盖，非法即响亮记入 lastError）、`update-state.json`（数据根，坏 JSON 自愈）、semver 规则 11 比较 + 无状态 24h 判定（notedVersion 去重）、三条命令 `easel_check_update` / `easel_update_state` / `easel_install_update`、`easel://update-progress` 与 `easel://update-available` 事件、安装前经 spawn_blocking 停 dsh、INSTALL_RUNNING 单链 + Drop guard（失败与 panic 都释放）、进度按百分比节流。启动 30s 后静默自动检查，发现新版只发事件，提醒节奏由客户端控制。

**Verification** — `cargo test` 43/43（semver 顺序、24h 门槛、notedVersion、state 往返与自愈、update-source 五种非法输入、percent_of、五个 relay payload 的 wire-key 契约）；easel 插件 `node --test` 230/230，`node build.mjs` 产物与已提交 client.js 逐字节一致；typecheck 全绿（5 门）；`git diff --check` 干净；doc-sync 失败项（electron 笔记断链、旧 spec commit-hash、packages 配对漂移、spec md-wrap）经基线 `bec60b1414` 对照全部预存在，本次新增文件零命中；lint/duplication/hygiene/build:check 属仓库级门，本改动文件零 lint 错误且未触及 workspace 包，未重复跑全量。两轮独立复审终审：spec compliance / correctness / codebase consistency 全 PASS（SHIP）；两处阻塞（InstallStart 缺 kebab-case 致每次安装误报失败；`hostUpdate.js/.d.ts` 被根 `lib/` 忽略吞掉致分支不可构建）与四条中等项（payload camelCase、init 记录误配置、failed 相位保留、安装锁并发）均修复并以测试锁定。

**Journey log** —
- 规格原假设 GUI 文档可直接用 `__TAURI_INTERNALS__`；实际是 loopback 服务的 dsh UI（Windows 为跨域 iframe、mac 为顶层窗口），唯一通道是既有 host-bridge 中继。实现改为扩展中继（白名单 rpc + 事件转发 + 30s 超时）并回写 spec S2。
- 本机 MSVC 缺 INCLUDE 致 ring 构建失败（C1083 stddef.h）；把 updater 依赖切到 native-tls（退掉 rustls/ring），cargo 统一走 vcvars64 包装。
- 复审证明「以为已加」的 serde 属性其实丢过两次：最终以 `payload_wire_keys_match_the_client_contract` 把五个 relay payload 的 JSON 键机械锁定，防同类回归。
- 根 `.gitignore` 裸 `lib/` 会吞任意层级 `src/lib` 新文件（热点雷达会话同坑再现）：加路径锚定 negation，并用 `git ls-files` 与干净检出验证可构建。
- 规格外的发布链缺口：不开 `bundle.createUpdaterArtifacts` 则 `pnpm tauri build` 永不产出 `.sig`，更新安装必然失败；实现期补齐（e712bd73a5）并写入部署文档前置条件。

## [S1] Problem

`easel-dsh-upgrade` 立项时已确认：产品没有版本检查/自动更新，用户要自己找安装包；每次升级都是 126MB 全量包，无梯子的境内用户更难发现新版。升级链本身（`/UPDATE` 覆盖安装、进程树清理、数据零触碰）已实机稳定，缺的是"发现新版"的一环。同时设置里没有"关于"页面：用户看不到当前版本，也没有手动检查更新的入口。

## [S2] Design

**原则（继承 `easel-dsh-upgrade` S2 的预定方向，不再重新立项）：Windows 用 tauri-plugin-updater，`installMode: basicUi`（插件对 NSIS 固定追加 `/UPDATE`、不加 `/S`，规避火绒拦静默安装），调用更新前显式 `dsh.stop()`——updater 启动安装器后 `std::process::exit(0)`，不会走 `RunEvent::Exit`。**

### 执行通道

- 壳（Rust）集成 `tauri-plugin-updater` v2，注册期初始化。
- 清单 = Tauri updater 标准格式：`{version, notes, pub_date, platforms: {<platform>: {signature, url}}}`；协议契约本 spec 定义，清单与签名的生成分发在 `easel-website.md` 的发布管道。
- 签名：minisign 私钥为 CI secret（GitHub Actions），公钥内置 `tauri.conf.json`。密钥对已在实现时用 `tauri signer generate` 生成：公钥入库，私钥存于仓库外 `~/.easel-updater/easel-updater.key`（无口令），交付时提醒用户把它配成 GitHub secret。

### 更新源配置缝（显式 > 隐式）

- 内置默认 endpoints 写在 `tauri.conf.json` 的 `plugins.updater.endpoints`，指向产品站的 `updates/latest.json`；域名按 easel-website 的部署拍板先取 GitHub Pages（`https://laochenfei233.github.io/easel-dsh/`），境内轻量服务器就绪后换默认值。
- override：壳启动时读数据根 `home` 下的 `update-source.json`：`{"endpoints": ["https://…"]}`；存在则整体替换内置列表。该文件坏形 = 误配置 fail loud：写入 `update-state.lastError`，About 展示原因，自动检查本轮跳过。
- 失败呈现：启动延迟的自动检查失败 → 静默（记入 state，不打扰）；设置页手动检查 → 在 About 内报明"无法连接更新源 + 当前源 URL"。

### 版本判定（无状态延迟）

- 提醒命中条件：`latest.version > 当前版本 && now >= pub_date + 24h`。基准取发布时间（用户已默认），不记录本机检测时刻；同一版本对所有用户统一。
- 去重：`update-state.json`（数据根 home 下）记录 `notedVersion`；已 noted 的版本不再弹。
- 每次启动检查一次（单个 GET，30 秒延迟错峰）；About 手动检查立即执行。

### 客户端缝

- **通道现实（实现修正）**：GUI 文档是 loopback 源（Windows 为跨源 iframe，WebKit 为导航后的 app 窗口文档），Tauri 不会向它注入 `__TAURI_INTERNALS__`，唯一的 IPC 路径是既有宿主桥中继——iframe 内 postMessage 到壳页 `app.js`，由壳页 invoke 三条命令并回传结果，更新器事件同样由壳页转发回 iframe。注入脚本（`bundle-runtime.mjs` 的 `injectNotificationBridge`）扩展出 promise RPC（`window.__easelHostUpdate`）与事件订阅；打包时生效，dev 环境无桥（与通知桥同一限制）。
- 降级：`window.__easelHostUpdate` 不存在 = 非桌面壳（浏览器、CLI `dsh web`、WebKit app 窗口）——About 节只渲染一行「仅桌面版提供」的静音文案（不出死按钮），弹窗 entry 虽注册但 `announce` 无事件即渲染 null；判定逻辑的证据在桥模块单测。
- capabilities 无需新增条目：壳自有命令不走插件 ACL，事件监听在 `core:default` 内。

### Shell 命令面（薄封装 tauri-plugin-updater Rust API）

- `easel_check_update`：手动检查，返回 `{status: "up-to-date" | "available" | "error", detail}`；error 时带原因。
- `easel_update_state`：返回当前状态（当前版本、生效端点列表、源状态、上次检查时间与结果、notedVersion、已知最新版）。
- `easel_install_update`：先 `dsh.stop()`，再 `download_and_install`（basicUi）；进度经 `easel://update-progress` 事件推给客户端，下载完成后安装器窗口接管（壳进程退出）。

### 设置·关于节（新建）

- 注册 `settings.section`：id `easel.about`，order 90 置于末尾。
- 内容：应用名 + 当前版本号；「检查更新」主按钮（idle / busy / 错误 / 已是最新 / 有新版 五态，有新版态即变「立即更新」）；安装进行中按钮让位给进度条与阶段文案；更新源卡片（当前源 URL + 默认/自定义/不可用徽章）；链接行：官网、更新日志（指向官网 release 锚点）。
- 设计语言复用设置页卡片语言（`DataRootSection` 同款：inline styles、13px 基准、灰描边按钮 + accent 主按钮），不另起炉灶。
- 文案字典 `settings.easelAbout`（`locales/easelAbout.ts`，zh 主 + en），遵守 locale-owned copy 门。

### 更新弹窗（shell.overlay）

- entry id `easel.update-notice`，简单 entry 直挂 `shell.overlay`（同 `host-release-change` 的模式——弹窗自渲染 mask + 卡片，不设 chain 座）。
- UI：标题"发现新版本 vX.Y.Z"、notes 首段摘要、主按钮「立即更新」、次按钮「暂不」。
- 「立即更新」→ `easel_install_update` → 按钮进入进度态 → 安装器接管。
- 「暂不」→ 仅关闭本次（该版本已 noted，本版本不再弹）；About 里常驻"有新版可用"提示直至升级完成。
- 触发时机：壳在启动延迟检查后若满足命中条件，推 `easel://update-available` 事件，弹窗渲染；刷新/重启后由 About 手动入口兜底（无新版提示即 noted 已生效）。

## [S3] Scope

- In scope:
  - 壳侧 tauri-plugin-updater 集成、endpoints 占位与 override 缝、三条命令、进度事件；
  - 客户端 Tauri 桥（桌面检测 + 降级）、设置·关于节、延迟更新弹窗；
  - 全部新增文案的 zh/en 字典；
  - 单元测试：判定谓词（未满 24h 不弹 / noted 不弹 / 满足即 pending）、state 读写、桥降级逻辑；
  - 受影响文档（桌面 README 中英两份及配对记录）同步更新。
- Out of scope:
  - 官网实现与发布管道（`easel-website.md`，其他对话实现；latest.json/.sig 的生成归该管道）；
  - macOS .app 自动更新（后续独立特性）；
  - 静默自动下载、增量/差分更新、强制升级门。

## Tasks

- [x] T1: 壳加 `tauri-plugin-updater` 依赖 + init + updater 配置（endpoints 默认列表 + `update-source.json` override 读取 + `createUpdaterArtifacts`）（depends: none）
- [x] T2: 壳 update-state 读写 + 判定谓词纯函数 + 三条命令 + `easel://update-progress` 事件（depends: T1）
- [x] T3: 客户端桥模块（host 中继检测、rpc/事件封装、无桥降级常量）（depends: none）
- [x] T4: 设置·关于节组件 + `settings.easelAbout` 字典 + 注册（depends: T2, T3）
- [x] T5: 更新弹窗 overlay entry + 字典（depends: T2, T3）
- [x] T6: 文档同步（升级说明补"应用内检查更新"路径）+ 回归（depends: T4, T5）

## [S4] Acceptance

- [x] typecheck 全绿；lint / duplication / hygiene / build:check 的仓库级红为预存在基线（本改动文件零 lint 错误、未触及 workspace 包），基线对照见 Report
- [x] 判定谓词单测覆盖：版本相同不弹、版本更高但未满 24h 不弹、更高且满 24h 弹、notedVersion 命中不弹（app_update.rs 判定组）
- [x] state 读写单测：缺文件、坏 JSON、正常读写往返（含 update-source 五种非法输入）
- [x] 浏览器环境：About 节降级为一行「仅桌面版提供」文案（不出死按钮）；弹窗 entry 注册但 announce 无事件即渲染 null（证据：hostUpdate.test.js 的检测/降级用例 + store 的 supported 流转）
- [x] 生成的 `installer.nsi` 可 grep 到 `UpdateMode` 语义未被破坏（重打核对）
- [x] 文档写明应用内检查更新路径及其与手动 `/UPDATE` 的等价关系
