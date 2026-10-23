import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CORE_ROUTES, createRouteRegistry, dispatchLocalApi, parseHotJson, parseRssItems, resolveSettings } from '../index.js'
import { AUTOMATION_ROUTES } from '../lib/plugins/automation.js'
import { DECONSTRUCT_ROUTES } from '../lib/plugins/deconstruct.js'

// The route table the running server composes from its three plugin entries.
const ALL_ROUTES = [...CORE_ROUTES, ...AUTOMATION_ROUTES, ...DECONSTRUCT_ROUTES]

// ── 临时项目夹具：profiles/ + skills/ + outputs/ 全在内存盘式的 tmp 目录里 ──
const root = mkdtempSync(join(tmpdir(), 'easel-b1-'))
const settings = {
  projectRoot: root,
  skillsDir: join(root, 'skills', 'openclaw'),
  backendUrl: new URL('http://127.0.0.1:1'),
  basePath: '/easel',
}

mkdirSync(join(root, 'profiles', '造作星期八'), { recursive: true })
writeFileSync(join(root, 'profiles', '造作星期八', 'identity.md'), '# 造作星期八\n一人食剧情账号', 'utf8')
mkdirSync(join(root, 'profiles', '_template'), { recursive: true })
mkdirSync(join(root, 'skills', 'openclaw', 'skill-demo'), { recursive: true })
writeFileSync(join(root, 'skills', 'openclaw', 'skill-demo', 'SKILL.md'),
  '---\nname: demo\nlayer: produce\ndescription: >-\n  第一行\n  第二行\n---\n正文内容\n', 'utf8')
mkdirSync(join(root, 'skills', 'openclaw', 'ai-image-gen'), { recursive: true })
writeFileSync(join(root, 'skills', 'openclaw', 'ai-image-gen', 'SKILL.md'), '---\nname: ai-image-gen\n---\n生图\n', 'utf8')
mkdirSync(join(root, 'outputs', 'demo-project'), { recursive: true })
writeFileSync(join(root, 'outputs', 'demo-project', '.easel.json'),
  JSON.stringify({ title: '监控诡影', deliverables: ['cover.png'], cover: 'cover.png' }), 'utf8')
writeFileSync(join(root, 'outputs', 'demo-project', 'cover.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
writeFileSync(join(root, 'outputs', 'demo-project', 'note.md'), 'hello', 'utf8')
mkdirSync(join(root, 'outputs', '_login'), { recursive: true })

const call = (method, path, body, query = '') =>
  dispatchLocalApi(settings, method, path.split('/').filter(Boolean), new URLSearchParams(query),
    async () => body ?? {}, {}, ALL_ROUTES)

test('status answers locally with dsh transport and on-disk personas/skills', async () => {
  const result = await call('GET', 'status')
  assert.equal(result.json.gateway, true)
  assert.equal(result.json.transport, 'dsh')
  const persona = result.json.personas.find(p => p.name === '造作星期八')
  assert.ok(persona, 'valid persona listed')
  assert.equal(persona.description, '一人食剧情账号')
  assert.ok(!result.json.personas.some(p => p.name === '_template'), 'underscore dirs excluded')
  const skill = result.json.skills.find(s => s.name === 'skill-demo')
  assert.equal(skill.description, '第一行 第二行')
  assert.equal(skill.layer, 'produce')
})

test('persona files: ordered six dimensions, atomic save, and path safety', async () => {
  const listed = await call('GET', 'persona/造作星期八/files')
  assert.equal(listed.json.files[0].filename, 'identity.md')
  const saved = await call('PUT', 'persona/造作星期八/file', { filename: 'style.md', content: '风格' })
  assert.equal(saved.json.ok, true)
  const reread = await call('GET', 'persona/造作星期八/files')
  assert.equal(reread.json.files.find(f => f.filename === 'style.md').content, '风格')
  await assert.rejects(call('PUT', 'persona/造作星期八/file', { filename: '../escape.md', content: 'x' }),
    error => error.status === 400, 'traversal filename rejected')
  await assert.rejects(call('PUT', 'persona/../file', { filename: 'a.md', content: 'x' }),
    error => error.status === 404, 'invalid persona name is 404 (parity with profile_exists)')
})

test('persona save writes through to disk and delete removes the directory', async () => {
  mkdirSync(join(root, 'profiles', '临时账号'), { recursive: true })
  await call('PUT', 'persona/临时账号/file', { filename: 'memory.md', content: '记住这条' })
  assert.ok(readFileSync(join(root, 'profiles', '临时账号', 'memory.md'), 'utf8').includes('记住这条'))
  const deleted = await call('DELETE', 'persona/临时账号')
  assert.equal(deleted.json.deleted, '临时账号')
  assert.ok(!existsSync(join(root, 'profiles', '临时账号')))
  await assert.rejects(call('DELETE', 'persona/临时账号'), error => error.status === 404)
})

test('skill detail resolves the skill- prefix and the registry drives needsApi', async () => {
  const demo = await call('GET', 'skill/demo')
  assert.equal(demo.json.name, 'skill-demo')
  assert.equal(demo.json.body, '正文内容')
  assert.equal(demo.json.needsApi, false)
  assert.equal(demo.json.apiSpec, null)
  const image = await call('GET', 'skill/ai-image-gen')
  assert.equal(image.json.needsApi, true)
  assert.equal(image.json.apiConfigured, false)
  assert.equal(image.json.apiSpec.providers[0].keys[0].env, 'IMG_API_KEY')
  assert.equal(image.json.apiSpec.providers[0].keys[0].masked, '')
})

test('env save: allowlist, injection guard, and configured-state round trip', async () => {
  // image 组的必填 key 是 IMG_API_KEY + IMG_BASE_URL 两个（与 Python 注册表一致）。
  const partial = await call('POST', 'env', { updates: { IMG_API_KEY: 'sk-test-1234' } })
  assert.equal(partial.json.skills['ai-image-gen'], false, 'required BASE_URL missing → not configured')
  const saved = await call('POST', 'env', { updates: { IMG_BASE_URL: 'https://api.example.com/v1' } })
  assert.equal(saved.json.ok, true)
  assert.equal(saved.json.skills['ai-image-gen'], true)
  const envText = readFileSync(join(root, '.env'), 'utf8')
  assert.ok(envText.includes('IMG_API_KEY=sk-test-1234'))
  assert.ok(envText.includes('IMG_BASE_URL=https://api.example.com/v1'))
  const image = await call('GET', 'skill/ai-image-gen')
  assert.equal(image.json.apiConfigured, true)
  assert.equal(image.json.apiSpec.providers[0].keys[0].masked, '••••1234')
  await assert.rejects(call('POST', 'env', { updates: { NOT_ALLOWED: 'x' } }), error => error.status === 400)
  await assert.rejects(call('POST', 'env', { updates: { IMG_API_KEY: 'a\nEVIL=1' } }), error => error.status === 400)
})

test('ideas CRUD with status fallback and 404s', async () => {
  const created = await call('POST', 'ideas', { title: '拆解', source: 'trend:weibo', status: 'bogus' })
  assert.match(created.json.id, /^[0-9a-f]{12}$/)
  assert.equal(created.json.status, 'pending')
  assert.equal(typeof created.json.created, 'number')
  const listed = await call('GET', 'ideas')
  assert.equal(listed.json.length, 1)
  const updated = await call('PUT', `ideas/${created.json.id}`, { title: '', status: 'doing' })
  assert.equal(updated.json.status, 'doing')
  assert.equal(updated.json.title, '拆解', 'empty title falls back to existing')
  await assert.rejects(call('PUT', 'ideas/ffffffffffff', { title: 'x' }), error => error.status === 404)
  const removed = await call('DELETE', `ideas/${created.json.id}`)
  assert.equal(removed.json.ok, true)
  assert.equal((await call('GET', 'ideas')).json.length, 0)
})

test('schedule CRUD: kind/status validation, source frozen at create', async () => {
  const created = await call('POST', 'schedule', {
    title: '发小红书', date: '2026-10-20', platform: 'xiaohongshu', kind: 'bogus', source: 'chat',
  })
  assert.equal(created.json.kind, 'content', 'invalid kind falls back to content')
  assert.equal(created.json.source, 'chat')
  const updated = await call('PUT', `schedule/${created.json.id}`, { title: '改', status: 'published', kind: 'event' })
  assert.equal(updated.json.kind, 'event')
  assert.equal(updated.json.status, 'published')
  await assert.rejects(call('PUT', 'schedule/ffffffffffff', { title: 'x' }), error => error.status === 404)
  await assert.rejects(call('DELETE', 'schedule/ffffffffffff'), error => error.status === 404)
  assert.equal((await call('DELETE', `schedule/${created.json.id}`)).json.ok, true)
})

test('radar config: round trip, defaults on corrupt file', async () => {
  const saved = await call('POST', 'radar/config', {
    proxyUrl: 'http://127.0.0.1:7890', proxyEnabled: true, cdpEndpoint: '',
    keywords: ['AI', 'ai ', '', '大模型'],
    sources: [{ name: 'HN', url: 'https://hnrss.org/frontpage', kind: 'rss', category: '科技', enabled: true }],
  })
  assert.equal(saved.json.ok, true)
  const got = await call('GET', 'radar/config')
  assert.equal(got.json.proxyEnabled, true)
  assert.equal(got.json.cdpEndpoint, 'http://127.0.0.1:9222', 'empty cdp falls back to default')
  assert.equal(got.json.sources[0].name, 'HN')
  assert.deepEqual(got.json.keywords, ['AI', '大模型'], 'keywords normalized case-insensitively')
  writeFileSync(join(root, 'outputs', '_radar_config.json'), '{oops', 'utf8')
  const fresh = await call('GET', 'radar/config')
  assert.equal(fresh.json.proxyUrl, '')
  assert.equal(fresh.json.sources.length, 0)
  assert.deepEqual(fresh.json.keywords, [])
})

test('radar article: unsafe urls are refused locally without any network', async () => {
  await assert.rejects(
    call('POST', 'radar/article', { title: 'T', url: 'http://127.0.0.1:9222/admin' }),
    error => error.status === 400 && /内网/.test(error.detail),
  )
  await assert.rejects(
    call('POST', 'radar/article', { title: 'T', url: 'file:///C:/Windows/win.ini' }),
    error => error.status === 400,
  )
  await assert.rejects(call('POST', 'radar/article', { url: 'https://x.com/a' }), error => error.status === 400, 'missing title')
})

test('radar trends: answers locally with an empty selection and no keywords', async () => {
  const res = await call('GET', 'trends', null, 'platforms=&limit=5')
  assert.deepEqual(res.json.trends, [])
  assert.deepEqual(res.json.watch, [])
  assert.equal(typeof res.json.updated, 'number')
})

test('ideas writes serialize: concurrent creates all land', async () => {
  const rounds = await Promise.all(
    Array.from({ length: 8 }, (_, i) => call('POST', 'ideas', { title: `并发${i}` })),
  )
  const listed = await call('GET', 'ideas')
  assert.equal(listed.json.length, 8, 'no lost updates between concurrent writers')
  assert.equal(new Set(rounds.map(r => r.json.id)).size, 8)
  for (const round of rounds) await call('DELETE', `ideas/${round.json.id}`)
})

test('parseHotJson normalizes weibo/zhihu shapes', () => {
  const items = parseHotJson({ data: { data: [{ word: '话题A', hot_value: 123, url: 'https://weibo.com/x' }] } })
  assert.deepEqual(items, [{ title: '话题A', hot: '123', url: 'https://weibo.com/x' }])
  const zhihu = parseHotJson({ data: [{ title: '问题', url: 'https://api.zhihu.com/questions/123' }] })
  assert.equal(zhihu[0].url, 'https://www.zhihu.com/question/123')
})

test('parseRssItems handles CDATA titles and Atom href links', () => {
  const rss = parseRssItems('<?xml version="1.0"?><rss><channel>'
    + '<item><title><![CDATA[带 &amp; 符号的标题]]></title><link>https://example.com/a</link><hot>99</hot></item>'
    + '</channel></rss>')
  assert.deepEqual(rss, [{ title: '带 & 符号的标题', hot: '99', url: 'https://example.com/a' }])
  const atom = parseRssItems('<feed xmlns="http://www.w3.org/2005/Atom">'
    + '<entry><title>第二条</title><link href="https://example.com/b" rel="alternate"/></entry></feed>')
  assert.deepEqual(atom, [{ title: '第二条', hot: '', url: 'https://example.com/b' }])
})

test('outputs tree: meta resolution, hidden/underscore exclusion, protected delete', async () => {
  const tree = (await call('GET', 'outputs')).json
  const project = tree.find(node => node.name === 'demo-project')
  assert.ok(project, 'project listed')
  assert.equal(project.meta.title, '监控诡影')
  assert.equal(project.meta.cover, 'demo-project/cover.png')
  assert.deepEqual(project.meta.deliverablePaths, ['demo-project/cover.png'])
  assert.equal(project.fileCount, 2)
  const content = await call('GET', 'output/demo-project/note.md')
  assert.equal(content.json.content, 'hello')
  const binary = await call('GET', 'output/demo-project/cover.png')
  assert.equal(binary.json.isBinary, true)
  assert.equal(binary.json.kind, 'image')
  await assert.rejects(call('GET', 'output/../.env'), error => error.status === 403)
  mkdirSync(join(root, 'outputs', '_login'), { recursive: true })
  await assert.rejects(call('DELETE', 'output/_login'), error => error.status === 403)
  await assert.rejects(call('DELETE', 'output/_schedule.json'), error => error.status === 403)
  const removed = await call('DELETE', 'output/demo-project/note.md')
  assert.equal(removed.json.kind, 'file')
  assert.ok(!existsSync(join(root, 'outputs', 'demo-project', 'note.md')))
})

test('media route returns the file with its content type', async () => {
  const media = await call('GET', 'media/demo-project/cover.png')
  assert.ok(media.file.endsWith('cover.png'))
  assert.equal(media.headers['content-type'], 'image/png')
})

test('accounts and analytics platforms reflect the status/cookie files', async () => {
  const accounts = (await call('GET', 'accounts')).json
  assert.equal(accounts.length, 7)
  assert.equal(accounts[0].platform, 'xiaohongshu')
  let bilibili = accounts.find(a => a.platform === 'bilibili')
  assert.equal(bilibili.loggedIn, false)
  writeFileSync(join(root, 'cookies.json'), '{}', 'utf8')
  bilibili = (await call('GET', 'accounts')).json.find(a => a.platform === 'bilibili')
  assert.equal(bilibili.loggedIn, true)
  const platforms = (await call('GET', 'analytics/platforms')).json
  assert.equal(platforms.length, 7)
  assert.equal(platforms.find(p => p.platform === 'xiaohongshu').loggedIn, false)
  writeFileSync(join(root, 'outputs', '_login', 'xiaohongshu.json'), JSON.stringify({ state: 'success' }), 'utf8')
  assert.equal((await call('GET', 'analytics/platforms')).json.find(p => p.platform === 'xiaohongshu').loggedIn, true)
})

test('login status reads qr file metadata; sms writes the one-time code file', async () => {
  let status = await call('GET', 'login/kuaishou/status')
  assert.equal(status.json.state, 'unknown')
  assert.equal(status.json.qr, '')
  writeFileSync(join(root, 'outputs', '_login', 'kuaishou.json'), JSON.stringify({ state: 'qr_ready', message: '扫码' }), 'utf8')
  writeFileSync(join(root, 'outputs', '_login', 'kuaishou.png'), Buffer.from([0x89, 0x50]))
  status = await call('GET', 'login/kuaishou/status')
  assert.equal(status.json.mode, 'qr')
  assert.equal(status.json.state, 'qr_ready')
  assert.equal(status.json.qr, '_login/kuaishou.png')
  assert.equal(typeof status.json.qrTs, 'number')
  await assert.rejects(call('GET', 'login/bogus/status'), error => error.status === 404)
  assert.equal((await call('POST', 'login/douyin/sms', { code: '12ab34' })).json.ok, true)
  assert.equal(readFileSync(join(root, 'outputs', '_login', 'douyin.code'), 'utf8'), '1234')
  await assert.rejects(call('POST', 'login/douyin/sms', { code: '123' }), error => error.status === 400)
})

test('publish status and sms mirror the file protocol', async () => {
  assert.equal((await call('GET', 'publish/douyin/status')).json.state, 'unknown')
  mkdirSync(join(root, 'outputs', '_publish'), { recursive: true })
  writeFileSync(join(root, 'outputs', '_publish', 'douyin.json'), JSON.stringify({ state: 'sms_required', message: 'y' }), 'utf8')
  const status = await call('GET', 'publish/douyin/status')
  assert.equal(status.json.mode, 'publish')
  assert.equal(status.json.state, 'sms_required')
  assert.equal((await call('POST', 'publish/douyin/sms', { code: '9x9x9x9' })).json.ok, true)
  assert.equal(readFileSync(join(root, 'outputs', '_publish', 'douyin.code'), 'utf8'), '9999')
})

test('logout removes browser profile state; wechat-oa clears credentials locally', async () => {
  writeFileSync(join(root, 'outputs', '_login', 'bilibili.json'), '{}', 'utf8')
  const result = await call('POST', 'logout/bilibili')
  assert.ok(result.json.deleted.includes('cookies.json'))
  assert.ok(result.json.deleted.includes('bilibili.json'))
  assert.ok(!existsSync(join(root, 'cookies.json')))
  const wx = await call('POST', 'logout/wechat-oa')
  assert.equal(wx.json.ok, true)
  assert.ok(wx.json.deleted.includes('wechat-publisher.yaml:accounts.web'))
  await assert.rejects(call('POST', 'logout/bogus'), error => error.status === 404)
})

test('unabsorbed routes fall through to the proxy (null)', async () => {
  assert.equal(await call('GET', 'chat/stream'), null)
  assert.equal(await call('GET', 'personas'), null)
  assert.equal(await call('GET', 'settings/models'), null)
  assert.equal(await call('POST', 'skill/skill-demo', { input: 'x' }), null)
  assert.equal(await call('GET', 'bogus/path'), null)
})

test('B2 login start validates locally without spawning', async () => {
  await assert.rejects(call('POST', 'login/bogus', { mode: 'qr' }), error => error.status === 404)
  await assert.rejects(call('POST', 'login/bilibili', { mode: 'cdp' }), error => error.status === 400)
})

test('B2 profile build writes the six-dimension baseline locally', async () => {
  const created = await call('POST', 'profile/build', {
    name: '测试画像', form: { direction: '平价护肤测评', tone: '亲切日常', platforms: ['小红书'], links: { 小红书: 'https://xhslink.com/a' } },
  })
  assert.equal(created.json.created, true)
  const identity = readFileSync(join(root, 'profiles', '测试画像', 'identity.md'), 'utf8')
  assert.ok(identity.includes('平价护肤测评'))
  const platforms = readFileSync(join(root, 'profiles', '测试画像', 'platforms.md'), 'utf8')
  assert.ok(platforms.includes('https://xhslink.com/a'))
  await assert.rejects(call('POST', 'profile/build', { name: '测试画像', form: {} }), error => error.status === 409)
  await assert.rejects(call('POST', 'profile/build', { name: '', form: {} }), error => error.status === 400)
  await assert.rejects(call('POST', 'profile/build', { name: 'a/b', form: {} }), error => error.status === 400)
})

test('B2 wechat credentials read from the skill YAML with masking', async () => {
  const skillDir = join(root, 'skills', 'openclaw', 'skill-wechat-publisher')
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'wechat-publisher.yaml'),
    "default: 'web'\naccounts:\n  web:\n    name: '我的号'\n    app_id: 'wx1234567890abcd'\n    app_secret: 'secret-value'\n    author: '我'\n", 'utf8')
  const got = await call('GET', 'accounts/wechat-oa/credentials')
  assert.equal(got.json.configured, true)
  assert.equal(got.json.appIdMasked, 'wx1234***abcd')
  assert.equal(got.json.name, '我的号')
  assert.equal(got.json.appSecret, undefined, 'AppSecret must never be returned')
})

test('workspace media: projectRoot-scoped stream with range passthrough', async () => {
  mkdirSync(join(root, 'projects', '宣传片', 'outputs', 'concept'), { recursive: true })
  writeFileSync(join(root, 'projects', '宣传片', 'outputs', 'concept', 'v6.mp4'), Buffer.from([0, 1, 2, 3]))
  const media = (method, path, headers) =>
    dispatchLocalApi(settings, method, path.split('/').filter(Boolean), new URLSearchParams(),
      async () => ({}), headers)
  const ok = await media('GET', 'workspace-media/projects/宣传片/outputs/concept/v6.mp4', { range: 'bytes=1-2' })
  assert.equal(ok.file, join(root, 'projects', '宣传片', 'outputs', 'concept', 'v6.mp4'))
  assert.equal(ok.range, 'bytes=1-2')
  assert.equal(ok.headers['content-type'], 'video/mp4')
  // outputs/ 下同样可走（projectRoot 域是 outputs 域的超集）
  writeFileSync(join(root, 'outputs', 'demo-project', 'voice.mp3'), Buffer.from([0, 1, 2, 3]))
  const plain = await media('GET', 'workspace-media/outputs/demo-project/voice.mp3', {})
  assert.equal(plain.file, join(root, 'outputs', 'demo-project', 'voice.mp3'))
  assert.equal(plain.headers['content-type'], 'audio/mpeg')
  await assert.rejects(
    media('GET', 'workspace-media/outputs/demo-project/cover.png', {}),
    error => error.status === 404,
    'images belong to the image renderer, not this media route',
  )
  await assert.rejects(
    media('GET', 'workspace-media/../outputs/_login/x.json', {}),
    error => error.status === 403,
    'traversal outside projectRoot must be refused',
  )
  await assert.rejects(
    media('GET', `workspace-media/${'C:'}\\Windows\\win.ini`, {}),
    error => error.status === 403,
    'absolute path escape must be refused',
  )
  await assert.rejects(
    media('GET', 'workspace-media/projects/宣传片/outputs/concept/missing.mp4', {}),
    error => error.status === 404,
  )
  await assert.rejects(media('GET', 'workspace-media', {}), error => error.status === 404)
  // 只服务播放器能放的媒体：项目根下的 .env / 源码 / 文档不是文件服务器
  writeFileSync(join(root, '.env'), 'MIMO_API_KEY=secret', 'utf8')
  await assert.rejects(
    media('GET', 'workspace-media/.env', {}),
    error => error.status === 404,
    'non-media files under projectRoot must not be served',
  )
  await assert.rejects(
    media('GET', 'workspace-media/skills/openclaw/skill-demo/SKILL.md', {}),
    error => error.status === 404,
  )
})

test('settings canonicalize a junction projectRoot so status and media agree with dsh stat', async () => {
  const target = join(root, 'migrated-data')
  mkdirSync(join(target, 'projects', 'demo'), { recursive: true })
  writeFileSync(join(target, 'projects', 'demo', 'clip.mp4'), Buffer.from([0, 1, 2, 3]))
  const alias = join(root, 'migrated-alias')
  symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
  const canonical = realpathSync(target)
  const resolved = resolveSettings({ projectRoot: alias })
  assert.equal(resolved.projectRoot, canonical, 'junction resolves to the real directory')
  const status = await dispatchLocalApi(resolved, 'GET', ['status'], new URLSearchParams(), async () => ({}), {})
  assert.equal(status.json.projectRoot, canonical, 'the client builds media URLs from this root')
  const media = await dispatchLocalApi(resolved, 'GET',
    ['workspace-media', 'projects', 'demo', 'clip.mp4'], new URLSearchParams(), async () => ({}), {})
  assert.equal(media.file, join(canonical, 'projects', 'demo', 'clip.mp4'),
    'the host serves the same canonical path the client derived')
  if (process.platform === 'win32') rmdirSync(alias)
  else unlinkSync(alias)
})

test('route registry: feature plugins extend the table and withdraw it on unmount', async () => {
  const registry = createRouteRegistry(settings)
  assert.equal(await dispatchLocalApi(settings, 'GET', ['accounts'], new URLSearchParams(), async () => ({}), {}, registry.snapshot()), null,
    'feature routes stay off until their plugin mounts')
  const withdrawAutomation = registry.register(AUTOMATION_ROUTES)
  const withdrawDeconstruct = registry.register(DECONSTRUCT_ROUTES)
  assert.ok(await dispatchLocalApi(settings, 'GET', ['accounts'], new URLSearchParams(), async () => ({}), {}, registry.snapshot()),
    'automation routes join the table')
  assert.ok(await dispatchLocalApi(settings, 'POST', ['deconstruct', 'preflight'], new URLSearchParams(), async () => ({ url: 'https://www.douyin.com/video/1' }), {}, registry.snapshot()),
    'deconstruct routes join the table')
  withdrawAutomation()
  assert.equal(await dispatchLocalApi(settings, 'GET', ['accounts'], new URLSearchParams(), async () => ({}), {}, registry.snapshot()), null,
    'unmounting one plugin removes only its routes')
  assert.ok(await dispatchLocalApi(settings, 'POST', ['deconstruct', 'preflight'], new URLSearchParams(), async () => ({ url: 'https://www.douyin.com/video/1' }), {}, registry.snapshot()),
    'the other plugin keeps its routes')
  withdrawDeconstruct()
})

test('cleanup', () => {
  rmSync(root, { recursive: true, force: true })
})
