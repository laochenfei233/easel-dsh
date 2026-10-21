---
name: skill-zhihu-answer
description: >-
  知乎问答回答发布：在知乎问题下发布原创回答——搜热门问题、检查可答性、写内容、
  Playwright 发布（绕 header 遮挡 + JS 遍历发布按钮）。当用户说"回答知乎问题""在知乎问答下回答"
  "发知乎回答""知乎答题""帮我回答这个知乎问题""批量回答知乎"时使用。与 skill-zhihu-publisher
  区别：那个发**专栏文章**（zhuanlan），本 SKILL 专发**问答区的回答**；回答内容写作用制作层 SKILL
  （novel-writer / copywriting）。
layer: publish
---

# skill-zhihu-answer（发布层 · 知乎问答回答）

> 在知乎问答帖子下发布原创回答：搜索热门问题 → 检查可答性 → 调用制作层 SKILL 写内容 → browser 工具驱动发布。
> 发布由 agent 用 dsh browser-use 浏览器工具直接驱动（browser_navigate / browser_snapshot /
> browser_click / browser_type / browser_wait_for / browser_run_code_unsafe / browser_take_screenshot），
> 无 Python 发布脚本；浏览器流程速查见 `references/commands.md`。
> 约定：截图 filename 一律**工作区相对路径**（绝对路径被拒；pushTask 会话工作区=项目根）；
> 状态文件读写用文件工具，不走 shell。

---

## 与其他 SKILL 的区别

| SKILL | 定位 |
|---|---|
| **skill-zhihu-answer（本 SKILL）** | 知乎问答帖的**回答发布**：搜题 + 写内容 + 发布 |
| skill-zhihu-publisher | 知乎**专栏文章**（zhuanlan）发布，非问答回答 |
| skill-cross-platform-publish | 一稿多发，多平台分发 |
| novel-writer / copywriting | 制作层，生产回答正文；本 SKILL 调用它 |

---

## ① 前置：登录态检查

一切动作前先读 `outputs/_login/zhihu.json`（协议 `{"state","message","qr","ts"}`）：

| state | 含义 | 动作 |
|---|---|---|
| `success` | 已登录（可附 `name`/`avatar` 字段） | 直接进主流程 |
| `qr_ready` / `window_login` / `scanned` / `sms_required` / `verifying` | 上次登录中断 | 重新走登录节 |
| `expired` / `error` | 已过期 / 上次失败 | 走登录节 |
| 文件不存在 / 损坏 / `unknown` | 未登录 | 走登录节 |

---

## ② 登录节（agent 驱动浏览器）

1. `browser_navigate` → `https://www.zhihu.com/signin`。
2. `browser_snapshot` 检测登录框：选择器系 `.SignContainer`、`.Login-content`；知乎登录页默认就在扫码 tab。
3. `browser_take_screenshot`，filename=**`outputs/_login/zhihu-qr.png`**（工作区相对路径；截整页或登录框元素均可）。
4. 用文件工具写 `outputs/_login/zhihu.json`：
   `{"state":"qr_ready","message":"二维码已就绪","qr":"<qr 文件的绝对路径>","ts":<秒级 unix 时间戳>}`
   —— `qr` 字段是**绝对路径**（前端轮询此文件展示二维码），与 filename 的相对路径要求不冲突。
5. 轮询登录成功：`browser_wait_for` 等约 30 秒 → `browser_snapshot` 检查 URL 已离开 `/signin`（回到知乎页）或页头出现用户头像/菜单；未成功则重复「等待-检查」，**总时长 ≤ 3 分钟**。
6. 成功 → 改写 zhihu.json 为 `{"state":"success",...}`（可附 `name`/`avatar`）；超时/失败 → 写 `{"state":"expired","message":"<现象>"}`。

> **manual / cdp 模式**由 dsh 侧 provider 配置决定（`headless:false` 弹有头浏览器人工操作；`mode:attach` 接管已有浏览器），本节流程两种模式下不变。

---

## ③ 主流程节（发回答）

### 3.1 制作层写内容

回答正文属于制作层，**用制作层 SKILL 写**（`novel-writer` 或 `copywriting`），也可用用户提供的文本。
内容存为 `outputs/主题名/answer_<问题ID>.md`。

写作要点（恐怖/悬疑题材示例）：第一人称、冷静克制、暗示>直白；短段落多换行适配手机；
开篇 500 字内建立世界观 + 第一个恐怖节点；文末加"本故事纯属虚构"。

### 3.2 搜索热门问题（可选，或用户直接给 URL）

`browser_navigate` → `https://www.zhihu.com/search?type=question&q=<关键词>` → `browser_snapshot` 列候选；
**逐个访问候选问题页**取真实数据（搜索结果元数据不准）：从快照正文找「N 个回答」字样与 `.WriteAnswerButton`。

### 3.3 检查可答性

问题页 `browser_snapshot`：
- 有 `.WriteAnswerButton` → 可答。
- 按钮文本是「编辑回答」→ 该问题**已答过**（每人一题只能一答），跳过；不要进入编辑旧答案流程（发布按钮会变「提交修改」）。

### 3.4 发布前过闸（内容 + 人设）

```bash
cd <项目根> && python skills/shared/scripts/content_guard.py scan --file <回答内容.md>
# 退出码 7 = 检出 BLOCK 级泄露（密钥/内部地址），停止发布，让用户删改后重扫；0 = 通过（WARN 级 AI 措辞仅提醒，自行判断）
```

```bash
cd <项目根> && python skills/shared/scripts/persona_gate.py check --score <评分>
# 始终退出码 0；低于 80 分时告知偏离点，但不阻断用户发布
```

### 3.5 点「写回答」（三策略按序尝试）

> 根因：知乎顶部 `<header class="AppHeader">` 覆盖「写回答」按钮，普通 click 被 pointer event
> 拦截而超时，必须绕过覆盖层。若按钮文本为「编辑回答」（已答过），对它执行同样的三策略。

每策略执行后等约 3 秒再 `browser_snapshot`，检查编辑器出现（选择器见 3.6）即停，否则下一策略：

1. 策略1 `browser_run_code_unsafe`：对 `.WriteAnswerButton` 执行 `dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}))`（绕 header，多数页面有效）。
2. 策略2 `browser_run_code_unsafe`：React 完整鼠标事件序列——对同一元素依次 dispatch `mousedown`、`mouseup`、`click`（均 bubbles）。
3. 策略3 `browser_run_code_unsafe`：`btn.focus()` + `keyboard.press('Enter')`（最可靠降级，焦点触发 React 事件）。

### 3.6 Draft.js 编辑器写入

按序尝试五候选选择器，取首个可见者：

```
.DraftEditor-editorContainer [contenteditable=true]
[contenteditable=true][data-contents]
.public-DraftEditor-content
.AnswerForm [contenteditable=true]
[contenteditable=true]
```

写入步骤：
1. `browser_click` 编辑器激活；
2. **Ctrl+A → Backspace 清空已有草稿**（不清空会把新内容接在旧稿后面）；
3. **按段落逐段输入**：非空段用 `browser_type` 慢速输入，段间用 `browser_run_code_unsafe` 按 `Enter` 换行（Draft.js 不识别文本里的 `\n`）。

---

## ④ dry-run 契约（默认停在发布前一步）

- 写完内容后 `browser_take_screenshot`，filename=**`outputs/_login/zhihu-preview.png`**，交用户确认；**绝不点击发布**。
- 只有任务 prompt 明确带 **`--exec`** 才执行发布点击：
  1. `browser_run_code_unsafe` JS 遍历全部 `<button>`，精确匹配文本含「发布回答」或「提交修改」（同页有「发布设置」按钮，勿误点），先 `scrollIntoView` 再 dispatchEvent click（按钮可能滚出视口，locator visible 等待会超时）；
  2. 降级：`browser_click` 定位 `button:has-text('发布回答')` / `button:has-text('提交修改')`。
- 点击后按 **URL 变化**（出现 `/answer/`）或页面成功信号判定；**未核实绝不冒报成功**。

### 评论抓取

`browser_navigate` 文章/回答页 → `browser_run_code_unsafe` 两次 `window.scrollTo(0, document.body.scrollHeight)` 触发懒加载（各等约 2s）→ `browser_snapshot` 找「查看全部评论」/「加载更多」并 `browser_click` → 产出 JSON
`[{"id","author","content","vote_count","created_time","reply_to"}]`，用文件工具写到任务指定文件。

- 首选通道：provider 若提供 `browser_network_requests`，过滤 URL 含 `comments` 且 `api/v4` 的响应，取 `data[]`（字段映射 `author.name` / `reply_to_author.name`）。
- DOM 兜底选择器（按序，取首个命中者）：`.CommentContent`、`.comment-content`、`[class*="CommentItem"] p`、`[data-za-detail-view-element_name="Comment"] p`。

---

## ⑤ 失败处置

- 任一步失败：先 `browser_snapshot` 留 DOM 摘要，`browser_take_screenshot` 存 `outputs/_login/zhihu-fail-<步名>.png`，再把 `{"state":"error","message":"<哪一步+现象>","ts":...}` 写进 zhihu.json，供校准与前端展示。
- 重试上限（沿用原脚本行为）：写回答三策略各试一次、发布点击两条路径各试一次，**绝不重复整轮、绝不无限重试**。

---

## 发布后留痕

```bash
cd <项目根> && python skills/shared/scripts/persona_gate.py record \
    --topic <主题> --profile <画像> --score <评分> --verdict <pass|warn>

cd <项目根> && python skills/openclaw/skill-publish-log/scripts/log.py record \
    --platform 知乎 --title <问题标题> --profile <画像> \
    --persona-score <评分> --persona-verdict <结论> --skill-source zhihu-answer
```

---

## 批量发布多个问题

1. 列出问题 URL + 对应内容文件；2. 逐页检查可答状态；3. 制作层**写完全部内容再发布**（避免写一篇发一篇的上下文碎片化）；4. 逐题**串行**发布；5. 每题间隔约 30 秒降低风控。

---

## 已知限制与风险

| 问题 | 说明 |
|---|---|
| 同一问题只能回答一次 | 「编辑回答」= 已答过，跳过该题 |
| 知乎 Draft.js 编辑器 | 只支持纯文本段落，Markdown `**加粗**` 不渲染、会原样显示星号 |
| header 遮挡 | 三策略 dispatch 绕过（3.5） |
| 发布按钮视口外 | JS 遍历 + scrollIntoView 绕过（④） |
| 反爬风控 | 反检测启动参数由 browser-use provider 配置；发布间隔 ≥ 30s |
| 登录态 | 读 `outputs/_login/zhihu.json`；缺失/过期走登录节 |

---

## 依赖与验证

```bash
python skills/shared/scripts/content_guard.py selftest    # 内容闸门自测
python skills/shared/scripts/persona_gate.py selftest     # 人设闸门自测
```
