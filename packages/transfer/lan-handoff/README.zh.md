---
description: "LAN 项目交接对等服务：持久设备身份、TLS 监听与 mDNS 发现在设备间搬运项目交接包。"
kind: "package-reference"
---

# @easel-dsh/easel-air-transfer

[English](README.md) | 中文

## 概述

一套运行中的 harness home 构成项目交接的局域网半边：服务首次启动时铸出一枚持久自签证书，把 TLS 监听绑到系统分配的端口上，通过 mDNS 广播自己并浏览其他设备。广播只带 id、显示名、平台和支持的协议版本区间——不携带任何密钥或内容。连接由配对层确认对端；TLS 层只提供保密性与完整性，自签证书链不做校验。

## 目录

- [使用本包](#use_this_package)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use_this_package"></a>
## 使用本包

把本包作为插件挂载，然后读取 `ctx.lanHandoff.ready` 拿到本设备身份、绑定端口与接收目录，读取 `peersSnapshot()` 拿到当前可发现的设备，读取 `receivingSnapshot()` 拿到正在流式接收的交接。配置接受可选显示名（默认取操作系统主机名）、可选监听端口（默认由系统分配）、接收项目落盘的绝对 `handoffDirectory`（Easel 壳把它指向项目根下的 `projects` 目录）、接收 `data` 条目的绝对 `dataDirectory`，以及启动时清理中断接收暂存目录的 `staleReceiptAgeMinutes`（默认 30 分钟）；`dataDirectory` 未配置时，携带 data 条目的交接包会被整包拒绝。发现到的对端优先按同网段 IPv4 拨号，其次任意其他 IPv4，最后非链路本地 IPv6，避免虚拟网卡与链路本地地址抢到拨号。

交接本身是四个服务调用：`pairWithPeer` 或 `pairWithDiscoveredPeer` 发起配对并把待决项挂进 `pairingOffers()`；界面展示每一项的六位确认串，用 `acceptPairing(id)` 或 `rejectPairing(id)` 定夺。`sendProjectToPeer(peerId, workspacePath, options)` 导出该工作区的会话（`sessions: false` 关闭）、剔除命中 `exclude` 前缀的项目树文件、把 `dataFiles` 挂成按数据根寻址的条目，哈希项目树并流式发送交接包；收到的交接包自动落到 `handoffDirectory`，带会话时经挂载的 `sessionLogImporter` 导入，且仅在有会话到达时通过挂载的工作区注册表挂靠。`sendFilesToPeer(peerId, payload)` 把显式选择的文件作为无会话快推发送，接收端并入同名的既有目录而不是拒绝。`receivingSnapshot()` 报告当前接收的阶段（`receiving`、`verifying`、`importing`）、项目标题、条目数与字节数，接收结束后清空。

发送会等待接收端的完成确认：校验、会话导入与工作区挂靠完成后收到 `received`，失败则收到带原因的 `failed`。所以发送成功代表对端真的已入库；连接先断开则报告连接关闭而不是成功。交接协议为 v5；v4 对端会被标记为不兼容并在拨号前拒绝，两端必须使用同一代协议。

续传按字节进行：接收端在 accept 里报告每个已暂存条目的连续字节数，发送端只补传尾部，发布前接收端再对完整暂存文件做一次摘要校验（只补尾部无法复现整文件摘要）。连接中断时已暂存字节保留；校验失败的字节会被丢弃，下次从该条目开头重来。`sendRetryAttempts`（默认 3）限制自动重发次数：连接级失败会短暂等待后重拨并从接收端检查点继续，拒绝与协议错误从不重试。内容派生的 bundleId 让重试落进同一个暂存组。

配对记录里保存对端最近一次被看到的地址与端口：发现到对端时刷新、配对时记录拨号地址、发送时在 mDNS 看不到对端的情况下回退到它——已配对设备不必等新的广播就能继续发送。若配对记录里没有存过地址，错误会提示用「按地址配对」填入对端地址与端口。

项目发送按 `parallelConnections`（默认 2，1–8）开多条连接：每个 worker 承载清单条目的一个互不相交的条带、共用同一个 bundleId；第一个 worker 负责准备暂存与共享续传报告，最后一个 worker 的 `done` 让整张回执为所有连接只结算一次。高延迟链路上并行能提升吞吐；条目不会换手，所以一个 worker 不可能覆盖另一个的暂存路径。

`configDocuments` 携带的是可移植配置而不是文件：接收端用本机自己的配置接缝应用每份文档，所以描述模型提供方、默认模型与其凭据引用的文档会落进对方的 profile 配置层和凭据库，而不会用发送端带本机路径的文件覆盖它们。收到的会话日志在入库前会把发送端的项目目录、数据根与 home 目录改写成本机路径；清单的 `sourceRoots` 提供发送端的更外层根，`homeDirectory`（默认 `$DSH_HOME`）提供接收端对应的 home。删除 `$DSH_HOME/lan-handoff/identity.json` 会重新铸造身份，记录过旧密钥的每台设备都要重新配对——与匿名用户 id 文件相同的寿命契约。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 续传只按条目粒度：传了半个的文件会从头重传。
- 收到的归档在内存中解压后才导入会话。
- 无会话的接收（快推，或发送时取消会话勾选）只落文件不注册工作区；该目录要等挂上会话后才会出现在侧栏。
- mDNS 发现只通过注入的 host 做了单测；真实组播在设备上运行，可能被路由器拦截，此时退回手动地址。
- 浏览端每 30 秒重发一次 PTR 查询：发布端启动约 55 分钟后停止主动公告，所以先于本机上线的设备也能被发现，两台应用都不用重启。
- 面向 agent 的 handoff 工具（由模型自己发起传输）推迟；传输由用户驱动。

<a id="dev-note"></a>
### 开发备注

无。
