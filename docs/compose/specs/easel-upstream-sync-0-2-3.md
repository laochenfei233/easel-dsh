---
feature: easel-upstream-sync-0-2-3
status: in-progress
updated: 2026-11-25
branch: feat/easel-upstream-sync-0-2-3
worktree: .worktrees/easel-upstream-sync-0-2-3 (base master 687dc60ec1)
commits: # filled at delivery
---

# 上游 dsh 同步（0.2.2-rc.2 → 0.2.3-alpha.2）

## Report

## [S1] Problem

产品线自 2026-11-13 吸收上游 0.2.2-rc.2（e8f7b93a34）后，上游又推进了 2201 个提交（发布 0.2.2-rc.3、rc.4、rc.5、0.2.3-alpha.1、0.2.3-alpha.2，头 4b399c39a6）。产品需要吸收这 12 天的上游演进，同时保住 Easel 在此期间落地的全部自研工作（persona 配色两线、爆款拆解环境自动装配、隔空传送五轮修复、rc.3/rc.4/rc.5 产品发布），并把 `package.json` 版本家族对齐到上游 0.2.3-alpha.2。

## [S2] Design

S2.1 **合并对象与基点**：`refs/remotes/upstream/master`（4b399c39a6，0.2.3-alpha.2）合入 `master`（687dc60ec1），merge-base e8f7b93a34（上游 0.2.2-rc.2）。merge-tree 预演 553 个冲突路径，其中 379 个是 `package.json` 版本行（两条并行发版列车相撞）、约 80 个落在 S2.3 排除面、真语义冲突约 15 个包文件加 apps/web 少量测试。上游对象经 gitea 局域网镜像拉取（GitHub git 端点 443 被墙；deepseek-harness 本地克隆为 blob:none 部分克隆不能作 fetch 服务端）。

S2.2 **版本家族对齐上游**：全部 `package.json` 版本冲突取上游 0.2.3-alpha.2 家族（沿用 rc.2 同步用户拍板「产品版本号与上游对齐」的先例）。desktop-tauri 壳版本与 easel 插件版本是 Easel 专属文件，上游不触碰，保持现状；产品下次发版时的版本号另定。

S2.3 **排除面（沿用 61b3af27e7 与 b5e6dfe0ee 两次落地的政策）**：
- `.github`：Easel 只保留 `desktop-release.yml`；上游全部 workflow 改动拒收（modify/delete 冲突保持删除，上游新增文件不吸收）。`review-ownership` 与治理脚本（approval-policy、issue-management）已随 master 2026-11-03 的 workflow 收敛删除，本轮维持删除，run-gates 不同步上游对应门；上游本区间新增的 `stale-pull-requests` 脚本与测试自成一体的门吸收。
- `apps/desktop` 打包/发布/安装面（`scripts|packaging|publishing|installer|config|windows-signing` 与 `tests` 中对应物）冻结在合并前状态；上游在该面的新增文件删除。
- `apps/desktop-publisher`：rc.2 轮已整面跟上游（HEAD 与上游 rc.2 逐字节一致），本轮冲突取 theirs。
- `scripts/` 中 CI/发布流水线 spec（ci-workflow、macos-package-workflow、desktop-publish-workflow、windows-package-workflow、preview-workflow、ci-release-selfhosted、release/publish）与 cua-helper 打包脚本取 ours。
- `apps/web` 的 e2e/expected 冲突：本侧删除的保持删除（b5e6dfe0ee 同批决定），其余随上游。

S2.4 **Easel 特性保留清单（语义冲突裁决基准，两边语义并保）**：单工作区与 `canonicalPath` 工作区归属（workspace-controller feed）、未登录即纯设置按钮（ui-settings-general）、hero 四时段问候与「思考中」（ui-conversation EmptyHero）、web-fetch 非公开地址逐跳否决（10-29 轮已确立上游有意放开而 Easel 安全审计保留）、browser-auth HMAC cookie 域名（桌面重启动 431 修复）、home-paths 数据根选择、SDK resume 的 already-exists 回退、插件市场退役、`easel/` 目录（上游不存在该目录，本轮预演零冲突）。

S2.5 **机械冲突解法**：`pnpm-lock.yaml` 取上游后 `pnpm install` 重对账；`pnpm-workspace.yaml`/根 `package.json`/`THIRD_PARTY_NOTICES.md`/`docs/AGENTS.md` 取并集；`slot-catalog.ts` 属生成物，用 gen-client-catalog 重生成；快照与 expected 文件随其实现走；其余逐文件判断。

S2.6 **破坏性变更记录**：上游在区间内的 externally perceptible breaking change 由 Easel 侧消费者直接吸收，并按 AGENTS.md 记入升级指南（以 typecheck 与上游 release notes 实际内容为准）。

## [S3] Scope

- In scope：merge 4b399c39a6 全量（除 S2.3 排除面）、语义冲突并保、lockfile 对账、Easel 侧消费者适配、验证门、独立复审、本地合入 master。
- Out of scope：推送双仓（沿用惯例留待用户）、打包与发版、desktop-tauri/插件版本号调整、上游新实验面的产品化启用（仅随合并入库）。

## Tasks

- [ ] T1: 执行 merge，按 S2.2/S2.3/S2.5 解机械冲突 (depends: none)
- [ ] T2: 按 S2.4 解语义冲突，双语义并保 (depends: T1)
- [ ] T3: pnpm install 对账 lockfile 与 workspace (depends: T1)
- [ ] T4: Easel 侧消费者适配上游破坏性 API（typecheck 驱动）+ 升级指南 (depends: T2/T3)
- [ ] T5: 验证门：typecheck / build / 定向 vitest / easel 插件 node --test / doc-sync (depends: T4)
- [ ] T6: 独立复审，finalize spec，本地合入 master (depends: T5)

## [S4] Acceptance

- [ ] 合并完成，工作树无未解决冲突路径，`git status` 干净
- [ ] `master..feat/easel-upstream-sync-0-2-3 -- easel/` 为空（easel/ 目录零回归）
- [ ] S2.4 清单逐项有 grep/diff 证据保留
- [ ] `pnpm run typecheck` 全绿（或与 master 基线逐条一致）
- [ ] `pnpm run build` 通过（artifacts+check）
- [ ] 定向 vitest（语义冲突涉及包）全绿；easel 插件 `node --test` 全绿
- [ ] doc-sync 结论记录（既有红门逐条比对 master 基线）
- [ ] 独立复审通过（spec compliance / correctness / codebase consistency 三结论）
