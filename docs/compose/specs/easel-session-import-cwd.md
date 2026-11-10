---
feature: easel-session-import-cwd
status: in-progress
updated: 2026-11-10
branch: fix/easel-session-import-cwd（worktree）
commits: # filled at delivery
---

# 隔空传送：跨平台会话导入拒绝 Windows cwd

## Report

## [S1] Problem

Windows → macOS 发送项目时，项目文件传输与校验成功，但会话导入失败，接收端回 `failed`：

```
the receiving device could not complete the handoff (project files were received verified at "…/projects/衣服淘宝展示",
but importing its sessions failed (header line carries a non-absolute cwd (archive entry: root session log)); retry the import instead of re-transferring)
```

根因：导入端用本地 `node:path.isAbsolute` 校验会话头里记录的 `cwd`。macOS/Linux 的 POSIX 规则不认 `C:\…`，于是**所有 Windows 导出的会话在 macOS/Linux 上都无法导入**。该 `cwd` 只用于报告信息，导入时会被替换成接收设备的目标目录，不应当按本机平台校验。

## [S2] Design

`parse-log.ts` 增加 `isCrossPlatformAbsolute`：本地 `isAbsolute` 为真，或匹配 Windows 绝对路径形态（盘符 `X:\` / `X:/`，UNC `\\server\share`、`//server/share`，含 `\\?\` 设备路径）。会话头的 `cwd` 校验改用它；`importArchive` 的 `targetCwd` 仍用本地 `isAbsolute`（目标目录必须在**本机**是绝对路径）。

失败行为不变：真正的相对路径仍被拒绝（`header line carries a non-absolute cwd`）。

## [S3] Scope

- In scope: `packages/session-query/session-log-import` 的解析校验与其单测。
- Out of scope: 发送端导出内容、传输协议、界面文案。

## Tasks

- [x] T1: `isCrossPlatformAbsolute` + 会话头 cwd 校验改用它（depends: none）
- [x] T2: 单测覆盖盘符、UNC、POSIX 三种绝对路径（depends: T1）

## [S4] Acceptance

- [x] Windows 盘符路径与 UNC 路径在任意平台都被接受（单测）
- [x] 相对路径仍被拒绝（既有单测）
- [x] importer 包覆盖率 100%，全仓 typecheck 5/5
