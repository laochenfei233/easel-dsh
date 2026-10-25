---
feature: easel-installer-graceful-stop
status: in-progress
updated: 2026-10-25
branch: feat/easel-installer-graceful-stop（base master e4a2c7e804）
commits: pending
---

# 安装/卸载时优雅停壳（消除死托盘图标）

## Report

**What was built** — 安装/卸载停壳从「直接强杀」改为「先优雅退出，再兜底强杀」：

- release 壳的单实例回调识别 `--quit`，调用 `app.exit(0)`（与托盘「退出」同一路径：`dsh.stop()` + Tauri 释放托盘图标）。
- `EASEL_STOP_RUNTIME` 对每个存在且正在运行的候选壳路径执行 `<shell> --quit`，每 250ms 轮询（最多 16 次），之后保留原有 `Stop-Process -Force` 兜底。
- 存量死图标不自动清理（Windows 无 API）；用户鼠标扫过隐藏图标弹层即可一次性清掉，产品侧从本版起不再新增。

**Verification**

- `cargo test --lib`：49 passed，含新增 `quit_flag_from_the_installer_is_recognized`。
- `cargo check --release`：通过（真正编译 release-only 的 `--quit` 分支）。
- `makensis` 用最小 NSIS 脚本插入新宏编译通过（转义与宏展开合法）。
- 从宏里解出生成的 `stop-easel.ps1`，用假 `dsh-desktop.exe` 跑两条路径：
  - 忽略 `--quit` 的顽固进程：日志出现 `args=--quit`，轮询超时后两个进程都被强杀，剩余 0；
  - 处理 `--quit` 的进程：第二条进程杀掉首进程并退出，轮询提前结束，剩余 0；真实已装 Easel 进程未被误杀。
- 未做真机安装 E2E（会替换用户当前安装）；安装器首次带新钩子的升级即为实测点，失败时兜底强杀保持现状。

**Journey log**

- 先按任务栏按钮排查：UIA 把 MangoDisk 桌面带误报成第二个 Easel 按钮，截图裁切证伪；真正的证据在托盘缓存 `IconStreams`（ROT13 混淆）里的两条 Easel 路径与隐藏图标弹层的两个同款图标。
- 应用内 updater 不需要改：`tauri-plugin-updater` 的默认 `on_before_exit` 调 `cleanup_before_exit()`，先清托盘引用再 `std::process::exit(0)`。
- 钩子脚本的轮询用 `Get-CimInstance`，本机每次查询较慢，顽固路径总耗时约 14s（原有运行时清扫已占约 9s）；优雅路径只多一次查询，正常升级无感。

## [S1] Problem

任务栏通知区域长期堆着七八个 Easel 图标；鼠标扫过（或打开隐藏图标弹层）后只剩一个，点任意一个都只唤起同一个窗口。

根因：壳是托盘驻留的，安装器/卸载器的 `EASEL_STOP_RUNTIME` 用 `Stop-Process -Force` 直接杀壳。强杀不走 Tauri 的退出清理，Windows 把壳的托盘图标留成 ghost 条目，直到鼠标扫过或重启 Explorer 才回收。托盘缓存按**可执行文件路径**记条目，所以每个用过的构建路径各留一个。本机实测：

- `IconStreams` 里两条 Easel 记录：`...\Easel-dsh\app\dsh-desktop.exe`（pre-alpha.32 布局，文件已不存在）与 `...\Easel-dsh\dsh-desktop.exe`（当前平铺布局）；
- 隐藏图标弹层里同时显示两个一模一样的 Easel 图标。

单实例保护（`easel-shell-single-instance`）只防「重复启动叠加实例」，其 spec 已把死图标治理留给升级钩子的优雅退出；本特性补上这一段。

## [S2] Design

**停止通道复用单实例插件。** release 壳的 `tauri-plugin-single-instance` 回调收到参数含 `--quit` 时调用 `app.exit(0)`；其余启动仍走 `tray::show_main_window`。`app.exit(0)` 与托盘菜单「退出」同一条路径：`RunEvent::Exit` 里 `dsh.stop()`，Tauri 释放托盘图标（`TrayIcon` 最后一个引用 drop 即 `NIM_DELETE`）。二次进程在插件 setup 就退出，不建窗口、不建托盘、不 spawn dsh，只负责把 flag 转发给驻留实例。

**安装器/卸载器先礼后兵。** `EASEL_STOP_RUNTIME` 对每个候选壳路径（平铺 + 旧 `app\` 子布局）：若文件存在且正有进程运行，执行 `<shell> --quit`，每 250ms 轮询进程消失，最多 4 秒；随后保留原 `Stop-Process -Force` 兜底（旧版本壳不认 flag，或壳挂死）。钩子仍在 Tauri 的 `CheckIfAppIsRunning` 之前，运行时清扫顺序不变。首次从旧版本升级最多多等 4 秒；之后通常 1 秒内结束。

**存量死图标不做自动清理。** Windows 不提供删除其他进程托盘图标的 API；已有条目只能由用户鼠标扫过弹层（或重启 Explorer）一次性清掉。本特性保证不再新增。

应用内 updater 不在改动范围：`tauri-plugin-updater` 的默认 `on_before_exit` 已调用 `cleanup_before_exit()`，它会清空托盘引用后再 `std::process::exit(0)`，不产生 ghost。

## [S3] Scope

- In scope: release 壳的 `--quit` 分派与单测；安装/卸载钩子先优雅停壳、再兜底强杀。
- Out of scope: 存量 ghost 的自动清理（无 API）；应用内 updater（已由插件清理）；AUMID/任务栏分组；dev 构建被强杀留下的条目（开发副作用，鼠标扫过即清）。

## Tasks

- [x] T1: `lib.rs` 增加 `--quit` 分派与 flag 单测（depends: none）
- [x] T2: `installer-hooks.nsh` 增加优雅停壳轮询与强杀兜底（depends: T1）
- [x] T3: `cargo test` + `cargo check --release`（depends: T1,T2）
- [ ] T4: 独立 subagent 评审（depends: T3）

## [S4] Acceptance

- [ ] release 壳对 `--quit` 调 `app.exit(0)` 而非强杀；`quit_flag_from_the_installer_is_recognized` 通过
- [ ] 安装/卸载钩子在强杀前对运行中的壳执行 `--quit` 并轮询，超时才兜底强杀
- [ ] `cargo test` 与 `cargo check --release` 全绿
- [ ] 评审三项（spec 合规、正确性、代码库一致性）无 critical
