---
feature: easel-context-menu
status: delivered
updated: 2026-10-20
branch: feat/easel-context-menu
commits: 7c5b25e..5c67e55
---

# 全局右键菜单（对话 / 文件 / 输入框）

## Report

**What was built** — `dsh-plugin-easel` 新增客户端子插件 `easel-context-menu`（0.2.16）：一个 document 捕获阶段的 `contextmenu` 监听器，只接管三处表面，其余保留原生右键。对话文字菜单四项（复制 / 复制 Markdown 引用 / 添加到当前任务 / 在辅助对话中提问）；文件菜单七项（预览 / 打开 / 打开方式… / 在文件管理器中显示 / 复制相对路径 / 复制绝对路径 / 复制文件名），目录行去掉预览与打开方式；输入框菜单八项（撤销 / 重做 / 剪切 / 复制 / 粘贴 / 粘贴为纯文本 / 删除 / 全选）带平台快捷键提示。菜单是纯 DOM（无 React、portal 到 body、role=menu、方向键/Home/End/Esc、外点/滚动/resize/失焦关闭、视口 clamp），样式走 dsh 的 `--dsw-*` token。「复制」用 Clipboard API + execCommand 兜底；文件动作走 dsh 已认证的 `ctx.remote.session.openWorkspacePath`；「添加到当前任务」把 `> 引用` 插到当前 composer 光标处；「在辅助对话中提问」用 `ctx.uiWorkspace.startSession(undefined, { prompt, clearPreviousDraft: true })` 在当前工作区新开会话并预填同一段引用。

**Verification** — `npm test` 92/92（新增 `test/context-menu.test.js` 12 例：表面判定/无选区消息回退/时钟行剔除、相对路径、引用块、文件名）；`node build.mjs` 产出 `client.js` 564,297 bytes（~551 KiB）且含全部菜单字符串；happy-dom DOM smoke 全绿（三表面菜单、复制/Markdown 引用/添加/新会话、预览点击、相对路径、打开方式应用列表、全部八个编辑命令、方向键、Esc、聚焦恢复、未接管区域不拦截）。真实 dsh web（scratch profile + Playwright/Chromium）：输入框菜单 8 项且全选选中 `hello draft`；对话菜单 4 项，添加后 composer 变为 `> hello world`；辅助会话新开成功，草稿为 `> hello world` 并可继续键入；文件树 33 行，菜单 7 项，相对路径剪贴板 `.env`，预览在右侧栏打开 `.env`，打开方式列出 19 个真实关联应用（记事本（默认）、百度网盘、Bandizip、…、写字板）；Lexical composer 上剪切清空、撤销改稿、重做恢复 `abc`、粘贴 `PASTED` 全部生效，Esc 后焦点回到 composer；菜单在视口右下与左上均不越界。已安装应用（`%LOCALAPPDATA%\Easel-dsh`，0.2.16 热更后重启）：对话菜单在**无选区消息**上出现，assistant 复制得到精确正文，user 复制剔除时钟行（`hi`）；消息末尾 `report.md` 成品卡与正文内联文件名右键均出文件菜单，复制相对/绝对路径正确，预览新开侧栏 tab，打开方式列出 20 个真实应用（marktext（默认）、WPS Office、VSCodium、…），文件树行同样 20 个。「打开」「在文件管理器中显示」未点击真实拉起外部程序（避免副作用），两者与已实测的打开方式共用 `openWorkspacePath`。

**Journey log** — ①侧栏辅助对话方案撞 `sidebar.chat.conversation` 的单声明者规则（ui-subagent 已声明），插件 apply 抛错后菜单监听器根本没装上——先加 `console.info` 定位；②自注册 `easelchat` 资源 + tab 时，资源 provider 提前释放导致 `conversation.input.for` 报「requires a retained Session scope」；③改成 tab 内 `retain` 后 binding 与驻留 composer 不同代，`requestDraftInitialization` 返回 applied 但草稿不落编辑器；④`ctx.sessions.create()` 未带 cwd 让新 composer 处于不可编辑态，是假阴性；⑤最终回到 dsh 自己的 `startSession` beforeOpen 事务，一次通过；⑥用户实机反馈「新版本没有」——原实现要求先选中文字，右键消息本身不弹菜单；补上消息 seat 的无选区回退（user 气泡时钟行剔除）后，已安装运行时热更到 0.2.14 并验证；⑦用户反馈「末尾的文件右键不显示文件内容」——成品卡/内联文件名原被当成对话文字；补上 `[data-presented-file]` 与 `button[title]` 文件表面后，又发现 junction 路径让 Host `openWorkspacePath` 校验失败（打开方式报「无法读取文件关联」），改用 `workspaceFiles.stat` 的 canonical absolutePath 后 0.2.16 通过。

## [S1] Problem

Easel-dsh 的三处高频右键仍是宿主默认行为：

- **对话文字**：只能走 WebView/浏览器的原生复制，没法把选中片段送回当前输入框，也没法带着这段上下文另开一个辅助对话。
- **文件树**：dsh 的 `ui-sidebar-files` 明确「Listing only — no context menu」，右键没有任何动作；用户要先左键点开预览，再去找侧栏头部的「打开」/「打开方式」。
- **输入框**：原生菜单只给系统级剪贴板项，没有「粘贴为纯文本」，也没有和 dsh 主题一致的呈现。

目标：一个客户端插件接管这三处的 `contextmenu`，用与 dsh 主题一致的菜单替换原生右键。

## [S2] Design

- **落点 = 现有 `dsh-plugin-easel` 的一个客户端子插件 `easel-context-menu`**（`src/features/context-menu.js`，在 `src/features/index.ts` 的 `CLIENT_PLUGINS` 挂载）。不建新包：媒体渲染器已定过同一先例（`easel-media-renderer` S2「落点=现有插件，不建新包」），新包会多出一整条安装/同步/stamp 面。
- **接管方式**：`document` 捕获阶段监听 `contextmenu`。命中的三类表面 `preventDefault() + stopPropagation()` 并弹自绘菜单；其余表面（侧栏会话行、设置页…）保持原生右键；对话内的代码块按「文字选区」同一规则处理，避免为了三个菜单接管整站。
- **表面判定**（纯函数 `resolveSurface`，`src/lib/context-menu-model.js`）：
  - 文件：`target.closest('[data-files-entry]')` 且祖先有 `[data-files-root]`；`data-files-path` = 绝对路径，`data-files-entry` = `file|directory|other`。`other` 不接管。
  - 输入框：`target.closest('[data-composer-input], textarea, input:not([type=checkbox]):not([type=radio]), [contenteditable="true"]')`。dsh 输入框是 Lexical 的 `[data-composer-input]`。
  - 对话文字：有选区时要求 `target.closest('[data-chat-flow]')` 且选区锚点/焦点落在该流内；无选区时回退到消息 seat `[data-chat-node-key]`，仅 `data-chat-flow-kind` 为 `user` / `assistant-step` 的节点取 `innerText`（user 节点尾部的 `10月20日 23:51` 时钟行剔除），过程行保持原生。
- **菜单 = 原生 DOM**（无 React 依赖，portal 到 `document.body`，`position: fixed`；`role=menu/menuitem`、方向键/Home/End/Esc、外点/滚动/resize/窗口失焦关闭；视口内翻转 clamp）。样式注入一次 `<style id="easel-context-menu-style">`，用 dsh 的 `--dsw-alias-*` token，缺失时回退中性色。
- **对话文字菜单**：复制 / 复制 Markdown 引用 / 添加到当前任务 / 在辅助对话中提问。
  - **添加到当前任务** = 追加到当前会话输入框草稿（不改已有内容）：`ctx.conversation.input.for(binding.ctx).actions.captureInsertion()` + `insertText()` 在光标处插 `\n\n> 选中文字\n\n`；无 `actions` 时退化为 `setDraft(currentDraft + block)`；完成后 `focus()` 回输入框。这是对「任务」一词的最小可行解释（当前对话的下一轮输入）。
  - **在辅助对话中提问** = `ctx.uiWorkspace.startSession(undefined, { prompt, clearPreviousDraft: true })`：在当前工作区新开一个会话，草稿预填 `> 选中文字`，当前会话保留在会话列表。**实现转折**：先试过 fork + 自注册侧栏 tab（资源协议 + `sidebar.chat.conversation`），两点撞墙——该 slot 名已被 ui-subagent 的 tab 声明（一个 slot 只能有一个声明者），且本地 `retain` 出来的 binding 与驻留 composer 使用的 binding 不同代，`requestDraftInitialization` 返回 applied 但草稿不落到编辑器。改用 dsh 自己的 `startSession` beforeOpen 事务后一次通过（原先的直接 `sessions.create` 无 cwd，composer 处于不可编辑态，也是假阴性来源之一）。
  - **复制 Markdown 引用**（额外）= 复制 `> 行` 形式的引用块，方便粘进 Issue/笔记。
- **文件菜单**：预览 / 打开 / 打开方式 ▸ / 在文件管理器中显示 / 复制相对路径 / 复制绝对路径 / 复制文件名（额外）。文件表面包含三类：文件树行 `[data-files-entry]`、消息末尾的成品文件卡 `[data-presented-file]`（卡内隐藏 preview 按钮的 `title` 是绝对路径）、正文内联文件名 `button[title]`（title 是工作区相对路径，按当前会话 cwd 拼接）。
  - **预览** = 触发表面自带的预览按钮（`surface.preview.click()`：文件树行是行按钮，成品卡是隐藏的 cardPreview 按钮，内联文件名是 mention 按钮），走 dsh 原生的 `tab.actions.openResource`，落到正确的会话/分栏。
  - **打开 / 打开方式 / 在文件管理器中显示** = 先用 `ctx.remote.workspaceFiles.stat(sessionId, 相对路径)` 取 Host 的 canonical `absolutePath`（安装布局 `%LOCALAPPDATA%\Easel` 是 junction，直接传 junction 路径过不了 Host 的 realpath 相等校验），再 `ctx.remote.session.openWorkspacePath({path})`（打开方式带 `application`，显示用 `{path, action:'reveal'}`），应用列表来自 `workspacePathApplications({path})`；点「打开方式」后在原菜单内换成加载态 → 真实应用列表（默认项带 `（默认）`），失败/空给「无法读取文件关联」/「没有可用的应用」+ 显示位置，全部走 dsh 已认证的 Host 路径，不新开宿主路由。
  - **复制相对路径** = 文件树行相对树根 `[data-files-root]`，成品卡/内联文件名相对会话 cwd；保留 `/` 分隔，根外路径返回归一化后的绝对路径。
  - 目录行不显示「预览 / 打开方式」，给「打开」「在文件管理器中显示」「复制相对/绝对路径」。
- **输入框菜单**：撤销 / 重做 / 剪切 / 复制 / 粘贴 / 粘贴为纯文本（额外）/ 删除 / 全选，带平台快捷键提示。实现：先 `focus()` 目标控件，再 `document.execCommand(...)`；粘贴优先 `execCommand('paste')`，被 WebView 拒绝时 `navigator.clipboard.readText()` + `insertText`；纯文本粘贴只走后者。`selectAll` 对 input/textarea 用 `.select()`，对 contenteditable 用 Range。
- **错误处理**：复制走 `navigator.clipboard` + execCommand 兜底；打开失败时，若当前会话输入框可用则 `input.notify('error', …)`，否则 `console.warn`；新会话的异步失败由 dsh 的 workspace notice 呈现；菜单本身绝不抛到全局。
- **版本**：插件 bump **0.2.16**。

## [S3] Scope

- In scope：
  - `src/lib/context-menu-model.js`（纯逻辑：表面判定、相对路径、引用块）
  - `src/features/context-menu.js`（菜单 DOM、三套菜单、动作）
  - `src/features/index.ts` 挂载 + `package.json` 0.2.16
  - `test/context-menu.test.js`
- Out of scope：
  - 侧栏会话行、代码块、终端等其它表面的右键
  - 菜单设置项/开关、快捷键自定义
  - 「添加到当前任务」写入 todo/plan 数据（当前任务=当前输入草稿）
  - 独立插件包与安装器改动

## Tasks

- [x] T1: `src/lib/context-menu-model.js` 纯函数 + `test/context-menu.test.js`（depends: none）
- [x] T2: `src/features/context-menu.js` 菜单 DOM 与对话/输入框菜单（depends: T1）
- [x] T3: 文件菜单 + 原位打开方式列表 + 路径复制（depends: T2）
- [x] T4: 辅助会话（`startSession` + 引用草稿）（depends: T2）
- [x] T5: 挂载、版本 bump、构建与回归（depends: T3, T4）

## [S4] Acceptance

- [x] 对话消息右键（有/无选区）→ 菜单出现；复制写入剪贴板；「添加到当前任务」把引用块插到输入框光标处且不发送
- [x] 「在辅助对话中提问」在当前工作区新开会话，草稿里已有引用块并可继续输入；原会话仍在会话列表
- [x] 文件树行、消息末尾成品卡、正文文件名右键 → 预览（侧栏打开该文件）、打开方式列出真实关联应用（打开/显示位置走 canonical path，未真实拉起外部程序）、两种路径复制均正确
- [x] 目录右键 → 打开/显示位置/复制路径可用，无预览项
- [x] 输入框右键 → 撤销/重做/剪切/复制/粘贴/粘贴为纯文本/删除/全选均生效，方向键与 Esc 可操作菜单
- [x] 未接管的区域仍弹原生右键；菜单外点/滚动/Esc 正确关闭；靠近视口边缘不越界
- [x] `node --test` 全绿；`node build.mjs` 产出 `client.js` 可加载
