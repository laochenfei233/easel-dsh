---
feature: easel-radar-douyin-sources
status: delivered
updated: 2026-10-25
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
- **明确不做（本期）**：创作者活动列表。creator.douyin.com 的活动数据全部在登录
  态后（网页端 SPA 网关对未知路径回 `url doesn't match`，活动广场无免登录索引；
  开源界亦无公开接口）。v2 方向：复用发布自动化（douyin_publish.py）的已登录
  Playwright 会话抓创作服务中心活动页，做成「需要账号的雷达源」通用机制。

**Verification**
- `easel/dsh-plugin-easel` `node --test`：211/211 PASS（基线 204，新增 7 项：文档
  解析/公告排序与 url 门禁/解读库 status_code 拒收/合并顺序与预算/总量截断/
  decorateFetched 衔接）。
- 实网端到端（本机直连，临时脚本走 `dispatchLocalApi` 真路由）：`douyin_rule`
  ok:true，公约 4 条置顶、公告按日期倒序（《营销行为》规则更新公告 2024/08/29
  等在列）、cluster 视图正常。
- `node build.mjs` 成功；client.js 指纹核对（`douyin_rule`×2、`抖音规则` 的
  esbuild 大写转义序列）。

## Problem

用户要「抖音的最新规则 + 创作者可参与的活动」。调研结论：规则侧有免登录公开数据，
活动侧没有——创作者服务平台的活动列表全部在登录态后，且无公开接口文档。本期先把
免登录可得的规则数据面接进雷达，活动侧留待登录态方案。

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
  表）与专用取数器（函数）。后者为后续平台官方源（含登录态源）留了挂点。

## Journey log

- 「报告」bee（10810）最初按透明度年度报告理解；实网跑通后发现是百余条治理公告
  库（含规则更新公告）——比预期价值高得多，随即从「全量截断」改为「公告预算 30 +
  解读补满」。教训：解析层先按最小假设写，真实载荷一跑就要回头核对容量设计。
- 根 `.gitignore` 的 `lib/` 再一次吞掉插件源码新文件（`git status` 直接不可见），
  `git add -f easel/dsh-plugin-easel/lib/trends-douyin.js`，勿目录整加。
- 创作者活动侧的死路是实证出来的，不是猜的：网页端 SPA 全量 bundle 只有登录/用户
  接口；活动管理页有 feature flag 门控；`/aweme/v1/creator/activity/list` 等候选
  路径匿名全回 `url doesn't match`。别在这条路上再花时间，直接做登录态方案。
