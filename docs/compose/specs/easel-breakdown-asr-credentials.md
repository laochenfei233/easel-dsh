---
feature: easel-breakdown-asr-credentials
status: in-progress
updated: 2026-10-27
branch: feat/easel-asr-credentials
commits: dffe624804..(head)
---

# 爆款拆解 ASR 凭据接入「设置→模型」同一注册表

## Report

## [S1] Problem

爆款拆解页的「语音转写模型」下拉来自 dsh 模型目录（与 设置→模型 同一份数据），用户在
设置页配好自定义服务商的 API Key 与 Base URL 后，无论选哪个模型，采集任务一律失败在
`未配置 mimo ASR 凭据：请设置 MIMO_API_KEY`。换模型无效、报错永远是 mimo。

根因有两层：

1. 拆解页把选择发成 `asrModel.split('::')[1]`，丢弃了服务商半边；
2. 宿主侧 `deconstructTranscribe` 只从项目 `.env`/进程环境读 `MIMO_API_KEY` 一族，
   dsh 模型管理里的凭据从未被消费——注释声称「插件侧读不到」，但插件与
   llm/settings/credentials 服务同进程，读取链（`listConfigurableProviders` →
   settings profile → `credentials.resolve`）在 session-controller 的
   modelCatalog / hasProviderApiKey 里早已存在。

## [S2] Design

- **选择承载服务商**：拆解页发送完整 `provider::model`；宿主按第一个 `::` 拆开，
  provider 半边在 `ctx.llm.listConfigurableProviders()` 里找路由。
- **凭据解析链**：与 `hasProviderApiKey` 同构——settings `describe`（redactSecrets，
  credential-ref 字段不被遮蔽）→ 走 `settingsNs`/`settingsPath` 取服务商 profile →
  `apiKeyEnv` 经 `credentials.resolve` 得密钥、`baseURL` 即端点；导出
  `resolveDshAsrCredentials(ctx, providerId, modelId)`，返回
  `{ ok: true, credentials }` 或 `{ ok: false, reason }`，reason 逐项点名缺失件
  （服务缺失 / 路由不在目录 / 未配置 / Key 未配置 / 无 Base URL）。
- **裸 id 兼容**：不含 `::` 的 `asrModel`（在途旧任务）保持既有 MIMO_* env 路径，
  行为不变；技能路由 `POST /easel/api/asr` 不在本次范围，凭据仍走 env。
- **失败响亮**：provider 限定选择解析不出凭据时直接失败并指路 设置→模型，
  不静默回退 mimo（MIMO_API_KEY 恰好配置过时会拿错误的服务商转写）。

## [S3] Scope

- In scope：`lib/plugins/deconstruct.js`（helper + 转写闭包路由 + apply 捕获 ctx）、
  `src/components/BreakdownPage.tsx` + `client.js` 重建、`test/deconstruct.test.js`。
- Out of scope：`POST /easel/api/asr` 技能路由的凭据语义；视觉模型选择；mimo env
  路径本身；模型目录/凭据的写入面。

## Tasks

- [x] T1: 宿主侧解析链与转写闭包路由（depends: none）
- [x] T2: 拆解页发送完整 `provider::model` 并重建 client.js（depends: T1）
- [x] T3: `resolveDshAsrCredentials` 单测（6 条失败分支 + 成功链路）（depends: T1）
- [ ] T4: 复审通过后置 delivered（depends: T1-T3）

## [S4] Acceptance

- [ ] 选 `my-gateway::some-asr` 且该服务商在 设置→模型 配好 Key 与 Base URL 时，
  转写请求带 `https://…/v1` + 该 Key + `some-asr`（helper 单测钉住读取链与去尾斜杠）。
- [ ] 服务缺失 / 路由不在目录 / 未配置 / Key 未配置 / Base URL 为空 / `apiKeyEnv`
  不合 ref 文法六种情形各自返回点名的 `reason`（单测覆盖）。
- [ ] 裸 model id 仍走 MIMO_* env 路径（既有测试不回归；270 pass 基线）。
- [ ] 拆解页请求体携带完整 `provider::model`（client.js 重建产物可见）。
