import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  articleFileName, assertPublicHttpUrl, composeArticleMarkdown, createCaptureHandler,
  decodeEntities, extractArticle, isPrivateAddress, looksLikeLoginWall, upsertIdeaEntry,
} from '../lib/trends-article.js'

const PAGE = `<!doctype html><html><head><title>站点标题 - 新闻</title>
<meta property="og:title" content="神舟二十号发射成功"/><meta name="description" content="一段描述"/></head>
<body><nav>导航 导航</nav><script>var evil=1;</script><article>
<h2>标题</h2><p>神舟二十号载人飞船发射取得圆满成功，飞船准确进入预定轨道，航天员乘组状态良好，发射取得圆满成功。</p>
<p>此次任务是我国载人航天工程今年的第三次发射，空间站组合体运行稳定，各项在轨试验按计划开展，后续将与空间站组合体完成自主快速交会对接，进一步验证相关关键技术。</p>
<p>长征系列运载火箭再度传来发射圆满成功的消息，工程各系统状态良好，测控通信、着陆场等系统已做好后续各项准备工作，欢迎航天员乘组平安返回地球家园。</p>
<p>据介绍，飞船入轨后将于地面进行多次变轨机动，期间各分系统参数正常，航天员乘组将按计划开展人机 共同在轨验证等相关工作，为后续任务积累宝贵经验与数据支撑。</p>
</article><footer>版权</footer></body></html>`

const SHORT_PAGE = '<html><head><title>快讯</title></head><body><p>很短的一条快讯。</p></body></html>'
const LOGIN_PAGE = '<html><head><title>扫码登录</title></head><body><p>请登录后查看全文，验证码登录更快捷。</p></body></html>'

const okFetch = (body = PAGE, contentType = 'text/html; charset=utf-8') =>
  async () => ({ status: 200, headers: { 'content-type': contentType }, body: Buffer.from(body) })

const okLookup = async () => [{ address: '93.184.216.34', family: 4 }]

function makeIo(root) {
  return {
    writes: [],
    async writeText(path, content) {
      this.writes.push({ path, content })
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content, 'utf8')
    },
    ideas: [],
    async readIdeas() { return this.ideas },
    async mutateIdeas(_settings, mutator) {
      const { items, idea, reused } = mutator(this.ideas)
      this.ideas = items
      return { idea, reused }
    },
    async proxyUrl() { return '' },
    root,
  }
}

function settingsFor(root) {
  return { projectRoot: root }
}

test('assertPublicHttpUrl: refuses non-http(s), credentials, loopback and private hosts', () => {
  assert.equal(assertPublicHttpUrl('https://news.example.com/a?b=1').hostname, 'news.example.com')
  for (const bad of [
    'ftp://x.com/a', 'https://u:p@example.com/', 'http://localhost/a', 'http://web.local/',
    'http://127.0.0.1:8080/', 'http://192.168.1.2/', 'http://10.0.0.1/', 'http://169.254.1.1/',
    'http://[::1]/', 'http://[fe80::1]/', 'not a url',
  ]) {
    assert.throws(() => assertPublicHttpUrl(bad), error => error.status === 400, bad)
  }
})

test('isPrivateAddress covers IPv4-mapped and ULA ranges', () => {
  assert.equal(isPrivateAddress('::ffff:192.168.0.1'), true)
  assert.equal(isPrivateAddress('fd00::1'), true)
  assert.equal(isPrivateAddress('100.64.0.1'), true)
  assert.equal(isPrivateAddress('100.128.0.1'), false)
  assert.equal(isPrivateAddress('93.184.216.34'), false)
  assert.equal(isPrivateAddress('2606:2800:220:1:248:1893:25c8:1946'), false)
})

test('extractArticle: prefers article, drops chrome, reads og meta, falls back to whole page', () => {
  const { title, description, text } = extractArticle(PAGE)
  assert.equal(title, '神舟二十号发射成功')
  assert.equal(description, '一段描述')
  assert.match(text, /神舟二十号载人飞船发射取得圆满成功/)
  assert.doesNotMatch(text, /导航|evil|版权/)

  const fallback = extractArticle(SHORT_PAGE)
  assert.equal(fallback.title, '快讯')
  assert.match(fallback.text, /很短的一条快讯/)
})

test('extractArticle handles entities and numeric character references', () => {
  assert.equal(decodeEntities('A &amp; B &#x4e2d; &#22269; &lt;tag&gt;'), 'A & B 中 国 <tag>')
  assert.equal(decodeEntities('&nbsp;').replace(/\s/g, '·'), '·', 'nbsp decodes to a space')
})

test('looksLikeLoginWall gates on both keywords and length', () => {
  assert.equal(looksLikeLoginWall('扫码登录', '请登录后查看全文，验证码登录更快捷。'), true)
  assert.equal(looksLikeLoginWall('正常文章', '一篇很长很长的正文'.repeat(50)), false)
})

test('articleFileName: stable per URL, sanitized, distinct per distinct URL', () => {
  const name = articleFileName('苹果发布会/定了：特别*好', 'https://x.com/a')
  assert.match(name, /^苹果发布会.+-[0-9a-f]{8}\.md$/)
  assert.equal(name, articleFileName(' 苹果发布会/定了：特别*好 ', 'https://x.com/a'))
  assert.notEqual(name, articleFileName('苹果发布会定了特别好', 'https://x.com/b'))
})

test('composeArticleMarkdown uses blockquote header, not frontmatter', () => {
  const md = composeArticleMarkdown({
    title: 'T', source: '微博热搜', rank: 3, hot: '123万', url: 'https://x.com/1',
    fetchedAt: new Date('2026-10-23T04:34:00Z'), body: '正文',
  })
  assert.match(md, /^# T\n/)
  assert.match(md, /> 来源：微博热搜 · 第 3 名 · 热度 123万/)
  assert.match(md, /> 原文：https:\/\/x\.com\/1/)
  assert.match(md, /> 抓取：/)
  assert.ok(!md.startsWith('---'))
})

test('upsertIdeaEntry: creates, then reuses by url without clobbering user edits', () => {
  const entry = { id: 'aa', title: 'T', note: '摘要', source: '微博热搜', url: 'https://x.com/1', bodyPath: '热点正文/t-11111111.md', created: 1 }
  const first = upsertIdeaEntry([], entry)
  assert.equal(first.reused, false)
  assert.equal(first.items.length, 1)

  first.items[0].title = '用户改的标题'
  first.items[0].note = '用户备注'
  first.items[0].status = 'doing'
  const second = upsertIdeaEntry(first.items, { ...entry, title: '新标题', note: '新摘要', bodyPath: '热点正文/t-11111111.md' })
  assert.equal(second.reused, true)
  assert.equal(second.items.length, 1)
  assert.equal(second.idea.title, '用户改的标题')
  assert.equal(second.idea.note, '用户备注')
  assert.equal(second.idea.status, 'doing')

  const noNote = upsertIdeaEntry([{ id: 'bb', title: 'X', note: '', source: '', status: 'pending', created: 1, url: 'https://x.com/1' }],
    { ...entry, note: '自动摘要' })
  assert.equal(noNote.idea.note, '自动摘要', 'empty note gets filled')
})

test('capture handler: happy path writes body file and creates the idea', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-capture-'))
  mkdirSync(join(root, 'outputs'), { recursive: true })
  const io = makeIo(root)
  const handler = createCaptureHandler({ fetchPage: okFetch(), lookupHost: okLookup, io })
  const res = await handler({ settings: settingsFor(root), body: async () => (
    { title: '神舟二十号发射成功', url: 'https://news.example.com/a', source: '微博热搜', rank: 2, hot: '100万' }
  ) })
  assert.equal(res.json.ok, true)
  assert.equal(res.json.warning, undefined)
  assert.match(res.json.bodyPath, /^热点正文\/神舟二十号发射成功-[0-9a-f]{8}\.md$/)
  assert.ok(res.json.chars > 200)
  const written = readFileSync(join(root, 'outputs', ...res.json.bodyPath.split('/')), 'utf8')
  assert.match(written, /> 来源：微博热搜 · 第 2 名 · 热度 100万/)
  assert.match(written, /神舟二十号载人飞船发射取得圆满成功/)
  assert.equal(io.ideas[0].url, 'https://news.example.com/a')
  assert.equal(io.ideas[0].bodyPath, res.json.bodyPath)
  assert.equal(io.ideas[0].source, '微博热搜')
  rmSync(root, { recursive: true, force: true })
})

test('capture handler: re-capture reuses the idea and rewrites the file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-capture-'))
  mkdirSync(join(root, 'outputs'), { recursive: true })
  const io = makeIo(root)
  const handler = createCaptureHandler({ fetchPage: okFetch(), lookupHost: okLookup, io })
  const payload = { title: '神舟二十号发射成功', url: 'https://news.example.com/a', source: '微博热搜' }
  const first = await handler({ settings: settingsFor(root), body: async () => payload })
  const second = await handler({ settings: settingsFor(root), body: async () => payload })
  assert.equal(second.json.reused, true)
  assert.equal(io.ideas.length, 1)
  const files = readdirSync(join(root, 'outputs', '热点正文'))
  assert.equal(files.length, 1, 'same URL rewrites the same file')
  assert.ok(first.json.bodyPath.startsWith('热点正文/'))
  rmSync(root, { recursive: true, force: true })
})

test('capture handler: login wall keeps the idea but writes no fake body', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-capture-'))
  mkdirSync(join(root, 'outputs'), { recursive: true })
  const io = makeIo(root)
  const handler = createCaptureHandler({ fetchPage: okFetch(LOGIN_PAGE), lookupHost: okLookup, io })
  const res = await handler({ settings: settingsFor(root), body: async () => (
    { title: '某新闻', url: 'https://news.example.com/paywall', source: '微博热搜' }
  ) })
  assert.equal(res.json.warning, '需登录')
  assert.equal(res.json.bodyPath, undefined)
  assert.equal(io.ideas.length, 1)
  assert.equal(io.ideas[0].url, 'https://news.example.com/paywall')
  rmSync(root, { recursive: true, force: true })
})

test('capture handler: same URL with a changed title reuses the existing body file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'easel-capture-'))
  mkdirSync(join(root, 'outputs'), { recursive: true })
  const io = makeIo(root)
  const handler = createCaptureHandler({ fetchPage: okFetch(), lookupHost: okLookup, io })
  await handler({ settings: settingsFor(root), body: async () => (
    { title: '原标题', url: 'https://news.example.com/a', source: '微博热搜' }
  ) })
  const second = await handler({ settings: settingsFor(root), body: async () => (
    { title: '换成完全不同的标题', url: 'https://news.example.com/a', source: '微博热搜' }
  ) })
  assert.equal(io.ideas.length, 1, 'same URL still one idea')
  assert.equal(second.json.reused, true)
  assert.equal(second.json.idea.title, '原标题', 'user-edited title survives re-capture')
  const files = readdirSync(join(root, 'outputs', '热点正文'))
  assert.equal(files.length, 1, 'no second file for a renamed re-capture')
  assert.equal(second.json.bodyPath, io.ideas[0].bodyPath)
  rmSync(root, { recursive: true, force: true })
})

test('capture handler: http failure degrades to title+link with a warning', async () => {
  const io = makeIo(mkdtempSync(join(tmpdir(), 'easel-capture-')))
  const handler = createCaptureHandler({
    fetchPage: async () => ({ status: 403, headers: {}, body: Buffer.alloc(0) }),
    lookupHost: okLookup, io,
  })
  const res = await handler({ settings: settingsFor(io.root), body: async () => (
    { title: '某新闻', url: 'https://news.example.com/403', source: '微博热搜' }
  ) })
  assert.equal(res.json.warning, '上游返回 403')
  assert.equal(res.json.bodyPath, undefined)
  assert.equal(io.ideas.length, 1)
})

test('capture handler: network error and timeout both degrade', async () => {
  const io = makeIo(mkdtempSync(join(tmpdir(), 'easel-capture-')))
  const handler = createCaptureHandler({
    fetchPage: async () => { throw new Error('timeout') },
    lookupHost: okLookup, io,
  })
  const res = await handler({ settings: settingsFor(io.root), body: async () => (
    { title: '某新闻', url: 'https://news.example.com/slow', source: '微博热搜' }
  ) })
  assert.equal(res.json.warning, '抓取超时')
})

test('capture handler: private DNS answer is a 400, resolution failure degrades', async () => {
  const io = makeIo(mkdtempSync(join(tmpdir(), 'easel-capture-')))
  const handler = createCaptureHandler({
    fetchPage: okFetch(),
    lookupHost: async () => [{ address: '192.168.1.10', family: 4 }],
    io,
  })
  await assert.rejects(
    handler({ settings: settingsFor(io.root), body: async () => ({ title: 'T', url: 'https://evil.example.com/x' }) }),
    error => error.status === 400,
  )
  const failing = createCaptureHandler({
    fetchPage: okFetch(),
    lookupHost: async () => { throw Object.assign(new Error('no'), { code: 'ENOTFOUND' }) },
    io,
  })
  const res = await failing({ settings: settingsFor(io.root), body: async () => ({ title: 'T', url: 'https://gone.example.com/x' }) })
  assert.match(res.json.warning, /域名无法解析/)
})

test('capture handler: redirect hops are re-validated and followed', async () => {
  const io = makeIo(mkdtempSync(join(tmpdir(), 'easel-capture-')))
  const seen = []
  const handler = createCaptureHandler({
    fetchPage: async (url) => {
      seen.push(url)
      if (url === 'https://news.example.com/go') {
        return { status: 302, headers: { location: 'https://news.example.com/final' }, body: Buffer.alloc(0) }
      }
      return okFetch()(url)
    },
    lookupHost: okLookup, io,
  })
  const res = await handler({ settings: settingsFor(io.root), body: async () => (
    { title: '跳转文章', url: 'https://news.example.com/go', source: '微博热搜' }
  ) })
  assert.deepEqual(seen, ['https://news.example.com/go', 'https://news.example.com/final'])
  assert.match(res.json.bodyPath ?? '', /^热点正文\//, 'article captured after the redirect')

  const evil = createCaptureHandler({
    fetchPage: async () => ({ status: 302, headers: { location: 'http://127.0.0.1:9222/ok' }, body: Buffer.alloc(0) }),
    lookupHost: okLookup, io,
  })
  await assert.rejects(
    evil({ settings: settingsFor(io.root), body: async () => ({ title: 'T', url: 'https://news.example.com/evil' }) }),
    error => error.status === 400,
  )
})

test('capture handler: non-html and empty extraction degrade without a file', async () => {
  const io = makeIo(mkdtempSync(join(tmpdir(), 'easel-capture-')))
  const handler = createCaptureHandler({
    fetchPage: okFetch(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png'),
    lookupHost: okLookup, io,
  })
  const res = await handler({ settings: settingsFor(io.root), body: async () => ({ title: '图', url: 'https://x.com/p.png' }) })
  assert.equal(res.json.warning, '非 HTML 页面')

  const empty = createCaptureHandler({
    fetchPage: okFetch('<html><head></head><body><div></div></body></html>'),
    lookupHost: okLookup, io,
  })
  const res2 = await empty({ settings: settingsFor(io.root), body: async () => ({ title: '空', url: 'https://x.com/empty' }) })
  assert.equal(res2.json.warning, '未提取到正文')
})

test('capture handler: missing title is a 400', async () => {
  const io = makeIo(mkdtempSync(join(tmpdir(), 'easel-capture-')))
  const handler = createCaptureHandler({ fetchPage: okFetch(), lookupHost: okLookup, io })
  await assert.rejects(
    handler({ settings: settingsFor(io.root), body: async () => ({ url: 'https://x.com/' }) }),
    error => error.status === 400,
  )
})
