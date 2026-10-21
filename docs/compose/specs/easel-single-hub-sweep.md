---
feature: easel-single-hub-sweep
status: delivered
updated: 2026-10-18
branch: feat/easel-frontend（Easel/dsh 壳仓，沿插件时代的壳提交线）
commits: # filled at delivery
---

# 单实例清场：一个壳一个 server，多余的 dsh web 全杀

## Report

**What was built** — 用户连续两天撞上「会话被其他 DSH 占用」（`session/writer-held`，
单写者锁）+ 机器上同时三个实例（3081 壳死户孤的旧代 server、3082 正主、3083 源码树
开发壳）。壳的 supervise 决策点（收养/冷启二选一）从不看记录之外的活实例。现在每个
决策点先清场：`sweep_rival_servers(keep)`——按命令行签名（node + `bin.js` +
` web --port` + 路径含 `easel-dsh\runtime` 或 `easel\dsh`）枚举进程，除收养的正主
（record.pid）外全部 `terminate_pid`（taskkill /T /F）。路径过滤保证 prism/原版 dsh
等别家产品绝不被误杀；debug 构建（tauri dev）跳过清场，开发壳不杀装机实例。
清场跟随每轮 hub 死亡→重决策，孤儿与后来者在其生命周期内即被 retired。

**Verification** — `cargo test` 17/17（新增 rival_pids 决策核测试：装机的孤儿按
大小写不敏感命中、源码树开发实例命中、prism/无关进程排除、keep 三态）；测试抓出
真实命令行引号形态（`bin.js" web`）修正了连续子串匹配。NSIS
`Easel-dsh_0.2.1-alpha.17_x64-setup.exe` 出包。

**Journey log**
- 清场只在壳的**启动/重决策时刻**运行，不设常驻监视器——用户后来主动开的开发实例
  不该被杀，"多开互杀"留给下次壳启动收敛即可。
- 枚举用 PowerShell `Get-CimInstance`（wmic 在新 Windows 已弃用）；单条结果
  ConvertTo-Json 会输出裸对象而非数组，解析要双形态兼容。
- CIM 返回的命令行保留引号原样：`"C:\...\bin.js" web --port …`——匹配规则必须容忍
  引号插在中间（测试用真实形态当样本才抓得到）。

## [S1] Problem

dsh 会话单写者锁 + 多实例共 `~/.easel` → 过去对话打不开（"被其他 DSH 占用"）。
壳只收养记录里的 hub，记录外的孤儿/竞品永生。

## [S2] Design

- `dsh_runner.rs`：`is_our_dsh_web_server`（签名匹配）/`rival_pids`（纯决策核，
  可测）/`list_process_samples`（PowerShell CIM 枚举）/`sweep_rival_servers(keep)`
  （杀树，debug 跳过）。
- 接线：`adopt_running_server` 拿到可收养 record 后 `sweep(Some(record.pid))`；
  supervise 冷启分支 `sweep(None)` 后再 spawn。

## [S3] Scope

- In：上述壳改动 + alpha.17。Out：常驻监视器；双壳同时首启的竞态（收揽下次启动）；
  dsh 会话锁机制本身。

## [S4] Acceptance

- [x] 决策核测试：正主豁免/孤儿与开发实例命中/prism 排除/引号形态匹配。
- [x] cargo test 全绿；alpha.17 出包。
- [ ] 实机：多开两个壳后重启其一，启动日志出现 swept 行且 netstat 只剩一个 308x。
