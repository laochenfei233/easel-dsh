---
feature: easel-website
status: designed
updated: 2026-10-25
branch: （实现对话立项时定）
commits: （未开工）
---

# Easel 应用官网（产品页 · 下载 · 更新日志 · 更新源分发）

## Report

（交付时填写）

## [S1] Problem

用户（尤其无梯子的境内用户）没有稳定入口找最新安装包和版本说明：GitHub Release 访问不稳、gitee/npm 的 100MB 附件上限又装不下 126MB 全量包。应用内更新器（`easel-app-update`）也需要一个境内 latest.json 分发点。需要一块产品自己的阵地：能下载、能看版本说明、同时就是更新源。

## [S2] Design

### 形态

- 定制静态产品站，新 `site/` 目录；纯静态产物（HTML + CSS + 少量 JS），最小构建脚本，不引入前端框架。
- 中文为主（沿用 README 中文主版先例），结构预留英文切换位。
- 视觉按 frontend-design 流程独立设计：令牌系统（调色板/字体/布局）+ 单一签名元素，母题沿用画架/README 品牌资产（`assets/` 下的 SVG）。
- 全站唯一会变的数据是版本信息；其余为编译期内容。

### 页面结构（单页为主）

- **Hero**：产品定位一句话（DeepSeek 生态的桌面 agent 工作台）+ 品牌视觉。
- **下载区**：当前最新版本号；Windows x64 / arm64 安装包直链（同域 `/releases/<ver>/…`）；浏览器 UA 检测默认按钮；校验和展示（sha256，可复制）。
- **更新日志**：渲染 `releases.json`——版本号、日期、分类条目（沿用 CHANGELOG 三分类用户视角格式）；应用内弹窗与关于节的"更新日志"链接落在此处。
- **更新源端点**：`/updates/latest.json` 同域分发，是应用内更新器内置 endpoint 的最终指向。

### 数据流

| 文件 | 生成方 | 说明 |
| --- | --- | --- |
| `releases.json` | 构建脚本 `site/tools/build-releases.mjs` | 解析根 `CHANGELOG.md`（三分类格式）→ 版本/日期/条目 |
| `latest.json` | 发布管道（tauri build 产出 `.sig`，CI 上传时生成） | Tauri updater v2 格式；协议契约见 `easel-app-update.md` |
| 站点静态产物 | 构建脚本 | 一次性产物，可部署任何静态托管 |

### 同步链（用户拍板：server 侧拉取）

1. **产出**：GitHub Actions 构建安装包（含 updater `.sig`）并创建 GitHub Release。
2. **拉取**：国内轻量服务器跑同步器（systemd timer，15 分钟一拍）`site/server/sync-releases.mjs`：
   - ① GitHub API 拉最新 release 元数据；② 比对本机已有版本目录，只处理新版本；③ 下载新 setup + `.sig`（同步器自身可配 HTTP 代理 env，失败重试 ×3）；④ 校验 sha256；⑤ 先落 versioned 目录、后原子替换 `latest.json`（write-then-rename）。
   - 校验失败/网络中断：不换指针，下一拍重试——用户端永远取到完整版本。
3. **服务**：nginx 静态——站点产物 + `/updates/latest.json`（no-cache）+ `/releases/`（immutable）+ `limit_conn`/`limit_rate` 防单人吃满带宽；流量包为天然成本封顶（80% 告警）。

### 部署

- 产物先挂 GitHub Pages（境外兜底可达）；境内主路 rsync 到轻量服务器（备案为 80/443 前置，非标准端口可先行）。
- 涉密/内网单位：同一目录布局在内网机复用；应用内更新源为配置缝（`update-source.json` override），指向内网地址。

## [S3] Scope

- In scope: `site/` 静态站骨架与设计令牌、`releases.json` 生成脚本、`sync-releases.mjs` 同步器、nginx 布局与部署文档。
- Out of scope: 应用内更新器实现（`easel-app-update.md`，已另行实现/另行对话）、CI workflow 本体（立项时按现有 workflows 样式新建）、签名与公证（沿用 mac v1 不签的拍板，更新器签名密钥属发布管道立项范围）。

## Tasks（实现对话拆）

- [ ] T1: 静态站骨架 + 设计令牌（frontend-design 流程）
- [ ] T2: `releases.json` 生成脚本 + 更新日志渲染
- [ ] T3: `sync-releases.mjs` + systemd timer + 部署文档（含 nginx 片段）

## [S4] Acceptance

- [ ] 构建产物为纯静态文件，页面运行时不发起任何境外请求（releases 数据内嵌）
- [ ] `releases.json` 由 CHANGELOG.md 解析生成，版本/日期/分类与源文件一致
- [ ] `latest.json` 与安装包在站点同域可取；latest.json 更新前后指针原子切换
- [ ] 同步器在断网/校验失败场景不破坏现有指针（单测或本地夹具证据）
- [ ] 部署文档完整覆盖备案、证书、nginx 配置、systemd timer 四步
