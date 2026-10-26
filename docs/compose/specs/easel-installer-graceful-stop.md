---
feature: easel-installer-graceful-stop
status: delivered
updated: 2026-10-26
branch: feat/easel-installer-graceful-stop（base master e4a2c7e804）
commits: e4a2c7e804..（finalize 后回填）
---

> **数据事故记录（2026-10-25 23:44）**：验证 harness 曾误删真实数据根；用户 2026-10-26 指示暂缓事故处置、继续本特性（已重启 Easel 并新建空数据根）。事故详情与恢复信息保留在 Report 的 INCIDENT 段，不阻塞本特性的代码交付。

# 安装/卸载时优雅停壳（消除死托盘图标）

## Report

**What was built** — 安装/卸载停壳从「直接强杀」改为「先优雅退出，再兜底强杀」：

- release 壳的单实例回调识别 `--quit`，调用 `app.exit(0)`（与托盘「退出」同一路径：`dsh.stop()` + Tauri 释放托盘图标）；若 `--quit` 因竞态成为主实例，`setup` 首行直接 `exit(0)`，不建窗口/托盘/dsh 子进程。
- `EASEL_STOP_RUNTIME` 对每个存在且正在运行的候选壳路径执行 `<shell> --quit`，每 250ms 轮询（最多 16 次），之后保留原有 `Stop-Process -Force` 兜底。
- 存量死图标不自动清理（Windows 无 API）；用户鼠标扫过隐藏图标弹层即可一次性清掉。新壳成为驻留实例后不再新增；首次从旧版升级时旧壳不认 flag，仍会被兜底强杀一次（随后新壳复用同路径条目）。

**Verification**

- `cargo test --lib`：49 passed，含新增 `quit_flag_from_the_installer_is_recognized`。
- `cargo check --release`：通过（真正编译 release-only 的 `--quit` 分支）。
- `makensis` 用最小 NSIS 脚本插入新宏编译通过（转义与宏展开合法）。
- 安全沙箱重跑钩子（只提取 `EASEL_STOP_RUNTIME` 宏，不含 POSTUNINSTALL 删除段；`LOCALAPPDATA`/`USERPROFILE` 指向临时目录；执行前断言脚本不含 `Remove-Item`/`GetFolderPath`/`dataRoot`/`$links`）：
  - 优雅路径：假壳收到 `args=--quit` 后杀掉同路径首进程，轮询提前结束，3.35s，剩余 0；
  - 顽固路径：轮询超时后兜底强杀，10.0s，剩余 0；
  - 真实已装 Easel 进程全程存活，未被误杀；真实数据根未被该脚本触碰。
- 原 harness（提取了全部 `FileWrite` 行）把 POSTUNINSTALL 删除段一起执行，造成 2026-10-25 数据事故；该 harness 已删除，结果作废（见 INCIDENT）。
- 未做真机安装 E2E；安装器首次带新钩子的升级才是运行时实测点，失败时兜底强杀保持现状。

**INCIDENT — 2026-10-25 23:44（用户 2026-10-26 指示暂缓处置）**

- 被删目录：`C:\Users\chenfei\Documents\Easel-dsh`（workspace + home：项目/素材/outputs、会话、profile、凭据、插件数据）。
- 原因：验证脚本把 `installer-hooks.nsh` 中**所有** `FileWrite $0 '...'` 行解出并执行。`$env:LOCALAPPDATA` 指向临时目录，但 `[Environment]::GetFolderPath("MyDocuments")` 仍是真实 Documents；`data-root.json` 把 `$dataRoot` 指向真实数据根；`Test-EaselRoot` 通过后执行 `Remove-Item -Recurse -Force`。
- 已做：删除未安全 harness；把仍存的 `.dsh`（76.4MB，session 到 2026-10-15）与 WebView 配置/缓存（318MB）复制到 `\\chenfei-nas\Backup\chenfei_s_Legion_backup\Easel-recovery-2026-10-25`；桌面留 `Easel-数据丢失-请先阅读.txt`；检查 VSS/File History/OneDrive/回收站/NAS Document_Backup 均无副本（NAS 文档备份最后运行 2026-10-16，早于数据根创建）。
- 恢复：需用户在场，用管理员权限的恢复工具扫描 C:，输出到外接盘（详见桌面说明）。恢复完成前不要启动 Easel、不要装新版本、不要跑文档备份。
- 2026-10-26 07:02 用户重启 Easel，数据根被新建为空目录（17.9MB 新数据）；用户指示暂缓事故处置、继续本特性。
- 代码本身未被评审发现缺陷（reviewer 对 diff 判 SHIP）；是否合并/安装由用户决定（本分支未自动合并/安装）。`--quit` 的真实安装器 E2E 留到用户下次安装。

**Journey log**

- 先按任务栏按钮排查：UIA 把 MangoDisk 桌面带误报成第二个 Easel 按钮，截图裁切证伪；真正的证据在托盘缓存 `IconStreams`（ROT13 混淆）里的两条 Easel 路径与隐藏图标弹层的两个同款图标。
- 应用内 updater 不需要改：`tauri-plugin-updater` 的默认 `on_before_exit` 调 `cleanup_before_exit()`，先清托盘引用再 `std::process::exit(0)`。
- 钩子脚本的轮询用 `Get-CimInstance`，本机每次查询较慢；安全重跑（只取 `EASEL_STOP_RUNTIME` 宏、执行前断言不含删除逻辑、`LOCALAPPDATA`/`USERPROFILE` 指向临时目录）得到优雅路径 3.35s、顽固路径 10.0s，真实已装进程未受影响。
- **事故教训**：验证脚本不得从生产 NSIS 宏里全量提取再执行；必须只取目标宏，并把 `USERPROFILE`、Documents 已知文件夹、`LOCALAPPDATA` 一起重定向到沙箱。`Remove-Item -Recurse -Force` 不进回收站，事后没有系统级副本可退。用户 2026-10-26 选择暂缓事故处置、继续本特性。

## [S1] Problem

任务栏通知区域长期堆着七八个 Easel 图标；鼠标扫过（或打开隐藏图标弹层）后只剩一个，点任意一个都只唤起同一个窗口。

根因：壳是托盘驻留的，安装器/卸载器的 `EASEL_STOP_RUNTIME` 用 `Stop-Process -Force` 直接杀壳。强杀不走 Tauri 的退出清理，Windows 把壳的托盘图标留成 ghost 条目，直到鼠标扫过或重启 Explorer 才回收。托盘缓存按**可执行文件路径**记条目，所以每个用过的构建路径各留一个。本机实测：

- `IconStreams` 里两条 Easel 记录：`...\Easel-dsh\app\dsh-desktop.exe`（pre-alpha.32 布局，文件已不存在）与 `...\Easel-dsh\dsh-desktop.exe`（当前平铺布局）；
- 隐藏图标弹层里同时显示两个一模一样的 Easel 图标。

单实例保护（`easel-shell-single-instance`）只防「重复启动叠加实例」，其 spec 已把死图标治理留给升级钩子的优雅退出；本特性补上这一段。

## [S2] Design

**停止通道复用单实例插件。** release 壳的 `tauri-plugin-single-instance` 回调收到参数含 `--quit` 时调用 `app.exit(0)`；其余启动仍走 `tray::show_main_window`。`app.exit(0)` 与托盘菜单「退出」同一条路径：`RunEvent::Exit` 里 `dsh.stop()`，Tauri 释放托盘图标（`TrayIcon` 最后一个引用 drop 即 `NIM_DELETE`）。二次进程在插件 setup 就退出，不建窗口、不建托盘、不 spawn dsh，只负责把 flag 转发给驻留实例。

**安装器/卸载器先礼后兵。** `EASEL_STOP_RUNTIME` 对每个候选壳路径（平铺 + 旧 `app\` 子布局）：若文件存在且正有进程运行，执行 `<shell> --quit`，每 250ms 轮询进程消失（16 次，约 4 秒睡眠预算；每次 WMI 查询另计，实际 5-10 秒）；随后保留原 `Stop-Process -Force` 兜底（旧版本壳不认 flag，或壳挂死）。钩子仍在 Tauri 的 `CheckIfAppIsRunning` 之前，运行时清扫顺序不变。首次从旧版本升级：旧壳不认 flag、会先显示窗口，等轮询超时后仍被强杀（这一次可能留下该路径的托盘条目；新壳启动后复用同路径条目，不再新增）；新壳成为驻留实例后的升级通常无感。

**存量死图标不做自动清理。** Windows 不提供删除其他进程托盘图标的 API；已有条目只能由用户鼠标扫过弹层（或重启 Explorer）一次性清掉。本特性保证不再新增。

应用内 updater 不在改动范围：`tauri-plugin-updater` 的默认 `on_before_exit` 已调用 `cleanup_before_exit()`，它会清空托盘引用后再 `std::process::exit(0)`，不产生 ghost。

## [S3] Scope

- In scope: release 壳的 `--quit` 分派与单测；安装/卸载钩子先优雅停壳、再兜底强杀。
- Out of scope: 存量 ghost 的自动清理（无 API）；应用内 updater（已由插件清理）；AUMID/任务栏分组；dev 构建被强杀留下的条目（开发副作用，鼠标扫过即清）。

## Tasks

- [x] T1: `lib.rs` 增加 `--quit` 分派与 flag 单测（depends: none）
- [x] T2: `installer-hooks.nsh` 增加优雅停壳轮询与强杀兜底（depends: T1）
- [x] T3: `cargo test` + `cargo check --release`（depends: T1,T2）
- [x] T4: 独立 subagent 评审（diff 判 SHIP；critical 项是 harness 事故，不是代码缺陷）（depends: T3）
- [x] T5: 数据事故处置：用户 2026-10-26 指示暂缓、继续本特性；事故记录与幸存副本保留（depends: T4）

## [S4] Acceptance

- [x] release 壳对 `--quit` 调 `app.exit(0)` 而非强杀；`quit_flag_from_the_installer_is_recognized` 通过（回调接线由 release 编译 + 源码核对）
- [x] 安装/卸载钩子在强杀前对运行中的壳执行 `--quit` 并轮询，超时才兜底强杀（NSIS 编译 + 安全沙箱优雅/兜底两条路径 + 真实进程未被误杀；真机安装 E2E 待用户下次安装）
- [x] `cargo test` 与 `cargo check --release` 全绿
- [x] 评审三项（spec 合规、正确性、代码库一致性）无 critical（reviewer 对 diff 判 SHIP）

真机安装 E2E 未在本机执行（会替换用户当前安装）；下次安装即实测点。
