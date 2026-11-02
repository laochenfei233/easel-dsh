---
feature: easel-settings-backup
status: delivered
updated: 2026-10-24
branch: feat/easel-settings-backup
commits: 5d6def5656..9d0138ec76
---

# 设置页备份：配置、会话与工作区文件备至 WebDAV / SMB / S3

## Report

**What was built** — Easel 设置页新增「备份」区块（settings.section id `easel-backup`，order 70）：目标端表单（WebDAV/S3/SMB 三协议动态字段、写 only 的密钥输入、测试连接、Windows `net use` 凭据接线）、三组备份内容勾选（配置与凭据 / 会话与附件 / 工作区项目与产出，前两组默认开）、可选口令加密（scrypt + 分块 AES-256-GCM）、手动/每日/每周定时与保留份数、带实时进度的立即备份与最近历史、两段式恢复（先出计划再确认覆盖）。远端布局 `easel-backup/<group>/<stamp>.zip`，每组保留最近 N 份。

引擎是新工作区包 `@deepseek-ai/dsh-easel-backup`（`packages/backup/easel-backup`，fflate 流式 zip + aws4fetch 签名，目标端 seam 可注入），进 `apps/cli` 部署闭包、经 `home/node_modules` junction 在打包运行时解析；宿主侧 `dsh-plugin-easel/backup` 子入口（setup.rs row，automation 同款故障隔离）挂 `/easel/api/backup/*` 路由，凭据存 dsh-credentials 库（0600）且永不回传前端，配置在 `outputs/_backup_config.json` 串行队列维护，定时用自管 15 分钟 tick + 错过补跑。桌面版本号 0.2.16 → 0.2.20。

**Verification** — 包 vitest 100/100（11 文件，含三协议 mock 服务器、加密 round-trip/篡改/截断、retention、恢复原子性）；插件 node --test 105/105（含入口装配回归）；包 `tsc -b` 干净、oxlint 0 错误；`pnpm run build:artifacts` 7/7 门、`pnpm run build:check` 2/2 门、`cargo check` 全部 PASS；doc-sync 剩余 12 个失败经基线（5d6def5656）对照全部预存在，且 CLI-help 一项由本次再生修复；覆盖率在 Windows 本地仅剩 POSIX-only 分支（Linux CI 覆盖门归属）。独立审查（fresh subagent）指出入口未导出 name/inject/apply 的阻塞项、fileSink 未观察拒绝、run 双开竞态——三项均已修复并以回归测试锁定（105/105 内含装配回归）。

**Journey log** —
- compose-next 的「Grill 四轴」在非交互会话未获应答，按推荐项自动裁决并在 spec 顶部声明「合并前可推翻」——实测顺畅，产出与用户预期无碰撞。
- worktree 复用主仓 node_modules 的 junction 惯例在 pnpm 11.28.5 下失效（`ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH`，Desktop bundle 拒跑）；改真安装（--ignore-scripts，37.9s）后 build:artifacts 7/7。后续 worktree 建议：加新依赖时直接真安装。
- `scripts/sync-easel-bundle.mjs` 是旧布局脚本：在新合并仓里 DSH_ROOT=仓根、destination=`easel/` == source，`node scripts/sync-easel-bundle.mjs easel` 会先 rm 后拷失败，把整个 `easel/` 目录删掉（本次靠 git checkout 恢复 + 重写 4 个未提交 UI 文件）。合并仓的 dsh/ 镜像同步应留给 CI 打包流，不要在 worktree 里手跑该脚本。
- 包级 100% 覆盖率门会逼出「死防御分支」的取舍：fflate 误用路径用可注入的 Writer 类直测、平台分支（chmod/POSIX 清理失败）留给 Linux CI 车道、纯格式解析用 `as string` 收窄而非 `!`（oxlint 禁非空断言）。vitest 的 esbuild 不查类型，`tsc -b` 必须单独跑。
- 独立审查抓到了实现者完全漏掉的装配层：库文件写了、row 加了、测试全绿，但 cordis 入口三件套（name/inject/apply）没导出——「测试经 stub 直驱 ≠ 生产可挂载」。凡是新增 Loader 子入口，装配回归测试应与实现同 commit。


## [S1] Problem

Easel 桌面端的全部用户状态集中在数据根（默认 `文档/Easel-dsh/`）的 `workspace/`（项目、产出、媒体、人设、`.env`）与 `home/`（profiles 补丁、`sessions/`、`attachments/v1`、`.credentials.yaml`）两棵目录树里。盘损坏、误删、换机时，用户除了手工整目录拷贝外没有任何备份与恢复手段。需要一个设置页入口，把配置项与相关文件按组备份到用户自有的 WebDAV / SMB / S3 远端，并能从远端恢复。

## [S2] Design

已拍板的决策（compose-next Grill 四轴；本会话为非交互模式，用户未应答，按推荐项自动裁决，合并前可推翻）：

1. 备份范围分三组：「配置与凭据」「会话与附件」「工作区项目与产出」；前两组默认勾选，第三组默认不勾、手动触发（首次备份小、快，媒体不占流量）。
2. SMB 用系统路径直写：Windows 直接写 UNC/映射盘路径（可选 `net use` 带凭据接线），macOS 引导挂载后写 `/Volumes`；不引第三方 SMB 协议栈。
3. 口令加密可选、默认关，UI 明示明文风险；开启后必填口令，用 scrypt 派生 + 分块 AES-256-GCM 容器包住 zip。
4. 触发方式支持手动 / 每日 / 每周 + 时刻；错过（关机、未启动）则下次启动补跑一次；自动备份只跑勾选的分组。

### D1 范围与排除

三组的内容与角色前缀（zip 内条目一律以 `home/` 或 `workspace/` 开头，恢复时映射回当前数据根，天然兼容数据根迁移）：

| 组 | 角色 | 内容 |
| --- | --- | --- |
| `config` | `home/` | `profiles/**`（去掉 `node_modules`、`.dsh-module-fallback`）、`.credentials.yaml` |
| `config` | `workspace/` | `.env`、`profiles/*.md`（人设）、`skills/**`、`outputs/*.json`（顶层状态库）、`outputs/_login/**` |
| `sessions` | `home/` | `sessions/**`、`attachments/v1/**` |
| `workspace` | `workspace/` | `projects/**`、`outputs/**`（与 `config` 组的顶层 JSON 有意重叠，恢复结果幂等） |

所有组统一排除：任何路径分量名为 `node_modules` 的目录、符号链接与 junction（`lstat` 识别后跳过，绝不穿透）、`home/cache/**`、`home/storages/**`、`home/logs/**`、`*.tmp`、`.easel-migrating`。

### D2 远端布局与保留

远端目录：`<remoteDir>/easel-backup/<group>/<yyyymmddThhmmssZ>.zip`（UTC 时间戳命名，字典序即时间序）。每个 zip 第一个条目是 `manifest.json`：`{ manifestVersion, group, createdAt, fileCount, totalBytes, sourceHost }`。保留策略：每组保留最近 N 份（默认 10，可配 1–100），备份成功后删除超出的旧份。

### D3 归档（复用 fflate）

复用 `fflate` 的流式 `Zip`/`ZipDeflate`（仓库先例：`packages/session-query/session-log-export/src/archive.ts`）。文本类条目 deflate level 6，媒体与已压缩内容 store level 0。zip 以流式产出落 D7 的 staging 文件，再以显式 `Content-Length` 上传——字节流不整包驻留内存，但会在磁盘落一个中间文件（严格 WebDAV/S3 网关拒绝 chunked 上传，这是换取正确性的取舍）。

### D4 加密容器

开启加密时，zip 字节流整体包进自定义容器：`magic("EASELBAK\x01") + kdf 参数(u16) + salt(16B) + base nonce(12B) + chunkSize(u32, 4 MiB)`，随后是逐块密文（每块 AES-256-GCM，密文后接 16B tag；AAD = `magic+版本(9B) || chunkIndex(u32 BE)`，共 13B）。密钥由口经 scrypt（N=2^15, r=8, p=1）派生。口令错误表现为首块 tag 校验失败，报「口令错误或文件损坏」；任何中间块被篡改同样 tag 失败。

### D5 目标端协议

三个 destination 适配器实现同一接口（`put`/`get`/`list`/`del`/`probe`），HTTP 层注入 `fetch` 以便测试：

| 协议 | 实现 |
| --- | --- |
| `smb`（`fs`） | `node:fs` 直写 UNC/映射盘/挂载点路径；写 tmp + rename；`net use` 接线由插件路由层用 `child_process` 完成（先例：`DataRootSection` 的目录选择器直接 spawn PowerShell） |
| `webdav` | `fetch` + Basic auth；`PUT`/`GET`/`MKCOL`（405 视为已存在）/`PROPFIND Depth:1`（宽松解析 href/length/mtime）/`DELETE`；仅 Basic，不做 digest |
| `s3` | `aws4fetch` 签名；endpoint/region/bucket/prefix/path-style 可配（兼容 MinIO、OSS、COS）；`ListObjectsV2` 用宽松 XML 解析翻页；逐对象 `DELETE` |

`probe` = 探测远端目录可达 + 写删一个 `.probe` 文件。测试连接失败时报具体协议错误，不静默。

### D6 配置与凭据存储

非敏感配置（协议、地址、桶、用户名、远端目录、分组勾选、加密开关、定时、保留份数）存 `<projectRoot>/outputs/_backup_config.json`，按 radar 的原子写（tmp + rename）+ 串行 mutate 队列模式。敏感值（WebDAV 密码、S3 secret key、SMB 密码、加密口令）存 dsh-credentials 库（scope `easel-backup`，按字段 id 分记录），UI 永不回显、只报 has/has-not。配置校验 fail loud：缺地址、开了加密却缺口令、协议不支持，都在保存或执行时报错，不静默跳过。

### D7 引擎与并发

备份按组串行（进程内单队列），组内：收集条目 → 流式 zip（可选加密）→ 直接上传到正式 key（失败时尽力删除远端半截对象，恢复侧的 CRC 与 manifest 校验兜底截断）→ retention 清理。运行状态（组、阶段、文件数、字节数）驻内存，`GET status` 轮询；重复触发返回 409。staging 用 `<home>/cache/backup-staging/`（cache 本身可弃，不参与备份）。

### D8 恢复

远端列组、列份 → 下载 zip →（解密容器）→ 按 manifest 与 central directory 校验 → 解到 staging → 生成计划（将覆盖的文件数、字节数）→ 用户确认后逐文件 tmp + rename 原子覆盖 → 结果报告。`.credentials.yaml` 恢复后在 POSIX 上强制 0600（credentials 库自身有重启后模式复查，双保险）。恢复会话文件后建议重启；不做单文件挑选恢复，整份覆盖。

### D9 定时

`_backup_config.json` 存 `schedule: { mode: off|daily|weekly, at: HH:mm, weekday?: 0-6 }` 与 `lastRunAt`。插件启动与每 15 分钟 tick 一次：`mode != off` 且已越过最近一次应触发时刻且未在运行 → 补跑勾选组一次。到期计算为纯函数，单独测试。

### D10 UI

`settings.section` 新区块 id `easel-backup`、order 70（避让 data-root 40 / handoff 60），组件 `BackupSection.tsx`，文案进 `src/locales/backup.ts`（zh/en 成对）。卡片沿用设置页设计语言（参照 data-root / handoff 的 house 卡片样式）：目标端卡（协议下拉 + 动态字段 + 测试连接）、备份内容卡（三组勾选 + 量级提示）、加密卡（开关 + 口令 + 警示）、定时卡、立即备份（分组按钮 + 进度 + 最近历史）、恢复卡（选组选份 → 预览 → 确认覆盖）。

### D11 插件与包形态

新建工作区包 `packages/backup/easel-backup`（`@deepseek-ai/dsh-easel-backup`，private）：`types` / `archive` / `crypto` / `destinations(fs|webdav|s3)` / `engine` / `restore` / `schedule` 纯库，依赖 `fflate` 与 `aws4fetch`；进入 `apps/cli/package.json` 的部署闭包（lan-handoff 先例），运行时经 `home/node_modules` junction 解析。`dsh-plugin-easel` 侧：备份做成与 automation 同款的独立子入口 `./backup`（`lib/backup.js`，export name/inject/apply），setup.rs 增加一行 `easel-backup` row——核心 index.js 不动，故障隔离与 automation 一致；路由经 `easelApi` registry 挂载，凭据走注入的 `credentials` 服务，引擎按需动态 import（缺失时报可操作的错误）。客户端 `src/features/backup.tsx` + `src/locales/backup.ts` 由现有 client bundle 带出。

### D12 版本与同步

`dsh-plugin-easel` 0.2.16 → 0.2.20（跳过 radar 0.2.17 与 lan-handoff 0.2.19 的占位，避免兄弟分支合并冲突）；跑 `scripts/sync-easel-bundle.mjs` 同步 `dsh/` 镜像；`tauri.conf.json` 本次不动。

### D13 已知上限

全量 zip 非增量（增量镜像需要各协议列举 + 差分引擎，列为后续升级路径）；WebDAV 仅 Basic 认证；SMB 依赖系统侧已可达（不实现 SMB 协议帧）；S3 列举用宽松 XML 解析；恢复为整份覆盖不做文件挑选；直连不走路由代理。

### 风险登记

- 运行时依赖解析在 mac 打包形态（非 junction 结构）待实机验证，acceptance 保留一条实机项。
- 主检出有未提交的 mac/data-root 改动，将来与本分支合并时 `index.js`/`client.tsx` 可能有文本冲突（均为 registrations/effects 追加，冲突可机械解）。
- `packages/backup/*` 受 100% 覆盖率门约束，测试随实现同 PR 补齐。

## [S3] Scope

- In scope：备份引擎与三协议目标端、加密容器、保留策略、定时与补跑、恢复（整份覆盖）、设置页 UI 区块与双语文案、插件路由与凭据接线、单测与覆盖率、包 README、spec 文档。
- Out of scope：增量镜像、WebDAV digest、SMB 原生协议栈、单文件挑选恢复、多目标端并存（单激活目标）、恢复到任意历史点的时间线视图、Web/移动端。

## Tasks

- [x] T1: 包骨架 `packages/backup/easel-backup`（package.json/tsconfig/README/types）+ `apps/cli` 闭包接线（depends: none）
- [x] T2: archive 模块：条目收集与排除、fflate 流式 zip、manifest（depends: T1）
- [x] T3: crypto 模块：scrypt + 分块 AES-256-GCM 容器加解密（depends: T1）
- [x] T4: destinations：fs / webdav / s3 适配器（depends: T1）
- [x] T5: 备份引擎：分组→zip→（加密）→上传→retention→history 串行队列（depends: T2, T3, T4）
- [x] T6: 恢复引擎：列份、下载、校验、计划、原子覆盖（depends: T5）
- [x] T7: 定时纯函数与补跑判定（depends: T5）
- [x] T8: easel 插件 `/easel/api/backup/*` 路由 + credentials 接线 + 插件测试（depends: T5, T6, T7）
- [x] T9: 客户端 `BackupSection.tsx` + `src/locales/backup.ts`（depends: T8）
- [x] T10: 版本 bump、sync-easel-bundle、AGENTS.md 分组行、全门禁（depends: T9）

## [S4] Acceptance

- [ ] `config`/`sessions`/`workspace` 三组备份产物在本地目录目标端 round-trip 后与源文件逐字节一致，manifest 计数正确，`node_modules`/junction/cache/storages/logs/tmp 全部被排除。
- [x] WebDAV 适配器对 mock 服务端的 `PUT`/`MKCOL`/`PROPFIND`/`DELETE` 请求行、Basic 头、状态码处理符合 D5。
- [x] S3 适配器对 mock endpoint 发出的请求带 SigV4 `Authorization` 头，path-style 开关改变 URL 形态，列举翻页正确。
- [x] 加密开启时无口令不可读、错口令报「口令错误或文件损坏」、单块篡改被检测；关闭时产物即纯 zip。
- [x] retention 超出保留数后旧份被删除，最近 N 份完好。
- [x] 恢复流程在不确认时只出计划不改盘，确认后覆盖结果正确且 `.credentials.yaml` 恢复为 0600。
- [x] 定时补跑：`lastRunAt` 落后于应触发时刻时 tick 触发一次且运行中不重入。
- [x] 插件路由：配置校验 fail loud、secrets 不回显、运行中重入 409。
- [x] `pnpm run test`（新包 100% 覆盖率）、插件 `node --test`、`pnpm run typecheck`、lint、`pnpm run doc-sync` 全绿。
- [ ] （实机项，不阻塞合并）mac/Windows 打包形态下设置页可见、备份到真实 WebDAV/SMB 成功。
