---
feature: easel-handoff-byte-resume
status: delivered
updated: 2026-11-11
branch: feat/easel-handoff-parallel（worktree）
commits: 64ed48807d（v4 续传/重试）..HEAD（v5 并行）
---

# 隔空传送：字节级续传、发送端自动重试与并行推送

## Report

**What was built** — 并行推送（v5）：项目发送按 `parallelConnections`（默认 2、1–8）开多条连接，每个 worker 承载清单条目的一个互不相交的条带、共用同一 bundleId；第一个 worker 准备暂存与共享续传报告，最后一个 worker 的 `done` 让整张回执结算一次并广播结果。仓库侧 `SharedReceipt` 负责共享暂存、去重与结算，条目不会换手。 中断的传输现在按字节续传：接收端在 accept 里报告每个已暂存条目「连续收到多少字节」，发送端只补传尾部；发布前接收端对完整暂存文件再做一次摘要校验（只补尾部无法复现整文件摘要）。发送端对连接级失败（掉线、120s 空闲超时、对端回 `retryable:`）自动重发，默认 3 次、每次 2s 后重拨，并从接收端检查点继续；拒绝、协议错误与完整性错误从不重试。`sendRetryAttempts` 可配置（1 表示关闭）。传输协议升到 v4。

**Verification** — `packages/transfer/lan-handoff` 201 通过 / 2 跳过（跳过两条=绑定不存在主机名的监听用例，本机 DNS 5s 超时，master 同样偶发）；`handoff.ts`/`transfer.ts`/`index.ts` 改动行覆盖率 100%（`listener.ts` 两条绑定不存在主机的用例在本机 DNS 下跳过，与 master 基线一致）；全仓 typecheck 5/5；插件测试 20/20。新增用例覆盖：字节偏移续传端到端、损坏前缀整文件摘要拒绝且不发布、损坏字节丢弃、零字节暂存重新传输、`sendRetryAttempts` 生效、等待期间取消、3 连接并行发送、并行导入/暂存失败整张回执失败、孤儿 worker 拒绝、并行取消。

**Journey log** — 用户报 `connection did not advance within 120000 ms` 并怀疑文件太大。排查确认该文案出自 `pairing.ts:206` 的每帧空闲超时（每帧到达即清零），不是总时长/大小上限；但大载荷会拉长传输窗口，在这条不稳定的 Wi-Fi 上更容易撞上全静默。alpha.50 已做了条目级续传，但中断的文件仍从头重传（`StagingSink.abort()` 会删掉已收字节），所以这一版把续传下沉到字节级，并让发送端自己重试，用户不必手动再点。

## [S1] Problem

Windows → macOS 传大项目时链路中途整段静默 2 分钟，接收端判超时并回 `failed`；用户重新点发送后，之前已传的文件从零开始，一个 GB 级项目在抖动链路上几乎传不完。

## [S2] Design

- 协议 v4：accept 新增 `partial: [{kind, path, sha256, bytes}]`；`bytes` 必须是 `(0, entry.size)` 的安全整数，越界/非整数/非对象整包拒绝。
- 接收端：`stagedProgress` 取代 `completedStagedEntries`，同时报告 complete 与 partial；`StagingSink` 带起始偏移（`r+` 追加），`abort()` 保留暂存字节，新增 `discard()` 在校验失败时删除；`receiveEntry` 只在全新条目（offset 0）用流式摘要自校验，续传条目的整文件摘要在 `completeReceipt` 发布前对 session/data/config 补做，file 条目由既有整树 reconciliation 覆盖。
- 发送端：`sendBundle` 按 `partial` 让 reader 从偏移开始；`sendPreparedBundle` 对 `Uint8Array` 做 `subarray`、对磁盘文件用 `createReadStream({start})`。
- 重试：`sendWithResends`（默认 3 次、2s 间隔、可取消）+ `resendableFailure` 只认 `ChannelClosedError`、idle-timeout `PairingError`、带 `retryable:` 前缀的 `TransferCompletionError`；接收端把连接级失败标 `retryable:`、其余标 `fatal:`（展示时剥掉前缀）。

## [S3] Scope

- In scope: `packages/transfer/lan-handoff`（transfer/handoff/index/discovery）与其测试、双语 README。
- Out of scope: 多连接并行（另做）、发送窗口/限速、锁屏唤醒。

## Tasks

- [x] T1: 协议 v4 — partial 报告、字节偏移写入、整文件摘要闸门（depends: none）
- [x] T2: 发送端从偏移续读与 `retryable:`/`fatal:` 分类（depends: T1）
- [x] T3: `sendWithResends` 有界重试 + `sendRetryAttempts` 配置（depends: T2）
- [x] T4: 端到端续传/损坏/零字节用例与覆盖率（depends: T1, T3）

## [S5] Parallel workers

- 清单条带：`workerOwnsEntry` 按 `index % total === index` 划分，发送端与接收端各自独立计算；接收端不信任声明，重复条目由 `SharedReceipt` 的暂存路径语义兜底。
- 共享回执：`SharedReceipt` 只准备一次 staging 与续传报告；`decide` 对每个 worker 返回同一份 completed/partial；`record` 收齐全部 worker 后由唯一一次 `completeReceipt` 发布，并把 `received`/`failed` 广播到所有仍连接的 worker。
- 失败：任一 worker 的连接级失败把整张回执标 `retryable` 并广播，发送端重试后从暂存字节续；确定性失败标 `fatal`。
- 默认值与上限：默认 2 条；连接数不超过清单条目数；`parallelConnections: 1` 保留单连接路径。

## [S4] Acceptance

- [x] 同一 bundle 重发只补传尾部，接收端拼出正确文件（e2e）
- [x] 续传条目的完整文件摘要不符时拒绝发布并清暂存（e2e）
- [x] 校验失败的条目丢弃已收字节，下次从头（单测/覆盖率）
- [x] 连接级失败自动重发并继续；拒绝/协议错误立即抛出（单测）
- [x] v3/v4 对端标记不兼容（协议测试）
- [x] 3 条连接并行发送同一项目，全部文件完整到达（e2e）
- [x] 并行 worker 的导入失败/暂存失败让整张回执失败且不发布（e2e）
- [x] 取消与掉线把整张回执标记为可重试（单测）
