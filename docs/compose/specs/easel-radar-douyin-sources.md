---
feature: easel-radar-douyin-sources
status: delivered
updated: 2026-10-26
branch: feat/easel-radar-douyin
---

# 抖音官方源接入热点雷达：免登录的「最新规则」数据面

## Report

**What was built** — 热点雷达新增内置源 `douyin_rule`（label 抖音规则）：把抖音规则
中心的三份免登录数据拼成一份榜单，与既有内置热榜同缓存、同轨迹、同关注词、同降级链。

- **数据面**（全部免登录，2026-10-25 实网验证）：
  1. 公约文档（bee 发布物 10877）：社区自律公约、未成年规范、电商规则、医疗健康
     公约，置顶、`hot=文档`；
  2. 治理公告与透明度报告（bee 10810）：百余条带发布日期的公告（违规处置、规则
     更新、专项打击），按日期倒序取最新 30 条，`hot=日期`——这是「最新规则」的
     主信号：新公告发布进榜即标「新」；
  3. 规则解读库（`/aweme/v3/light/policy/explain/`）：九大类违规 × 每类约 10 条，
     标题 `类目｜条目`、`hot=类目`，补满到总量 100。
- **接线**：`lib/trends-douyin.js` 纯解析层（node --test 直测）；`index.js` 的
  `TREND_FETCHERS` 让内置源可挂专用取数器（未挂的仍走聚合 API），`douyin_rule`
  挂 `fetchDouyinRules`——三数据面 `Promise.allSettled` 独立降级，部分失败给部分
  数据，全失败才落 `loadTrendSource` 的 24h 快照链；走应用内代理。
- **客户端**：平台选择器加「抖音规则」chip，默认选中；选题来源文案「抖音规则
  中心」。插件 bump 0.2.24。
- **创作者活动（同日增量，登录态源）**：`douyin_activity`（label 抖音活动）挂
  同一 `TREND_FETCHERS` 挂点。活动广场 `/web/api/v2/creator/activity/pc/list`
  （主，窗口 now-90d~now+180d，已结束过滤）+ 创作灵感
  `/web/api/creator/inspiration/activities`（辅，失败不拖垮广场），接口免签名、
  cookie 直调；条目 hot=`至 MM-DD` 截止文案，url 从 `aweme://webview?url=` 解
  内嵌 https。cookie 来自发布自动化的 DouyinProfile（Playwright 持久 context）：
  `outputs/_login/douyin_activity_cookies.json` 缓存，缺失/失效（网关码 8「用户
  未登录」）时 spawn `settings.python` 无头提取一次（45s 上限，失败 10 分钟冷却，
  失效重提走 force 旁路冷却并重试一次接口），提取/重试全失败抛错走 24h 快照链。
  跨数据面重名在合并层按归一化标题去重（预算留给不同活动）。插件 bump 0.2.25。

**Verification**
- `easel/dsh-plugin-easel` `node --test`：221/221 PASS（基线 204；规则源 7 项 +
  活动源 10 项：窗口/失效判定/jump 解码/广场与灵感解析/截止文案/合并去重与截断/
  decorateFetched 衔接/cookie 缓存形态）。
- 实网端到端（本机直连，临时脚本走 `dispatchLocalApi` 真路由）：`douyin_rule`
  ok:true，公约 4 条置顶、公告按日期倒序（《营销行为》规则更新公告 2024/08/29
  等在列）、cluster 视图正常。
- 活动源三步实证（2026-10-25，登录态「老晨飞233」）：Playwright 持久 context
  打开 creator-micro/home 自动发现两接口 → 页面内无 msToken 裸调 200 → 浏览器
  外 urllib+cookie 直调 200（活动广场 13 条 + 创作灵感 11 条）；无效 cookie 回
  `status_code=8 用户未登录` 即失效信号。
- `node build.mjs` 成功；client.js 指纹核对（`douyin_rule`×2、`douyin_activity`×2、
  两处中文的 esbuild 大写转义序列）。

## Problem

用户要「抖音的最新规则 + 创作者可参与的活动」。调研结论：规则侧有免登录公开数据；
活动侧匿名不可得，但用发布自动化的已登录 DouyinProfile 实测出两个免签名接口，
cookie 直调即可——规则源与活动源同分支落地，活动是 Easel 第一个「需要账号登录态」
的雷达内置源。

## Solution

- **为什么是这三个数据面**：规则中心网页端（douyin_security_web）只消费一个 API
  （policy/explain）加两个 bee CDN 发布物（10877/10810）。公告库 10810 是唯一带
  发布日期的数据面，也是对「最新规则」回答最好的一个；解读库给广度，公约文档给
  锚点。三份拼合后与热榜同构（title/hot/url），雷达的轨迹、聚类、关注词、右键
  入库全部零改动复用。
- **合并预算**：公告百余条若不限量会把解读库整体挤出榜单（总量 100），故公告固定
  预算 30（最新优先），解读补满；文档超额属防御路径，让位顺序=解读先、公告次。
- **脆弱性与代价**：两个 bee 发布物 id 引用自规则中心网页端加载的 JSON，抖音重发
  发布物换 id 时本源整源失败→走 24h 快照降级（不白屏、不冒充实时）。这是接受
  的代价；若发生，重新抓包规则中心首页即可修。
- **TREND_FETCHERS 而非改 TREND_SOURCES**：内置源从此分两种——聚合热榜（URL 列
  表）与专用取数器（函数，签名 `(proxyUrl, settings)`）。后者为后续平台官方源
  （含登录态源）留了挂点——douyin_activity 即第一个用户。
- **活动源的登录态归置**：cookie 不新开账号体系，直接复用发布自动化的
  DouyinProfile（`~/.easel-browser-profiles/`），提取走一次性无头 Playwright
  （python 由 `settings.python` 提供，automation 同款），缓存/失效/冷却全部在
  插件内闭环；登录入口仍是账号页现有扫码流。风险接受：雷达刷新在 cookie 失效时
  会无头起一次该 profile（只读），profile 被发布占用时活动源降级不阻塞其他源。

## Journey log

- 「报告」bee（10810）最初按透明度年度报告理解；实网跑通后发现是百余条治理公告
  库（含规则更新公告）——比预期价值高得多，随即从「全量截断」改为「公告预算 30 +
  解读补满」。教训：解析层先按最小假设写，真实载荷一跑就要回头核对容量设计。
- 根 `.gitignore` 的 `lib/` 再一次吞掉插件源码新文件（`git status` 直接不可见），
  `git add -f` 单文件，勿目录整加。
- 活动侧的「死路」只对匿名成立：登录态下打开 creator-micro/home 首页自动请求
  就带出了活动广场/创作灵感两个免签名接口，此前盲探的 `/aweme/v1/creator/...`
  路径不对而已。教训：平台接口探测要分「匿名面」与「登录面」两轮下结论，登录面
  用真实会话开一次页面比翻 bundle 快得多。
- 活动条目的 jump_link 是 `aweme://webview?url=<编码https>` / `sslocal://`，web
  落点要解内嵌 url；直给 scheme 链接浏览器点不开。
