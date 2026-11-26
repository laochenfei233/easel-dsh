#!/usr/bin/env python3
"""asr_route.py — 宿主 ASR 路由客户端（离线脚本的语音转写统一入口）。

`asr.py` 在本仓由宿主半 `lib/asr.js` 取代后（POST /easel/api/asr：ffmpeg 分段 +
mimo ASR），short-drama 的 dubbing audit 与 ai_video 的 probe-dialogue 等
「本地音频 → 转写 → 与预期台词比对」的离线流程统一走这里：

  - 发现：读 `outputs/_easel_api.json`（base/basePath/runnerToken，宿主激活与
    每次 /asr 调用时刷新）。
  - 能力：`runnerToken` 走 `x-easel-runner` 头（与 curl 版 ASR runner 同款），
    只在本机、不出数据根。
  - 输出：写成与旧 `asr.py --format json` 兼容的 `{language, segments}` JSON
    （segments 元素含 start/end/text），调用方的比对逻辑零改动。

用法：
    import asr_route
    data = asr_route.transcribe(clip, out_json, project_root=PROJECT_ROOT)
失败抛异常（HTTP 状态/网络/缺发现文件），由调用方按「ASR 失败」分支处理。
"""
from __future__ import annotations

import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class AsrRouteError(RuntimeError):
    """转写未完成（宿主未运行 / 凭据未配置 / 平台拒绝），消息可直接展示。"""


def project_root(explicit: str | None = None) -> Path:
    """宿主数据根：EASEL_ROOT 优先（gateway/CLI/web 注入），否则按调用方上溯。

    与 toutiao_publish.py 同款兜底：脚本被拍平复制到 workspace 时相对层级会变。
    """
    return Path(explicit or __import__("os").environ.get("EASEL_ROOT") or "").resolve() \
        if (explicit or __import__("os").environ.get("EASEL_ROOT")) else Path()


def transcribe(media: Path, out_json: Path, *, project_root: Path) -> dict:
    """转写一段本地音频/视频，结果写 out_json（旧 asr.py json 兼容形）并返回。"""
    discovery = project_root / "outputs" / "_easel_api.json"
    try:
        api = json.loads(discovery.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise AsrRouteError(f"宿主 ASR 不可用（读不到 {discovery.name}，宿主未运行？）：{e}") from None
    url = api["base"].rstrip("/") + api.get("basePath", "/easel") + "/asr"
    headers = {"content-type": "application/json"}
    token = api.get("runnerToken")
    if token:
        headers["x-easel-runner"] = token
    req = Request(url, data=json.dumps({"path": str(media), "format": "json"}).encode(), headers=headers)
    try:
        with urlopen(req, timeout=600) as r:
            payload = json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:200]
        raise AsrRouteError(f"宿主 ASR 拒绝（HTTP {e.code}）：{detail}") from None
    # json 格式的字幕文件由宿主写在项目根下：语言等 meta 从文件读回。
    language = None
    if payload.get("file"):
        subtitle = project_root / str(payload["file"])
        try:
            meta = json.loads(subtitle.read_text(encoding="utf-8")).get("meta")
            language = (meta or {}).get("language")
        except (OSError, ValueError):
            pass
    out = {
        "language": language,
        "segments": [{"start": s.get("start"), "end": s.get("end"), "text": s.get("text")}
                     for s in payload.get("segments", [])],
    }
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out
