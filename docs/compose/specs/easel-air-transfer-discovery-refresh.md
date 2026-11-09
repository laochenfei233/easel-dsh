---
feature: easel-air-transfer-discovery-refresh
status: delivered
updated: 2026-11-09
branch: feat/easel-discovery-refresh（worktree）
commits: b07a44c631..8c6958689f
---

# 隔空传送：设备发现刷新

## Report

**What was built** — 发现适配器保留 `bonjour.find()` 的 Browser，每 `LAN_HANDOFF_RESCAN_MS`（30s）重发一次 PTR 查询，`dispose()` 清定时器并停止 Browser；`LanDiscoveryHost.find` 增加可选 `onDown`，适配器把 `down`/`srv-update`/`txt-update` 都映射成同一个 `LanDiscoveryEntry`，服务据此删除下线设备、用最新公告覆盖端口与地址。README 两种语言各补一条已知限制说明 30s 重查询。

**Verification** — `vitest run packages/transfer/lan-handoff/tests --testTimeout=20000 --coverage.enabled=true --coverage.include='packages/transfer/lan-handoff/src/*.ts'`：131/131 通过，statements/branches/functions/lines 全 100%（含 discovery.ts）。`tsx scripts/build.ts --scope typecheck`：5/5 PASS。oxlint 改动文件：9 条均为 HEAD 既有（discovery.ts 4 条、index.ts 5 条），新增代码 0。`verify-package-readme-model-experience`、`verify-translation-pairing`、`verify-md-wrap` 对改动文件无发现。默认 5s 超时下两条既有 listener 用例因本机对 `nonexistent.invalid` 的 NXDOMAIN 解析约 5.9s 超时，主检出同时段同样失败（PRE-EXISTING，与本改动无关）。

**Journey log** — (1) 首版只改了适配器，复审指出适配器在 `v8 ignore` 块内、节奏与事件映射没有任何断言，S4-1/S4-3 无证据 → 用 mock `bonjour-service` + 假时钟补 `discovery-adapter.spec.ts`。(2) 在 worktree 里跑 `pnpm run doc-sync` 会把共享 `node_modules` 的 workspace 链接改指到 worktree，主检出随后解析失败 → 主检出 `pnpm install --frozen-lockfile` 复原，此后只经 `node_modules/.bin/tsx` 跑门禁。(3) mDNS 的 down 事件可能带地址也可能不带，归因只读 TXT 的 id；无地址的更新条目仍按原规则丢弃并保留旧条目。

## [S1] Problem

真机上两台设备都在同一局域网、应用都开着，隔空传送的「附近设备」却可以是空的，且一直空到重启应用。实机取证：Windows 端 `/easel/api/handoff/pair` 与独立 mDNS 浏览都能看到 Mac，说明组播链路正常，问题在浏览器侧：

- 服务启动时只 `bonjour.find()` 一次（`src/index.ts` 的 `browseLanHandoff` 调用），`bonjour-service` 的 Browser 只在 `start()` 里发一次 PTR 查询，之后不再重查。
- 发布方的主动公告在启动后 1s/3s/9s/…/3279s 递增，累计约 55 分钟后停止。
- 因此若本机启动那一瞬的查询丢失（Wi‑Fi 省电、防火墙、多网卡选路），而对方的公告期已过，本机**再也没有第二次机会**，列表永远为空。
- 同类缺口：`discovered` 只增不减，设备下线（mDNS goodbye）后仍留在列表；对端重启换端口也不刷新（只转发 `up`）。

## [S2] Design

### S2.1 周期性重查询

`LanDiscoveryHost.find` 的实现（`createBonjourDiscovery`）保留 `bonjour.find()` 返回的 Browser，启动一个 30s 间隔的定时器调用 `browser.update()` 重发 PTR 查询；定时器 `unref()`，`dispose()` 时清除。周期取 30s：比 mDNSResponder 的连续浏览（上限 60s）更激进一档，仍属正常浏览流量。

不新增 `Config` 字段：该周期是协议行为常量，不随部署变化。

### S2.2 列表同步（up / down / srv-update / txt-update）

`LanDiscoveryHost.find` 增加可选 `onDown(entry)`；适配器把 Browser 的 `down`、`srv-update`、`txt-update` 都映射成同一个 `LanDiscoveryEntry` 交给宿主：

- `up`、`srv-update`、`txt-update` → `onUp`，服务按 id 覆盖（端口、地址、名称随最新公告刷新）。
- `down` → `onDown`，服务按 id 从 `discovered` 删除。
- 没有地址的更新条目照旧被 `parseDiscoveredEntry` 丢弃（保留原条目）。

`browseLanHandoff` 新增可选 `options.onPeerGone(deviceId)`，服务用它删除。

### S2.3 失败行为

更新条目缺地址时静默丢弃并保留原条目（与现有 `parseDiscoveredEntry` 一致）；下线条目可能不带地址，只按 TXT 里的设备 id 归因。适配器的定时器、事件监听与 Browser 都在 `dispose()` 里释放，不阻止进程退出。

## [S3] Scope

- In scope: `packages/transfer/lan-handoff` 的发现适配器、`LanDiscoveryHost` 接口、服务侧 `discovered` 同步、对应单测与 README 已知限制一行。
- Out of scope: 手动 IP 配对 UI（HTTP 路由已支持 `{host, port}`，UI 未接，另立）；mDNS 被路由器/防火墙拦截的环境问题；过期条目按 TTL 清理（PTR TTL 8h，重查询已覆盖）。

## Tasks

- [x] T1: `LanDiscoveryHost.find` 增加可选 `onDown`；适配器接 `down`/`srv-update`/`txt-update` 与 30s 重查询，`dispose` 停止 Browser 并清定时器（depends: none）
- [x] T2: `browseLanHandoff` 增加 `onPeerGone`；服务删除下线设备（depends: T1）
- [x] T3: 单测：适配器重查询节奏与事件映射（mock bonjour + 假时钟）、下线移除、更新覆盖端口、无地址更新被丢弃（depends: T2）
- [x] T4: README 已知限制补充“定时重查询”（双语 + i18n 记录）（depends: T1）

## [S4] Acceptance

- [x] 设备在超过公告期后仍能被发现：浏览器每 30s 重发 PTR（`discovery-adapter.spec.ts` 断言调用次数，dispose 后停止）
- [x] mDNS goodbye 后 `peersSnapshot()` 不再返回该设备（`service.spec.ts`）
- [x] `srv-update` 后 `peersSnapshot()` 返回新端口（`service.spec.ts` 端口覆盖 + 适配器事件映射）
- [x] 现有 126 个包测试保持通过（除既有 DNS 延时用例）
