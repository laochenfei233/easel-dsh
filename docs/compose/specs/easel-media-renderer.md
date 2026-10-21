---
feature: easel-media-renderer
status: delivered
updated: 2026-10-20
branch: feat/easel-media-renderer
commits: 1673ee0..HEAD
---

# 侧边栏媒体渲染器扩展

## Report

**What was built** — 侧栏文件预览现在对视频/音频就地播放：easel 插件向 dsh 的 `documentPreviews` 注册 `easel-media-player`（extension 优先级），覆盖 mp4/m4v/mov/webm/mkv 与 mp3/wav/m4a/aac/flac/ogg/opus；未注册的 avi/flv/wmv/wma 保持 dsh 默认「不支持 + 打开」。播放源走新增的 `GET /easel/api/workspace-media/:path`（projectRoot 域、单 Range 流式），因为既有 `/easel/api/media` 被 `safeOutputPath` 钉死在 `outputs/` 下，而会话文件多在 `projects/<项目>/...`。客户端经 `ctx.inject(['documentPreviews','remote.workspaceFiles'])` 等待服务（两者都可能晚于 easel 激活），用 `workspaceFiles.stat` 取 absolutePath、相对 projectRoot 生成 URL；根外文件与解析失败给页内提示并 `content.failed()`，注册整体有 try/catch 降级，媒体问题不会拖垮工作台。

**Verification** — `node --test test/*.test.js` 75/75（新增 media-url 5 例 + workspace-media 路由用例）；实机路由：mp4 `206 video/mp4`（Range 1024B）、`.env` 与 `.png` 均 404（新增 `PLAYABLE_MEDIA_EXTS` 白名单，堵住“项目根通用文件服务器”口子）；无头 Chromium UI：webm 视频 `readyState 4 / duration 5 / playing`，wav、mp3 均 `playing`；壳的真实 WebView2（Edg/132，H.264 `probably`）：1080p mp4 `loadedmetadata`、60s、1920×1080、`play()` 推进；回归：jpg→image、md→markdown、drp→dsh 默认，均未受影响。插件 0.2.10，六副本字节一致，`.bundle-version`/`VERSION`=0.2.10。

**Journey log** — ①`ctx.documentPreviews` 直接属性访问会触发 cordis「without inject」抛错并让插件整体 FAILED（boot 屏白页）——改用 `ctx.inject` 等待，同时保证服务缺失时不影响主功能；②Playwright 自带 Chromium 无 H.264，mp4 测试会被误判为解码失败——`canPlayType` 证实后改用 webm/wav 验证链路，再用壳的 WebView2 通过 CDP 直接验证 mp4；③`rg -rn` 的 `-r` 是 replace 不是 `-n`（本轮又一次假命中）；④0.2.9 与 main 上 project-folders 已占用的版本号撞车，stamp 门不推进——bump 0.2.10。

## [S1] Problem

dsh 侧边栏文件预览（ui-sidebar-documentpreview）对视频/音频只给「该格式文件暂时无法预览」+ 打开按钮，没有页面内播放。用户工作区媒体文件占 ~80%（mp4×72、wav×81、mp3×69、mov×8），点开侧栏文件想要的是**就地播放**，而不是先看到"不支持"再调外部程序。dsh 的渲染器注册表（`ctx.documentPreviews` + keyed slot `sidebar.right.tab.document`）留有 `priority: 'extension'` 的正规扩展位。

## [S2] Design

- **落点 = 现有 dsh-plugin-easel**，不建新插件包：插件已装入全部五个同步副本与 profile，媒体渲染器是其 UI 面的自然延伸；新包会多出一整条安装/同步/stamp 面（本项目已两次踩坑）。
- **注册面**（image/office 同款两件套）：
  - `ctx.documentPreviews.register({ id: 'easel-media-player', extensions, binaryExtensions, priority: 'extension', title, loading: 'renderer', wrap: false })`
  - `ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({ name, key: 'easel-media-player', locale: 'easelMedia' }, MediaBody))`——`store` 可选故省略；组件 props 即 `DocumentBodyOwner`（resourceAddress/content/wrap/…）。
- **扩展名 = Chromium 可解码集合**（WebView2 同核）：视频 `mp4 m4v mov webm mkv`；音频 `mp3 wav m4a aac flac ogg opus`。`avi/flv/wmv/wma` 浏览器解不了，**不注册**——它们继续走 dsh 默认（不支持空态 + 打开按钮），decode 失败的 mkv 边角由组件错误态兜底提示。
- **媒体源 = 新宿主路由 `GET /easel/api/workspace-media/:path...`**：现有 `/easel/api/media` 被 `safeOutputPath` 钉死在 `outputs/` 下，而侧栏文件遍布 `projects/<项目>/...`。新路由以 **projectRoot 为域**，复用 `streamFile` 的单 Range 流式与守卫模式（root 前缀校验 + isFile）。`MEDIA_TYPES` 补 `.mkv`/`.opus`。
- **URL 构建链**：`remote.workspaceFiles.stat(sessionId, path)`（dsh 会话授权读，拿 absolutePath + version）→ `path.relative(projectRoot, absolutePath)`（projectRoot 来自 `/easel/api/status`，复用 lib/task.ts 的 `projectRoot()`）→ 段级 `encodeURIComponent` 拼 `/easel/api/workspace-media/...`。项目根外文件 → 相对化失败 → 组件错误态（dsh 头部「打开」动作不受影响）。
- **MediaBody 组件**：`content.kind === 'renderer'` 时渲染居中 `<video|audio controls preload="metadata">`（按扩展名选元素）；`loadedmetadata → content.loaded(version)`（version 来自 stat）；媒体元素 `onError → decode 提示 + content.failed()`。不自动播放；不做文件变更监听（reload 走预览栏既有按钮）；播放状态不持久。
- **零 dsh 静态导入**（插件既有约定）：`sessionId/path` 从 `props.resourceAddress` 手解析（`dsh-resource://file/session/<id>/<path>` 线格式，段级 decodeURIComponent）；`stat` 经 `ctx.inject(['documentPreviews','remote.workspaceFiles'])`（两个服务都可能晚于 easel 激活，缺失时静默等待）捕获 `scope.remote.workspaceFiles`，以 slot `inject` 工厂下发；纯逻辑（扩展集/kind/相对路径）独立成 `src/lib/media-url.js` 供 node --test。
- **路由白名单**：`/easel/api/workspace-media` 只服务 `PLAYABLE_MEDIA_EXTS`（视频/音频），其余扩展名一律 404——项目根下还有 `.env`/画像/脚本，不能变成通用文件服务器。
- **版本**：插件 bump **0.2.10**（0.2.9 已被 main 的 project-folders 占用；stamp 门=版本号必须真的推进，改插件必 bump，六副本同步才不被回盖）。

## [S3] Scope

- In scope：
  - `src/lib/media-url.js` 纯函数 + `test/media-url.test.js`
  - 宿主半 `index.js`：`apiWorkspaceMedia` + 路由行 + MEDIA_TYPES 补充 + `test/local-api.test.js` 用例
  - 客户端 `src/lib/media-preview.tsx` + `src/client.tsx` 挂接 + `build.mjs` 构建
  - 五副本热同步 0.2.9 + 实机浏览器验证
- Out of scope：
  - avi/flv/wmv/wma 页内播放（浏览器不可解码）
  - 字幕渲染、自动播放、播放进度记忆、倍速记忆
  - 页内 PDF/office 以外的其他 dsh 内置格式改动
  - 独立插件包、拆解页播放器、内容库页面改动

## Tasks

- [x] T1: `src/lib/media-url.js`（MEDIA_EXTENSIONS、mediaKindOf、workspaceMediaPath）+ `test/media-url.test.js`（depends: none）
- [x] T2: 宿主半 `apiWorkspaceMedia` + 路由 + MEDIA_TYPES 补充 + local-api 用例（depends: none）
- [x] T3: `src/lib/media-preview.tsx`（注册 + MediaBody）+ client.tsx 挂接 + build（depends: T1）
- [x] T4: 版本 bump 0.2.10 + 五副本热同步 + 浏览器实测（depends: T2, T3）

## [S4] Acceptance

- [x] 侧栏点 mp4/mov/mp3/wav → 页内出现播放器；`<video>` 拖动进度条产生 `206 Partial Content` 请求（Range 生效）
- [x] `projects/<项目>/outputs/**` 里的文件可播（workspace-media 路由覆盖 outputs 外的 projectRoot 域）
- [x] jpg/md/pdf/纯文本预览不受影响；zip/docx/mp4 之外注册外的格式仍显示 dsh 默认态 + 打开按钮
- [x] 项目根外的文件不出现播放器，显示错误提示，dsh 头部「打开」仍在
- [x] `node --test` 全绿（含新增 media-url 与 local-api 用例）
- [x] 插件版本六副本一致 0.2.10，重启壳后仍生效（stamp 门不再回盖）
