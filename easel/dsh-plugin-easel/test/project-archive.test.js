import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, truncateSync, writeFileSync,
} from 'node:fs'
import { utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Zip, ZipDeflate, unzipSync, zipSync } from 'fflate'
import {
  MANIFEST_NAME, assertSafeEntryPath, createProjectArchiveFeature, exportProjectArchive,
  importProjectArchive, isDirectProjectPath, listProjects,
} from '../lib/project-archive.js'
import {
  archivePathKey, fillArchiveText, formatArchiveBytes, isProjectDirectory,
} from '../src/lib/archive-text.js'

/** @returns {string} a fresh temp directory. */
function tempRoot() {
  return mkdtempSync(join(tmpdir(), 'easel-archive-'))
}

/** @param {string} path - directory to create. */
function mkdir(path) {
  mkdirSync(path, { recursive: true })
}

/** @param {string} path - file to write. @param {string|Buffer} content - bytes. */
function write(path, content) {
  mkdir(dirname(path))
  writeFileSync(path, content)
}

/**
 * Write a zip from a path→content map.
 * @param {string} path - output zip.
 * @param {Record<string, string|Buffer>} entries - archive entries.
 */
function writeZip(path, entries) {
  mkdir(dirname(path))
  const files = Object.fromEntries(Object.entries(entries).map(([name, content]) => [
    name, typeof content === 'string' ? Buffer.from(content) : content,
  ]))
  writeFileSync(path, Buffer.from(zipSync(files)))
}

/**
 * Write a zip preserving duplicate entry names.
 * @param {string} path - output zip.
 * @param {Array<[string, string]>} entries - ordered entries.
 */
function writeRawZip(path, entries) {
  mkdir(dirname(path))
  const chunks = []
  const zip = new Zip((error, data) => {
    if (error !== null) throw error
    chunks.push(Buffer.from(data))
  })
  for (const [name, content] of entries) {
    const deflate = new ZipDeflate(name)
    zip.add(deflate)
    deflate.push(Buffer.from(content))
    deflate.push(new Uint8Array(0), true)
  }
  zip.end()
  writeFileSync(path, Buffer.concat(chunks))
}

/** @param {string} directory - project directory with a text and a binary file. */
function seedProject(directory) {
  mkdir(join(directory, '素材'))
  mkdir(join(directory, '成品'))
  write(join(directory, '选题.md'), '# 选题\n')
  write(join(directory, '素材', 'note.txt'), 'material\n')
  write(join(directory, '成品', 'cover.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
}

/**
 * @param {{routes: Array}} feature - feature instance.
 * @param {string} method - HTTP method.
 * @param {string} path - route path.
 * @param {object} [body] - JSON body.
 * @returns {Promise<object>} route result.
 */
async function call(feature, method, path, body = {}) {
  const segments = path.split('/').filter(Boolean)
  const route = feature.routes.find(([routeMethod, pattern]) =>
    routeMethod === method && pattern.join('/') === segments.join('/'))
  assert.ok(route, `route ${method} ${path}`)
  return route[2]({
    settings: {},
    params: {},
    query: new URLSearchParams(),
    body: async () => body,
    headers: {},
  })
}

/**
 * @param {object} feature - feature instance.
 * @returns {Promise<object>} the finished job.
 */
async function waitJob(feature) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await call(feature, 'GET', 'projects/job')
    if (result.json.state === 'done' || result.json.state === 'failed') return result.json
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('archive job did not finish')
}

test('safe entry paths reject traversal, absolute, backslash, and dot segments', () => {
  assert.equal(assertSafeEntryPath('a/b.txt'), 'a/b.txt')
  assert.equal(assertSafeEntryPath('folder/'), 'folder')
  for (const hostile of ['../evil.txt', '/abs.txt', 'C:/win.txt', 'a\\b.txt', 'a//b.txt', 'a/./b.txt', 'a/../b.txt', 'a.txt:secret', '', '/']) {
    assert.throws(() => assertSafeEntryPath(hostile), /unsafe-path|不安全的路径|绝对路径|空路径/, hostile)
  }
})

test('isDirectProjectPath accepts only kids of projects/', () => {
  const root = process.platform === 'win32' ? 'C:\\data\\workspace' : '/data/workspace'
  assert.equal(isDirectProjectPath(root, join(root, 'projects', 'one')), true)
  assert.equal(isDirectProjectPath(root, join(root, 'projects')), false)
  assert.equal(isDirectProjectPath(root, join(root, 'projects', 'one', 'nested')), false)
  assert.equal(isDirectProjectPath(root, join(root, 'outputs', 'one')), false)
  assert.equal(isDirectProjectPath(root, 'relative/projects/one'), false)
})

test('case-equivalent entries are rejected where the filesystem folds case', async () => {
  const root = tempRoot()
  try {
    const archive = join(root, 'case.zip')
    writeZip(archive, { 'a.txt': 'lower', 'A.txt': 'upper' })
    const projects = join(root, 'projects')
    if (process.platform === 'win32' || process.platform === 'darwin') {
      await assert.rejects(
        importProjectArchive({ archivePath: archive, projectsDir: projects }),
        /重复路径|冲突|path-conflict/,
      )
      assert.deepEqual(readdirSync(projects), [])
    } else {
      const imported = await importProjectArchive({ archivePath: archive, projectsDir: projects })
      assert.equal(imported.files, 2)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a corrupted stored entry fails CRC verification', async () => {
  const root = tempRoot()
  try {
    const payload = Buffer.from('secret-bytes')
    const bytes = Buffer.from(zipSync({ 'a.txt': payload }, { level: 0 }))
    const position = bytes.indexOf(payload)
    assert.ok(position >= 0, 'stored payload is visible in the zip')
    bytes[position] ^= 0xFF
    const archive = join(root, 'corrupt.zip')
    writeFileSync(archive, bytes)
    await assert.rejects(
      importProjectArchive({ archivePath: archive, projectsDir: join(root, 'projects') }),
      /CRC 校验失败|invalid-archive/,
    )
    assert.deepEqual(readdirSync(join(root, 'projects')), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a truncated central directory is refused', async () => {
  const root = tempRoot()
  try {
    const archive = join(root, 'truncated.zip')
    writeZip(archive, { 'a.txt': 'a' })
    const bytes = readFileSync(archive)
    writeFileSync(archive, bytes.subarray(0, bytes.length - 22))
    await assert.rejects(
      importProjectArchive({ archivePath: archive, projectsDir: join(root, 'projects') }),
      /中央目录|invalid-archive/,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('manifest plus a matching wrapper folder unwraps without an extra level', async () => {
  const root = tempRoot()
  try {
    const archive = join(root, 'wrapped.zip')
    writeZip(archive, {
      [MANIFEST_NAME]: JSON.stringify({
        format: 'easel-project', version: 1, title: '演示项目', exportedAt: '2026-01-01T00:00:00.000Z',
      }),
      '演示项目/a.txt': 'a',
    })
    const projects = join(root, 'projects')
    const imported = await importProjectArchive({ archivePath: archive, projectsDir: projects })
    assert.equal(imported.name, '演示项目')
    assert.equal(readFileSync(join(projects, '演示项目', 'a.txt'), 'utf8'), 'a')
    assert.ok(!readdirSync(join(projects, '演示项目')).includes('演示项目'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('export counts OS junk instead of silently dropping it', async () => {
  const root = tempRoot()
  try {
    const source = join(root, 'projects', 'junk')
    seedProject(source)
    write(join(source, 'desktop.ini'), 'junk')
    write(join(source, '素材', '.DS_Store'), 'junk')
    const archive = join(root, 'junk.zip')
    const exported = await exportProjectArchive({ sourceDir: source, destination: archive })
    assert.equal(exported.files, 3)
    assert.equal(exported.skippedJunk, 2)
    const entries = unzipSync(readFileSync(archive))
    assert.ok(!Object.keys(entries).includes('desktop.ini'))
    assert.ok(!Object.keys(entries).includes('素材/.DS_Store'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('export and import round-trip keeps project bytes and strips the manifest', async () => {
  const root = tempRoot()
  try {
    const source = join(root, 'projects', '演示项目')
    seedProject(source)
    mkdir(join(root, 'exports'))
    const archive = join(root, 'exports', '演示项目.zip')
    const exported = await exportProjectArchive({ sourceDir: source, destination: archive })
    assert.equal(exported.files, 3)
    assert.ok(exported.bytes > 0)
    const entries = unzipSync(readFileSync(archive))
    assert.ok(entries[MANIFEST_NAME] !== undefined, 'manifest is present')
    const manifest = JSON.parse(Buffer.from(entries[MANIFEST_NAME]).toString('utf8'))
    assert.deepEqual(Object.keys(manifest).sort(), ['exportedAt', 'format', 'title', 'version'])
    assert.equal(manifest.title, '演示项目')

    const projects = join(root, 'imported')
    const imported = await importProjectArchive({ archivePath: archive, projectsDir: projects })
    assert.equal(imported.name, '演示项目')
    assert.equal(imported.renamed, false)
    const target = join(projects, '演示项目')
    assert.equal(readFileSync(join(target, '选题.md'), 'utf8'), '# 选题\n')
    assert.deepEqual(readFileSync(join(target, '成品', 'cover.png')), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    assert.deepEqual(readdirSync(target).sort(), ['成品', '选题.md', '素材'].sort())
    assert.ok(!readdirSync(target).includes(MANIFEST_NAME))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('export replaces an existing destination without leaving a partial file', async () => {
  const root = tempRoot()
  try {
    const source = join(root, 'projects', 'overwrite')
    seedProject(source)
    const archive = join(root, 'overwrite.zip')
    write(archive, 'old bytes')
    const exported = await exportProjectArchive({ sourceDir: source, destination: archive })
    assert.equal(exported.files, 3)
    const entries = unzipSync(readFileSync(archive))
    assert.ok(entries['选题.md'] !== undefined)
    assert.ok(!readdirSync(root).includes('overwrite.zip.part'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('foreign flat zip imports under the zip name', async () => {
  const root = tempRoot()
  try {
    const archive = join(root, 'flat.zip')
    writeZip(archive, { 'a.txt': 'one', '素材/b.txt': 'two' })
    const projects = join(root, 'projects')
    const imported = await importProjectArchive({ archivePath: archive, projectsDir: projects })
    assert.equal(imported.name, 'flat')
    assert.equal(readFileSync(join(projects, 'flat', 'a.txt'), 'utf8'), 'one')
    assert.equal(readFileSync(join(projects, 'flat', '素材', 'b.txt'), 'utf8'), 'two')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a single top-level folder is unwrapped and junk is dropped', async () => {
  const root = tempRoot()
  try {
    const archive = join(root, 'share.zip')
    writeZip(archive, {
      '分享项目/a.txt': 'a',
      '分享项目/成品/b.txt': 'b',
      '__MACOSX/._x': 'junk',
      '.DS_Store': 'junk',
      '分享项目/Thumbs.db': 'junk',
    })
    const projects = join(root, 'projects')
    const imported = await importProjectArchive({ archivePath: archive, projectsDir: projects })
    assert.equal(imported.name, '分享项目')
    assert.equal(imported.skippedJunk, 3)
    assert.deepEqual(readdirSync(join(projects, '分享项目')).sort(), ['a.txt', '成品'].sort())
    assert.equal(readFileSync(join(projects, '分享项目', 'a.txt'), 'utf8'), 'a')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a name collision becomes a numbered suffix and never overwrites', async () => {
  const root = tempRoot()
  try {
    const source = join(root, 'templates', '撞名')
    seedProject(source)
    const archive = join(root, '撞名.zip')
    await exportProjectArchive({ sourceDir: source, destination: archive })
    const projects = join(root, 'projects')
    mkdir(join(projects, '撞名'))
    write(join(projects, '撞名', 'keep.txt'), 'original')
    const imported = await importProjectArchive({ archivePath: archive, projectsDir: projects })
    assert.equal(imported.name, '撞名 (2)')
    assert.equal(imported.renamed, true)
    assert.equal(readFileSync(join(projects, '撞名', 'keep.txt'), 'utf8'), 'original')
    assert.equal(readFileSync(join(projects, '撞名 (2)', '选题.md'), 'utf8'), '# 选题\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('manifest versions from a newer app are refused', async () => {
  const root = tempRoot()
  try {
    const archive = join(root, 'future.zip')
    writeZip(archive, {
      [MANIFEST_NAME]: JSON.stringify({ format: 'easel-project', version: 2, title: 'future', exportedAt: '2026-01-01' }),
      'a.txt': 'a',
    })
    await assert.rejects(
      importProjectArchive({ archivePath: archive, projectsDir: join(root, 'projects') }),
      /更新的 Easel|manifest-version/,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('hostile and conflicting entry paths fail without publishing', async () => {
  const root = tempRoot()
  try {
    const cases = [
      ['traversal.zip', { '../evil.txt': 'x' }],
      ['absolute.zip', { '/abs.txt': 'x' }],
      ['backslash.zip', { 'a\\b.txt': 'x' }],
    ]
    for (const [name, entries] of cases) {
      const archive = join(root, name)
      writeZip(archive, entries)
      const projects = join(root, `projects-${name}`)
      await assert.rejects(importProjectArchive({ archivePath: archive, projectsDir: projects }), /unsafe-path|不安全的路径|绝对路径/)
      assert.deepEqual(readdirSync(projects), [])
    }
    const duplicate = join(root, 'duplicate.zip')
    writeRawZip(duplicate, [['a.txt', 'one'], ['a.txt', 'two']])
    const duplicateProjects = join(root, 'projects-duplicate')
    await assert.rejects(importProjectArchive({ archivePath: duplicate, projectsDir: duplicateProjects }), /重复路径|path-conflict/)
    assert.deepEqual(readdirSync(duplicateProjects), [])
    for (const [name, entries] of [
      ['ancestor-file-first.zip', [['a', 'file'], ['a/b', 'child']]],
      ['ancestor-dir-first.zip', [['a/b', 'child'], ['a', 'file']]],
    ]) {
      const archive = join(root, name)
      writeRawZip(archive, entries)
      const projects = join(root, `projects-${name}`)
      await assert.rejects(importProjectArchive({ archivePath: archive, projectsDir: projects }), /冲突|同名|path-conflict/)
      assert.deepEqual(readdirSync(projects), [])
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('export skips symlinks and refuses a destination inside the project', async () => {
  const root = tempRoot()
  try {
    const outside = join(root, 'outside')
    mkdir(outside)
    write(join(outside, 'secret.txt'), 'secret')
    const source = join(root, 'projects', 'linked')
    seedProject(source)
    symlinkSync(outside, join(source, 'linked-dir'), process.platform === 'win32' ? 'junction' : 'dir')
    const archive = join(root, 'linked.zip')
    const exported = await exportProjectArchive({ sourceDir: source, destination: archive })
    assert.ok(exported.skippedLinks >= 1)
    const entries = unzipSync(readFileSync(archive))
    assert.ok(!Object.keys(entries).some(name => name.startsWith('linked-dir')))
    await assert.rejects(
      exportProjectArchive({ sourceDir: source, destination: join(source, 'inside.zip') }),
      /destination-inside-source|不能放在/,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('export skips an unreadable file and reports it', {
  skip: process.platform === 'win32' || process.getuid?.() === 0,
}, async () => {
  const root = tempRoot()
  try {
    const source = join(root, 'projects', 'locked')
    seedProject(source)
    const locked = join(source, 'secret.txt')
    write(locked, 'secret')
    chmodSync(locked, 0o000)
    const archive = join(root, 'locked.zip')
    const exported = await exportProjectArchive({ sourceDir: source, destination: archive })
    assert.equal(exported.skippedUnreadable, 1)
    const entries = unzipSync(readFileSync(archive))
    assert.ok(!Object.keys(entries).includes('secret.txt'))
    chmodSync(locked, 0o600)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a single file at or above 4 GiB is refused before writing', async () => {
  const root = tempRoot()
  try {
    const source = join(root, 'projects', 'big')
    mkdir(source)
    const big = join(source, 'big.mp4')
    write(big, '')
    truncateSync(big, 0xFFFF_FFFF)
    await assert.rejects(
      exportProjectArchive({ sourceDir: source, destination: join(root, 'big.zip') }),
      /4 GB|file-too-large/,
    )
    assert.ok(!readdirSync(source).includes('big.zip'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('listProjects returns real directories only, sorted by name', async () => {
  const root = tempRoot()
  try {
    const projects = join(root, 'projects')
    mkdir(join(projects, 'b'))
    mkdir(join(projects, 'a'))
    mkdir(join(projects, '.easel-import-old'))
    write(join(projects, 'file.txt'), 'x')
    symlinkSync(join(projects, 'a'), join(projects, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    const listed = await listProjects(projects)
    assert.deepEqual(listed.map(item => item.name), ['a', 'b'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('routes list, import, export, cancel, busy, and unsupported', async () => {
  const root = tempRoot()
  try {
    const projects = join(root, 'projects')
    mkdir(join(projects, 'existing'))
    const source = join(projects, 'existing')
    seedProject(source)
    const archive = join(root, 'existing.zip')
    await exportProjectArchive({ sourceDir: source, destination: archive })

    const settings = { projectRoot: root, archiveEnabled: true }
    const destination = join(root, 're-export.zip')
    const feature = createProjectArchiveFeature(settings, {
      pickZipFile: async () => archive,
      pickSaveZip: async () => destination,
    })

    const listed = await call(feature, 'GET', 'projects')
    assert.equal(listed.json.supported, true)
    assert.equal(listed.json.projects[0].name, 'existing')

    const started = await call(feature, 'POST', 'projects/import')
    assert.ok(started.json.jobId)
    const imported = await waitJob(feature)
    assert.equal(imported.state, 'done')
    assert.equal(imported.result.name, 'existing (2)')
    assert.equal(imported.result.renamed, true)

    const exported = await call(feature, 'POST', 'projects/export', { path: join(projects, 'existing') })
    assert.ok(exported.json.jobId)
    assert.equal(exported.json.destination, destination)
    const finished = await waitJob(feature)
    assert.equal(finished.state, 'done')
    assert.equal(finished.result.path, destination)
    assert.ok(readFileSync(destination).length > 0)

    const cancelledFeature = createProjectArchiveFeature(settings, {
      pickZipFile: async () => null,
      pickSaveZip: async () => null,
    })
    const cancelled = await call(cancelledFeature, 'POST', 'projects/import')
    assert.deepEqual(cancelled.json, { cancelled: true })
    assert.equal((await call(cancelledFeature, 'GET', 'projects/job')).json.state, 'idle')

    let release
    const gate = new Promise(resolve => { release = resolve })
    const busyFeature = createProjectArchiveFeature(settings, {
      pickZipFile: async () => archive,
      importProjectArchive: async () => {
        await gate
        return { name: 'slow', path: join(projects, 'slow'), files: 1, bytes: 1, renamed: false, skippedJunk: 0 }
      },
    })
    await call(busyFeature, 'POST', 'projects/import')
    const second = await call(busyFeature, 'POST', 'projects/import')
    assert.equal(second.status, 409)
    assert.equal(second.json.error.code, 'busy')
    release()

    const disabled = createProjectArchiveFeature({ projectRoot: root, archiveEnabled: false })
    assert.equal((await call(disabled, 'GET', 'projects')).json.supported, false)
    const refused = await call(disabled, 'POST', 'projects/import')
    assert.equal(refused.status, 501)
    assert.equal(refused.json.error.code, 'unsupported')

    const invalid = await call(feature, 'POST', 'projects/export', { path: join(root, 'not-a-project') })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.json.error.code, 'not-a-project')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('client archive copy helpers fill placeholders, sizes, and path keys', () => {
  assert.equal(fillArchiveText('导入「{name}」{count}个', { name: 'a', count: 2 }), '导入「a」2个')
  assert.equal(fillArchiveText('keep {unknown}', { name: 'a' }), 'keep {unknown}')
  assert.equal(formatArchiveBytes(0), '0 B')
  assert.equal(formatArchiveBytes(512), '512 B')
  assert.equal(formatArchiveBytes(2048), '2 KB')
  assert.equal(formatArchiveBytes(3 * 1024 * 1024), '3.0 MB')
  assert.equal(formatArchiveBytes(2 * 1024 * 1024 * 1024), '2.0 GB')
  assert.equal(archivePathKey('C:\\Data\\Projects\\A\\'), 'c:/data/projects/a')
  assert.equal(archivePathKey('/data/projects/A'), '/data/projects/A')
  assert.equal(isProjectDirectory('C:\\data\\workspace', 'C:\\data\\workspace\\projects\\A\\'), true)
  assert.equal(isProjectDirectory('/data/workspace', '/data/workspace/projects/A'), true)
  assert.equal(isProjectDirectory('/data/workspace', '/data/workspace/projects'), false)
  assert.equal(isProjectDirectory('/data/workspace', '/data/workspace/projects/A/nested'), false)
  assert.equal(isProjectDirectory('/data/workspace', '/data/workspace/outputs/A'), false)
  assert.equal(isProjectDirectory('', '/data/workspace/projects/A'), false)
})

test('stale import staging is swept after a day, recent staging is kept', async () => {
  const root = tempRoot()
  try {
    const projects = join(root, 'projects')
    mkdir(join(projects, '.easel-import-old'))
    mkdir(join(projects, '.easel-import-new'))
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await utimes(join(projects, '.easel-import-old'), old, old)
    const feature = createProjectArchiveFeature({ projectRoot: root, archiveEnabled: true })
    assert.equal(await feature.sweepStale(), 1)
    assert.deepEqual(readdirSync(projects), ['.easel-import-new'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
