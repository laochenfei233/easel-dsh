---
description: "LAN 项目交接对等服务：持久设备身份、TLS 监听与 mDNS 发现在设备间搬运项目交接包。"
kind: "package-library"
---

# @deepseek-ai/dsh-lan-handoff

[English](README.md) | 中文

## 概述

一套运行中的 harness home 构成项目交接的局域网半边：服务首次启动时铸出一枚持久自签证书，把 TLS 监听绑到系统分配的端口上，通过 mDNS 广播自己并浏览其他设备。广播只带 id、显示名、平台和支持的协议版本区间——不携带任何密钥或内容。连接由配对层确认对端；TLS 层只提供保密性与完整性，自签证书链不做校验。

## 目录

- [使用本包](#use_this_package)

<a id="use_this_package"></a>
## 使用本包

把本包作为插件挂载，然后读取 `ctx.lanHandoff.ready` 拿到本设备身份与绑定端口，读取 `peersSnapshot()` 拿到当前可发现的设备。配置接收可选显示名（默认取操作系统主机名）与可选监听端口（默认由系统分配）。删除 `$DSH_HOME/lan-handoff/identity.json` 会重新铸造身份，记录过旧密钥的每台设备都要重新配对——与匿名用户 id 文件相同的寿命契约。
