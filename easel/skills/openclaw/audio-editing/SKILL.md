---
name: audio-editing
description: "通用音频处理：音频剪辑/裁剪、格式转码（mp3/wav/m4a/aac）、音量归一化、从视频提取音轨、多段拼接、淡入淡出、变速（保音高）。当用户说“剪音频”“裁一段”“转成 mp3”“调音量/响度”“提取音轨/扒音频”“拼接音频”“淡入淡出”“加速/减速音频”“变速不变调”时使用。与 audio-denoise 的区别：audio-denoise 专做降噪，audio-editing 做除降噪外的通用音频操作（也内置 denoise 作为兜底）。"
layer: produce
---

# 通用音频处理

除降噪外的通用音频操作：裁剪、转码、音量归一化、提取音轨、拼接、淡入淡出。这些是纯 ffmpeg
命令，直接用下方硬写的**命令模板**（已含防坑注释）；变速 `speed` 与降噪 `denoise` 两个
易错操作用共享 Node 脚本 `skills/shared/scripts/audio_ops.mjs`（零依赖，封装 atempo
级联与三级降噪链）。

## 输入

| 字段 | 必填 | 说明 |
|------|------|------|
| input_file | 是 | 音频或视频文件路径 |
| operation | 是 | trim / convert / normalize / extract / concat / fade / speed / denoise / info |
| output_file | 否 | 默认 `outputs/主题名/{name}-{op}.{ext}` |

支持格式：wav / mp3 / m4a / aac / flac，视频容器 mp4 / mkv / mov（提取音轨）。

## 输出

- 处理后的音频文件（放入 `outputs/主题名/`）
- `audio_ops.mjs`（speed/denoise）会打印实际执行的 ffmpeg 命令 + 输出文件的时长/码率/声道/采样率；纯命令操作跑完用 `ffprobe` 自查

## 执行步骤

先探测：`ffprobe -v quiet -print_format json -show_format -show_streams input.mp3`（读 json 展示时长/码率/声道再动手）。

### 0. 环境检查 + 探测

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mp3
```

系统缺 ffmpeg/ffprobe 时先安装（Debian/Ubuntu `apt install ffmpeg`，macOS `brew install ffmpeg`）。先 `ffprobe` 展示文件时长/码率/声道再动手。

### 1. 裁剪 trim

```bash
# 起止时间（-ss 在 -i 后：精确到帧；只求快可把 -ss 挪到 -i 前，按关键帧对齐）
ffmpeg -y -hide_banner -loglevel error -i in.mp3 -ss 00:00:05 -to 00:00:20 outputs/主题名/clip.mp3
# 起点 + 时长
ffmpeg -y -hide_banner -loglevel error -i in.mp3 -ss 5 -t 15 clip.mp3
```

### 2. 转码 convert

```bash
ffmpeg -y -hide_banner -loglevel error -i in.wav -vn -b:a 192k out.mp3
ffmpeg -y -hide_banner -loglevel error -i in.m4a -vn -ar 44100 -ac 2 out.wav
```

输出格式由扩展名决定（mp3/wav/m4a/aac）。

### 3. 音量归一化 normalize

```bash
ffmpeg -y -hide_banner -loglevel error -i in.mp3 -af loudnorm=I=-14:TP=-1.5:LRA=11 out.mp3
```

默认 loudnorm 到 -14 LUFS / -1.5 dBTP（社媒/播客通用响度）。可改 `I= TP= LRA=` 覆盖。

### 4. 提取音轨 extract

```bash
ffmpeg -y -hide_banner -loglevel error -i video.mp4 -vn audio.m4a
ffmpeg -y -hide_banner -loglevel error -i video.mp4 -vn -acodec copy audio.aac   # 不重编码，最快
```

### 5. 拼接 concat

```bash
ffmpeg -y -hide_banner -loglevel error -i a.mp3 -i b.mp3 -i c.mp3 \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]" -map "[out]" all.mp3
```

按参数顺序拼接，重编码方式兼容不同采样率/容器；`n=` 为段数。

### 6. 淡入淡出 fade

```bash
# fade-out 的 st = 时长 - 淡出秒数（3s 音频、淡出 2s → st=1）
ffmpeg -y -hide_banner -loglevel error -i in.mp3 -af "afade=t=in:st=0:d=2,afade=t=out:st=1:d=2" out.mp3
```

淡出自动定位到结尾前 N 秒：先用 ffprobe 拿时长再算 `st`。

### 7. 变速 speed（保持音高，node 脚本）

```bash
node skills/shared/scripts/audio_ops.mjs speed in.mp3 -o out.mp3 --factor 1.5   # 1.5 倍速
node skills/shared/scripts/audio_ops.mjs speed in.mp3 -o out.mp3 --factor 0.8   # 放慢
```

基于 atempo 保音高，超 0.5-2.0 范围自动级联。

### 8. 降噪 denoise（兜底，专项请用 audio-denoise）

```bash
node skills/shared/scripts/audio_ops.mjs denoise in.wav -o out.wav --tier 2
```

## 与 audio-denoise 的边界

- **audio-denoise**：降噪专项 SKILL，负责选级、模型下载、降噪报告等完整流程——需要认真降噪时用它。
- **audio-editing**：通用音频处理。`denoise` 仅作为顺手兜底，两者都走 `node skills/shared/scripts/audio_ops.mjs denoise`，能力一致，定位不同。

## 规则

1. **绝不删除原始文件** — 只写新文件到 `outputs/主题名/`。
2. **先 info 再处理** — 展示文件信息，避免误操作。
3. **视频输入只动音频** — denoise 对视频自动 `-c:v copy`；纯抽音用 extract。
4. **透明执行** — `audio_ops.mjs` 打印实际 ffmpeg 命令；纯命令模板所见即所跑。
5. **无 Profile 也能用** — 音频处理不依赖账号画像。

## Profile 感知

有 Profile 时可据平台偏好选默认参数（如短视频响度、目标码率）；无 Profile 退到通用默认（-14 LUFS、192k）。
