---
feature: easel-project-materials
status: delivered
updated: 2026-10-17
branch: feat/easel-breakdown-page（Easel 仓 worktree .worktrees/easel-breakdown-page，延续插件侧权威线）
commits: fd7eda4..804d24f
---

# 立项工作区资料装配：立项即把选题资料装进项目目录

## Report

**What was built** — 立项动作从「建空目录」升级为「装配项目资料夹」。宿主新路由
`POST /easel/api/projectize`（`lib/projectize.js`）把 `projects/<safe>/` 播种为：
`选题.md`（标题/来源/立项日/备注原文——老拆解选题的整份报告在备注里，照存）、
`项目资料.md`（manifest：装配清单、原件路径、**产物约定——本项目创作产物一律写入本目录**）、
`拆解/`（报告与字幕复制，视频与关键帧**硬链接**——同卷零拷贝，失败逐项跳过并记 manifest）、
`画像/<name>/*.md`（立项时选择的账户画像快照）。前端立项改为弹窗确认（画像下拉，
`fetchStatus().personas` 复用，单画像默认选中；「不带入」可选）。拆解入库提示词给选题
写入 `deconstruct` 批次号建立关联（存量选题无关联只播 选题.md）；已立项选题「做内容」
经 `useTopic(title, projectDir)` 把项目目录与产物落点注入 prompt（`projectDir` 由宿主
写回选题卡）。顺带修复 `IDEA_STATUSES` 缺 `'project'`——立项状态此前被更新路由白名单
静默回退，刷新即跳回原列。插件 bump 0.2.3。

**Verification** — `node --test` 67/67 全绿（新增 4 用例：清洗含穿越回退、播种+硬链接
inode 相等断言、幂等+缺源降级+批次穿越、路由级选题卡置位+PUT 白名单回归门）；
`node build.mjs` 成功（2 个既有 es2024 警告，与本轮无关）；client.js 指纹
（projectize/fallback/选题.md）与三副本（staged runtime、%LOCALAPPDATA%\Easel、
~/.easel/profiles/node_modules）及版本戳（VERSION/.bundle-version=0.2.3）核对一致。
独立评审一轮：初判 spec FAIL（选题.md 漏备注原文，critical）+4 minor——全部修复后
复测全绿；正确性 PASS-WITH-MINORS（ws.create 失败吞掉致 toast 与状态可能不一致，
接受）、一致性 PASS。分支已并入 main（合并提交 6e373a4，插件线与 skills 线归一，
worktree/分支已清理）；随后打正式包 **`Easel-dsh_0.2.1-alpha.13_x64-setup.exe`
（126.2MB，2026-10-17 22:00）**：全量 build → bundle:runtime（stageEasel 自动读
main checkout，easel 0.2.3 staged）→ tauri build；载荷指纹验证过（VERSION=0.2.3、
projectize ×2/×3、dump-cookies 技能在、116 技能）。

**Journey log**
- 硬链接装配是零拷贝正解：NTFS 同卷 `fs/promises.link` 即可，测试用 inode 相等断言
  锁死「真硬链非复制」；EEXIST 视为幂等成功，重复立项不炸。
- 「放文件进工作区」对 agent 的真实价值不在文件本体（cwd=项目根本就处处可读），而在
  **关联与落点**：manifest 告诉 agent 本项目有什么/产物写哪里，`projectDir` 写回选题卡
  让「做内容」随时能注入——比拷贝大文件更本质。
- 立项状态丢失是白名单回退型 bug：`Set.has` 校验失败即静默回落旧值，前端 toast 却报
  成功——凡「枚举白名单校验」处，新增枚举值必须同步两处（前端列 + 后端 Set）。
- 交付链新坑：`EASEL_REPO ?? 主 checkout` 意味着**分支上的插件改动永远进不了默认
  NSIS 打包**；两 checkout（main 的 skills vs 分支的 plugin）各缺一半是「重排载荷」
  手工拼装反复出现的根因——本轮已合并分支归一（6e373a4），此后打包默认路径即正确。
- 删 worktree 前先拆 junction：worktree 里的 `dsh` junction 指向主仓真目录，递归删除
  会穿透目标；`cmd /c rmdir` 只摘链接不伤目标。git worktree remove 报 busy 时先查
  自己 shell 的持久 cwd 是否还在 worktree 里。

## [S1] Problem

立项（easel-single-workspace D3）目前只做「建空目录 + 建同名工作区 + 选题置状态」：
`projects/<标题>/` 里什么都没有。用户诉求（2026-10-17）：**立项后把相关文件放进
工作区**——拆解的爆款视频、相关内容、账户画像——工作区才是可用的项目资料夹，agent
做内容时也有处可查、有处可写。

## [S2] Design

### D1 一次立项动作 = 建目录 + 播种 + 建工作区 + 置状态

宿主新路由 `POST /easel/api/projectize`（body `{ title, deconstruct?, persona? }`）：
宿主侧做标题清洗（从前端迁移，单一权威）→ `mkdir projects/<safe>/` → 播种资料 →
返回 `{ safe }`。前端（IdeasPage）拿到 safe 后 `ws.create` + `updateIdea(status:'project')`。
种子逻辑落 `lib/projectize.js`（纯 fs、根目录注入、node --test 可测）。

### D2 播种内容（`projects/<safe>/`）

- `选题.md`：标题/来源/立项日期/备注原文（拆解入库选题的备注即整份报告，照存，不做去重分支）。
- `拆解/`（当选题带 `deconstruct` 批次号）：`report.md`、字幕 `.srt`（**复制**，文本小）；
  `video.mp4`、`frames/*.jpg`（**硬链接**——同卷零拷贝；`fs/promises.link` 失败
  （跨卷/权限/平台）→ 逐项跳过，在 项目资料.md 记原始相对路径兜底）。
- `画像/<name>/*.md`（当选了画像）：复制 `profiles/<name>/` 下 md（小文本快照；
  活目录仍在 profiles，manifest 里注明）。
- `项目资料.md`（manifest，人与 agent 共用）：本目录清单、大文件/画像原始位置、
  **产物约定：本项目的脚本/文案/成片一律写进本目录**。
- 幂等：目录已存在不报错；文本文件重写，硬链接已存在跳过（立项重按不炸）。

### D3 选题↔拆解关联补链

拆解入库提示词（BreakdownPage）写入的 idea JSON 增 `"deconstruct":"<job.id>"` 字段
（采集时已握 job.id，零额外查询）。存量选题无此字段 → 立项时只播种 `选题.md`，
**不做手动关联 UI**（YAGNI：真需要就重拆一次，新链路自动带上）。

### D4 画像选择

立项弹最小 modal：画像下拉（`fetchStatus()` 已返回 `personas`，零新路由）+「不带入」
空项；仅一个画像时默认选中。立项按钮改为先弹 modal 确认再执行装配。

### D5 产物落点注入

`useTopic(title)` 扩展 `(title, projectDir?)`；IdeasPage「做内容」对已立项选题传
`projects/<safe>/`，prompt 追加：读 `项目资料.md`、创作产物一律写入该目录。
会话挂接项目工作区（insertSessionBefore 编排）**不在本轮**——既有遗留小任务顺延。

### D6 顺带修复：IDEA_STATUSES 丢 'project'（勘察实证）

`index.js:966` `IDEA_STATUSES = Set(['pending','doing','done'])` 不含 `project`，
立项的 `updateIdea(status:'project')` 被更新路由（`:1048`）静默回退为原状态——
立项后刷新选题跳回原列。补 `'project'` 入集合（`apiIdeasCreate` 同步受益）。

## [S3] Scope

- In scope：D1-D6；`lib/projectize.js` node --test；插件 bump 0.2.3（stamp 门要求，
  否则壳不重同步内容树）；安装副本/staged 热同步。
- Out of scope：会话挂接工作区编排（遗留②）；「移入临时」；存量选题手动关联拆解 UI；
  画像多项目共享的同步机制（快照语义，profile 改名后项目内快照不动）。

## Tasks

- [x] T1: lib/projectize.js（sanitize 迁移 + seed：选题.md/项目资料.md/拆解硬链复制/画像快照）+ node --test (depends: none)
- [x] T2: index.js 路由 projectize + IDEA_STATUSES 加 'project' (depends: T1)
- [x] T3: BreakdownPage 入库提示词加 deconstruct 批次号字段 (depends: none)
- [x] T4: IdeasPage 立项 modal（画像下拉）+ 新流程接线；api.ts 类型 (depends: T2)
- [x] T5: useTopic/topicPrompt 落点注入（projectDir 参数） (depends: none)
- [x] T6: build.mjs + bump 0.2.3 + 三副本热同步 + worktree 提交 (depends: T1-T5)

## [S4] Acceptance

- [ ] 立项后 `projects/<标题>/` 出现：`选题.md`、`项目资料.md`；关联拆解时还有
  `拆解/`（report/srt 实体、video/frames 硬链接、大小不翻倍）；选画像时还有 `画像/<name>/`。
- [ ] 立项后刷新选题库，选题稳定停在「已立项」列（IDEA_STATUSES 修复生效）。
- [ ] 已立项选题点「做内容」，发出的 prompt 含项目目录路径与产物落点约定。
- [ ] 幂等：同选题重复立项不炸、不重复堆积。
- [ ] node --test 全绿（新增 projectize 用例）；build.mjs 成功；client.js grep 到
  projectize 路由指纹。
