---
feature: easel-upstream-sync
status: in-progress
updated: 2026-10-29
branch: feat/easel-upstream-sync
commits: 7539b7f780..TBD
---

# 上游 dsh 同步（0.2.1-rc.2 → 0.2.2-alpha.2）

## Report

## [S1] Problem

产品线自 2026-10-21 合入 dsh 0.2.1-rc.2（687f282e86）后，上游又推进了 2176 个提交（243 个主线合并，发布 0.2.1 正式、rc.3、rc.4、0.2.2-alpha.1/.2，头 f3803c9697）。产品需要吸收这 8 天的上游演进：session projection 重构、审批/模型列表 API 变更、client UI 修复簇、新实验面（Forge/LiveShare/CUA/推荐）、工具执行器拆包等，同时不能丢掉 Easel 的全部自研特性。

## [S2] Design

S2.1 **合并对象与基点**：`refs/remotes/upstream-dsh/master`（f3803c9697，0.2.2-alpha.2）合入 `master`（7539b7f780），merge-base 687f282e86。经本地预演（merge-tree）共 34 个 content 冲突文件。上游对象经 gitea 局域网镜像拉取（GitHub git 端点间歇不通；本地 deepseek-harness 克隆为 blob:none 无法作服务端）。

S2.2 **排除面（用户指令：本地打包不进）**：上游桌面打包/发布链改动不吸收，保持 master 现状：
- `apps/desktop/packaging|publishing|installer|windows-signing|config/macos-packaging|config/windows-packaging`
- `apps/desktop/scripts` 中打包发布脚本（desktop-package-*、desktop-publish-*、desktop-upload-*、desktop-edgeone*、desktop-build-paths、desktop-auto-update-environment、electron-builder-config、pack-local-packages、package-target、prepare-macos-ci、preflight-desktop-publish、resolve-desktop-publish-ci、upload-target、upload-with-credentials 及同名 .d.mts）
- 对应 spec 测试与 `scripts/macos-package-workflow.spec.ts`、`scripts/desktop-package-forms.spec.ts`
- `.github/workflows/macos-package.yml|windows-package.yml`（上游改动回退为 ours）与新增的 `macos-intel-package.yml`
- 上游 `apps/desktop` 非打包部分（src/renderer/docs）照常吸收——Electron 壳仍是树内活体，冻结会与上游 client 包 API 脱节；Easel 实际发货壳是 desktop-tauri，上游从不触碰。
- 实现方式：合并完成后对排除路径 `git restore --source=HEAD`（ ours 已有文件）并删除上游新增文件，再全树核对无残留引用（typecheck 兜底）。

S2.3 **Easel 特性保留清单（冲突裁决基准，两边语义并保）**：多账户注册表与 runner 参数化/CDP 直启、账号看板归档与全览、mac 会话 loopback 代理、单工作区与立项/拆解页、插件市场退役（上游 plugin-market 包为纯新增、保持惰性不注册）、热点雷达、内容日历、定时任务（rail order）、设置备份、隔空传送、爆款拆解（ASR 凭据链/快手/视频号）、安全加固（connection 门、runnerToken、video_fetch 加固、runtime-inputs 摘要 pin）、canonicalPath 工作区归属、数据根选择、更新源。上游 rc.3/rc.4 的 7 条破坏性变更按升级指南迁移 Easel 侧消费者（尤其 ModelListingCache/settings/changed/badges/resolveText 对模型下拉与账号页的签名要求）。

S2.4 **冲突解法**：机械文件取上游后重建本地项——`pnpm-workspace.yaml`/`package.json`（并集，保 desktop-tauri 与 Easel 工作区条目）、`pnpm-lock.yaml`（取上游 + `pnpm install` 重对账）、`THIRD_PARTY_NOTICES.md`（并集）。语义文件逐个双语义并保；快照文件随实现走。vendor 按上游（vendoring policy 的 sync 语义）。docs/AGENTS.md 冲突取并集（Easel 章节不丢）。

## [S3] Scope

- In scope：merge f3803c9697 全量（除 S2.2 排除面）、Easel 侧消费者对上游 API 变更的适配、lockfile 对账、验证门全绿。
- Out of scope：推送双仓（等用户拍板）、easel-upstream-adoptions 等未合并分支的重定基、上游新实验面的产品化启用（仅随合并入库）、mac 包发布流水线改造。

## Tasks

- [ ] T1: 建工作树与分支（depends: none）
- [ ] T2: 执行 merge，按 S2.3/S2.4 解 34 个冲突 (depends: T1)
- [ ] T3: 按 S2.2 回退/删除本地打包排除面 (depends: T2)
- [ ] T4: pnpm install 对账 lockfile 与 workspace (depends: T3)
- [ ] T5: Easel 侧消费者适配上游破坏性 API（typecheck 驱动）(depends: T4)
- [ ] T6: 验证门：typecheck / build / 受影响 vitest / 插件 node --test (depends: T5)
- [ ] T7: ponytail 复审 + spec delivered + ff master (depends: T6)

## [S4] Acceptance

- [ ] `git diff master..HEAD -- <S2.2 排除路径>` 为空（打包面与 master 完全一致）
- [ ] Easel 特性清单文件在 HEAD 中语义完整（多账户/看板/安全门/拆解/定时任务等关键文件抽查）
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm run build` 通过（junction worktree 已知 PRE-EXISTING 项按记忆处置并标注）
- [ ] dsh-plugin-easel `node --test` 全绿
- [ ] 受影响包 vitest 全绿（快照按上游实现更新）
- [ ] master 以 ff-only 快进到合并头
