---
feature: easel-lan-handoff
status: in-progress
updated: 2026-10-21
branch: feat/easel-lan-handoff（dsh worktree）
commits: # filled at delivery
---

# LAN 项目交接：跨设备互传项目与会话，agent 正确续作

## Report

工作区：`.worktrees/easel-lan-handoff`（基线 2926be2078d）。T1–T7b、T8a 已交付（见任务勾选）。已过门：全仓 typecheck 5/5、lan-handoff+导入包 125 测试、easel 插件 104 测试、oxlint 0、hygiene、export JSDoc（自有违规已修，余 3 条为基线）、客户端 i18n、jscpd 0 clone、build:artifacts+build:check、两包覆盖率 100%、cargo check（壳激活行）、双语配对。基线既有失败（两侧同集合，与本改动无关）：doc-quick 的 markdown links / type equivalence / 语料级 translation pairing / markdown wrap / repository references，verify-cordis-config 的 acp profile 非 Loader 数组，export-jsdoc 3 条客户端包违规。未做：快照与 e2e（需要出货 profile 行）、真机双端验收（Windows 防火墙首包）。 已过门：全仓 `pnpm run typecheck` 5/5、lan-handoff+导入包 125 测试、easel 插件 104 测试、oxlint 0 告警、`build:artifacts`+`build:check` 绿、两包覆盖率 100%、双语配对校验。 未过门/未做：快照与 e2e（需出货 profile 行）、真机双端验收（Windows 防火墙首包）。`verify-cordis-config` 在基线检出上即失败（PRE-EXISTING：apps/cli/tests/profiles/acp/cordis.yml 非 Loader 数组），与本次改动无关。

## [S1] Problem

Easel 用户在两台设备（Windows 与 macOS）上做同一份内容创作项目：立项工作区（项目文件树）+ 若干 agent 会话。换设备继续干目前只能手工拷文件——会话上下文（todo/plan/goal、子代理谱系、附件）全部 丢失，agent 无法接着干。需要一个插件：局域网内把「项目文件 + 会话」从一台设备传到另一台，接收端 导入后 agent 能正确续作。

## [S2] Design

### 已拍板的决策（compose-next Grill 四轴，均取仓内证据支撑的推荐项）

1. **传输形态：一次性项目交接（push）**，不做常驻双向同步。KwikPaste 的本机序号/代次/水位线/分页 补齐状态机是为「高频小剪贴板记录持续双向同步」设计的；项目交接是低频大块数据，那套机器全部砍掉， 换成清单驱动的一次性传输 + 按文件 sha256 断点续传。
2. **信任与加密：设备密钥 + 自签 TLS 1.3 + SAS 屏幕对码**。每台设备首次生成持久身份密钥（`node:crypto` 内建，独占创建写 `$DSH_HOME`，写法同 `.anonymous-user-id` 的先例），自签证书承载 TLS 1.3——加密、 完整性、前向安全全是 stdlib。配对 = 发起方选设备后，两边屏幕各显示同一段短校验码（SAS = 双方证书 公钥与双方随机 nonce 的 SHA-256 摘要截断），用户比对一致后点确认，设备入对端持久配对表。不引入 SPAKE2/Noise：TS 生态无维护良好的实现，手写加密协议违背仓规；TLS-PSK 六位码方案因可离线爆破被否。
3. **发现：mDNS 自动 + 手动输 IP 兜底**。新增唯一外部依赖 `bonjour-service`（纯 JS、维护中的 bonjour fork）；服务类型 `_easel-handoff._tcp.local.`，实例名 = 设备 id（身份公钥 SHA-256 前 20 位 hex）， TXT 只带 `id`/`name`/`pf`/`v`/`vmin`（同 KwikPaste 的克制：不放任何密钥或内容）。监听端口 OS 分配。
4. **落点：dsh 新包 + Easel 挂 UI**。协议与服务进 `packages/transfer/lan-handoff`（`@deepseek-ai/dsh-lan-handoff`），能力独立可测；UI 挂 Easel 插件（设备列表/发送/接收页，路由沿用其 `webServer.register` 既有模式，文案走 locale 词典）。包进 `apps/cli` 依赖闭包（pnpm deploy 随 Tauri runtime 走），**激活行由 Easel 壳写入 profile**（同 easel 插件的 shell patch 行模式），避免给所有 dsh web 用户默认开局域网监听。

### 协议（帧形借鉴 KwikPaste §4，去 Noise 分块层）

- TLS 之上：`u32` 大端 JSON 头长度（上限 4 MiB）+ JSON 头（UTF-8）+ 二进制负载。
- 消息：`hello`/`device`、`offer{manifest}`、`accept`、`fileChunk{path,offset}`、`done`、`reject{reason}`、 `ping`。兼容规则同 KwikPaste §8：未知消息类型跳过不断连，未知字段忽略。
- 传输单元 bundle = manifest（JSON：工作区标题、来源路径、文件清单 `[path, size, sha256]`、会话导出 清单）+ 项目文件树逐文件流式（每文件按 offset 分块 + sha256，重连后接收端报告已完成文件、发送端跳过）+ 每会话一个 `session-log-export` ZIP（既有服务产出，作为不透明文件条目传输）。
- 发送端装配前先过 SessionStore durability barrier（`flushLiveSessionLog` 同款）确保日志完整落盘。

### 项目目录完整性检测（三方对账）

- **打包 pre-flight**：发送端对项目根先 `fs.realpath` 再真实递归遍历，逐文件试读——任何不可读文件 （锁定、ACL、权限）中止交接并显式报错，**不静默跳过**（防锁定文件漏传出不完整 bundle）；manifest 登记完整遍历结果（每文件 path/size/sha256）并附树级摘要（文件数、总字节、全文件 sha256 聚合 hash）。
- **导入对账**：接收端文件树落盘后重 walk 与 manifest 对账——文件数、逐文件 sha256、总字节全部一致才 视为交接成功；不一致拒绝导入、清理半成品目录并显式报错（fail loud）。
- **顺序保证**：会话物化与工作区创建排在对账通过之后——项目先完整，会话才挂靠。
- 检测对象是磁盘树本身，不解析文档内的引用形式（相对/绝对均无需识别）：凡在项目树内的文件必然被 遍历与校验覆盖。

### 会话续作（成败点：cwd 重映射）

1. **新包 `packages/session-query/session-log-import`**：`import(archive, { targetCwd })` 读 export ZIP 的规范 JSONL，把 `header.cwd` 重映射为本机项目路径，物化为当前 `SESSION_FORMAT_VERSION`（v4）的**新代文件**，目录按新 cwd 的 `projectKey` 键控落盘；不触碰任何已提交代，不升格式版本；子代理谱系会话同样重映射。附件经 attachment-local 自身的 store API 按内容寻址入库（不照搬 ZIP 内目录布局）。
2. 目标会话 id 在本机已存在时**拒绝并显式报错**（fail loud），不做静默改名。
3. 导入完成后显式 `WorkspaceRegistry.create(新路径, manifest 标题)` + 逐会话 `attachSession`——**不依赖 bootstrap**（bootstrap 仅注册表首次打开时运行，用过的设备不会重跑）。
4. 设备本地状态**不传**：settings、credentials、skills 留在本机。

### 风险登记

- Windows 防火墙首包提示（node.exe 监听局域网口）：打包交付时验证壳是否需要声明防火墙规则。
- mDNS 被路由器拦组播/跨网段：手动输 IP 兜底已在设计内。
- 大项目（素材媒体）传输时长：分块 + 断点续传覆盖，不做压缩加速（zstd 已是会话存储默认，文件树原样传）。

## [S3] Scope

- In scope:
  - `dsh-lan-handoff` 服务包：设备身份密钥、自签 TLS、mDNS + 手动发现、SAS 配对、bundle 传输协议、断点续传。
  - `session-log-import` 导入包：cwd 重映射物化、附件入库、会话 id 冲突拒绝。
  - 发送端装配：工作区 → durability flush → 逐会话 export → 项目文件树 → manifest + 打包 pre-flight。
  - 导入端装配 + 项目目录三方对账 + `WorkspaceRegistry` 建区挂靠。
  - Easel UI：设备列表、发送（选工作区）、接收确认（SAS 校验码展示/比对、导入进度）。
  - 回环自动化测试 + 导入续作场景的快照覆盖（含快照 harness 支持同变更交付）。
- Out of scope:
  - 常驻双向同步/水位线/增量补齐。
  - 云中转、跨网（非 LAN）传输。
  - settings/credentials/skills 同步。
  - agent 侧 `handoff` 工具（让 agent 自己推项目，v2 再说）。
  - 签名/公证分发面（沿用现有打包链）。

## Tasks

- [x] T1: `dsh-lan-handoff` 包骨架：设备身份密钥 + 自签证书 + TLS 监听（OS 端口）+ mDNS 广播/浏览 （bonjour-service）+ 手动地址（commit 171150431a；apps/cli 依赖与壳激活行仍待接）
- [x] T2: 配对协议 + peers 持久化 + SAS 确认回调面（commit d0c9132f42）
- [x] T3: bundle 传输协议：manifest/文件块/sha256/断点续传/未知消息跳过（commit e49cd6c903）
- [x] T4: `session-log-import`：cwd 重映射物化 + 附件入库 + 会话 id 冲突拒绝（commit 1e0455660c）
- [x] T5: 发送端装配（pre-flight 递归遍历 → flush barrier → 逐会话 export → 文件树 → manifest + 树级摘要） （commit 54751d5ba5）
- [x] T6: 导入端装配 + 接收树三方对账 + `WorkspaceRegistry` 建区挂靠（commit 54751d5ba5）
- [x] T7a: Easel 宿主路由（status/pair/accept/reject/send，经 `ctx.get('lanHandoff')` 转发）（commit 42cf53dc23）
- [x] T7b: Easel 客户端页面（设置项形式）：设备/已配对/附近设备/对码确认/发送 全部在 `settings.general.item`， locale 词典随插件注册；`client.js` 已重建
- [x] T8a: 打包激活接线（`apps/cli` 依赖 + 壳 patch 行带 `handoffDirectory`）+ `build:artifacts`/`build:check` + 两包覆盖率 100%（lines/branches/functions/statements）
- [ ] T8b: 快照/e2e（录制会话回放需先有出货 profile 行）+ 真机双端验收（含 Windows 防火墙首包）

## [S4] Acceptance

- [ ] 回环端到端：设备 A 发送某立项工作区（≥2 会话，含子代理与附件）→ 设备 B（独立 `$DSH_HOME`）导入成功， 项目文件齐全。
- [ ] 打包 pre-flight：项目树内存在不可读文件时中止交接并显式报错，不产出缺文件 bundle（单测）。
- [ ] 导入对账：接收树与 manifest 的文件数/逐文件 sha256/总字节任一不符时拒绝导入、清理半成品并报错 （单测）。
- [ ] 导入后 `header.cwd` = 本机新路径，会话目录按新 cwd 的 projectKey 键控落盘；`WorkspaceRegistry` 出现 新工作区并挂靠全部导入会话。
- [ ] 设备 B 打开导入会话并续跑一个任务，agent 可见此前的 todo/plan 状态（事件在场）。
- [ ] 断点续传：传输中断后重连，已完成文件跳过（单测）。
- [ ] 未配对设备连接被拒；SAS 不匹配无法完成配对（回环单测）。
- [ ] manifest/归档中的路径穿越（`..`、绝对路径逃逸项目根）被拒绝（单测）。
- [ ] 会话 id 冲突时导入拒绝并给出可操作报错（单测）。
- [ ] mDNS TXT 不含密钥或内容；监听端口 OS 分配（单测）。
- [ ] 收到未知消息类型不断连（单测）。
