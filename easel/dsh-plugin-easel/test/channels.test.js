// channels.test.js — 微信登录分类器与视频号下载器守卫的单测（node --test，全 stdlib）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyWeChatWindows, parseWeChatProbe, findChannelsTool, launchChannelsTool,
} from '../lib/channels.js'

test('classifyWeChatWindows reads login state from window shapes', () => {
  // 微信 4.x 托盘驻留：主窗隐藏不销毁（2026-10-28 真机实证）。
  assert.deepEqual(
    classifyWeChatWindows([{ cls: 'Qt51514QWindowIcon', title: '微信', visible: false, w: 1100, h: 800 }]),
    { loggedIn: true, loginScreen: false },
  )
  // 打开的正常主窗。
  assert.deepEqual(
    classifyWeChatWindows([{ cls: 'Qt51514QWindowIcon', title: '微信', visible: true, w: 1100, h: 800 }]),
    { loggedIn: true, loginScreen: false },
  )
  // 可见的小窗是登录界面。
  assert.deepEqual(
    classifyWeChatWindows([{ cls: 'Qt51514QWindowIcon', title: '微信', visible: true, w: 350, h: 500 }]),
    { loggedIn: false, loginScreen: true },
  )
  // 3.x 的独立类名。
  assert.deepEqual(
    classifyWeChatWindows([{ cls: 'WeChatMainWndForPC', title: '微信', visible: false, w: 1000, h: 700 }]),
    { loggedIn: true, loginScreen: false },
  )
  assert.deepEqual(
    classifyWeChatWindows([{ cls: 'WeChatLoginWndForPC', title: '微信', visible: true, w: 350, h: 500 }]),
    { loggedIn: false, loginScreen: true },
  )
  // 非微信标题/类的窗口一律忽略；登录界面不覆盖主窗判定。
  assert.deepEqual(
    classifyWeChatWindows([
      { cls: 'Qt51514QWindowIcon', title: '微信', visible: true, w: 350, h: 500 },
      { cls: 'Qt51514QWindowIcon', title: '微信', visible: false, w: 1100, h: 800 },
    ]),
    { loggedIn: true, loginScreen: false },
  )
  assert.deepEqual(classifyWeChatWindows([{ cls: 'Chrome_WidgetWin_1', title: '别的应用', visible: true, w: 1900, h: 1000 }]),
    { loggedIn: false, loginScreen: false })
  assert.deepEqual(classifyWeChatWindows([]), { loggedIn: false, loginScreen: false })
})

test('parseWeChatProbe decodes the probe payload and fails closed', () => {
  assert.deepEqual(parseWeChatProbe('{"running":false}'), { running: false, loggedIn: false, loginScreen: false })
  const row = ['Qt51514QWindowIcon', '微信', '0', '1100', '800'].join('\u0001')
  assert.deepEqual(
    parseWeChatProbe(JSON.stringify({ running: true, windows: [row] })),
    { running: true, loggedIn: true, loginScreen: false },
  )
  assert.deepEqual(parseWeChatProbe('不是 JSON'), { running: false, loggedIn: false, loginScreen: false })
})

test('findChannelsTool prefers the configured path and tolerates dir or exe spellings', () => {
  const repo = mkdtempSync(join(tmpdir(), 'channels-tool-'))
  try {
    const dir = join(repo, 'wx-channels-download')
    mkdirSync(dir)
    writeFileSync(join(dir, 'wx_video_download.exe'), 'stub')
    const settings = { channelsDownloader: dir }
    const found = findChannelsTool(settings, { moduleDir: join(repo, 'lib') })
    assert.equal(found.installed, true)
    assert.equal(found.exe, join(dir, 'wx_video_download.exe'))
    // staging 跟随工具缺省落盘配置（%UserDownloads%），不随 exe 目录走。
    assert.equal(found.stagingDir, join(homedir(), 'Downloads'))
    // 直接给 exe 也认。
    const settingsExe = { channelsDownloader: join(dir, 'wx_video_download.exe') }
    assert.equal(findChannelsTool(settingsExe, { moduleDir: join(repo, 'lib') }).exe, join(dir, 'wx_video_download.exe'))
    // 没配置且开发回退落空 → 未安装；配置了但不存在 → 同样未安装（不静默回退）。
    assert.deepEqual(findChannelsTool({}, { moduleDir: join(repo, 'lib') }), { installed: false })
    assert.deepEqual(
      findChannelsTool({ channelsDownloader: join(repo, 'missing-tools') }, { moduleDir: repo }),
      { installed: false },
    )
    // 环境变量兜底。
    const prev = process.env.EASEL_CHANNELS_DOWNLOADER
    process.env.EASEL_CHANNELS_DOWNLOADER = dir
    try {
      assert.equal(findChannelsTool({}, { moduleDir: join(repo, 'lib') }).installed, true)
    } finally {
      if (prev === undefined) delete process.env.EASEL_CHANNELS_DOWNLOADER
      else process.env.EASEL_CHANNELS_DOWNLOADER = prev
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('launchChannelsTool refuses before spawning unless wechat is logged in and tool exists', async () => {
  const spawned = []
  const spawnTool = exe => spawned.push(exe)
  const settings = { channelsDownloader: '/nowhere' }

  // 工具未安装：直接拒绝，连微信都不探测。
  const noTool = await launchChannelsTool(settings, {
    detect: async () => { throw new Error('不应探测微信') },
    spawnTool,
  })
  assert.equal(noTool.ok, false)
  assert.equal(noTool.code, 'tool-missing')
  assert.equal(spawned.length, 0)

  // 微信没运行 / 停在登录界面：拒绝且不 spawn（启动前先检测微信登录，用户拍板）。
  const fakeDetect = async state => state
  const dir = mkdtempSync(join(tmpdir(), 'channels-guard-'))
  try {
    writeFileSync(join(dir, 'wx_video_download.exe'), 'stub')
    const installed = { channelsDownloader: dir }
    for (const [state, code] of [
      [{ running: false, loggedIn: false, loginScreen: false }, 'wechat-not-running'],
      [{ running: true, loggedIn: false, loginScreen: true }, 'wechat-not-logged-in'],
    ]) {
      const result = await launchChannelsTool(installed, { detect: () => fakeDetect(state), spawnTool })
      assert.equal(result.ok, false)
      assert.equal(result.code, code)
    }
    assert.equal(spawned.length, 0)

    // 已登录 + 已运行 → no-op；已登录 + 未运行 → spawn 并等端口就绪。
    const running = await launchChannelsTool(installed, {
      detect: () => fakeDetect({ running: true, loggedIn: true, loginScreen: false }),
      isRunning: async () => true,
      spawnTool,
    })
    assert.deepEqual(running, { ok: true, already: true })
    const launched = await launchChannelsTool(installed, {
      detect: () => fakeDetect({ running: true, loggedIn: true, loginScreen: false }),
      isRunning: async () => false,
      waitPort: async () => true,
      spawnTool,
    })
    assert.deepEqual(launched, { ok: true, already: false })
    assert.equal(spawned.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
