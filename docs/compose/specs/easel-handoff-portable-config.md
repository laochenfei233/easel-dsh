---
feature: easel-handoff-portable-config
status: delivered
updated: 2026-11-10
branch: fix/easel-handoff-portable（worktree）
commits: f19dc2f9b0
---

# 隔空传送：大模型配置随包迁移与路径改写

## Report

**What was built** — 「配置项」勾选现在除了 `.env`、画像、技能，还带上一份可移植的模型配置文档：发送端从 settings 服务读出 `llm-pi-ai`、`llm-deepseek`、`agent-default-model` 三个命名空间的**用户层**，并按 provider 的 `apiKeyEnv`（缺省按 provider 名派生）从凭据服务解析出明文密钥；接收端把设置写进自己的 profile 配置层、密钥写进自己的凭据库，而不是用发送端的文件覆盖。同时，导入的会话日志里发送端的项目目录、数据根与 home 目录会被改写成本机对应路径（包含 Windows 路径存放在 JSON 参数字符串里的转义写法，以及 Windows→POSIX 的分隔符归一化）。传输协议升到 v3，旧版对端会被标记为不兼容。

**Verification** — `packages/transfer/lan-handoff` 与 `packages/session-query/session-log-import` 共 199 通过 / 2 跳过（跳过的两条是绑定不存在主机名的监听回退用例，本机 DNS 超时导致，master 上同样不稳定）；两个包的 per-file 覆盖率除 `index.ts` 既有并发接收分支（master 基线 98.93%）与上述被跳过的 `listener.ts` 外全部 100%；全仓 typecheck 5/5；插件 `node --test test/handoff.test.js` 20/20。

**Journey log** — (1) 用户先反馈「大模型配置还是没传输过去」：原「配置项」载荷只装 `.env`/画像/技能，模型设置躺在 `<home>/profiles/web/cordis.patch.yml` 的 `llm-pi-ai`、`agent-default-model` 行、密钥躺在 `<home>/.credentials.yaml` 的 `refs` 里，两者都不在载荷内。(2) 直接把配置文件和凭据文件当 data 条目发送会覆盖接收端的本机路径行与机器级 grant，所以改为一份 JSON 文档 + 接收端服务接缝应用。(3) 会话日志的事件里带着发送端绝对路径（工具参数是 JSON 字符串，Windows 反斜杠是转义的 `\\`），只改 header cwd 会让续作会话继续指向 `C:\...`；在导入阶段按「项目/数据根/home」三对根做前缀改写，并处理转义与分隔符。(4) 协议新增 `config` 条目与 `sourceRoots` 清单字段，v2 对端无法解释，协议代际统一升到 v3。

## [S1] Problem

Windows → macOS 发送项目时，项目、会话、`.env`、画像和技能都能过去，但 Mac 的「设置 → 模型」仍然空白：模型列表、默认模型和 API Key 都要在 Mac 上重新配置。同时，带过去的会话虽然能打开，历史里的工具调用仍写着 `C:\Users\...` 的绝对路径，续作时模型会按旧路径找文件，对话因此出现「找不到文件」类问题。

## [S2] Design

配置迁移不走文件拷贝：发送端 `collectModelConfigDocument` 读 settings 服务的 `describe()`（只取 `user` 层，避免把继承的出厂默认值钉到对方 profile），再按 provider 的 `apiKeyEnv` 与默认的 `DEEPSEEK_API_KEY` 从 credentials 服务解析明文；文档形如 `{version:1, settings:{ns:patch}, credentials:{ref:value}}`，作为 `config` 条目随包发送。接收端在发布项目之前调用 `applyModelConfigDocuments`：`settings.update(ns, patch)` 写进对方 profile 补丁（provider 字段按命名空间合并），`credentials.set(ref, value)` 写进对方凭据库；设置或凭据服务缺失、文档版本不符、写回失败都整包拒绝且不发布项目，发送端可修复后重试。

路径改写发生在会话导入：清单新增可选的 `sourceRoots: {data, home}`（项目根沿用既有 `sourceCwd`），接收端把它们分别映射到已接收项目目录、自己的 `dataDirectory` 与 `homeDirectory`（默认 `$DSH_HOME`），交给 `importArchive` 的 `pathRemaps`。改写只动字符串值，按最长来源优先；Windows 来源大小写不敏感，同时匹配反斜杠与正斜杠两种写法，以及 JSON 字符串里的 `\\` 转义写法；目标为 POSIX 时把该路径区域的分隔符归一化为 `/`，不触碰后面的普通文本。

`.env`、画像、技能、内容库仍走既有 data 条目，落位规则不变：项目 → `projects/<标题>`，内容库 → `<data root>/outputs/`，配置 → `<data root>/...`，会话 → `<home>/sessions/`，模型配置 → `<home>/profiles/<profile>/cordis.patch.yml` 与 `<home>/.credentials.yaml`。

## [S3] Scope

- In scope: `packages/transfer/lan-handoff`（清单、转发、接收应用、协议代际）、`packages/session-query/session-log-import`（路径改写）、`easel/dsh-plugin-easel`（配置文档装配与文案）。
- Out of scope: 凭据存储格式、settings 服务的写入语义、模型 provider 的 schema、Mac Intel 原生插件打包缺陷（另行处理）。

## Tasks

- [x] T1: 清单新增 `config` 条目与 `sourceRoots`，协议升 v3（depends: none）
- [x] T2: 发送端装配模型配置文档，接收端按 settings/credentials 接缝应用（depends: T1）
- [x] T3: 会话导入按根前缀改写事件内绝对路径，含转义与分隔符（depends: T1）
- [x] T4: 两侧服务接线与插图文案（depends: T2, T3）
- [x] T5: 单测、覆盖率与全仓 typecheck（depends: T2, T3）

## [S4] Acceptance

- [x] 「配置项」勾选后，接收端收到 `model-config.json` 并调用 `settings.update` / `credentials.set`（插件与 service 测试）
- [x] 缺少配置接缝或写回被拒时整包失败，项目不发布、暂存清理（handoff 测试）
- [x] 会话事件内的 Windows 路径在 Mac 侧变成 POSIX 路径，含 JSON 参数转义与兄弟目录不误改（path-remap 与 import 测试）
- [x] 快速推送拒绝携带配置文档（manifest 校验测试）
- [x] v2 对端被标记为不兼容（协议测试）
