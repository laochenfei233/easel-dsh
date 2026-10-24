---
feature: easel-dsh-layout
status: in-progress
updated: 2026-10-21
branch: feat/easel-mac-package
commits: TBD
---

> Workspace: current `feat/easel-mac-package` worktree (the v3 WIP and spec
> edits were uncommitted, so a fresh worktree would have lost them). No separate
> worktree was created; this note records the override.

# Easel-dsh 目录分层：程序在安装目录，数据在文档/Easel-dsh（可迁移）

## [S1] Problem

当前程序、内容和 dsh home 分散在三处：

- 程序：`%LOCALAPPDATA%\Easel-dsh`（exe、`runtime\`、`uninstall.exe`）
- 内容/产物：`%LOCALAPPDATA%\Easel`（skills、插件源、`projects\`、`outputs\`、
  `.env`）
- 配置/会话：`~/.easel`（profiles、sessions、storages、credentials、logs）

升级只能覆盖安装根目录，数据在根目录外；卸载器问「是否删除 Easel 内容目录」
时删的是 `%LOCALAPPDATA%\Easel`，与 `~/.easel` 又不一致。备份、换机、排障都
要记三个路径，容易漏。

目标布局（所有平台）：

```
Windows   %LOCALAPPDATA%\Easel-dsh\app\      # 只有程序
macOS     /Applications/Easel-dsh.app        # 只有程序
Linux     <install dir>/                     # 只有程序

Windows   %USERPROFILE%\Documents\Easel-dsh\
macOS     ~/Documents/Easel-dsh/
Linux     ~/Documents/Easel-dsh/             # XDG DOCUMENTS
  workspace\                                 # projects、outputs、skills、.env
  home\                                      # dsh home：profiles、sessions、凭据
  .easel-data.json                           # 本目录是 Easel 数据根的标记
```

三个约束：

1. 默认位置用操作系统解析出的「文档」目录（Windows 已知文件夹，尊重本地化/
   OneDrive 重定向；macOS `~/Documents`；Linux XDG `DOCUMENTS`），不是写死的
   `Documents` 字符串。
2. 数据根可配置：设置页选择一个文件夹并迁移，配置指针存在独立于数据根的
   小文件里（见下）。
3. 迁移不改写项目文件、会话记录或工作区 registry：旧绝对路径通过
   junction/symlink 继续解析，项目、侧栏文件、媒体播放、会话归组都不受影响。

数据放在安装目录之外是刻意的：文件夹大小、存储面板和清理工具按安装目录统计
时，不会把用户的项目算到应用头上；卸载、升级也不会碰它。

`workspace` 与 `home` 分开：`workspace` 是 agent 的项目根（agent 可读写），
`home` 含凭据和会话，不能放进项目根里面。

## [S2] Design

### 安装器

- 安装器必须**以管理员权限启动**（UAC 提权）；非管理员会在 stub 阶段 exit 2。
  安装路径仍是当前用户的 `%LOCALAPPDATA%\Easel-dsh\app`。
- Tauri 没有 `installDir` 配置，默认 `$INSTDIR = $LOCALAPPDATA\${PRODUCTNAME}`。
  用 `bundle.windows.nsis.template` 指向自定义模板（fork Tauri 2.11.4 的
  `installer.nsi`），只改默认安装路径：
  `InstallDir "$LOCALAPPDATA\Easel-dsh\app"`。
  `PLACEHOLDER_INSTALL_DIR` 保持原值，`.onInit` 的
  `$INSTDIR == PLACEHOLDER` 分支不会触发，因此不会被
  `RestorePreviousInstallLocation` 拉回旧根目录。
- `$INSTDIR` 只含 app；用户数据在系统「文档」目录下的 `Easel-dsh`（默认），
  不在安装器的文件清单里。升级、卸载默认都不碰它。
- 旧布局迁移时，旧安装根本身就是 `%LOCALAPPDATA%\Easel-dsh`，新安装根是它的
  子目录 `app`。**旧 `uninstall.exe` 必须清理**：旧卸载器的 POSTUNINSTALL
  钩子会 `RMDir /r "$LOCALAPPDATA\Easel"`；迁移后该路径是 junction，递归删除
  可能顺着 junction 删掉数据目录下的 workspace。
- 自定义模板要跟随 Tauri 升级同步；模板头部记录 fork 的 Tauri 版本，升级
  Tauri 时 diff 一次。

### 路径解析（所有平台）

- `install_dir` 只用于「数据根不能落在安装目录里」的校验和旧布局识别：
  - Windows：`%LOCALAPPDATA%\Easel-dsh`（程序在 `app\`）；
  - macOS：`.app` 包路径（如 `/Applications/Easel-dsh.app`）；
  - Linux：可执行文件所在目录。
- `default_data_root = documents_dir() / "Easel-dsh"`：
  - Windows 用 `dirs::document_dir()`（`SHGetKnownFolderPath`，尊重本地化和
    OneDrive 重定向）；
  - macOS `~/Documents`；Linux XDG `DOCUMENTS`，缺失时 `~/Documents`。
- `data_root = pointer.dataRoot ?? default_data_root`；指针见下。
- `data_dir = data_root`（`workspace` + `home` 的父目录）。
- `dsh_home = data_root\home`（`DSH_HOME` 可覆盖，dev 用）。
- `easel_home` 分两种情况：
  - **有旧逻辑路径的机器**：保持旧拼写（Windows `%LOCALAPPDATA%\Easel`；
    macOS/Linux 的当前 fallback `~/AppData/Local/Easel`），它是指向
    `data_root/workspace` 的 junction/symlink。逻辑路径不变，项目文件和旧
    session 的绝对路径继续成立。
  - **新装机器**：`data_root/workspace`（逻辑路径与物理路径一致）。以后迁移时
    在旧 `data_root` 留一个链接，旧路径继续解析。
- `spawn_child` 显式给 dsh 子进程传 `DSH_HOME`、`EASEL_HOME`，以及
  `EASEL_DATA_ROOT`、`EASEL_DATA_ROOT_DEFAULT`、`EASEL_DATA_ROOT_CONFIG`：
  设置页的宿主半读这些值展示/校验，不自己猜 Documents。

### 数据根指针（bootstrap）

路径解析早于 Tauri app 建好，所以指针放在不依赖数据根的位置：

- Windows：`%LOCALAPPDATA%\ai.easel.desktop\data-root.json`
- macOS：`~/Library/Application Support/ai.easel.desktop/data-root.json`
- Linux：`$XDG_DATA_HOME/ai.easel.desktop/data-root.json`（默认
  `~/.local/share/ai.easel.desktop/data-root.json`）

内容：

```json
{ "version": 1, "dataRoot": "/absolute/path/Easel-dsh", "previousRoot": "/old/root", "updatedAt": 1761000000 }
```

原子写（临时文件 + rename）。指针缺失 = 用默认根；指针指向不存在或不可写的
目录 = 回退默认根，并在启动日志和设置页报告，不静默重建到别处。

### 为什么迁移机器保留旧逻辑路径

dsh 的工作区/会话归组按「记录目录」匹配：一个 session 只有在记录目录与项目
路径一致时才属于该项目（`packages/workspace/workspace` 的已知限制）。旧
session 记录的目录是 `%LOCALAPPDATA%\Easel`。如果迁移后把项目路径改成
`data\workspace`：

- 旧 session 会变成未分组；
- 旧工作区记录仍指向旧路径，而新路径又是一个工作区，`realpath` 去重可能直接
  判定重复路径，启动校验失败。

把旧路径保留为 junction、并继续作为 `projectRoot`，**但这些还不够**（2026-10-20
实机复现）：dsh 在启动时把每个 session header 的 cwd 过 `realpath`，而工作区
记录里的 path 仍是旧拼写。迁移后旧路径成了 junction，两个串不相等，于是：

- `WorkspaceEntity.sessionIds` 的成员过滤
  （`host.sessionPath(id) === record.path`）把旧 session 全部踢出工作区，侧栏
  全部掉进「未分组」；
- `attachSession` 用 canonical cwd 与 `record.path` 比较，在工作区里新建会话
  报 `session/workspace-attach-failed`；
- 侧栏文件面板拿不到带工作区上下文的会话；媒体预览又把 `workspaceFiles.stat`
  的 canonical 绝对路径与 junction 的 `projectRoot` 做前缀比较，报「页内播放
  不可用」。

修复保持「不重写历史路径」的取舍，只把身份比较规范化：

- **dsh `WorkspaceRegistry`**：启动时把每条记录的 path 过 `realpath` 得到规范
  身份；成员过滤、attach、status、mutate 剪枝、bootstrap 分组、
  `resolveByPath` 全部用规范路径，磁盘上的旧拼写保持不动。旧安装下次启动
  自愈，不需要迁移 registry。
- **dsh workspace feed**：增量 upsert 也从 registry 取规范 path（title/session
  顺序/时间戳仍取已提交记录）；否则第一次改名/attach 后客户端会从规范
  baseline 翻回 junction 拼写，Easel 的任务会话又落回「未分组」。
- **dsh client `resources.protocolOf`**：WebView2 132（桌面壳）把非特殊 scheme
  的 `//host` 解析成 opaque path（`hostname` 为空、`pathname` 以 `//host` 开头），
  于是 `dsh-resource://file/...` 找不到 `file` provider，桌面窗口所有文件预览
  都报「文件资源服务不可用」；现在同时接受 `hostname` 与 `pathname` 首段。网页版
  的当前 Chromium 走 `hostname` 分支，行为不变。
- **easel 宿主 `resolveSettings`**：`projectRoot` 同样过 `realpath`，使
  `/easel/status`、客户端媒体 URL 与宿主 `workspace-media` 路由使用同一规范
  路径；根不存在时保留配置拼写，由读取方报错。

新装机器没有历史包袱，直接让 `EASEL_HOME` 指向 `data_root/workspace`。以后改
路径时在旧根留链接，旧项目绝对路径仍能解析；不在界面上改写工作区记录。

### 启动迁移（幂等）

在壳启动、spawn dsh 之前执行 `migrate()`：先完成 v2（旧安装收拢到
`<install>\data`），再把数据搬到 `data_root`（指针或默认 Documents/Easel-dsh）。
两段都幂等，未完成的段下次启动重试。

**v2：收拢到 data 中间目录（旧安装）**

1. `data\workspace` 不存在且 `%LOCALAPPDATA%\Easel` 是真实目录：move 到
   `data\workspace`（同卷 rename；失败则 copy+校验后保留旧目录并回退），
   然后在旧路径建 junction `%LOCALAPPDATA%\Easel -> data\workspace`。
   - 保留 junction 的理由：现有 192 个项目文件（agent 生成的脚本、list、
     timeline）写死了旧绝对路径；旧 session 目录名也编码了旧 workspace 路径。
     重写这些引用比 junction 风险大。
2. `data\home` 不存在且 `~/.easel` 是真实目录：move 到 `data\home`，在
   `~/.easel` 建 junction。CLI 默认 `~/.easel` 仍指向同一份数据；旧 session
   路径可解析。
3. 重建 `data\home\node_modules` junction，目标改为
   `app\runtime\dsh\node_modules`。现有 `ensure_home_node_modules` 在
   `link.exists()` 时直接返回；dangling junction 又会让 `mklink` 因路径已存在
   而失败。改用 `symlink_metadata` 检测 reparse point，必要时先 `rmdir` 再建。
4. 清理旧安装根：删除 `%LOCALAPPDATA%\Easel-dsh\runtime`、
   `dsh-desktop.exe`、`uninstall.exe`（不碰 `app` 和 data 中间目录）。旧
   `uninstall.exe` 必须先删，理由见上。
5. 全部成功后写 `data\.layout-v2.json`；之后启动跳过。任一步失败：保留旧路径
   可用，记录日志，下次重试；不写标记。

迁移期间旧 server 必须已停（安装器 PREINSTALL 钩子负责）。

**迁移到 data_root（v2/v3 → Documents/Easel-dsh 或用户选择的根）**

1. 源根按优先级探测：`<install>\data`（v2，Windows）、
   `%USERPROFILE%\Easel-dsh`（未发布的 v3 WIP，兼容一次）、macOS/Linux 的
   legacy `~/AppData/Local/Easel` + `~/.easel`（当前 fallback 的实际位置）。
2. 目标 = `data_root`。目标为空，或已有 `.easel-data.json`/`.layout-v2.json`
   时继续；已有一份完整数据且没有迁移标记时视为歧义：保留两边，报告，不猜。
3. 同卷 rename；跨卷先写 `.easel-migrating` 再复制、校验、删源；复制失败保留
   源完整。`home/node_modules` 链接在移动前移除，壳下次启动重建。
4. 重指逻辑链接（见下），然后写指针和 `.easel-data.json`（记录
   `previousRoot`、时间戳）。
5. 目标若是指向当前根的旧根链接（迁回默认/上一个位置），先删链接再搬回；
   不按「目标已含数据」拒绝。验证对已有路径做 `realpath` 比较，避免 junction
   别名绕过祖先/后代检查。
6. 同卷 rename、跨卷 `.easel-migrating` 复制 + 文件数/字节校验；分割的
   legacy workspace/home 走同一套标记与校验。迁移前检查目标卷剩余空间
   （源大小 + 5%）。
7. 失败：指针不动、源可用、下次重试；设置页触发的迁移把错误写入
   `data-root.result.json`，新 server 通过 `GET /easel/api/data-root` 展示。
   指针存在但目标不可用（外接盘/网络盘掉线）时**不重写指针、不向默认根迁移**，
   启动日志与设置页报告 `lastError`；普通启动不会因为路径判断失败而移动数据。

**项目路径兼容（不改写项目）**

- 旧逻辑 workspace 路径（Windows `%LOCALAPPDATA%\Easel`；macOS/Linux
  `~/AppData/Local/Easel`）和 `~/.easel` 保持拼写，只重指到新根。
- 新装机器以后改根时，在旧 `data_root` 留一个 junction/symlink 指向新根，
  项目文件里的旧绝对路径继续解析；旧根在安装目录内时不留链接（避免应用目录
  重新变胖），依赖旧逻辑链接。
- 不批量改写项目文件、`~/.easel` 里的会话文件或 workspace registry 记录；
  dsh registry/feed 的 realpath 身份规范化负责把旧拼写映射到新物理路径。

### 设置页与迁移流程

设置页新增「数据位置」section（`settings.section`，id `data-root`），由
dsh-plugin-easel 客户端注册。内容：当前根、默认根、是否默认、云同步提示
（Documents 在 OneDrive/iCloud 下）、路径输入、`选择文件夹…`、`迁移并重启`。

宿主半（`index.js` 的 `CORE_ROUTES`）：

- `GET /easel/api/data-root` → `{ current, default, isDefault, configPath,
  cloudSynced, pending, lastError }`；值来自
  `EASEL_DATA_ROOT`/`EASEL_DATA_ROOT_DEFAULT`/`EASEL_DATA_ROOT_CONFIG`。
- `POST /easel/api/data-root/pick` → 调平台原生目录选择器（Windows PowerShell
  `FolderBrowserDialog`；macOS `osascript -e 'choose folder'`；Linux
  `zenity --file-selection --directory`，缺失时 501），返回绝对路径；失败时
  前端保留文本输入。
- `POST /easel/api/data-root` `{ path }` → 校验：绝对路径、可写、不落在安装
  目录/当前根内、目标可创建；写 `data-root.pending.json`；响应 202；短延迟后
  `process.exit(0)`。壳 supervisor 看到子进程退出，在 spawn 前调用
  `apply_pending_data_root()` 完成迁移并带新 env 重启 dsh；webview 沿用现有
  `dsh://ready` 导航刷新。失败时新 server 从 `lastError` 展示原因，指针仍是
  旧根。

原生选择器放在宿主 Node 半而不是 Tauri IPC：dsh UI 在 iframe（WebView2）或
远程 origin（WebKit），拿不到受 capability 限制的 Tauri 命令；宿主的子进程
在同一个桌面会话里，跨平台且不需要放宽 capability。

### 迁移校验与回退

- 目标路径规范化后不得是：安装目录、当前数据根、当前根的祖先/后代、Documents
  根本身；不得是已有数据的非 Easel 目录。
- 迁移前检查磁盘剩余空间（跨卷复制至少源大小 + 5%）。
- 同卷 rename 是原子的；跨卷复制用 `.easel-migrating` 标记，崩溃后下次启动
  删除不完整目标重试。
- 逻辑链接重指失败时保留新根数据和指针，链接下次启动重试；旧逻辑路径断链时
  `resolve_easel_home` 回退到物理 workspace，应用仍能启动。
- 设置页的迁移是显式操作；普通启动从不因为路径判断失败而移动数据。

### 卸载

- 默认（更新或普通卸载）：只删程序；`data_root` 与逻辑链接保留。
- 可选删数据（Windows 卸载器）：先不带 `/s` 移除逻辑链接
  `%LOCALAPPDATA%\Easel`、`~/.easel`、`<data_root>\home\node_modules`，再递归
  删指针里的 `dataRoot`，并清理遗留的 `<install>\data` 和
  `%USERPROFILE%\Easel-dsh`。递归删除只针对带 `.easel-data.json` /
  `.layout-v2.json` 标记、非盘符根、非 reparse point 的目录，防止被改坏的指针
  变成任意路径删除；绝不能对 junction 用 `RMDir /r`。macOS/Linux 没有安装器：
  删 app 后数据保留，用户自行删除。
- 数据询问文案改为「是否同时删除 Easel 数据目录（工作区、会话、账号画像）？」，
  默认否；`$UpdateMode <> 1` 才询问。

### 路径长度

实测（本机，`LongPathsEnabled=1`）：

- runtime 最长相对路径 143，`app\runtime` 后约 192；
- v2 根 `data\` 下最长约 313（`home`）；Documents 根
  （`C:\Users\<user>\Documents\Easel-dsh`）比它短约 10 个字符，仍可能超过
  260；保留 `LongPathsEnabled` 要求，迁移/安装验收跑一次最长路径检查。

迁移/安装验收要跑一次最长路径检查；若目标机器未启用 `LongPathsEnabled`，保留
旧 home 或提示用户。

## [S3] Scope

- In scope:
  - 自定义 NSIS 模板与 `app` 安装路径；
  - 所有平台的默认数据根 `Documents/Easel-dsh`（OS 文档目录解析）；
  - 独立 bootstrap 指针、设置页选择路径、迁移与回退；
  - Rust 路径常量、`DSH_HOME`/`EASEL_HOME`/数据根 env、node_modules junction 修复；
  - 启动迁移 + 设置页 pending 迁移 + junction/symlink + 标记 + 回退；
  - 安装/卸载钩子的路径、旧根清理、数据询问；
  - 宿主原生目录选择器、设置页 UI 与 locale；
  - 文档、迁移验证。
- Out of scope:
  - Tauri updater / 自动更新；
  - 内容增量更新；
  - 重写历史绝对路径（用 junction/symlink 兼容，不批量改用户文件）；
  - 迁移工作区 registry 记录（保留旧逻辑路径）；
  - 云同步本身（只检测并提示 Documents 在 OneDrive/iCloud 下，不代为配置同步）。

## Tasks

- [x] T1: 自定义 `nsis/installer.nsi`（fork Tauri 2.11.4，改 `InstallDir`），
      `tauri.conf.json` 接 `template`；生成脚本核对 `$INSTDIR`（depends: none）
- [x] T2: Rust `install_root/app_dir/data_dir/easel_home/dsh_home` 常量与
      `DSH_HOME`/`EASEL_HOME` 子进程环境（depends: none）
- [x] T3: `migrate_layout()`：move + junction + marker + 失败回退；单元测试覆盖
      fresh / migrated / partial（depends: T2）
- [x] T4: `ensure_home_node_modules` reparse-point 处理（dangling/existing
      junction 重建）（depends: T2）
- [x] T5: 安装器钩子：杀 app/legacy runtime 进程；POSTINSTALL 清理旧根；数据
      询问新路径 + `$UpdateMode` 守卫（depends: T1, T2）
- [x] T6: 卸载：junction 安全删除 + 默认只删 app（depends: T5）
- [x] T7: E2E：本机真实数据迁移（项目绝对路径、session、outputs、凭据、插件
      加载）；fresh install；upgrade；uninstall（depends: T3–T6）。
      迁移 / fresh / 运行中升级已验证；卸载器非提权直接运行也验证（数据默认
      保留，app 文件/注册表/快捷方式移除）；alpha.23 载荷已带入
      `6bdfe0f9b4` + `b96b76b055` + `50d55bb`
- [x] T8: 文档 `docs/INSTALL-DESKTOP.md` 目录说明/备份/迁移；更新
      `easel-dsh-upgrade.md` 的路径引用（depends: T1–T6）
- [x] T9: dsh workspace registry 记录 path 运行时 `realpath` 规范化，修复旧
      session 归组与工作区 attach（unit：junction 记录 + 两种拼写的 header）
      （depends: T3）
- [x] T10: easel 宿主 `projectRoot` `realpath` 规范化，修复侧栏媒体 URL 与
      `workspaceFiles.stat` canonical 路径的前缀比较（unit：junction 根 +
      `/status` + `workspace-media` 同路径）（depends: T3）
- [x] T13: Rust 路径解析：`dirs::document_dir()` 默认根、bootstrap 指针
      （读/原子写/缺失与坏指针回退）、`EASEL_DATA_ROOT*` env、平台
      `install_dir`；单测覆盖默认/指针/回退（depends: T2）
- [x] T14: 迁移引擎：源根探测（v2 / v3 WIP / macOS-Linux legacy）、同卷
      rename、跨卷 `.easel-migrating` 复制校验、逻辑链接重指、标记与回退；
      单测覆盖 fresh / migrated / 幂等 / 歧义 / 断链（depends: T13）
- [x] T15: supervisor 在 spawn 前 `apply_pending_data_root()` 并写结果文件；
      启动 `migrate()` 改为默认根；子进程 env 增加数据根三项（depends: T14）
- [x] T16: 宿主 API：`GET/POST /easel/api/data-root`、`POST
      /easel/api/data-root/pick`（Windows PowerShell / macOS osascript / Linux
      zenity）、pending 写入与退出、错误回读；`node --test`（depends: T15）
- [x] T17: 设置页 `settings.section`（id `data-root`）：当前/默认根、云同步
      提示、路径输入、`选择文件夹…`、`迁移并重启`；zh/en locale；客户端构建
      （depends: T16）
- [x] T18: Windows 卸载钩子改到指针 `dataRoot` + 遗留路径；macOS/Linux 卸载
      说明（depends: T14）
- [x] T19: 文档更新（layout/upgrade/README）与迁移/回退说明（depends: T13–T18）
- [x] T20: 单测 + 假安装 e2e：cargo 36/36、插件 node --test 100/100；假安装目录
      验证 v2→Documents 默认迁移、指针/链接/标记、pending 迁移到另一目录、
      迁回旧根链接、指针目标不可用时不覆盖并报错（depends: T13–T19）
- [ ] T21: 实机升级：alpha.24 → 新构建，Documents 默认迁移；项目/会话/媒体；
      设置页迁移到另一目录并验证回滚；卸载默认保留数据（depends: T20）

## [S4] Acceptance

- [x] 新装（Windows 假安装 e2e）：程序只在安装目录；数据在假 Documents 下的
      `Easel-dsh`；指针与 `.easel-data.json` 存在；旧逻辑链接指向新根；安装
      目录下没有 `data`。macOS/Linux 只有单测，干净 VM 未跑。
- [ ] 现有机器（Windows 实机）：`%LOCALAPPDATA%\Easel-dsh` 下不再有 `data`；
      数据在 `Documents\Easel-dsh`；`%LOCALAPPDATA%\Easel`、`~/.easel` junction
      指向新根；旧 session、项目文件和媒体播放正常。假安装 e2e 已覆盖迁移与
      链接，实机待 T21。
- [ ] 设置页：显示 current/default；`选择文件夹…` 能返回路径；迁移到另一目录
      后旧根留链接（或旧逻辑链接继续有效），项目仍能打开、旧 session 仍归原
      工作区；指针更新；失败时指针不动并显示 `lastError`。宿主 API 单测与
      pending e2e 已过，UI 视觉/真实 picker 待实机。
- [x] 云同步提示：`GET /easel/api/data-root` 对 OneDrive 路径返回
      `cloudSynced: true`（`data-root.test.js`）；设置页据此显示警告。
- [x] 指针目标不可用 + 有待迁移请求：指针保持不变、pending 保留、
      `lastError` 报 unavailable、目标目录不被创建（`easel-pending-offline`
      假安装 e2e：pointerUnchanged/pendingKept/errorReported/newRootEmpty 全 True）。
- [ ] 卸载默认保留 `dataRoot`；选择删除时只删逻辑链接与数据根，不对 junction
      递归删除。钩子已改，未跑安装器。
- [x] 现有机器迁移（v2）：`%LOCALAPPDATA%\Easel`、`~/.easel` 变成 junction；数据只
      存一份；旧绝对路径（项目脚本里 192 个文件）仍能打开；旧 session 仍归原
      工作区；新 session 的 cwd 仍匹配原工作区记录。
- [x] 迁移后侧栏：工作区行能展开出既有 session；在工作区内新建会话成功；
      右侧「工作区文件」能列出项目文件，视频/音频可页内播放（不再报「页内
      播放不可用」）。
- [x] 升级运行中应用：只替换 `app`；首次启动把数据迁到新根后内容校验和不变；
      无孤儿进程；不需要手动卸载。
- [x] `cargo test` 36/36、插件 `node --test` 100/100、`node build.mjs` 通过；
      假安装 e2e 覆盖 v2→Documents、指针/链接/标记、pending 迁移、迁回旧根、
      指针不可用保留。`tauri build` 与实机安装未跑（T21）。
- [x] 最长路径检查通过（或文档记录 `LongPathsEnabled` 要求）。

## Report

**What was built (v4, 2026-10-21)** — 数据根默认操作系统「文档」目录下的
`Easel-dsh`（`dirs::document_dir()`，尊重 Windows 本地化/OneDrive 重定向），
bootstrap 指针 `data-root.json` 存在 `dirs::data_local_dir()/ai.easel.desktop/`。
设置页新增「数据位置」section：当前/默认根、云同步警告、路径输入、原生目录
选择器（宿主 Node 半调 PowerShell/osascript/zenity）、迁移并重启。迁移由
Rust 执行：v2 的 `<install>/data`、v3 WIP 的 `%USERPROFILE%/Easel-dsh`、
macOS/Linux legacy 的 `~/AppData/Local/Easel` + `~/.easel` 汇聚到 data root；
旧逻辑路径保留 junction/symlink，不重写项目文件或会话。设置页写
`data-root.pending.json` 后让 dsh 退出，supervisor 在 spawn 前
`apply_pending_data_root()`；同卷 rename、跨卷 `.easel-migrating` 复制校验，
失败保留旧指针。卸载钩子读指针删除真实数据根，先删链接再删目录。

**Verification (v4)** — `cargo test` 36/36（默认根/指针/pending/目标校验/整根
迁移/split 迁移/迁回/中断目标/链接幂等/断链）；插件 `node --test` 100/100
（新增 `data-root.test.js` 8 项）；`node build.mjs` 产出 `client.js` 560.5kb；
假安装 e2e 五段全过：v2 → Documents、pending 迁移到自定义根、迁回旧根链接、
指针目标不可用时保留指针并写 `lastError`、pending + 指针不可用时指针/pending
都不动。实机安装/卸载未跑（T21）。

**Review** — 独立复审两轮：第一轮 FIX-FIRST（指针覆盖、迁回、中断目标、单实例
竞态、空间检查、卸载器任意删除、mac/Linux 断链等 8 项 critical），修复后第二轮
SHIP；剩余非阻断项（`lastError` 不自动清理、client.js 的 esbuild 路径注释、
假安装 e2e 脚本未入库）已记录。

**What was built (v2)** — 迁移后的 junction 身份修复，不重写任何历史路径：

- dsh `WorkspaceRegistry` 在启动时把每条工作区记录的 path 过 `realpath` 得到规范
  身份；成员过滤、attach、status、mutate 剪枝、bootstrap 分组、`resolveByPath`
  全部改用规范路径，磁盘上的旧拼写保持不动。旧安装下次启动自愈。workspace feed
  的增量 upsert 同步使用 registry 的规范 path，避免第一次变更后客户端翻回旧拼写。
- easel 宿主 `resolveSettings` 同样规范化 `projectRoot`；`/easel/status`、客户端
  媒体 URL 构造与宿主 `workspace-media` 路由从此使用同一规范路径。
- dsh client `resources.protocolOf` 接受 WebView2 的 opaque-path 读法：桌面壳的
  `dsh-resource://file/...` 在 WebView2 132 下 `hostname` 为空、host 落在
  `pathname` 首段；补齐后桌面窗口的文档/媒体预览与网页版一致。

**Verification** — `vitest run packages/workspace/workspace/tests/workspace.spec.ts`
74/74；`vitest run packages/api/workspace-controller/tests/workspace-controller.host.spec.ts`
14/14（含 junction seeded follow 回归）；`vitest run
packages/api/session-controller/tests/commands-create-fork.host.spec.ts`
14/14；`vitest run packages/client/resources/tests/resources.client.spec.ts`
25/25（含 WebView2 opaque-path 回归）；`node --test`（dsh-plugin-easel）80/80。
实机：把修复后的宿主半部署到安装副本并重启 dsh 子进程后，`/easel/api/status` 返回
`C:\Users\chenfei\AppData\Local\Easel-dsh\data\workspace`；侧栏打开
`e01-一条短信.mp4` 进入 `data-easel-media-state="playing"`，`readyState=4`、
`1080×1920`、`35.264s`、无解码错误；同会话的 `制作方案.md` 仍正常文本预览。
桌面壳（WebView2）单独复现：修复前 `选题.md`/`发布文案.md` 均报
「文件资源服务不可用」，把 `resources` 客户端 bundle 换入安装副本并重载后，预览
恢复文本内容、该文案消失；桌面壳以正常方式重启（无调试端口）后仍正常。工作区归组/新建会话的 dsh 半修复
（`6bdfe0f9b4`/`b96b76b055`）已由 alpha.23 构建带入安装副本。

**Final verification (2026-10-21)** — alpha.23 全量重建后，安装副本的
`runtime/dsh` 含 `canonicalWorkspacePaths`，`runtime/easel/VERSION=0.2.13`，
host `index.js` 含 `realpathSync.native`；首启 `.bundle-version=0.2.13`，
`/easel/status` 返回 `data\workspace`，116 技能。卸载器**非提权**直接运行：
数据询问默认「否」，选否后 app 文件/注册表/快捷方式删除，`data`、两个
junction、`_ideas.json` 哈希保留（只剩空 `app\runtime`）。官方 alpha.23
提权安装因后台 UAC 未批准，用同载荷手动换入；安装包已生成。干净 VM 新装
未跑。

**Design iteration (2026-10-21)** — v3 曾把 Windows 数据根改到
`%USERPROFILE%\Easel-dsh` 并在工作树实现；未发布。用户随后改为「所有平台默认
Documents/Easel-dsh + 设置页可选择路径并迁移」；v3 的代码已按 T13/T14 重写为
data-root 版本，`%USERPROFILE%\Easel-dsh` 只保留为一次性迁移源。v2 的 junction
身份修复（T9/T10）继续有效。

**Decisions auto-resolved (compose-next)** — 默认放 OS Documents（尊重
OneDrive 重定向），但设置页对云同步目录给出警告；迁移是 move，不重写项目/会话，
旧路径留 junction/symlink；原生文件夹选择器放在宿主 Node 半（不对 dsh UI 开放
Tauri IPC）；设置页迁移通过 pending 文件 + supervisor 重启执行，失败回退旧指针。

**Journey log**

- 初始设计断言「保留 junction 两个问题都不出现」是错的：registry 把 session
  cwd 规范化，却不规范化记录 path，迁移后所有旧 session 掉进「未分组」，新会话
  attach 报 `session/workspace-attach-failed`。
- 侧栏媒体报「页内播放不可用」不是媒体组件本身的问题：`workspaceFiles.stat`
  返回真实路径，而 `projectRoot` 还是 junction，客户端前缀比较直接判为根外。
- 修复选择「运行时规范化身份」而不是迁移 registry 记录：不碰用户历史路径，也
  不需要一次性数据迁移。
- 桌面壳独有的「文件资源服务不可用」最后定位到 URL 解析器差异：WebView2 132 把
  `dsh-resource://file/...` 的 host 放进 opaque path（`hostname=""`），当前
  Chromium 则返回 `hostname="file"`；同一页面在 in-app 浏览器正常、桌面窗口必现。
  不要假设自定义 scheme 的 `URL.hostname` 在所有 Chromium 版本一致。
- 安装器与卸载器的权限要求不同：安装器必须提权，卸载器可直接非提权运行。
  alpha.23 提权安装在后台 UAC 未获批准，改用同载荷手动换入 `app\`；安装包
  保留，用户在场时可正常提权安装。
