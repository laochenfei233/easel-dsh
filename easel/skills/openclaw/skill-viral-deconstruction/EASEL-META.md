# Easel SKILL 元数据

| 字段 | 值 |
|------|-----|
| **SKILL 名称** | viral-deconstruction |
| **所属层** | attribute |
| **来源类型** | Easel 自研 |
| **功能描述** | 爆款视频拆解：下载（video_fetch.py：抖音 Feed 接口/小红书笔记页原生路径 + yt-dlp 通用）→ ffmpeg 抽帧 → asr.py 转写 → 视觉模型看帧 → source.md 素材档案 → 六点拆解入选题库 |
| **依赖** | yt-dlp（B站/YouTube/通用）、ffmpeg、faster-whisper（经 asr.py）、dsh 模型管理里用户自配的视觉模型（看帧） |
| **自包含** | 抖音免 cookie；小红书需手动填登录 cookie（outputs/_deconstruct/cookies.json） |

> 创建时间: 2026-10-14
> 用途: 来源溯源与致谢

## 致谢与参考

- **下载架构参考** UnifiedDownloader（用户本地仓库 `GitHub\UnifiedDownloader`，未复用代码）：
  抖音移动端 Feed 接口（`aweme/v1/feed`，免 Argus 签名免 cookie）的通道选型
  来自该项目的工程实践；本项目自行实现，stdlib 单文件。
- 抖音 / [TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader)、
  小红书 / [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader)：
  数据来自平台公开分享页/接口，解析为本项目独立实现。
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)：通用站点下载（外部可执行，MIT/Unlicense）。
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)：语音转写（经共享脚本 asr.py，MIT）。
- FFmpeg：抽帧（LGPL/GPL）。
