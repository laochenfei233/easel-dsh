---
feature: easel-handoff-payload
status: delivered
updated: 2026-10-24
branch: feat/easel-handoff-payload
commits: a4a7cfefdc..7a03c82d01
---

# LAN 交接载荷选择：配置项/素材库可推送 + 右键快速推送

## Report

**What was built** — LAN 交接的发送从固定载荷改为可勾选：会话（默认开）、项目 `素材/`（默认开，可排除大媒体）、内容库 `outputs/`（默认关）与配置项 `.env`+画像+技能（默认关，含密钥）。新增 wire 类别 `data`（按接收端数据根寻址），接收端在项目落位后把数据条目写入 `dataDirectory`：`.env` 逐行合并（保留本机未提及行与 key），画像/技能/内容库按路径覆盖写入；未配置 `dataDirectory` 时整包拒绝并把理由回传发送端。`.env` 永不随项目树行走。右键菜单的文件面（文件树行/交付卡片/文件提及）新增「推送到设备…」：菜单原位列出已配对设备，选中后走新路由 `/handoff/push` 装配**无会话**的快推 bundle（`mergeIntoExisting`），接收端并入同名的既有目录（同名覆盖）或新建目录，不注册工作区；轻提示回执成功/失败。项目整包交接行为不变（目标已存在仍拒绝）。壳激活行补 `dataDirectory`（含老安装的补写）。

**Verification** — 全仓 `pnpm run typecheck` 5/5；`packages/transfer/lan-handoff` vitest 126/126 + `packages/session-query/session-log-import` 全绿，两包 v8 覆盖率 100%（lines/branches/functions/statements）；`easel/dsh-plugin-easel` node --test 146/146；`pnpm run build:artifacts` + `build:check` 绿；`cargo check -p easel-desktop` 绿；oxlint staged 配置 0 告警（全仓 lint 与 doc-sync 的失败集合与 master 基线完全一致，为 PRE-EXISTING：包内 41 条 type-aware 违规与 doc 门 11+2 项在改动前后同集合）；jscpd 0 clone；verify-client-ui-i18n 绿；config/plugin-packages/tsconfig-paths 三个目录生成器已再生成并提交。

**Journey log** —
- 接收端 `serveSync` 无条件要求 `sessionLogImporter`：快推（无会话）也必须挂该服务才能收包，测试端双设备回环初版因缺 importer 被「拒配对」表象误导（实际是 serveSync 抛错毁连）。坑在错误信息与现象的距离。
- `mergeEnvText` 的空行语义：替换已有 key 不加空行，仅**新追加**的 key 在非空行后补一空行；空文件/无尾换行/CRLF 各有边界，全部需要用例钉住。
- esbuild 对非 ASCII 默认转义（`charset` 未设 ascii 时按 target 决定）：client.js 里中文以 `\uXXXX` 存在，bundle 断言只能匹配 ASCII 符号名。
- vitest 根配置 include 以仓根为基准：包目录下 `npx vitest run` 找不到用例，必须从仓根跑并带包路径过滤。
- 覆盖率 100% 门下，防御性 `?? ''`/`instanceof` 重抛这类「TS 不知道但运行时不可达」的分支比手写 v8 ignore 更好的解法往往是改写成所有分支都可达（如 `out.at(-1)` 换成显式 `lastLine !== undefined`）。

## [S1] Problem

LAN 交接（easel-lan-handoff）目前是固定载荷：选中工作区 → 整棵项目树 + 全部已挂会话。用户无法表达「不带大媒体素材」「把模型 key / 画像 / 技能也搬过去」「只把这一个文件推到另一台设备」。换机续作场景里，接收端缺 .env（模型 key）就不能继续生成；大素材拖慢传输；零散文件走整个项目交接又太重。

## [S2] Design

### Grill 已确认（2026-10-24）

- **素材库 = 两者都要**：① 项目工作区内的 `素材/` 子目录可勾选排除（默认随项目传，取消勾选跳过大媒体）；② `outputs/` 内容库作为独立可选类别整体推送。
- **配置项 = .env + 画像 + 技能**：项目根 `.env`（按既有 `ENV_ALLOWLIST` 白名单过滤后才上包）+ `profiles/` 画像 + `skills/openclaw/` 技能。

### 载荷模型

发送表单（设置 → 局域网交接 → 发送项目）在选择工作区与设备之外，增加四个勾选：

| 勾选 | 默认 | 载荷 |
| --- | --- | --- |
| 会话（agent 续作上下文） | ✅ | 已挂工作区的全部会话导出 ZIP（现状行为，改为可关） |
| 项目素材（素材/） | ✅ | 项目树里的 `素材/` 顶层子树；不勾=从项目树中排除 |
| 内容库（outputs/） | ❌ | 数据根 `outputs/` 下可见内容（跳过 `.`/`_` 前缀与 `analytics/`，与内容库页可见性同规则） |
| 配置项（.env / 画像 / 技能，含密钥） | ❌ | `.env`（白名单过滤）+ `profiles/<有效画像>/**` + `skills/openclaw/**` |

- **`.env` 永不随项目树行走**：项目树一律排除数据根的顶层 `.env`；它只经「配置项」数据类别显式传输（含密钥，默认不勾）。
- 数据类别在 wire 上是新 manifest 条目类别 **`data`**，路径相对**接收端数据根**（`.env`、`profiles/<name>/*.md`、`skills/openclaw/**`、`outputs/<proj>/**`）。
- 旧对端收到带 `data` 条目的 bundle 会在 manifest 校验处显式拒绝（协议报错，不会误读）；收发两端同包发布。

### 接收端落位

- 服务新增配置 `dataDirectory`（默认空 = 未配置数据根）。Easel 壳激活行写入数据根路径。
- `data` 条目先暂存到独立 staging 根；项目重命名落位后、会话导入前逐条写入数据根（数据落位不依赖会话；会话导入失败时项目与配置已就绪，重试导入即可）：
  - `.env` **合并**：保留本机已有其它行与未提及 key，仅更新/追加来包中的 key（空值跳过）——与既有写 .env 路由同语义；
  - `profiles/`、`skills/`、`outputs/` 按路径覆盖写入（内容寻址校验已在逐条入站时做过）。
- manifest 带 `data` 条目但本机未配置 `dataDirectory` → decideOffer 显式拒绝（fail loud，理由回传发送端）。
- 数据落位失败报 `HandoffReceiveError('data')`；已落位的项目文件保留（与会话导入失败同策略）。

### 右键快速推送（easel-context-menu）

- 文件面（文件树行、交付卡片、内联文件提及）菜单末尾新增 **「推送到设备…」**：点开后菜单原位渲染已配对设备列表（取 `/easel/api/handoff/status` 的 `paired`），无已配对设备显示禁用行；「返回」恢复原菜单行。
- 点设备 → `POST /easel/api/handoff/push { peerId, path }` → 完成后关闭菜单并弹一次性轻提示（成功/失败，自动消失）。
- 宿主装配：路径落到最长前缀的已注册工作区 → 相对路径保留、项目标题=工作区标题；不在任何工作区 → 标题=文件/文件夹名。目录整体入包（保留内部结构），单文件按上述相对路径入包。
- 快推 bundle：**无会话、无数据类别**，manifest 带 `mergeIntoExisting: true`：
  - 接收端目标目录已存在 → **合并模式**：逐文件复制进现有目录（同名覆盖），跳过整树对账（逐条 sha256 + 全条目到场校验仍生效），跳过工作区注册；
  - 不存在 → 正常落位新建目录，同样不注册工作区（无会话即不注册）；
  - 校验规则：`mergeIntoExisting` 的 manifest 携带 `session` 条目 → 协议拒绝。
- 非快推（正常项目交接）行为完全不变：目标已存在仍然拒绝。

### 服务接口

- `sendProjectToPeer(peerId, workspacePath, options?)` 增加选项：`sessions?: boolean`（默认 true）、`exclude?: readonly string[]`（项目树内顶层排除前缀，宿主传 `['.env']` 与按需的 `'素材'`）、`dataFiles?: readonly DataFile[]`（`{ path, absolutePath }` 或 `{ path, bytes }`，path 相对接收端数据根）。
- 新增 `sendFilesToPeer(peerId, { projectTitle, files: readonly { absolutePath, relativePath }[] }, options?)`：快推装配，走同一 bundle 通道。
- `prepareBundle` 拆出 `bundleFromFiles`（显式文件集 + 会话归档 → manifest + sources），项目树遍历只是它的一个生产者。

### 风险登记

- 无会话的接收一律不注册工作区：快推如此，**整包交接但取消会话勾选（或工作区本就无挂靠会话）也如此**——侧栏要等该目录挂上会话后才可见。记录为已知限制（包 README 同步）。
- 数据根 `.env` 合并无白名单（白名单在发送端过滤）；配对设备本就可写 projects/ 下任意文件，威胁模型不变。
- `主项目`（数据根本身作为工作区）整树推送仍会带上 `profiles/`、`skills/`、`outputs/`（含 `_login` 登录态）——现状行为，本次不扩scope 改它；「配置项」是白名单式的安全替代。

## [S3] Scope

- In scope:
  - `dsh-lan-handoff`：`data` 条目类别、`mergeIntoExisting`、`dataDirectory` 配置与落位、`.env` 合并、`sendProjectToPeer` 选项、`sendFilesToPeer`、会话less 收包不注册工作区。
  - Easel 壳激活行：handoff 行补 `dataDirectory`。
  - Easel 宿主路由：`/handoff/send` 载荷装配（白名单过滤 .env、画像/技能/内容库遍历）、`/handoff/push` 快推。
  - Easel 客户端：发送表单四个勾选（双语文案）、右键「推送到设备…」+ 设备子列表 + 轻提示；`client.js` 重建。
  - 单测覆盖以上全部行为分支。
- Out of scope:
  - 快照/e2e 与真机双端验收（沿 T8b，用户侧）。
  - 接收端收包进度 UI、推送历史。
  - agent 侧 handoff 工具。
  - `主项目` 整树推送的 `_login` 排除（见风险登记）。

## Tasks

- [x] T1: 传输协议 `data` 类别 + `mergeIntoExisting` 校验（kind 字面量五处、类型、单测）
- [x] T2: `handoff.ts`：`bundleFromFiles` 拆分、数据 staging 根与落位（.env 合并）、合并模式收包（全条目到场校验）
- [x] T3: 服务：`sendProjectToPeer` 选项、`sendFilesToPeer`、`Config.dataDirectory`、serveSync 传参 + 会话less 不注册；壳 setup.rs 激活行补 `dataDirectory`
- [x] T4: easel 宿主：`/handoff/send` 载荷装配（`.env` 白名单、画像/技能/内容库遍历）、`/handoff/push`
- [x] T5: easel 客户端：设置页勾选 + 文案、context-menu 推送设备子列表 + 轻提示、`client.js` 重建、双语配对
- [x] T6: 验证（typecheck / 两包测试+覆盖率 / 插件测试 / build:artifacts+build:check）+ 评审 + spec 定稿

## [S4] Acceptance

- [ ] 勾选全默认：行为与现状一致（整树 + 全部会话；`.env` 不在树里本来也只在主项目场景出现，此处树里不含数据根 `.env`）。
- [ ] 取消「项目素材」→ bundle 无 `素材/` 条目；勾选「内容库」/「配置项」→ bundle 出现对应 `data` 条目（单测/回环）。
- [ ] `.env` 上包内容仅含白名单 key；空值与占位符值不上包（单测）。
- [ ] 接收端：`data` 条目落到数据根；`.env` 合并保留本机已有未提及行；未配置 `dataDirectory` 时整包被拒且理由回传（单测）。
- [ ] 快推单文件/目录：接收端已存在同名项目目录 → 文件并入（原文件被同名覆盖），工作区注册不新增；不存在 → 新建目录；`mergeIntoExisting` 携带 session 条目被拒（单测）。
- [ ] 正常项目交接目标已存在仍拒绝（回归）。
- [ ] 右键文件面出现「推送到设备…」；无已配对设备时禁用；推送成功/失败有轻提示（插件测试断言菜单行与路由）。
- [ ] 断点续传、路径穿越拒绝、未配对拒绝等既有行为回归不破（既有测试继续绿）。
