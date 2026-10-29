---
feature: easel-libtv-cli
status: delivered
updated: 2026-10-29
branch: feat/easel-libtv-cli
commits: acb7f5e8cf..a4538d1b9a
---

# Easel 预置 LibTV CLI（libtv）

## Report

**What was built** — LibTV 官方 CLI（`libtv` 1.2.0）与其完整 agent skill 包现在随 Easel-dsh 一起打包，agent 开箱可驱动 LibTV 画布。

1. **打包**：`bundle-runtime.mjs` 新增 `stageLibtv()`，构建期把平台 zip 与 skill zip 拉进 `runtime/libtv/`（`bin/libtv(.exe)`、`skills/libtv-cli/**`、`VERSION`），覆盖发布矩阵的五个目标：Windows amd64/arm64、macOS arm64/x64、Linux amd64。`runtime-inputs.json` pin 了 zip、解压出的可执行文件与 skill 整树摘要；缺失 pin、字节不符、架构不符都直接报错。`--only libtv` 可单独重跑，`manifest.json` 增加 `libtv` / `pinned.libtv` / `verified.libtv`。
2. **解压**：Windows 用系统 bsdtar；POSIX 改用 `unzip`（Linux 的 GNU tar 读不了 zip），两个 Linux 打包 workflow 显式安装 `unzip`。
3. **agent 可见性**：`dsh_runner.rs` 把 `<runtime>/libtv/bin` 追加在继承 PATH 与 dreamina 之后（vendor 安装脚本装的 `~/.libtv/libtv` 优先）；`setup.rs` 的 `ensure_libtv_skills()` 写入 `easel-libtv-skills` 行，`bundledSkillDir` 指向 staged skill 树，dev 用 `EASEL_LIBTV_DIR` 覆盖。登录不重造：`libtv login web|phone` 由 CLI 自行完成。

**Verification** —
- PASS `node scripts/bundle-runtime.mjs --platform win --only libtv`：首次下载、校验、落盘 `runtime/libtv`；重跑走 “already staged, pins verified”。
- PASS 篡改 staged 二进制或 skill 文件后重跑均 exit 1（sha256 / 整树摘要不符）；恢复后重跑回到 skip 路径。
- PASS `--platform win --arch arm64` 落 windows-arm64；`--platform linux --arch arm64`（无 pin、无矩阵行）报 “pins no libtv build for linux-arm64”。
- PASS WSL Rocky 9（GNU tar 1.34）：`tar -xf libtv.zip` 报 “This does not look like a tar archive” exit 2；`unzip -q -o` 解出 56 个文件、整树 sha256 = `5c715f2b…`，与 pin 一致。
- PASS `cargo test --lib`：50 passed / 0 failed，含新增 `libtv_skills_row_registered_and_idempotent`。
- PASS `verify-translation-pairing`（README 三件套）与 `verify-doc-budgets`（7 份预算文档在限内）；`node --check`、`git diff --check` 通过。

**Journey log** —
- 首轮平台映射把 Linux 的 `--arch arm64` 静默落成 amd64 包；改为 arch 参与 target 计算后，无 pin 的目标按预期报错。
- 发布矩阵里的 Windows arm64 是第一轮漏掉的 pin；对照 `desktop-release.yml` 补齐 `windows-arm64`。
- 复审发现 Linux CI 的 GNU tar 根本读不了 zip，会在 staging 阶段直接断掉 Linux 打包；改为 POSIX 走 `unzip` 并补进两条 apt 安装行。
- 状态机选择「完整树才 skip、否则校验失败即报错」：同一 `runtime/` 目录换架构构建会明确失败，而不是悄悄打包错架构的二进制。

## [S1] Problem

Easel 已经把即梦官方的 `dreamina` / `dreamina-canvas` CLI 打包成开箱即用的能力：二进制在 `runtime/dreamina/bin`、vendor 发布的 agent skill 在 `runtime/dreamina/skills`，agent 无需用户手工安装即可驱动画布类创作工具。LibTV（哩布哩布的 AI 画布）也发布了一份同形态的官方 CLI 与 skill 包（`libtv-cli-skill.zip`，当前 1.2.0），但 Easel 里既没有 `libtv` 可执行文件，agent 也读不到它的 skill，用户只能在终端自己装。因此要让 LibTV 获得与即梦同等的“预置支持”。

## [S2] Design

### S2.1 打包形态

沿用 `runtime/dreamina` 的先例，新增并列的 `runtime/libtv` 内容树：

```
runtime/libtv/
  bin/libtv(.exe)
  skills/libtv-cli/**        # vendor skill zip 解压后的完整目录
  VERSION                    # {"libtv":"1.2.0"}
```

- 二进制与 skill 都取自同一次发布的 1.2.0，保证 skill 文档与 CLI 版本一致。
- skill 目录按 vendor zip 原样解压（含 `commands/`、`examples/`、`node-types/` 等同级文档，SKILL.md 的相对链接依赖它们）；不裁剪 `scripts/install-*`，与 dreamina 保留 vendor 原文的做法一致。
- `tauri.conf.json` 已把 `../runtime` 整体作为资源打包，无需新增打包配置。

### S2.2 版本与摘要 pin

`runtime-inputs.json` 新增 `libtv`：

- `version: "1.2.0"`、`baseUrl: https://liblibai-web-static.liblib.cloud/cli/1.2.0`、`skillZip` 文件名。
- `skillZipSha256`（zip 传输校验）与 `skillTreeSha256`（解压后整树摘要，算法与 `treeSha256` 相同）。
- `files.<target>`：`zip` 文件名 + `zipSha256` + `cliSha256`（解压出的可执行文件摘要）。

platform target 映射：`windows-amd64` → `libtv-windows-amd64.zip`，`windows-arm64` → `libtv-windows-arm64.zip`，`darwin-arm64` → `libtv-macos-arm64.zip`，`darwin-amd64` → `libtv-macos-x64.zip`，`linux-amd64` → `libtv-linux-x64.zip`。缺 pin 直接报错，与 dreamina 一致。发布矩阵（`desktop-release.yml` 的 Windows x64/arm64、macOS arm64/x64、Linux x64）全部有对应 pin。

### S2.3 staging

`scripts/bundle-runtime.mjs` 新增 `stageLibtv()`：

1. 目标平台已有完整 staged 树 → 校验 `VERSION`、可执行文件 sha256、skill 整树 sha256 后跳过。
2. 否则依次尝试 `DSH_DESKTOP_LIBTV_REUSE` 与本机已装 Easel 的 `runtime/libtv` 复用，复用前同样校验。
3. 否则下载平台 zip 与 skill zip 到 scratch，解压、校验可执行文件与 skill 整树，最后用 `writeLibtvTree()` 替换 staged 目录。下载或校验失败不动旧树；复制中途失败留下的残树没有最后写入的 `VERSION`，会被下次运行判为不完整并重做。
4. Windows 用随系统 bsdtar 解 zip；POSIX（Linux 的 GNU tar 读不了 zip）改用 `unzip`，macOS 与 Linux CI 镜像均自带，两个 Linux 打包 workflow 也显式安装。
5. `--only libtv` 可单独重跑；`manifest.json` 增加 `libtv: {libtv: version}` 与 `pinned.libtv`，`verified.libtv` 记录本轮是否真的对过 pin。

### S2.4 agent PATH

`dsh_runner.rs` spawn dsh 时把 `<runtime>/libtv/bin` 追加在 dreamina 之后、继承 PATH 之后：用户用 vendor 安装脚本装的 `~/.libtv/libtv`（在继承 PATH 里）优先，包内版本兜底未安装的机器。

### S2.5 skill 注册

`setup.rs` 新增 `ensure_libtv_skills()`（no-op 于未 staging 的 dev 环境），向 web profile 的 `cordis.patch.yml` 插入与 dreamina 同形的行：

```yaml
- id: easel-libtv-skills
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    providerName: libtv
    includeDefaultRoots: false
    bundledSkillDir: <runtime/libtv/skills>
```

bundled 根 rank 600、`trustedHost` 直读安装目录；用户 `~/.agents/skills/libtv-cli` 同名覆盖，正好与其自装 CLI 配对。`EASEL_LIBTV_DIR` 供 dev 指向 staged 树。

### S2.6 登录与账号

不重造登录：`libtv login web` 会起本机临时回调服务并在 stderr 打印登录链接，agent 把链接交给用户浏览器完成；`libtv login phone` 走手机验证码。凭据由 CLI 写入 `~/.libtv/credentials.json`，与 dreamina 的 `~/.dreamina_cli` 同属 CLI 自有状态，不进 Easel 数据根。

## [S3] Scope

- In scope：
  - `runtime/libtv` 的 build-time staging、pin 与 manifest。
  - `libtv` 的 agent PATH 注入与 bundled skill 注册（发布矩阵：Windows x64/arm64、macOS arm64/x64、Linux x64）。
  - `apps/desktop-tauri` 三份 README 与 spec。
- Out of scope：
  - TapNow 预置接入（调研结论见下，官方无 CLI/skill 包，只有 MCP connector）。
  - libtv 的客户端 UI、登录向导、自动更新检查。
  - 为 libtv 增加新的 provider/模型注册（CLI 自带 `libtv model` 检索）。

## 调研备注：TapNow

TapNow 官方目前的 agent 接入形态是 **MCP connector**（`https://mcp.tapnow.ai/api/agent-gateway/mcp/general/mcp`，OAuth 授权），并出现在 WorkBuddy / QwenWork / 豆包工作 等插件市场；官方文档没有发布独立 CLI、也没有 libtv 那种 `*-cli-skill.zip`。社区有一个非官方 `tapnow-cli`（基于网页接口、依赖本机 Chrome、登录态在 `~/.tapnow-cli`），不适合作为预置二进制随包分发。结论：TapNow 暂不提供与 libtv 同形态的预置支持；若要做，应走 MCP connector 配置而非打包 CLI。

## Tasks

- [x] T1: `runtime-inputs.json` 写入 libtv 1.2.0 的五个平台 zip/exe 摘要与 skill 摘要（depends: none）
- [x] T2: `bundle-runtime.mjs` 新增 `stageLibtv()`、`--only libtv`、manifest 字段与复用/校验路径（depends: T1）
- [x] T3: `setup.rs` 新增 `ensure_libtv_skills()` 与幂等测试，spawn 链路调用（depends: none）
- [x] T4: `dsh_runner.rs` 把 `runtime/libtv/bin` 追加到 agent PATH（depends: none）
- [x] T5: 三份 README（含 `README.i18n.yaml`）补 libtv 说明（depends: T2/T3/T4）
- [x] T6: 本机实跑 `--only libtv` staging、cargo 测试与文档门（depends: T1..T5）

## [S4] Acceptance

- [x] `node scripts/bundle-runtime.mjs --platform win --only libtv` 在 Windows 上完成下载、校验并产出 `runtime/libtv/{bin/libtv.exe,skills/libtv-cli/SKILL.md,VERSION}`。
- [x] 重跑同一命令走 skipped 路径并重新校验 pin；把 staged 文件改一个字节后重跑会报错。
- [x] `runtime/libtv/skills/libtv-cli/SKILL.md` 的 frontmatter 为 `name: libtv-cli`，整树 sha256 与 pin 一致。
- [x] Rust 单测覆盖 `ensure_libtv_skills_at`：首次写入 `easel-libtv-skills` 行、二次调用不重复、用户改写的行保持不动。
- [x] staged 树存在时 spawn 的 PATH 末尾包含 `runtime/libtv/bin`；树缺席时 setup 与 PATH 注入均为 no-op。
- [x] `cargo test --lib` 通过；docs 门（README i18n 配对）通过。
- [x] Linux/POSIX 解压路径：WSL 实证 GNU tar 失败、`unzip` 产出与 pin 相同的整树摘要；两个 Linux 打包 workflow 显式安装 `unzip`。
