---
feature: easel-handoff-real-path
status: delivered
updated: 2026-11-10
branch: fix/easel-handoff-symlink（worktree）
commits: 8bf6bc8cb4..c6a6fc9f4c
---

# 隔空传送：接收项目与会话统一落到真实路径

## Report

**What was built** — 接收一个项目时，完成搬移后先取项目目录的 realpath，并用同一个真实路径做会话导入（`importSessionArchives` 的 `targetCwd`）、工作区挂靠（`attachProject`）和回执里的 `projectPath`；快推送（merge）同样用真实路径挂靠与回报。

**Verification** — `packages/transfer/lan-handoff` 154/154 测试通过（含新增的软链接父目录用例：junction/symlink 下 `outcome.projectPath`、`imported.targetCwd`、`attached.projectPath` 三者等于真实路径）；`handoff.ts` 覆盖率 100%（`index.ts` 分支 98.93% 与 master 基线一致，非本次引入）；全仓 typecheck 5/5（在完整安装的 master worktree 上验证）。

**Journey log** — (1) 用户 Mac 的数据根经 `~/AppData/Local/Easel` 软链到 `~/Documents/Easel-dsh/workspace`：工作区注册表按 realpath 登记（Documents），而回执把词法路径（AppData）交给会话导入，会话 cwd 目录因此落在别名路径下——侧栏有工作区、对话却为空。(2) 直接在 `receiveHandoff` 开头 canonicalize 父目录会改变「目标父路径不可用」的拒绝时机与错误类型，既有用例因此失败；改为在项目目录真实存在之后再取 realpath，既覆盖软链又不改变失败契约。

## [S1] Problem

Windows → macOS 发送项目：文件与会话都导入成功、工作区也登记了，但 Mac 侧栏显示该工作区**没有任何对话**。原因是工作区按真实路径登记、会话按别名路径记录 cwd，两者不相等。

## [S2] Design

`completeReceipt` 在 `rename` 之后取 `realpath(finalPath)`，用它作为会话导入的 `targetCwd`、工作区挂靠路径与回执 `projectPath`；`mergeReceipt` 对已存在的目标目录同样先取 realpath。路径不存在时不会走到这里（此前 `decideOffer` 已拒绝或创建），失败类型与消息保持不变。

## [S3] Scope

- In scope: `packages/transfer/lan-handoff` 的接收完成路径与其单测。
- Out of scope: 数据根迁移本身、发送端的路径处理。

## Tasks

- [x] T1: 完成搬移后取真实路径并用于导入/挂靠/回执（depends: none）
- [x] T2: 软链接父目录的接收用例（depends: T1）

## [S4] Acceptance

- [x] 软链接目标下，`projectPath` / `targetCwd` / `attachProject` 使用同一真实路径（单测）
- [x] 既有 154 个包测试通过（含拒绝父路径的用例）
- [x] 全仓 typecheck 5/5
