# skill-zhihu-answer 浏览器流程速查

发布由 agent 用 dsh browser-use 浏览器工具驱动（无 Python 发布脚本）。
协议脚本仍在：`content_guard.py`、`persona_gate.py`（CWD=项目根，`cd <项目根> &&` 前缀）。
截图 filename 一律**工作区相对路径**（绝对路径被拒）；pushTask 会话工作区=项目根；
状态文件读写用文件工具，不走 shell。

## 0. 前置：登录态

读 `outputs/_login/zhihu.json` → `{"state","message","qr","ts"}`：

- `success` = 已登录（可附 name/avatar）→ 直接进主流程
- `expired` / `error` = 走登录节；`qr_ready` 等中间态 = 上次登录中断，重新走登录节
- 文件不存在 / 损坏 = 未登录，走登录节

## 1. 登录（agent 驱动）

1. `browser_navigate` → `https://www.zhihu.com/signin`
2. `browser_snapshot` → 检测登录框 `.SignContainer` / `.Login-content`
3. `browser_take_screenshot` filename=`outputs/_login/zhihu-qr.png`
4. 文件工具写 zhihu.json：`{"state":"qr_ready","message":"二维码已就绪","qr":"<qr 文件绝对路径>","ts":<秒级 unix ts>}`（qr 是绝对路径，前端轮询展示）
5. `browser_wait_for`（约 30s）→ `browser_snapshot` 查 URL 离开 `/signin` 或用户头像出现；总轮询 ≤ 3 分钟
6. 成功改写 `state=success`（可附 name/avatar）；超时写 `state=expired`

## 2. 搜题 + 可答性

- `browser_navigate` → `https://www.zhihu.com/search?type=question&q=<关键词>`，快照里列候选
- 候选问题页**逐个访问**核实：快照正文找「N 个回答」（搜索结果元数据不准）
- `.WriteAnswerButton` = 可答；「编辑回答」= 已答过，跳过（别做成「提交修改」）

## 3. 内容过闸 + 人设

```bash
cd <项目根> && python skills/shared/scripts/content_guard.py scan --file <回答内容.md>
# 退出码 7 = BLOCK 级泄露，停止发布；0 = 通过（WARN 级 AI 措辞仅提醒）

cd <项目根> && python skills/shared/scripts/persona_gate.py check --score <评分>
# 始终退出码 0；低于 80 分告知偏离点，不阻断
```

## 4. 点「写回答」三策略（每策略后等 ~3s + snapshot 查编辑器）

> 根因：顶部 `header.AppHeader` 覆盖按钮，普通 click 被 pointer event 拦截超时。

1. `browser_run_code_unsafe`：对 `.WriteAnswerButton` dispatchEvent click（bubbles）
2. `browser_run_code_unsafe`：对同一元素依次 dispatch `mousedown` → `mouseup` → `click`
3. `browser_run_code_unsafe`：`btn.focus()` + `keyboard.press('Enter')`

## 5. Draft.js 编辑器写入

选择器按序取首个可见：

```
.DraftEditor-editorContainer [contenteditable=true] → [contenteditable=true][data-contents]
→ .public-DraftEditor-content → .AnswerForm [contenteditable=true] → [contenteditable=true]
```

点击激活 → Ctrl+A → Backspace 清旧稿 → 非空段逐段 `browser_type` 慢速输入，段间 `browser_run_code_unsafe` 按 Enter（Draft.js 不识别 `\n`）。

## 6. dry-run / 发布（--exec）

- 默认：`browser_take_screenshot` filename=`outputs/_login/zhihu-preview.png` 交用户确认，**不点发布**
- prompt 带 `--exec` 才点：
  - `browser_run_code_unsafe` JS 遍历全部 button，精确匹配「发布回答 / 提交修改」（避开「发布设置」），scrollIntoView + dispatchEvent click
  - 降级 `browser_click`：`button:has-text('发布回答')` / `button:has-text('提交修改')`
- 判定：URL 出现 `/answer/` 或成功信号；未核实不冒报成功

## 7. 评论抓取

`browser_navigate` 文章/回答页 → `browser_run_code_unsafe` 两次 `window.scrollTo(0, document.body.scrollHeight)`（各等 ~2s 触发懒加载）→ `browser_snapshot` 找「查看全部评论 / 加载更多」并 `browser_click` → JSON 写任务指定文件。

- 首选：`browser_network_requests` 过滤 URL 含 `comments` 且 `api/v4` 的响应，取 `data[]`（author.name / reply_to_author.name）
- DOM 兜底按序：`.CommentContent` → `.comment-content` → `[class*="CommentItem"] p` → `[data-za-detail-view-element_name="Comment"] p`

## 8. 失败处置 + 留痕

- 失败：`browser_snapshot` 留 DOM 摘要 + `browser_take_screenshot` filename=`outputs/_login/zhihu-fail-<步名>.png` + zhihu.json 写 `{"state":"error","message":"<哪一步+现象>","ts":...}`；三策略/两路径各试一次，不重复整轮

```bash
cd <项目根> && python skills/shared/scripts/persona_gate.py record \
    --topic <主题> --profile <画像> --score <评分> --verdict pass

cd <项目根> && python skills/openclaw/skill-publish-log/scripts/log.py record \
    --platform 知乎 --title <问题标题> --profile <画像> \
    --persona-score <评分> --persona-verdict pass --skill-source zhihu-answer
```

## 9. 自测

```bash
python skills/shared/scripts/content_guard.py selftest
python skills/shared/scripts/persona_gate.py selftest
```
