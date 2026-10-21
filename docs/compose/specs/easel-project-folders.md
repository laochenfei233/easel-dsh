---
feature: easel-project-folders
status: delivered
updated: 2026-10-20
branch: feat/easel-project-folders（worktree .worktrees/easel-project-folders）
commits: 1673ee0..e40c378
---

# 立项工作区固定骨架：素材/ 与 成品/ 目录随立项建出

## Report

**What was built** — 立项播种（`lib/projectize.js` seedProjectWorkspace）在
`mkdir projects/<safe>/` 后紧接建出固定骨架：`素材/` 下 `音乐/`、`视频/`、`人声/`、
`图片/`、`音效/`（用户点名前三个，「等常见内容」补后两个），以及 `成品/`。目录清单
收敛为模块常量 `MATERIAL_SUBDIRS`，播种与 manifest 装配清单共用一份（单一权威）。
全部 `mkdir recursive` 只建不删：重复立项对用户已放入素材/成品的文件零影响；无占位
文件（运行时工作区非 git 仓）。`项目资料.md` 装配清单新增素材库（列出五子目录）与
成品区两行，**产物约定**改为：脚本、文案等创作产物写入本目录，**成片与最终交付物
写入 成品/，制作素材归入 素材/**。裸立项（无拆解无画像）同样有完整骨架。前端立项
链路零改动（仍走 POST projectize，无新路由无新 UI）。插件 bump 0.2.9——壳的 stamp
门（setup.rs 读 easel VERSION）只在版本变化时重摆插件载荷，已安装壳下次启动即拿到
新 projectize.js。

**Verification** — worktree 内 `node --test` 69/69 全绿（骨架断言入两个既有行为
测试：完整立项七目录+manifest 两行；幂等轮 素材/成品 用户文件跨重复立项存活断言；
裸立项全七目录断言）；`node build.mjs` 成功（client.js 508.6kb，2 个既有 es2024
警告与基线相同；bundle 产物与已提交版本仅 esbuild 路径注释差异——worktree 目录更深
一层所致，零功能变化，故未提交该产物，bundle 内无版本戳）。独立评审一轮：4 条验收
全 PASS、正确性零 bug、一致性良好、零 critical；3 minor 中 2 个测试加固已补
（裸立项全七目录、成品/ 保留断言）并复测 69/69，1 个即本 spec 收尾。

**Journey log**
- Git Bash 会吞 `node -e "…C:\\path\\…"` 里的反斜杠，junction 建成同名残渣且 CWD
  随 shell 持久化落到错误目录——Windows 路径一律走正斜杠（Node 的 fs API 全认）。
- worktree 不携带 gitignored 的 `dsh/`，build.mjs 的 esbuild 解析（`../dsh`
  node_modules/.pnpm）会 ENOENT——worktree 开工先建 junction
  `fs.symlinkSync(主仓dsh, worktree/dsh, 'junction')`。
- 从 worktree 构建会把 esbuild 注释里的相对路径（`../dsh`→`../../../dsh`）打进
  client.js——纯注释零功能差异，revert 不提交，避免下次主 checkout 构建来回翻烧饼。
- 硬骨架（固定目录）与软装配（拆解/画像，失败记 notes 降级）语义分层：骨架 mkdir
  失败该炸就炸（磁盘/权限问题），装配失败才逐项跳过记 manifest。

## [S1] Problem

立项播种（easel-project-materials）只建 选题.md/项目资料.md（+可选 拆解/、画像/），
用户诉求（2026-10-20）：建档后除了资料，还应预置视频制作常用的目录骨架——**素材/**
（内含音乐、视频、人声等常见素材分类）与**成品/**，让用户和 agent 从第一天就有
固定的投放位置，不必每次手工建目录。

## [S2] Design

### D1 播种即建骨架（`lib/projectize.js` seedProjectWorkspace）

`mkdir projects/<safe>/` 后紧接建出：

- `素材/`，其下固定子目录：`音乐/`、`视频/`、`人声/`、`图片/`、`音效/`
  （用户点名音乐/视频/人声，「等常见内容」补 图片、音效——剪映类工作流最常见的五类）。
- `成品/`（成片与最终交付物，不再分子目录）。

全部 `mkdir recursive`：幂等、已存在不动；**只建不删**——重复立项对用户已放入的
素材零影响。目录清单用模块级常量（manifest 与播种共用一份，单一权威）。
无占位文件（运行时工作区非 git 仓，空目录即空目录）。

### D2 manifest 同步产物约定（项目资料.md）

装配清单加两行：素材库（列出五个子目录、用途）与成品区；**产物约定**改为：
脚本、文案等创作产物写入本目录，**成片与最终交付物写入 成品/，制作素材归入 素材/**。

### D3 无前端/API 变更

IdeasPage 立项链路零改动（仍走 POST projectize）；无新路由、无新 UI。

### D4 插件 bump 0.2.9

壳的 stamp 门（setup.rs 读 easel VERSION）只在版本变化时重摆插件载荷——
`dsh-plugin-easel/package.json` 0.2.8 → 0.2.9，已安装壳下次启动即拿到新 projectize.js。

## [S3] Scope

- In scope：D1-D4；projectize.test.js 断言骨架；bump 0.2.9。
- Out of scope：成品/子分类（按需人工建）；素材目录 UI/拖拽上传；存量已立项项目
  补建骨架（老项目不动——YAGNI，手工 mkdir 一次即可）；「移入临时」等遗留项。

## Tasks

- [x] T1: projectize.js 播种 骨架（素材/五子目录 + 成品/）+ manifest 产物约定改写 (depends: none)
- [x] T2: projectize.test.js 断言骨架存在（含裸立项）+ 重复立项幂等 (depends: T1)
- [x] T3: package.json bump 0.2.9 + node --test 全绿 + build.mjs + worktree 提交 (depends: T1-T2)

## [S4] Acceptance

- [x] 任意立项（含无拆解无画像的裸立项）后 `projects/<safe>/` 出现
  `素材/{音乐,视频,人声,图片,音效}` 与 `成品/`，共 7 个新目录。
- [x] 项目资料.md 装配清单列出素材库与成品区，产物约定指明 成品/ 落点。
- [x] 幂等：同选题重复立项不炸；用户已放入 素材/成品 的文件原样保留。
- [x] node --test 全绿（骨架断言入回归门）；插件版本 0.2.9。
