---
description: "transfer 包组：在运行本 harness 的两台设备之间做局域网对等传输，每台设备各持自身身份。"
kind: "package-group"
---

# transfer/ — 局域网对等传输

[English](README.md) | 中文

## 概述

transfer 组让两台运行本 harness 的设备在局域网内交换项目交接包：每台设备持有一个持久的自签身份，通过 mDNS 发现已知设备，并在任何载荷传输前先完成一次人工确认的握手。交接把一个项目的工作区文件连同其所属会话一起传输，因此在一台设备上开始的工作可以在另一台设备上继续。本组只有一个包；本页列出本组的组成，包 README 负责细节。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [Dev Note](#dev-note)

<a id="packages"></a>
## 包

| 包 | 角色 |
|---|---|
| [`lan-handoff`](lan-handoff/README.zh.md) | 运行局域网对等服务：持久设备身份、绑定动态端口的 TLS 监听、mDNS 广播与浏览 |

<a id="related-documentation"></a>
## 相关文档

- LAN 项目交接 spec：`docs/compose/specs/easel-lan-handoff.md`（中文撰写） — 交接能力的设计文档与验收标准。
- [dsh-session-log-export](../session-query/session-log-export/README.zh.md) — 交接按会话携带的日志归档格式。
- [dsh-attachment](../attachment/README.zh.md) — 接收会话归档内图片与文件的附件仓库。

<a id="dev-note"></a>
## Dev Note

无。
