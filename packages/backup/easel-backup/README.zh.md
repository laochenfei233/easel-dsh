# @deepseek-ai/dsh-easel-backup

## 概述

Easel 的远端备份引擎：把 Easel 数据根打包成分组 zip，上传到 WebDAV、SMB 或 S3 目标端，并能恢复回来。本包不持有状态、不读取配置；Easel 宿主插件（`dsh-plugin-easel`）负责设置、凭据、路由与调度，引擎工作全部委托给本包。

## 使用本包

```ts
import { createDestination, listBackups, runBackupGroup, planRestore, applyRestore } from '@deepseek-ai/dsh-easel-backup'

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
  onProgress: progress => console.log(progress.phase),
})

const backups = await listBackups(destination, 'sites')
const plan = await planRestore({ destination, remoteDir: 'sites', roots, group: 'config', stamp: backups[0].stamp, stagingDir })
await applyRestore(plan)
```

备份按组划分：`config`（profiles 补丁、凭据、人设、skills、状态库）、`sessions`（会话日志与持久附件）、`workspace`（项目与完整 outputs 树）。每组打成一个独立 zip，落在 `easel-backup/` 下的 `<group>/<stamp>.zip`，每组只保留最近 `retention` 份；恢复走校验后的计划：下载、解密、CRC 校验、映射到当前数据根，再逐文件原子覆盖。

## 实现要点

- `src/collections.ts` —— 按组遍历数据根；junction、符号链接、`node_modules`、缓存与临时文件一律不收。
- `src/archive.ts` —— 基于 `fflate` 的流式 zip；媒体原样存储、文本压缩；解包强制核对 manifest 计数并拒绝不安全路径。
- `src/crypto.ts` —— 可选口令容器：scrypt 派生密钥 + 分块 AES-256-GCM，每块用 AAD 绑定魔数与块序号。
- `src/destinations/` —— 每协议一个 seam；上传从 staging 文件流式发出并显式携带 `Content-Length`（走 node 原生请求路径）。
- `src/engine.ts` / `src/restore.ts` / `src/schedule.ts` —— 运行、校验与补跑计算都是注入 seam 的纯函数。

## 已知上限与后续工作

备份是全量 zip 而非增量镜像；WebDAV 仅支持 Basic 认证；SMB 借助系统栈（要求 UNC/挂载点可达），不是协议实现；S3 列举使用宽松 XML 解析。
