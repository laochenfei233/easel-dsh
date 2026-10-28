---
feature: easel-breakdown-kuaishou
status: designed
updated: 2026-10-28
branch: feat/easel-breakdown-kuaishou
commits: （交付时填写）
---

# 爆款拆解 · 快手下载路径（同作者下载器调研落地）

## Report

（交付时填写）

## [S1] Problem

爆款拆解下载链路（video_fetch.mjs）目前覆盖抖音/小红书（原生路径）与
YouTube/B站/TikTok/通用（yt-dlp）。用户要求：了解现有两条原生路径的蓝本库
（TikTokDownloader / XHS-Downloader，同作者 JoeanAmier）的后端机制，查同作者
是否有**微信视频号、快手、B站**下载器，有的话做进拆解链路。

调研结论（2026-10-28，GitHub 仓库与 README 实证）：

| 平台 | 同作者下载器 | 结论 |
|------|--------------|------|
| 快手 | [KS-Downloader](https://github.com/JoeanAmier/KS-Downloader)（v1.7.0-beta，GPL-3.0） | **做**：页面 `__APOLLO_STATE__` 解析，cookie 无需登录 |
| B站 | 无（TikTokDownloader 仅抖音/TikTok，无支持计划） | 不做：yt-dlp 路径已实测可用（spec easel-video-breakdown T5） |
| 微信视频号 | 无 | 不做：无同作者蓝本，且视频号抓取依赖微信客户端态，超出本期 |

## [S2] Design

KS-Downloader 后端机制（source/extract/extractor.py、source/link/examiner.py 实读）：

- 链接形态：`v.kuaishou.com/<码>`、`www.kuaishou.com/f/<码>`（短链 302 到详情页）、
  `www.kuaishou.com/short-video/<photoId>`、`kuaishou.cn/short-video/<id>`、
  `chenzhongtech.com/fw/photo/<id>`。
- web 路径：GET 详情页（PC headers，可选**游客 cookie**，README 明确「无需登录」）
  → 脚本标签里 `window.__APOLLO_STATE__=` 后跟一段 JSON（尾缀
  `;(function(){var s;...}());` 自移除脚本）→ `defaultClient` 内
  `VisionVideoDetailPhoto:<photoId>` 键：`photoUrl`（mp4 播放地址）、`caption`、
  `duration`（毫秒）、`realLikeCount`/`viewCount`；作者在 `VisionVideoDetailAuthor:<eid>`
  键的 `name`。
- app 路径（`live.kuaishou.com/live_api/profile/feedbyid`）需要 principalId+photoId，
  单作品链接场景用不上，不采用。

**原则（ponytail + 既有约束）**：与抖音/小红书同款做法——参考接口行为、
独立最小实现、stdlib 单文件；**不引入 GPL 代码**（KS-Downloader 是 GPL-3.0，
只读其源码学端点与字段，一行不复制），继续满足 easel-video-breakdown 的
「不外挂仓库」约束。

### video_fetch.mjs（master 安全加固版为基线）

- `PLATFORM_HOSTS` 增加 `kuaishou: ['kuaishou.com', 'kuaishou.cn',
  'chenzhongtech.com']`；`detectPlatform` 增加对应分支（点边界后缀匹配继承）。
- `fetchKuaishou(url, cookie, batch)`：
  1. `fetchFollowing` 逐跳跟随（allowHosts 钉在快手三域；cookie 存在时仅在快手域附上）
     → 最终 URL 取 photoId：`/(?:short-video|fw\/photo)\/([\w-]+)/`。
  2. GET 详情页（`User-Agent: DESKTOP_UA` + `Referer: https://www.kuaishou.com/`）
     → 新增导出纯函数 `parseApolloState(page)`：定位 `window.__APOLLO_STATE__=`，
     截到自移除脚本尾缀或 `</script>`，`JSON.parse`，容错缺键。
  3. `defaultClient` 里按精确键 `VisionVideoDetailPhoto:<photoId>` 取值（与
     KS-Downloader 的 web 提取一致；图集等无此键的作品没有 photoUrl，
     按下载失败降级）→ `photoUrl` 缺失 = 图集/已删除/风控 → 抛错
     （退出码 2，沿用「手动放文件」降级）。
  4. `download(photoUrl, { DESKTOP_UA, Referer })` → `video.mp4`（经既有公网校验）。
  5. stdout 元信息：`platform: 'kuaishou'`、`title: caption`、`author`、
     `duration_sec`（毫秒→秒）、`file`、`url`。
- cookie：**可选**（免登录）。cookies.json 增加可选 `"kuaishou"` 字段；解析失败且
  未填 cookie 时，stderr 指引「可在 outputs/_deconstruct/cookies.json 填 "kuaishou"
  网页版游客 cookie 后重试」。退出码 3 仍保留给硬性要求登录态的小红书。
- `main()` 路由增加 kuaishou 分支；selftest 增加 kuaishou 平台判定用例。

### 插件侧平台门控（easel/dsh-plugin-easel）

- `lib/sourcedata.js`：`parsePlatform` 增加 `kuaishou|chenzhongtech` 判定；
  `sourceStatus` platforms 数组增加 `'kuaishou'`（`authRequired=false`，快手不在
  `AUTH_REQUIRED`）。`LOGIN_FILE_ALIASES` 不加（缺省 `[platform]` 已覆盖 `_login/kuaishou.json`）。
- `src/components/BreakdownPage.tsx`：`PLATFORM_NAMES` 增加 `kuaishou: '快手'`；
  副标题「抖音/小红书/B站/…」补「快手」。preflight 对快手天然不阻断
  （authRequired=false），无额外改动。

### 技能文档

- `SKILL.md`：description 平台列表加「快手」；前置表 yt-dlp 行改为
  「B站/YouTube/通用站点需要；抖音/小红书/快手走内置原生路径不需要」；
  cookie 行补「快手免登录（可选游客 cookie："kuaishou" 字段）」。
- `EASEL-META.md`：致谢区补快手 / KS-Downloader（注明 GPL-3.0、仅参考接口行为、
  未复用代码）；功能描述与自包含行同步。

## [S3] Scope

**In**：video_fetch.mjs 快手原生路径（含 `parseApolloState` 导出）、cookies.json
可选 `kuaishou` 字段、sourcedata.js 平台判定与状态行、BreakdownPage 文案、
SKILL.md/EASEL-META.md 更新、video_fetch/sourcedata 测试、真实快手链接实测。
**Out**：B站（已有 yt-dlp 路径）、微信视频号（无同作者蓝本，超出本期）、
快手图集/直播、快手评论/作者主页批量、任何外挂仓库或 GPL 代码引入、
app 侧 `live_api` 路径、设置页快手 cookie 表单（cookies.json 直填即可，
source-status 已展示 cookieSet 状态）。

## Tasks

- [ ] T1: video_fetch.mjs——PLATFORM_HOSTS/detectPlatform/fetchKuaishou/
      parseApolloState/main 路由/selftest（depends: none）
- [ ] T2: video_fetch.test.mjs——kuaishou 平台判定、parseApolloState fixture
      解析、hostMatches 负例（depends: T1）
- [ ] T3: sourcedata.js parsePlatform/sourceStatus + sourcedata.test.js
      （depends: none）
- [ ] T4: BreakdownPage.tsx PLATFORM_NAMES 与副标题（depends: T3）
- [ ] T5: SKILL.md + EASEL-META.md 文档（depends: T1）
- [ ] T6: 验证——插件 node --test 全绿、video_fetch --selftest 与单测绿、
      插件 client 构建（build.mjs）过、真实快手链接端到端下载（depends: T1–T5）

## [S4] Acceptance

- [ ] `detectPlatform` 把 `v.kuaishou.com`/`kuaishou.cn`/`chenzhongtech.com` 链接
      判为 kuaishou；`evil-kuaishou.com`、`attacker.example?kuaishou.com` 仍为
      generic（单测断言）
- [ ] `parseApolloState` 从 APOLLO_STATE 页面 fixture 提取 photoUrl/caption/
      duration/作者名，缺键容错（单测断言）
- [ ] `parsePlatform('https://v.kuaishou.com/xxx')` 返回 `'kuaishou'`；source-status
      返回 kuaishou 行且 `authRequired=false`（单测断言）
- [ ] 快手真实视频链接端到端：下载成功、stdout 元信息 JSON 字段齐全
      （网络实测，附命令与输出摘要）
- [ ] 图集/失效链接 → 退出码 2 且 stderr 含「手动放文件」指引；无 cookie 失败时
      stderr 含游客 cookie 指引
- [ ] BreakdownPage 出现「快手」平台名与更新后的副标题（构建过 + 代码走查）
- [ ] 回归：插件 node --test 全绿；抖音/小红书路径与安全断言不回退
      （selftest 既有用例全过）
