---
feature: easel-project-archive
status: in-progress
updated: 2026-10-25
branch: feat/easel-project-archive
commits: e4a2c7e804..02c70a5715
---

# 项目压缩包导入 / 导出（Easel Project Archive）

## Report

**What was built** — 一个宿主归档引擎（`lib/project-archive.js`）加三个入口：设置 · 数据位置新增「项目」卡片（列表、导入、行右键/图标导出）、工作区侧边栏标题栏的导入按钮（核心新增通用 slot `sidebar.workspaces.header.action`）、工作区行右键导出。压缩包是标准 zip，根为项目内容，首个条目 `.easel-project.json` 只带 format/version/title/exportedAt；v1 不含会话。导入先解析中央目录并逐条校验 CRC/大小，再暂存解压、垃圾过滤、根推断、同名自动 `(2)`、原子 rename 发布，最后由客户端 `ctx.workspaces.create` 登记。导出走系统另存为，扫描时跳过并分别计数符号链接/不可读/系统元数据，写 `<dest>.part` 后原子替换；目标在源内、主项目根/非 `projects/` 直接子目录、单文件 ≥4 GiB 都在宿主拒绝。任务单并发，进度经共享 toast 轮询展示，弹窗打开时 toast 挂在最上层 dialog 内。

**Verification** — `node --test`（插件）：270 项，269 pass、1 skip（Windows 上跳过 chmod 0 不可读文件用例）、0 fail；覆盖往返、外部 flat/单顶层目录、同名后缀、大小写折叠重名、祖先冲突两种顺序、CRC 损坏、截断中央目录、冒号 ADS、清单版本、垃圾计数、链接跳过、4 GiB 守卫、覆盖已有目标、路由/任务/409/取消/unsupported。`pnpm vitest run packages/client/ui-workspace`：467 pass。`pnpm run typecheck`：5/5 gates；`pnpm exec tsc -p tsconfig.client.json`、`pnpm exec tsdown --config-loader native --env.DSH_BUILD_FACE client` 均通过；插件 `node build.mjs` 产出 `client.js` 811.0kb。`pnpm run build` 的 Desktop bundle 在本工作树因 node_modules 为 junction 报 `ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH`（环境限制，其余 gate 被跳过）；`pnpm run test:docs` 的 5 个失败是仓库既有的双语配对/类型等价/链接/wrap 漂移（含所有既有 Easel spec），不属于本分支引入的代码失败。**桌面实机冒烟（原生选择器、右键菜单、设置弹窗内 toast、macOS/Windows 真实路径）尚未执行。**

**Journey log** — ①工作树复用主检出的 node_modules junction 让 `pnpm run build` 的 Desktop bundle 直接拒绝，改用 client aggregate + tsdown 验证，并把完整 build 留给 CI/主检出。②两路独立复审：客户端一路抓到 context-menu 调用不存在的 `supported()`（右键完全失效）与 toast 被替换后进度永久消失；宿主一路抓到大小写/Unicode 折叠重名静默覆盖、NTFS 冒号 ADS、fflate 流式解压不校验 CRC。全部 critical/major 已修并复验。③fflate 的 `Unzip` 不暴露 CRC，改为自解析 EOCD/ZIP64 中央目录 + 逐条 CRC32 比对；stored 媒体被篡改现在会失败。④设置页原本没有项目列表，右键导出在设置里无处可落，因此新增只读项目卡片；导入成功后靠 workspace feed 自动出现分组，不另做刷新协议。⑤剩余 minor：POSIX 空目录的 check-then-rename 理论竞态、statfs 在 UNC 不可用时跳过磁盘守卫、插件客户端服务/菜单行缺少独立测试（无 TS/React 测试 harness）；均记录在交付说明。

## [S1] Problem

Easel 把每个立项项目放在 `<数据位置>/workspace/projects/<名称>/`，但项目目前只能在文件系统里手动搬运：

- 设置里的「数据位置」只显示数据根路径和迁移表单，看不到项目列表，也没有导入入口；想恢复/接收一个项目，必须先把 zip 解压到正确目录，再回侧边栏登记工作区。
- 工作区侧边栏的工作区行没有右键菜单，也没有导入入口；项目导入没有产品路径。
- 隔空传送解决的是同网设备间的完整迁移（含会话），备份解决的是整库上云；两者都不覆盖「把单个项目打成一个文件发给别人 / 存档」这个需求。
- 项目里常有大于 1 GB 的视频素材，用户需要一个可被系统文件管理器直接打开的标准 zip，而不是专有封装。

目标：在**设置 · 数据位置**和**工作区侧边栏**手动导入项目 zip；在这两处对项目文件夹右键导出为 zip。导入后项目立即可在工作区看到并继续使用。

## [S2] Design

### Workspace

- worktree：`.worktrees/easel-project-archive`
- branch：`feat/easel-project-archive`，base `master` `e4a2c7e804`
- 新工作树没有 `node_modules`；实现前按既有做法从主检出建 junction 后再跑构建与测试。

### D1 压缩包格式：标准 zip，项目内容打平，隐藏清单放首位

导出文件名：`<项目名>.zip`。归档内：

```
.easel-project.json      ← 第一个条目，导入时读取后删除
选题.md
项目资料.md
素材/...
成品/...
```

清单只承载格式识别与版本，不再记录文件数/字节数：

```json
{ "format": "easel-project", "version": 1, "title": "项目名", "exportedAt": "2026-10-25T..." }
```

- **不写 fileCount/totalBytes**：导出期间文件可能被 agent 改写，先写清单再写内容会让计数与实际不一致；导入时从 zip 中央目录读取逐条 CRC32 与解压字节比对（fflate 的流式解压本身不校验 CRC，stored 媒体必须自己验）。文件数/字节数只出现在任务结果和 toast 里。
- **标准 zip**：用户可以在资源管理器/Finder 里直接打开，不需要 Easel 专有工具；未带清单的普通项目 zip 也能导入。
- **v1 不包含会话记录**。会话属于 dsh 的版本化格式，跨版本导入必须走 `session-log-import` 的版本校验；完整迁移已有「隔空传送」，整库备份已有「设置 · 备份」。清单里的 `version` 为将来加入 `sessions/` 预留升级点。
- **不使用新依赖**：`fflate` 已随 dsh 运行时闭包存在（`@deepseek-ai/dsh-easel-backup` 依赖，桌面壳把闭包 junction 到 `$DSH_HOME/node_modules`），插件按需 `await import('fflate')`；缺失时只让本功能报 `archive-engine-unavailable`，不拖垮整个工作台。`fflate` 能读写 ZIP64 的**归档总量**，但**单个条目上限 4 GiB**；导出扫描时对单文件 ≥ 4 GiB 直接给出可操作错误（提示压缩/拆分该视频），不静默生成坏包。真实用户频繁撞到该上限时再升级到 `yazl`/`yauzl`（届时再加包与新工作量的决策）。
- 压缩策略沿用备份包约定：已压缩媒体（视频/音频/图片/zip 等）store，文本 deflate(6)。

### D2 导入语义：暂存、校验、原子发布、自动登记工作区

入口两条：设置 · 数据位置的项目卡片、工作区侧边栏标题栏的导入按钮。两者调用同一个客户端服务。

1. **选文件**：宿主进程打开系统文件选择器（Windows `OpenFileDialog`，macOS `choose file`，Linux `zenity`/`kdialog`），只筛 `.zip`；取消则什么都不做。
2. **建任务**：`POST /easel/api/projects/import` 返回 `jobId`；解压在后台进行，前端轮询 `GET /easel/api/projects/job`。
3. **暂存**：解到 `<projectRoot>/projects/.easel-import-<random>/`。与最终目录同卷，发布用一次 `rename`，不会出现半个项目。
4. **校验**（详见 D4）：路径安全、重复路径、条目数、可用空间、清单版本；未带清单的普通 zip 按下列规则推断项目根：
   - 所有非垃圾条目都位于同一个顶层目录（没有根级文件）→ 取该目录为项目根；
   - 否则 zip 根就是项目根；
   - 过滤 `__MACOSX/`、`.DS_Store`、`Thumbs.db`、`desktop.ini` 并计数；
   - 过滤后至少有一个普通文件，否则 `no-files`。
5. **命名**：`manifest.title` > 唯一顶层目录名 > zip 文件名（去 `.zip`）。直接复用 `lib/projectize.js` 已导出的 `sanitizeProjectTitle`（与立项同一规则：去 Windows 非法字符、40 字上限、空则「导入项目」），不另写一份。同名目录已存在时自动改为 `<名称> (2)`、`(3)`…，最多 100 次；**永不覆盖**。返回 `renamed: true` 和最终名称，toast 说明「同名项目已存在，已导入为「X」」。
6. **发布**：`rename(stagingRoot, <projects>/<最终名称>)`。失败清理暂存并报告。成功后返回 `{ name, path, files, bytes, renamed }`。
7. **登记工作区**：客户端调用既有的 `ctx.workspaces.create({ path })`。`WorkspaceCreateValue.created` 为 false 表示该路径已登记，视为成功；失败时项目文件保留，toast 明确「已导入文件，但工作区登记失败：…」。
8. 设置页的项目列表在导入完成事件后重新拉取；侧边栏通过既有 workspace feed 自动出现新分组。

启动时清扫超过 24 小时的 `.easel-import-*` 残留（崩溃遗留），只删这个前缀，不碰用户目录。列表接口忽略所有点前缀目录。

### D3 导出语义：系统「另存为」，先写 `.part` 再替换

1. 只有 `<projectRoot>/projects/` 的**直接子目录**可导出；必须是真实目录（`lstat` 非符号链接）。主项目（`<projectRoot>` 本身）不可导出——那里有 `.env`、`profiles/`、`outputs/`，绝不能进压缩包。侧边栏菜单对不在 `projects/` 下的工作区隐藏导出项；宿主再校验一次。
2. 系统保存对话框默认 `<项目名>.zip`，记住上次目录；取消则不发任务。用户确认覆盖由系统对话框负责。
3. `POST /easel/api/projects/export` 起后台任务：
   - `scanning`：递归扫描，按相对路径排序；跳过符号链接/junction/特殊文件并计数；不可读文件跳过并计数；拒绝名称里含反斜杠或 NUL 的条目（zip 内路径必须无歧义）；单文件 ≥ 4 GiB 直接失败并点出文件名；统计总字节，检查目标卷剩余空间 ≥ 总量 + 64 MiB。
   - `writing`：写 `<目标>.part`，清单第一个条目，然后逐文件；进度按文件数/字节数上报。
   - 发布：`rename(part, 目标)`（Windows/POSIX 都覆盖已确认的目标）；失败保留原目标文件。
   - 结果：`{ path, files, bytes, skippedLinks, skippedUnreadable, skippedJunk }`；有跳过时 toast 用 warn 级说明数量（链接、不可读文件、系统元数据分开计数）。
4. 目标位于源项目内部时拒绝（避免把 `.part` 打进自己）；目标父目录必须存在且可写。
5. 导出期间文件被改写不会破坏归档（逐条 CRC）；不写全局文件计数，因此不需要重扫。

### D4 安全与一致性

所有读写都发生在 `projects/` 域内，继续走 `/easel/api` 既有的 connection fence（同源 + 已认证浏览器；不新增 runner token 例外）。

| 风险 | 处理 |
| --- | --- |
| Zip-slip / 绝对路径 | 条目名拒绝 `\`、NUL、前导 `/`、盘符 `:`、UNC、空段、`.`/`..` 段；完整路径 ≤ 1024 UTF-8 字节。 |
| 覆盖/路径冲突 | 拒绝重复条目——Windows/macOS 按大小写折叠（macOS 另做 NFC 归一）后比较，避免 `A.txt`/`a.txt` 静默覆盖；拒绝段内冒号（NTFS ADS）；拒绝「文件 `a` 之后又出现 `a/b`」的祖先冲突；暂存目录新建且为空。 |
| 损坏 zip | 解析 EOCD/ZIP64 中央目录，逐条比对 CRC32 与解压字节；缺中央目录、截断、CRC 不符都拒绝。 |
| Zip 炸弹 / 磁盘耗尽 | 最多 200 000 条目；解压前 `statfs` 要求剩余 > 1 GiB；解压中已写字节超过「起始可用空间 − 512 MiB」即中止；失败必清暂存。 |
| 符号链接逃逸 | 导入只往新建暂存目录写普通文件（fflate 不还原 Unix mode，链接条目落成普通文件，无害）；导出用 `lstat`/Dirent 跳过符号链接与 junction，绝不跟随到项目外。 |
| 任意目录导出 | 仅 `projects/` 直接子目录；主项目、outputs、profiles、skills、`.env` 不在可导出范围。 |
| 保存目标注入 | 目标绝对路径必须已存在父目录、不在源内、以 `.zip` 结尾；先写 `.part` 再 rename。 |
| 原生对话框注入 | 对话框文案只按 `locale`（封闭集合 `zh`/`en`）选固定字符串；默认文件名经清洗后通过环境变量/argv 传给 PowerShell/osascript，**不拼进脚本源码**。 |
| 不静默丢数据 | 导入不覆盖；导出跳过项计数并警告；导入成功后登记失败不回滚文件，明确报告。 |

暂存目录命名 `.easel-import-<hex>`；导出临时文件 `<目标>.part`，任务失败立即删除，成功 rename 后不存在。

### D5 接口与任务模型

基础路径 `/easel/api`，单任务（同一时刻只允许一个导入或导出），进度由前端轮询。

| 方法 / 路径 | 请求 | 响应 |
| --- | --- | --- |
| `GET /projects` | — | `{ supported, projects: [{ name, path }] }`，仅直接子目录、非链接、非点前缀，名称排序 |
| `POST /projects/import` | `{ locale?: 'zh' \| 'en' }` | `{ cancelled: true }` 或 `{ jobId, sourceName }`；已有任务 → 409 |
| `POST /projects/export` | `{ path, locale? }` | `{ cancelled: true }` 或 `{ jobId, destination }`；路径非法 → 400；已有任务 → 409 |
| `GET /projects/job` | — | `{ state: 'idle' }` 或任务快照（见下） |

任务快照：

```ts
{
  jobId: string
  kind: 'import' | 'export'
  state: 'running' | 'done' | 'failed'
  phase: 'extracting' | 'finalizing' | 'scanning' | 'writing' | 'done'
  name: string                 // 源 zip 名或项目名
  files: number
  bytes: number
  totalBytes?: number          // 导出扫描后可得；导入时缺省
  destination?: string         // 导出完成后的目标
  result?: { name, path, files, bytes, renamed?, skippedLinks?, skippedUnreadable?, skippedJunk? }
  error?: { code: string, detail: string }
  startedAt: number
  finishedAt?: number
}
```

错误码（客户端映射 `zh`/`en` 文案，未知码落回 `detail`）：`unsupported`、`picker-unavailable`、`busy`、`not-a-project`、`destination-inside-source`、`invalid-archive`、`unsafe-path`、`path-conflict`、`too-many-entries`、`manifest-version`、`no-files`、`file-too-large`、`file-changed`、`disk-space`、`archive-engine-unavailable`、`io`、`bad-destination`、`bad-name`、`name-conflict`。

能力开关：`resolveSettings()` 新增 `archiveEnabled = config.projectArchive ?? Boolean(process.env.EASEL_DATA_ROOT)`；`projectArchive` 只接受布尔值，其他类型在加载时直接报配置错误。桌面发布版由壳注入 `EASEL_DATA_ROOT` 自动开启，web/dev 默认关闭（与「数据位置」一致），开发/测试可在 loader row 写 `projectArchive: true`。`GET /projects` 用 `supported` 表达，客户端据此隐藏侧边栏按钮和右键项。

任务生命周期：任务结果保留到下一次任务开始或 10 分钟；前端只对自己拿到的 `jobId` 轮询，避免旧轮询覆盖新任务。应用重启后任务丢失（in-flight 文件只可能在暂存目录/`.part`，按 D2/D3 清扫）。

### D6 界面与交互

**设置 · 数据位置（在现有「当前位置」与「迁移数据」两张卡片之间新增「项目」卡片）**

- 卡头：`项目` + 数量徽标（`N 个项目`）+ 右侧 `导入项目压缩包…` 按钮（下载/入箱图标）。导入进行中按钮显示 spinner 并禁用。
- 列表：每行 40px，左边文件夹图标，项目名（13/22），右侧导出图标按钮（存档图标，hover 才高亮）。行 hover 用设置卡片的 `--dsw-alias-fill-secondary`，focus-visible 用业务色描边。行工具提示显示绝对路径。
- 右键行：`导出为压缩包…`、`复制项目路径`、`在文件管理器中显示`。右键菜单复用 `easel-context-menu` 的渲染器，z-index 已高于设置弹窗。
- 空态：图标 + `还没有项目` + 一行说明 + `导入项目压缩包…` 文本链接。
- 卡片底部提示：`压缩包只包含项目文件，不含会话记录；导入后会登记为工作区。`
- 列表滚动区最大高 320px；超过时内部滚动，不撑高设置页。

**工作区侧边栏**

- 新增标题栏导入按钮：放在现有视图选项按钮之前，28px 图标按钮（与标题栏其它控件一致），`title`/`aria-label` 为 `导入项目压缩包…`；任务进行中显示 spinner 并禁用，`aria-busy` 只对本类导入任务为真；`supported=false` 或窄栏（rail）时渲染 null。导入成功后 toast，新工作区分组由既有 feed 自动出现。
- 工作区行右键：`在文件管理器中显示`、`复制项目路径`；若路径是 `projects/` 直接子目录，再加分隔符和 `导出为压缩包…`。未分组桶、workspace-tree 的合成父组、主项目不出现导出项（回退系统原生菜单或只给复制/显示）。
- 导入/导出过程共用一个底部居中的轻量浮层（沿用现有 `easel-ctx-toast` 的位置与视觉，不是阻塞弹窗）：文件名/项目名、进度条、已处理字节；成功 4 秒后消失；失败保留 8 秒并带关闭按钮（只有失败态开启 `pointer-events`），`role="alert"`；进行中 `role="status"`。进度条与 hover 过渡尊重 `prefers-reduced-motion`。
- 所有新增文案走字典：设置卡片放 `settings.dataRoot`，侧边栏/右键/toast 放新命名空间 `easel.archive`，均含 `zh`/`en`。动作名在全流程保持一致（`导入项目…` → `正在导入…` → `已导入…`）。

### D7 复用与改动点

- **宿主**：新增 `easel/dsh-plugin-easel/lib/project-archive.js`（压缩包引擎 + 任务 + 路由 + 系统选择器），在 `index.js` 的 apply 里通过 `ctx.easelApi.register()` 挂载；`resolveSettings` 增加 `archiveEnabled`。压缩器沿用 `packages/backup/easel-backup/src/archive.ts` 的流式写法与媒体/文本分级；暂存/校验思路对齐 `packages/transfer/lan-handoff/src/handoff.ts`，但不引入其协议。
- **客户端服务**：新增 `src/lib/project-archive.ts`（路由调用、轮询、工作区登记、任务订阅）与 `src/lib/ui-toast.ts`（进度浮层；把 `features/context-menu.js` 里的 toast 抽出复用，弹窗打开时挂到最上层 dialog 内以保持 aria-modal 与焦点可达）。在 `client.tsx` 里 `ctx.provide('easelProjectArchive', service)`，并作为 `settings.section` 的 inject 传给数据位置组件；客户端核心插件与 `easel-context-menu` 子插件的 inject 列表都补 `workspaces`。
- **右键**：`src/lib/context-menu-model.js` 增加 `project`（`[data-easel-project]`）与 `workspace`（`[data-row-key^="workspace:"]` + `ctx.workspaces` 查表）两种 surface；`src/features/context-menu.js` 增加对应菜单项与导出动作。设置卡片行只加 `data-easel-project` / `data-easel-project-name` 属性即可被同一监听器接管。`在文件管理器中显示` 直接复用既有的 `ctx.remote.session.openWorkspacePath({ path, action: 'reveal' })`（传绝对路径，不走 `workspaceFiles.stat`），因此设置页里尚未登记为工作区的项目目录也能定位；不新增宿主 reveal 路由。
- **核心扩展点**：`packages/client/ui-workspace` 的 slot 合约新增 `sidebar.workspaces.header.action`（list，owner `{ wide: boolean }`），在 `WorkspaceBrowser` 标题栏 action 组内渲染；插件注册导入按钮。这是本次唯一的核心包改动，留通用扩展点而不是把 Easel 写进核心。备选的 `sidebar.footer.action`（零核心改动）放在设置按钮旁，发现性差，不采用。
- **工作区登记**：复用 `packages/api/workspace-controller` 的 `create({ path })`（已存在时 `created:false`，不报重复）。
- **系统选择器**：把 `index.js` 里私有的 `runPicker` 抽到 `lib/native-picker.js`，复用其 120 秒超时与「命令缺失 → 501」行为，新增 `pickZipFile` / `pickSaveZip`。
- **不新增 npm 依赖、不改 `apps/cli` 部署闭包**；fflate 懒加载失败时只禁用本功能。
- 版本：`dsh-plugin-easel` 升一个 patch，重建 `client.js`，确认 `apps/desktop-tauri/scripts/bundle-runtime.mjs` 的 `stageEasel` 仍直接读取 `easel/dsh-plugin-easel`。当前合并仓没有独立 vendored 副本，**不要运行 `scripts/sync-easel-bundle.mjs`**（该脚本按旧嵌套布局会把 `easel/` 自己删掉）；`bundle-runtime` 无需新增 staging 步骤。

### D8 被否决的方案

- **整库导出 / 把数据根打 zip**：备份功能已覆盖，且会把 `.env`、凭据、会话混进来；项目粒度更安全。
- **压缩包包含会话**：需要把 `session-log-export/import` 接进核心插件、处理格式版本门与附件去重，超出 v1；完整迁移用隔空传送。
- **浏览器 `<input type=file>` + 上传/下载**：/easel/api 的 JSON 体上限 10 MiB，大项目要走新的流式上传与下载通道；桌面 WebView 的下载行为也不如系统另存为可靠。系统选择器是既有数据位置选择器的同款路径。
- **新建 archive 包（yazl/yauzl）**：能消除 4 GiB 单文件上限，但要多一个包、apps/cli 闭包改动、100% 覆盖率与打包验证；当前项目素材以短视频为主，先用 fflate + 明确错误，命中真实案例再升级。
- **把导入/导出做成独立 settings section**：用户明确要求放在「数据位置」里，项目列表也属于数据位置语境。
- **在侧边栏文件树（素材/成品）加导出**：用户要的是项目整体；给每个目录都加会扩散语义，后续确有需求再加。

## [S3] Scope

- In scope：
  - 设置 · 数据位置的项目卡片（列表、导入、右键/图标导出、进度与错误）。
  - 工作区侧边栏标题栏导入按钮；工作区行右键导出/显示/复制路径。
  - 标准 zip 格式、清单、宽松导入、自动命名、工作区登记、单任务 + 轮询进度。
  - 路径安全、暂存、原子发布、跳过项报告、残留清扫、中英文案、无障碍焦点与状态播报。
  - 核心 `sidebar.workspaces.header.action` 扩展点及其测试。
  - 插件 README、版本、client bundle 与 vendored 副本同步。
- Out of scope：
  - 会话记录进入压缩包；整库导出；云上传/加密/密码；断点续传/取消/暂停。
  - 导出主项目根、任意非 `projects/` 目录、文件树子目录。
  - 单个 ≥ 4 GiB 文件的导出（明确报错）；tar/7z 等其他格式。
  - 拖拽 zip 到侧边栏；导入后自动打开新会话；CLI 入口。

## Tasks

- [x] T1 宿主压缩包引擎：清单、扫描、fflate 写入、中央目录 CRC 校验、安全解压、垃圾过滤、根推断、命名冲突、暂存/发布、空间与条目上限；单测覆盖 `../`、绝对路径、反斜杠、冒号 ADS、重复条目（含大小写/Unicode 折叠）、祖先冲突两种顺序、清单版本、CRC 损坏、截断中央目录、垃圾目录、单顶层目录、打平根、同名后缀、链接跳过、不可读文件、目标在源内、4 GiB 守卫、残留清扫规则。（depends: none）
- [x] T2 原生选择器与路由/任务：`lib/native-picker.js`、`createProjectArchiveFeature`、四个路由、单任务状态机、`resolveSettings.archiveEnabled`、`index.js` 挂载；用注入的假选择器测导入/导出全流程、取消、409、400、unsupported、job 轮询与错误码。（depends: T1）
- [x] T3 客户端服务与反馈：`src/lib/project-archive.ts`（API、轮询、`ctx.workspaces.create`、任务订阅、能力缓存、`supported()`）、`src/lib/ui-toast.ts`（进度浮层 + 从 context-menu 抽出的 toast，弹窗内挂载）、`easel.archive` 字典；纯函数（项目路径判定、错误码映射）单测。（depends: T2）
- [x] T4 设置项目卡片：`DataRootSection` 增加项目卡片、加载/空态/列表/行右键属性/导出图标、随任务完成刷新；`DATA_ROOT_STYLES` 与 `settings.dataRoot` 文案；中英文案与焦点态。（depends: T3）
- [x] T5 侧边栏导入按钮：核心 `sidebar.workspaces.header.action` 合约 + `WorkspaceBrowser` 渲染 + 合约测试；插件注册按钮（图标、tooltip、busy、unsupported/rail 隐藏）。（depends: T3）
- [x] T6 右键扩展：context-menu model 增加 `project`/`workspace` surface，菜单项与导出动作，`ctx.workspaces` 查表，项目路径判定；context-menu 单测覆盖命中/未命中/未分组/合成组/主项目。（depends: T3）
- [x] T7 打包与文档：插件版本 patch、`node build.mjs`、确认 `stageEasel` 读取的就是 `easel/dsh-plugin-easel`（不跑旧的 `sync-easel-bundle.mjs`）、README 路由/行为说明；确认 fflate 在桌面闭包与 dev 根 `node_modules` 都可解析。（depends: T4,T5,T6）
- [ ] T8 验证与复审：按 [S4] 跑命令并记录证据；按 compose 流程派独立复审 agent 检查规格符合性、正确性、代码一致性；修复后复验。（depends: T7）

## [S4] Acceptance

- [ ] 设置 · 数据位置出现「项目」卡片，列出 `projects/` 直接子目录；空态、数量、滚动与中英文案正确。
- [ ] 从设置卡片和侧边栏标题栏都能选择 zip 导入；取消不产生任务；导入中按钮/进度正确；成功后工作区出现新分组，设置列表刷新。
- [ ] 导入自己导出的 zip 与外部普通 zip 都成功：带清单、唯一顶层目录、打平根三种布局均按 D2 推断；归档根部的 `.easel-project.json` 被移除（项目子目录里的同名文件不动）。
- [ ] 同名项目导入为 `名称 (2)`，原目录字节不变；任何路径都不覆盖。
- [ ] 设置项目行右键与侧边栏工作区行右键都能导出；导出的 zip 在系统文件管理器中可打开，重新导入后文件逐字节一致（测试用哈希对比）。
- [ ] 主项目、outputs/profiles/skills、任意非 `projects/` 目录不能导出；侧边栏对应行不显示导出项，宿主直接调用也返回 `not-a-project`。
- [ ] 恶意/损坏 zip（`../`、绝对路径、反斜杠、段内冒号 ADS、重复条目含大小写/Unicode 折叠、祖先冲突两种顺序、清单版本 2、CRC 损坏、截断中央目录、超条目/空间上限）全部失败并给出对应错误码；暂存目录被清理，`projects/` 不出现半成品。
- [ ] 导出跳过符号链接/不可读文件/系统元数据时结果与 toast 分别报告数量；失败时 `.part` 清理，原目标文件不被破坏；覆盖已有目标成功且不残留 `.part`。
- [ ] 中央目录 CRC 与解压字节逐条比对；stored 媒体被篡改时导入失败，不落损坏文件。
- [ ] 任务并发返回 409；轮询只接受自己的 `jobId`；应用重启后 `GET /projects/job` 为 idle，陈旧暂存被清扫。
- [ ] 所有新增图标按钮有 aria-label 与可见焦点；进行中/成功/失败分别有 `role=status`/`alert` 播报；reduced-motion 下无动画；中文/英文切换无硬编码新增文案。
- [ ] web / 未启用部署中，侧边栏按钮与右键导出项不出现，设置卡片不渲染；`GET /projects` 返回 `supported:false`。
- [ ] 单元测试、构建与手动冒烟证据齐全：
  - `node --test`（`easel/dsh-plugin-easel`，含 project-archive / context-menu / 路由测试）
  - `pnpm vitest run packages/client/ui-workspace`
  - `pnpm run typecheck`
  - `pnpm exec tsc -p tsconfig.client.json` + `pnpm exec tsdown --config-loader native --env.DSH_BUILD_FACE client`（本工作树的 `node_modules` 是 junction，`pnpm run build` 的 Desktop bundle 会以 `ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH` 失败；这是环境限制，完整 build 留给 CI/主检出）
  - 插件 `node build.mjs`；桌面运行时人工冒烟：外部 zip、导出再导入哈希一致、同名后缀、右键两处、进度/失败提示、重启后 idle
  - `dsh-plugin-easel` 版本已升、`client.js` 已重建、`stageEasel` 打包路径已确认、`slot-catalog.ts` 已重新生成；README 更新
- [ ] 独立复审：宿主/安全与客户端/核心两路复审完成；critical（右键调用不存在的 `supported()`）与 major（大小写折叠重名静默覆盖、NTFS 冒号 ADS、CRC 未校验）已修复并复验；其余 minor 记录在交付报告。规格符合性、正确性、代码库一致性无未解决 critical。
