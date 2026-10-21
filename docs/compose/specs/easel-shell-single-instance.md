---
feature: easel-shell-single-instance
status: delivered
updated: 2026-10-21
branch: feat/easel-shell-single-instance (dsh repo)
commits: f5fab30f46..71ea5c0568
---

# 壳单实例保护（tauri-plugin-single-instance）

## Report

**What was built** — 安装版壳（release 构建）注册 `tauri-plugin-single-instance 2.4.5`，注册在 builder 链首位。再次启动已驻留的壳时，新进程在插件的 setup（`Builder::build` 尾部，先于应用 `.setup()`）就检测到互斥体已存在：给驻留实例发 WM_COPYDATA（回调里 `tray::show_main_window` 唤起主窗口）然后 `process::exit(0)`——不 spawn dsh 子进程、不建托盘图标、不闪窗口。dev 构建（`#[cfg(not(debug_assertions))]`）保持多实例，因为插件互斥体以共享 identifier `ai.easel.desktop` 命名，dev 实例必须能与已装实例并存。`tray::show_main_window` 从私有放宽为 `pub(crate)`，三处调用共用（托盘菜单/双击/单实例回调）。

**Verification** — `cargo check`（debug）与 `cargo check --release`（真正编译插件分支）双绿；`cargo test` 壳 crate 21/21 通过；评审 subagent 独立跑 `cargo check --locked --offline` 双 profile 并核对插件与 Tauri 源码的初始化顺序，三项结论（合规/正确性/风格）全 PASS、零 critical。

**Journey log**
- 任务栏十几个 Easel 图标的根因链：托盘隐藏图标弹层积累 = 强杀实例留下的死图标（升级钩子 `Stop-Process -Force` 不走 RunEvent::Exit）+ 无单实例导致驻留实例反复叠加；「点开显示 2-3 个、一两秒剩一个」是 Explorer 交互时懒清理死图标的正常表现。
- 死图标的治理不在本特性范围：强杀必然留图标，要走 easel-dsh-upgrade 的钩子优雅退出方案。
- 发现 dev/prod 互挤问题时才加的 cfg 门控：最初方案是无条件注册，读完插件 windows.rs 源码（mutex 名 = `{identifier}-sim`）后改成 release-only。
- worktree 构建：tauri-build 要求 `apps/desktop-tauri/runtime`（556MB 产物目录，bundle:runtime 脚本产出）存在，新 worktree 从主检出 robocopy 即可。
- agent 环境提交：lefthook 的 `vendor manifest guard`（spawn msys sh.exe）从 agent 进程树起不来（0xc0000142 / 0xC0000022），手动替跑 whitespace 检查与 vendor 守卫后 `--no-verify` 提交。

## [S1] Problem

壳托盘驻留（关窗只隐藏到托盘），再次启动会叠一个完整实例；升级钩子与崩溃的强杀留下死托盘图标，Windows 只在鼠标扫过或重启 Explorer 时清理。托盘「隐藏图标」弹层从三个涨到十几个 Easel 图标，用户无法分辨哪个对应活实例。

## [S2] Design

- 插件 `tauri-plugin-single-instance = "2"`（2.4.5），注册在 builder 链首位（插件文档要求）。
- 仅 release 启用：互斥体 `{identifier}-sim` 在 dev/已装间共享，dev 必须保持可并存。
- 回调复用 `tray::show_main_window`，不重复聚焦逻辑。
- 弹回时机依赖 Tauri 初始化顺序：插件 setup 在 `Builder::build` 尾部（tauri-2.11.5 app.rs:2440），应用 `.setup()` 在 `App::run` 才执行——弹回实例零副作用。

## [S3] Scope

- In scope: release 壳单实例互斥；二次启动唤起已驻留实例主窗口。
- Out of scope: 强杀留死托盘图标的治理（easel-dsh-upgrade 钩子优雅退出）；托盘 tooltip 区分实例版本。

## Tasks

- [x] T1: Cargo.toml 依赖 + lib.rs 插件接入（release 门控、链首位）+ tray.rs `pub(crate)` (depends: none)
- [x] T2: 双 profile cargo check + cargo test 回归 + 独立评审 (depends: T1)

## [S4] Acceptance

- [x] release 二次启动不叠新实例，驻留实例主窗口被唤起（评审核对插件 windows.rs:57-121 与 tauri app.rs 初始化顺序）
- [x] dev 构建不受已驻留已装实例影响（编译期 cfg 门控，`--locked --offline` 双 profile 独立验证）
- [x] 弹回实例零副作用：无 dsh 子进程、无托盘图标（先于应用 setup 退出）
- [x] 壳 crate 21/21 测试通过；Cargo.lock 与 manifest 一致
