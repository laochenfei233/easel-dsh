---
name: viral-deconstruction
description: >-
  爆款视频深度拆解：下载抖音/小红书/快手/B站/YouTube/微信视频号视频，抽帧+语音转写后
  看画面听口播，产出钩子、结构、火因与可复制模板的六点拆解，选题自动入选题库。
  当用户说"拆解这个视频""爆款拆解""视频链接拆解""这条视频为什么火"或贴了视频链接
  要求拆解时使用。纯文本拆解无需本技能。
layer: attribute
---

# 爆款视频深度拆解

把一条视频爆款拆到「画面 + 声音 + 文本」三层：下载视频 → ffmpeg 抽帧 →
faster-whisper 转写口播 → 视觉模型看帧 → 按时间轴合并素材 → 产出六点拆解
（与纯文本拆解同构），选题写回 `outputs/_ideas.json`。

> 边界：只做「视频 → 拆解」。纯文本拆解不走本技能；生成新视频见 auto-short-video；
> 本地字幕文件转制见 auto-subtitle。

## 前置（第一步必须先查，缺了就引导，不要硬跑）

| 依赖 | 检查 | 缺失时的指引 |
|------|------|--------------|
| 视觉模型 | 当前会话模型能否读图（用 Read 试读一张任意图片/帧后即知） | 让用户在 **dsh 设置 → 模型管理** 配置一个视觉模型（自定义 OpenAI 兼容 provider，如火山方舟 `https://ark.cn-beijing.volces.com/api/v3` + `doubao-seed-2-1-*`；GLM-4V / Qwen-VL 等均可，模型自选），并在对话里把模型切过去后继续 |
| yt-dlp | `yt-dlp --version`（B站/YouTube/通用站点需要；抖音/小红书/快手/视频号走内置路径不需要） | `pip install yt-dlp` |
| ffmpeg | `ffmpeg -version` | `winget install ffmpeg` 或 https://ffmpeg.org/download.html |
| 小红书 cookie | `outputs/_deconstruct/cookies.json` 里有无 `"xhs"` 字段 | 让用户把网页版小红书的请求 Cookie 粘贴进该文件（`{"xhs": "粘贴到这里"}`）；**抖音/快手不需要 cookie**（快手被风控时可让用户填网页版游客 cookie 到 `"kuaishou"` 字段） |
| 视频号（仅 sph 链接） | 微信 PC 端是否运行且已登录；下载器是否运行（管理页 `127.0.0.1:2022` 通不通） | 未登录 → 让用户在微信里登录；下载器没跑 → 启动 `dist/tools/wx-channels-download/wx_video_download.exe`（首次需管理员装证书）。**视频号链接必须先过这一步再继续** |
| mimo ASR | `MIMO_API_KEY` 已配置（.env 或环境变量）；dsh 壳在跑（`outputs/_easel_api.json` 存在） | 在项目 `.env` 写 `MIMO_API_KEY=<key>`（转写走本地路由 + mimo-v2.5-asr 云端，零本地模型） |

长视频限制：超过 10 分钟的视频抽帧/转写耗时不可控，先向用户确认再继续。

## 执行步骤

固定流程，batch 目录 = `outputs/_deconstruct/<batch>/`
（`<batch>` 用 `d<MMDD>-<4位随机hex>` 命名；下划线开头目录不进内容库）。
脚本路径相对项目根。

### 1. 预检

按上表逐项检查。视觉模型没配好就停在这一步等用户，**不要**凭空描述画面。

### 2. 下载

```
node skills/shared/scripts/video_fetch.mjs outputs/_deconstruct/<batch>/ <用户贴的完整文案>
```

- 脚本 stdout 输出一行元信息 JSON（title/author/duration_sec/file/url），记下来写进 source.md。
- 视频号链接（channels.weixin.qq.com）→ 脚本不发网络请求，转而**轮询下载器产物**：
  确认下载器在跑、微信已登录后，让用户在微信 PC 端打开该视频点「下载」按钮，
  脚本拾取到 `wxdl_*` 新文件会自动复制进 batch（默认等 8 分钟，stderr 有进度）。
  等待期间每 1–2 分钟提醒一次用户去点下载。
- 退出码 2（下载失败）→ 告诉用户可手动把视频文件放进
  `outputs/_deconstruct/<batch>/`（mp4/mov/webm 均可），放好后重跑同一条命令，
  脚本检测到文件会跳过下载。
- 退出码 3（缺小红书 cookie）→ 给上表 cookie 指引，等用户填好后重跑。
- 退出码 5（缺 yt-dlp）→ 给安装指引。

### 3. 抽帧

```bash
# 时长（秒）
ffprobe -v error -show_entries format=duration -of csv=p=0 outputs/_deconstruct/<batch>/video.mp4
# 场景关键帧（0.4 阈值）+ 每 N 秒兜底采样，二选一不够就都跑，去重后不超过 24 帧
ffmpeg -y -i outputs/_deconstruct/<batch>/video.mp4 -vf "select='gt(scene,0.4)',showinfo" -vsync vfr outputs/_deconstruct/<batch>/frames/scene_%03d.jpg
ffmpeg -y -i outputs/_deconstruct/<batch>/video.mp4 -vf "fps=1/<N>" outputs/_deconstruct/<batch>/frames/every_%03d.jpg
```

N 按时长取：≤60s 取 5、≤180s 取 10、更长取 15。帧总数控制在 **24 帧以内**
（看帧很吃上下文）；超了就提高场景阈值或拉大 N 重抽。若拿到的是 showinfo
日志里的帧时间戳（pts_time），记下来供第 6 步对齐。

### 4. 转写

```bash
BASE=$(node -e "const j=require('./outputs/_easel_api.json');process.stdout.write(j.base+j.basePath)")
TOKEN=$(node -e "const j=require('./outputs/_easel_api.json');process.stdout.write(j.runnerToken)")
curl -s -X POST "$BASE/api/asr" -H "Content-Type: application/json" -H "X-Easel-Runner: $TOKEN" \
  -d '{"path":"outputs/_deconstruct/<batch>/video.mp4","format":"json"}' \
  && mv outputs/_deconstruct/<batch>/video/video.json outputs/_deconstruct/<batch>/asr.json
```

asr.json 是带时间戳的分段文本（`segments: [{start, end, text}, ...]` 形态）。
无声视频（纯 BGM/纯画面）转写结果为空属正常，跳过声音层。

### 5. 看帧

用 Read 工具逐帧读 `outputs/_deconstruct/<batch>/frames/*.jpg`，
每帧记一行「[秒数] 画面描述」（时间取抽帧时的 pts_time，没有就按序号×N 估算）。
描述要具体：人物/场景/字幕字卡/运镜，这是后面「画面钩子」分析的原始证据。

### 6. 合并素材档案

写 `outputs/_deconstruct/<batch>/source.md`：

```markdown
# 拆解素材：<标题>
- 作者：<author> · 时长：<duration_sec>s · 来源：<url>
- 批次：outputs/_deconstruct/<batch>/

## 画面时间轴
- [0s] @frames/scene_001.jpg — <画面描述>
- [3.2s] @frames/scene_002.jpg — <画面描述>
...

## 口播/字幕
- [0.0-2.8] <文本>
- [2.8-6.1] <文本>
...
```

帧用相对路径 `@frames/xxx.jpg` 引用（batch 内相对），文件删除后档案仍可读。

### 7. 拆解与回写

吃 source.md 产出六点拆解（对话里完整输出）：

1. **一句话概括**
2. **钩子拆解**：开头为什么抓人——前 3 秒的画面 + 口播怎么配合（必须有画面证据）
3. **结构套路**：分段/节奏/信息编排
4. **为什么会火**：情绪/共鸣/实用/争议点
5. **可复制模板**：把套路抽象成可套用的结构框架
6. **借这个套路（结合用户画像）可做的 3 个选题**

【完成后必须执行】把完整拆解写入选题库：读 `outputs/_ideas.json`
（JSON 数组，不存在当作 `[]`），最前面插入
`{"id":"<12位随机hex>","title":"拆解模板：<标题>","note":"<完整拆解Markdown全文>","source":"爆款拆解","status":"pending","created":<当前unix秒>}`，
保存保持合法 JSON、UTF-8、缩进 2（注意 Markdown 转义）。

### 8. 清理

拆解完成、_ideas.json 回写成功后：
删 `video.mp4`、`frames/`、`asr.json`；**保留 source.md**（追溯用）。

## 报告

完成后在对话里给出：拆解全文（六点）+ 选题已入库提示 + source.md 路径。
