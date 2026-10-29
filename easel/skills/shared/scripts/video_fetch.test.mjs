// video_fetch.test.mjs — 纯函数单测 + --selftest 冒烟（node --test）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitUrls, detectPlatform, cookiesFile, parseHttpUrl, fetchFollowing, isPrivateAddress, parseApolloState, pickStagedChannelsFile } from './video_fetch.mjs'
import { createServer } from 'node:http'

const HERE = dirname(fileURLToPath(import.meta.url))

test('splitUrls extracts links from noisy share text and strips tail punctuation', () => {
  const share = '7.43 pQA:/ 复制打开抖音，看看【xxx的作品】真香！ https://v.douyin.com/iRNBho6/ 😄'
  assert.deepEqual(splitUrls(share), ['https://v.douyin.com/iRNBho6/'])
  assert.deepEqual(splitUrls('看这个 https://xhslink.com/a2bC，快看'), ['https://xhslink.com/a2bC'])
  assert.deepEqual(splitUrls('没有链接'), [])
})

test('detectPlatform routes douyin/xhs/kuaishou and everything else to generic', () => {
  assert.equal(detectPlatform('https://v.douyin.com/iRNBho6/'), 'douyin')
  assert.equal(detectPlatform('https://www.iesdouyin.com/share/video/123'), 'douyin')
  assert.equal(detectPlatform('http://xhslink.com/a2bC，快看'), 'xhs')
  assert.equal(detectPlatform('https://v.kuaishou.com/GH7abcD'), 'kuaishou')
  assert.equal(detectPlatform('https://www.kuaishou.com/short-video/3xkpubc9def'), 'kuaishou')
  assert.equal(detectPlatform('https://kuaishou.cn/short-video/3xkpubc9def'), 'kuaishou')
  assert.equal(detectPlatform('https://www.chenzhongtech.com/fw/photo/3xkpubc9def'), 'kuaishou')
  assert.equal(detectPlatform('https://channels.weixin.qq.com/web/pages/feed?profile=1'), 'sph')
  assert.equal(detectPlatform('https://www.bilibili.com/video/BV1GJ411x7h7/'), 'generic')
})

test('the weixin platform match is scoped to the channels subdomain', () => {
  assert.equal(detectPlatform('https://mp.weixin.qq.com/s/abc123'), 'generic')
  assert.equal(detectPlatform('https://evil-channels.weixin.qq.com.evil.example/feed'), 'generic')
})

test('the platform decision reads the parsed host, not the share text', () => {
  // The payload from audit run-1: the substring matched, the request host did not.
  assert.equal(detectPlatform('https://attacker.example?xiaohongshu.com'), 'generic')
  assert.equal(detectPlatform('https://evil-xiaohongshu.com/note'), 'generic')
  assert.equal(detectPlatform('https://xiaohongshu.com.evil.example/'), 'generic')
  assert.equal(detectPlatform('https://evil-kuaishou.com/short-video/1'), 'generic')
  assert.equal(detectPlatform('https://kuaishou.com.evil.example/short-video/1'), 'generic')
  assert.equal(detectPlatform('https://attacker.example?kuaishou.com'), 'generic')
  assert.equal(detectPlatform('javascript:alert(1)'), 'generic')
  assert.equal(detectPlatform('file:///etc/passwd'), 'generic')
})

test('parseApolloState extracts the photo detail and author from a detail page', () => {
  const photoId = '3xkpubc9def'
  const page = `<!doctype html><html><body><script>window.__APOLLO_STATE__=${JSON.stringify({
    defaultClient: {
      [`VisionVideoDetailPhoto:${photoId}`]: {
        __typename: 'VisionVideoDetailPhoto', id: photoId, photoUrl: 'https://public.example/video.mp4',
        caption: '真香现场', duration: 98500, viewCount: 12345,
      },
      'VisionVideoDetailAuthor:eid9': { __typename: 'VisionVideoDetailAuthor', id: 'eid9', name: '老王' },
    },
  })};(function(){var s;(s=document.currentScript||document.scripts[document.scripts.length-1]).parentNode.removeChild(s);}());</script></body></html>`
  const client = parseApolloState(page).defaultClient
  const photo = client[`VisionVideoDetailPhoto:${photoId}`]
  assert.equal(photo.photoUrl, 'https://public.example/video.mp4')
  assert.equal(photo.caption, '真香现场')
  assert.equal(photo.duration, 98500)
  const author = Object.entries(client).find(([key]) => key.startsWith('VisionVideoDetailAuthor:'))?.[1]
  assert.equal(author.name, '老王')
})

test('parseApolloState tolerates missing or corrupted payloads', () => {
  assert.equal(parseApolloState('<html><body>风控页，没有脚本</body></html>'), null)
  assert.equal(parseApolloState('<script>window.__APOLLO_STATE__={"defaultClient":broken</script>'), null)
  assert.equal(parseApolloState('<script>window.__APOLLO_STATE__=null;</script>'), null)
  assert.equal(parseApolloState('<script>window.__APOLLO_STATE__=123;</script>'), null)
})

test('parseHttpUrl refuses non-http(s) and credentialed links', () => {
  assert.equal(parseHttpUrl('https://www.xiaohongshu.com/explore/abc').hostname, 'www.xiaohongshu.com')
  assert.throws(() => parseHttpUrl('file:///etc/passwd'), /http/)
  assert.throws(() => parseHttpUrl('javascript:alert(1)'), /http/)
  assert.throws(() => parseHttpUrl('https://user:pass@example.com/'), /用户名\/密码/)
  assert.throws(() => parseHttpUrl('not a url'), /不是合法链接/)
})

test('cookiesFile maps dict/string values and tolerates missing file', async () => {
  assert.deepEqual(Object.keys(await cookiesFile('nonexistent-dir-x')), [])
  const dir = mkdtempSync(join(tmpdir(), 'vf-test-'))
  try {
    writeFileSync(join(dir, 'cookies.json'), JSON.stringify({
      xhs: 'a=1; b=2',
      douyin: { k: 'v', k2: 'v2' },
      empty: '   ',
    }))
    const cookies = await cookiesFile(join(dir, 'batch'))
    assert.equal(cookies.xhs, 'a=1; b=2')
    assert.equal(cookies.douyin, 'k=v; k2=v2')
    assert.ok(!('empty' in cookies))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('isPrivateAddress refuses loopback/private in every spelling', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '169.254.169.254', '0.0.0.0', '::1', '::']) {
    assert.equal(isPrivateAddress(address), true, address)
  }
  // WHATWG normalizes [::ffff:127.0.0.1] to this hex form.
  assert.equal(isPrivateAddress('::ffff:7f00:1'), true)
  assert.equal(isPrivateAddress('::ffff:127.0.0.1'), true)
  assert.equal(isPrivateAddress('::ffff:808:808'), false, 'the mapped public form stays allowed')
  for (const address of ['fd12::1', 'fe80::1', 'fec0::1', 'fed0::1', '2002:c000:204::1', '64:ff9b::7f00:1', '2001:0:1::1']) {
    assert.equal(isPrivateAddress(address), true, address)
  }
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false)
  assert.equal(isPrivateAddress('8.8.8.8'), false)
})

test('--selftest passes', () => {
  const proc = spawnSync(process.execPath, [join(HERE, 'video_fetch.mjs'), '--selftest'],
    { encoding: 'utf8', windowsHide: true })
  assert.equal(proc.status, 0, proc.stderr)
  assert.match(proc.stdout, /selftest ok/)
})

/** Start one loopback server on an ephemeral port; resolves with {port, close, seen}. */
async function serve(handler) {
  const seen = []
  const server = createServer((req, res) => {
    seen.push({ url: req.url, cookie: req.headers.cookie ?? null })
    handler(req, res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    port: server.address().port,
    seen,
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

test('fetchFollowing attaches the cookie only on allowed hosts, across redirect hops', async () => {
  const outside = await serve((req, res) => res.end('outside'))
  const inside = await serve((req, res) => {
    if (req.url === '/jump') {
      // A different hostname on the same machine: the cookie must not follow.
      res.writeHead(302, { location: `http://localhost:${outside.port}/` })
      res.end()
      return
    }
    res.end('inside')
  })
  try {
    const cookie = { value: 'session=DUMMY', hosts: ['127.0.0.1'] }
    const [firstUrl, firstBody] = await fetchFollowing(`http://127.0.0.1:${inside.port}/ok`, { cookie })
    assert.equal(firstUrl, `http://127.0.0.1:${inside.port}/ok`)
    assert.equal(firstBody, 'inside')
    assert.equal(inside.seen[0].cookie, 'session=DUMMY')

    const [, finalBody] = await fetchFollowing(`http://127.0.0.1:${inside.port}/jump`, { cookie })
    assert.equal(finalBody, 'outside')
    assert.equal(inside.seen[1].cookie, 'session=DUMMY', 'the platform hop carries the cookie')
    assert.equal(outside.seen[0].cookie ?? null, null, 'the foreign hop must not')

    await assert.rejects(
      fetchFollowing(`http://127.0.0.1:${inside.port}/jump`, { cookie, allowHosts: ['127.0.0.1'] }),
      /跳出了平台域/,
    )
  } finally {
    await inside.close()
    await outside.close()
  }
})

test('pickStagedChannelsFile takes the newest wxdl_ video newer than since', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vf-sph-'))
  try {
    const now = Date.now()
    // 本机 Node v24 的 utimesSync 毫秒数字 EINVAL，只认 Date/秒——统一 Date 形态。
    writeFileSync(join(dir, 'wxdl_旧视频_1080P.mp4'), 'old')
    utimesSync(join(dir, 'wxdl_旧视频_1080P.mp4'), new Date(now - 60_000), new Date(now - 60_000))
    writeFileSync(join(dir, '别人的文件.mp4'), 'not-the-downloaders')
    writeFileSync(join(dir, 'wxdl_真香现场_720P.mp4'), 'new-720')
    utimesSync(join(dir, 'wxdl_真香现场_720P.mp4'), new Date(now - 5_000), new Date(now - 5_000))
    writeFileSync(join(dir, 'wxdl_更新的视频_1080P.mp4'), 'new-1080')
    utimesSync(join(dir, 'wxdl_更新的视频_1080P.mp4'), new Date(now - 1_000), new Date(now - 1_000))

    const hit = await pickStagedChannelsFile(dir, now)
    assert.equal(hit.name, 'wxdl_更新的视频_1080P.mp4')
    assert.equal(hit.size, 8, 'size rides along for the stability recheck')
    // 旧下载与下载器之外的视频文件都不拾取。
    assert.equal(await pickStagedChannelsFile(dir, now + 30_000), null)
    assert.equal(await pickStagedChannelsFile(join(dir, 'missing-dir'), now), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('sph link picks up a staged downloader file end to end', () => {
  const staging = mkdtempSync(join(tmpdir(), 'vf-sph-stage-'))
  const batch = mkdtempSync(join(tmpdir(), 'vf-sph-batch-'))
  try {
    writeFileSync(join(staging, 'wxdl_真香现场_1080P.mp4'), 'fake-video-bytes')
    const proc = spawnSync(process.execPath, [join(HERE, 'video_fetch.mjs'), batch,
      '看这个视频 https://channels.weixin.qq.com/web/pages/feed?profile=1'], {
      encoding: 'utf8', windowsHide: true,
      env: { ...process.env, EASEL_CHANNELS_DIR: staging, EASEL_CHANNELS_WAIT: '5' },
    })
    assert.equal(proc.status, 0, proc.stderr)
    const meta = JSON.parse(proc.stdout.trim().split('\n').pop())
    assert.equal(meta.platform, 'sph')
    assert.equal(meta.title, '真香现场')
    assert.match(meta.file, /video\.mp4$/)
    assert.equal(readFileSync(join(batch, 'video.mp4'), 'utf8'), 'fake-video-bytes')
    // 复制而非移动：staging 原件保留。
    assert.equal(readFileSync(join(staging, 'wxdl_真香现场_1080P.mp4'), 'utf8'), 'fake-video-bytes')
  } finally {
    rmSync(staging, { recursive: true, force: true })
    rmSync(batch, { recursive: true, force: true })
  }
})

test('sph link fails with exit 2 when nothing new lands within the wait window', () => {
  const staging = mkdtempSync(join(tmpdir(), 'vf-sph-timeout-'))
  const batch = mkdtempSync(join(tmpdir(), 'vf-sph-batch2-'))
  try {
    writeFileSync(join(staging, 'wxdl_陈年旧视频.mp4'), 'stale')
    utimesSync(join(staging, 'wxdl_陈年旧视频.mp4'), new Date(Date.now() - 60_000), new Date(Date.now() - 60_000))
    const proc = spawnSync(process.execPath, [join(HERE, 'video_fetch.mjs'), batch,
      'https://channels.weixin.qq.com/web/pages/feed?profile=1'], {
      encoding: 'utf8', windowsHide: true, timeout: 30_000,
      env: { ...process.env, EASEL_CHANNELS_DIR: staging, EASEL_CHANNELS_WAIT: '1' },
    })
    assert.equal(proc.status, 2, proc.stdout)
    assert.match(proc.stderr, /等待超时/)
    assert.match(proc.stderr, /wxdl_/)
  } finally {
    rmSync(staging, { recursive: true, force: true })
    rmSync(batch, { recursive: true, force: true })
  }
})
