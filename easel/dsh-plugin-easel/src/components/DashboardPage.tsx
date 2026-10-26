import { useState, useEffect } from 'react';
import {
  fetchTrends, fetchSchedule, fetchOutputs, fetchAccounts, fetchIdeas,
  fetchAnalyticsPlatforms, fetchAccountAnalytics, fetchAnalyticsOverview,
} from '../lib/api';
import type {
  TrendGroup, ScheduleItem, OutputNode, AccountItem, Idea,
  AnalyticsPlatform, AccountAnalytics, AnalyticsOverviewRow, AnalyticsPoint, AccountWhoami,
} from '../lib/api';
import { getWhoamiCache, verifyStale } from '../lib/whoami';
import { platformLabel } from '../lib/roster';
import {
  IconFire, IconCalendar, IconOutputs, IconChat, IconSkills, IconAccounts,
  IconIdea, IconPublish,
} from './icons';

/** 大数格式化：12000 → 1.2万。 */
function fmtNum(n: number | null): string {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 10000) return (n / 10000).toFixed(a >= 100000 ? 0 : 1) + '万';
  return String(n);
}
/** 增长量渲染信息：正=绿↑，负=红↓，0/缺失=不显示。 */
function growthInfo(n: number | null): { text: string; color: string } | null {
  if (n == null || n === 0) return null;
  return n > 0
    ? { text: `▲+${fmtNum(n)}`, color: 'var(--trend-up)' }
    : { text: `▼${fmtNum(Math.abs(n))}`, color: 'var(--trend-down)' };
}

const WIN: [AnalyticsWin, string][] = [
  ['last', '较上次'], ['day', '较昨日'], ['week', '较上周'], ['month', '较上月'], ['year', '较去年'],
];
type AnalyticsWin = 'last' | 'day' | 'week' | 'month' | 'year';

/** 全览迷你走势：粉丝快照折线。少于两个点不画（没有走势可看）。装饰性，语义由旁边的数字承担。 */
function Sparkline({ points }: { points: AnalyticsPoint[] }) {
  const vals = points.map((p) => p.followers).filter((v): v is number => typeof v === 'number');
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const span = Math.max(...vals) - min || 1;
  const w = 104;
  const h = 26;
  const step = w / (vals.length - 1);
  const path = vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="ana-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 采集时间说法：今天 / N 天前。 */
function ageLabel(days: number | null): string {
  if (days == null) return '';
  if (days < 1) return '今天采集';
  return `${Math.floor(days)} 天前采集`;
}

interface DashboardProps {
  persona: string;
  gatewayStatus: string;
  apiDirect: boolean;
  onNavigate: (page: string) => void;
  onUseTopic: (title: string) => void;
}

const STATUS_LABEL: Record<string, string> = { idea: '选题', draft: '草稿', scheduled: '待发', published: '已发' };

export default function DashboardPage({ persona, gatewayStatus, apiDirect, onNavigate, onUseTopic }: DashboardProps) {
  const [trends, setTrends] = useState<TrendGroup[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [outputs, setOutputs] = useState<OutputNode[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  // 归因层：账号创作数据（多账户：chips 按账号切换，'' = 全览）
  const [anaPlats, setAnaPlats] = useState<AnalyticsPlatform[]>([]);
  const [anaSel, setAnaSel] = useState('');
  // 缓存键 = 账号 id（默认账号 id 就是平台 key，旧平台键缓存天然命中）
  const [anaData, setAnaData] = useState<Record<string, AccountAnalytics | 'loading' | 'error'>>(() => {
    try { return JSON.parse(localStorage.getItem('easel_analytics') || '{}'); } catch { return {}; }
  });
  const [anaOverview, setAnaOverview] = useState<AnalyticsOverviewRow[] | 'loading' | 'error'>('loading');
  const [anaWin, setAnaWin] = useState<AnalyticsWin>('week');
  // whoami 自愈：登录态以真实 profile 为准（与账号页共享 localStorage 缓存；键 = 账号 id）
  const [whoamiMap, setWhoamiMap] = useState<Record<string, AccountWhoami>>(() => getWhoamiCache());

  useEffect(() => {
    fetchTrends('weibo,douyin', 6).then((d) => setTrends(d.trends)).catch(() => {});
    fetchSchedule().then(setSchedule).catch(() => {});
    fetchOutputs().then(setOutputs).catch(() => {});
    fetchIdeas().then(setIdeas).catch(() => {});
    fetchAccounts().then(setAccounts).catch(() => {});
    fetchAnalyticsPlatforms().then(setAnaPlats).catch(() => {});
    fetchAnalyticsOverview()
      .then((rows) => {
        setAnaOverview(rows);
        // 开页后台自愈：对能起 whoami 的账号真校验（B 站走 cookie、公众号走凭证判定）。
        const verify = rows.filter((r) => r.backend !== 'bilibili' && r.backend !== 'wechat-oa');
        const byId = new Map(verify.map((r) => [r.id, r]));
        verifyStale(verify.map((r) => r.id), {
          resolve: (id) => ({ platform: byId.get(id)?.platform ?? id, account: id }),
          onUpdate: (id, r) => setWhoamiMap((m) => ({ ...m, [id]: r })),
        });
      })
      .catch(() => setAnaOverview('error'));
  }, []);

  /** 切到某账号详情并抓取（实时抓取会同时更新该账号自己的归档）。 */
  const runAna = (account: AccountItem) => {
    setAnaSel(account.id);
    setAnaData((d) => ({ ...d, [account.id]: 'loading' }));
    fetchAccountAnalytics(account.platform, account.id)
      .then((r) => {
        setAnaData((d) => {
          const next = { ...d, [account.id]: r };
          try { localStorage.setItem('easel_analytics', JSON.stringify(next)); } catch { /* quota */ }
          return next;
        });
        // 全览同步一行，回去不用等归档重读
        setAnaOverview((rows) => (Array.isArray(rows) ? rows.map((row) => (row.id === account.id
          ? {
            ...row,
            loggedIn: r.loggedIn,
            archived: row.archived,
            latest: { ts: r.fetched_at, followers: r.followers, likes: r.likes, posts: r.posts },
            growth: r.growth,
            points: [...row.points, { ts: r.fetched_at, followers: r.followers, likes: r.likes, posts: r.posts }].slice(-20),
            ageDays: 0,
          }
          : row)) : rows));
      })
      .catch(() => setAnaData((d) => ({ ...d, [account.id]: 'error' as const })));
  };

  /** 重读全览（只读归档，不启浏览器）。 */
  const reloadOverview = () => {
    setAnaOverview('loading');
    fetchAnalyticsOverview().then(setAnaOverview).catch(() => setAnaOverview('error'));
  };

  const hour = new Date().getHours();
  const greet = hour < 6 ? '夜深了' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = [...schedule]
    .filter((s) => s.date >= todayStr && s.status !== 'published')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5);
  const recent = outputs.slice(0, 5);
  const pendingIdeas = ideas.filter((i) => i.status === 'pending');
  const loggedIn = accounts.filter((a) => a.loggedIn).length;

  const quick: { label: string; page: string; Icon: typeof IconChat }[] = [
    { label: '开始对话', page: 'chat', Icon: IconChat },
    { label: '看热点', page: 'trends', Icon: IconFire },
    { label: '拆爆款', page: 'breakdown', Icon: IconSkills },
    { label: '记选题', page: 'ideas', Icon: IconIdea },
    { label: '排日历', page: 'calendar', Icon: IconCalendar },
    { label: '去发布', page: 'publish', Icon: IconPublish },
  ];

  const stats: { label: string; value: string; page: string; Icon: typeof IconChat }[] = [
    { label: '待做选题', value: String(pendingIdeas.length), page: 'ideas', Icon: IconIdea },
    { label: '待发排期', value: String(upcoming.length), page: 'calendar', Icon: IconCalendar },
    { label: '内容项目', value: String(outputs.length), page: 'outputs', Icon: IconOutputs },
    { label: '已登录账号', value: `${loggedIn}/${accounts.length}`, page: 'accounts', Icon: IconAccounts },
  ];

  return (
    <div className="page-scroll dash-page">
      <div className="dash-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ fontSize: 26, margin: 0 }}>{greet} 👋</h1>
          <select
            className="field" style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5 }}
            title="聊天方式：单工作区（主项目+立项）或 dsh 原生多工作区"
            value={localStorage.getItem('easel.workspace.mode') ?? 'single'}
            onChange={(e) => {
              localStorage.setItem('easel.workspace.mode', e.target.value);
              // EASEL-DIVERGENCE(easel-single-workspace D1): 键契约见 dsh ui-workspace easel-mode.ts。
              (globalThis as { __easelWorkspaceUIMode?: string }).__easelWorkspaceUIMode = e.target.value;
              location.reload();
            }}
          >
            <option value="single">聊天方式：单工作区（主项目+立项）</option>
            <option value="full">聊天方式：完整多工作区</option>
          </select>
        </div>
        <p className="page-subtitle">
          {apiDirect ? (gatewayStatus === 'connected' ? 'API 直连已配置，可开始对话。' : '请先配置 API 直连通道。')
            : gatewayStatus === 'connected' ? '一切就绪。' : '⚠ 网关未连接。'}
          {persona ? ` 当前画像「${persona}」。` : ' 通用模式——指定画像效果更好。'}
          从热点到发布，一站式搞定今天的内容。
        </p>
        <div className="dash-quick">
          {quick.map((q) => (
            <button key={q.page} className="dash-quick-btn" onClick={() => onNavigate(q.page)}>
              <q.Icon size={16} /><span>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 概览数字 */}
      <div className="dash-stats">
        {stats.map((s) => (
          <button key={s.label} className="card card-hover dash-stat" onClick={() => onNavigate(s.page)}>
            <span className="dash-stat-ic"><s.Icon size={18} /></span>
            <span className="dash-stat-val">{s.value}</span>
            <span className="dash-stat-label">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="dash-grid">
        {/* 今日热点 */}
        <div className="card dash-card">
          <div className="dash-card-head">
            <span><IconFire size={16} /> 今日热点</span>
            <button className="dash-more" onClick={() => onNavigate('trends')}>热点雷达 →</button>
          </div>
          {trends.length === 0 && <div className="dash-empty">热点加载中 / 需配置代理</div>}
          {trends.map((g) => (
            <div key={g.platform} className="dash-trend-group">
              <div className="dash-trend-plat">{g.label}</div>
              {g.items.slice(0, 3).map((it, i) => (
                <div key={i} className="dash-trend-item" title={`${it.title}（点击做成内容）`}>
                  <span className="dash-trend-title" onClick={() => onUseTopic(it.title)}>{it.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 选题库 */}
        <div className="card dash-card">
          <div className="dash-card-head">
            <span><IconIdea size={16} /> 选题库 · 待做</span>
            <button className="dash-more" onClick={() => onNavigate('ideas')}>全部 →</button>
          </div>
          {pendingIdeas.length === 0 && <div className="dash-empty">还没攒选题，去热点雷达收藏几个吧</div>}
          {pendingIdeas.slice(0, 5).map((it) => (
            <div key={it.id} className="dash-idea" onClick={() => onUseTopic(it.title)} title="点击做成内容">
              <span className="dash-idea-title">{it.title}</span>
              {it.source && <span className="badge">{it.source}</span>}
            </div>
          ))}
        </div>

        {/* 近期排期 */}
        <div className="card dash-card">
          <div className="dash-card-head">
            <span><IconCalendar size={16} /> 近期排期</span>
            <button className="dash-more" onClick={() => onNavigate('calendar')}>日历 →</button>
          </div>
          {upcoming.length === 0 && <div className="dash-empty">暂无排期，去日历安排一条吧</div>}
          {upcoming.map((s) => (
            <div key={s.id} className="dash-sched" onClick={() => onNavigate('calendar')}>
              <span className="dash-sched-date">{s.date.slice(5)}</span>
              <span className="dash-sched-title">{s.platform ? `[${s.platform}] ` : ''}{s.title}</span>
              <span className="badge">{STATUS_LABEL[s.status] || s.status}</span>
            </div>
          ))}
        </div>

        {/* 最近产物 */}
        <div className="card dash-card dash-card-top">
          <div className="dash-card-head">
            <span><IconOutputs size={16} /> 最近产物</span>
            <button className="dash-more" onClick={() => onNavigate('outputs')}>内容库 →</button>
          </div>
          {recent.length === 0 && <div className="dash-empty">还没有产物，去对话生成第一条吧</div>}
          {recent.map((g) => (
            <div key={g.name} className="dash-output" onClick={() => onNavigate('outputs')}>
              <span className="dash-output-name">{g.meta?.title || g.name}</span>
              <span className="badge">{g.meta?.platform || (g.type === 'dir' ? `${g.fileCount ?? 0} 文件` : '单文件')}</span>
            </div>
          ))}
        </div>

        {/* 创作数据（归因层）：全览每个账号，或切到单账号看详情（粉丝/获赞/关注 + 多窗口增长 + 近7日环比 + 最新笔记） */}
        <div className="card dash-card dash-card-wide">
          {(() => {
            const anaKeys = new Set(anaPlats.map((p) => p.platform));
            const order = (platform: string) => anaPlats.findIndex((p) => p.platform === platform);
            const anaAccounts = accounts
              .filter((a) => anaKeys.has(a.platform))
              .sort((a, b) => order(a.platform) - order(b.platform) || a.name.localeCompare(b.name, 'zh'));
            const isLogged = (a: AccountItem) => a.loggedIn || !!whoamiMap[a.id]?.loggedIn;
            const sel = anaSel ? anaAccounts.find((a) => a.id === anaSel) : undefined;
            const d = anaSel ? anaData[anaSel] : undefined;

            return (
              <>
                <div className="dash-card-head">
                  <span><IconAccounts size={16} /> 创作数据</span>
                  {anaSel === '' && anaOverview !== 'loading' && (
                    <button className="dash-more" onClick={reloadOverview}>重读归档 →</button>
                  )}
                  {anaSel !== '' && d !== undefined && d !== 'loading' && sel !== undefined && (
                    <button className="dash-more" onClick={() => runAna(sel)}>刷新 →</button>
                  )}
                </div>

                {anaPlats.length === 0 && <div className="dash-empty">加载中 / 需配置代理</div>}
                {anaPlats.length > 0 && anaAccounts.length === 0 && (
                  <div className="dash-empty" onClick={() => onNavigate('accounts')} style={{ cursor: 'pointer' }}>
                    去账号页登录后，这里看每个账号的粉丝 / 获赞 / 关注、增长趋势与最新笔记 →
                  </div>
                )}

                {anaAccounts.length > 0 && (
                  <>
                    <div className="ana-plats">
                      <button className={`chip ${anaSel === '' ? 'active' : ''}`} onClick={() => setAnaSel('')}>全览</button>
                      {anaAccounts.map((a) => (
                        <button
                          key={a.id}
                          className={`chip ${anaSel === a.id ? 'active' : ''} ${isLogged(a) ? '' : 'ana-chip-off'}`}
                          title={isLogged(a) ? `${platformLabel(a.platform)}「${a.name}」` : `${platformLabel(a.platform)}「${a.name}」未登录，去账号页登录`}
                          onClick={() => (isLogged(a) ? runAna(a) : onNavigate('accounts'))}
                        >
                          {platformLabel(a.platform)}·{a.name}
                        </button>
                      ))}
                    </div>

                    {/* 全览：每个账号一张卡（读归档，不启浏览器）；点卡进详情 */}
                    {anaSel === '' && (() => {
                      if (anaOverview === 'loading') {
                        return <div className="loading" style={{ padding: '24px 0' }}><div className="spinner" />读归档…</div>;
                      }
                      if (anaOverview === 'error') {
                        return <div className="dash-empty" style={{ color: 'var(--red)' }}>读取归档失败，点「重读归档」重试</div>;
                      }
                      return (
                        <>
                          <div className="ana-wins ana-wins-head">
                            {WIN.map(([k, lab]) => (
                              <button key={k} className={`ana-win ${anaWin === k ? 'on' : ''}`}
                                onClick={() => setAnaWin(k)}>{lab}</button>
                            ))}
                          </div>
                          <div className="ana-grid">
                            {anaAccounts.map((a) => {
                              const row = anaOverview.find((r) => r.id === a.id);
                              const logged = isLogged(a);
                              const g = growthInfo(row?.growth?.[anaWin]?.followers ?? null);
                              return (
                                <button
                                  key={a.id}
                                  className={`ana-acct ${logged ? '' : 'off'}`}
                                  title={logged ? `查看${platformLabel(a.platform)}「${a.name}」详情` : '未登录，去账号页登录'}
                                  onClick={() => (logged ? runAna(a) : onNavigate('accounts'))}
                                >
                                  <span className="ana-acct-top">
                                    <span className="ana-acct-plat">{platformLabel(a.platform)}</span>
                                    {a.persona !== '' && <span className="badge">{a.persona}</span>}
                                  </span>
                                  <span className="ana-acct-name">{a.name}</span>
                                  {row !== undefined && row.latest !== null ? (
                                    <>
                                      <span className="ana-acct-num">
                                        {fmtNum(row.latest.followers)}<span className="ana-acct-unit">粉丝</span>
                                      </span>
                                      <span className="ana-acct-delta">
                                        {g ? (
                                          <>
                                            <span style={{ color: g.color }}>{g.text}</span>
                                            <span className="ana-acct-win">{WIN.find(([k]) => k === anaWin)?.[1]}</span>
                                          </>
                                        ) : <span className="ana-muted">无对比基线</span>}
                                      </span>
                                      <Sparkline points={row.points} />
                                      <span className="ana-acct-sub">获赞 {fmtNum(row.latest.likes)} · {ageLabel(row.ageDays)}</span>
                                    </>
                                  ) : (
                                    <span className="ana-acct-empty">
                                      {row?.archived === false ? '该平台不写归档 · 点开实时抓取'
                                        : logged ? '尚未采集 · 点开抓一次' : '未登录 · 去账号页'}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}

                    {/* 详情：单个账号（实时抓取，写入该账号自己的归档） */}
                    {anaSel !== '' && (() => {
                      if (sel === undefined) return <div className="dash-empty">账号已不存在，点「全览」刷新</div>;
                      if (d === undefined) return <div className="dash-empty">点上方账号查看该账号数据</div>;
                      if (d === 'loading') {
                        return <div className="loading" style={{ padding: '28px 0' }}><div className="spinner" />抓取中…（起浏览器，约数秒）</div>;
                      }
                      if (d === 'error') {
                        return <div className="dash-empty" style={{ color: 'var(--red)' }}>抓取失败（未登录 / 需真机校准），点「刷新」重试</div>;
                      }
                      if (!d.loggedIn) {
                        return (
                          <div className="dash-empty" onClick={() => onNavigate('accounts')} style={{ cursor: 'pointer' }}>
                            {platformLabel(sel.platform)}「{sel.name}」登录态已失效，去账号页重登 →
                          </div>
                        );
                      }
                      return (
                        <div className="ana-body">
                          {/* 概览 + 增长对比 */}
                          <div className="ana-col ana-col-main">
                            <div className="ana-id">
                              {platformLabel(sel.platform)}「{sel.name}」{d.nickname ? ` · @${d.nickname}` : ''}
                            </div>
                            <div className="ana-overview">
                              {([['粉丝', 'followers'], ['获赞', 'likes'], ['关注', 'following']] as const).map(([label, key]) => {
                                const w = d.growth?.[anaWin] ?? null;
                                const g = w ? growthInfo(w[key as 'followers' | 'likes']) : null;
                                return (
                                  <div key={key} className="ana-stat">
                                    <div className="ana-stat-val">{fmtNum(d[key])}</div>
                                    <div className="ana-stat-label">{label}</div>
                                    {g ? <div className="ana-stat-delta" style={{ color: g.color }}>{g.text}</div>
                                      : <div className="ana-stat-delta ana-muted">—</div>}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="ana-wins">
                              {WIN.map(([k, lab]) => (
                                <button key={k} className={`ana-win ${anaWin === k ? 'on' : ''}`}
                                  onClick={() => setAnaWin(k)}>{lab}</button>
                              ))}
                            </div>
                            <div className="ana-wins-note">
                              {d.growth?.[anaWin]?.since_days != null
                                ? `对比 ${d.growth[anaWin]!.since_days} 天前的快照`
                                : '暂无该时段历史快照，多刷新几次即可积累对比'}
                            </div>
                          </div>

                          {/* 近7日平台指标 + 环比 */}
                          <div className="ana-col ana-col-metrics">
                            <div className="ana-sub">近 7 日 · 环比</div>
                            {(d.metrics ?? []).length === 0 ? (
                              <div className="dash-empty">该平台未提供近 7 日指标</div>
                            ) : (
                              <div className="ana-metrics">
                                {(d.metrics ?? []).map((m) => {
                                  const vs = m.vs ?? '';
                                  const up = vs.startsWith('+');
                                  const has = vs && vs !== '-';
                                  return (
                                    <div key={m.label} className="ana-metric">
                                      <div className="ana-metric-val">{m.value}</div>
                                      <div className="ana-metric-label">{m.label}</div>
                                      {has && <div className="ana-metric-vs" style={{ color: up ? 'var(--trend-up)' : 'var(--trend-down)' }}>环比{vs}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 最新笔记（可点进原文） */}
                          <div className="ana-col ana-col-notes">
                            <div className="ana-sub">最新笔记</div>
                            {(d.notes ?? []).length === 0 ? (
                              <div className="dash-empty">该账号暂无可读取的已发布笔记</div>
                            ) : (
                              <div className="ana-notes">
                                {(d.notes ?? []).slice(0, 6).map((n, i) => (
                                  <a key={i} className="ana-note" href={n.url} target="_blank" rel="noreferrer" title={n.title}>
                                    {n.cover
                                      ? <img className="ana-note-cover" src={n.cover} alt="" referrerPolicy="no-referrer" />
                                      : <span className="ana-note-cover ana-note-cover-ph">📝</span>}
                                    <span className="ana-note-main">
                                      <span className="ana-note-title">{n.title || '(无标题)'}</span>
                                      {n.stat && <span className="ana-note-stat">{n.stat}</span>}
                                    </span>
                                    <span className="ana-note-go">↗</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
