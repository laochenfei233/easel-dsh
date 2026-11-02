---
feature: easel-upstream-adoptions
status: delivered
updated: 2026-10-28
branch: feat/easel-upstream-adoptions
worktree: .worktrees/easel-upstream-adoptions (base master 7539b7f780, node_modules junction)
commits: 7539b7f780..913af4ed3f
---

# Easel Upstream Adoptions（上游参考点 1–3）

## Report

**What was built** — 参考上游 ZJU-REAL/Easel 三项设计落地：① 拆解采集流水线支持断点续跑——`job.json` 即检查点，`POST /easel/api/deconstruct/:id/retry` 后按产物存在性跳过已完成段（下载/抽帧/ASR），ASR 内部再细到分段级 sidecar（`<stem>.asr-partial.json`，mtimeMs+size 身份校验，重试只补缺失段），SRT 改落批次目录修掉全任务互覆的真 bug，拆解页 failed 态新增「从失败处继续」；② compaction 触发时输出结构化记录（pressure 全四字段 `{contextWindow, thresholdTokens, totalTokens, trigger}`，context-overflow 按其不解析模型容量的既有契约只记 `{totalTokens, trigger}`）——曾一并交付的 easel 诊断路由按用户判断回撤（dsh 原生 ContextMeter/`resolveModelInfo` 已覆盖，「可覆盖」内核本就具备，零改动）；③ 资源保护对表——video_fetch 下载 2 GiB/文本 16 MiB 上限（超限固定报错、半成品不留盘），`/easel/api` 兜底与 ASR 错误不再回显内部错误与远端响应体，sdk JSON-RPC 行缓冲 64M 字符上限。

**Verification** — `easel/dsh-plugin-easel` `node --test` 293/293（基线 270；回撤 T5 前 300/300）；`packages/compaction/compaction-basic` vitest 152/152；`packages/sdk/protocol` vitest 22/22；`pnpm run build` run-gates 4 passed（Desktop bundle 门在 junction worktree 环境失败，PRE-EXISTING：`ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH` + install-lefthook 兄弟 worktree 配置冲突，apps/desktop 未被触碰）；client 编译门 `tsc -b tsconfig.client.json` exit 0（手动绕过 pnpm install 阻塞）。独立评审：12 条验收逐条 PASS（1 条 PARTIAL 已按其契约判可接受）、零 critical、三结论全过；评审建议 1/2/5 已修（`41df760321`）并复跑全绿；T5 回撤后全量复跑 293/293。

**Journey log**

- 上游「可覆盖」在 dsh 内核已存在（deepseek 每模型 `contextWindow` + 设置页输入框）——设计前先盘点现状砍掉一半范围。
- T5 诊断路由按用户判断回撤：dsh 原生 `resolveModelInfo` 与会话页 ContextMeter 投影已覆盖该需求，预使用查询属边际需求，不值得新面。
- retry 的 busy 检查与占锁之间隔着 await 会构成 TOCTOU——锁的检查与占必须同步完成（create 路由天然同步，resume 最初抄漏了）。
- 原子 JSON 写现存三处（index.js `writeJsonFile` / asr.js `writeJsonAtomic` / deconstruct.js 内联），收敛为 util 组零依赖工具留待后续。

## [S1] Problem

参考 ZJU-REAL/Easel 上游三项已验证设计落地到 easel-dsh：

1. **拆解长任务失败即全废**。采集流水线（下载→抽帧→ASR）任一步失败后重试会生成新目录全量重做；ASR 逐段串行转写、段间无落盘，任一分段失败整次作废。另有真 bug：`transcribeToSubtitle` 按输入 stem 落 `outputs/video/video.srt`，所有任务的字幕互相覆盖。
2. **压缩行为不可解释**。compaction 触发只有事后 `logger.info` 文案，没有「当时声明窗口/阈值/占用/触发原因」的结构化记录；easel 侧也没有查看某模型声明窗口的入口。
3. **边界资源保护缺口**。`video_fetch.mjs` 对不可信远端响应体无总量上限（`download()` 磁盘无限写、`http()` `text()` 内存无限读）；`/easel/api` 兜底 catch 把任意 `error.message` 回显给前端、ASR 把远端响应体片段带进用户可见错误；`packages/sdk` JSON-RPC 行缓冲无上限（失控子进程可撑爆内存）。

## [S2] Design

决策基调（Grill 已决）：单 spec 单分支基于 master；续跑做段级+ASR 分段级；上下文窗口只做可诊断（可覆盖内核已具备）；资源保护做真风险两项 + sdk 行上限保险。

### S2.1 拆解段级检查点续跑

- `job.json` 即检查点清单（已持久化 `video`/`frames`/`framesDir`/`framesError`/`srt`）。`createDeconstruct` 中的 `pipeline` 抽为 `runPipeline(projectRoot, job, transcribe)`，各段入口加产物存在判定：`video.mp4` exists → 跳 fetch（`video_fetch.mjs` 的已存在短路本就生效）；framesDir 存在且含 ≥1 张 jpg 或已记 `framesError` → 跳抽帧；`job.srt` 指向文件存在 → 跳 ASR。
- 新增 `resumeDeconstruct(projectRoot, id, transcribe)`：占锁发生在任何 await 之前（`DeconstructBusyError` 同步抛出，路由层转 409，杜绝并发 retry 双跑）；`readDeconstruct` 校验存在 → 重置 stage/error、**先落一次盘再启动**（轮询端不闪见旧 failed 态）→ 复用同一 `running` 单飞锁续跑。
- 路由：`DECONSTRUCT_ROUTES` 加 `POST deconstruct/:id/retry`，缺任务 404、busy 409。
- `writeJob` 换原子写（tmp+rename，deconstruct.js 内联小助手，不引 index.js）。

### S2.2 ASR 分段级检查点

- `transcribeToSubtitle` 逐段转写成功即追加落盘 sidecar：`<输入所在目录>/<输入 stem>.asr-partial.json`，内容 `{src: {mtimeMs, size}, segments: [{index, start, end, text}]}`；入口校验 src 身份（mtimeMs+size）匹配则复用已完成分段，只补缺失段。
- 全部成功后删除 sidecar；失败保留供续跑。入口发现输入已不存在时顺手清 sidecar。
- 用 mtimeMs+size 做身份而非内容哈希：续跑场景只需挡「换了输入复用旧结果」，无需加密级判定。

### S2.3 SRT 落位修复

- `transcribeToSubtitle` 增加可选 `outDir`/`outStem` 参数，缺省保持旧行为 `outputs/<stem>/<stem>.<format>`；deconstruct 调用传 jobdir（SRT 落 `outputs/_deconstruct/<id>/<id>.srt`），`job.srt` 存对应相对路径。`POST /easel/api/asr` 与其余调用方行为不变。旧 `outputs/video/` 孤儿目录不做清理。

### S2.4 上下文窗口可诊断

- 内核 `packages/compaction/compaction-basic`：`compactIfNeeded` 实际触发时追加一条结构化日志记录（`ctx.logger.info('compaction (trigger): %o', record)`），与既有 `shadowed …` 结果行并存。pressure 路径记录全四字段 `{contextWindow, thresholdTokens, totalTokens, trigger: 'pressure'}`；context-overflow 路径按其不解析模型容量的既有契约只记 `{totalTokens, trigger: 'context-overflow'}`（补窗口字段需在溢出恢复路径新增可抛错的适配器调用，得不偿失）。
- easel 侧不加诊断入口（曾加的 `GET /easel/api/diagnostics/context` 按用户判断回撤）：会话页 ContextMeter 已展示 used/window（`contextPressure` 投影），触发时占用由本节内核记录承载；「可覆盖」零改动：deepseek `defaultContextWindow`/`models[].contextWindow` 与产品设置页输入框已具备。

### S2.5 video_fetch 响应体上限

- `easel/skills/shared/scripts/video_fetch.mjs`：`download()` 增加流式总量上限（固定常量 2 GiB，属安全不变量；有 Content-Length 时先查后下），超限中止、删除半成品、固定错误文案；`http()` 文本读经 `readBodyText` 加 16 MiB 上限，超限固定错误。

### S2.6 错误信息卫生

- `index.js` serveApi 兜底 catch：非 ApiError 响应固定文案 `本地 API 错误`，完整错误 `console.error` 进服务端日志。
- ASR：远端响应体切片不再进入 `AsrError` 用户可见 detail（HTTP 错误保留状态码前缀、只透传远端 JSON 的官方 `error.message`/`message` 字符串字段，其余固定文案），原文 head 记日志。video_fetch stderr 尾部进 `job.error` 的现状**保留**——这是操作者需要的可行动诊断面。

### S2.7 sdk JSON-RPC 行上限

- `packages/sdk/protocol` `JsonRpcLineTransport`：累积行缓冲超 **64M 字符**（`DEFAULT_MAX_LINE_CHARS`，构造参数可调，UTF-16 保留内存上界约 128 MiB）即摘除监听、清缓冲、以仅含上限数值的固定错误拒绝在途请求，不回显行内容。

## [S3] Scope

- In scope：S2.1–S2.7 全部；每条验收路径的单元测试；插件 node --test 与受影响内核包 vitest 全绿；build:check 收口。
- Out of scope：interaction pending 上限、ACP 会话数上限、tauri `read_to_string` 上限、lan-handoff listener 并发上限（未合并分支）、压缩按请求临时覆盖、上下文诊断 UI 卡片、旧 `outputs/video/` 孤儿清理、报告段（startAnalyze）重跑改造（本就独立可重跑）、原子 JSON 写三处收敛为 util 工具。
- 已知交互：`feat/easel-breakdown-kuaishou`（未合并，同改 `deconstruct.js`/`video_fetch.mjs`）合并时需手动处理冲突。

## Tasks

- [x] T1: deconstruct `runPipeline` 拆分 + 段级跳过 + `resumeDeconstruct` + retry 路由 + 原子 `writeJob` (depends: T3)
- [x] T2: ASR 分段 sidecar 落盘与复用 (depends: T3)
- [x] T3: `transcribeToSubtitle` 输出位置参数化，deconstruct 传 jobdir (depends: none)
- [x] T4: compaction-basic 结构化触发记录 + 测试 (depends: none)
- [x] T6: video_fetch 下载/读上限 + 测试 (depends: none)
- [x] T7: serveApi 固定文案 + ASR 错误卫生 (depends: T2)
- [x] T8: sdk transport 64M 字符行上限 + 测试 (depends: none)
- [x] T9: 拆解页 failed 态「从失败处继续」按钮接 retry 路由 (depends: T1)

## [S4] Acceptance

- [x] ASR 中断的任务 POST retry 后：video.mp4 与 frames 的 mtime 不变（不重下不重抽），已完成 ASR 分段不重转，仅补缺失段；SRT 落在批次目录且两个任务互不覆盖。
- [x] 任一分段转写失败 → 整任务 failed；retry 只重跑失败段；全部成功后 sidecar 被清理。
- [x] compaction 触发时日志含结构化记录（pressure 全四字段；overflow 按 `{totalTokens, trigger}`）。
- [x] video_fetch：Content-Length 超限或流中超 2 GiB → 固定错误、无半成品残留；text 读超 16 MiB → 固定错误。
- [x] `/easel/api` 未知错误响应为固定文案，不含 `error.message`。
- [x] sdk transport 超限单行 → 固定协议错误并断开，不回显内容。
- [x] `easel/dsh-plugin-easel` node --test 全绿；`compaction-basic`、`sdk protocol` vitest 全绿；client 编译门通过；build 产出门通过（Desktop bundle 门为环境性 PRE-EXISTING）。
