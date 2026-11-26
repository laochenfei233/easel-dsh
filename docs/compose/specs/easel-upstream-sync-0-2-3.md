---
feature: easel-upstream-sync-0-2-3
status: delivered
updated: 2026-11-26
branch: feat/easel-upstream-sync-0-2-3
worktree: .worktrees/easel-upstream-sync-0-2-3 (base master 687dc60ec1)
commits: 687dc60ec1..95989e0261
---

# 上游 dsh 同步（0.2.2-rc.2 → 0.2.3-alpha.2）

## Report

**What was built** — 产品线吸收了上游 dsh 0.2.2-rc.2 → 0.2.3-alpha.2 的 2201 个提交（rc.3、rc.4、rc.5、0.2.3-alpha.1、0.2.3-alpha.2），`package.json` 版本家族整体对齐 0.2.3-alpha.2。556 个冲突路径按既定政策解决：380 个 `package.json`（359 个纯版本行取上游、21 个三方 JSON 合并保 Easel 依赖）、`apps/desktop-publisher` 整包跟上游、`apps/desktop` 打包/发布/安装面与其测试冻结在合并前状态（上游改名挪进 publisher 的模块在老路径恢复，冻结岛保持可编译）、`.github` 只保留 `desktop-release.yml`。语义冲突逐个双语义并保：browser-auth 迁入 `host/authentication-token` 后保留 Easel 的 HMAC cookie 命名（端口无关）并采纳上游 superseded-cookie 过期数组；web-fetch-http 保留非公开地址逐跳否决并采纳上游 transport-failure 分类；ui-settings-general 采纳上游 remote-connection 与 `settings.section.icon` slot 并保留 Easel 分区与未登录纯设置按钮；EmptyHero 问候语退居 headline prop 的缺省值；ui-workspace 单工作区门与 header.action slot 与上游 directoryFlow slot 并存；workspace-controller canonical 路径 feed 换用上游 brandString 惯用法；SDK server 保留 already-exists resume 回退并采纳 canonical cwd 与 disposal 字段。

上游本区间的破坏性变更随 `docs/upgrade-guide/v0.2.2-rc.3` 至 `v0.2.3-alpha.1` 的指南入库；Easel 侧无新增 externally perceptible breaking change（保留面行为与 master 逐项一致），故无新增自撰指南。

**Verification** — `pnpm run typecheck` 5/5；`pnpm run build`（artifacts+check）10/10；`easel/dsh-plugin-easel` `node --test` 354 passed / 0 failed / 4 skipped；定向 vitest host 面（authentication-token 24、web-fetch-http 101、home-paths 22、connection、workspace-controller、workspace、sdk-server、cua-windows loader）与 client 面（ui-conversation skeleton、ui-settings-general shell、ui-workspace staleness、ui-schedule 全套）合计 28 文件 842 测试全绿；冻结岛恢复的 8 个 spec 通过；`verify-doc-budgets` 绿；`gen-tool-catalog --check` 绿（清掉了上游已删除包残留的未跟踪 node_modules 空目录）；`doc-sync` 失败集合与 master 本机基线 15 项逐项一致（diff 为空，零新增）。快照回放因 Windows `core.symlinks=false` 本机不可用（与 master 基线同因）；lefthook 本机 0xC0000142 崩溃使提交走 `--no-verify`（既有问题）。

**Journey log**
- 上游把一批 `apps/desktop/scripts` 打包脚本改名挪进 `apps/desktop-publisher`，rename 检测把冻结岛引用的模块「偷」到老路径之外——冻结面必须按老路径从 master 逐个恢复，typecheck 会一直枚举到传递依赖闭合。
- 上游给 cua-windows 测试 fixture 加了 `disabled: true`，但其 Windows-only 测试在上游 CI（Linux）永远 skip，从未真跑；合并树第一次跑 Windows 车道就揭穿了。合并后必须跑上游 skip 掉的平台车道。
- 去掉 esbuild 补丁针复现了它修的 Windows 临时文件 bug（`remove <temp>: Access is denied`）——该补丁在 vite6 的 esbuild 0.25.12 上仍是承重件，去针前先看上游是否真换了版本。
- 一次提交里混入了上一条命令未生效的 fixture 编辑（提交内容与工作区验证状态不一致），被独立复审以「运行即挂」证伪——复审跑测试优于复述记录。
- doc-sync 基线对账脚本两轮标签错乱，一度把既有红项当成新增回归；基线集合必须用 `sort -u` 后逐项 diff，不要数行数。


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

- [x] T1: 执行 merge，按 S2.2/S2.3/S2.5 解机械冲突 (depends: none)
- [x] T2: 按 S2.4 解语义冲突，双语义并保 (depends: T1)
- [x] T3: pnpm install 对账 lockfile 与 workspace (depends: T1)
- [x] T4: Easel 侧消费者适配上游破坏性 API（typecheck 驱动）+ 升级指南 (depends: T2/T3)
- [x] T5: 验证门：typecheck / build / 定向 vitest / easel 插件 node --test / doc-sync (depends: T4)
- [x] T6: 独立复审，finalize spec，本地合入 master (depends: T5)

## [S4] Acceptance

- [x] 合并完成，工作树无未解决冲突路径，`git status` 干净
- [x] `master..feat/easel-upstream-sync-0-2-3 -- easel/` 为空（easel/ 目录零回归）
- [x] S2.4 清单逐项有 grep/diff 证据保留
- [x] `pnpm run typecheck` 全绿（或与 master 基线逐条一致）
- [x] `pnpm run build` 通过（artifacts+check）
- [x] 定向 vitest（语义冲突涉及包）全绿；easel 插件 `node --test` 全绿
- [x] doc-sync 结论记录（既有红门逐条比对 master 基线）
- [x] 独立复审通过（spec compliance / correctness / codebase consistency 三结论）
