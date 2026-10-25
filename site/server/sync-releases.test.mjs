import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  buildDownloadsJson,
  buildLatestJson,
  compareVersions,
  mapAssets,
  mirrorRelease,
  selectPublishedRelease,
} from './sync-releases.mjs'

const ORIGIN = 'https://easel.test/'
const SIGNATURE = 'untrusted comment: easel\nRWQtestSignature==\n'
const X64_BYTES = Buffer.from('x64-installer-bytes')
const ARM64_BYTES = Buffer.from('arm64-installer-bytes')

function makeRelease(version = '0.2.1-alpha.32', { arm64 = true, sig = SIGNATURE } = {}) {
  const assets = [
    {
      name: `Easel-dsh_${version}_x64-setup.exe`,
      browser_download_url: `https://example.test/${version}/x64.exe`,
      size: X64_BYTES.length,
    },
    {
      name: `Easel-dsh_${version}_x64-setup.exe.sig`,
      browser_download_url: `https://example.test/${version}/x64.exe.sig`,
      size: SIGNATURE.length,
    },
  ]
  if (arm64) {
    assets.push(
      {
        name: `Easel-dsh_${version}_arm64-setup.exe`,
        browser_download_url: `https://example.test/${version}/arm64.exe`,
        size: ARM64_BYTES.length,
      },
      {
        name: `Easel-dsh_${version}_arm64-setup.exe.sig`,
        browser_download_url: `https://example.test/${version}/arm64.exe.sig`,
        size: SIGNATURE.length,
      },
    )
  }
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: false,
    body: '本次发布说明。',
    published_at: '2026-10-24T15:20:00Z',
    assets,
    sigContent: sig,
  }
}

function fakeFetch(bodies) {
  const calls = []
  const fetchAsset = async (url) => {
    calls.push(url)
    const body = bodies[url]
    if (body === undefined) throw new Error(`未预期的下载地址：${url}`)
    if (body instanceof Error) throw body
    return Buffer.from(body)
  }
  return { fetchAsset, calls }
}

function bodiesFor(release) {
  const version = release.tag_name.slice(1)
  return {
    [`https://example.test/${version}/x64.exe`]: X64_BYTES,
    [`https://example.test/${version}/x64.exe.sig`]: release.sigContent,
    [`https://example.test/${version}/arm64.exe`]: ARM64_BYTES,
    [`https://example.test/${version}/arm64.exe.sig`]: release.sigContent,
  }
}

async function webroot() {
  return mkdtemp(join(tmpdir(), 'easel-sync-'))
}

test('compares semver versions per rule 11', () => {
  assert.equal(compareVersions('0.2.1-alpha.31', '0.2.1-alpha.29'), 1)
  assert.equal(compareVersions('0.2.1-alpha.2', '0.2.1-alpha.10'), -1)
  assert.equal(compareVersions('0.2.1', '0.2.1-alpha.99'), 1)
  assert.equal(compareVersions('0.2.1-alpha', '0.2.1-alpha.1'), -1)
  assert.equal(compareVersions('0.2.2', '0.2.1'), 1)
  assert.equal(compareVersions('1.0.0-alpha.beta', '1.0.0-alpha.1'), 1)
  assert.equal(compareVersions('0.2.1-alpha.31', '0.2.1-alpha.31'), 0)
  assert.throws(() => compareVersions('next', '0.2.1'), /无法比较/)
})

test('selects the highest published release regardless of list order', () => {
  const older = makeRelease('0.2.1-alpha.30')
  const newer = makeRelease('0.2.1-alpha.32')
  const draft = { ...makeRelease('0.2.1-alpha.33'), draft: true }
  const pre = { ...makeRelease('0.2.1-alpha.34'), prerelease: true }
  assert.equal(selectPublishedRelease([older, draft, pre, newer]).tag_name, 'v0.2.1-alpha.32')
  assert.equal(selectPublishedRelease([draft, pre]), undefined)
  assert.throws(() => selectPublishedRelease({}), /不是数组/)
})

test('maps release assets and rejects incomplete platforms', () => {
  const release = makeRelease()
  const plan = mapAssets(release)
  assert.equal(plan.version, '0.2.1-alpha.32')
  assert.equal(plan.notes, '本次发布说明。')
  assert.equal(plan.pubDate, '2026-10-24T15:20:00Z')
  assert.deepEqual(Object.keys(plan.platforms), ['windows-x86_64', 'windows-aarch64'])
  assert.equal(plan.platforms['windows-x86_64'].exe.name, 'Easel-dsh_0.2.1-alpha.32_x64-setup.exe')

  const incomplete = makeRelease()
  incomplete.assets = incomplete.assets.filter((asset) => !asset.name.endsWith('arm64-setup.exe.sig'))
  assert.throws(() => mapAssets(incomplete), /arm64 安装包缺少签名文件/)

  const empty = { ...makeRelease(), assets: [] }
  assert.throws(() => mapAssets(empty), /没有任何 Windows 安装包/)

  const badTag = { ...makeRelease(), tag_name: 'nightly' }
  assert.throws(() => mapAssets(badTag), /无法识别的 release tag/)

  const traversal = makeRelease()
  traversal.assets[0].name = '.._x64-setup.exe'
  traversal.assets[0].browser_download_url = 'https://example.test/x64.exe'
  assert.throws(() => mapAssets(traversal), /不可用的资产名/)
})

test('mirrors a release, writes both pointers, and keeps the signature', async () => {
  const root = await webroot()
  try {
    const release = makeRelease()
    const { fetchAsset, calls } = fakeFetch(bodiesFor(release))
    const outcome = await mirrorRelease({
      release,
      webroot: root,
      origin: ORIGIN,
      fetchAsset,
      retryDelayMs: 0,
      log: () => {},
    })
    assert.equal(outcome.status, 'updated')
    assert.equal(outcome.version, '0.2.1-alpha.32')
    assert.equal(calls.length, 4)

    const latest = JSON.parse(await readFile(join(root, 'updates', 'latest.json'), 'utf8'))
    assert.equal(latest.version, '0.2.1-alpha.32')
    assert.equal(latest.notes, '本次发布说明。')
    assert.equal(latest.pub_date, '2026-10-24T15:20:00Z')
    assert.equal(latest.platforms['windows-x86_64'].signature, SIGNATURE.trim())
    assert.equal(
      latest.platforms['windows-x86_64'].url,
      'https://easel.test/releases/0.2.1-alpha.32/Easel-dsh_0.2.1-alpha.32_x64-setup.exe',
    )
    assert.ok(latest.platforms['windows-aarch64'].url.endsWith('_arm64-setup.exe'))

    const downloads = JSON.parse(await readFile(join(root, 'updates', 'downloads.json'), 'utf8'))
    assert.equal(downloads.version, '0.2.1-alpha.32')
    assert.equal(downloads.files['windows-x86_64'].sha256, createHash('sha256').update(X64_BYTES).digest('hex'))
    assert.equal(downloads.files['windows-x86_64'].size, X64_BYTES.length)

    const exePath = join(root, 'releases', '0.2.1-alpha.32', 'Easel-dsh_0.2.1-alpha.32_x64-setup.exe')
    assert.deepEqual(await readFile(exePath), X64_BYTES)
    assert.ok(existsSync(join(root, 'releases', '0.2.1-alpha.32', 'Easel-dsh_0.2.1-alpha.32_x64-setup.exe.sig')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a failed download never moves the pointer', async () => {
  const root = await webroot()
  try {
    await mkdir(join(root, 'updates'), { recursive: true })
    const oldPointer = '{\n  "version": "0.2.1-alpha.31"\n}\n'
    await writeFile(join(root, 'updates', 'latest.json'), oldPointer)
    const release = makeRelease()
    const bodies = bodiesFor(release)
    bodies[`https://example.test/0.2.1-alpha.32/arm64.exe`] = new Error('network down')
    const { fetchAsset, calls } = fakeFetch(bodies)
    await assert.rejects(
      mirrorRelease({ release, webroot: root, origin: ORIGIN, fetchAsset, retryDelayMs: 0, log: () => {} }),
      /network down/,
    )
    assert.equal(await readFile(join(root, 'updates', 'latest.json'), 'utf8'), oldPointer)
    assert.equal(existsSync(join(root, 'updates', 'downloads.json')), false)
    // x64 (2) plus three attempts at the failing arm64 installer.
    assert.equal(calls.length, 2 + 3)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('never downgrades below the current pointer', async () => {
  const root = await webroot()
  try {
    await mkdir(join(root, 'updates'), { recursive: true })
    await writeFile(join(root, 'updates', 'latest.json'), JSON.stringify({ version: '0.2.1-alpha.32' }))
    const { fetchAsset, calls } = fakeFetch({})
    const outcome = await mirrorRelease({
      release: makeRelease('0.2.1-alpha.31'),
      webroot: root,
      origin: ORIGIN,
      fetchAsset,
      retryDelayMs: 0,
      log: () => {},
    })
    assert.equal(outcome.status, 'current')
    assert.equal(outcome.version, '0.2.1-alpha.32')
    assert.equal(calls.length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rebuilds a corrupt pointer instead of failing forever', async () => {
  const root = await webroot()
  try {
    await mkdir(join(root, 'updates'), { recursive: true })
    await writeFile(join(root, 'updates', 'latest.json'), '{ broken json')
    const logs = []
    const outcome = await mirrorRelease({
      release: makeRelease(),
      webroot: root,
      origin: ORIGIN,
      fetchAsset: fakeFetch(bodiesFor(makeRelease())).fetchAsset,
      retryDelayMs: 0,
      log: (line) => logs.push(line),
    })
    assert.equal(outcome.status, 'updated')
    assert.ok(logs.some((line) => line.includes('无法解析')))
    const latest = JSON.parse(await readFile(join(root, 'updates', 'latest.json'), 'utf8'))
    assert.equal(latest.version, '0.2.1-alpha.32')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an empty signature is rejected before the pointer moves', async () => {
  const root = await webroot()
  try {
    const release = makeRelease('0.2.1-alpha.32', { sig: '\n' })
    const bodies = bodiesFor(release)
    await assert.rejects(
      mirrorRelease({ release, webroot: root, origin: ORIGIN, fetchAsset: fakeFetch(bodies).fetchAsset, retryDelayMs: 0, log: () => {} }),
      /签名文件为空/,
    )
    assert.equal(existsSync(join(root, 'updates', 'latest.json')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('prunes old version directories beyond the keep window', async () => {
  const root = await webroot()
  try {
    for (const version of ['0.2.1-alpha.1', '0.2.1-alpha.2', '0.2.1-alpha.3']) {
      await mkdir(join(root, 'releases', version), { recursive: true })
    }
    const release = makeRelease()
    await mirrorRelease({
      release,
      webroot: root,
      origin: ORIGIN,
      fetchAsset: fakeFetch(bodiesFor(release)).fetchAsset,
      keepVersions: 2,
      retryDelayMs: 0,
      log: () => {},
    })
    assert.ok(existsSync(join(root, 'releases', '0.2.1-alpha.32')))
    assert.ok(existsSync(join(root, 'releases', '0.2.1-alpha.3')))
    assert.equal(existsSync(join(root, 'releases', '0.2.1-alpha.2')), false)
    assert.equal(existsSync(join(root, 'releases', '0.2.1-alpha.1')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('builds updater and download payloads from mirrored files', () => {
  const platforms = {
    'windows-x86_64': { name: 'a.exe', signature: 'sig', sha256: 'c'.repeat(64), size: 7 },
  }
  const latest = buildLatestJson({ version: '0.2.1-alpha.32', notes: 'n', pubDate: 'd', origin: ORIGIN, platforms })
  assert.equal(latest.platforms['windows-x86_64'].url, 'https://easel.test/releases/0.2.1-alpha.32/a.exe')
  const downloads = buildDownloadsJson({ version: '0.2.1-alpha.32', pubDate: 'd', platforms })
  assert.deepEqual(downloads.files['windows-x86_64'], { name: 'a.exe', sha256: 'c'.repeat(64), size: 7 })
})
