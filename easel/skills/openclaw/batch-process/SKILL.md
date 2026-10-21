---
name: batch-process
description: "批量处理：对一个目录里的一批图片/视频/音频统一套用同一操作——批量压缩、加水印、转格式、缩放、转比例、音量归一化等。当用户说 批量处理、批量压缩、批量加水印、批量转格式、一批图片/视频、给这个文件夹、全部转成、批量缩放、批量转竖版、整个目录 时使用。基于 shared/scripts/batch_process.py（图片委派 image_ops；视频/音频操作为 ffmpeg 模板 + video_ops.mjs/audio_ops.mjs）。与 image-editing/video-editing/audio-editing 区别：那些处理单文件，本 SKILL 批量套用到整个目录。"
layer: general
---

# 批量处理（目录级）

> 对整个目录的图片/视频/音频统一套用同一操作。走 `skills/shared/scripts/batch_process.py`：
> 图片委派 image_ops.py；视频/音频操作为 ffmpeg 命令模板 + video_ops.mjs / audio_ops.mjs
> （命令形态见 video-editing / audio-editing）。

> 单文件处理见 image-editing / video-editing / audio-editing；本 SKILL 是它们的**目录批量版**。

## 输入

| 字段 | 必填 | 说明 |
|------|------|------|
| 目录 | 是 | 待处理文件所在目录 |
| 类型 | 是 | `image` / `video` / `audio`（决定用哪个 ops 脚本 + 文件筛选） |
| 操作 | 是 | ops 子命令（如 resize/compress/watermark/aspect/convert/normalize） |
| 操作参数 | 视操作 | 写在 `--` 之后，原样透传给 ops 脚本 |

## 输出（默认 `<目录>/batch_out/`）

- 处理后的同名文件；报告成功/失败数。

## 执行

脚本路径（相对项目根）：`skills/shared/scripts/batch_process.py`（`run -h` / `list -h`）。

```bash
# 先预览会处理哪些文件
python skills/shared/scripts/batch_process.py list --dir imgs --type image

# 批量压缩图片到 500KB
python skills/shared/scripts/batch_process.py run --dir imgs --type image --op compress \
  --out-dir out -- --max-kb 500

# 批量加水印
python skills/shared/scripts/batch_process.py run --dir imgs --type image --op watermark \
  -- --text "@我的账号" --position bottom-right

# 批量视频转竖版 9:16
python skills/shared/scripts/batch_process.py run --dir clips --type video --op aspect \
  --out-dir out -- --ratio 9:16 --mode pad

# 批量音频转 mp3（改扩展名用 --ext）
python skills/shared/scripts/batch_process.py run --dir raw --type audio --op convert \
  --out-dir out --ext .mp3 -- --bitrate 192k
```

## 可用操作（透传给 ops 脚本，`<脚本> <op> -h` 看参数）

- **image**（image_ops）：resize / crop / pad / convert / compress / watermark / round / thumbnail
- **video**：纯命令（compress/aspect/watermark/gif/frame）用 ffmpeg 模板（见 video-editing）；
  speed 用 `node skills/shared/scripts/video_ops.mjs speed -i <in> -o <out> --factor <f>`
- **audio**：纯命令（convert/normalize/fade/trim）用 ffmpeg 模板（见 audio-editing）；
  denoise / speed 用 `node skills/shared/scripts/audio_ops.mjs <op> <in> -o <out> ...`

## 规则

1. 先 `list` 预览文件范围，确认无误再 `run`。
2. `--` 之后的参数原样透传给 ops 脚本；不确定参数先跑单文件版（image-editing 等）验证一次。
3. 改输出格式用 `--ext`（如 `.mp3`/`.png`），否则沿用原扩展名。
4. 批处理串行执行（避免高负载）；量大时耐心等，失败文件会单独列出不中断整体。
5. 默认输出到 `<目录>/batch_out/`，不覆盖原文件。

## 参考来源

复用项目既有确定性能力（图片 image_ops.py；视频/音频为 ffmpeg 模板 + video_ops.mjs/audio_ops.mjs），
本 SKILL 只做目录遍历 + 逐文件套用 + 结果汇总，不重复实现处理逻辑。
