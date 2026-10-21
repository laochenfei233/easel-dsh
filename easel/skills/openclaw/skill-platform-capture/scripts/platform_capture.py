#!/usr/bin/env python3
"""platform_capture.py — 用裸 CDP 实抓平台公开数据（不依赖 Playwright）。

驱动一台**已登录**的反检测浏览器（cloakserve / chrome --remote-debugging-port），
用 Chrome DevTools Protocol 读真实平台数据：账号主页精确指标、关键词搜索出的
对标账号池、矩阵账号盘点。数据取自页面 SSR 与 DOM，不做逆向、不伪造字段。

子命令:
  check     连通性 + 各平台登录态（Network.getAllCookies，能读 httpOnly）
  profile   抓账号主页 → 精确粉丝/笔记/获赞/收藏 + 近期笔记
  search    按关键词搜索笔记 → 作者与互动
  sweep     多关键词 sweep → 按账号聚合
  selftest  离线自检（选择器/解析/参数）

为什么必须用 CDP 读 cookie：web_session 是 httpOnly，document.cookie 读不到，
用网页内 JS 判断登录态会得到稳定的假阴性。

依赖：websockets（与 OpenClaw workspace 的 python 环境一致）。
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

try:
    import websockets
except ImportError:  # pragma: no cover - 环境缺依赖时给出可执行提示
    websockets = None

DEFAULT_PORT = 9222
PLATFORMS = ("xhs", "douyin")
XHS_BASE = "https://www.xiaohongshu.com"
DY_BASE = "https://www.douyin.com"

# 页面就绪判定：正文长度阈值（登录墙/空壳页都低于它）
READY_MIN_CHARS = 200
NAV_POLL_S = 1.5
# 读操作节流：平台风控节流的是「读」，多关键词之间必须停顿
SWEEP_GAP_S = 8.0

STATE_JS = """(() => ({url: location.href, ready: document.readyState,
  len: document.body ? document.body.innerText.length : 0}))()"""

# 小红书 SSR：userPageData 是 Vue ref 且含循环引用，禁止 JSON.stringify，
# 直接取 <script> 里的原始文本，再由 Python 侧解析。
XHS_SSR_JS = """(() => {
  const sc = Array.from(document.scripts).find(s => s.textContent && s.textContent.includes('__INITIAL_STATE__'));
  return sc ? sc.textContent : '';
})()"""

NOTE_CARD_JS = """(() => {
  const pick = (root, sels) => {
    for (const s of sels) {
      const e = root.querySelector(s);
      if (e && (e.innerText || '').trim()) return e.innerText.trim();
    }
    return '';
  };
  let cards = Array.from(document.querySelectorAll('section.note-item'));
  if (!cards.length) {
    cards = Array.from(document.querySelectorAll('div'))
      .filter(d => d.querySelector('a[href*="/user/profile/"]')).slice(0, 80);
  }
  const seen = new Set(), notes = [];
  for (const c of cards) {
    const aLink = c.querySelector('a[href*="/user/profile/"]');
    const cover = c.querySelector('a[href*="/search_result/"], a[href*="/explore/"]');
    const title = pick(c, ['.title span', '.title', 'span.title', '.footer .title'])
      || (c.querySelector('img[alt]') ? (c.querySelector('img[alt]').getAttribute('alt') || '').trim() : '')
      || '(无标题)';   // 平台存在本身无标题的笔记，显式标记而非留空
    const author = pick(c, ['.author-wrapper .name', '.author .name', '.name', '.author-wrapper']);
    const likes = pick(c, ['.like-wrapper .count', '.count', '.like-wrapper']);
    let uid = null, nid = null;
    if (aLink) {
      const m = (aLink.getAttribute('href') || '').match(/\\/user\\/profile\\/([0-9a-zA-Z]+)/);
      if (m) uid = m[1];
    }
    if (cover) {
      const m2 = (cover.getAttribute('href') || '').match(/\\/(?:search_result|explore)\\/([0-9a-fA-F]{16,})/);
      if (m2) nid = m2[1];
    }
    if (!title && !author) continue;
    const key = title + '|' + author;
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push({title: title.slice(0, 80), author: author.slice(0, 40),
                userId: uid, noteId: nid, likes: likes.slice(0, 12)});
  }
  return JSON.stringify({url: location.href, count: notes.length, notes});
})()"""

# 抖音用户页统计：数字与「粉丝/获赞」标签是兄弟节点，取祖父节点文本
DOUYIN_STATS_JS = """(() => {
  const out = [];
  for (const el of document.querySelectorAll('div,span,p')) {
    const t = (el.innerText || '').trim();
    if (/^(粉丝|获赞|关注|作品)$/.test(t) && el.children.length === 0) {
      const g = el.parentElement && el.parentElement.parentElement;
      out.push({label: t, text: g ? (g.innerText || '').replace(/\\n/g, '|') : ''});
    }
  }
  const uniq = out.filter((v, i, a) => a.findIndex(x => x.text === v.text) === i);
  return JSON.stringify({url: location.href, stats: uniq,
    head: (document.body ? document.body.innerText : '').replace(/\\n+/g, ' | ').slice(0, 600)});
})()"""

# 主页笔记卡片对同一条笔记有**两个**锚点：隐藏的 `/explore/<id>`（无 token，打开必 404）
# 和带 token 的 `/user/profile/<uid>/<noteId>?xsec_token=...`。
# 用 querySelector 取「第一个匹配的 a」会静默拿到坏的那个，所以必须只筛带 token 的锚点。
TOKEN_MAP_JS = """(() => {
  const map = {};
  for (const a of document.querySelectorAll('a[href*="xsec_token="]')) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\\/user\\/profile\\/[0-9a-zA-Z]+\\/([0-9a-fA-F]{20,})\\?xsec_token=([^&]+)/);
    if (!m) continue;
    if (!map[m[1]]) map[m[1]] = decodeURIComponent(m[2]);
  }
  return JSON.stringify(map);
})()"""

NOTE_BODY_JS = """(() => {
  const ttl = document.querySelector('#detail-title');
  const desc = document.querySelector('#detail-desc');
  const body = document.body ? document.body.innerText : '';
  return JSON.stringify({
    url: location.href,
    not_found: /页面不见了|Isn.t Available/.test(body),
    title: ttl ? ttl.innerText.trim() : null,
    text: (desc ? desc.innerText : body).replace(/\\n{3,}/g, '\\n\\n').slice(0, 6000)
  });
})()"""


class CdpError(RuntimeError):
    """CDP 通道或页面结构层面的失败，调用方据此降级。"""


class Session:
    """极简 CDP 会话：一个连接、递增 id、跳过事件消息。"""

    def __init__(self, ws):
        self.ws = ws
        self._id = 0

    async def send(self, method: str, **params):
        self._id += 1
        mid = self._id
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=120))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise CdpError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    async def js(self, expr: str):
        res = await self.send("Runtime.evaluate", expression=expr,
                              returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in res:
            raise CdpError(json.dumps(res["exceptionDetails"], ensure_ascii=False)[:400])
        return res.get("result", {}).get("value")


def _http_json(path: str, port: int):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=10) as r:
        return json.loads(r.read().decode())


def list_pages(port: int):
    return [t for t in _http_json("/json/list", port) if t.get("type") == "page"]


async def connect(port: int) -> Session:
    if websockets is None:
        raise CdpError("缺少依赖 websockets；请先 pip install websockets")
    try:
        pages = list_pages(port)
    except (urllib.error.URLError, ConnectionRefusedError, OSError) as exc:
        raise CdpError(f"连不上 CDP 端口 {port}：{exc}") from exc
    if not pages:
        raise CdpError(f"端口 {port} 上没有 page target")
    ws = await websockets.connect(pages[0]["webSocketDebuggerUrl"],
                                  max_size=200 * 1024 * 1024, ping_interval=None)
    s = Session(ws)
    await s.send("Page.enable")
    await s.send("Runtime.enable")
    return s


async def navigate(s: Session, url: str, wait: float = 15.0):
    """用 Page.navigate（真导航）。

    不要用 location.href 赋值——SPA 路由守卫会把请求弹回首页，
    表现为「导航到 /login 却停在 /explore」。
    """
    await s.send("Page.navigate", url=url)
    loop = asyncio.get_event_loop()
    deadline = loop.time() + wait
    last = None
    while loop.time() < deadline:
        await asyncio.sleep(NAV_POLL_S)
        try:
            last = await s.js(STATE_JS)
        except CdpError as exc:
            last = {"err": str(exc)[:120]}
        if isinstance(last, dict) and last.get("ready") == "complete" \
                and last.get("len", 0) > READY_MIN_CHARS:
            await asyncio.sleep(2.0)
            return last
    return last


async def read_cookies(s: Session):
    """Network.getAllCookies —— 唯一能读到 httpOnly web_session 的方式。"""
    res = await s.send("Network.getAllCookies")
    return res.get("cookies", [])


# --------------------------------------------------------------------------- #
# 纯函数（可离线自测）
# --------------------------------------------------------------------------- #
def tonum(value: str | None) -> int:
    """把平台的「1.2万 / 1千+ / 1,234 / 赞」文本转成整数；无法解析返回 0。"""
    text = (value or "").strip().replace(",", "")
    if not text:
        return 0
    match = re.match(r"^([\d.]+)\s*(万|千|w|k)?", text, re.IGNORECASE)
    if not match:
        return 0
    number = float(match.group(1))
    unit = (match.group(2) or "").lower()
    if unit == "万":
        return int(number * 10000)
    if unit in {"千", "k"}:
        return int(number * 1000)
    if unit == "w":
        return int(number * 10000)
    return int(number)


def parse_xhs_state(raw: str | None):
    """从 SSR 原始文本解析 __INITIAL_STATE__。

    SSR 是 JS 而非严格 JSON：值位置会出现裸 `undefined` / `NaN`，先补成 null。
    """
    if not raw:
        return None
    raw = re.sub(r"(?<=[:,\[])\s*undefined(?=\s*[,}\]])", "null", raw)
    raw = re.sub(r"(?<=[:,\[])\s*NaN(?=\s*[,}\]])", "null", raw)
    idx = raw.find("window.__INITIAL_STATE__=")
    if idx < 0:
        return None
    start = raw.index("{", idx)
    try:
        obj, _ = json.JSONDecoder().raw_decode(raw[start:])
        return obj
    except (json.JSONDecodeError, ValueError):
        return None


def summarize_xhs_profile(obj, account: str):
    """把 SSR 裁剪成稳定契约：{account, nickname, metrics{}, tags[], notes[]}。"""
    user = (obj or {}).get("user", {})
    page = user.get("userPageData") or {}
    basic = page.get("basicInfo") or {}
    notes = []
    for group in user.get("notes") or []:
        for item in (group if isinstance(group, list) else [group]):
            card = item.get("noteCard") or {}
            notes.append({
                "title": (card.get("displayTitle") or "").strip(),
                "type": card.get("type"),
                "likes": (card.get("interactInfo") or {}).get("likedCount"),
                "sticky": bool((card.get("interactInfo") or {}).get("sticky")),
                "published_at_ms": card.get("time"),
            })
    return {
        "account": account,
        "nickname": basic.get("nickname"),
        "red_id": basic.get("redId"),
        "ip_location": basic.get("ipLocation"),
        "desc": (basic.get("desc") or "").replace("\n", " / "),
        "tags": [t.get("name") for t in (page.get("tags") or [])],
        "metrics": {
            "follows": next((i.get("count") for i in (page.get("interactions") or [])
                             if i.get("type") == "follows"), None),
            "fans": next((i.get("count") for i in (page.get("interactions") or [])
                          if i.get("type") == "fans"), None),
            "engagement": next((i.get("count") for i in (page.get("interactions") or [])
                                if i.get("type") == "interaction"), None),
            "notes": page.get("posted"),
            "liked": page.get("liked"),
            "collected": page.get("collected"),
        },
        "notes": notes,
    }


def avg_likes_per_note(metrics: dict) -> float | None:
    """单篇均赞 = 累计获赞 ÷ 笔记数。量级差可达数百倍，比较时需对数刻度或倍数表述。"""
    liked, notes = metrics.get("liked"), metrics.get("notes")
    if not liked or not notes:
        return None
    return round(liked / notes, 1)


def slugify(value: str) -> str:
    text = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", value or "").strip("-")
    return (text or "capture")[:60]


def resolve_out(value: str | None, platform: str, name: str) -> Path:
    """解析输出路径。走仓库统一契约（系统写入用已注册的 `_probe`）。"""
    raw = value or f"outputs/_probe/{platform}-{slugify(name)}.json"
    shared = Path(__file__).resolve().parents[3] / "shared" / "scripts"
    try:
        if str(shared) not in sys.path:
            sys.path.insert(0, str(shared))
        import output_paths  # noqa: PLC0415 - 延迟导入，脱离仓库时不影响其他子命令

        return output_paths.validate_output_path(raw, allow_system=True, create_parent=True)
    except Exception as exc:  # noqa: BLE001 - 契约不可用时明确失败，不静默写错地方
        candidate = Path(raw).expanduser()
        if candidate.is_absolute():
            candidate.parent.mkdir(parents=True, exist_ok=True)
            return candidate
        raise CdpError(f"输出路径不符合仓库契约，且无法降级：{raw}（{exc}）") from exc


def dump(payload, out: Path | None):
    text = json.dumps(payload, ensure_ascii=False, indent=1)
    if out is not None:
        out.write_text(text, encoding="utf-8")
        print(f"SAVED: {out}", file=sys.stderr)
    print(text)


# --------------------------------------------------------------------------- #
# 子命令
# --------------------------------------------------------------------------- #
async def cmd_check(args) -> int:
    s = await connect(args.port)
    try:
        cookies = await read_cookies(s)
        hosts: dict[str, list[str]] = {}
        for c in cookies:
            hosts.setdefault(c.get("domain", ""), []).append(c.get("name", ""))
        report = {"port": args.port, "pages": [
            {"title": p.get("title"), "url": p.get("url")} for p in list_pages(args.port)],
            "platforms": {}}
        for platform, marker in (("xhs", "xiaohongshu.com"), ("douyin", "douyin.com")):
            names = sorted({n for domain, ns in hosts.items() if marker in domain for n in ns})
            report["platforms"][platform] = {
                "cookies": len(names),
                # web_session 是小红书登录态的关键 cookie（httpOnly）
                "logged_in": ("web_session" in names) if platform == "xhs" else bool(names),
                "key_cookies": [n for n in names if n in
                                ("web_session", "webId", "a1", "gid", "xsecappid", "sessionid")],
            }
        dump(report, resolve_out(args.out, "check", "login-state"))
        return 0
    finally:
        await s.ws.close()


async def cmd_profile(args) -> int:
    platform = args.platform
    account = args.account
    s = await connect(args.port)
    try:
        if platform == "xhs":
            url = account if account.startswith("http") else f"{XHS_BASE}/user/profile/{account}"
            state = await navigate(s, url, args.wait)
            if isinstance(state, dict) and "/login" in (state.get("url") or ""):
                raise CdpError(
                    "被重定向到登录页。小红书裸主页链接需要带 xsec_token 的分享链，"
                    "或先在浏览器完成登录。"
                )
            data = summarize_xhs_profile(parse_xhs_state(await s.js(XHS_SSR_JS)), account)
            if not data.get("nickname"):
                raise CdpError("SSR 解析失败，页面结构可能已改版")
            data["metrics"]["avg_likes_per_note"] = avg_likes_per_note(data["metrics"])
        else:
            url = account if account.startswith("http") else f"{DY_BASE}/user/{account}"
            await navigate(s, url, args.wait)
            raw = json.loads(await s.js(DOUYIN_STATS_JS) or "{}")
            data = {"account": account, "url": raw.get("url"), "stats": raw.get("stats", []),
                    "head": raw.get("head", ""),
                    "note": "抖音用户页无需登录即可读；数字需从 stats 文本解析"}
        dump(data, resolve_out(args.out, platform, account))
        return 0
    finally:
        await s.ws.close()


async def _search_once(s: Session, platform: str, keyword: str, wait: float):
    if platform != "xhs":
        raise CdpError("search 目前只实现了 xhs；抖音搜索需登录且结构不稳定")
    url = f"{XHS_BASE}/search_result?keyword={quote(keyword)}&source=web_search_result_notes"
    await navigate(s, url, wait)
    # 懒加载：不滚动只能拿到首屏约 20 张卡片
    for _ in range(2):
        await s.js("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(2.5)
    await s.js("window.scrollTo(0, 0)")
    await asyncio.sleep(1.5)
    raw = await s.js(NOTE_CARD_JS)
    return json.loads(raw or '{"notes": []}').get("notes", [])


async def cmd_search(args) -> int:
    s = await connect(args.port)
    try:
        notes = await _search_once(s, args.platform, args.keyword, args.wait)
        dump({"keyword": args.keyword, "count": len(notes), "notes": notes},
             resolve_out(args.out, args.platform, f"search-{args.keyword}"))
        return 0
    finally:
        await s.ws.close()


async def cmd_sweep(args) -> int:
    keywords = [k.strip() for k in args.keywords.split(",") if k.strip()]
    if not keywords:
        raise CdpError("--keywords 为空")
    s = await connect(args.port)
    try:
        by_keyword, results = {}, {}
        for i, keyword in enumerate(keywords):
            print(f"[{i + 1}/{len(keywords)}] {keyword}", file=sys.stderr)
            try:
                notes = await _search_once(s, args.platform, keyword, args.wait)
            except CdpError as exc:
                print(f"  FAILED: {exc}", file=sys.stderr)
                notes = []
            by_keyword[keyword] = notes
            for note in notes:
                author = note.get("author") or "(未知)"
                row = results.setdefault(author, {"author": author, "userId": note.get("userId"),
                                                  "hits": 0, "max_likes": 0, "keywords": [],
                                                  "samples": []})
                row["hits"] += 1
                row["max_likes"] = max(row["max_likes"], tonum(note.get("likes")))
                if keyword not in row["keywords"]:
                    row["keywords"].append(keyword)
                if len(row["samples"]) < 3:
                    row["samples"].append(f"{note.get('likes')} | {note.get('title')}")
            # 平台风控节流的是「读」，多关键词之间必须停顿
            if i + 1 < len(keywords):
                await asyncio.sleep(SWEEP_GAP_S)
        ranked = sorted(results.values(), key=lambda r: (-r["hits"], -r["max_likes"]))
        dump({"by_keyword": by_keyword, "by_author": ranked},
             resolve_out(args.out, args.platform, f"sweep-{'-'.join(keywords[:2])}"))
        return 0
    finally:
        await s.ws.close()


async def _harvest_note_tokens(s: Session, account: str, wait: float) -> dict:
    """在主页上采集 noteId → xsec_token 映射（读正文的前提）。"""
    await navigate(s, f"{XHS_BASE}/user/profile/{account}", wait)
    raw = await s.js(TOKEN_MAP_JS)
    return json.loads(raw or "{}")


async def cmd_notes(args) -> int:
    """主页滚动采集全量笔记卡片（标题 / noteId / 点赞）。做活动盘点与选题挖掘用。"""
    if args.platform != "xhs":
        raise CdpError("notes 目前只实现了 xhs")
    s = await connect(args.port)
    try:
        await navigate(s, f"{XHS_BASE}/user/profile/{args.account}", args.wait)
        seen, stable = {}, 0
        for _ in range(args.max_scroll):
            raw = await s.js(NOTE_CARD_JS)
            cards = json.loads(raw or "[]").get("notes", [])
            before = len(seen)
            for c in cards:
                if c.get("noteId"):
                    seen[c["noteId"]] = c
            await s.js("window.scrollBy(0, Math.round(window.innerHeight*0.9))")
            await asyncio.sleep(1.6)
            if len(seen) == before:
                stable += 1
                if stable >= 6:
                    break
            else:
                stable = 0
        notes = list(seen.values())
        dump({"account": args.account, "count": len(notes), "notes": notes},
             resolve_out(args.out, "xhs", f"notes-{args.account}"))
        return 0
    finally:
        await s.ws.close()


async def cmd_note(args) -> int:
    """读指定笔记的正文。

    必须先在主页拿到带 token 的链接：裸 /explore/<id> 即使登录态也返回 404
    （error_code 300031）。目标 noteId 不在首屏时，先跑 `notes` 拿到全量 id。
    """
    if args.platform != "xhs":
        raise CdpError("note 目前只实现了 xhs")
    ids = normalize_ids(args.note_ids)
    if not ids:
        raise CdpError("--note-ids 为空")
    s = await connect(args.port)
    try:
        tokens = await _harvest_note_tokens(s, args.account, args.wait)
        print(f"harvested {len(tokens)} tokens", file=sys.stderr)
        missing = [i for i in ids if i not in tokens]
        out = {}
        for note_id in ids:
            if note_id not in tokens:
                out[note_id] = {"error": "no token on profile page (先跑 notes 或登录后再试)"}
                continue
            url = (f"{XHS_BASE}/user/profile/{args.account}/{note_id}"
                   f"?xsec_token={tokens[note_id]}&xsec_source=pc_user")
            await navigate(s, url, args.wait)
            out[note_id] = json.loads(await s.js(NOTE_BODY_JS) or "{}")
            await asyncio.sleep(3)
        if missing:
            print(f"no token for {len(missing)} id(s): {missing[:3]}", file=sys.stderr)
        dump(out, resolve_out(args.out, "xhs", f"note-{ids[0]}"))
        return 0
    finally:
        await s.ws.close()


def normalize_ids(value: str | None) -> list[str]:
    """逗号/空格分隔的 noteId 列表 → 去重保序列表。"""
    if not value:
        return []
    seen, out = set(), []
    for raw in re.split(r"[,\s]+", value.strip()):
        if raw and raw not in seen:
            seen.add(raw)
            out.append(raw)
    return out


def cmd_selftest(args) -> int:
    assert tonum("1.2万") == 12000
    assert tonum("1千+") == 1000
    assert tonum("7,838") == 7838
    assert tonum("赞") == 0 and tonum(None) == 0
    assert avg_likes_per_note({"liked": 5806, "notes": 492}) == 11.8
    assert avg_likes_per_note({"liked": 0, "notes": 0}) is None
    assert slugify("宁波 同城/活动") == "宁波-同城-活动"
    assert normalize_ids("a,b, a , c") == ["a", "b", "c"]
    assert normalize_ids("") == [] and normalize_ids(None) == []

    raw = ('window.__INITIAL_STATE__={"user":{"userPageData":{"interactions":'
           '[{"type":"follows","count":"10+"},{"type":"fans","count":"1千+"},'
           '{"type":"interaction","count":"1千+"}],"tags":[{"name":"浙江宁波","tagType":"location"}],'
           '"basicInfo":{"nickname":"样本","redId":"sample","ipLocation":"浙江","desc":"a\\nb"},'
           '"posted":492,"liked":5806,"collected":2110},"notes":[[{"noteCard":'
           '{"displayTitle":"标题","type":"normal","interactInfo":{"likedCount":"43",'
           '"sticky":false},"time":1}}]]}},'
           '"x":undefined,"y":NaN}')
    parsed = parse_xhs_state(raw)
    assert parsed is not None, "SSR 解析失败（undefined/NaN 兜底失效）"
    prof = summarize_xhs_profile(parsed, "sample")
    assert prof["nickname"] == "样本" and prof["red_id"] == "sample"
    assert prof["metrics"]["notes"] == 492 and prof["metrics"]["liked"] == 5806
    assert prof["metrics"]["fans"] == "1千+", prof["metrics"]
    assert prof["notes"][0]["title"] == "标题" and prof["notes"][0]["likes"] == "43"
    assert parse_xhs_state("") is None and parse_xhs_state("nothing here") is None

    for js in (STATE_JS, XHS_SSR_JS, NOTE_CARD_JS, DOUYIN_STATS_JS):
        assert js.strip()
    print("selftest OK: tonum / avg_likes_per_note / slugify / SSR 解析 / 脚本常量")
    return 0


def build_parser():
    ap = argparse.ArgumentParser(description="用裸 CDP 实抓平台公开数据")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("check", help="连通性 + 各平台登录态")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--out", default=None)
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("profile", help="抓账号主页精确指标")
    p.add_argument("--platform", choices=PLATFORMS, required=True)
    p.add_argument("--account", required=True, help="主页 URL / userId / sec_uid")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--wait", type=float, default=15.0)
    p.add_argument("--out", default=None)
    p.set_defaults(func=cmd_profile)

    p = sub.add_parser("search", help="按关键词搜索笔记")
    p.add_argument("--platform", choices=PLATFORMS, default="xhs")
    p.add_argument("--keyword", required=True)
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--wait", type=float, default=15.0)
    p.add_argument("--out", default=None)
    p.set_defaults(func=cmd_search)

    p = sub.add_parser("sweep", help="多关键词 sweep 并按账号聚合")
    p.add_argument("--platform", choices=PLATFORMS, default="xhs")
    p.add_argument("--keywords", required=True, help="逗号分隔")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--wait", type=float, default=15.0)
    p.add_argument("--out", default=None)
    p.set_defaults(func=cmd_sweep)

    p = sub.add_parser("notes", help="主页滚动采集全量笔记卡片")
    p.add_argument("--account", required=True, help="主页 URL / userId")
    p.add_argument("--platform", choices=PLATFORMS, default="xhs")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--wait", type=float, default=15.0)
    p.add_argument("--max-scroll", type=int, default=60)
    p.add_argument("--out", default=None)
    p.set_defaults(func=cmd_notes)

    p = sub.add_parser("note", help="读指定笔记正文（先在主页取 token）")
    p.add_argument("--account", required=True, help="主页 URL / userId")
    p.add_argument("--note-ids", required=True, help="逗号分隔的 noteId")
    p.add_argument("--platform", choices=PLATFORMS, default="xhs")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--wait", type=float, default=15.0)
    p.add_argument("--out", default=None)
    p.set_defaults(func=cmd_note)

    p = sub.add_parser("selftest", help="离线自检")
    p.set_defaults(func=cmd_selftest)
    return ap


def main() -> int:
    args = build_parser().parse_args()
    if args.cmd == "selftest":
        return args.func(args)
    try:
        return asyncio.run(args.func(args))
    except CdpError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 3
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
