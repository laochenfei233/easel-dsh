# dsh-plugin-easel

把 Easel 作为 DeepSeek Harness（dsh）插件运行的集成包。

桌面壳安装（首选）：Easel 随 dsh 官方安装包捆绑发布，壳首启自动布置目录与注册
行——见 `docs/compose/specs/easel-dsh-bundled-install.md`。本 README 描述的是
插件包本身的契约与手动安装路径。

一个仓库外插件包，三个贡献：

| 贡献 | 扩展点 | 状态 |
|---|---|---|
| Easel 的 114 个技能在 dsh 里加载 | `dsh-skill-filesystem` 的 `customSkillDirs`，作为**部署级**行挂在 `skills` 注册表的**全局层** | 已实测：`/easel/skills` 返回 114 条 |
| Easel 后端能力经 dsh 同源访问 | `ctx.webServer.register({ kind: 'prefix' })` 反向代理 `/easel/api/*` → `http://127.0.0.1:7860/api/*` | 已实测：后端未启动时回落 502，启动后透传 |
| Easel 面板进侧边栏 | 客户端半边注册 `main`（keyed）+ `sidebar.panellist` | 代码就位，浏览器内渲染**未实测**（见「未验证」） |

## 为什么是插件而不是 fork

`docs/harness-protocol.md` §7 已经给出了 dsh 落位评估，本包是它的「方案 A」落地：Easel 的
FastAPI 后端一行不动，dsh 侧只加一个插件行 + 一个代理路由。dsh 的 `docs/architecture.md`
明确禁止「另一个可执行文件或内联应用树」作为扩展形态，「自定义插件组合仍是 profile + 有序
patch 文件」——所以本包不带自己的启动器，只作为一个 bundle 被组合进去。

## 安装

本包**不自带注册 patch**（bundle 身份已退役，包不再声明 `dsh.bundle`）——注册行
由安装方写进 profile 的 `cordis.patch.yml`。dsh 官方桌面壳（bundled install）首启
自动写入；手动安装把下面三行照抄（路径写死绝对路径，不依赖环境变量求值）：

```yaml
- insert:
    - id: easel
      name: dsh-plugin-easel
      config:
        projectRoot: <Easel 项目根绝对路径>
    - id: easel-skills
      name: '@deepseek-ai/dsh-skill-filesystem'   # 复用随附 provider，不自己解析 frontmatter
      config:
        providerName: easel
        includeDefaultRoots: false
        customSkillDirs: [<Easel 项目根>/skills/openclaw]
- id: ui-plugin-manager
  disabled: true   # 侧栏让位策略，可选；想要 dsh 原生侧栏就不写这行
```

包本体进 profile 可解析的位置（桌面壳拷到 `$DSH_HOME/profiles/node_modules`，
手动安装可用 `dsh plugin --profile <profile> add file:/path/to/Easel/dsh-plugin-easel`
装依赖——包已不声明 bundle，`add` 只装包不激活，激活完全靠上面的 patch 行）。

启动：`dsh --profile <profile> web`

## 配置

都在 profile patch 层 `easel` / `easel-skills` 行的 `config` 块，没有写死的常量：

| 字段 | 默认 | 说明 |
|---|---|---|
| `projectRoot` | `$EASEL_PROJECT_ROOT` ?? `process.cwd()` | Easel 项目根。**行里必须写**；环境变量回退只为开发机从仓库根启动的场景保留 |
| `skillsDir` | `<projectRoot>/skills/openclaw` | 技能浏览目录（也用于 `easel-skills` 行） |
| `backendUrl` | `$EASEL_BACKEND_URL` ?? `http://127.0.0.1:7860` | Easel 后端 origin |
| `basePath` | `/easel` | 本插件路由此前缀下挂载 |
| `probePath` | `/api/personas` | 探活路由。选它而不是 `/api/status`，因为后者会花一次 `check_gateway()` 网络往返 |
| `probeTimeoutMs` | `1500` | 探活超时 |

`basePath` 与 `client.js` 里的 `BASE_PATH` 常量是一对：改一个要改两个。

## 路由

| 路由 | 作用 |
|---|---|
| `GET /easel/status` | 项目根、后端可达性、技能数。后端挂掉也照样回答，面板因此能说出「为什么是空的」 |
| `GET /easel/skills` | 只读浏览目录，直接读盘。**不是**技能 provider |
| `/easel/api/*` | 本地数据面（排期/选题/热点雷达/CalDAV 等），全部由 `index.js` 的 `CORE_ROUTES` 本地应答；Easel 的 Python 后端与反向代理已退役，无路由认领的请求 404 |

`/easel/skills` 与 `easel-skills` 行刻意分开：前者是给 UI 看的投影（多带一个 `layer` 字段，
dsh 的技能加载器不用它），后者才是真正的加载路径，复用随附 provider 做 frontmatter 解析、
kebab-case 校验与调用策略。**同一个后端不该有两套解析逻辑**，所以本包不自己写 provider。

### 内容日历：节假日底图与 CalDAV 订阅

节假日底图为纯客户端数据，不发网络请求：`src/data/holidays-cn.js`（法定节假日+调休，vendor
自 holiday-cn，现覆盖 2025–2026）+ `src/lib/lunar.js`（农历传统节日，经典位表 1900–2100）+
`src/lib/festivals.js`（合并固定/浮日国际与电商节日，法定优先、同名去重）。国务院每年 11 月
公布次年安排后，随版本更新数据文件即可。

CalDAV 为单向只读订阅（协议实现见 `caldav.js`，零依赖）：

| 路由 | 作用 |
|---|---|
| `GET/PUT /easel/api/caldav/accounts` | 订阅账号（`outputs/_caldav_config.json`）。GET 密码一律掩码；PUT 空密码保留原值。凭据明文存本机工作区 |
| `POST /easel/api/caldav/accounts/:aid/discover` | 自动发现可订阅日历（current-user-principal → calendar-home-set；直填日历 URL 时直接返回） |
| `POST /easel/api/caldav/accounts/:aid/sync` | REPORT calendar-query 拉取 −60d..+300d 事件，RRULE 展开后写 `outputs/_caldav_cache.json` |
| `GET /easel/api/caldav/events` | 读事件缓存，客户端按可见月份过滤展示 |

排期条目新增可选 `repeat: 'yearly'`（仅此值合法），客户端按月/日展开进渲染窗口；更新时
不带该字段保留原值，显式空串清除。

### 定时任务（Host schedule 引擎）

「定时任务」视图（rail order 34）是 Host schedule 引擎的产品入口：创建走
`POST /easel/api/automation/tasks`（引擎 `create()` 是 host 进程 API，remote 面没有
create 方法），表单的四种时机形状（仅一次/每天/每周/每 N 小时或分钟）在宿主侧映射为
ScheduleCreateRequest，引擎校验错误映射为可读中文。目录、编辑时机、删除与运行记录走
dsh 的 `remote.schedule`，变更事件 `schedule/changed` 驱动刷新。cron 任务在 easel 页面
只读展示，深度编辑走 dsh 自带的自动化任务页（设置 → 自动化任务；其 rail 行本包保持隐藏）。

## 未验证 / 已知缺口

1. **客户端面板没在浏览器里看到。** dsh 引导成功、宿主路由返回真实数据，但侧边栏入口是否
   真的渲染出来，本机驱动浏览器时卡住未能确认（agent-browser 未装 Chromium，`open` 挂住）。
   **注册契约已对 0.2.1-alpha.2 源码逐条核对**：
   - `dsh.client.platform` 必须是字符串、`inject` 必须是字符串数组（`client/manifest.ts:161` `parseDshClient`）✓
   - 声明了 `dsh.client` 就必须导出 `./client`，否则注册表**抛错**（`client/modules/src/index.ts:847`）✓
   - loader 条目名必须是**裸包名**，且浏览器模块 id 必须等于该包名（`index.ts:874` `exactPackageSpecifier`）→ `id: 'dsh-plugin-easel'` ✓
   - `main` 是 `keyed` 槽 → 需要 `key`；`sidebar.panellist` 是 `list` 槽 → 需要 `id`/可选 `order`/`label`，`SlotLabel = string | (() => string)`（`ui-slots/src/index.ts:758,769,774`）✓
   - `locale.register(ns, { zh, en })` 与 `locale.bind(ns)`（`client/locale/src/client/index.ts:389,448`）✓
   剩下真正没验的只有「浏览器里渲染成什么样」。
2. **技能正文里的 AGENTS.md 依赖。** 多个 SKILL.md 让 agent「先 cd 到 AGENTS.md 末尾给出的
   Easel 项目根」，而那个 AGENTS.md 是 `openclaw/workspace/AGENTS.md`，其项目根小节由
   `openclaw/sync.sh` 在同步时追加。Easel 仓库根没有 AGENTS.md，所以 dsh 侧需要一个等价物：
   在 `<DSH_HOME>/AGENTS.md` 里写上 Easel 项目根绝对路径。**这是接 dsh 前必须先补的一步**，
   否则技能找不到工作目录。
3. **`profiles/` 命名不一致。** `openclaw/workspace/AGENTS.md` 里叫 `easel-profiles/`，
   真实目录是 `profiles/`；OpenClaw workspace 里靠一个符号链接糊过去，dsh 侧没有这个链接。
4. **后端要自己起。** dsh 的 webserver 是 Node 侧 handler，挂不了 Python ASGI 应用，
   所以 Easel 后端必须作为 sidecar 独立进程跑（`easel web`）。本包只做代理，不负责拉起它。
5. **写请求的 Origin 门。** Easel 的 `local_write_guard` 对非 GET 请求校验 Origin。
   经 dsh 代理过去时 Origin 是 dsh 的地址；回环地址正常放行，绑到其他网段时需要把它加进
   Easel 的允许列表。
6. 本包的实测环境是 dsh **0.1.7-rc.1**（`apps/desktop-tauri/runtime` 预构建运行时）。
   组合层同时验证过 **0.2.1-alpha.2**（上游合并后的源码树，`--dump-config`）。
   两个版本上扩展点都在。

## 测试

```bash
node --test test/*.test.js
```
