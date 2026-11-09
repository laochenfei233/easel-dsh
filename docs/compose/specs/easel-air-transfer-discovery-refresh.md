---
feature: easel-air-transfer-discovery-refresh
status: in-progress
updated: 2026-11-09
branch: feat/easel-discovery-refresh（worktree）
commits: # filled at delivery
---

# 隔空传送：设备发现刷新

## Report

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
