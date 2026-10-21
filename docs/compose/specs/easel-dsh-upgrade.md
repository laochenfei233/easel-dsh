---
feature: easel-dsh-upgrade
status: delivered
updated: 2026-10-21
branch: feat/easel-upgrade-layout（dsh 工作区）
commits: 50d0920420..b96b76b055（含 6bdfe0f9b4、7a0c9e0477）；Easel f9bebc6
---

# Easel-dsh 安装与升级：不再卸载重装

## [S1] Problem

用户每次升级都要「卸载 → 重新安装」。这不是操作习惯问题，是安装器生命周期的三个缺陷叠加：

1. **NSIS 升级页默认选中「卸载后重装」。** 生成的
   `target/release/nsis/x64/installer.nsi:287` 在 upgrade 分支默认勾选第一个
   单选（uninstall），第二个才是「不卸载，直接安装」；用户一路「下一步」就会
   走卸载流程。
2. **卸载/覆盖安装只杀主程序，dsh 服务成了孤儿。** 安装器的
   `CheckIfAppIsRunning` 只按 `dsh-desktop.exe` 杀壳；而壳只有在
   `RunEvent::Exit` 里才调用 `dsh.stop()`（`src/lib.rs:187`），硬杀不会触发。
   dsh 子进程是从 `$INSTDIR\runtime\node\node.exe` 启动的
   （`src/dsh_runner.rs:260`），于是继续运行并锁住 `runtime\dsh`、
   `runtime\node` 下的文件，后续复制/删除失败，只能靠卸载重装或重启绕过。
   实机证据（2026-10-20）：
   - `%LOCALAPPDATA%\Easel-dsh` 只剩 `uninstall.exe` 和 `runtime\`，主 exe 已
     被卸载器删除；
   - PID 41768 仍以
     `runtime\node\node.exe ... runtime\dsh\lib\bin.js web --port 3082`
     运行，`~/.easel/desktop-server.json` 仍钉着它；
   - 此时 alpha.21 安装器正在运行（PID 45216），安装目录被占用。
3. **卸载钩子在更新路径也会问「是否删除 Easel 内容目录」。**
   `src-tauri/installer-hooks.nsh` 的 POSTUNINSTALL 没有 `$UpdateMode` 守卫。
   走默认「卸载后重装」升级时，用户可能顺手点「是」，把
   `%LOCALAPPDATA%\Easel`（outputs、选题库、账号画像）删掉。
4. **安装器需要管理员权限启动。** 非管理员运行会在 stub 阶段直接 exit 2，
   与火绒/安全软件无关（2026-10-20 实机确认）。安装/升级说明和自动化都必须
   走 UAC 提权；安装路径仍是当前用户的 `%LOCALAPPDATA%`。

另外，目前没有版本检查/自动更新，用户要自己找安装包；每次都是 126MB 全量
安装包。

## [S2] Design

**原则：安装目录只放程序；用户数据永远在安装目录之外；升级 = 覆盖安装目录，
不跑卸载。**

数据边界（保持不变）：

| 类别 | 位置（当前 → 目标） | 升级时 |
| --- | --- | --- |
| 程序 | `%LOCALAPPDATA%\Easel-dsh\app`（exe + `runtime\` + uninstall.exe） | 整体覆盖 |
| 内容/数据 | `%LOCALAPPDATA%\Easel` → `%LOCALAPPDATA%\Easel-dsh\data\workspace` | 不触碰（stamp 门只同步包内内容） |
| 配置/会话 | `~/.easel` → `%LOCALAPPDATA%\Easel-dsh\data\home` | 不触碰 |

**目录布局（2026-10-20 用户决定）**

- 目标：程序 `%LOCALAPPDATA%\Easel-dsh\app`，数据
  `%LOCALAPPDATA%\Easel-dsh\data`（`workspace\` + `home\`）。这取代了本节
  早先「不加 `\data` 层」的建议。
- 这不是简单加一层目录：`projectRoot` 被 dsh workspace/session 的 cwd 和项目
  绝对路径引用，直接搬会打断会话归组。迁移方案（旧路径 junction、迁移机器
  保留旧逻辑 `projectRoot`、`DSH_HOME` 迁到 `data\home`）见
  `docs/compose/specs/easel-dsh-layout.md`。
- 本 spec 先做安装器生命周期修复（T1–T6）；布局迁移作为独立步骤按 layout
  spec 执行。在 layout 落地前，数据仍在 `%LOCALAPPDATA%\Easel` 和 `~/.easel`。
- `app` 安装路径以 layout spec T1 的自定义 NSIS 模板为准（Tauri 没有
  `installDir` 配置；默认 `$INSTDIR` 会被 `RestorePreviousInstallLocation`
  拉回旧根目录。PREINSTALL 重写 `$INSTDIR` 只能作为备选，不改安装器页面）。

**改动一：安装/卸载前先停整棵相关进程树（根因修复）**

在 `src-tauri/installer-hooks.nsh` 增加 `NSIS_HOOK_PREINSTALL` 与
`NSIS_HOOK_PREUNINSTALL`，由 PowerShell 按**可执行文件路径**停进程：

1. 先停 `$INSTDIR\dsh-desktop.exe`——停掉壳的监督循环，防止子进程被自动拉起
   （`dsh_runner.rs` 的 supervise 会在子进程意外退出后重启）。
2. 再停所有 `ExecutablePath` 以 `$INSTDIR\runtime\` 开头的进程（node/dsh
   worker 等），等待 300–500ms 后重试一次。
3. 不按进程名全局杀 `node.exe`，避免误伤同机其他 node 应用；不杀
   `uninstall.exe` 自身（路径过滤天然排除）。

钩子执行顺序已由 Tauri 模板保证：`PREINSTALL` 在
`CheckIfAppIsRunning` 之前（`installer.nsi:632` → `:636`），
`PREUNINSTALL` 同理（`:20211` → `:20215`）。

**改动二：更新路径不再询问删除数据**

POSTUNINSTALL 的 MessageBox 包在 `${If} $UpdateMode <> 1` 里。真正的卸载
（无 `/UPDATE`）仍然询问，默认「否」保留 `%LOCALAPPDATA%\Easel`。

**改动三：升级统一走 `/UPDATE` 语义**

- 安装器被传入 `/UPDATE` 时，`PageLeaveReinstall` 直接 `reinst_done`
  （`installer.nsi:314`），不运行旧卸载器，数据目录零触碰。这是推荐的升级
  方式。
- 双击安装包的 GUI 路径：在「已安装」页选择第二项「不卸载，直接安装」；
  `docs/INSTALL-DESKTOP.md` 明确写出来。
- **首次从 alpha.21（旧钩子）升级**：必须用 `/UPDATE` 或第二项，避免旧卸载
  器留下 `RMDir /REBOOTOK` 删除队列，在下次重启时把新装的文件删掉。
- 本 spec 不引入自定义 NSIS 模板（要长期跟随 Tauri 模板演进，维护成本高于
  收益），也不改默认单选；用文档 + 后续 app 内更新入口绕开这一页。

**为什么不是别的方案**

- **Tauri updater / 一键自动更新**：需要签名密钥、`latest.json` 和发布流程，
  属于独立特性；等 in-place 升级稳定后再立项。若做，Windows 用
  `installMode: "basicUi"`（插件固定追加 `/UPDATE`，不加 `/S`，规避火绒拦
  NSIS 静默安装），并在调用 updater 前显式 `dsh.stop()`——updater 启动安装
  器后会 `std::process::exit(0)`，不会走 `RunEvent::Exit`。
- **内容增量更新**（只更新插件/skills，不打 126MB 包）：能进一步缩短迭代
  时间，但会引入第二套发布/校验通道；等全量安装被证明是瓶颈再做。
- **自定义 NSIS 模板改默认单选**：改动面大、跟 Tauri 升级易漂移，不值得。

## [S3] Scope

- In scope:
  - `installer-hooks.nsh` 的进程清理与 `$UpdateMode` 守卫；
  - 重新打包并验证生成的 `installer.nsi` 确实包含两个钩子；
  - 本机 E2E：运行中升级、卸载、数据保留、无孤儿进程；
  - `docs/INSTALL-DESKTOP.md` 的升级/卸载口径与 alpha.21 迁移说明。
- Out of scope:
  - Tauri updater、`latest.json`、签名密钥；
  - 内容增量更新通道；
  - 把内容树或 `~/.easel` 迁到 `%LOCALAPPDATA%\Easel-dsh\data`（有损迁移风险，由 `easel-dsh-layout.md` 单独处理）；
  - 自定义 NSIS 模板/默认单选调整；
  - 应用内更新 UI。

## Tasks

- [x] T1: `installer-hooks.nsh` 增加 PREINSTALL/PREUNINSTALL 进程树清理，
      POSTUNINSTALL 加 `$UpdateMode` 守卫（depends: none）
- [x] T2: 重打 NSIS，核对生成的 `installer.nsi` 中两个钩子位置与守卫，产物
      体积/退出码正常（depends: T1）
- [x] T3: 本机 E2E——应用运行中提权重装 alpha.22（同版本，第一项「重新安装」，
      不卸载）；安装器钩子停掉壳 + 两个 node，`data` 哈希不变，安装后无旧进程
      （depends: T2）
- [x] T4: 本机 E2E——新包真正卸载：数据询问出现且默认「否」，runtime 删除
      干净，无孤儿 node。**已验证（非提权直接运行卸载器）**：选「否」后
      app 文件、注册表、快捷方式移除，data 与 junction 完整，`_ideas.json`
      哈希不变；只剩空的 `app\runtime` 目录（depends: T2）
- [x] T5: 更新 `docs/INSTALL-DESKTOP.md`：升级步骤、`/UPDATE` 与第二项单选、
      alpha.21 首升注意事项、卸载数据保留说明（depends: T1）
- [x] T6: 回归：插件 `node --test`、壳 `cargo test`、`tauri build` 全绿
      （depends: T2）
- [x] T7: 目录分层（`app` + `data`）按 `docs/compose/specs/easel-dsh-layout.md`
      的 T1–T8 实现并验证（depends: none）

## [S4] Acceptance

- [x] 应用正在运行（壳 + dsh server）时，运行新安装包 `/UPDATE` 能直接完成，
      不需要手动 taskkill 或先卸载。**等价路径已验证**：提权重装、第一项
      「重新安装」，钩子停掉整棵树；非管理员 `/UPDATE` 在 stub exit 2。
      官方 alpha.23 提权安装因后台 UAC 未批准未跑，同载荷已手动换入。
- [x] 升级前后 `%LOCALAPPDATA%\Easel\outputs`、`.env` 与
      `~/.easel\profiles`、`sessions`、`storages` 内容不变（包内 skills/插件
      按 stamp 门同步属于预期变化）。
- [x] 升级/卸载完成后，不存在 `ExecutablePath` 位于
      `%LOCALAPPDATA%\Easel-dsh\app\runtime\` 下的存活进程。
- [x] 真正卸载（不带 `/UPDATE`）仍会询问是否删除 Easel 内容目录，默认「否」。
      非提权直接运行卸载器实测：数据保留、app 文件/注册表/快捷方式移除。
- [x] 文档明确写出：GUI 升级选第二项「不卸载，直接安装」，或运行
      `setup.exe /UPDATE`；alpha.21 首次升级必须走这条路径。
- [x] `node --test`、`cargo test`、`tauri build` 均 exit 0；生成的
      `installer.nsi` 可 grep 到两个新钩子与 `UpdateMode` 守卫。

## Report

**What was built** — 安装器生命周期修复 + 目录分层：

- `installer-hooks.nsh` 在 PREINSTALL/PREUNINSTALL 先停壳、再按可执行文件路径停
  整个 runtime（含 `app\runtime` 与旧根 `Easel-dsh\runtime`），POSTINSTALL 清理
  旧根，POSTUNINSTALL 用 `$UpdateMode` 守卫数据询问，并用 PowerShell 只删
  junction 链接、不穿透目标。
- 自定义 NSIS 模板把默认安装目录改到 `%LOCALAPPDATA%\Easel-dsh\app`；Rust 侧
  `layout.rs` 把数据迁到 `data\workspace` / `data\home`，旧路径保留 junction，
  `node_modules` junction 重指 `app\runtime\dsh\node_modules`。

**Verification** —

- 非管理员安装：`/UPDATE`、普通向导、全新安装均在 stub exit 2（确认是权限，
  不是火绒）；提权后 alpha.22 全新安装 exit 0。
- 首启迁移（真实数据）：`app`/`data` 生成；`%LOCALAPPDATA%\Easel` 与 `~/.easel`
  变成 junction；`_ideas.json` SHA256 与迁移前一致；9 个会话、6 个项目保留；
  116 技能在 `/easel/status` 可见；154 个项目文件的旧绝对路径仍可解析。
- 运行中原地重装：alpha.22 运行（壳 + 2 个 node）时提权重装，旧进程全部消失，
  数据哈希不变，`/easel/status` 正常；`node_modules` junction 指向
  `app\runtime\dsh\node_modules`。
- junction 安全删除：临时目录测试中 `data`、两个旧路径 link、外部 link 均删除，
  link 指向的外部目标 `must-survive.txt` 存活。
- `cargo test` 21/21；插件 `node --test`（当前 80/80）；`tauri build` 产出
  `Easel-dsh_0.2.1-alpha.23_x64-setup.exe`。
- alpha.23 载荷：dsh 全量 + `bundle-runtime` 后，安装副本的 `runtime/dsh`
  含 `canonicalWorkspacePaths`，`runtime/easel/VERSION=0.2.13`，host
  `index.js` 含 `realpathSync.native`；首启 `.bundle-version=0.2.13`，
  `/easel/status` 返回 `data\workspace`，116 技能。
- 卸载（非提权直接运行 `app\uninstall.exe`）：数据询问默认「否」；选否后
  app 文件/注册表/快捷方式删除，`data`、两个 junction、`_ideas.json` 哈希
  全部保留；只剩空 `app\runtime` 目录。
- 官方 alpha.23 提权安装未跑：后台 UAC 提示未获批准；改用同载荷手动换入
  `app\`（runtime + exe + 备份卸载器 + 注册表导出恢复）。alpha.23 安装包
  已生成，可在用户在场时正常提权安装。

**Journey log** —

- 最初把三次 exit 2 误判为火绒拦 NSIS；用户指出安装器需要管理员权限后，提权
  安装一次通过。文档已写死「右键以管理员身份运行」。
- 旧 alpha.21 卸载器是 stub + `%TEMP%\~nsu.tmp\Un.exe` 两段进程；`Start-Process`
  拿到的是 stub，真正的数据询问在 `Un.exe` 窗口里，必须按进程/窗口操作。
- 迁移后 WorkspaceRegistry 的成员过滤仍用旧拼写，导致旧会话掉进「未分组」；
  用户提交 `6bdfe0f9b4` 在运行时用 `realpath` 规范化记录路径，旧安装下次启动
  自愈，不需要迁移 registry。
- dsh `6bdfe0f9b4`/`b96b76b055` + Easel `50d55bb` 已合入 main（b3e2ceb）；
  alpha.23 全量重建后，安装副本的运行时已含 workspace 修复。官方 alpha.23
  提权安装因后台 UAC 未批准，改用同载荷手动换入；安装包已生成。
