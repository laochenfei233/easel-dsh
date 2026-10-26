---
feature: easel-multi-account
status: delivered
updated: 2026-10-26
branch: feat/easel-multi-account
commits: 6f0a87a5ac..2468f679ab
---

# Easel 多账户（同平台多号 + 画像绑定 + 便捷推送）

## Report

**What was built** — 账户成为一等实体：`outputs/_accounts.json` 注册表（id/平台/名字/画像/profileDir/cookieFile）承载同平台多账号，每个账号独立浏览器 profile；存量登录态在首次加载时零拷贝注册为各平台「默认账号」，且默认账号 id 即平台 key，故 `_login/<platform>.json`、`_publish/<platform>.json` 不必迁移一份字节。七平台 runner 全部参数化（`--profile-dir` / `--cdp-endpoint` / B站 `--cookie-file`），登录/登出/whoami/发布/看板/拆解 cookie 导入按账号寻址，缺省回落默认账号。

登录与操作通道固化了 yingpin 项目验证过的直启办法：Node 侧直启真实 Chromium（Playwright 自带 → Chrome → Edge）带动态 CDP 端口与账号 user-data-dir，用户在可见窗口人工登录；实例开着时发布与校验经 `--cdp-endpoint` 附身同一窗口（可插手验证码/短信），实例不在则回落无头 persistent context，无人值守定时发布不受影响。登录模式收敛为 `qr` 与 `direct`，原 `cdp`（接管日常 Chrome）与 `manual`（Playwright 托管有头）下线。账号页支持添加/改名/绑画像/登出/删除与「打开登录窗口 + 校验登录态」；发布页按「平台 → 账号」多选分发（跨账号并发 2、同平台串行），逐账号状态与抖音短信墙按账号隔离；排期回写带 `accountId/accountName`，内容日历展示账号；技能执行、发布预检、拆解选题三处提示词注入账号名册，定时任务表单可选关联账号。

**Verification** — 插件 `node --test test/*.test.js`：**262 pass / 0 fail**（含读保护拒绝用例、异步发布端到端回写、直启标记恢复与 whoami 三分支、陈旧 id 严格拒绝），连跑三次稳定。7 个 runner 离线 selftest 全过（6×Python + `bili_login.mjs`，零浏览器零网络）。仓库 `pnpm run typecheck` 5/5 PASS（159s）。`node build.mjs` 重打包 client.js。`build:check` 未跑：`easel/` 不在 pnpm workspace、包内代码不被 apps/packages 引用，diff 零触碰 `packages/` 与 `apps/`，按影响面豁免。独立复审两轮：首轮 2 CRITICAL（抖音异步回写丢 account；whoami 覆写登录标记丢直启 port/pid）+ 1 pre-existing 阻断（`safeOutputPath` 未导出致带媒体发布全 500）；修复后复审逐条回退验证测试变红，裁决 SHIP。

**Journey log** — ① 设计期探索报告的 file:line 全来自落后 126 提交的旧检出，实现前必须在 worktree 重新定位，否则会改错位置。② 复现「测试绿、缺陷在」：新增的 `runPublishBg` 单测直接传第 8 参，绕过了生产调用点仍少传一参的事实；只有经 `apiPublish` 的端到端用例能锁住接线，且生产路径当时还被一个 base 就有的 `safeOutputPath` ReferenceError 挡着、从未真正执行过。③ 与 yingpin 一致的两条平台事实在此复现：Playwright 托管 profile 会被反爬拦、Firefox 调试端口是 WebDriver BiDi 而非 CDP（实测 `/json/version` 404），故支持面锁定 Chromium 系。④ 测试默认值必须隔离：注册表迁移探测会扫真实 home 的 legacy profile，用 `EASEL_BROWSER_PROFILES` 注入临时根才封闭。⑤ 生产者的「状态先写、排期后写」顺序会让 check-then-read 断言以约 1% 概率闪红，等各自落盘而不是等状态转发。


## [S1] Problem

Easel 的发布链路目前按「平台」寻址，每个平台只有一份登录态（`~/.easel-browser-profiles/<Platform>Profile` 的 Playwright 持久化 profile，B 站例外走根 `cookies.json`），重新登录即覆盖。做矩阵运营的用户在同一个平台有多个账号（如三个抖音号、两个小红书号），当前无法共存、无法命名、无法给每个号绑定不同的人设画像，也无法便捷地把内容分发到指定的一组账号。

画像（`profiles/<画像名>/` 六维 md）已是成熟实体，但它是全局单选，与「账号」没有机器可读的绑定关系。

## [S2] Design

核心决策：**不造新系统，给现有链路加一个「账户」维度**。账户 = 注册表条目 + 独立登录态目录；现有单账号在升级后零拷贝自动成为「默认账号」；所有登录/发布/看板/拆解消费点按账号寻址，缺省回落默认账号，未建多账号时行为与现状完全一致。

### 数据模型

- 注册表 `outputs/_accounts.json`（EASEL_HOME 下）：`{ version: 1, accounts: [...] }`。条目 `{ id, platform, name, persona, profileDir, createdAt }`：
  - `platform` ∈ 现有 `LOGIN_RUNNERS` 七平台 key（`easel/dsh-plugin-easel/index.js:1517-1526`）；`id` 为插件生成的稳定短 id；`name` 用户可改；`persona` 为画像目录名或 `null`（null = 通用模式）。
  - `profileDir` 为 `~/.easel-browser-profiles` 下的目录名（不透明引用，仅注册表解释它）。
  - B 站账号附加 `cookieFile`（相对 workspace 根）：默认账号 = 根 `cookies.json`（现状文件不动），新建账号 = `outputs/_accounts/<id>/cookies.json`，并加入 `PROTECTED_READ_FILES`（`index.js:222`）。
- 零拷贝迁移：加载注册表时若文件不存在，探测 legacy 迹象（各 `<Platform>Profile` 目录、根 `cookies.json`、`wechat-publisher.yaml` 凭证）自动注册为对应平台的「默认账号」（name = 平台中文名，persona = null），写回注册表；不移动不复制任何文件。
- 状态文件按账号：`outputs/_login/<id>.json`（二维码/日志/短信码同前缀）、`outputs/_publish/<id>.json`。默认账号 id 就是平台 key，所以 legacy 文件名天然就是默认账号的文件，**不需要改名迁移**；新账号各用自己的 id。

### 路由面（lib/plugins/automation.js + index.js）

- `GET /easel/api/accounts`：改从注册表返回条目 + 逐账号 loggedIn（探测逻辑沿用现状）；不再由 `LOGIN_RUNNERS` 生成固定行（`automation.js:31-44`）。
- 登录：`POST /easel/api/login/:p` body 增 `name`（登录即建新账号）或 `account`（重登已有账号）；登录成功确保条目存在。xhs 登录成功后的 cookie 自动导入（`AccountsPage.tsx:322-328` → `lib/plugins/deconstruct.js:132-161`）携带账号，从对应 profile dump。
- 新增 `PUT /easel/api/accounts/:id`（改名/绑画像/解绑；宿主路由表已有 PUT 先例）与 `DELETE /easel/api/accounts/:id`（= 登出 + 删条目 + 删 profile 目录与附属文件，复用 logout 清理逻辑）。显式 id 一律精确匹配：陈旧 id 返回 404，不静默回落到默认账号。
- `POST /easel/api/logout/:p`、`POST /api/publish/:p`、`GET /api/publish/:p/status`、`GET /api/analytics/:p`、whoami：body/query 增 `account`（id），缺省 = 该平台默认账号。解析收口在单点 `resolveAccount(platform, accountId)`；所有 spawn runner 的调用点把 profile 目录 / cookie 文件作为参数传下去。

### 登录与操作通道：账号直启 CDP 实例（固化 yingpin 办法）

来源：yingpin 项目实测沉淀（`yingpin/tools/launch_cdp.py` + `对话记录整理.md` 8-28/9-16/10-11 各节）：真实 Chrome 直启 + 独立持久化 profile + CDP 端口 + 可见窗口人工登录，自动化事后 `connect_over_cdp` 附身；BOSS 用 Playwright 托管 profile 会被反爬拦截 `Page.navigate`，小红书用干净 profile 触发 IP 风控（300012）、无头容器报「电脑设备登录超限」。该办法成为 Easel 账户的**手动登录与半自动操作标准通道**：

- **直启器**（automation.js 内实现，Node 直接拉起浏览器进程，不经 Python）：
  - 浏览器发现顺序：Playwright 自带 Chromium（`%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win*\chrome.exe`）→ 系统 Chrome → Edge（对齐 yingpin `CHROME_CANDIDATES`）。
  - 2026-10-26 本机实测：Chromium（chrome-win64 149）直启全流程通过——`/json/version` 200、`connect_over_cdp` 附身导航/取值正常、`navigator.webdriver=false`；Firefox（RunningCheese 版实测）`--remote-debugging-port` 起的是 WebDriver BiDi（`/json/version` 404，Playwright 报 "not a DevTools server"），不支持 CDP，Playwright 只能驱动其自带 patched 构建——**直启器支持面锁定 Chromium 系（Chromium/Chrome/Edge），Firefox 不做**。本机无独立 Edge 未实测 msedge.exe，但 Edge 为 Chromium 内核、Playwright 官方支持 `channel="msedge"`。
  - 启动参数：`--remote-debugging-port=<动态分配> --remote-allow-origins=* --user-data-dir=<账号 profileDir> --no-first-run --no-default-browser-check --no-sandbox --disable-dev-shm-usage`，带平台落地下页 URL；`detached` 启动并记录 pid，runner 退出不关窗。yingpin 的 GPU 系列 flag 是其本机权限问题的特解，不默认携带。
  - 幂等：启动前探测 `http://127.0.0.1:<port>/json/version`，已活即跳过（对齐 yingpin 行为）。端口由 OS 临时端口分配（避免手工向上扫描的竞态），运行态写入 `outputs/_login/<id>.json`（连同 pid）；注册表只存持久数据，不存运行态。Chrome 136+ 禁用默认 profile 的 CDP 端口，自定义 `--user-data-dir` 不受影响——本设计全部用自定义目录，天然合规。
- **登录流改造**：账号登录模式收敛为两种——`qr`（现状：runner 截码进 Easel UI）与 `direct`（直启可见窗口人工登录，成为 xhs/抖音等风控重的平台的推荐方式）。**原 `cdp` 模式（接管用户日常 Chrome 9222，`automation.js:297-324`）从账号登录入口移除**（单 Chrome 单登录态与多账户模型冲突，且混用用户日常指纹有风险）；热点雷达自己的 `cdpEndpoint` 配置独立、不动。
- **发布双模式**：runner 全系增 `--cdp-endpoint` 参数——目标账号实例在运行时 `connect_over_cdp` 附身该实例（复用现有页面操作流，用户可旁观、可随时插手验证码/短信/滑块，即「部分可操作」）；实例不在时回落现状 `launch_persistent_context` 无头模式（无人值守定时发布不受影响）。whoami/登录校验同理：实例在 → 附身实读昵称；不在 → 现状无头探测。
- **状态协议**：直启后 `_login/<id>.json` 写 `{state:"window-open", port, pid}`；用户在窗口完成登录后点 UI「校验」或发首次发布时附身确认，成功转 `logged-in`；窗口关闭端口消失，登录态保留在 profile 目录（下次无头复用）。

### Runner 舰队参数化

- Python：`xhs_publish.py`、`douyin_publish.py`、`web_publisher.py`、`account_stats.py`、`xhs_comment.py`、`weixin_mp_stats.py` 增 `--profile-dir`，默认值 = 现状路径（`~/.easel-browser-profiles/<Platform>Profile`），未传时行为不变。
- Node：`bili_login.mjs` 增 `--cookie-file`，默认根 `cookies.json`。

### 画像绑定与 agent 面

- 绑定存注册表 `persona` 字段；画像页/立项既有流程不动（立项快照语义不变）；`platforms.md` 里「各平台账号信息」小节保持人写文档语义，不参与绑定。
- 提示词名册：`src/lib/` 新增共享 builder，从 accounts API + status 组装「可用账号清单（名字/平台/画像名/profiles 路径）」，接入现有注入点：`SkillDrawer.tsx:74-78`、`PublishPage.tsx:152-154`、`BreakdownPage.tsx:211`。指引语：推送时明确账号；用户未指定时询问或按画像贴合度建议。名册为空时维持现状句子。
- 技能文档：`skill-*-publisher/upload` 的 SKILL.md 增账号参数说明（runner `--profile-dir`、host API `account` 字段）。
- 定时任务：`outputs/_schedule.json` 条目增可选 `accountId`（`index.js:1054-1059`）；`recordPublishedSchedule` 回写时填（`automation.js:659-677`）；easel 定时任务到期投递的 prompt 指名目标账号。

### 发布页

- 目标选择从「平台」改为「平台 → 账号」多选（跨平台组合）；分发 = 前端循环现有 `publishNow`，**跨账号并发（上限 2，同平台内仍串行）**：每账号一个独立浏览器实例/进程，并发互不干扰；同平台串行规避同 IP 密集风控放大。逐账号轮询状态。目标实例在运行时发布自动走附身模式，用户可在窗口里完成验证码/短信等人机步骤后继续。
- 文案策略（用户不在场，取推荐项）：**同文案直发，差异化改写走聊天**。发布页对同平台多号给一句风控/去重提示；要按画像改文案，在聊天里说「按各号画像改文案发到这三个号」，名册注入后 agent 天然支持，不为批量改写新增 UI。

### 看板（用户不在场，取推荐项：不拆、预留参数）

- `account_stats.py` 已随 `--profile-dir` 账户化；归档仍写 `_analytics/<platform>.jsonl`，读默认账号。后续拆分只需换归档路径 + DashboardPage 分组，本期不做 UI。

### 安全与运维注记

- 浏览器 profile 留在 `~/.easel-browser-profiles` 本地盘：数据根可能落在 UNC/NAS（junction 与 Chromium 用户目录在网络盘均不可靠），因此登录态**不进** WebDAV/SMB/S3 备份与隔空传送载荷；在备份设置页与 README 注明。注册表本身无平台凭据（仅引用），随数据根正常备份。
- per-account B 站 cookie 文件加入 `PROTECTED_READ_FILES`；「cookie 只进不出」原则不变。

## [S3] Scope

- In scope：
  - 账户注册表 + 零拷贝迁移 + `resolveAccount` 单点解析
  - 七平台 runner 参数化（`--profile-dir` / `--cookie-file` / `--cdp-endpoint` 双模式）
  - 账号直启 CDP 实例：Node 侧直启器、动态端口、运行态协议、登录模式收敛（qr/direct，移除普通 cdp 接管）
  - 登录/登出/whoami/发布/看板/拆解 cookie 导入全链路按账号寻址，缺省默认账号
  - 账号 CRUD 路由与账号页 UI（添加同平台多号、改名、画像绑定、删除、打开登录窗口）
  - 发布页账号多选分发（跨账号并发上限 2、同平台串行）+ 逐账号状态 + 同平台风控提示
  - agent 提示词名册注入（三处）+ 技能文档账号参数 + 排期 accountId + 定时任务到期 prompt 指名账号
- Out of scope：
  - 数据看板按账号 UI 分组（参数已预留）
  - UI 内置「按画像批量改写文案」（走聊天名册）
  - 拆解数据源 cookies（`outputs/_deconstruct/cookies.json`）按账号拆分——保持全局一份（它是抓取凭据，不是发布身份）
  - CloakBrowser 容器后端与 Boss直聘等非内容平台（yingpin 的另一套后端，按平台分工不可互替，Easel 内容发布七平台不需要）
  - 热点雷达 `cdpEndpoint` 配置与 CDP 接管探测的改动
  - 账户分组/团队协作/跨设备账户同步

## Tasks

- [x] T1: `lib/accounts.js`：注册表读写、零拷贝迁移、`resolveAccount`、id 生成与名字校验（复用 `validPersonaName` 风格），node:test 单测 (depends: none)
- [x] T2: runner 参数化：六个 Python 脚本 `--profile-dir` 与 `--cdp-endpoint`（双模式：附身运行中实例 / 无头 persistent context）、`bili_login.mjs` `--cookie-file`，默认值 = 现状路径与现状行为，更新各自 selftest (depends: none)
- [x] T3: automation.js 账户化 + 直启器：accounts 列表改注册表、login/logout/whoami 带 account、状态文件按 id 改名迁移、B 站 per-account cookieFile、xhs cookie 导入带账号；浏览器发现/动态端口/幂等探测/运行态协议/`direct` 登录模式，登录入口收敛为 qr/direct 并移除普通 cdp 接管 (depends: T1, T2)
- [x] T4: apiPublish 账户化 + `outputs/_publish/<id>.json` + `recordPublishedSchedule` 带 accountId + `_schedule.json` schema 扩展 (depends: T3)
- [x] T5: 账号 CRUD 路由（PUT/DELETE）+ AccountsPage 多账号列表（添加、改名、画像绑定下拉、删除确认、打开登录窗口/校验登录态）+ api.ts 类型 (depends: T3)
- [x] T6: PublishPage 平台→账号多选分发、跨账号并发（上限 2，同平台串行）、逐账号状态轮询、同平台风控提示 (depends: T4, T5)
- [x] T7: agent 面：提示词名册 builder + 三处注入点 + 技能 SKILL.md 账号参数 + 定时任务到期 prompt 带账号 (depends: T5)
- [x] T8: 内容日历条目 accountId 展示 (depends: T4)
- [x] T9: 验证收口：插件全量 node --test（262 pass）、typecheck 5/5、runner selftest 7/7；`build:check` 按影响面豁免（easel/ 不在 pnpm workspace，diff 零触碰 packages/apps）；同步修复 base 已存在的 `safeOutputPath` 未导出（带媒体发布此前必 500）

## [S4] Acceptance

- [x] 同平台（如抖音）可登录 ≥2 个账号，登录态互不覆盖，可分别登出，登出单账号不影响同平台其他账号
- [x] 多账号可同时登录：两个直启窗口并行登录互不干扰；实例运行中发布自动附身，用户在可见窗口完成验证码/短信后流程继续（部分可操作）
- [x] 实例未运行时，无人值守发布/看板走现状无头 persistent context，行为与升级前一致
- [x] 账号登录入口只余 qr/direct 两种模式，普通 cdp 接管（用户日常 Chrome 9222）已从登录入口移除；热点雷达 cdpEndpoint 功能不受影响
- [x] 存量用户升级后零操作：旧登录态自动成为各平台默认账号；未建新账号时发布/看板/拆解/登录行为与现状一致（默认账户直通）
- [x] 账号可绑定/换绑画像；发布页向该账号推送、以及聊天让 agent 推送时，提示词名册含「账号名 + 平台 + 画像名 + profiles 路径」
- [x] 发布页可多选账号一键分发（跨账号并发上限 2、同平台内串行），逐账号状态可见
- [x] per-account B 站 cookie 文件不可被读路由回显（读保护生效，测试覆盖拒绝路径）
- [x] 内容排期条目与发布成功回写携带账号；定时任务到期 prompt 指名目标账号
- [x] 插件测试全绿（262 pass / 0 fail）；`pnpm run build:check` 未跑——按影响面豁免，理由见 T9
