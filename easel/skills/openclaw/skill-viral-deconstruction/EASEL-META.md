# Easel SKILL 元数据

| 字段 | 值 |
|------|-----|
| **SKILL 名称** | viral-deconstruction |
| **所属层** | attribute |
| **来源类型** | Easel 自研 |
| **功能描述** | 爆款视频拆解：下载（video_fetch.mjs：抖音 Feed 接口/小红书笔记页/快手详情页 `__APOLLO_STATE__` 原生路径 + 视频号下载器 staging 拾取 + yt-dlp 通用）→ ffmpeg 抽帧 → asr.py 转写 → 视觉模型看帧 → source.md 素材档案 → 六点拆解入选题库 |
| **依赖** | yt-dlp（B站/YouTube/通用）、ffmpeg、faster-whisper（经 asr.py）、dsh 模型管理里用户自配的视觉模型（看帧）、wx_channels_download（视频号，外部 sidecar exe） |
| **自包含** | 抖音/快手免 cookie（快手可选游客 cookie）；小红书需手动填登录 cookie（outputs/_deconstruct/cookies.json）；视频号免 cookie 但需微信 PC 已登录 + 下载器（识别到 sph 链接才检查） |

> 创建时间: 2026-10-14
> 用途: 来源溯源与致谢

## 致谢与参考

- **下载架构参考** UnifiedDownloader（用户本地仓库 `GitHub\UnifiedDownloader`，未复用代码）：
  抖音移动端 Feed 接口（`aweme/v1/feed`，免 Argus 签名免 cookie）的通道选型
  来自该项目的工程实践；本项目自行实现，stdlib 单文件。
- 抖音 / [TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader)、
  小红书 / [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader)、
  快手 / [KS-Downloader](https://github.com/JoeanAmier/KS-Downloader)（GPL-3.0，
  仅参考其详情页 `__APOLLO_STATE__` 通道与字段，未复用代码）：
  数据来自平台公开分享页/接口，解析为本项目独立实现。
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)：通用站点下载（外部可执行，MIT/Unlicense）。
- [wx_channels_download](https://github.com/ltaoo/wx_channels_download)：视频号下载
  （外部 sidecar exe，MIT + Commons Clause，未随包分发）：经微信 PC 客户端流量代理 +
  页面注入下载并解密，Easel 只做微信登录门控与产物拾取。
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)：语音转写（经共享脚本 asr.py，MIT）。
- FFmpeg：抽帧（LGPL/GPL）。
