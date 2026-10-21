---
feature: easel-dsh-runtime
status: delivered
updated: 2026-10-14
branch: main（Easel 仓库，全部未提交）+ feat/easel-frontend（Easel/dsh）
commits: Easel 侧 2e34d7d..5d4da08（B1=b5fa531 B3=b9be659 B2=d77d939 B4=5d4da08）；dsh 侧 feat/easel-frontend 3 提交
---

# Easel 运行时迁移与桌面壳（第二阶段）

## 总目标（用户原话，两阶段共用）

> 「将 easel 变成原生的 dsh 插件，但不能破坏 dsh 的 agent 能力。dsh 该有的设置要有，
> easel 里面的对话功能要交给 dsh 实现。」

第一阶段 `easel-dsh-frontend`（status: delivered）完成前端替换：10 个 Easel 页面为
dsh 客户端插件页、侧栏轨道归 Easel、dsh 设置全保留（schedules 补了设置分区）、
Easel 聊天 UI 删除且对话归 dsh（含「做内容」一键推送 conversation.send）。
本阶段收运行时与交付形态。

## [S2.1] 终态决议（2026-10-13，用户拍板）

> 「easel 最后会被替换掉，只留下本项目 dsh 文件夹里 dsh 的插件和相关代码。
> 所以后期 easel 不需要考虑如何运行。」+ 「全原生处理。」

终态 = **Easel 的 Python 后端退役**，dsh-plugin-easel 宿主半（Node）逐步吸收其数据服务；
幸存物只有 `Easel/dsh`（worktree）+ 插件 + 数据目录（profiles/outputs/skills 归属待定，
倾向迁入 dsh home 或仓库内插件数据目录）。Plan B 全原生已拍板并落地（见 Tasks）。

**吸收路线图**：初版四条粗线条已于 2026-10-13 基于双侧代码勘察深化为 §S2.2（事实底账 + 分批 + 退役清单 + 待拍板项）。

## [S2.2] 后端吸收架构（2026-10-13 分析定稿）

**原则（ponytail）**：最懒且能跑的路线。重写禁区 = Python Playwright runner 舰队；
机械搬运走查表；OpenClaw 专属复杂度随退役整体删除、不迁移。

### 事实底账（双侧勘察结论，file:line 略）

- 后端 = 单文件 `web/app.py`（5290 行）+ runner 舰队（`skills/shared/scripts/`，46 脚本）。
- 端点依赖分类：**A 纯文件 IO（约 70%）**：personas/skills/ideas/schedule/radar/outputs 树
  与媒体/上传/会话快照/登录发布状态与短信码文件/登出/env 写；**B** 媒体流；**C** 网络抓取
  （trends RSS、模型探测）；**D** Playwright 自动化（全部在 runner 子进程，app.py 不碰浏览器）；
  **E** 对话（三通道中 OpenClaw 两条随退役删除）；**F** 后台任务（chat supervisor、安装 job、
  抖音发布线程——均为请求驱动的临时线程，无常驻调度器）。
- web↔runner 本就是文件协议（`login_state.py` 状态机 + `.png`/`.code`/`.log`），天然跨语言
  → 宿主半 spawn 同一批脚本即可，**runner 零改动**。
- 到期计算在 `publish_queue.py`（无状态脚本），触发责任本就在上层 cron（OpenClaw）——
  迁移后归 dsh 宿主定时能力；现状（无常驻调度器）即迁移基线。
- 前端消费面收敛于 `src/lib/api.ts` 单文件（~60 端点），路径不变即零改动切换；
  model-settings 与 env-tools 组当前无人消费（设置已归 dsh）→ 直接删。
- 宿主半已具备：webServer exact/prefix 路由 + SSE 保活、全权 fs/http/child_process、
  readSkillCatalog 先例、projectRoot/loader config 配置通道。
- 插件两半唯一桥 = webServer HTTP 路由（无直接 RPC）。

### 分批吸收（每批后 backendUrl 依赖减少，前端零改动）

1. **B1 纯文件 IO + 静态媒体**（~30 端点，难度低）：personas/skills/ideas/schedule/radar
   config/outputs（树·内容·media·删除）/上传/会话删除/登录与发布状态+短信码/登出/
   accounts 列表/env 写/trends（缓存+代理）。要点：路径穿越防护（`_persona_file_path`、
   `PROTECTED_OUTPUTS`）、原子写、`.easel.json` 项目头、multipart、Range。
2. **B2 子进程编排**（runner 保持 Python）：login 三模式启动/轮询、whoami、analytics、
   publish 全平台（含抖音异步状态机、biliup CLI、公众号 html_converter）、profile-build
   基线、schedule/context。= 把 app.py 的 spawn+文件轮询编排（约 300 行）移植为 TS；
   `python` + playwright chromium 成为插件显式依赖（安装要求写明）。跨进程文件锁
   （`_CrossProcLock`/transport 钉子）简化为进程内互斥（单 Node 进程）。
3. **B3 one-shot 流程 conversation 化（2026-10-13 拍板：方案 B）**：拆解/技能执行/发布文案/
   画像增强等 runAgent/executeSkill/streamChat 调用全部改为 useTopic 式推送（开 dsh 会话 +
   conversation.send），dsh 全套 agent 能力（审批/提问/工具渲染/权限档）原装生效；页面需要
   结果回填时由 agent 按 prompt 直接写 outputs/_ideas.json 等文件，页面回来刷新。
   宿主半不再实现执行引擎；headless 适配器（runtime.py TS 翻版）仅作兜底——仅当
   「回合完成事件」探明不存在且有流程真需无人值守跑完时启用。/api/chat*、/api/skill 随 B4 退役。
4. **B4 退役删除**：web/app.py、easel/harness 全部、direct_api、gateway 脚本、Docker、
   question bridge、raw 流、死端点组。到期触发挂 dsh 宿主定时能力周期跑
   `publish_queue.py run`（与现状等价）。

### 随退役删除（不迁移的复杂度）

gateway restart、openclaw.json 同步（app.py:1756-1894）、Ed25519 question bridge、
raw 流 tail、harness/openclaw 四模块（endpoint/workspace/cmd/questions）、direct_api、
`_CrossProcLock` 文件锁、transport 钉子文件、model-settings/env-tools 死端点。

### 数据目录：原地不动

profiles/、outputs/、skills/ 留仓库（宿主半 projectRoot 已指向）；`~/.easel-browser-profiles`
与 cookies.json 原地。迁 dsh home = 纯搬家劳动、无用户价值，YAGNI。

### 决议与待拍板

1. ✅ **B3 one-shot 形态**（2026-10-13 用户拍板）：**方案 B（conversation 模式）**，headless 仅作兜底。
2. ✅ **runner 舰队**（2026-10-14 随 B2 落地确认）：保留 Python 子进程，宿主半只移植
   spawn+文件轮询编排（`settings.python` 可配，默认 `python`/`EASEL_PYTHON`）。
3. ✅ **python 依赖交付**（2026-10-14 随 B2 落地）：先行系统 python + playwright chromium
   （插件显式依赖，安装要求写明）；安装包捆绑后议。

### 勘察结论（2026-10-13，B3 已依此实现）

- 「回合完成」可感知：`sessions.retain(id)` 后订阅 `reference.binding.session`
  快照的 `running` true→false 边沿（ISessions 文档面）；`conversation.send()`
  只代表入队受理，不是完成。
- `sessions.create({cwd})` 支持指定工作目录 → 会话 cwd=项目根，agent 文件工具
  可直接读写仓库（实测写 `outputs/_ideas.json` 成功；agent 自行用临时文件中转
  后清理，说明写权限无碍）。
- 会话「访问模式：工作区内修改」下，cwd 范围内写文件免审批。

### 待探明（B2 开工前）

- 桌面壳（Tauri）下 python+playwright chromium 的交付方式（系统依赖 or 捆绑）。

## Report

**What was built** — Easel 已整体并入 dsh：前端是 dsh 插件（10 页 + Apple 设计层），
对话与 one-shot 任务全在 dsh 会话（useTopic/pushTask），后端职责由插件宿主半分四批
（B1 文件 IO、B3 会话化、B2 runner 编排、B4 退役）全部吸收。终态机器上没有任何
Easel Python 进程：登录/发布/归因由宿主半 spawn 原班 Python runner（文件协议），
`python` 是插件显式依赖（settings.python / EASEL_PYTHON）。数据目录原地不动。

**Verification** — 每批交付即测：node --test 39/39（本地路由/编排/路径安全/env 注入守卫）；
B1 杀后端实测 13 端点本地应答；B3 浏览器端到端（拆解回合→_ideas.json 回写 schema 正确）；
B2 实测 calendar_ops.py 真实 spawn；B4 终局无后端冒烟 13×200 + 退役面 404 + pytest 74/74。

**Journey log** —
1. pnpm file: 硬链接断链：Edit 工具重命名式写入后必须显式 cp 到 profile 副本（跨四批反复踩，已成为固定收尾步骤）。
2. python 脚本对 api.ts 做区间切删除两次过量切除（buildProfile/fetchTrends 段被误删）——区间锚点不可信，改精确文本块 + 长度断言。
3. B3 拍板前的「回合完成」勘察找到了文档面方案：SessionSnapshot.running 边沿，避免了引未承诺服务面。
4. runner 舰队（46 个 Playwright 脚本）全程零改动——web↔runner 的文件协议天然跨语言，「重写」从需求变成了禁忌。
5. 用户 WIP 归档分支（archive/pre-b4-backend-wip）先于删除创建；归档提交顺带吞掉的未跟踪幸存物（skill-platform-capture）需从分支捞回 main。

## [S1] Problem

前端已是 dsh 插件，但运行时仍是双轨：Easel 后端在 Docker 容器里与 OpenClaw 共生，
而 dsh 是原生 Windows 程序；桌面交付缺壳；登录被无头自动化的 IP 风控卡死；热点源写死。

## [S2] Design

- **Harness 抽象第三通道**：dsh 无 OpenAI 端点也无 CLI，官方进程外驱动方式是 Python SDK
  （stdio JSON-RPC）。按协议文档 §7.3 预案补 `RunTurnHarness` 可选协议
  （刻意不进 Harness 本体——runtime_checkable 会把旧实现判出局），
  `easel/harness/deepseek/runtime.py` 用 SDK 子进程跑回合，事件映射 Easel 六事件。
- **登录三模式**：qr（现状）/ manual（有头窗口，用户亲手登录）/ cdp（接管用户 Chrome，
  端点默认 :9222 = cloakbrowser-cdp 容器）。runner 加 `--headed`/`--cdp`，
  新增 `window_login` 状态。manual 与 cdp 的区别：前者是 playwright 自己开的可见浏览器
  （独立 profile），后者接管用户已开的真浏览器（真指纹/登录态）。
- **热点自定义源**：`outputs/_radar_config.json` 存 {name,url,kind: rss|json,category,enabled}；
  RSS 走标准库 XML 解析（参考 news-radar-pusher）；代理 URL 同文件存，应用于
  后端 urllib opener 与登录 runner 环境。
- **Tauri 壳**：`dsh/apps/desktop-tauri`，runtime = 工作树 pnpm-deploy 闭包（含全部前端改动），
  NSIS 安装包；easel 插件装入壳用的 web profile（`~/.dsh/profiles/web`，
  config 钉 projectRoot/backendUrl，有 .easel-bak 备份）。

## [S3] Scope

**In**：harness deepseek 适配器、登录三模式、雷达自定义源/代理、多账号画像浏览器、
Tauri 壳打包、web profile 装配。
**Out**：Easel 后端业务逻辑改动；OpenClaw 在 Windows 的安装（若 Plan B 采纳则直接退役）。

## Tasks

- [x] deepseek harness 适配器（端到端 SSE 实测 ✓；模型须 deepseek-flash / deepseek-v4-pro，
      用户凭据只认这两个；`EASEL_HARNESS=deepseek` 启用；容器内不可用——容器无 node/dsh）
- [x] 登录三模式（API + runner + 账号页选择器 + window_login 引导；B站 TV API 仅 qr）
- [x] 热点自定义源 + 分类筛选 + 应用内代理（浏览器实测 Hacker News RSS 入页 ✓）
- [x] PersonaBrowser 多账号画像（左列表右详情，切换联动全局 persona）
- [x] Tauri 壳打包（NSIS 114MB；bundle-runtime 五处离线补丁：node 复用/pnpm 复用/
      插件复用/node-pty 容错/超长路径剔除；窗口 reveal-on-ready 修复——原来无人显示主窗口）
- [x] easel 插件装入 web profile + :3081 冒烟（host 半加载、backend reachable ✓）
- [ ] **用户双击安装包验证壳**（AI 沙箱身份写 `~/.dsh` 被 os error 5 拒，无法代验；
      手动同路径操作全部正常，属测试环境限制）
- [x] **Plan B 全原生**（2026-10-14 随 B4 达成终态）：Easel 原生 Windows 运行过过渡期，
      B4 后 Python 后端整体退役——对话/skill 执行全在 dsh 会话，runner 由插件宿主半直接 spawn。
- [x] 两侧提交（Easel 侧 b5fa531→5d4da08 四批全提交；用户 ~26 文件 WIP 预先归档到
      archive/pre-b4-backend-wip 分支，未丢失）
- [x] B1 纯文件 IO + 静态媒体吸收（2026-10-13 交付：27 条本地路由进宿主半 index.js，
      local-first 调度、未命中回落代理；后端下线实测——status/personas/115 skills/画像六维/
      账号与登录发布状态/outputs/选题/排期/雷达配置/trends（自定义 RSS 源 + 代理 + 失败降级）
      全部本地应答，未吸收路径 502 回落；node --test 36/36 PASS。运维注意：启动 dsh 须带
      EASEL_PROJECT_ROOT=<Easel 仓库根>，否则本地读落到 cwd）
- [x] B3 one-shot 流程 conversation 化（2026-10-13 交付：src/lib/task.ts pushTask 通道——
      running 边沿判完成、cwd=项目根、abort=conversation.cancel；爆款拆解改 open 推送，
      选题由 agent 回写 outputs/_ideas.json；技能抽屉/一键适配/发布预检改后台推送，
      结果写 outputs/_adapt/<batch> 页面读回填卡；api.ts 删除 runAgent/executeSkill/
      streamChat/stopChat/fetchLastTurn/question 通道等 chat 执行面（927→692 行）；
      浏览器端到端实测：拆解回合真实运行（读画像六维→成稿→写文件）、会话树转完成态、
      _ideas.json 新增条目 schema 正确（12hex id/source=爆款拆解/note 3645 字））
- [x] B2 runner 子进程编排吸收（2026-10-14 交付：login 三模式启动+进程表+死亡识别、
      whoami（150s 超时+600s TTL 缓存+可信结论回写标记）、analytics 抓取、publish 全平台
      （媒体校验/抖音异步状态机+短信码文件/biliup CLI/公众号 html_converter+后台会话发布/
      成功回流排期）、公众号凭证 mini-YAML 读写+token 验证子进程+mp 后台登录、
      schedule/context（calendar_ops.py）、profile/build 基线直写（AI 增强改向导页推 dsh
      会话，方案 B）。runner 舰队 46 个 Python 脚本零改动；python=显式插件依赖。
      node --test 39/39；实测 schedule/context 真实跑通 calendar_ops.py，校验类端点全本地）
- [x] B4 Easel 后端退役删除（2026-10-14 交付：代理与探活拆除（未认领路径 404）、
      web/app.py + easel 包 + openclaw + Docker + gateway/setup/pyproject + 31 个后端测试
      删除；web/frontend 仅留 src/styles（构建样式源），marked/dompurify 改从 dsh pnpm
      store 解析；video_pipeline 工作区解析改 EASEL_ROOT；runner 舰队及其 74 测试原样保留。
      终局验收：无任何 Easel 进程运行，消费面 13 端点全 200、退役面全 404、python runner
      正常 spawn，node --test 39/39 + pytest 74/74）

## [S4] Acceptance

- [x] 对话归 dsh：Easel 自有聊天已删，dsh conversation 唯一（第一阶段已验，本阶段未回归）
- [x] agent 能力未破坏：审批/提问/工具渲染/模型/权限档/会话浏览在位（独立复核 7/7 PASS）
- [x] deepseek 通道端到端出真实回答（:7870 实测，agent 能读 Easel 仓库）
- [x] 登录 manual/cdp 通道打通（qr 受 IP 风控是平台侧，非管道问题）
- [x] 自定义 RSS 源真实数据入页
- [ ] 壳安装后窗口内为 Easel 前端（待用户）
- [ ] Plan B 全原生链路（待拍板）

## 工作区事实（压缩上下文用）

- **拓扑**：Easel 后端 = Docker `easel-easel-1`（:7860，`COPY . .` 镜像——改后端必须
  `docker compose build easel && docker compose up -d --force-recreate easel`）；
  dsh :3099 scratch（`$TEMP\dsh-easel-verify`，DSH_HOME，token 在 o*.log）；
  CDP :9222 = cloakbrowser-cdp 容器；Tauri 壳 :3081。
- **安装包**：`dsh/apps/desktop-tauri/src-tauri/target/release/bundle/nsis/
  DeepSeek Harness Desktop_0.2.1-alpha.2_x64-setup.exe`
- **dsh 工作树**：feat/easel-frontend @ 5279eace8b + desktop-tauri 未提交改动
  （bundle-runtime.mjs / dsh_runner.rs / lib.rs）
- **硬坑**（跨任务）：pnpm file: 安装是硬链接，Edit 工具断链需显式 cp 同步；
  `__ModuleLoader__.load` 包装只允许一处（build.mjs）；EaselPage 必须包 `.easel-scope`；
  代理写操作须先拒跨站再盖后端自身 Origin；dsh 重启后浏览器旧会话引用致白屏（刷新即愈）。
