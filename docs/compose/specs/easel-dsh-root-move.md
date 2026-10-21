---
feature: easel-dsh-root-move
status: in-progress
updated: 2026-10-21
branch: feat/easel-mac-package (dsh 仓)
commits: filled at delivery
---

# dsh 升为根目录主项目（方案 B）

## Report

(finalize 时填写)

## [S1] Problem

日常主工作区是外层 ZJU-REAL/Easel 仓，但产品代码全部在嵌套的 dsh worktree（`Easel/dsh`）里；外层只剩 spec 文档与插件暂存职能。嵌套布局让每次构建/同步都要跨仓解析路径，打开根目录先看到一堆已退役的老 Easel 骨架，心智负担大。用户拍板方案 B：让 `C:\Users\chenfei\Documents\GitHub\Easel` 根目录本身就是 dsh 项目。

## [S2] Design

- `Easel` 根目录直接成为 dsh 仓（deepseek-harness）的已注册 worktree，分支 `feat/easel-mac-package`——保持当前工作状态原样上移一层。dsh 主 checkout（`deepseek-harness`，master）与 safety worktree 原地不动，主仓路径不变，无需 `git worktree repair` 主向。
- 手法：外层旧仓整体改名 `Easel-archive-20261021` 腾出路径 → `git worktree move Easel-archive-20261021/dsh Easel`（git 2.55，同卷 rename，瞬间完成）→ 归档仓内 `git worktree repair` 修复其自带 `.worktrees/` 的链接。
- specs（19 个既有 + 本 spec）迁入 dsh 仓 `docs/compose/specs/`，提交在 `feat/easel-mac-package`。
- 有用脚本移植：`scripts/dsh-session-export.mjs` → dsh 仓 `scripts/`（原样）；`smoke-deconstruct.mjs` → dsh 仓 `scripts/`（import 改为 `../easel/dsh-plugin-easel/...`，避免污染 sync-easel-bundle 的 dsh/easel 目标语义）；外层 `.env` 复制到新根（smoke 脚本硬编码路径 `C:/.../GitHub/Easel/.env` 搬家后字符串不变，继续有效）。
- 两份插件已收敛（vendored `build.mjs` 已含 `resolveDshRoot` 双布局解析，`src/styles` 均在），外层未提交改动视为已同步，不移植。
- 删除规则：外层四分支（main、feat/easel-account-insights、feat/easel-context-menu、archive/pre-b4-backend-wip）全部 push 到 origin 成功后，才允许删除归档目录；任一 push 失败则保留归档并如实报告。

## [S3] Scope

- In scope: 抢救（push/specs/脚本/.env）、目录手术、新根 pnpm install、插件 build.mjs 集成验证、spec 最终化、记忆更新。
- Out of scope: dsh 仓 master 的推送策略（ahead 2725 保持现状）、cargo target 重建、GitHub 侧仓库的删除/归档、sync-easel-bundle.mjs 的退役改造、归档目录里 .mimocode / gui-test-screenshots 等杂项的甄别（随归档保留）。

## Tasks

- [ ] T1: 预检（进程锁、远端连通）+ push 外层四分支 (depends: none)
- [ ] T2: 本 spec 落盘并随批迁移 specs 至 dsh 仓 docs/compose/specs，提交 feat/easel-mac-package (depends: none)
- [ ] T3: 移植 dsh-session-export.mjs 与 smoke-deconstruct.mjs，拷贝 .env (depends: none)
- [ ] T4: 外层改名归档 + git worktree move 至根 + 归档仓 worktree repair (depends: T1, T2, T3)
- [ ] T5: 新根 pnpm install + node easel/dsh-plugin-easel/build.mjs 集成验证 (depends: T4)
- [ ] T6: 验证清单 + reviewer + finalize + 记忆更新 (depends: T5)
- [ ] T7: push 全部成功时删除归档目录，否则保留并报告 (depends: T6)

## [S4] Acceptance

- [ ] 主仓 `git worktree list` 显示根目录 worktree @ feat/easel-mac-package；dsh 主 checkout 与 safety worktree 不受影响
- [ ] 新根 `docs/compose/specs/` 含全部 spec 且已提交
- [ ] `node easel/dsh-plugin-easel/build.mjs` 在新根可跑通（resolveDshRoot 向上解析成功）
- [ ] `pnpm install` 在新根成功
- [ ] 外层四分支在 origin 可查（或归档保留并明确报告）
- [ ] dsh 仓内 feat/easel-mac-package 分支提交历史连续（worktree move 不改 ref）
