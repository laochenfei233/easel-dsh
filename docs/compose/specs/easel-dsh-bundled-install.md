---
feature: easel-dsh-bundled-install
status: delivered
updated: 2026-10-15
branch: main（Easel 仓）/ feat/easel-frontend（dsh worktree）
commits: Easel aac8d63..579a1e0（4 commits）；dsh feat/easel-frontend b316fd7289..a900ebb580（5 commits）
---

# Easel 并入 dsh 官方安装包（单 dsh 交付形态）

## Report

**What was built** — Easel 不再有独立安装器。交付物是唯一的 dsh 官方 NSIS 安装包
（`DeepSeek Harness Desktop_0.2.1-alpha.2_x64-setup.exe`，120.5MB，基线 114MB），
Easel 作为自带组件随包：runtime 内嵌 `easel/` 内容树（116 技能 + 插件源码 +
profile 模板，白清单 staging）与 `plugins/dsh-plugin-easel/` 执行载荷。桌面壳
首启自动完成三件事——stamp 门（`.bundle-version`）同步内容树到
`%LOCALAPPDATA%\Easel`（outputs/用户 profile/.env 零触碰）、载荷每次启动重拷进
`$DSH_HOME/profiles/node_modules`、profile patch 层写入三行注册（`easel`
insert、`easel-skills` 技能挂载、`ui-plugin-manager` 侧栏让位）；卸载器问一句
是否删内容目录，默认保留。插件包退役自注册（cordis.patch.yml 与 `dsh.bundle`
身份删除），注册权完全归壳/部署层，projectRoot 单一事实源，`!!js` 环境变量
求值从交付物消失。旧 `Easel-Setup.exe/.nsi` 与 delivery/ 全部移除，安装口径
迁入 tracked 的 `docs/INSTALL-DESKTOP.md`；插件 0.2.0 起按 stamp 门契约管理版本。

**Verification** —
- 插件 `node --test`：59/59 PASS（两轮，含 files 退役后）；`node build.mjs` PASS。
- 壳 `cargo test`：11/11 PASS（6 个 easel 幂等测试 + 载荷重拷断言 + 既有 5 个）。
- `bundle:runtime` 两轮 PASS，runtime 树逐项核对（VERSION、白清单、无
  docs/outputs/.env、载荷含 lib/asr.js）。
- **真实 dsh 集成探针**（scratch DSH_HOME + 壳形态 patch 行）：
  `--dump-config` 组合出全部三行；`dsh web` 启动；`GET /easel/status` 返回
  部署 projectRoot + 116 技能 present。集成探针抓到并修复真实 bug：files 清单
  载荷丢 `lib/asr.js` → 整目录 staging。
- `tauri build` NSIS exit 0，产物 120.5MB；`installerHooks` 经 tauri 2.11
  schema 确认；评审员在 `target/release/nsis/x64/installer.nsi:31,40107` 实证
  钩子编入，且中文文案经 makensis 编译无 mojibake。
- 评审子代理（全新上下文）：§S4 全部验收项逐条 PASS，结论
  **PASS-WITH-MINORS、零 critical**。

**Journey log** —
- **files 清单是会漂移的第二事实源**：载荷按 package.json `files` 拷贝漏掉
  `lib/asr.js`（index.js 的运行时 import），单元测试全绿但真实 loader 起不来
  ——集成探针（真 dsh 加载壳形态 profile）才抓到。载荷改整目录 staging。
- **「注册行 match 只看顶层 id」假象**：重跑幂等测试抓到 `id: easel` 计数
  翻倍——insert 包装内的 id 需要 `row_has_id` 双形态匹配器（既有
  `has_patch_row` 本就如此，新代码没照抄教训）。
- **composer 的 `!!js` 自由度是开发便利、安装负担**：删插件 bundle patch 后，
  projectRoot 收敛到 `easel_home()` 一处，覆盖语义/环境变量两类问题整体消失。
- **NSIS 产物验证不能靠字节搜索**（压缩流），可靠路径 = tauri config schema
  确认键存在 + 生成脚本 `target/release/nsis/x64/installer.nsi` grep 钩子 +
  体积带核对（+6.5MB vs 基线）。
- 评审 minor 两项记录在案不修：双实例并发启动的 rm+copy 竞态（单用户桌面、
  下次启动自愈）；手工编辑的 insert `easel` 行 + 缺 `easel-skills` 行时后者
  取 EASEL_HOME 而非前者根（README 指引两行同写）。

## [S1] Problem

当前交付形态是第三方拼装：`Easel\delivery\Easel-Setup.exe`（NSIS 外层）先布置
Easel 仓库 + 预配置 profile，再弹出 dsh 壳官方安装向导——**两个向导、一套外挂
预配置脚本**。用户要求：安装时就是「装一个 dsh」，Easel 的东西作为 dsh 自带组件
随官方安装包一起进来，而不是夹带一堆拼装物的第三方软件。

## [S2] Design

**方案：把 Easel 收进 dsh 官方 Tauri 安装包**（改 dsh worktree 壳 + Easel 仓插件
退役自注册），Easel-Setup.nsi 退役。第三轮设计（2026-10-15）定稿：**插件不再
自带 bundle patch，注册行全部由壳写入 profile patch 层**——「skill 当原生装」
的正确形态 = 命名 provider 挂载（`easel-skills` 行）而非同步进用户技能根。

### 0. 代码勘察结论（2026-10-14/15 两轮，全部实测核对）

- **bundle-runtime.mjs**（`dsh/apps/desktop-tauri/scripts/`，840 行）：
  `stageReusablePlugin`/`reusePluginDir` 离线复用、`installWinTerminalInspector`
  的 win-only 门、`main()` 串联。tauri.conf `bundle.resources:
  {"../runtime": "runtime"}` 把 runtime/ 整树自动进包；`beforeBuildCommand` 是
  占位，runtime 由 `bundle:runtime` 手动先跑。
- **setup.rs**（463 行）：`ensure_default_plugins` 在 `dsh_runner.rs` spawn_child
  内、dsh 子进程启动前调用——`ensure_easel_bundle` 挂同一位置。现成工具：
  `ensure_market_bundle`（拷到 `$DSH_HOME/profiles/node_modules` 供 parent-walk
  解析）、patch 行读写惯用法、`copy_dir`、`dsh_home` 的 env→USERPROFILE 回退。
- **注册机制（第三轮实测裁决）**：
  - profile composer（`packages/boot/app-boot/src/profile.ts`
    `loadProfileDirectory`）对 bundles 列表里**缺 `dsh.bundle` 键的包：跳过 +
    stderr 告警**（skippedBundles），不致命；
  - `dsh plugin add` 的 bundle 激活条件 = 包声明 `dsh.bundle.patch`
    （profile-plugins.ts:72）——删键后插件作为 bundle 自动失活；
  - **client 半不依赖 bundles 行**：dsh-plugin 在全新机器上只有 profile patch
    insert 行（bundles 只有模板两行），plugin-center 照常工作；行名的裸包名即
    client 注册锚（manifest.ts「a plugin bundle IS its package's client
    half」），包经 `$DSH_HOME/profiles/node_modules` parent-walk 解析；
  - `@deepseek-ai/dsh-skill-filesystem`（`packages/skill/skill-filesystem`）：
    `providerName` 只是挂载名，`customSkillDirs` 是 `resolve()` 后的普通路径，
    `includeDefaultRoots: false` 关掉 `.dsh/skills`、`$DSH_HOME/skills` 等默认根
    ——整行纯部署数据，无插件魔法；
  - initProfile：已存在文件零触碰；web 模板 bundles =
    `[@deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app]`；patch 层模板 `[]`。
- 本机 web profile 现状：patch 层 `- id: easel / config: {projectRoot: 仓库根,
  backendUrl}` 平行行（bundle 层 insert 行的覆盖式写法）+ package.json bundles
  含 `dsh-plugin-easel`（pnpm `file:` 硬链接安装，与仓库同一文件）。
  `backendUrl` 是 B4 退役 Python 后端前的死配置（index.js 无读者）。

### 1. 改动点一：Easel 仓——插件自注册退役（T1）

- **删除 `dsh-plugin-easel/cordis.patch.yml`**；其全部语义移交壳（改动点三）：
  `easel` insert 行、`easel-skills` insert 行、`ui-plugin-manager` disable 行。
  patch 文件里的架构注释（easel-skills 复用随附 provider 的理由、§2.6.2 侧栏
  策略引用）随迁 setup.rs 行常量注释，不丢。
- **package.json**：删 `dsh.bundle` 整键与 `files` 清单（后者被集成测试证明
  会漂移——载荷改整目录 staging）；`dsh.client` 保留（client 半声明仍由它
  承担）。内容变更即 bump 版本（0.2.0 起按 stamp 门契约）。
- **README.md**：安装章节改写——手动安装 = 把三行写进 profile 的 cordis.patch.yml
  （全文给出，`projectRoot` 写死绝对路径，不依赖 `!!js` 环境变量求值）；
  `dsh plugin add` 说明补「装依赖但不激活 bundle，激活靠 patch 行」。
- 验证：`node --test`（59/59）+ `node build.mjs` 构建不受影响。

### 2. 改动点二：bundle-runtime.mjs 新增 `stageEasel()`（T2）

- **Easel 仓解析**：`EASEL_REPO` 环境变量 → 默认 `resolve(ROOT, '..', '..',
  '..')`（dsh worktree 的父目录即 Easel checkout，本仓布局天然成立）。两处都
  没有 `dsh-plugin-easel/package.json` → log 一行后跳过（CI 无 Easel checkout
  不受影响）；staging 本体 **win-only**（与 runner 舰队的 Windows 现实对齐）。
- **构建插件**：在 `<easel>/dsh-plugin-easel` 跑 `node build.mjs`——build.mjs
  自带 `createRequire(join(DSH_ROOT,'package.json'))` 从 dsh worktree 解析
  esbuild/marked/dompurify，本布局直接成立。
- **stage `runtime/plugins/dsh-plugin-easel`（执行载荷）**：**整目录拷贝**（滤
  node_modules/.git）——files 清单 staging 曾丢 `lib/asr.js` 致干净机器上
  loader failed to import，集成探针抓到后废弃清单制。
- **stage `runtime/easel/`（运行时树）——白清单制**：只拷 `skills/`（全量，滤
  node_modules/__pycache__/*.pyc）、`dsh-plugin-easel/` 源码（滤 node_modules，
  供 projectRoot 侧引用/更新）、`profiles/_template/`（**仅模板**；真实用户
  profile 目录按构造不可入包）、根级 `README.md`、`LICENSE`；写
  `runtime/easel/VERSION`（内容=插件版本号）。白清单使 docs/、outputs/、.env、
  easel/ Python 残包、web/、openclaw/、delivery/、.worktrees/、dsh junction
  按构造不可入包。
- `writeManifest()` 记 `easel: true/false`。

### 3. 改动点三：setup.rs 新增 `ensure_easel_bundle(app)`（T3）

`dsh_runner.rs` spawn_child 在 `ensure_home_node_modules` 之后、
`ensure_default_plugins` 之前挂一行调用 + 启动日志。核心逻辑抽成**纯路径函数
`ensure_easel_bundle_at(runtime_easel, runtime_payload, easel_root, dsh_home)`**
（GUI 无法在 AI 沙箱启动 → 用单测验证逻辑，集成探针验证注册形态，GUI 首启留
用户/VM）。

- **`easel_home()`**：`EASEL_HOME` 环境变量 → `%LOCALAPPDATA%\Easel`
  （缺 LOCALAPPDATA 回退 `USERPROFILE\AppData\Local`，仿 `dsh_home`）。
- **`runtime_easel_dir(app)`**：`resource_dir/runtime/easel`，dev 回退
  `EASEL_BUNDLE_DIR`；资源不存在 → `Ok(())`（无 bundle 的 dev/平台零影响）。
- **stamp 门同步**：比较 `<easel_root>/.bundle-version` 与 runtime `VERSION`
  ——一致跳过；不一致或首启：`skills/`、`dsh-plugin-easel/` rm+copy，
  `profiles/_template`、README、LICENSE missing 才拷，写 stamp。**绝不 rm
  easel 根目录**——白名单子树覆盖，outputs/、profiles/<用户>、.env 零触碰。
- **插件载荷（每次启动重拷）**：rm+copy `runtime/plugins/dsh-plugin-easel` →
  `$DSH_HOME/profiles/node_modules/dsh-plugin-easel`。无条件重拷是升级验收项的
  实现（插件无市场自更新，壳是唯一更新通道）；与 pnpm 硬链接副本
  （profiles/web/node_modules，解析优先级更高）共存无冲突。
- **注册（patch 层三行 + bundles 自愈）**：
  1. `easel` insert 行（config.projectRoot = easel_home）与 `easel-skills`
     insert 行（`@deepseek-ai/dsh-skill-filesystem`，config 写全量
     providerName/includeDefaultRoots/customSkillDirs）：**按 id 双形态
     insert-if-absent**（`row_has_id` 同时认 insert 包装内的 id）——insert 行
     已存在则不动；**平行行（config 覆盖式，pnpm 时代遗留）原位转换为 insert
     行并保留用户 config**（本机 projectRoot = 仓库根的钉扎得以延续），无
     config 才写默认；`easel-skills` 的默认 customSkillDirs 跟随被转换
     easel 行的 projectRoot（若存在），否则 easel_home——两行根保持一致，
     不留分叉。
  2. `ui-plugin-manager` disable 行（前端让位策略，easel-dsh-frontend.md:208
     的交付行为）：按 id insert-if-absent。**停用路径 = 编辑该行
     `disabled: false`，不是删行**（删行会被壳补回）。
  3. bundles 自愈：profile package.json 的 `dsh.profile.bundles` 若残留
     `dsh-plugin-easel`（pnpm 时代写入，包已无 `dsh.bundle` → composer 每启
     告警）则读改写移除。镜像 `remove_patch_row`/RETIRED_BUNDLES 的自愈惯例；
     **不追加** bundles 行（client 半经 patch 行 + fallback 解析，已由
     dsh-plugin 先例验证；`dsh plugin` 的 reconcile 也不会再激活它）。
  YAML 一律 `serde_yaml::to_string` 序列化（路径反斜杠/中文转义交给序列化
  器）；package.json 经 serde_json 读改写。
- **单测**（6 个，全真文件系统、`target/tmp` 根）：全新安装落盘形状、重跑
  幂等（outputs/stamp 不动、行不重复、**载荷版本不变也重拷**）、版本 bump
  重同步、平行行转换保留 projectRoot、既有 insert 行不劫持、bundles 残行移除。

### 4. 改动点四：重打壳 + 卸载钩子（T4）

- 重打链：`pnpm --filter @deepseek-ai/dsh-desktop-tauri bundle:runtime` →
  `build`（tauri build → NSIS）。产物即**唯一交付物**。
- **卸载清理问句**：tauri.conf.json `bundle.windows.nsis.installerHooks` 指向
  `src-tauri/installer-hooks.nsh`（2.11 schema 实证合法），`POSTUNINSTALL`
  MessageBox 默认「否」保留数据目录；评审实证钩子编入生成的 installer.nsi、
  中文文案无 mojibake。EASEL_HOME 重定向机器以行为为准（钩子只清默认路径，
  文档注明）。
- 体积实测：安装包 114MB → **120.5MB**（+6.5MB；skills 文本类压缩比高，
  初稿 +34MB 估计偏悲观）。

### 5. 交付与升级模型

- **首次安装**：dsh 官方向导一步装完；首启 spawn_child 自动布置 Easel（无第二
  向导、无用户感知额外步骤、不依赖 EASEL_PROJECT_ROOT 环境变量——注册行的
  绝对路径是唯一事实源）。
- **Easel 更新**：①随 dsh 升级（重打壳 + bump 插件版本号 → stamp 门全量同步
  skills/插件源，载荷每次启动重拷）；②skills/ 热更新（projectRoot 下直接改，
  skill-filesystem 的 watcher 热加载）。
- **依赖大件**（Playwright Chromium / ffmpeg / 转写模型）：继续 `install_tool.py`
  按需安装，不进安装包；`easel-runner-node-port` 完成后 Python 类依赖归零。
- **卸载**：NSIS 钩子一问一句，默认保留数据目录。
- **开发机共存**：平行行转换保留本机钉扎；`EASEL_HOME` 重定向可用但
  install-once（行内绝对路径首写后不随 env 刷新）。若单根开发（技能/数据都指
  仓库），编辑 easel-skills 行的 customSkillDirs 指仓库即可。

### 6. 风险与边界

- 改动在 dsh 仓（用户拥有 merge 权）；Easel 仓改插件 + spec。
- **已接受的 minor（评审记录）**：①双实例并发启动的 rm+copy 竞态——单用户
  桌面、下次启动自愈；②手工编辑的 insert `easel` 行 + 缺 `easel-skills` 行时
  后者取 EASEL_HOME（README 指引两行同写）。
- NSIS 路径长度：skills/ 深度浅；makensis `File /r` 静默嵌 0 字节的坑以
  产物体积带核对兜底（实测 +6.5MB 在带内）。
- 火绒拦 NSIS 静默安装：交付保持 GUI 向导形态（既有结论，不在本 spec 范围）。
- 已装机器（pnpm file: 安装）升级：pnpm 硬链接使 package.json/README 的改动
  即时传播到 profiles/web/node_modules 副本；bundle 行自愈移除后 composer
  零告警。

## [S3] Scope

**In**：插件 cordis.patch.yml 退役（Easel 仓）、bundle-runtime.mjs `stageEasel`、
setup.rs `ensure_easel_bundle` + dsh_runner 挂点、tauri.conf 卸载钩子、dsh 壳
重打、Easel-Setup.nsi 退役、安装文档更新。
**Out**：Easel 源码 git 并入 dsh 仓（保持双仓，打包只读引用）、用户数据迁移工具
（数据目录原地不动）、依赖大件进安装包、静默部署形态（火绒拦截，不做）、
mac/linux 平台的 Easel 捆绑（win-only 门，一行可放开）。

## Tasks

- [x] T1: Easel 仓——插件自注册退役：删 cordis.patch.yml、package.json 去
      dsh.bundle/files 行、README 安装章改写、node --test + node build.mjs 绿
      （7fd0555；files 退役 17bbc34；版本 0.2.0 579a1e0）
- [x] T2: bundle-runtime.mjs——`stageEasel`，本地跑通生成 runtime/ 并核对树
      内容（1b85d608e2；整目录载荷修复 2ebea588ea）
- [x] T3: setup.rs——`ensure_easel_bundle_at` + `dsh_runner.rs` 挂点 + 幂等
      单测 + cargo test（9b0fa0ee2c；载荷重拷断言 a900ebb580；11/11 绿）
- [x] T4: installer-hooks.nsh + tauri.conf 接线 + 重打 NSIS（26d91b3b89；
      产物 120.5MB，钩子编入实证）——干净虚拟机 GUI 全链路验证待用户/VM
      （沙箱不能跑 GUI；集成探针已覆盖注册形态与插件加载）
- [x] T5: Easel-Setup.nsi 退役 + delivery/ 清理 + 安装文档（c564f90，
      docs/INSTALL-DESKTOP.md）

## [S4] Acceptance

- [x] 干净机器只装一个 dsh 官方安装包 → 首启后左侧栏出现 Easel 轨道，无第二个
      向导、无手动配置、无 EASEL_PROJECT_ROOT 环境变量依赖
      （注册形态经真实 dsh dump-config + /easel/status 116 技能探针实证；
      GUI 首启最终确认待用户/VM）
- [x] `%LOCALAPPDATA%\Easel` 含 skills/、dsh-plugin-easel/、profiles/_template/、
      README、LICENSE、.bundle-version；不含 docs/、outputs/、.env、
      easel/、真实用户 profile 目录（白清单构造 + 单测断言）；profile patch
      落盘三行且路径指向内容目录（探针实证）；bundle 层零告警（自愈移除 +
      单测）
- [x] 升级安装（已有 profile + 旧 stamp）幂等：outputs/、profiles 用户数据、
      已有 patch 行 config 零改动；skills/与插件源同步新版本、载荷每次重拷
      （单测全覆盖）
- [x] 卸载 dsh 时弹一次「是否删除 Easel 内容目录」，默认否=数据全保留
      （钩子编入 installer.nsi 实证；VM 装卸最终确认待用户）
- [x] `Easel\delivery\` 旧拼装交付物全部移除
- [x] 手动安装路径（非壳）：README 给出的三行 patch 即可完整启用

## 后续修订（2026-10-16）

### 市场退役 + alpha.4（用户实机反馈：默认打开要安装的插件别出现）

用户安装 alpha.2 后发现两处「要安装插件」的默认面：①首启向导第 2 步是九款第三方
插件的勾选安装清单（页面自述「已内置：插件中心 dsh-plugin…以下插件按需勾选」）；
②壳首启把 DSH 插件市场（`dsh-plugin`，社区插件市场，浏览/安装 10000+ 插件）预装进
`profiles/node_modules` 并写 patch 行注册，「设置 → 插件中心」即其页面（含更新提醒）。
**处置（dsh worktree 9ec3fc3bf0）**：壳不再预装/注册市场，改为每次启动自愈清除三处
痕迹（载荷副本、两种形态的 patch 行、市场自更新可能写入的 bundle 列表条目；新增
`market_removal_heals_payload_row_and_bundle_listing` 单测，cargo test 16/16）；
bundle-runtime 停止暂存市场闭包并清除陈旧载荷（manifest plugins 收敛为
`dsh-plugin-easel` + `dsh-win-terminal-inspector`）；向导只留预设选择（插件清单、
提示行、安装循环全删；`install_plugin`/`apply_first_run` 保留为无 UI 调用的壳命令）。
**产品终态**（`~/.easel` 新 profile 经 staged runtime `--dump-config` 探针实证）：
无市场条目、`ui-plugin-manager` 被壳写 `disabled: true` 行关闭（「插件」面板不加载）、
全新 profile 本就无语音输入等实验性 bundle。**产物**：`Easel-dsh_0.2.1-alpha.4_x64-setup.exe`
（alpha.3 未安装即被本次取代；alpha.3 已含陈旧载荷修复，见 easel-standalone-client 修复轮）。
**记录在案**：①`agent-presets` patch 行在新 profile 报 "entry not found"（向导预设
选择实际不生效，等基础层提供该条目或改写为 insert 行）；②alpha.2 壳写出的 ~/.easel
patch 曾缺 `ui-plugin-manager` disabled 行（虽 T3 已含该代码，疑为用户侧改写），
alpha.4 启动会按缺行补写；③`apply_first_run` 的 plugins 参数已无调用方。
