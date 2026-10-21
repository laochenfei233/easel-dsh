# EASEL-META — skill-platform-capture

本文件记录 SKILL 的来源与边界，不参与运行。

## 来源

本 SKILL 的能力来自 2026-10-11 一次真实任务：为小红书账号「造作星期八」做
画像实抓 + 同赛道对标盘点。当时的结论无法用现有 SKILL 得出，故把通道固化成能力。

- 采集通道：裸 CDP 驱动反检测容器（cloakserve 多路复用器，`127.0.0.1:9222`）
- 客户端写法参考了同环境中已验证的裸 CDP 客户端（`Page.navigate` + `Runtime.evaluate`
  + 递增 id 的 Session 模式），并在本 SKILL 中补齐了 cookie 读取、SSR 解析与降级路径
- 样本量：14 个关键词 / 378 篇搜索结果笔记 + 12 个账号主页

## 与既有能力的分工（重要）

| 既有 | 定位 | 与本 SKILL 的关系 |
|---|---|---|
| `skill-competitor-analysis` | 竞品分析**方法论**（layer: discover） | 它的数据采集只有 `web_fetch`/`web_search`，且明确声明被反爬时降级、拿不到的数据标注「无公开数据」。**本 SKILL 补的正是它拿不到的精确值**；对标结论与建议仍归它 |
| `skill-account-diagnosis` | 账号起号/健康诊断 | 消费本 SKILL 的指标 |
| `skill-profile-builder` / `skill-profile-manager` | 画像构建与落盘 | 消费本 SKILL 的数据；本 SKILL 只在有 Profile 时回填，不负责建档 |
| `skills/shared/scripts/platform_readback.py` | **发布后**读回对账（读自己的作品确认发成功） | 目的不同：那是写后校验，本 SKILL 是写前/写外的公开数据采集 |
| `skills/openclaw/skill-xhs-analyzer` | 小红书分析（依赖 macOS 专属 `redbook` CLI + keychain） | 其 SKILL.md 自述该依赖「在当前环境不可用」；本 SKILL 不依赖它 |

## 明确不做

- **不发布、不互动、不点赞收藏**，全程只读
- **不做逆向、不复刻平台签名**；只读页面 SSR 与 DOM，以及 CDP 标准方法
- **不碰创作者中心后台数据**（播放/完播/粉丝增量）—— 不在此通道范围，
  拿不到就标注「无公开数据」，不编造
- **不管理登录凭据**：登录由用户在有头浏览器里完成，本 SKILL 只读 cookie 判断登录态
- **不承诺绕过风控**：内置读操作间隔，宁可慢也不并发连发

## 合规说明

仅采集平台**公开可见**的账号数据（主页指标、公开笔记的标题与互动数），
用于账号自身运营与同赛道对标分析。使用时须自行确认符合平台服务条款与当地法规。
