---
feature: easel-deconstruct-title-attach
status: delivered
updated: 2026-10-18
branch: main（Easel 仓；分支已归一，插件线直接落 main——compose-next worktree 默认的项目级豁免）
commits: 6e373a4..70c013b
---

# 拆解真标题命名 + 会话归组：立项名字不再垃圾、对话不再失联

## Report

**What was built** — 两件事。①**拆解真标题命名**：采集流水线保留 video_fetch 的
stdout 尾部（Buffer 攒齐、256KB 上限、close 一次 decode），解析末行 JSON 的平台
真实标题，`cleanVideoTitle` 剥掉 #/＃ 话题段后写 `job.title`；入库提示词的选题名
改用真标题（`JSON.stringify` 内嵌防引号炸库），采集面板显示《标题》；立项文件夹
名随之变真名。②**会话归组**：按 dsh 铁律（归组唯一入口 = `create({workspaceId})`，
cwd 被定为工作区路径）重设计——启动时确保存在 path=项目根的「主项目」工作区
（ensureHomeWorkspace，带重试）；pushTask 与普通做内容会话
`create({workspaceId: 主项目})`，cwd 仍是项目根（文件协议分毫不破）且真归组；
已立项选题「做内容」直接生在项目工作区里（cwd=项目目录，资料都在手边），
prompt 切换为目录内措辞。存量未分组会话无法补挂（dsh 无 post-hoc attach），
单列表视图仍可见。

**Verification** — `node --test` 69/69 全绿（含 2 新用例：cleanVideoTitle 边界、
stub 下载器噪声+截坏行+末行元数据的 fetch 段落账）；`node build.mjs` 成功且产物
与提交同步；载荷指纹（findWorkspaceByPath/resolveHomeWorkspaceId/
ensureHomeWorkspace/JSON.stringify(ideaTitle)）与三副本、VERSION=.bundle-version=
0.2.6 核对一致。独立评审两轮：第一轮抓出 critical（insertSessionBefore 只重排
不授予，D2 全体空转）→ 机制重设计；第二轮逐环节对 dsh 源码验证新机制
（create({workspaceId}) → cwd=工作区路径 → attachSession cwd 校验 → 投影过滤，
含尾斜杠/大小写探测）判 PASS，3 个 minor（inProject 误判、stdout 无上限、
ensure 无重试）全部修复后 70c013b 落定。**产物 `Easel-dsh_0.2.1-alpha.16_x64-setup.exe`**。

**Journey log**
- **API 同名陷阱**：`insertSessionBefore` 听名字像"插入成员"，实际只重排已有成员
  （未挂靠抛 workspace/move-invalid）；客户端 face 存在该方法 ≠ 它做你以为的事。
  复用远端 API 前必须读**宿主实现**，评审 subagent 对着 dsh 源码逐环节验证救了
  一船人——首轮 69/69 全绿照样是空转功能。
- dsh 的会话归组铁律：成员授予只发生在 create({workspaceId})（cwd 被定为工作区
  路径），显示还要过 cwd===canonical 路径的双重门。**想要归组又想保 cwd，就让
  工作区路径等于你要的 cwd**——「主项目=项目根工作区」一石二鸟（归组+文件协议），
  这正是 single-workspace spec 顺延的 T2。
- "找不到会话"的机制：未归组会话落「未分组」桶（按工作区视图排末尾，切组即隐）；
  单列表（single 模式默认）始终全量可见——用户教育点：切回单列表就能找到。
- 全角标点混进正则字符类时手滑打成半角（`！？`→`!?`），`$` 锚定的整段清洗静默
  失配——中文文本处理断言必须覆盖全角标点样例。
- staging/打包管线静默输出靠管道缓冲（`| tail`）攒着，误判卡死；看 runtime 目录
  mtime 推进步骤比盯日志快。

## [S1] Problem

用户实测（2026-10-18，alpha.13）两条：

1. **立项命名垃圾**：项目文件夹叫「拆解模板：（9.92 复制打开抖音，看看【陆三金的
   作品】…」——这是用户粘贴的分享口令，不是视频标题。下载时video_fetch.mjs 明明
   已经拿到真实标题（抖音 `item.desc`/小红书 `note.title`/B站 `info.title`，末行
   JSON 输出），但 `deconstruct.js` 的 `run()` 把 stdout 直接丢弃。要求：下载时顺带
   取标题、去掉 #话题 等干扰，作为选题/立项名与文件夹名。
2. **对话不进工作区、易失联**：dsh 会话归属工作区 = 显式 `insertSessionBefore` 或
   cwd 与工作区 canonical 路径一致；**插件创建的全部会话（做内容/拆解/技能执行）
   两者皆无**，永远落「未分组」桶（按工作区视图排在末尾，切个分组就"找不到"）。
   这是 easel-single-workspace D3③④（挂接）被顺延 + T2（主项目钉扎）未做的合计
   账，立项产生更多工作区分组后症状显性化。dsh 壳 alpha.11/12 仅版本号提交，非壳
   回归。

## [S2] Design

### D1 拆解流水线捕获标题（lib/deconstruct.js）

- `run()` 捕获 stdout（同 stderr 封顶 100K）；fetch 段成功后解析**最后一行 JSON**
  （video_fetch 输出契约 `{platform,title,author,duration_sec,file,url}`），取
  `title`。
- 新增导出 `cleanVideoTitle()`：去 `#`/`＃` 话题段（#xx 到空白或串尾）、折叠空白、
  去控制字符、限长 60 码点、去尾标点空白；空结果回退 undefined。存 `job.title`
  （清洗后）；无标题不写字段。
- BreakdownPage：入库提示词的 idea `title` 用 `job.title`（无则维持现状 URL 前缀）；
  采集状态区显示「标题：…」一行。立项文件夹名沿用既有 sanitize 链——上游真了，
  文件夹自然真。

### D2 会话归组（task.ts + client.tsx）——机制修正版

**dsh 铁律（评审轮实勘勘误）**：会话归组的唯一入口是 `sessions.create({workspaceId})`
——宿主强制 `cwd = workspace.path` 并 `attachSession`；`insertSessionBefore` 只能
**重排已有成员**（未挂靠直接 `workspace/move-invalid`）；显示还要过 `cwd === 工作区
canonical 路径` 的双重门。post-hoc 挂接在 dsh 里不存在。

因此归组的正道是**让工作区路径等于我们本来就要的 cwd**：

- **主项目 = 路径钉在项目根的工作区**：启动时（apply 后延迟 2s 一次）若无 path=
  projectRoot 的工作区则 `workspaces.create({path: projectRoot})`（标题落文件夹名，
  重名冲突静默保留）。此后 `pushTask` 与普通「做内容」用
  `create({workspaceId: 主项目})`——cwd 仍是项目根，文件协议不变，且真归组。
  找不到主项目（首启未建好/创建失败）→ 回退纯 `create({cwd})`（现状行为，未分组）。
- **已立项选题「做内容」**：`create({workspaceId: 项目工作区})`——cwd=项目目录，
  资料就在手边（播种的意义）；prompt 相应改为目录内语义（`读 项目资料.md`、
  `产物写当前目录`）。项目工作区找不到 → 回退项目根 cwd + 原 prompt 措辞。
- `task.ts` 导出 `findWorkspaceByPath`（分隔符/大小写归一，支持相对尾段匹配）、
  `projectRoot()`、`resolveHomeWorkspaceId(projectDir?)`；删除 insertSessionBefore
  路线与原「启动清扫」（该机制在 dsh 里是空转，不保留死代码）。
- 存量未分组会话**无法补挂**（dsh 无 post-hoc attach）——单列表视图仍可见，如实
  告知用户；这是 dsh 上游限制，记录在案。

### D3 面上不动的东西与评审轮补强

- dsh 壳零改动（导航兜底、分组渲染、门控全部现状）；单列表默认视图不动；
  平台原生新建对话（自带 workspaceId）行为不动。
- 存量垃圾名文件夹**不改名**（工作区钉 canonical 路径，改名即断链）；用户新
  拆解/新立项自然获得真名。
- 评审轮补强：入库提示词的 title 用 `JSON.stringify` 内嵌（标题含引号不再破坏
  JSON 模板——坏 JSON 会让整个选题库被静默读空）；`DeconstructJob` 类型补
  `title?`；`run()` 的 stdout 改 Buffer 攒齐再一次 decode（多字节字符不再被
  chunk 边界劈碎）；manifest 的「原件」路径改绝对（会话 cwd 可能是项目目录，
  项目根相对路径会指错）。

## [S3] Scope

- In scope：D1（deconstruct.js + 测试 + BreakdownPage）、D2（task.ts + client.tsx，
  含主项目目录钉扎——ensureHomeWorkspace 即原 single-workspace T2 的实现）、
  插件 bump 0.2.6（0.2.4/0.2.5 为评审轮中间版）、三副本热同步、NSIS alpha.16
  （alpha.14/15 作废未交付）。
- Out of scope：存量未分组会话补挂（dsh 无 post-hoc attach，上游限制，见 D2）、
  存量文件夹改名、临时工作区/「移入临时」、dsh 壳任何改动。

## Tasks

- [x] T1: deconstruct.js run() stdout 捕获（Buffer 攒齐+尾部上限）+ cleanVideoTitle + job.title；测试（stub fetch 输出 JSON 行断言 job.title 且话题已剥离） (depends: none)
- [x] T2: BreakdownPage 入库提示词真标题（JSON.stringify 内嵌）+ 标题显示行 + DeconstructJob 类型 (depends: T1)
- [x] T3: task.ts findWorkspaceByPath/projectRoot/resolveHomeWorkspaceId + pushTask create({workspaceId})；client.tsx useTopic（项目工作区命中才用目录内措辞）+ ensureHomeWorkspace (depends: none)
- [x] T4: 测试全绿 + build.mjs + bump 0.2.6 + 三副本同步 + NSIS alpha.16 + 指纹验证 (depends: T1-T3)

## [S4] Acceptance

- [ ] 拆解真实链接：job.json 出现 `title` 且不含 `#话题` 段；入库选题 title=真标题；
  立项文件夹名=清洗后真标题。
- [ ] 启动后存在 path=项目根的工作区（无则自动建）；已立项选题「做内容」的会话
  cwd=项目目录、出现在该项目工作区分组下；pushTask 与普通做内容会话 cwd=项目根、
  出现在主项目（项目根工作区）分组下。
- [ ] 标题含引号/反斜杠时入库提示词的 JSON 行仍合法（JSON.stringify 内嵌）。
- [ ] node --test 全绿；build.mjs 成功；安装包载荷指纹验证。
