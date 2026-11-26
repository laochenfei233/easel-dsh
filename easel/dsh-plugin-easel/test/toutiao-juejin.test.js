// 今日头条与掘金渠道的宿主侧回归：命令行形状（spec easel-toutiao-juejin-channels §S2.3/S4）。
// 头条走专用脚本（backend=='toutiao' 三处分支），掘金走通用 web 后端与 account_stats 采集；
// 两个脚本都被假 runner 替换，把收到的 argv 落盘供断言——断言的是宿主拼出的命令，不是脚本行为。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AUTOMATION_ROUTES } from '../lib/plugins/automation.js'
import { dispatchLocalApi } from '../index.js'

const settings = root => ({
  projectRoot: root,
  skillsDir: join(root, 'skills', 'openclaw'),
  python: process.execPath,
})

/** 临时数据根；浏览器 profile 根封闭在临时目录（迁移探测不吃真实 home）。 */
const tmpRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-channels-'))
  mkdirSync(join(root, 'outputs', '_login'), { recursive: true })
  mkdirSync(join(root, 'outputs', '_publish'), { recursive: true })
  process.env.EASEL_BROWSER_PROFILES = join(root, 'browser-profiles')
  mkdirSync(join(root, 'browser-profiles'), { recursive: true })
  return root
}

const cleanup = root => rmSync(root, { recursive: true, force: true })

const call = (root, method, path, body, query = '') => dispatchLocalApi(
  settings(root), method, path.split('/').filter(Boolean), new URLSearchParams(query),
  async () => body ?? {}, {}, AUTOMATION_ROUTES)

const registryWith = accounts => JSON.stringify({ version: 1, accounts })

/** 假 runner：把 argv 落到 EASEL_ARGV_OUT；可选补写登录状态文件与打印单行 JSON。 */
function fakeRunner(root, scriptPath, { argvOut, statusFile, status, whoami } = {}) {
  const lines = [
    "const fs = require('node:fs')",
    `fs.writeFileSync(${JSON.stringify(argvOut ?? join(root, 'argv.json'))}, JSON.stringify(process.argv))`,
  ]
  if (statusFile && status) {
    lines.push(`fs.mkdirSync(require('node:path').dirname(${JSON.stringify(statusFile)}), { recursive: true })`)
    lines.push(`fs.writeFileSync(${JSON.stringify(statusFile)}, ${JSON.stringify(JSON.stringify(status))})`)
  }
  if (whoami) lines.push(`console.log(${JSON.stringify(JSON.stringify(whoami))})`)
  lines.push('process.exit(0)')
  const full = join(root, scriptPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, lines.join('\n'), 'utf8')
}

test('analytics/platforms lists toutiao and juejin with their display names', async () => {
  const root = tmpRoot()
  try {
    const res = await call(root, 'GET', 'analytics/platforms')
    const byKey = new Map(res.json.map(row => [row.platform, row]))
    assert.equal(byKey.get('toutiao').name, '今日头条')
    assert.equal(byKey.get('juejin').name, '掘金')
    assert.equal(byKey.get('toutiao').loggedIn, false)
  } finally {
    cleanup(root)
  }
})

test('toutiao qr login spawns the dedicated script with --headed and the account profile', async () => {
  const root = tmpRoot()
  try {
    const argvOut = join(root, 'argv-login.json')
    const statusFile = join(root, 'outputs', '_login', 'toutiao-x1.json')
    fakeRunner(root, join('skills', 'openclaw', 'skill-toutiao-publisher', 'scripts', 'toutiao_publish.py'),
      { argvOut, statusFile, status: { state: 'qr_ready', message: '', qr: '' } })
    writeFileSync(join(root, 'outputs', '_accounts.json'), registryWith([
      { id: 'toutiao-x1', platform: 'toutiao', name: '头条号', persona: null, profileDir: 'Toutiao__toutiao-x1', createdAt: '2026-01-01' },
    ]), 'utf8')

    const res = await call(root, 'POST', 'login/toutiao', { account: 'toutiao-x1' })
    assert.equal(res.json.mode, 'qr')
    assert.equal(res.json.state, 'qr_ready')

    const argv = JSON.parse(readFileSync(argvOut, 'utf8'))
    assert.ok(argv[1].endsWith('toutiao_publish.py'), 'runner must be the dedicated toutiao script')
    assert.ok(argv.includes('login'))
    assert.ok(argv.includes('--headed'), 'toutiao login always opens a visible window (phone binding)')
    assert.ok(argv.includes('--timeout'))
    const pd = argv.indexOf('--profile-dir')
    assert.ok(pd !== -1 && argv[pd + 1].endsWith(join('browser-profiles', 'Toutiao__toutiao-x1')))
    const qo = argv.indexOf('--qr-out')
    assert.ok(argv[qo + 1].endsWith(join('outputs', '_login', 'toutiao-x1.png')))
    const sf = argv.indexOf('--status-file')
    assert.ok(argv[sf + 1].endsWith(join('outputs', '_login', 'toutiao-x1.json')))
  } finally {
    cleanup(root)
  }
})

test('toutiao whoami delegates to the script and carries the account browser arguments', async () => {
  const root = tmpRoot()
  try {
    const argvOut = join(root, 'argv-whoami.json')
    fakeRunner(root, join('skills', 'openclaw', 'skill-toutiao-publisher', 'scripts', 'toutiao_publish.py'),
      { argvOut, whoami: { loggedIn: true, name: '头条小站', avatar: '' } })
    writeFileSync(join(root, 'outputs', '_accounts.json'), registryWith([
      { id: 'toutiao-x1', platform: 'toutiao', name: '头条号', persona: null, profileDir: 'Toutiao__toutiao-x1', createdAt: '2026-01-01' },
    ]), 'utf8')

    const res = await call(root, 'GET', 'accounts/toutiao/whoami', null, 'account=toutiao-x1')
    assert.equal(res.json.loggedIn, true)
    assert.equal(res.json.name, '头条小站')

    const argv = JSON.parse(readFileSync(argvOut, 'utf8'))
    assert.ok(argv.includes('whoami'))
    assert.ok(argv.includes('--profile-dir'), 'whoami falls back to the account profile when no window is open')
  } finally {
    cleanup(root)
  }
})

test('toutiao publish rejects a video, an over-long title and too many topics without spawning the runner', async () => {
  const root = tmpRoot()
  try {
    const argvOut = join(root, 'argv-publish.json')
    fakeRunner(root, join('skills', 'openclaw', 'skill-toutiao-publisher', 'scripts', 'toutiao_publish.py'), { argvOut })
    writeFileSync(join(root, 'outputs', '_accounts.json'), registryWith([
      { id: 'toutiao-x1', platform: 'toutiao', name: '头条号', persona: null, profileDir: '', createdAt: '2026-01-01' },
    ]), 'utf8')
    writeFileSync(join(root, 'outputs', 'clip.mp4'), Buffer.from([0, 0, 0, 24]), 'utf8')

    const expect400 = async (body) => {
      try {
        await call(root, 'POST', 'publish/toutiao', body)
        return null
      } catch (error) {
        return error
      }
    }
    const video = await expect400({ account: 'toutiao-x1', title: '标题', body: '正文', media: ['clip.mp4'] })
    assert.equal(video?.status, 400)
    assert.match(video?.detail, /图文只收图片/)

    const longTitle = await expect400({ account: 'toutiao-x1', title: '标'.repeat(31), body: '正文' })
    assert.equal(longTitle?.status, 400)
    assert.match(longTitle?.detail, /不能超过 30 字/)

    const topics = await expect400({ account: 'toutiao-x1', title: '标题', body: '正文', tags: '#a，#b #c,#d #e #f' })
    assert.equal(topics?.status, 400)
    assert.match(topics?.detail, /不能超过 5 个/)

    assert.throws(() => readFileSync(argvOut, 'utf8'), 'the runner must not be spawned for rejected requests')
  } finally {
    cleanup(root)
  }
})

test('toutiao publish passes the body inline and normalizes topics instead of --media', async () => {
  const root = tmpRoot()
  try {
    const argvOut = join(root, 'argv-publish.json')
    fakeRunner(root, join('skills', 'openclaw', 'skill-toutiao-publisher', 'scripts', 'toutiao_publish.py'), { argvOut })
    writeFileSync(join(root, 'outputs', '_accounts.json'), registryWith([
      { id: 'toutiao-x1', platform: 'toutiao', name: '头条号', persona: null, profileDir: '', createdAt: '2026-01-01' },
    ]), 'utf8')
    writeFileSync(join(root, 'outputs', 'fig1.png'), Buffer.from([0x89, 0x50]), 'utf8')

    const res = await call(root, 'POST', 'publish/toutiao',
      { account: 'toutiao-x1', title: '标题', body: '正文', tags: '#AI，效率', media: ['fig1.png'] })
    assert.equal(res.json.ok, true)

    const argv = JSON.parse(readFileSync(argvOut, 'utf8'))
    const content = argv[argv.indexOf('--content') + 1]
    assert.equal(content, '正文')
    assert.deepEqual(argv[argv.indexOf('--tags') + 1].split(','), ['AI', '效率'])
    assert.ok(argv[argv.indexOf('--images') + 1].endsWith('fig1.png'))
    assert.ok(argv.includes('--exec'))
    assert.equal(argv.includes('--media'), false, 'toutiao takes --images, never the generic --media')
    assert.equal(argv.includes('--draft'), false, 'drafts are out of scope for the toutiao channel v1')
    const items = JSON.parse(readFileSync(join(root, 'outputs', '_schedule.json'), 'utf8'))
    assert.equal(items[0].platform, '今日头条')
  } finally {
    cleanup(root)
  }
})

test('juejin publish goes through the generic web publisher with --platform juejin', async () => {
  const root = tmpRoot()
  try {
    const argvOut = join(root, 'argv-publish.json')
    fakeRunner(root, join('skills', 'shared', 'scripts', 'web_publisher.py'), { argvOut })
    writeFileSync(join(root, 'outputs', '_accounts.json'), registryWith([
      { id: 'juejin-x1', platform: 'juejin', name: '掘金号', persona: null, profileDir: 'Juejin__juejin-x1', createdAt: '2026-01-01' },
    ]), 'utf8')

    const res = await call(root, 'POST', 'publish/juejin',
      { account: 'juejin-x1', title: '标题', body: '正文', tags: 'nodejs' })
    assert.equal(res.json.ok, true)

    const argv = JSON.parse(readFileSync(argvOut, 'utf8'))
    assert.ok(argv[1].endsWith('web_publisher.py'))
    const pf = argv.indexOf('--platform')
    assert.equal(argv[pf + 1], 'juejin')
    assert.ok(argv.includes('--exec'))
    const pd = argv.indexOf('--profile-dir')
    assert.ok(pd !== -1 && argv[pd + 1].endsWith(join('browser-profiles', 'Juejin__juejin-x1')))
  } finally {
    cleanup(root)
  }
})

test('juejin analytics fetch archives under the account id via account_stats', async () => {
  const root = tmpRoot()
  try {
    const argvOut = join(root, 'argv-stats.json')
    fakeRunner(root, join('skills', 'shared', 'scripts', 'account_stats.py'),
      { argvOut, whoami: { platform: 'juejin', followers: 5, loggedIn: true } })
    writeFileSync(join(root, 'outputs', '_accounts.json'), registryWith([
      { id: 'juejin-x1', platform: 'juejin', name: '掘金号', persona: null, profileDir: 'Juejin__juejin-x1', createdAt: '2026-01-01' },
    ]), 'utf8')

    const res = await call(root, 'GET', 'analytics/juejin', null, 'account=juejin-x1')
    assert.equal(res.json.followers, 5)

    const argv = JSON.parse(readFileSync(argvOut, 'utf8'))
    assert.ok(argv[1].endsWith('account_stats.py'))
    assert.ok(argv.includes('fetch'))
    const pl = argv.indexOf('--platform')
    assert.equal(argv[pl + 1], 'juejin')
    const hk = argv.indexOf('--history-key')
    assert.equal(argv[hk + 1], 'juejin-x1')
  } finally {
    cleanup(root)
  }
})
