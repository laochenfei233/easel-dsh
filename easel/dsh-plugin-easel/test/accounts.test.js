import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createAccount,
  loadAccounts,
  removeAccount,
  resolveAccount,
  saveAccounts,
  updateAccount,
  validAccountName,
} from '../lib/accounts.js'

function tmpRoot() {
  return mkdtempSync(join(import.meta.dirname, '.tmp-accounts-'))
}

/** 造 legacy 浏览器 profile 目录（注入 loadAccounts 的 opts.browserProfilesDir）。 */
function legacyProfiles(root, ...names) {
  const dir = join(root, 'profiles-fixture')
  for (const name of names) mkdirSync(join(dir, name), { recursive: true })
  return dir
}

/** 造 workspace 根的 legacy 迹象：B站 cookies.json 与公众号 yaml 凭证。 */
function legacyWorkspaceMarkers(root, { cookies = false, wechat = false } = {}) {
  if (cookies) writeFileSync(join(root, 'cookies.json'), JSON.stringify({ SESSDATA: 'x' }), 'utf8')
  if (wechat) {
    const dir = join(root, 'skills', 'openclaw', 'skill-wechat-publisher')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'wechat-publisher.yaml'), 'cookie: x\n', 'utf8')
  }
}

test('loadAccounts migrates legacy markers into per-platform default accounts (zero-copy)', async () => {
  const root = tmpRoot()
  try {
    const browserProfilesDir = legacyProfiles(root, 'DouyinProfile', 'XiaohongshuProfile')
    legacyWorkspaceMarkers(root, { cookies: true, wechat: true })

    const { version, accounts } = await loadAccounts(root, { browserProfilesDir })
    assert.equal(version, 1)
    const byId = Object.fromEntries(accounts.map(account => [account.id, account]))
    assert.deepEqual(
      new Set(Object.keys(byId)),
      new Set(['douyin', 'xiaohongshu', 'bilibili', 'wechat-oa']),
      'only platforms with markers get default accounts',
    )
    assert.deepEqual(
      { ...byId.douyin, createdAt: 0 },
      { id: 'douyin', platform: 'douyin', name: '抖音', persona: null, profileDir: 'DouyinProfile', createdAt: 0 },
    )
    assert.equal(typeof byId.douyin.createdAt, 'string')
    assert.equal(byId.bilibili.cookieFile, 'cookies.json', 'bili default account keeps the root cookie file')
    assert.equal(byId.bilibili.profileDir, null, 'bili has no legacy browser profile')
    assert.equal(byId['wechat-oa'].name, '微信公众号')

    // 零拷贝：legacy 迹象原地不动。
    assert.equal(existsSync(join(browserProfilesDir, 'DouyinProfile')), true)
    assert.equal(existsSync(join(root, 'cookies.json')), true)
    // 迁移结果写回注册表文件。
    const persisted = JSON.parse(readFileSync(join(root, 'outputs', '_accounts.json'), 'utf8'))
    assert.equal(persisted.version, 1)
    assert.equal(persisted.accounts.length, accounts.length)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('migration registers only platforms with markers and never duplicates entries', async () => {
  const root = tmpRoot()
  try {
    const browserProfilesDir = legacyProfiles(root, 'DouyinProfile')
    const first = await loadAccounts(root, { browserProfilesDir })
    assert.deepEqual(first.accounts.map(account => account.platform), ['douyin'])
    assert.equal(resolveAccount(first, 'xiaohongshu'), null, 'marker-less platforms stay empty')

    // 之后 kuaishou 迹象出现：补注册 kuaishou，已有条目的 douyin 不重复。
    mkdirSync(join(browserProfilesDir, 'KuaishouProfile'), { recursive: true })
    const second = await loadAccounts(root, { browserProfilesDir })
    assert.deepEqual(second.accounts.map(account => account.id).sort(), ['douyin', 'kuaishou'])

    // 再加载：全部有迹象的平台都已有条目，不再新增。
    const third = await loadAccounts(root, { browserProfilesDir })
    assert.equal(third.accounts.length, second.accounts.length)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('createAccount mints unique ids, prefixed profile dirs and per-account bili cookie paths', () => {
  const registry = { version: 1, accounts: [] }
  const first = createAccount(registry, 'douyin', '主号')
  assert.match(first.id, /^douyin-[0-9a-z]{4}$/)
  assert.equal(first.profileDir, `Douyin__${first.id}`)
  assert.equal(first.persona, null)
  assert.equal('cookieFile' in first, false)

  // 幂等：连开几百个号 id 也不得撞车。
  const seen = new Set([first.id])
  for (let i = 0; i < 200; i += 1) {
    const entry = createAccount(registry, 'douyin', `号${i}`)
    assert.equal(seen.has(entry.id), false, `duplicate id minted: ${entry.id}`)
    seen.add(entry.id)
  }

  const bili = createAccount(registry, 'bilibili', 'B站小号')
  assert.equal(bili.cookieFile, `outputs/_accounts/${bili.id}/cookies.json`)

  assert.throws(() => createAccount(registry, 'nope', 'x'), /未知平台/)
  assert.throws(() => createAccount(registry, 'douyin', 'a/b'), /账号名非法/)
})

test('resolveAccount routes by id, falls back to the first account, null when platform empty', () => {
  const registry = { version: 1, accounts: [] }
  const first = createAccount(registry, 'douyin', '主号')
  const second = createAccount(registry, 'douyin', '小号')

  assert.equal(resolveAccount(registry, 'douyin', second.id), second)
  assert.equal(resolveAccount(registry, 'douyin'), first, 'missing id falls back to the default account')
  assert.equal(resolveAccount(registry, 'douyin', 'douyin-zzzz'), first, 'unknown id falls back to the default account')
  assert.equal(resolveAccount(registry, 'zhihu'), null, 'platform without accounts resolves to null')
})

test('updateAccount edits only whitelisted fields; removeAccount drops the entry', () => {
  const registry = { version: 1, accounts: [] }
  const entry = createAccount(registry, 'douyin', '主号')

  const updated = updateAccount(registry, entry.id, {
    name: '成都号',
    persona: '科技号',
    platform: 'zhihu',
    id: 'hack',
    profileDir: 'evil',
  })
  assert.equal(updated.name, '成都号')
  assert.equal(updated.persona, '科技号')
  assert.equal(updated.platform, 'douyin', 'platform is not editable')
  assert.equal(updated.id, entry.id, 'id is not editable')
  assert.equal(updated.profileDir, entry.profileDir, 'profileDir is not editable')

  assert.equal(updateAccount(registry, entry.id, { persona: null }).persona, null, 'persona=null unbinds')
  assert.throws(() => updateAccount(registry, entry.id, { persona: '../x' }), /画像名非法/)
  assert.throws(() => updateAccount(registry, entry.id, { name: '' }), /账号名非法/)
  assert.throws(() => updateAccount(registry, 'douyin-zzzz', { name: 'x' }), /账号不存在/)

  removeAccount(registry, entry.id)
  assert.equal(registry.accounts.length, 0)
  assert.throws(() => removeAccount(registry, entry.id), /账号不存在/)
})

test('validAccountName rejects empty, overlong, separators and control chars', () => {
  assert.equal(validAccountName('主号'), true)
  assert.equal(validAccountName('a'.repeat(40)), true)
  assert.equal(validAccountName(''), false)
  assert.equal(validAccountName('   '), false)
  assert.equal(validAccountName('a'.repeat(41)), false)
  assert.equal(validAccountName('a/b'), false)
  assert.equal(validAccountName('a\\b'), false)
  assert.equal(validAccountName('a:b'), false)
  assert.equal(validAccountName('a\nb'), false)
  assert.equal(validAccountName(42), false)
  assert.equal(validAccountName(undefined), false)
})

test('save/load round-trips entries; a corrupt file re-migrates instead of throwing', async () => {
  const root = tmpRoot()
  try {
    const browserProfilesDir = legacyProfiles(root, 'DouyinProfile')
    const registry = { version: 1, accounts: [] }
    createAccount(registry, 'douyin', '主号')
    createAccount(registry, 'bilibili', 'B站小号')
    await saveAccounts(root, registry)

    const loaded = await loadAccounts(root, { browserProfilesDir })
    assert.deepEqual(loaded.accounts, registry.accounts, 'round-trip must preserve entries exactly')
    assert.equal(loaded.accounts.filter(account => account.platform === 'douyin').length, 1,
      'migrated douyin account already present, no duplicate')

    // 坏 JSON：按空注册表重新迁移（可再生数据），默认账号回来。
    writeFileSync(join(root, 'outputs', '_accounts.json'), '{oops', 'utf8')
    const recovered = await loadAccounts(root, { browserProfilesDir })
    assert.deepEqual(recovered.accounts.map(account => account.id), ['douyin'])
    assert.equal(recovered.accounts[0].profileDir, 'DouyinProfile')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
