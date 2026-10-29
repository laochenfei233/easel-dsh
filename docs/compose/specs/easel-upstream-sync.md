---
feature: easel-upstream-sync
status: delivered
updated: 2026-10-29
branch: feat/easel-upstream-sync
commits: 7539b7f780..6af5631701
---

# 上游 dsh 同步（0.2.1-rc.2 → 0.2.2-alpha.2）

## Report

**What was built** — 产品线吸收了上游 dsh 0.2.1-rc.2 → 0.2.2-alpha.2 的 2176 个提交（0.2.1 正式、rc.3、rc.4、0.2.2-alpha.1/.2），并 merge-forward 到会话期间前进的本地 master（含爆款拆解续跑与快手/视频号下载线）。34 个上游冲突全部按双语义并保解决：session-controller 同时暴露 Easel 的 `inputModalities` 与上游的 `model.badge`；ui-sidebar 保留 `uiSidebarPanels` 隐藏服务并吸收上游 panelPins 与八语字典；ui-workspace 行菜单同时受上游 access 快照与 Easel 单工作区过滤约束；ui-schedule 在上游 `whenAccess` 生成器里嫁接设置区卡片；ui-settings-account 保持 Easel「未登录即纯设置按钮」的产品决定；SDK 服务端把上游 setup 语义与 Easel 的 already-exists 回退合并为同一条 resume 路径；web-fetch-http 保留 Easel 安全审计的非公开地址否决（上游有意改为允许任意目标），同时吸收其 charset 容错修复；compaction 把 Easel 的结构化触发记录挂进上游新 switch。

桌面打包/发布/安装/签名面按 S2.2 冻结在合并前状态，唯一例外是 S2.2a 的 patch 分类自洽修复。六份上游破坏性变更（attachment 完整引用、macOS CUA bundle-id 授权、worktree 命名、普通 fork 独立化、PTC 取消语义、session.follow 激活、模型列表缓存签名）由 Easel 侧消费者直接吸收，无遗留适配。

**Verification** — `pnpm run typecheck` 5/5；`pnpm run build`（artifacts+check）10/10；`pnpm run test:snapshot` exit 0；插件 `node --test` 300/300；`pnpm run hygiene` 19/22，三项失败（product-use、no-unknown-casts、cordis-config）与 master 基线逐条一致。定向 vitest 全绿：web-fetch-http+tool-web 179、session-controller 1077、ui-sidebar 75、ui-workspace 512、ui-schedule/account/plugin-manager/sdk-server 1648、apps/cli 171、compaction+sdk-protocol 191、ui-theme+account 554、app-boot 5666、desktop 打包策略 16、easel-backup 100。全量 `pnpm run test` 的 439 项失败已完整分类（见 S4），无未解释项。

**Journey log**
- master 在会话期间被推进到 `d9e55f7cce`（拆解续跑/下载线），合并必须 merge-forward；否则会让产品线丢掉这些提交。
- 我一度把 `master..HEAD -- easel/` 的 1832 行缩水误判为合并删文件，实际是 master 前进了——`git diff` 的 base 会随分支移动，必须核对 merge-base 与第一父。
- 上游把 web-fetch-http 的传输层整体重写并明确「任何目标地址都被允许」，与 Easel 安全审计的逐跳否决正面冲突；裁决是整包保留 Easel 实现、只取 policy.ts，并给上游新测试补回 loopback 解析夹具。
- `pnpm run test` 全量在这台机器（16 核跑 6600 文件）会产生大量并发超时；判定归属必须逐包单跑，否则会把 flake 记成回归（app-boot、build.spec、easel-backup 都属此类）。
- 上游 7509c174d9 给 release-publish 加了 `--serial` 却没同步其 spec，`ci-release-selfhosted` 也停在旧 runs-on 断言；两处按实现更新契约，并把放宽后的断言限定在「hosted 仍是回退」这一实质语义上。

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

S2.2a **排除面的自洽例外（2026-10-29 修订）**：`apps/desktop/scripts/runtime-patch-policy.ts` 保持本地版本，但必须分类合并后 workspace 的全部 `patchedDependencies`——否则 `prepareRuntimePatches` 直接抛错、Desktop runtime 计划无法生成。本次补入 `@botiverse/oar@0.67.0`、`@earendil-works/pi-ai@1.3.0`、`lexical@0.49.0`、两个 Markdown parser patch，并把本地既有的 `esbuild@0.25.12` 一并分类（该 spec 此前在 master 上就是红的）。这是让保留脚本适应新依赖集的最小适配，不吸收上游打包/发布功能。

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

- [x] `git diff master..HEAD -- <S2.2 排除路径>` 仅剩 S2.2a 的 `runtime-patch-policy.ts`（打包/发布功能面与 master 一致）：`git diff --name-only master..HEAD | grep -E "^apps/desktop/(packaging|publishing|installer|windows-signing)/|^apps/desktop/config/(macos|windows)-packaging/|^apps/desktop/scripts/|^\.github/workflows/(macos|windows)-package\.yml|^\.github/workflows/desktop-publish\.yml" | wc -l` → 0
- [x] Easel 特性清单文件在 HEAD 中语义完整：uiSidebarPanels、EASEL-DIVERGENCE、SchedulesSettingsSection、assertProxyDestination、already-exists 回退、inputModalities、openSettings 全部在位；`git diff master..HEAD -- easel/` 为空
- [x] `pnpm run typecheck` 通过（5/5；merge-forward 后复跑 5/5）
- [x] `pnpm run build` 通过（10/10，含 Desktop bundle 与 Web build）
- [x] dsh-plugin-easel `node --test` 全绿（270 → merge-forward 后 300 pass / 0 fail）
- [x] 受影响包 vitest 全绿：web-fetch-http 72、session-controller 1077、ui-sidebar 75（快照按 Easel 品牌 mark 更新）、ui-workspace 512、schedule+account+plugin-manager+sdk 1648、apps/cli 171、compaction+sdk-protocol 191、desktop 行为抽测 77
- [x] `pnpm run test:snapshot` exit 0（keyless 回放，含上游 510 个 snapshot 变更）
- [x] `pnpm run typecheck`（5/5）与 `pnpm run build:check`（2/2）在全部修复后复跑通过
- [x] 全量 `pnpm run test` 的 439 项失败已分类：36 项与 master 基线一致（含 lan-handoff、`@easel-dsh` 版本族、agent-instructions、cordis/tools catalog）；并发 flake 单跑即绿（app-boot 5666、easel-backup 100、build.spec 20 等）；Windows 上 git/ssh 5s 超时命中未启用的 `experimental/client-ui-forge`（26）与 `plugin-market/repository-cache`（4），其源码与上游逐字一致
- [x] 合并引入的 8 处真实契约缺口已修：THIRD_PARTY_NOTICES 重生成、run-gates/ci-workflow/ci-release-selfhosted 三个 spec 与实现对齐、ui-theme hover 守卫（Easel CSS）、tool-web 两个 spec 的 loopback 夹具、desktop patch 分类
- [x] `pnpm run hygiene` 19/22，3 项与 master 基线一致（product-use 3 个未挂载 Easel 包、no-unknown-casts 3 个 easel/ 既有项、cordis-config 的 acp symlink），均为 PRE-EXISTING
- [ ] master 以 ff-only 快进到合并头（待用户拍板；master 在会话期间已被推进到 d9e55f7cce，合并已 merge-forward 覆盖）
