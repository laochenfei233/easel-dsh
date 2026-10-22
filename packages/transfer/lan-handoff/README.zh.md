---
description: "LAN 项目交接对等服务：持久设备身份、TLS 监听与 mDNS 发现在设备间搬运项目交接包。"
kind: "package-reference"
---

# @deepseek-ai/dsh-lan-handoff

[English](README.md) | 中文

## 概述

一套运行中的 harness home 构成项目交接的局域网半边：服务首次启动时铸出一枚持久自签证书，把 TLS 监听绑到系统分配的端口上，通过 mDNS 广播自己并浏览其他设备。广播只带 id、显示名、平台和支持的协议版本区间——不携带任何密钥或内容。连接由配对层确认对端；TLS 层只提供保密性与完整性，自签证书链不做校验。

## 目录

- [使用本包](#use_this_package)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use_this_package"></a>
## 使用本包

把本包作为插件挂载，然后读取 `ctx.lanHandoff.ready` 拿到本设备身份、绑定端口与接收目录，读取 `peersSnapshot()` 拿到当前可发现的设备。配置接收可选显示名（默认取操作系统主机名）、可选监听端口（默认由系统分配），以及接收项目落盘的绝对 `handoffDirectory`（Easel 壳把它指向项目根下的 `projects` 目录）。

交接本身是四个服务调用：`pairWithPeer` 或 `pairWithDiscoveredPeer` 发起配对并把待决项挂进 `pairingOffers()`；界面展示每一项的六位确认串，用 `acceptPairing(id)` 或 `rejectPairing(id)` 定夺。`sendProjectToPeer(peerId, workspacePath)` 导出该工作区的会话、哈希项目树并流式发送交接包；收到的交接包自动落到 `handoffDirectory`，经挂载的 `sessionLogImporter` 导入，并通过挂载的工作区注册表挂靠。删除 `$DSH_HOME/lan-handoff/identity.json` 会重新铸造身份，记录过旧密钥的每台设备都要重新配对——与匿名用户 id 文件相同的寿命契约。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- v1 只按条目粒度续传：传了半个的文件会从头重传。
- 收到的归档在内存中解压后才导入会话。
- mDNS 发现只通过注入的 host 做了单测；真实组播在设备上运行，可能被路由器拦截，此时退回手动地址。
- 面向 agent 的 handoff 工具（由模型自己发起传输）推迟；v1 由用户驱动。

<a id="dev-note"></a>
### 开发备注

无。
