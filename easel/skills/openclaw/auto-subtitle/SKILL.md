---
name: auto-subtitle
description: "自动字幕 / 语音转字幕：把音频或视频里的语音识别成字幕文件（SRT/ASS/TXT/JSON），可选把字幕烧录进视频。当用户说自动字幕、语音转字幕、视频加字幕、上字幕、转录、听写、字幕文件、生成字幕、烧字幕时使用。"
layer: produce
---

# 自动字幕（语音转字幕）

把音频/视频里的人声识别成字幕。走宿主半本地路由 `POST /easel/api/asr`（mimo-v2.5-asr
云端转写 + ffmpeg 静音分段定时间戳），参数确定、可复现，做中文友好断句。可选把字幕烧录进视频（直接用 ffmpeg `subtitles` / `ass` 滤镜，命令见下）。

> 只做"语音 → 字幕文件 (+ 可选烧录)"。通用视频剪辑见 **video-editing**；纯降噪见 **audio-denoise**；长视频智能切片+烧字幕见 **clipify**。

## 输入

| 字段 | 必填 | 说明 |
|------|------|------|
| input_file | 是 | 音频或视频文件路径（视频自动提取音轨） |
| format | 否 | `srt`（默认）/ `ass` / `txt` / `json` |
| language | 否 | `auto`（默认）或 `zh`/`en` 等（仅记录进 meta） |
| burn | 否 | 是否把字幕烧录进视频（需视频输入） |

支持：mp3/wav/m4a/aac/flac 等音频；mp4/mkv/mov/webm 等视频。

## 输出

- 字幕文件放入 `outputs/<输入名>/`（SRT/ASS/TXT/JSON）
- 若烧录：带硬字幕的视频（`*-sub.mp4`）
- 报告：字幕条数、音频秒数、输出路径

## 前置

- dsh 壳在跑（提供本地路由），且已配置 `MIMO_API_KEY`（项目 `.env` 或环境变量；
  可选 `MIMO_BASE_URL`/`MIMO_ASR_MODEL`）。无本地模型下载、无代理要求。

## 执行步骤

转写走本地路由（不装任何模型）：先从 `outputs/_easel_api.json` 读 API base（插件宿主半
启动时写入；文件缺失说明 dsh 壳没在跑），再 POST。字幕烧录用 ffmpeg，见第 2 步。

### 1. 生成字幕文件

```bash
BASE=$(node -e "const j=require('./outputs/_easel_api.json');process.stdout.write(j.base+j.basePath)")

# 视频 → SRT（自动提取音轨；format 缺省即 srt）
curl -s -X POST "$BASE/api/asr" -H "Content-Type: application/json" \
  -d '{"path":"input.mp4","format":"srt"}'
# → {"file":"outputs/input/input.srt","segments":[…],"seconds":…}

# 视频 → ASS（带样式，**字号/边距按视频横竖屏自适应**）：视频输入自动探测宽高
curl -s -X POST "$BASE/api/asr" -H "Content-Type: application/json" \
  -d '{"path":"input.mp4","format":"ass"}'

# 纯音频 → ASS：默认竖屏 1080x1920；要横屏，生成后改 ASS 头的 PlayResX/PlayResY 为 1920x1080
curl -s -X POST "$BASE/api/asr" -H "Content-Type: application/json" \
  -d '{"path":"voice.mp3","format":"ass"}'
```

- **ASS 样式按目标视频宽高自适应**：字号按**短边**(min(w,h)*0.05，竖/横屏都≈合适、不再横屏过大)，
  底边距按高、左右边距按宽，`PlayRes`=真实宽高。视频输入自动探测；纯音频默认 1080x1920。
  **要带样式的硬字幕优先烧这份 ASS**（下节），比裸 SRT + 手填 force_style 更省心、且自适应。
- 中文默认每行 ~18 字，超长自动断行/拆条。
- 输出固定写到 `outputs/<输入名>/<输入名>.<format>`；要归入项目目录就 `mv` 到
  `outputs/主题名/` 下（烧录命令里的路径同步改）。
- 返回 400「未配置 mimo ASR 凭据」→ 设 `MIMO_API_KEY` 后重试。

### 2.（可选）把字幕烧录进视频

用户要"硬字幕/烧进视频"时，用 ffmpeg 的 `subtitles`（SRT）或 `ass`（ASS）滤镜：

```bash
# 烧 SRT（可定制样式）
ffmpeg -y -i input.mp4 \
  -vf "subtitles=outputs/主题名/input.srt:force_style='FontName=Noto Sans CJK SC,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=2'" \
  -c:a copy outputs/主题名/input-sub.mp4

# 烧 ASS（样式已在 ass 文件里，保真）
ffmpeg -y -i input.mp4 \
  -vf "ass=outputs/主题名/input.ass" \
  -c:a copy outputs/主题名/input-sub.mp4
```

- 路径含特殊字符时，把 `subtitles=` 的值用单引号包裹并转义冒号。
- 需要软字幕（可关闭）而非烧录：`ffmpeg -i in.mp4 -i sub.srt -c copy -c:s mov_text out.mp4`。

### 3. 产物与报告

- 字幕文件、烧录视频均写入 `outputs/主题名/`。
- 向用户报告：字幕条数、音频秒数、文件路径；提示可换 `MIMO_ASR_MODEL` 重跑。

## 规则

1. **视频先提取音轨** — 路由内部自动用 ffmpeg 提取 16kHz 单声道 wav，不改原视频。
2. **中文友好断句** — 按标点/长度断行，避免一行过长；静音分段决定时间戳粒度。
3. **绝不删原文件** — 只产出新文件到 `outputs/`。
4. **模型在云端** — 模型由 `MIMO_ASR_MODEL` 决定（默认 mimo-v2.5-asr），本机零模型。
5. **烧录需视频输入** — 纯音频无法烧录，只出字幕文件。
6. **无 Profile 依赖** — 转录不需要账号画像。

## 自研参考

- MiMo 开放平台 `mimo-v2.5-asr`（OpenAI 兼容 chat/completions + input_audio）
- FFmpeg `silencedetect`（静音分段）、`subtitles` / `ass` 滤镜（字幕烧录）
