// The plugin's host routes proxy the Easel backend, so every call goes under /easel.
const BASE = '/easel';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // 全部是动态应用接口（登录态/数据等），禁止浏览器 HTTP 缓存——否则 /api/accounts 等可能被启发式
  // 缓存住旧响应（曾表现为“扫码登录后卡片仍显示未登录”）。调用方可用 options.cache 覆盖。
  const res = await fetch(`${BASE}${url}`, { cache: 'no-store', ...options });
  if (!res.ok) {
    // 优先显示后端返回的实质错误信息（FastAPI 的 {detail}），而不是无意义的 "API error: 400"
    let detail = '';
    try {
      const j = await res.json();
      detail = (j && (j.detail || j.message)) || '';
    } catch {
      /* 响应体不是 JSON，忽略 */
    }
    throw new Error(detail || `请求失败（${res.status} ${res.statusText}）`);
  }
  return res.json() as Promise<T>;
}

export interface PersonaItem {
  name: string;
  description: string;
}

export interface SkillItem {
  name: string;
  description: string;
  layer: string;
  needsApi: boolean;
  apiConfigured: boolean;
}

export interface ApiKeySpec {
  env: string;
  label: string;
  required: boolean;
  secret: boolean;
  configured: boolean;
  masked: string;   // 脱敏值或非 secret 明文
  choices: string[];
}

export interface ApiProviderSpec {
  id: string;
  name: string;
  keys: ApiKeySpec[];
}

export interface ApiSpec {
  label: string;
  settings: ApiKeySpec[];
  providers: ApiProviderSpec[];
}

export interface SkillDetail {
  name: string;
  layer: string;
  description: string;
  body: string;
  needsApi: boolean;
  apiConfigured: boolean;
  apiSpec: ApiSpec | null;
}

export type FileKind = 'text' | 'image' | 'video' | 'audio' | 'binary';

/** 顶层项目目录的 .easel.json 展示头（供内容库富展示）。 */
export interface OutputMeta {
  title?: string;
  summary?: string;
  platform?: string;
  kind?: string;             // article|xhs-note|video|cards|poster|audio|other
  status?: string;           // draft|ready|published
  tags?: string[];
  cover?: string;            // outputs 下相对路径（后端已解析存在性）
  deliverables?: string[];   // 成品文件名（项目根相对）
  deliverablePaths?: string[];  // 成品的 outputs 相对路径（后端已解析存在性）
}

/** 产物树节点：文件或目录（目录带 children，可无限嵌套点开）。 */
export interface OutputNode {
  name: string;
  type: 'dir' | 'file';
  path: string;              // outputs 下的相对路径，如 "short-drama/监控诡影/episodes/ep01"
  mtime?: number;
  kind?: FileKind;           // 仅 file
  size?: number;             // 仅 file
  children?: OutputNode[];   // 仅 dir
  fileCount?: number;        // 仅 dir：递归文件数
  meta?: OutputMeta;         // 仅顶层项目 dir
}

/** @deprecated 用 OutputNode（type==='file'）。保留别名减少改动面。 */
export type OutputFile = OutputNode;

export interface OutputContent {
  path: string;
  content: string;
  kind: FileKind;
  isBinary: boolean;
}

export interface ProfileBuildResponse {
  created: boolean;
  name: string;
  async?: boolean;
  status?: string;
  log?: string;
}

export function fetchPersonaFiles(name: string): Promise<{ name: string; files: PersonaFile[] }> {
  return request(`/api/persona/${encodeURIComponent(name)}/files`);
}

export function savePersonaFile(name: string, filename: string, content: string): Promise<{ ok: boolean }> {
  return request(`/api/persona/${encodeURIComponent(name)}/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content }),
  });
}

export function deletePersona(name: string): Promise<{ ok: boolean; deleted: string }> {
  return request(`/api/persona/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// ---- 热点雷达 ----
export interface TrendItem {
  title: string; hot: string; url: string;
  /** 真实榜位（1 起），不随排序变化。 */
  rank?: number;
  /** 相对上一份快照的名次变化：正=上升，负=下降；新上榜时缺省。 */
  delta?: number;
  /** 上一份新近快照里没有（「新上榜」徽标）。 */
  isNew?: boolean;
  /** 首次出现至今分钟数。 */
  ageMin?: number;
  /** 命中的关注词。 */
  watch?: string[];
}
export interface TrendGroup {
  platform: string; label: string; items: TrendItem[]; ok?: boolean;
  /** 自定义源的类型标签。 */
  category?: string;
  /** 该源数据时间（秒）。 */
  at?: number;
  /** 内容来自内存/落盘快照，不是本轮抓的。 */
  stale?: boolean;
}
/** 我关注/聚合卡里的条目：源内条目信息 + 来源平台。 */
export interface TrendRef extends TrendItem { platform: string; label: string; }
export interface WatchGroup { keyword: string; items: TrendRef[]; }
export interface TrendCluster {
  id: string; title: string;
  /** 参与聚类的平台键与展示名（去重，与 items 对应）。 */
  platforms: string[]; labels: string[];
  bestRank: number; firstSeen: number; isNew: boolean;
  items: TrendRef[];
}
export interface TrendsResponse { trends: TrendGroup[]; updated: number; watch: WatchGroup[]; clusters?: TrendCluster[]; }
export function fetchTrends(platforms: string, limit = 12, options: { view?: 'list' | 'cluster'; force?: boolean } = {}): Promise<TrendsResponse> {
  const params = new URLSearchParams({ platforms, limit: String(limit) });
  if (options.view) params.set('view', options.view);
  if (options.force) params.set('force', '1');
  return request(`/api/trends?${params}`);
}

/** 右键抓取正文（spec easel-hotspot-radar D6）：正文进内容库，选题进选题库。 */
export interface TrendCaptureInput {
  title: string; source: string;
  url?: string; platform?: string; rank?: number; hot?: string;
}
export interface TrendCaptureResult {
  ok: boolean;
  idea: Idea;
  /** outputs 相对路径；正文不可得时缺省。 */
  bodyPath?: string;
  chars?: number;
  reused?: boolean;
  warning?: string;
}
export function captureTrendArticle(input: TrendCaptureInput): Promise<TrendCaptureResult> {
  return request('/api/radar/article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

// ---- 内容排期 ----
export interface ScheduleItem {
  id: string; title: string; date: string; platform: string;
  time: string; status: string; note: string;
  kind?: string;          // content（内容/发布）| event（平台活动/节日/特殊日期）
  url?: string;           // 已发布链接
  source?: string;        // manual | publish-page | chat | scheduler
  event_type?: string;    // event 专属：节日/电商/平台活动/行业
  end_date?: string;      // event 专属：活动区间结束日
}
export type ScheduleInput = Omit<ScheduleItem, 'id'>;
export interface ScheduleContext {
  today?: string; window_days?: number; published_recent?: number;
  per_platform?: { platform: string; recent_count: number; last_date: string | null; days_since_last: number | null }[];
  upcoming_schedules?: ScheduleItem[];
  upcoming_events?: ScheduleItem[];
  suggestions?: string[];
}
export function fetchSchedule(): Promise<ScheduleItem[]> {
  return request('/api/schedule');
}
export function fetchScheduleContext(days = 14): Promise<ScheduleContext> {
  return request(`/api/schedule/context?days=${days}`);
}
export function createSchedule(item: ScheduleInput): Promise<ScheduleItem> {
  return request('/api/schedule', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
  });
}
export function updateSchedule(id: string, item: ScheduleInput): Promise<ScheduleItem> {
  return request(`/api/schedule/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
  });
}
export function deleteSchedule(id: string): Promise<{ ok: boolean }> {
  return request(`/api/schedule/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---- 选题库 ----
export interface Idea {
  id: string; title: string; note: string; source: string; status: string; created: number;
  /** 拆解批次号（爆款拆解入库时写入）；立项时凭它装配素材。 */
  deconstruct?: string;
  /** 立项后的项目目录（项目根相对）；「做内容」凭它注入产物落点。 */
  projectDir?: string;
  /** 原文链接（右键抓取正文时由宿主写入）。 */
  url?: string;
  /** 正文在内容库的相对路径（不含 outputs/，宿主写入）；「正文」预览凭它读文件。 */
  bodyPath?: string;
}
export type IdeaInput = { title: string; note?: string; source?: string; status?: string };
export function fetchIdeas(): Promise<Idea[]> { return request('/api/ideas'); }
export function createIdea(item: IdeaInput): Promise<Idea> {
  return request('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
}
export function updateIdea(id: string, item: IdeaInput): Promise<Idea> {
  return request(`/api/ideas/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
}
export function deleteIdea(id: string): Promise<{ ok: boolean }> {
  return request(`/api/ideas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function fetchSkills(): Promise<SkillItem[]> {
  return request<SkillItem[]>('/api/skills');
}

export function fetchSkillDetail(name: string): Promise<SkillDetail> {
  return request<SkillDetail>(`/api/skill/${encodeURIComponent(name)}`);
}

/** 保存 API key 到项目根 .env（仅注册表内变量）。返回各需 API 的 skill 是否已就绪。 */
export function saveEnv(updates: Record<string, string>): Promise<{ ok: boolean; skills: Record<string, boolean> }> {
  return request('/api/env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
}

/** 从表单构建画像（首次引导）。后端写基线 + agent 分析社媒链接增强。 */
export function buildProfile(name: string, form: Record<string, unknown>): Promise<ProfileBuildResponse> {
  return request<ProfileBuildResponse>('/api/profile/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, form }),
  });
}

export function fetchOutputs(): Promise<OutputNode[]> {
  return request<OutputNode[]>('/api/outputs');
}

export function fetchOutputContent(path: string): Promise<OutputContent> {
  return request<OutputContent>(`/api/output/${path.split('/').map(encodeURIComponent).join('/')}`);
}

/** 媒体文件（图片/视频/音频/HTML/PDF）的原样 URL，用于 <img>/<video>/iframe/下载。 */
export function mediaUrl(path: string): string {
  return `${BASE}/api/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** 删除内容库里的文件或整个项目目录（系统数据受保护，后端会拒）。 */
export function deleteOutput(path: string): Promise<{ ok: boolean; deleted: string }> {
  return request(`/api/output/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' });
}

// ---- 账号登录 ----
export interface AccountItem {
  platform: string;
  name: string;
  backend: string;      // xhs | web | biliup | unsupported
  supported: boolean;
  loggedIn: boolean;
  note: string;
}

export interface LoginStart {
  mode: 'qr' | 'manual' | 'cdp' | 'terminal' | 'credentials';   // credentials = 凭证式（公众号 AppID/AppSecret）
  state?: string;       // starting | qr_ready | success | expired | error | unknown
  message?: string;
  qr?: string;          // outputs 下相对路径，用 mediaUrl() 取图
  configured?: boolean; // 凭证式：是否已配置
}

// ---- 凭证式账号（微信公众号 AppID/AppSecret）----
export interface CredentialStatus {
  configured: boolean;
  appIdMasked: string;
  name: string;
  author: string;
}

/** 读取凭证式平台（公众号）已配置状态（AppSecret 不回传）。 */
export function getCredentials(platform: string): Promise<CredentialStatus> {
  return request<CredentialStatus>(`/api/accounts/${encodeURIComponent(platform)}/credentials`);
}

/** 保存公众号 AppID/AppSecret（后端会调官方接口验证连通性）。 */
export function saveCredentials(
  platform: string,
  payload: { appId: string; appSecret: string; name?: string; author?: string },
): Promise<{ ok: boolean; message: string }> {
  return request(`/api/accounts/${encodeURIComponent(platform)}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** 启动「公众号后台」扫码登录（数据中心取数用，独立于 AppID 凭证）。返回二维码状态。 */
export function startMpLogin(platform: string): Promise<LoginStatus> {
  return request<LoginStatus>(`/api/accounts/${encodeURIComponent(platform)}/mp-login`, { method: 'POST' });
}

/** 轮询公众号后台扫码登录状态。 */
export function mpLoginStatus(platform: string): Promise<LoginStatus> {
  return request<LoginStatus>(`/api/accounts/${encodeURIComponent(platform)}/mp-login/status`);
}

export interface LoginStatus {
  mode: 'qr';
  state: string;
  message: string;
  qr: string;
  qrTs?: number;
}

export function fetchAccounts(): Promise<AccountItem[]> {
  return request<AccountItem[]>('/api/accounts');
}

export interface AccountWhoami {
  loggedIn: boolean;
  name: string;
  avatar: string;   // 头像 URL（http）或空
}

/** 真校验某平台登录态 + 拉昵称/头像（后端起 headless 浏览器，数秒）。 */
export function accountWhoami(platform: string): Promise<AccountWhoami> {
  return request<AccountWhoami>(`/api/accounts/${encodeURIComponent(platform)}/whoami`);
}

/** 退出登录：删该平台持久化登录态。 */
export function logoutAccount(platform: string): Promise<{ ok: boolean; deleted: string[] }> {
  return request(`/api/logout/${encodeURIComponent(platform)}`, { method: 'POST' });
}

export interface PublishResult {
  ok?: boolean;
  message: string;
  detail?: string;
  async?: boolean;   // true = 异步发布（抖音，可能触发短信验证），需轮询 publishStatus
  pending?: boolean;
}

/** 一键发布到某平台（真发布，--exec）。media 为 outputs 相对路径数组。
 * 抖音返回 {async:true}，需轮询 publishStatus；其他平台同步返回结果。 */
export function publishNow(
  platform: string,
  payload: { title: string; body: string; media: string[]; tags?: string },
): Promise<PublishResult> {
  return request<PublishResult>(`/api/publish/${encodeURIComponent(platform)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface PublishStatus {
  mode: 'publish';
  state: string;     // starting | sms_required | verifying | success | error | unknown
  message: string;
}

/** 轮询异步发布状态（抖音）。 */
export function publishStatus(platform: string): Promise<PublishStatus> {
  return request<PublishStatus>(`/api/publish/${encodeURIComponent(platform)}/status`);
}

/** 发布触发短信墙时回填验证码。 */
export function submitPublishSms(platform: string, code: string): Promise<{ ok: boolean }> {
  return request(`/api/publish/${encodeURIComponent(platform)}/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

/** 登录方式：qr=无头扫码 | manual=有头窗口手动登录 | cdp=接管已开的 Chrome。 */
export type LoginMode = 'qr' | 'manual' | 'cdp';

export function startLogin(platform: string, mode: LoginMode = 'qr'): Promise<LoginStart> {
  return request<LoginStart>(`/api/login/${encodeURIComponent(platform)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

// ---- 热点雷达配置（自定义源 + 代理 + CDP 端点）----
export interface RadarSource {
  name: string;
  url: string;
  kind: 'rss' | 'json';
  category: string;
  enabled: boolean;
}
export interface RadarConfig {
  proxyUrl: string;
  proxyEnabled: boolean;
  cdpEndpoint: string;
  proxyEnv: string;
  sources: RadarSource[];
  /** 关注词（分隔输入规范化后的列表，≤20 个）。 */
  keywords: string[];
}

export function fetchRadarConfig(): Promise<RadarConfig> {
  return request<RadarConfig>('/api/radar/config');
}

export function saveRadarConfig(cfg: RadarConfig): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/radar/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cfg),
  });
}

export function loginStatus(platform: string): Promise<LoginStatus> {
  return request<LoginStatus>(`/api/login/${encodeURIComponent(platform)}/status`);
}

// ---- 归因层：账号创作数据 ----
export interface AnalyticsPlatform {
  platform: string;
  name: string;
  loggedIn: boolean;
}

export interface AccountAnalytics {
  platform: string;
  name: string;
  nickname: string;
  loggedIn: boolean;
  followers: number | null;
  likes: number | null;
  following: number | null;
  posts: number | null;
  metrics: { label: string; value: string; vs: string }[];
  notes: { title: string; url: string; cover?: string; stat?: string }[];
  growth: Record<'last' | 'day' | 'week' | 'month' | 'year',
    { followers: number | null; likes: number | null; posts: number | null; since_days: number | null } | null>;
  fetched_at: number;
}

/** 支持抓数据的平台 + 各自登录态。 */
export function fetchAnalyticsPlatforms(): Promise<AnalyticsPlatform[]> {
  return request<AnalyticsPlatform[]>('/api/analytics/platforms');
}

/** 抓某平台已登录账号的创作数据（后端起 headless 浏览器，数秒）。 */
export function fetchAccountAnalytics(platform: string): Promise<AccountAnalytics> {
  return request<AccountAnalytics>(`/api/analytics/${encodeURIComponent(platform)}`);
}

/** 回填短信验证码（登录风控短信墙）：提交后 runner 读走填码继续登录。 */
export function submitLoginSms(platform: string, code: string): Promise<{ ok: boolean }> {
  return request(`/api/login/${encodeURIComponent(platform)}/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

/** 项目根与画像列表（/easel/api/status；立项建工作区与画像选择要用）。 */
export async function fetchStatus(): Promise<{ projectRoot?: string; personas?: { name: string; description?: string }[] } | null> {
  return request<{ projectRoot?: string; personas?: { name: string; description?: string }[] }>('/api/status').catch(() => null);
}

/**
 * 立项工作区资料装配（spec easel-project-materials）：宿主建 projects/<safe>/
 * 并播种选题卡/拆解素材/画像快照，选题卡置 project。返回清洗后的目录名。
 */
export function projectizeTopic(body: {
  ideaId: string; title: string; note?: string; source?: string; fallback?: string;
  deconstruct?: string; persona?: string;
}): Promise<{ safe: string }> {
  return request('/api/projectize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
