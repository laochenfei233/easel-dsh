#!/usr/bin/env python3
"""browser_session.py — runner 浏览器会话双模式：自起 persistent profile / CDP 附身运行实例。

多账号（docs/compose/specs/easel-multi-account.md T2）：host 侧直启器为账号拉起真 Chromium
（--remote-debugging-port + 独立 user-data-dir），runner 传 --cdp-endpoint 附身该实例操作
（复用其登录态，用户可旁观/插手验证码）；不传 endpoint 时维持现状——自起 Playwright
持久化 profile。平台脚本共用：

  - add_args：给子命令加 --profile-dir（profile 目录全路径，缺省=各脚本现状默认目录）
    与 --cdp-endpoint（旧 --cdp 为同义别名）。两者互斥：endpoint 优先，给定时忽略 --profile-dir。
  - resolve_endpoint / session_mode / pick_profile：纯函数，selftest 直接测。
  - open_browser：endpoint 给定 → connect_over_cdp 附身，取 browser.contexts[0]（浏览器默认
    上下文，无上下文才 new_context）；否则调调用方自己的 launch()（Cloak 内核/代理/有头等
    启动参数差异留在各脚本）。返回 (ctx, owned)。
  - open_page：launch 模式沿用「取初始页或开新页」；CDP 模式开新页，不动用户已开的标签。
  - close_session：launch 模式关闭本进程起的浏览器；CDP 模式绝不 close——窗口是用户开着的，
    进程退出时 sync_playwright 收尾自然断开（connect_over_cdp 下 close 只断开连接，
    稳妥起见不主动调）。
"""
from __future__ import annotations

import argparse
from pathlib import Path


def add_args(p: argparse.ArgumentParser, default_hint: str) -> None:
    """给 argparse 子命令加 --profile-dir 与 --cdp-endpoint（旧 --cdp 为同义别名）。"""
    p.add_argument("--profile-dir", default=None,
                   help=f"浏览器 profile 目录全路径（多账号用；默认 {default_hint}）")
    p.add_argument("--cdp-endpoint", "--cdp", dest="cdp_endpoint", metavar="URL", default=None,
                   help="附身已运行的浏览器实例（如 http://127.0.0.1:9301）而不自起浏览器；"
                        "与 --profile-dir 互斥，此参数优先（给定时忽略 --profile-dir）")


def resolve_endpoint(args: argparse.Namespace) -> str | None:
    """--cdp-endpoint 的值（旧 --cdp 同 dest），未给返回 None。"""
    return getattr(args, "cdp_endpoint", None) or None


def session_mode(args: argparse.Namespace) -> str:
    """'cdp'（附身运行中实例）或 'launch'（自起 persistent context）。
    --cdp-endpoint 与 --profile-dir 同给时 endpoint 优先。"""
    return "cdp" if resolve_endpoint(args) else "launch"


def pick_profile(explicit: str | None, default_profile: Path) -> Path:
    """实际使用的 profile 目录：--profile-dir 显式值优先（支持 ~ 展开），否则现状默认路由。"""
    if explicit:
        return Path(explicit).expanduser()
    return default_profile


def open_browser(p, *, cdp_endpoint: str | None, launch):  # noqa: ANN001
    """双模式开浏览器，返回 (ctx, owned)。owned=True 表示 ctx 归本进程、用完应 close。"""
    if cdp_endpoint:
        browser = p.chromium.connect_over_cdp(cdp_endpoint)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        return ctx, False
    if launch is None:
        raise ValueError("未给 --cdp-endpoint 时必须提供 launch()（自起 persistent context）")
    return launch(), True


def open_page(ctx, owned: bool):  # noqa: ANN001
    """取操作页。CDP 附身模式开新页：运行实例里已开的标签是用户自己的，不去抢。"""
    if owned:
        return ctx.pages[0] if ctx.pages else ctx.new_page()
    return ctx.new_page()


def close_session(ctx, owned: bool) -> None:  # noqa: ANN001
    """launch 模式关闭本进程起的浏览器；CDP 模式不调任何 close（那是用户开着的窗口：
    进程退出时 playwright driver 停止，连接自然断开，窗口保持打开）。"""
    if owned:
        ctx.close()


def selftest_args() -> None:
    """离线自检 --profile-dir / --cdp-endpoint 的解析契约（各脚本 selftest 复用）。"""
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers().add_parser("t")
    add_args(sp, default_hint="~/.easel-browser-profiles/<平台>Profile")
    a = ap.parse_args(["t"])
    assert a.profile_dir is None and a.cdp_endpoint is None, "缺省应为 None（保持现状行为）"
    assert session_mode(a) == "launch"
    a = ap.parse_args(["t", "--profile-dir", "/tmp/easel-pd"])
    assert a.profile_dir == "/tmp/easel-pd" and session_mode(a) == "launch"
    a = ap.parse_args(["t", "--cdp-endpoint", "http://127.0.0.1:9301"])
    assert a.cdp_endpoint == "http://127.0.0.1:9301" and session_mode(a) == "cdp"
    a = ap.parse_args(["t", "--cdp", "http://127.0.0.1:9222"])
    assert a.cdp_endpoint == "http://127.0.0.1:9222", "旧 --cdp 别名必须继续可用"
    a = ap.parse_args(["t", "--profile-dir", "/tmp/easel-pd", "--cdp-endpoint", "http://e"])
    assert session_mode(a) == "cdp", "endpoint 与 profile-dir 互斥：endpoint 优先、profile-dir 忽略"
    assert pick_profile(None, Path("/d")) == Path("/d"), "未传 --profile-dir 用现状默认"
    assert pick_profile("~/easel-pd", Path("/d")) == Path.home() / "easel-pd", "显式覆盖生效"
