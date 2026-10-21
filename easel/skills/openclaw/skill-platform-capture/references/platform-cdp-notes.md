# CDP 客户端协议与平台踩坑

本 SKILL 用**裸 CDP**（Chrome DevTools Protocol）驱动浏览器，不依赖 Playwright。
以下协议与踩坑均来自 2026-10-11 对小红书/抖音的实测。

## 客户端协议

```
GET http://127.0.0.1:<port>/json/list   → 挑 type=="page" 的 target
ws  <target.webSocketDebuggerUrl>       → 一条 websocket，递增 id，跳过事件消息
```

用到的 CDP 方法：

| 方法 | 用途 |
|---|---|
| `Page.navigate` | 真导航（**不要用 `location.href` 赋值**） |
| `Runtime.evaluate` | 取 SSR 文本 / DOM 数据（`returnByValue: true`） |
| `Network.getAllCookies` | 读 cookie，**唯一能看到 httpOnly 的方式** |
| `Page.captureScreenshot` | 截图；`clip` 可只截元素或切片 |
| `Page.printToPDF` | 出 PDF；`paperWidth/paperHeight` 决定版心与 media query |
| `Emulation.setDeviceMetricsOverride` | 设定视口宽度与 `deviceScaleFactor` |

浏览器后端通常是反检测容器（cloakserve 多路复用器，单端口按 `?fingerprint=<seed>` 分发独立身份）。
客户端实现见 `scripts/platform_capture.py` 的 `Session` 类。

## 踩坑清单

### 导航

- **`Page.navigate` ≠ `location.href`。** 后者在已加载的 SPA 页面里会被路由守卫弹回首页，
  症状是「导航到 `/login` 却停在 `/explore`」。所有导航都用 `Page.navigate`。
- **`GET/PUT /json/new` 在部分多路复用器上返回 404**（不支持开新 target）。
  需要在干净上下文里打开页面时，先 `Page.navigate` 到 `about:blank` 再跳目标，
  或走浏览器级 `Target.createTarget`。

### 登录态

- **`web_session` 是 httpOnly，`document.cookie` 读不到。** 用页面内 JS 判断登录态会得到
  **稳定的假阴性** —— 实测浏览器已登录，网页 JS 仍报 `hasWebSession: false`。
  判断登录态一律用 `Network.getAllCookies`。
- **未登录视图的指标是概数。** 同一账号：未登录 `fans: "1千+"`、`likes: "1千+"`；
  登录后 `fans: 7838`、`follows: 39`、`engagement: 7917`。**实抓必须在登录态下做**，
  否则拿到的「精确值」其实是概数。
- **小红书裸主页链接 302 到登录页**，必须走带 `xsec_token` 的分享链（如 `xhslink.cn/o/xxx`）
  才能读公开画像；**搜索接口更要登录态**，未登录返回「登录后查看搜索结果」。
- **抖音用户页无需登录即可读**，但**抖音搜索需登录**（返回扫码登录弹窗）。
- 容器内通常只有 Xvfb 无 VNC，**扫码登录靠 `Page.captureScreenshot` 存 PNG 给用户扫**；
  且二维码有时效，掉线后要重出（注意别在扫码过程中导航）。

### 小红书页面结构

- **SSR `userPageData` 是 Vue ref，且对象含循环引用**（`deps → sub → deps`）。
  对它调 `JSON.stringify` 必抛 `Converting circular structure to JSON`。
  **正确做法**：从 `<script>` 里取出含 `__INITIAL_STATE__` 的原始文本，交给 Python 侧解析。
- **SSR 是 JS 不是严格 JSON**：值位置会出现裸 `undefined` / `NaN`，解析前需补成 `null`。
  否则 `JSONDecodeError: Expecting value`。
- 笔记卡片的 `noteCard.noteId` 常为空串，**要拿 noteId 得从 DOM 的 `a[href]` 取**。
- **读笔记正文必须先拿 `xsec_token`，而主页卡片对同一条笔记有「两个」锚点：**

  ```html
  <a href="/explore/<noteId>">                                  <!-- 无 token，打开必 404 -->
  <a class="cover" href="/user/profile/<uid>/<noteId>?xsec_token=...">  <!-- 有 token，可用 -->
  ```

  用 `querySelector('a[href*="/explore/"]')` 取「第一个匹配」会**静默拿到坏的那个**，
  表现为「登录态下打开自己账号的笔记也 404（`error_code=300031`）」。
  正确做法是**只筛带 `xsec_token=` 的锚点**，把 `noteId → token` 采集下来，
  再用 `…/user/profile/<uid>/<noteId>?xsec_token=<token>&xsec_source=pc_user` 打开。
  实现见 `scripts/platform_capture.py` 的 `TOKEN_MAP_JS` 与 `note` 子命令。
- **笔记详情页需要 token**：`explore/<noteId>?xsec_token=<token>&xsec_source=...`；
  不带 token 会跳 `error_code=300031` 404 页 —— 登录态也一样，token 是硬要求。
- **`notes` 子命令靠滚动采集全量笔记**（首屏只加载约 30 张卡片）。
  笔记卡片上**没有发布日期**；日期只在 SSR 的 `time` 字段里、且 SSR 只覆盖首屏那一批。
  要全量时间线，得配合 `note` 逐条读正文里的日期，或用主页的排序+位置推断。

### 对标账号怎么捞

- **不要用搜索页的「用户」标签找对标。** 实测关键词含「同城」时，「用户」标签返回的是
  本地 B2B 商家（回收、装饰、跑腿、写字楼），不是内容竞品。
- **正确做法**：在「笔记」标签抓搜索结果里每条笔记的**作者**，按账号聚合 ——
  这样得到的是「真的在发这类内容」的账号，且有笔记级互动证据。

### 读操作节流

平台风控节流的是**读**，不只是写。多关键词 sweep 之间必须有停顿
（脚本内置 8s 间隔，实现为 `SWEEP_GAP_S`），不要并发或零延迟连发读请求。

### 截图与导出（做交付物时）

- **`clip.scale` 是放大已渲染的位图，会出毛边。**
  要清晰必须让浏览器**原生**按高 DPI 渲染：设 `deviceScaleFactor`，并让 `clip.scale = 1`。
- **超长页面截图有高度上限**：按 `SLICE` 切片截取后用 Pillow 纵向拼接。
- **出 PDF 时版心宽度决定 media query**：`paperWidth` 设成手机宽度（如 414/96 英寸）
  才会命中移动端样式，手机上不用缩放即可读。
- **`break-inside: avoid` 不要下在整张卡片上**，否则卡片被整块推到下一页、留下大片空白；
  只保护不该被切断的单元（表格行、图表、提示块）。
