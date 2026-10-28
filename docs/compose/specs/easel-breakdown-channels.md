---
feature: easel-breakdown-channels
status: designed
updated: 2026-10-28
branch: feat/easel-breakdown-channels
commits: （交付时填写）
---

# 爆款拆解 · 微信视频号接入（sidecar 下载器 + 微信登录门控）

## Report

（交付时填写）

## [S1] Problem

爆款拆解已覆盖抖音/小红书/快手（原生路径）与 B站/YouTube（yt-dlp）。视频号视频流
带签名且加密（sn/uid/key，Isaac64 密钥流），无免登录公开路径可抄，原生路径做不进
video_fetch。落地方案是外部 sidecar：[wx_channels_download](https://github.com/ltaoo/wx_channels_download)
v260907（已落 `dist/tools/wx-channels-download/`，gitignore 区）——经微信 PC 客户端
流量代理 + 页面注入下载，视频落 Downloads（`wxdl_` 前缀）。

用户需求（2026-10-28 拍板）：把这个能力**做进爆款拆解流程**；微信登录检测**不做在
启动时**（应用/页面/插件启动一律不探测微信），而是在拆解第一步**识别出链接是视频号
时**才检测——未登录就停下引导登录，登录后继续工作。没有微信登录态，sidecar 拿不到
任何流量，流程必然空转。

真机实证（2026-10-28，本机微信 4.x Weixin.exe 托盘驻留）：

- 主窗口类 `Qt51514QWindowIcon` + 标题「微信」，关到托盘时**隐藏不销毁**；
- 3.x 遗留类名：登录 `WeChatLoginWndForPC` / 主窗 `WeChatMainWndForPC`；
- 进程名：4.x `Weixin.exe`、3.x `WeChat.exe`。

## [S2] Design

**原则（ponytail）**：sidecar 的交互本质（用户在微信里点「下载」按钮）决定流水线
只能**等待拾取**而不能 URL 直下——把复杂度放在「状态检测 + 等待拾取」，不动既有
job 状态机（fetch/frames/asr/ready 原样）。

### 数据流

```
贴视频号链接 → preflight(sph)：微信登录？下载器在？→ 创建任务
  → 视频号分支：确保下载器已启动 → fetch 阶段轮询 staging 目录
  → 用户在微信里打开视频点「下载」（文件落 staging，wxdl_ 前缀）
  → fetch 拾取最新 wxdl_ → video.mp4 进 batch → frames/asr/拆解照旧
```

### video_fetch.mjs（T1）

- `detectPlatform` 增 `sph: ['channels.weixin.qq.com']`（点边界后缀，天然排除
  `mp.weixin.qq.com` 公众号域）。
- `fetchSph(batch)`（离线，不发网络请求）：
  - staging 目录 = `EASEL_CHANNELS_DIR` 环境变量，缺省 `%USERPROFILE%\Downloads`；
  - 等待窗口 = `EASEL_CHANNELS_WAIT` 秒（插件传 480；缺省 480；测试传 1），
    每 2s 轮询，找 `wxdl_*` 且扩展名在 VIDEO_EXTS、mtime ≥ 启动时刻-15s 的新文件，
    取最新；窗口内没有 → 退出码 2 + 指引（含 staging 路径与已存在的 wxdl_ 文件数）；
  - 命中 → **复制**（不动用户原件）到 `batch/video.mp4`；stdout 元信息
    `platform:'sph'`，title 取文件名去 `wxdl_` 前缀与 `_<spec>` 后缀，duration 0
    （SKILL 第 3 步 ffprobe 会拿到真实时长）；
  - 全程 stderr 引导：「在微信 PC 端打开该视频，点播放器下方的下载按钮」。
- 导出纯函数 `pickStagedChannelsFile(dir, sinceMs)` 供单测。

### 插件 lib/channels.js（T2）

- `detectWeChat()`（Windows）：
  - 进程：`Weixin.exe` / `WeChat.exe`（PowerShell Get-Process）；
  - 窗口：Add-Type EnumWindows 取微信进程的全部顶层窗口（含隐藏）→
    `{cls,title,visible,w,h}`；
  - **纯函数分类器 `classifyWeChatWindows(rows)`**（可单测）：
    3.x `WeChatMainWndForPC`（任意可见性）→ 已登录；`WeChatLoginWndForPC` → 登录界面；
    4.x `Qt51514QWindowIcon`+标题「微信」：隐藏 → 已登录（托盘主窗）；
    可见且 ≥600×700 → 已登录（打开的主窗）；可见且更小 → 登录界面；
    有进程但一个微信窗口都没有 → 未登录（保守，指引「打开微信确认已登录」）；
  - mac：`pgrep -x WeChat` 只判进程（running≈已登录，注释说明假设）。
- `findChannelsTool(settings)`：`settings.channelsDownloader`（resolveSettings 新字段，
  读 config `channelsDownloader` / env `EASEL_CHANNELS_DOWNLOADER`）→
  开发态回退 `<repo>/dist/tools/wx-channels-download/wx_video_download.exe`
  （从 `import.meta.url` 上溯三级，同 build.mjs resolveDshRoot 的「解析而非假设」
  先例）→ 都没有 `{installed:false}`。
- `downloaderRunning()`：TCP 连 `127.0.0.1:2022`（config api.port 缺省值）。
- `launchChannelsTool(deps)`：守卫①工具已安装 ②**微信已登录**（用户拍板：启动前
  先检测）→ 已运行直接返回 → 否则 `spawn(exe, {detached, windowsHide, stdio:'ignore'})`
  → 轮询 2022 至多 15s。deps 参数注入 detect/spawn 供测试。首次安装证书需管理员：
  UI 文案指引「首次请手动以管理员运行一次」。

### 路由（T3，lib/plugins/deconstruct.js 注册表）

门控时机（用户拍板）：**只挂在「识别到视频号」之后的链路上**——preflight（识别步）
与 create（启动采集）才触碰微信检测；页面加载、插件启动、其他平台的 preflight
都不做微信探测。

- `GET channels/status` → `{wechat:{running,loggedIn,loginScreen}, tool:{installed,dir,stagingDir,running}}`（仅由 preflight 的 sph 分支与门控卡片复用，不做页面挂载轮询）。
- `POST channels/launch` → 守卫同上（微信未登录 → 400 带指引）。
- `POST deconstruct/preflight`：识别步。平台非 sph → 现状不变（**零微信探测**）；
  平台 sph → 查 channels 状态；`blocked = !tool.installed || !wechat.loggedIn`；
  payload 增 `channels` 段。未登录即「先登录后继续」：卡片引导登录，用户登录后
  重新点开始 → preflight 放行。
- `POST deconstruct`：平台 sph → 守卫（微信登录 + 工具已安装）→ 工具未运行则自动
  启动（同 launch 守卫语义）→ fetch 子进程注入 `EASEL_CHANNELS_DIR=stagingDir`
  （`run()` 增 env 透传参数）。
- `lib/sourcedata.js`：`parsePlatform` 增 `channels\.weixin\.qq\.com` → `'sph'`
  （`sourceStatus` platforms 不加 sph——视频号不走 cookie 门控）。

### BreakdownPage（T4）

- `PLATFORM_NAMES` 增 `sph:'视频号'`；副标题与门控文案补视频号。
- **页面加载不做任何微信/下载器探测**（不增挂载时 fetch）。
- preflight 平台为 sph 且被拦时渲染专用卡片：微信状态三态（未运行 → 「启动微信
  并登录」；停在登录界面 → 「请在微信里登录」；已登录 ✓）+ 下载器三态（未安装 →
  指引安装路径；未启动 → 说明创建任务时会自动拉起；运行中 ✓）。用户登录后重新
  点「开始采集」即继续（preflight 放行）。
- sph 任务在 fetch 阶段时提示：「在微信里打开该视频，点播放器下方的「下载」，
  流水线会自动拾取（wxdl_ 开头文件，最长等 8 分钟）」。

### 工具配置与文档（T5）

- `dist/tools/wx-channels-download/config.yaml`：`filenameTemplate` 改
  `wxdl_{{filename}}_{{spec}}`（拾取锚点）。
- `dist/tools/wx-channels-download/README.md`：补「已接入拆解流程」段。
- SKILL.md：平台列表/前置表补视频号（微信已登录 + 下载器；下载按钮交互）。
- EASEL-META.md：依赖与致谢补 wx_channels_download（MIT + Commons Clause，
  外部 exe，未随包分发）。

## [S3] Scope

**In**：video_fetch sph 平台（staging 拾取 + 等待）、lib/channels.js（微信登录检测/
工具发现/启动/状态）、channels 两条路由 + preflight/create 分支、BreakdownPage
视频号卡片、工具 config `wxdl_` 前缀、SKILL/EASEL-META/dist README 文档、
单测与真机验证。
**Out**：工具随包分发（runtime-inputs pin，另行拍板；当前未安装时 UI 给安装指引）、
headless API 驱动下载（tool 的 2022 API 面未验证，交互式点按钮是产品现实）、
视频号直播回放、mac 端登录窗口枚举（只判进程）、cookies.json 的 sph 字段、
sph 进 sourceStatus/设置页 cookie 表单。

## Tasks

- [ ] T1: video_fetch.mjs——detectPlatform sph + fetchSph（staging 拾取/等待窗口/
      复制/meta）+ EASEL_CHANNELS_DIR/WAIT + pickStagedChannelsFile 导出 + selftest
      + 测试（depends: none）
- [ ] T2: lib/channels.js——detectWeChat（PowerShell 脚本 + mac pgrep）+
      classifyWeChatWindows 纯函数 + findChannelsTool + downloaderRunning +
      launchChannelsTool(deps) + 测试（depends: none）
- [ ] T3: sourcedata parsePlatform sph + 路由（channels/status、channels/launch、
      preflight sph 分支、create sph 守卫与 env 注入、run() env 透传）+ 测试
      （depends: T2）
- [ ] T4: BreakdownPage——PLATFORM_NAMES/副标题/视频号门控卡片/fetch 阶段提示
      （depends: T3）
- [ ] T5: config.yaml filenameTemplate + dist README + SKILL.md + EASEL-META
      （depends: T1）
- [ ] T6: 验证——全部单测绿、selftest、真机：微信探针（本机 4.x 应报已登录）、
      staging 拾取 e2e（放 wxdl_ 文件 → 跑 sph 链接 → batch/video.mp4 + meta）、
      超时路径退出码 2（depends: T1–T5）

## [S4] Acceptance

- [ ] `detectPlatform('https://channels.weixin.qq.com/...')` → `'sph'`；
      `mp.weixin.qq.com` 仍为 generic（单测）
- [ ] `pickStagedChannelsFile` 取 mtime ≥ since 的最新 `wxdl_*` 视频，忽略旧文件
      与非 wxdl_ 文件（单测）
- [ ] 真机 e2e：staging 放 `wxdl_测试.mp4` → `node video_fetch.mjs <batch>
      <channels链接>`（EASEL_CHANNELS_WAIT=2）→ 退出码 0，batch/video.mp4 为
      复制件，stdout meta `platform:'sph'`；无新文件等待超时 → 退出码 2 且
      stderr 含 staging 路径指引
- [ ] `classifyWeChatWindows`：4.x 隐藏主窗 → 已登录；可见小窗 → 登录界面；
      可见大窗 → 已登录；3.x 两类名 → 对应态；空窗口列表 → 未登录（单测）
- [ ] `POST channels/launch` 在微信未登录/未运行时 400 且不 spawn 工具
      （deps 注入单测）；已运行（2022 开放）时 no-op
- [ ] `POST deconstruct/preflight` 对 sph 返回 `channels` 段且 blocked 判定正确
      （单测或 local-api 测试）
- [ ] 真机微信探针：本机微信托盘驻留状态下 `detectWeChat()` 报
      `{running:true, loggedIn:true}`（运行记录）
- [ ] BreakdownPage 出现视频号卡片与三态文案；页面加载/插件启动路径**无**微信探测
      （esbuild 过 + 代码走查）
- [ ] 回归：插件全量测试绿；快手/抖音/小红书路径不回退（selftest 全过）
