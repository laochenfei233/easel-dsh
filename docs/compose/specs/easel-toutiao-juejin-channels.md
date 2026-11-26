---
feature: easel-toutiao-juejin-channels
status: in-progress
updated: 2026-11-26
branch: feat/easel-toutiao-juejin-channels
worktree: .worktrees/easel-channels (base feat/easel-skill-sync bc896bacec)
commits: # filled at delivery
---

# 今日头条与掘金渠道

## Report

## [S1] Problem

账号页、发布页和工作台数据看板目前只接入七个平台。上游 ZJU-REAL/Easel 已有今日头条（专用 publisher 脚本）与掘金（通用发布框架的平台块加独立采集脚本）的完整实现，并随 skill 同步（bc896bacec）进入仓库，但宿主路由与前端尚未接线：账号页无法添加这两个平台的账号，发布页发不出去，数据看板取不到数。两个脚本还停留在单账号：profile 目录写死，不接受宿主传的 `--profile-dir` 与 `--cdp-endpoint`。

## [S2] Design

S2.1 **平台登记**：`LOGIN_RUNNERS` 新增 `toutiao`（`backend: 'toutiao'`，profile `ToutiaoProfile`）与 `juejin`（`backend: 'web'`，`wp: 'juejin'`，profile `JuejinProfile`）；`ANALYTICS_PLATFORMS`、`ARCHIVED_ANALYTICS`、`LOGIN_URLS`（直启窗口起始页）、`NO_PROXY_DEFAULT` 与 `lib/accounts.js` 的 `PLATFORMS` 镜像同步新增两项。既有通用路径随之生效、无需改动：账号增删改、直启窗口登录与「校验登录态」、登出清理 profile、工作台全览读归档。

S2.2 **掘金**：登录（登录弹窗内二维码）、校验、发布全部走既有 `web` 后端命令（`web_publisher.py … --platform juejin`），宿主无新增分支。采集时 `account_stats.py fetch --platform juejin` 在 `_scrape` 内委托 `juejin_stats.fetch()` 并映射为本脚本的结果字段，归档键、快照记录、增长窗口与 `history` 子命令与其余平台共用，宿主 `apiAnalytics` 与 `readAccountHistory` 不改。`juejin_stats.py` 接入 `browser_session`（`--profile-dir`、`--cdp-endpoint`）：直启窗口开着时经 CDP 读 cookie，不再启动第二个持久化上下文撞 profile 锁。

S2.3 **头条**：`backend === 'toutiao'` 三个宿主分支，命令形态与上游 `web/app.py` 一致。

- 登录（扫码模式）：`toutiao_publish.py login --qr-out <png> --status-file <json> --timeout <秒> --headed [--profile-dir <目录>]`。固定带 `--headed`：头条号扫码后可能要求绑定手机号并收短信验证码，无头模式下脚本只能报错（上游实测结论）。状态协议沿用 login_state（`starting`、`qr_ready`、`window_login`、`success`、`expired`、`error`）。
- 校验：`toutiao_publish.py whoami [--cdp-endpoint <url> | --profile-dir <目录>]`，stdout 单行 JSON。
- 发布：`toutiao_publish.py --content <正文> --title <标题> --tags <a,b> [--images <p1,p2>] --exec [浏览器参数]`。图片全部插入正文，头条取首图作封面；话题由宿主把 `#` 前缀与中英文逗号、空白归一成逗号分隔；标题超过 30 字、话题超过 5 个、附带视频三种请求由宿主以 400 拒绝并给出中文提示。不提供存草稿选项。

S2.4 **头条脚本多账号**：`toutiao_publish.py` 的 `login`、`whoami` 与发布入口接入 `browser_session`（同其余 runner）：`--cdp-endpoint` 给定时附身运行中实例且绝不关闭该上下文，`whoami` 结束时只关闭自己打开的页面；`--profile-dir` 覆盖默认 `ToutiaoProfile`。`SKILL.md` 增「多账号（可选）」一节，与其他 publisher skill 同款。

S2.5 **前端**：账号页 `PLATFORM_META`、发布页 `PLATFORMS`、名册 `PLATFORM_LABELS` 各新增今日头条与掘金两条；登录弹窗补 `window_login` 状态文案与分支（不再回退成原始状态名并显示「准备二维码…」），头条的登录方式说明注明扫码模式也会弹出浏览器窗口。

## [S3] Scope

- In scope：两个平台的账号、登录（扫码与直启窗口）、校验、登出、发布、数据采集与归档；宿主路由、脚本、前端、文档与测试。
- Out of scope：X（twitter-x）渠道接线（脚本已随同步入库，宿主不接）；头条存草稿的前端选项；跨平台发布 skill 分发表（上游自身未收录掘金）；真实账号的登录与发布实测（无测试账号）。

## Tasks

- [ ] T1: 宿主登记与分支——LOGIN_RUNNERS、ANALYTICS_PLATFORMS、ARCHIVED_ANALYTICS、LOGIN_URLS、NO_PROXY_DEFAULT、accounts.js 镜像，头条 login/whoami/publish 三个分支与参数校验 (depends: none)
- [ ] T2: toutiao_publish.py 接入 browser_session（login/whoami/发布）与 selftest (depends: none)
- [ ] T3: juejin_stats.py 接入 browser_session；account_stats.py 委托分支与 selftest (depends: none)
- [ ] T4: 前端三张平台表与登录弹窗 window_login 分支 (depends: T1)
- [ ] T5: 宿主路由测试（假 runner 记录命令行）与 SKILL.md 多账号一节 (depends: T1 T2 T3 T4)
- [ ] T6: 验证门、独立复审、finalize (depends: T5)

## [S4] Acceptance

- [ ] 账号页、发布页、名册与工作台全览出现「今日头条」「掘金」；`GET analytics/platforms` 返回两者
- [ ] 头条宿主命令与 S2.3 一致（login 恒带 `--headed` 与账号 `--profile-dir`；whoami 走 `toutiao_publish.py whoami`；publish 用 `--content`、`--title`、`--tags`、`--images`、`--exec` 且不带 `--media`）
- [ ] 掘金的登录、校验、发布命令带 `--platform juejin`，采集命令带 `--platform juejin --history-key <账号 id>`
- [ ] 头条标题超 30 字、话题超 5 个、附带视频均返回 400 中文提示，且不启动 runner
- [ ] 三个脚本接受 `--profile-dir` 与 `--cdp-endpoint`；`account_stats.py fetch --platform juejin` 经委托分支产出与其余平台同字段的结果，失败降级为未登录（selftest 断言）
- [ ] 插件 `node --test` 全绿；客户端 bundle 构建通过
- [ ] 独立复审通过
