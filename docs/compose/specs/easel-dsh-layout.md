---
feature: easel-dsh-layout
status: delivered
updated: 2026-10-21
branch: feat/easel-upgrade-layout（dsh 工作区）+ main（feat/easel-sidebar-files 已合并 b3e2ceb）
commits: 50d0920420..f5fab30f46（含 workspace link、feed 规范化、WebView2 resource host 修复）；Easel f9bebc6
---

# Easel-dsh 目录分层：程序在 app，数据在 data

## [S1] Problem

当前程序、内容和 dsh home 分散在三处：

- 程序：`%LOCALAPPDATA%\Easel-dsh`（exe、`runtime\`、`uninstall.exe`）
- 内容/产物：`%LOCALAPPDATA%\Easel`（skills、插件源、`projects\`、`outputs\`、
  `.env`）
- 配置/会话：`~/.easel`（profiles、sessions、storages、credentials、logs）

升级只能覆盖安装根目录，数据在根目录外；卸载器问「是否删除 Easel 内容目录」
时删的是 `%LOCALAPPDATA%\Easel`，与 `~/.easel` 又不一致。备份、换机、排障都
要记三个路径，容易漏。

目标布局：

```
%LOCALAPPDATA%\Easel-dsh\
  app\                  # 程序：exe、runtime、uninstall.exe；升级只换这里
  data\                 # 用户数据：唯一需要备份的目录
    workspace\          # 内容：skills、插件源、projects、outputs、.env
    home\               # dsh home：profiles、sessions、storages、credentials、logs
```

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
- `$INSTDIR` 只含 app；`data` 是兄弟目录，不在卸载器的文件清单里。升级、
  卸载默认都不碰 `data`。
- 旧布局迁移时，旧安装根本身就是 `%LOCALAPPDATA%\Easel-dsh`，新安装根是它的
  子目录 `app`。**旧 `uninstall.exe` 必须清理**：旧卸载器的 POSTUNINSTALL
  钩子会 `RMDir /r "$LOCALAPPDATA\Easel"`；迁移后该路径是 junction，递归删除
  可能顺着 junction 删掉 `data\workspace`。
- 自定义模板要跟随 Tauri 升级同步；模板头部记录 fork 的 Tauri 版本，升级
  Tauri 时 diff 一次。

### 路径解析

- `install_root = %LOCALAPPDATA%\Easel-dsh`
- `app_dir = install_root\app`
- `data_dir = install_root\data`
- `dsh_home = data_dir\home`（`DSH_HOME` 可覆盖，dev 用）
- `easel_home` 分两种情况：
  - **新装机器**：`data_dir\workspace`（逻辑路径与物理路径一致）；
  - **从旧布局迁移的机器**：仍返回旧路径 `%LOCALAPPDATA%\Easel`（它是指向
    `data\workspace` 的 junction）。物理数据在 `data`，但逻辑工作区路径保持
    不变，以保住已有工作区和会话归组（见下）。
- `spawn_child` 显式给 dsh 子进程传 `DSH_HOME` 和 `EASEL_HOME`；壳自己的
  `setup::dsh_home()` 返回同一路径。
- `ensure_easel_bundle` 写 patch 的 `projectRoot` 随之确定；迁移机器保持旧
  `projectRoot`，新装机器写入 `data\workspace`。

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

新装机器没有历史包袱，直接用 `data\workspace`。让迁移机器在界面上显示新逻辑
路径仍然需要重写工作区记录，风险更大，本 spec 不做。

### 一次性迁移（幂等）

在壳启动、spawn dsh 之前执行 `migrate_layout()`：

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
   `dsh-desktop.exe`、`uninstall.exe`（不碰 `app`/`data`）。旧
   `uninstall.exe` 必须先删，理由见上。
5. 全部成功后写 `data\.layout-v2` 标记；之后启动跳过。任一步失败：保留旧路径
   可用，记录日志，下次重试；不写标记。

迁移期间旧 server 必须已停（安装器 PREINSTALL 钩子负责）。

### 卸载

- 默认（更新或普通卸载）：只删 `app`；`data` 与两个 junction 保留。
- 可选删数据：先用 `cmd /c rmdir`（不带 `/s`）移除
  `%LOCALAPPDATA%\Easel` 和 `~/.easel` 两个 junction，再 `RMDir /r data`；
  绝不能对 junction 用 `RMDir /r`。
- 数据询问文案改为「是否同时删除 Easel 数据目录（工作区、会话、账号画像）？」，
  默认否；`$UpdateMode <> 1` 才询问。

### 路径长度

实测（本机，`LongPathsEnabled=1`）：

- runtime 最长相对路径 143，`app\runtime` 后约 192；
- 内容目录最长绝对路径 187 → 新根约 206；
- `~/.easel` 最长 278 → `data\home` 约 313（已超过 260，本机依赖长路径开关）。

迁移/安装验收要跑一次最长路径检查；若目标机器未启用 `LongPathsEnabled`，保留
旧 home 或提示用户。

## [S3] Scope

- In scope:
  - 自定义 NSIS 模板与 `app` 安装路径；
  - Rust 路径常量、`DSH_HOME`/`EASEL_HOME` 传递、node_modules junction 修复；
  - 一次性迁移 + junction + 标记 + 回退；
  - 安装/卸载钩子的路径、旧根清理、数据询问；
  - 文档、迁移验证。
- Out of scope:
  - Tauri updater / 自动更新；
  - 内容增量更新；
  - 重写历史绝对路径（用 junction 兼容，不批量改用户文件）；
  - 迁移工作区 registry 记录（保留旧逻辑路径）；
  - macOS/Linux 同等布局（先 Windows，路径规则抽成平台常量）。

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

## [S4] Acceptance

- [ ] 新装机器：`app\` 有 exe/runtime/uninstall.exe；`data\workspace` 有
      skills/插件/项目；`data\home` 有 profiles/sessions；不存在
      `%LOCALAPPDATA%\Easel` 实体目录。**干净 VM 未跑**；当前机器的
      fresh/迁移路径已覆盖。
- [x] 现有机器迁移：`%LOCALAPPDATA%\Easel`、`~/.easel` 变成 junction；数据只
      存一份；旧绝对路径（项目脚本里 192 个文件）仍能打开；旧 session 仍归原
      工作区；新 session 的 cwd 仍匹配原工作区记录。
- [x] 迁移后侧栏：工作区行能展开出既有 session；在工作区内新建会话成功；
      右侧「工作区文件」能列出项目文件，视频/音频可页内播放（不再报「页内
      播放不可用」）。
- [x] 升级运行中应用：只替换 `app`；`data` 内容校验和不变；无孤儿进程；不需要
      手动卸载。
- [x] 卸载默认：`app` 删除，`data` 与 junction 完整保留；选择删数据：junction
      先移除，`data` 删除，`app` 也删除。实测选否：app 文件/注册表/快捷方式
      删除，data/junction/哈希保留（只剩空 `app\runtime`）。
- [x] `node --test`、`cargo test`、`tauri build` exit 0；生成的
      `installer.nsi` 中 `$INSTDIR` 为 `...\app`，旧根清理和 junction 删除逻辑
      存在。
- [x] 最长路径检查通过（或文档记录 `LongPathsEnabled` 要求）。

## Report

**What was built** — 迁移后的 junction 身份修复，不重写任何历史路径：

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
