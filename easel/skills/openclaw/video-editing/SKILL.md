---
name: video-editing
description: >-
  用自然语言指令剪辑视频：裁剪、拼接、变速、跳切去静音、文字覆盖、横竖比转换、抽帧封面、转 GIF、压缩、加 BGM/水印，基于 ffmpeg。
  当用户说"剪视频""裁剪视频""拼接视频""视频变速""去静音""视频加文字""视频转GIF""压缩视频""加BGM/水印"时使用。
  本 SKILL 做单条视频的通用剪辑；智能画幅转换用 video-reframe，长视频切片用 clipify/video-highlights，从 0 生成用 ai-video-gen。
layer: produce
---

# 视频剪辑

用自然语言指令做通用视频处理。纯命令操作（裁剪/拼接/横竖转/抽帧/GIF/压缩/BGM/水印/看信息）
直接用下方硬写的 **ffmpeg 命令模板**（已含防坑注释）；三个易错操作（变速 `speed`、
去静音 `silence-cut`、文字覆盖 `text`）用共享 Node 脚本
`skills/shared/scripts/video_ops.mjs`（零依赖，封装中文字体查找、drawtext 转义、
atempo 级联、silencedetect 解析等踩坑逻辑）。

> 从项目根目录运行。脚本相对路径：`skills/shared/scripts/video_ops.mjs`；
> 每个子命令支持 `-h`（如 `node skills/shared/scripts/video_ops.mjs speed -h`）。

## 输入

- 视频文件路径 + 操作描述（用户没给路径就问）
- 可选：目标平台/比例/时间段等参数

## 输出

处理后的视频/图片，存到 `outputs/主题名/`。`video_ops.mjs` 会打印 `✅ <路径> (大小)`。

## 与 clipify 的边界

- **clipify** = 长视频智能切片 + 人脸追踪 pan + 逐字字幕烧录的**特化流程**。
  需要"从长视频找精彩片段做成竖版短视频带字幕"时用它。
- **video-editing（本 SKILL）** = 通用剪辑处理。单点操作或自由组合时用它。
  不做人脸追踪、不做字幕烧录（那是 clipify）。

## 子命令速查

先看源信息再操作：

```bash
ffprobe -v error -print_format json -show_format -show_streams in.mp4
```
（读 json 里的 `format.duration`、`streams[].width/height/r_frame_rate/codec_type`。）

| 操作 | 用途 | 关键参数 |
|--------|------|----------|
| `cut` | 按起止时间裁剪 | `--start --end`/`--duration`，重编码精确裁 |
| `concat` | 多段拼接 | demuxer(同参数无损)/filter(异参数统一) |
| `speed` | 变速（音画同步） | `--factor 2.0`（走 node 脚本） |
| `silence-cut` | 检测静音并去除（跳切） | `--noise -30 --min-silence 0.5 --pad 0.05`（别名 `mute-cut`，走 node 脚本） |
| `text` | 文字覆盖 | `--text --position --fontsize --color --start --end --box`（走 node 脚本） |
| `aspect` | 横竖比转换 | `--ratio 9:16 --mode pad`(补边)/`crop`(裁切) |
| `frame` | 抽帧做封面 | `--time 00:00:03 --width` |
| `gif` | 转 GIF | `--start --end --fps 12 --width 480` |
| `compress` | 压缩 | `--crf 26` 或 `--bitrate 2M`，`--scale` 降分辨率 |
| `bgm` | 加背景音乐混音 | `--music --voice-volume 1.0 --music-volume 0.3` |
| `watermark` | 加图片水印 | `--logo --position --width --opacity` |
| `info` | 时长/分辨率/帧率/码率(json) | ffprobe 即上 |

`text` / `watermark` 位置七选一：`center top bottom top-left top-right
bottom-left bottom-right`。`text` 中文字体自动探测（wqy-microhei / Noto CJK），
也可 `--font` 显式指定。

## 常用示例

### 踩坑操作：node 脚本（video_ops.mjs）

```bash
# 变速（音画同步；atempo 超 0.5-2.0 自动级联；无声视频自动 -an）
node skills/shared/scripts/video_ops.mjs speed -i in.mp4 -o out.mp4 --factor 1.25

# 去静音 + 1.25 倍速（先跳切再变速；silencedetect 检测→保留段反推→select 拼接）
node skills/shared/scripts/video_ops.mjs silence-cut -i in.mp4 -o t.mp4 --noise -30 --min-silence 0.5 --pad 0.05
node skills/shared/scripts/video_ops.mjs speed -i t.mp4 -o out.mp4 --factor 1.25

# 第 60 秒叠 5 秒"关注我"字幕（自动找中文字体 + drawtext 转义；--box 加背景框）
node skills/shared/scripts/video_ops.mjs text -i in.mp4 -o out.mp4 --text "关注我" --position bottom --box --start 60 --end 65
```

### 纯命令操作：ffmpeg 模板（占位符自行替换）

```bash
# 裁剪（-ss 放 -i 前走关键帧定位，快、关键帧对齐）。注意此序下 -to 按 seek 后
# 时间轴计（-ss 2 -to 6 = 原 2s→8s）；要按原时间轴 2s→6s，把 -to 6 换成 -t 4（6-2）
ffmpeg -y -ss 00:02:00 -i in.mp4 -to 00:06:00 -c copy out.mp4
# 精确到帧的裁剪（重编码 + accurate_seek）：
ffmpeg -y -ss 00:02:00 -i in.mp4 -to 00:06:00 -c:v libx264 -crf 20 -preset medium -c:a aac -b:a 192k out.mp4

# 多段拼接（同编码/同分辨率无损快拼）：list.txt 每行 file '<路径>'（单引号包裹）
ffmpeg -y -f concat -safe 0 -i list.txt -c copy out.mp4
# 异参数源拼接（统一分辨率/帧率再拼，n=段数；宽高须偶数）：
ffmpeg -y -i a.mp4 -i b.mp4 -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];[0:a]aresample=async=1[a0];[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1];[1:a]aresample=async=1[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset medium -c:a aac -b:a 192k out.mp4

# 横版转竖版（社媒转制刚需）：补边不裁；裁切填满把 decrease→increase、pad→crop=1080:1920
# （宽高须为偶数，libx264 要求；源无音轨把 -c:a copy 换成 -an）
ffmpeg -y -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1" \
  -c:v libx264 -crf 20 -preset medium -c:a copy out.mp4

# 第 3 秒抽帧做封面（-ss 放 -i 前关键帧对齐，秒级抽帧最快；-q:v 2-31 越小越清晰）
ffmpeg -y -ss 00:00:03 -i in.mp4 -frames:v 1 -q:v 2 cover.jpg
# 等比缩放宽 1080：加 -vf "scale=1080:-2"

# 2–6 秒转 GIF：两遍法先生成调色板再应用，质量高、体积小
ffmpeg -y -ss 2 -to 6 -i in.mp4 -vf "fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff" palette.png
ffmpeg -y -ss 2 -to 6 -i in.mp4 -i palette.png -lavfi "fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" out.gif

# 加 BGM（-stream_loop -1 让 BGM 循环，-shortest 随视频截断；原声 1.0 / BGM 0.3）
ffmpeg -y -i in.mp4 -stream_loop -1 -i bgm.mp3 \
  -filter_complex "[0:a]volume=1.0[a0];[1:a]volume=0.3[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest out.mp4
# 原视频无声（直接把 BGM 作音轨）：
ffmpeg -y -i in.mp4 -stream_loop -1 -i bgm.mp3 -filter_complex "[1:a]volume=0.3[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest out.mp4

# 右下角水印（宽 120、边距 20；位置表达式见 overlay=W-w-20:20，七个方位同 text）
ffmpeg -y -i in.mp4 -i logo.png -filter_complex "[1:v]scale=120:-1[wm];[0:v][wm]overlay=W-w-20:20:format=auto" \
  -c:v libx264 -crf 20 -preset medium -c:a copy out.mp4
# 半透明水印：把预处理段换成 "[1:v]scale=120:-1,format=rgba,colorchannelmixer=aa=0.5[wm]"

# 压缩（crf 26；目标码率改用 -b:v 2M -maxrate 2M -bufsize 2M；降分辨率加 -vf "scale=720:-2"）
ffmpeg -y -i in.mp4 -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p -c:a aac -b:a 128k small.mp4
```

## 组合操作

链式：每步产物作下一步输入。典型顺序 `cut → silence-cut → speed → text →
aspect → compress`。竖版转制放最后（在最终画布上叠字幕更可控）。

## 平台规范（简表）

| 平台 | 比例 | 时长 | 备注 |
|------|------|------|------|
| 抖音/视频号/Reels | 9:16 | ≤60s 黄金，前 3s 定成败 | 1080×1920 |
| 小红书视频 | 9:16 / 3:4 | ≤60s | 竖版优先 |
| B站/YouTube 横版 | 16:9 | 数分钟起 | 1920×1080 |
| Instagram Feed | 4:5 / 1:1 | 短 | 4:5 占屏更大 |

更详细规范按需查 `references/`（如有）。

## 环境要求

- **ffmpeg + ffprobe** — ✅ 已安装（模板直接可用）
- **Node ≥ 22** — ✅ 已安装（跑 `video_ops.mjs`，启动即检查 ffmpeg，缺则报错退出）
- **字幕烧录/逐字字幕** — 走 clipify（需 whisper）；本 SKILL 只做 `text` 覆盖

## Agent 指令

1. **先 `ffprobe`** 看源比例/时长/有无音轨，再决定操作
2. **纯命令操作用上方 ffmpeg 模板**（已含防坑注释，别改滤镜链结构）；
   **`speed` / `silence-cut` / `text` 用 `node skills/shared/scripts/video_ops.mjs`**，不确定参数用 `-h`
3. **多操作链式**执行，中间产物可留 `.drafts/`
4. **产物输出到** `outputs/主题名/`，最后告知路径与时长
