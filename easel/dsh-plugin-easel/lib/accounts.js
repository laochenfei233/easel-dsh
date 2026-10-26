// 账户注册表（spec easel-multi-account §S2 数据模型）。outputs/_accounts.json
// 存 { version: 1, accounts: [...] }，条目 { id, platform, name, persona,
// profileDir, createdAt }，B站条目另加 cookieFile（相对 workspaceRoot 的
// POSIX 斜杠路径）。加载时零拷贝迁移：某平台无条目则探测 legacy 迹象
// （~/.easel-browser-profiles/<Platform>Profile、根 cookies.json、公众号
// yaml 凭证），存在即注册为该平台默认账号，不移动不复制任何文件。
// 平台名与 legacy profile 名镜像 index.js 的 LOGIN_RUNNERS——不 import
// index.js（宿主会 import 本模块，反向依赖成环），两表需同步改。

import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const REGISTRY_VERSION = 1

/** 注册表落点（workspaceRoot 相对：outputs/_accounts.json）。 */
export function accountsFile(workspaceRoot) {
  return join(workspaceRoot, 'outputs', '_accounts.json')
}

/**
 * 七平台元数据，镜像 index.js LOGIN_RUNNERS：name 平台中文名；legacyProfile
 * 为升级前 ~/.easel-browser-profiles 下的目录名（null = 该平台无浏览器
 * profile，登录态是 cookie 文件或后台会话）；prefix 用于新账号 profileDir
 * 的人眼前缀。
 */
export const PLATFORMS = {
  xiaohongshu: { name: '小红书', legacyProfile: 'XiaohongshuProfile', prefix: 'Xiaohongshu' },
  kuaishou: { name: '快手', legacyProfile: 'KuaishouProfile', prefix: 'Kuaishou' },
  'weixin-channels': { name: '微信视频号', legacyProfile: 'ChannelsProfile', prefix: 'Channels' },
  zhihu: { name: '知乎', legacyProfile: 'ZhihuProfile', prefix: 'Zhihu' },
  bilibili: { name: 'B站', legacyProfile: null, prefix: 'Bilibili' },
  douyin: { name: '抖音', legacyProfile: 'DouyinProfile', prefix: 'Douyin' },
  'wechat-oa': { name: '微信公众号', legacyProfile: null, prefix: 'WeixinOa' },
}

/** 公众号扫码后台的凭证文件（workspaceRoot 相对，POSIX 斜杠）。 */
const WECHAT_OA_CREDENTIAL = ['skills', 'openclaw', 'skill-wechat-publisher', 'wechat-publisher.yaml']

/** B站新账号的 per-account cookie 落点（workspaceRoot 相对，POSIX 斜杠）。 */
const bilibiliCookieFile = id => `outputs/_accounts/${id}/cookies.json`

/**
 * 平台是否留有升级前（legacy）登录态迹象。B站看根 cookies.json，公众号看
 * yaml 凭证，其余看 browserProfilesDir 下的 legacy profile 目录。
 */
function hasLegacyMarker(workspaceRoot, platform, browserProfilesDir) {
  if (platform === 'bilibili') return existsSync(join(workspaceRoot, 'cookies.json'))
  if (platform === 'wechat-oa') return existsSync(join(workspaceRoot, ...WECHAT_OA_CREDENTIAL))
  const legacy = PLATFORMS[platform].legacyProfile
  return legacy !== null && existsSync(join(browserProfilesDir, legacy))
}

/** legacy 默认账号：id = 平台 key，name = 平台中文名，B站 cookieFile 指向根 cookies.json。 */
function defaultAccount(platform) {
  const entry = {
    id: platform,
    platform,
    name: PLATFORMS[platform].name,
    persona: null,
    profileDir: PLATFORMS[platform].legacyProfile,
    createdAt: new Date().toISOString(),
  }
  if (platform === 'bilibili') entry.cookieFile = 'cookies.json'
  return entry
}

/**
 * 条目最低合法性：有非空字符串 id 的普通对象才收。未识别字段（含未知
 * platform）原样保留——安全读端，不懂的数据不丢。
 */
const isEntry = entry => typeof entry === 'object' && entry !== null
  && !Array.isArray(entry) && typeof entry.id === 'string' && entry.id.length > 0

function normalizeRegistry(data) {
  return { version: REGISTRY_VERSION, accounts: Array.isArray(data?.accounts) ? data.accounts.filter(isEntry) : [] }
}

/**
 * 读注册表，并对无条目平台做零拷贝迁移（探测 legacy 迹象 → 注册默认账号 →
 * 写回）。幂等：已有条目的平台绝不重复注册。注意：删除条目的调用方必须
 * 同时清掉对应 legacy 迹象（profile 目录 / cookies.json / yaml），否则该
 * 平台会在下次加载时重新注册出默认账号。
 * @param {string} workspaceRoot 数据根（绝对）
 * @param {object} [opts]
 * @param {string} [opts.browserProfilesDir] 浏览器 profile 根目录
 * @returns {Promise<{version: number, accounts: object[]}>} 注册表
 */
export async function loadAccounts(workspaceRoot, { browserProfilesDir = join(homedir(), '.easel-browser-profiles') } = {}) {
  let registry
  try {
    registry = normalizeRegistry(JSON.parse(await readFile(accountsFile(workspaceRoot), 'utf8')))
  } catch {
    // ENOENT = 首次使用；坏 JSON/半截文件按空注册表重新迁移（可再生数据）。
    registry = { version: REGISTRY_VERSION, accounts: [] }
  }
  const added = Object.keys(PLATFORMS)
    .filter(platform => !registry.accounts.some(account => account.platform === platform))
    .filter(platform => hasLegacyMarker(workspaceRoot, platform, browserProfilesDir))
    .map(defaultAccount)
  if (added.length > 0) {
    registry.accounts.push(...added)
    await saveAccounts(workspaceRoot, registry)
  }
  return registry
}

/**
 * 原子写注册表（`<file>.tmp` + rename，对齐宿主 writeJsonFile 约定）。
 * @param {string} workspaceRoot 数据根（绝对）
 * @param {{accounts: object[]}} registry 内存注册表（version 恒写 1）
 */
export async function saveAccounts(workspaceRoot, registry) {
  const file = accountsFile(workspaceRoot)
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, `${JSON.stringify({ version: REGISTRY_VERSION, accounts: registry.accounts }, null, 2)}\n`, 'utf8')
  await rename(tmp, file)
}

/**
 * 账号名规则：非空（去首尾空白）、不超过 40 字、无路径分隔符与控制字符。
 * 与 index.js validPersonaName 同风格但独立实现——import 宿主会成环。
 * @param {unknown} name 待校验账号名
 * @returns {boolean} 是否合法
 */
export const validAccountName = name => typeof name === 'string'
  && name.trim().length > 0 && name.length <= 40
  && !/[/\\:]/.test(name)
  && ![...name].some(ch => ch.charCodeAt(0) < 32)

/** 画像目录名引用规则（镜像 index.js validPersonaName），防绑定值携带穿越段。 */
const validPersonaRef = name => typeof name === 'string' && name.length > 0
  && !name.startsWith('.') && !name.startsWith('_')
  && !/[/\\:]/.test(name)
  && ![...name].some(ch => ch.charCodeAt(0) < 32)

const EDITABLE_FIELDS = new Set(['name', 'persona'])

/**
 * 建新账号条目（只改内存注册表，落盘由调用方 saveAccounts）。id =
 * `<platform>-<4位base36>`，与现有条目撞车则重摇；profileDir =
 * `<平台前缀>__<id>`；B站另带 per-account cookieFile。
 * @param {{accounts: object[]}} registry 内存注册表
 * @param {string} platform 平台 key（PLATFORMS 之一）
 * @param {string} name 账号名（须过 validAccountName）
 * @returns {object} 新条目
 */
export function createAccount(registry, platform, name) {
  if (PLATFORMS[platform] === undefined) throw new Error(`未知平台：${platform}`)
  if (!validAccountName(name)) throw new Error(`账号名非法：「${name}」需为 1–40 字、不含路径分隔符或控制字符`)
  let id
  do {
    id = `${platform}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`
  } while (registry.accounts.some(account => account.id === id))
  const entry = {
    id,
    platform,
    name,
    persona: null,
    profileDir: `${PLATFORMS[platform].prefix}__${id}`,
    createdAt: new Date().toISOString(),
  }
  if (platform === 'bilibili') entry.cookieFile = bilibiliCookieFile(id)
  registry.accounts.push(entry)
  return entry
}

/**
 * 账号路由单点（后续登录/发布/看板等所有按账号寻址都收口在这里）：显式 id
 * 命中即返回；未给或找不到回落该平台第一个条目（默认账号）；平台完全无
 * 条目返回 null，报错与否由调用方决定。
 * @param {{accounts: object[]}} registry 内存注册表
 * @param {string} platform 平台 key
 * @param {string} [accountId] 账号 id
 * @returns {object|null} 命中条目
 */
export function resolveAccount(registry, platform, accountId) {
  const list = registry.accounts.filter(account => account.platform === platform)
  return list.find(account => account.id === accountId) ?? list[0] ?? null
}

/**
 * 改账号：只开放 name/persona（白名单），id/platform/profileDir 等标识字段
 * 忽略；persona = null 表示解绑画像（通用模式）。
 * @param {{accounts: object[]}} registry 内存注册表
 * @param {string} id 账号 id
 * @param {object} patch 待改字段
 * @returns {object} 改后的条目
 */
export function updateAccount(registry, id, patch) {
  const entry = registry.accounts.find(account => account.id === id)
  if (entry === undefined) throw new Error(`账号不存在：${id}`)
  if (patch !== null && typeof patch === 'object') {
    for (const [field, value] of Object.entries(patch)) {
      if (field === 'name' && !validAccountName(value)) {
        throw new Error(`账号名非法：「${String(value)}」需为 1–40 字、不含路径分隔符或控制字符`)
      }
      if (field === 'persona' && value !== null && !validPersonaRef(value)) {
        throw new Error(`画像名非法：「${String(value)}」`)
      }
      if (EDITABLE_FIELDS.has(field)) entry[field] = value
    }
  }
  return entry
}

/**
 * 删账号条目（只动注册表；profile 目录、cookie 文件等清理归登出逻辑）。
 * @param {{accounts: object[]}} registry 内存注册表
 * @param {string} id 账号 id
 * @returns {object} 被删条目
 */
export function removeAccount(registry, id) {
  const index = registry.accounts.findIndex(account => account.id === id)
  if (index === -1) throw new Error(`账号不存在：${id}`)
  return registry.accounts.splice(index, 1)[0]
}
