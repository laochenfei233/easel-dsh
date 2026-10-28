// 视频号 sidecar（wx_channels_download）与微信登录门控。spec easel-breakdown-channels：
// 微信登录检测只挂在「识别到视频号」之后的链路上（preflight/create/launch），
// 页面加载与插件启动不触碰这里。下载器本体是外部 exe（dist/tools/…，未随包分发），
// 经微信 PC 客户端流量代理 + 页面注入下载，产物落 staging 目录（wxdl_ 前缀）。
import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 下载器管理页端口（其 config.yaml api.port 的缺省值）。
const DOWNLOADER_PORT = 2022

/**
 * 微信窗口行 → 登录状态分类。真机实证（2026-10-28，微信 4.x 托盘驻留）：
 * 主窗口类 `Qt51514QWindowIcon`、标题「微信」，关到托盘时隐藏不销毁；可见的小尺寸
 * 同类窗口是登录界面。3.x 用独立类名。分类按「任一主窗 ⇒ 已登录」优先，
 * 登录界面只在没有任何主窗时才判定。
 * @param rows - {cls,title,visible,w,h} 数组（只含微信进程的顶层窗口）。
 * @returns {loggedIn, loginScreen}
 */
export function classifyWeChatWindows(rows) {
  const state = { loggedIn: false, loginScreen: false }
  for (const row of rows) {
    const w = Number(row.w) || 0
    const h = Number(row.h) || 0
    if (row.cls === 'WeChatMainWndForPC') state.loggedIn = true
    else if (row.cls === 'WeChatLoginWndForPC') state.loginScreen = true
    else if (row.cls === 'Qt51514QWindowIcon' && row.title === '微信') {
      // 隐藏 = 托盘里的主窗（已登录）；可见且是正常主窗尺寸 = 已登录；
      // 可见的小窗 = 停在登录界面（登录窗约 350×500 物理像素，主窗默认远大于此）。
      if (!row.visible || (w >= 600 && h >= 700)) state.loggedIn = true
      else state.loginScreen = true
    }
  }
  if (state.loggedIn) state.loginScreen = false
  return state
}

// 枚举微信进程全部顶层窗口（含隐藏）：cls/title/visible/w/h 以 \u0001 分隔输出。
// stdout 固定 UTF-8，标题「微信」不依赖控制台代码页。
const WINDOWS_PROBE = [
  "$ErrorActionPreference='Stop';[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;",
  "Add-Type @'",
  'using System;using System.Text;using System.Runtime.InteropServices;using System.Collections.Generic;',
  'public class WxEnum {',
  '  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);',
  '  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
  '  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
  '  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
  '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);',
  '  public struct RECT { public int Left, Top, Right, Bottom; }',
  '  delegate bool EnumWindowsProc(IntPtr h, IntPtr l);',
  '  public static List<string> List(uint[] pids) {',
  '    var r = new List<string>();',
  '    EnumWindows((h, l) => { uint pid; GetWindowThreadProcessId(h, out pid);',
  '      foreach (var p in pids) { if (pid == p) {',
  '        var c = new StringBuilder(256); var t = new StringBuilder(256);',
  '        GetClassName(h, c, 256); GetWindowText(h, t, 256); RECT rc;',
  '        GetWindowRect(h, out rc);',
  '        r.Add(c.ToString() + "\\u0001" + t.ToString() + "\\u0001" + (IsWindowVisible(h) ? "1" : "0")',
  '          + "\\u0001" + (rc.Right - rc.Left) + "\\u0001" + (rc.Bottom - rc.Top)); } }',
  '      return true; }, IntPtr.Zero);',
  '    return r;',
  '  }',
  '}',
  "'@",
  '$p = Get-Process -Name Weixin,WeChat -ErrorAction SilentlyContinue;',
  // PowerShell 的转义符是反引号，反斜杠不是——JSON 走单引号串。
  "if (-not $p) { [Console]::Out.Write('{\"running\":false}'); exit 0 }",
  '$rows = [WxEnum]::List([uint32[]]@($p.Id));',
  '$out = @{ running = $true; windows = @($rows) } | ConvertTo-Json -Compress -Depth 3;',
  '[Console]::Out.Write($out)',
].join('\n')

/**
 * 探测微信运行与登录状态。Windows：进程 + 窗口枚举；mac：只判进程
 * （微信 4.x 登录后常驻托盘，进程存在≈已登录；窗口枚举不在本期范围）。
 * @returns {running, loggedIn, loginScreen}
 */
export async function detectWeChat({ platform = process.platform, run = defaultRun } = {}) {
  if (platform === 'win32') {
    let raw
    try {
      raw = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROBE])
    } catch {
      return { running: false, loggedIn: false, loginScreen: false }
    }
    return parseWeChatProbe(raw)
  }
  if (platform === 'darwin') {
    let hit = false
    try {
      hit = (await run('pgrep', ['-x', 'WeChat'])).trim().length > 0
    } catch {
      hit = false
    }
    return { running: hit, loggedIn: hit, loginScreen: false }
  }
  return { running: false, loggedIn: false, loginScreen: false }
}

/** 探针 stdout → 状态。探针失败（进程消失/解析坏）按未运行处理。 */
export function parseWeChatProbe(raw) {
  let data
  try {
    data = JSON.parse(String(raw).trim().split('\n').pop())
  } catch {
    return { running: false, loggedIn: false, loginScreen: false }
  }
  if (!data?.running) return { running: false, loggedIn: false, loginScreen: false }
  const rows = (data.windows ?? []).map(line => {
    const [cls, title, visible, w, h] = String(line).split('\u0001')
    return { cls, title, visible: visible === '1', w: Number(w), h: Number(h) }
  })
  return { running: true, ...classifyWeChatWindows(rows) }
}

async function defaultRun(file, args) {
  const { execFile } = await import('node:child_process')
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 15_000 },
      (error, stdout) => { if (error) rejectPromise(error); else resolvePromise(stdout) })
  })
}

const EXE_BY_PLATFORM = { win32: 'wx_video_download.exe', darwin: 'wx_video_download' }

/**
 * 定位下载器安装：settings.channelsDownloader（cordis.yml config，可为 exe 或目录）→
 * env EASEL_CHANNELS_DOWNLOADER → 开发态回退（本模块上溯三级到仓库根的
 * dist/tools/wx-channels-download，同 build.mjs「解析而非假设」先例）。
 * @returns {installed, exe, dir, stagingDir} 未安装时只有 installed:false。
 */
export function findChannelsTool(settings, { platform = process.platform, moduleDir = dirname(fileURLToPath(import.meta.url)) } = {}) {
  const exeName = EXE_BY_PLATFORM[platform]
  if (exeName === undefined) return { installed: false }
  const candidates = []
  const configured = settings?.channelsDownloader ?? process.env.EASEL_CHANNELS_DOWNLOADER
  if (configured) candidates.push(configured)
  candidates.push(resolve(moduleDir, '..', '..', '..', 'dist', 'tools', 'wx-channels-download'))
  for (const candidate of candidates) {
    // 配置值可以是 exe 文件本身，也可以是安装目录（补平台二进制名）。
    const base = resolve(candidate)
    const exe = existsSync(base) && statSync(base).isFile() ? base : join(base, exeName)
    if (existsSync(exe)) {
      const dir = dirname(exe)
      return { installed: true, exe, dir, stagingDir: join(dir, 'downloads') }
    }
  }
  return { installed: false }
}

/** 下载器管理页是否已监听（TCP 探测 127.0.0.1，500ms 内连不上按未运行）。 */
export function downloaderRunning(port = DOWNLOADER_PORT) {
  return new Promise(resolvePromise => {
    const socket = createConnection({ host: '127.0.0.1', port })
    const done = result => { socket.destroy(); resolvePromise(result) }
    socket.setTimeout(500, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * 启动下载器（守卫顺序：已安装 → 微信已登录 → 未运行才 spawn）。
 * 微信登录守卫是用户拍板的启动前置：未运行/未登录直接拒绝，不 spawn。
 * 首次使用需管理员证书安装，由 UI 文案指引手动跑一次；此处以普通权限拉起。
 * @param settings - 插件 settings（channelsDownloader 解析自 config/env）。
 * @param deps - 注入点：detect / isRunning / spawnTool，测试用替身。
 * @returns {ok, already?, code?, message?}
 */
export async function launchChannelsTool(settings, {
  detect = detectWeChat,
  isRunning = downloaderRunning,
  spawnTool = defaultSpawnTool,
  waitPort = downloaderRunning,
} = {}) {
  const tool = findChannelsTool(settings)
  if (!tool.installed) {
    return { ok: false, code: 'tool-missing',
      message: '未找到视频号下载器：把 wx_video_download.exe 所在目录填入插件配置 channelsDownloader，或安装到 dist/tools/wx-channels-download/' }
  }
  const wechat = await detect()
  if (!wechat.running) {
    return { ok: false, code: 'wechat-not-running', message: '微信 PC 端没有运行：请先启动微信并登录' }
  }
  if (!wechat.loggedIn) {
    return { ok: false, code: 'wechat-not-logged-in', message: '微信还没有登录：请在微信里登录后再继续' }
  }
  if (await isRunning()) return { ok: true, already: true }
  spawnTool(tool.exe)
  for (let waited = 0; waited < 15_000; waited += 500) {
    await sleep(500)
    if (await waitPort()) return { ok: true, already: false }
  }
  return { ok: false, code: 'launch-timeout', message: '下载器已拉起但管理页未就绪（127.0.0.1:2022）：查看它的窗口或日志' }
}

function defaultSpawnTool(exe) {
  const child = spawn(exe, [], { detached: true, windowsHide: true, stdio: 'ignore' })
  child.unref()
}
