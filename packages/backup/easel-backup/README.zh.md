---
description: "Easel 数据根的远端备份：按组打包 zip，经 WebDAV、SMB 或 S3 上传，支持可选口令加密、保留策略与校验后恢复。"
kind: "package-reference"
---

# @deepseek-ai/dsh-easel-backup

[English](README.md) | 中文

## 概述

用本包把 Easel 数据根打包成分组 zip 并恢复。Easel 宿主插件（`dsh-plugin-easel/backup`）负责设置、凭据、路由与调度；本包只承担引擎工作——收集、归档、可选加密、上传、保留清理与校验恢复——全部是注入目标端 seam 的纯函数。不挂载任何服务，不持有状态。

## 目录

- [使用本包](#使用本包)
- [理解实现](#理解实现)
- [延伸阅读](#延伸阅读)
- [模型体验](#模型体验)
- [已知上限与后续工作](#已知上限与后续工作)
- [开发备注](#开发备注)

-----

## 使用本包

<a id="使用本包"></a>

备份按组划分：`config`（profiles 补丁、凭据、人设、skills、状态库）、`sessions`（会话日志与持久附件）、`workspace`（项目与完整 outputs 树）。每组打成一个独立 zip，落在 `easel-backup/<group>/<stamp>.zip`，每组只保留最近 `retention` 份。

| 你在做 | 用 |
|---|---|
| 某协议的目标端 | `createDestination(config, secrets)` —— `smb`（文件系统根）、`webdav`、`s3` |
| 一组备份 | `runBackupGroup(options)` —— 收集、归档、加密、上传、清理 |
| 列出归档 | `listBackups(destination, remoteDir)` |
| 恢复 | `planRestore(options)` 然后 `applyRestore(plan)`；放弃用 `discardRestore(plan)` |
| 补跑判定 | `computeDue(schedule, lastRunAt, now)` |

```ts
import { createDestination, listBackups, planRestore, applyRestore, runBackupGroup } from '@deepseek-ai/dsh-easel-backup'

const destination = createDestination(
  { protocol: 'webdav', endpoint: 'https://dav.example.com/dav', username: 'me', remoteDir: 'sites' },
  { protocol: 'webdav', password: '…' },
)

const result = await runBackupGroup({
  destination,
  roots: { home: '/data-root/home', workspace: '/data-root/workspace' },
  group: 'config',
  remoteDir: 'sites',
  retention: 10,
  encryption: { enabled: false },
  stagingDir: '/data-root/home/cache/backup-staging',
})
```

`runBackupGroup` 先在本地 staging（`stagingDir`），以显式 `Content-Length` 上传，上传失败时删除远端半截对象，无论成败都清掉 staging 文件。`planRestore` 下载、解密、CRC 校验并把每个条目映射到当前数据根，不触碰在用文件；`applyRestore` 逐文件原子覆盖。

## 理解实现

<a id="理解实现"></a>

<a id="设计原则"></a>
### 设计原则

每个字节都过同一个 seam：目标端回答 `probe`/`put`/`get`/`list`/`del`，其余都是它之上的纯计算。因此一个内存桩就是引擎的全部测试面，一个新协议只是一个文件。

<a id="源码导览"></a>
### 源码导览

- `src/collections.ts` —— 按组遍历；junction、符号链接、`node_modules`、缓存与临时文件一律不收。
- `src/archive.ts` —— 基于 `fflate` 的流式 zip；媒体原样存储、文本压缩；解包强制核对 manifest 计数并拒绝不安全路径。
- `src/crypto.ts` —— 可选口令容器：scrypt 派生密钥 + 分块 AES-256-GCM，每块用 AAD 绑定魔数与块序号。
- `src/destinations/` —— 每协议一个实现；上传从 staging 文件流式发出并显式携带 `Content-Length`（走 node 原生请求路径）。
- `src/engine.ts`、`src/restore.ts`、`src/schedule.ts` —— 注入 seam 之上的运行、校验与补跑计算。

## 延伸阅读

<a id="延伸阅读"></a>

- [docs/compose/specs/easel-settings-backup.md](../../../docs/compose/specs/easel-settings-backup.md) —— 功能 spec：范围表、远端布局与设计决策。
- `packages/session-query/session-log-export` —— 本包复用的流式 zip 仓内先例（`fflate`）。

## 模型体验

<a id="模型体验"></a>

无，纯基础设施：备份由用户在 Easel 设置页发起，不注册任何工具、提示或模型可见文本。

#### KV Cache 影响

无直接失效：本包不贡献请求 token，也不改写请求前缀，对供应商缓存复用无影响。

## 已知上限与后续工作

<a id="已知上限与后续工作"></a>

这些上限界定了本包的适用边界，均为当前约束。

- **全量归档，非增量镜像** —— 每次运行都会完整重传勾选的组；增量上传需要各协议列举加差分引擎，已列为后续，保留策略先约束远端占用。
- **WebDAV 仅 Basic 认证** —— 不支持 digest-only 服务器；多数 NAS 网关与云盘在 TLS 上接受 Basic。
- **SMB 借助系统栈** —— 目标端是必须已可达的 UNC、映射盘或挂载路径；没有 SMB 协议实现，macOS 凭据接线缺失（`net use` 仅限 Windows，位于宿主插件）。
- **S3 列举用宽松 XML 解析** —— 每个 `<Contents>` 块读取单值字段；回答形状过于怪异的服务器可能需要真正的解析器。
- **恢复是整份覆盖** —— 计划覆盖归档内的全部文件；没有逐文件挑选。

### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

桌面运行时经 `home/node_modules` junction 解析本包（部署闭包由 `apps/cli/package.json` 携带 `workspace:*` 依赖）。引擎缺失时，宿主插件把它表现为一条可操作的 API 错误，设置页不会崩。覆盖率跑在 Linux 车道；POSIX-only 的清理失败用例在 Windows 上按设计跳过。

</details>
