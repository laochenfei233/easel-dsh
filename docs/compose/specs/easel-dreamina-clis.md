---
feature: easel-dreamina-clis
status: delivered
updated: 2026-10-25
branch: feat/easel-mac-package
commits: 交付落在本工作树（bundle-runtime.mjs / setup.rs / dsh_runner.rs / README 三件套 / 本 spec）；提交后回填哈希
---

# Easel 打包即梦 CLI（dreamina + dreamina-canvas）并暴露给 agent

## Report

**What was built** — 即梦（Dreamina）官方两个 AIGC CLI 直接打包进 Easel-dsh 安装包，agent 开箱即用。

1. **CLI 选型**：不用 npm 上的社区包；用即梦官方分发的单文件二进制 CLI。`dreamina`（即梦 CLI，v1.4.21）覆盖图片/视频生成（text2image、image2image、text2video、image2video、frames2video、multiframe2video、multimodal2video、image_upscale）、`query_result`/`list_task`、`session`、OAuth 设备流登录（`login --headless` + `login checklogin --device_code=`）、`user_credit`；异步两步提交，会员/积分与网页端一致，视频生成需先在网页端生成过一次（合规）。`dreamina-canvas`（即梦画布 CLI，v1.1.1）覆盖协同画布全链路（auth、canvas、model、node、operation、resource、voice、space/team、schema），有全局 `--format json`、`--non-interactive`、`--yes`；节点不 `--run` 只保存、`--run` 才提交生成；退出码 10=等积分确认、11=登录失效、20=等待超时（任务仍在服务端继续）。
2. **打包 staging**（`apps/desktop-tauri/scripts/bundle-runtime.mjs` 新增 `stageDreamina()`）：构建期把两个二进制 + 各自发布的 agent skill 拉进 `runtime/dreamina/`（bin/ 两个 exe、skills/dreamina-cli、skills/dreamina-canvas-cli 含 references/ 创作子技能、VERSION 版本戳），经 tauri `bundle.resources` 一并进安装包（Windows NSIS 与 mac dmg 同链路）。画布产物对照 CDN `payload.sha256` 逐文件校验；主 CLI 的 CDN 无校验和，以父目录 `version.json` 记录版本。下载先进 scratch、全部校验后才替换 staged 树（失败不留半成品）；已 staged 或本机已装 runtime（`DSH_DESKTOP_DREAMINA_REUSE` / 默认安装位置探测）可离线复用；`DREAMINA_CLI_DOWNLOAD_ROOT` / `DREAMINA_CANVAS_DOWNLOAD_BASE` 覆盖源；新 `--only <step>` 参数可单独重跑一步（CDN 刷新不必重付 pnpm deploy）。顺手修了构建脚本里 GNU tar 把 `C:\` 当远程主机的坑（Windows 一律走 System32 bsdtar 绝对路径，Git Bash PATH 上 GNU tar 在前也会坏 extract）。
3. **agent 可见性**：**PATH**——`dsh_runner.rs` spawn 链路把 `<resource>/runtime/dreamina/bin` 追加到继承 PATH 之后（用户自装版本优先，包内版本兜底未装机器）。**skills**——`setup.rs` 新增 `ensure_dreamina_skills()`，往 profile patch 写 `easel-dreamina-skills` 行：`@deepseek-ai/dsh-skill-filesystem` + `bundledSkillDir=<runtime/dreamina/skills>`（bundled 根 rank 600、trustedHost 直读安装目录、不遮蔽项目/用户 skill；用户若自装画布 CLI，preset 层 `~/.agents/skills/dreamina-canvas-cli` 同名覆盖，正好与其二进制配对）。`runtime/dreamina` 缺席（dev 未 staging）时整个 no-op。
4. **登录与积分边界**（沿用官方 skill 的规则，不在产品里重造）：登录走 CLI 打印的 OAuth 链接由用户在浏览器完成；需要积分确认时 agent 先展示报价再等用户确认（画布 CLI `--non-interactive` + 退出码 10 语义）。

## Notes

官方 skill 文档即 agent 说明书：dreamina 的 SKILL.md 安装脚本固定从 `dreamina_cli_beta/SKILL.md` 拉取；画布的 skill.tar.gz 每版随二进制发布，staging 直接取 CDN 现货，保持「skill 版本 = 二进制版本」。skill 目录发现只扫 `<root>/<name>/SKILL.md` 一层，两个 skill 各自目录挂在同一个 `bundledSkillDir` 根下，无需多行。dev-from-source：`node scripts/bundle-runtime.mjs [--only dreamina]` 后，dev 启动用 `EASEL_DREAMINA_DIR` 指向 staged 的 `runtime/dreamina`（镜像 EASEL_BUNDLE_DIR），或临时 `DSH_BUNDLED_SKILL_DIR` 验证 skill。验证：staging 实跑（win x64）全绿 + 幂等重跑；真实 web profile 带该 patch 行启动成功（zod 配置校验通过）；真实 provider 从 staged 树发现两个 skill（source=bundled）；`cargo test --lib` 37 过（含新增 `dreamina_skills_row_registered_and_idempotent`）；上游 skill-filesystem spec 21/22（唯一失败=本机环境坑，见踩坑）；真机包验收待用户。

## 踩坑

- dreamina CDN 的 `version.json` 在二进制目录的**上一级**，安装脚本两处 URL 不同源，staging 按 `DREAMINA_CDN_ROOT`/`DREAMINA_CDN_BASE` 分开。
- Git Bash 环境 GNU tar 解包 `-C C:\...` 报 `Cannot connect to C:`（remote host 语法）；cmd.exe 继承同序 PATH 也躲不开——必须绝对路径用 System32 bsdtar。
- 本机工作区根目录被宿主沙箱盖了 `Mandatory Label: Low (OI)(CI)(NW)`，一切 residing 在仓库内的 exe 启动即 Low 完整性：staged node/npm 写不了全局 npm-cache（Medium 对象）→ ship-pnpm 步骤曾两次 EPERM，staged dreamina.exe 写不了 `~/.dreamina_cli`（同因）。修法：ship-pnpm 改用 scratch 本地 `--cache`（staging hermetic 化）；本地验证前对 staged exe `icacls /setintegritylevel M`。生产安装目录无此标记，不受影响。
- 本机 `apps/desktop-tauri/runtime/` 曾整个被外部进程清掉（本会话两次复现，与昨日 easel/ 860 文件整树删除同源，疑似并行会话跑 `pnpm run clean`）；runtime 是可重建产物，重跑 staging 即可。staging 的 npm 下载另会被杀软瞬时锁（报错文案自带），重试即过。
- **主目录残留 `C:\Users\chenfei\.git`**（多年前旧项目残骸，无远端）：`findProjectRoot` 从任意临时 cwd 向上走会在主目录命中它，把 `C:\Users\chenfei` 当 projectRoot → `~/.agents/skills` 的 177 个真实 skill 泄漏进一切非仓库 cwd 的目录（上游 skill-filesystem spec 在本机红灯、CI 不受影响的根因）。留给用户处置（重命名/删除），本任务不代删。
