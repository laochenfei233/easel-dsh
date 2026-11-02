---
description: "Easel 远端备份的包地图：Easel 设置页备份区背后的引擎。"
kind: "package-group"
---

# backup/ — Easel 远端备份

[English](README.md) | 中文

## 概述

`backup/` 组承载 Easel 桌面端把数据根备份/恢复到用户自有 WebDAV、SMB、S3 目标端的引擎。它不持有状态：宿主插件 `dsh-plugin-easel/backup` 负责设置、凭据、路由与调度，归档、加密、传输与恢复工作全部委托给本组的包。

## 目录

- [包](#包)
- [相关文档](#相关文档)
- [开发备注](#开发备注)

-----

<a id="包"></a>
## 包

| 包 | 职责 |
|---|---|
| [`easel-backup/`](easel-backup/README.md) | 经 WebDAV/SMB/S3 的分组 zip 归档，带可选口令加密、保留清理与校验恢复 |

-----

<a id="相关文档"></a>
## 相关文档

- [根包地图](../README.md) —— `backup/` 在所有包组中的位置。
- [功能 spec](../../docs/compose/specs/easel-settings-backup.md) —— 范围表、远端布局与设计决策。

<a id="开发备注"></a>
## 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

桌面运行时经 CLI 部署闭包解析本组的包（`apps/cli/package.json` 携带 `workspace:*` 依赖），不经 cordis 服务；宿主插件惰性导入引擎，缺失时报告一条可操作的错误。

</details>
