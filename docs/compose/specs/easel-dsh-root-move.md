---
feature: easel-dsh-root-move
status: delivered
updated: 2026-10-21
branch: feat/easel-mac-package (dsh 仓)
commits: 47169b76fcf..e0147d5f902
---

# dsh 升为根目录主项目（方案 B）

## Report

**What was built** — `C:\Users\chenfei\Documents\GitHub\Easel` 根目录现在就是 dsh 仓（deepseek-harness）的已注册 worktree，分支 `feat/easel-mac-package` @ e0147d5f902，工作状态原样升层。外层老 Easel 仓（ZJU-REAL/Easel）整体移入 `C:\Users\chenfei\Documents\GitHub\Easel-archive-20261021` 归档（含其 .git 与 .worktrees/，repair 后自身仍可用）。20 个 spec 迁入 dsh 仓 `docs/compose/specs/`，`dsh-session-export.mjs` 原样、`smoke-deconstruct.mjs`（import 改 `../easel/dsh-plugin-easel/...`）移入 dsh 仓 `scripts/`，连同本 spec 以 e0147d5f902 提交。

**Verification** — 全部在新根执行：
- `git log --oneline -3` → e0147d5f902 / 47169b76fcf / 8a66b85fdc2，历史连续 PASS
- `git status --porcelain | wc -l` → 3（2 个既有 untracked + `?? dsh/` 残壳空目录）PASS
- 主仓 `git worktree list` → `Easel @ e0147d5f902 [feat/easel-mac-package]` 注册正确；master 主 checkout 与 safety worktree 未受影响；并行会话新开的 `.worktrees/easel-ci-fix` 完好 PASS
- `git remote get-url origin / easel-dsh` → 四组 remote 完好 PASS
- `CI=true pnpm install` → 1m41s 成功，postinstall（含 lefthook install）全部通过 PASS
- `node easel/dsh-plugin-easel/build.mjs` → exit 0，`client.js` 552.4kb，`resolveDshRoot` 向上解析到根成功 PASS
- 归档仓 `git worktree repair` + `git log --oneline -1` → 31a8f4a 可用；外层四分支 push 因 github.com:443 不可达失败，按删除规则归档保留，不删除 PASS（条件性）

**Journey log**
- 外层根目录被 ZCode 主进程 cwd 锁死，顶层改名/删除都不可能——改为「由内向外」：先清空子项再让 dsh 内容升层，最后手工改写主仓 `.git/worktrees/dsh/gitdir` 指针，跳过了 `git worktree move`（目标路径被锁同样会失败）。
- `apps/` 整目录 rename 一直 "Permission denied"，罪魁是 `src-tauri/target/tmp` 下一个空目录被进程句柄钉住；MSYS mv 的报错还混入了 "same file" 假象（沙箱路径解析），最终 robocopy `/E /XD node_modules target /R:0 /W:0` 收敛。
- robocopy 不带 `/XD node_modules` 会顺着 pnpm junction 进入 `系统找不到指定的路径` 死循环重试（默认 /R:1000000 × /W:30），背景任务被卡 15 分钟——任何对 pnpm 工作区的 robocopy 必须排除 node_modules 并把 /R /W 归零。
- 本会话期间用户在外层 main 并行提交（b2adf41 B4 retirement / f703510 插件自包含 / 31a8f4a mac spec），抢救清单大部分被其覆盖；归档 reflog 用于事后对账。
- 遗留：`Easel/dsh` 残壳（一个被锁空目录，重启后 `rmdir` 即可）；外层四分支 push 待网络恢复后在归档仓内补推，确认后可删归档。

## [S1] Problem

日常主工作区是外层 ZJU-REAL/Easel 仓，但产品代码全部在嵌套的 dsh worktree（`Easel/dsh`）里；外层只剩 spec 文档与插件暂存职能。嵌套布局让每次构建/同步都要跨仓解析路径，打开根目录先看到一堆已退役的老 Easel 骨架，心智负担大。用户拍板方案 B：让 `C:\Users\chenfei\Documents\GitHub\Easel` 根目录本身就是 dsh 项目。

## [S2] Design

- `Easel` 根目录直接成为 dsh 仓（deepseek-harness）的已注册 worktree，分支 `feat/easel-mac-package`——保持当前工作状态原样上移一层。dsh 主 checkout（`deepseek-harness`，master）与 safety worktree 原地不动，主仓路径不变，无需 `git worktree repair` 主向。
- 手法：外层旧仓内容整体移入 `Easel-archive-20261021` 腾出路径 → dsh worktree 内容上移至根 → 手工改写主仓 `.git/worktrees/dsh/gitdir` 指针（顶层目录被 ZCode 进程 cwd 锁死，`git worktree move` 与顶层 rename 均不可行，故由内向外搬迁）。
- specs（19 个既有 + 本 spec）迁入 dsh 仓 `docs/compose/specs/`，提交在 `feat/easel-mac-package`。
- 有用脚本移植：`scripts/dsh-session-export.mjs` → dsh 仓 `scripts/`（原样）；`smoke-deconstruct.mjs` → dsh 仓 `scripts/`（import 改为 `../easel/dsh-plugin-easel/...`，避免污染 sync-easel-bundle 的 dsh/easel 目标语义）；外层 `.env` 复制到新根（gitignore 第 2 行覆盖）。
- 两份插件已收敛（vendored `build.mjs` 已含 `resolveDshRoot` 双布局解析，`src/styles` 均在，且用户并行提交 f703510 已把外层构建脚本改动正式入库）。
- 删除规则：外层四分支（main、feat/easel-account-insights、feat/easel-context-menu、archive/pre-b4-backend-wip）全部 push 到 origin 成功后，才允许删除归档目录；任一 push 失败则保留归档并如实报告。

## [S3] Scope

- In scope: 抢救（push/specs/脚本/.env）、目录手术、新根 pnpm install、插件 build.mjs 集成验证、spec 最终化、记忆更新。
- Out of scope: dsh 仓 master 的推送策略（ahead 2725 保持现状）、cargo target 重建、GitHub 侧仓库的删除/归档、sync-easel-bundle.mjs 的退役改造、归档目录里 .mimocode / gui-test-screenshots 等杂项的甄别（随归档保留）。

## Tasks

- [x] T1: 预检 + push 外层四分支（push 失败，归档保留）
- [x] T2: 本 spec 落盘并随批迁移 specs 至 dsh 仓 docs/compose/specs，提交 feat/easel-mac-package
- [x] T3: 移植 dsh-session-export.mjs 与 smoke-deconstruct.mjs，拷贝 .env
- [x] T4: 外层内容移入归档 + dsh 内容上移至根 + 手工改写 worktree 注册 + 归档仓 worktree repair
- [x] T5: 新根 pnpm install + node easel/dsh-plugin-easel/build.mjs 集成验证
- [x] T6: 验证清单 + reviewer + finalize + 记忆更新
- [x] T7: push 失败 → 归档保留并报告（不删除）

## [S4] Acceptance

- [x] 主仓 `git worktree list` 显示根目录 worktree @ feat/easel-mac-package；dsh 主 checkout 与 safety worktree 不受影响（含并行会话的 easel-ci-fix worktree）
- [x] 新根 `docs/compose/specs/` 含 20 个 spec 且已提交（e0147d5f902，22 文件含 2 脚本）
- [x] `node easel/dsh-plugin-easel/build.mjs` 在新根跑通（exit 0，552.4kb bundle）
- [x] `pnpm install` 在新根成功（CI=true，1m41s）
- [x] 外层四分支 push 失败 → 归档保留并明确报告（待网络恢复补推后再删）
- [x] dsh 仓内 feat/easel-mac-package 分支提交历史连续（e0147d5f902 → 47169b76fcf → 8a66b85fdc2）
