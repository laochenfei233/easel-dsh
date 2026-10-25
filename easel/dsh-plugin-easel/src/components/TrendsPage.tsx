import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTrends, createIdea, fetchRadarConfig, saveRadarConfig } from '../lib/api';
import type { TrendGroup, TrendItem, TrendCluster, WatchGroup, RadarConfig, RadarSource } from '../lib/api';
import { IconFire, IconRefresh, IconBookmark, IconCheck } from './icons';

interface TrendsPageProps {
  onUseTopic: (title: string) => void;   // 一键做成内容 → 跳 chat
}

const ALL_PLATFORMS: { key: string; label: string }[] = [
  { key: 'weibo', label: '微博' },
  { key: 'douyin', label: '抖音' },
  { key: 'douyin_rule', label: '抖音规则' },
  { key: 'douyin_activity', label: '抖音活动' },
  { key: 'zhihu', label: '知乎' },
  { key: 'bilibili', label: 'B站' },
  { key: 'baidu', label: '百度' },
  { key: 'toutiao', label: '头条' },
];

/** 一行可渲染的条目：源内条目 + 来源文案（data-easel-trend 与书签动作共用）。 */
interface RowRef extends TrendItem { platform: string; label: string; source: string; }

/** 源 → 选题来源文案（右键 payload 与书签共享同一份计算）。 */
function sourceOf(label: string): string {
  if (label === '抖音规则') return '抖音规则中心';
  if (label === '抖音活动') return '抖音创作者活动';
  return `${label}热搜`;
}

const fmtClock = (seconds?: number) =>
  seconds === undefined ? '' : new Date(seconds * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

/** 「升温」排序（纯前端，不重取）：新上榜优先 → 升幅降序 → 真实名次升序。 */
function sortItems(items: TrendItem[], rising: boolean): TrendItem[] {
  if (!rising) return items;
  return [...items].sort((a, b) =>
    Number(b.isNew === true) - Number(a.isNew === true)
    || (b.delta ?? 0) - (a.delta ?? 0)
    || (a.rank ?? 0) - (b.rank ?? 0));
}

/** 「首现 X 天 / X h」时长缩写。 */
const fmtAge = (ageMin: number): string =>
  ageMin >= 1440 ? `${Math.floor(ageMin / 1440)}天` : `${Math.floor(ageMin / 60)}h`;

function TrendBadges({ item }: { item: TrendItem }) {
  const delta = typeof item.delta === 'number' && item.delta !== 0 ? item.delta : null;
  return (
    <>
      {item.isNew && <span className="trend-badge trend-badge-new">新</span>}
      {delta === null ? null : (
        <span className={`trend-badge trend-badge-${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? `↑${delta}` : `↓${-delta}`}</span>
      )}
      {(item.watch ?? []).slice(0, 2).map((w) => <span key={w} className="trend-badge trend-badge-watch">{w}</span>)}
      {typeof item.ageMin === 'number' && item.ageMin >= 60 && <span className="trend-age">首现 {fmtAge(item.ageMin)}</span>}
    </>
  );
}

/** 单条热点：真实榜位 + 标题 + 热度 + 徽标 + 收藏/做内容；整行是右键菜单面。 */
function TrendRow({ row, showPlatform, saved, onSave, onUse }: {
  row: RowRef;
  showPlatform?: boolean;
  saved: boolean;
  onSave: () => void;
  onUse: () => void;
}) {
  const payload = JSON.stringify({
    title: row.title, url: row.url, source: row.source, platform: row.platform, rank: row.rank, hot: row.hot,
  });
  const rank = row.rank ?? 0;
  return (
    <div className="trend-item" data-easel-trend={payload}>
      <span className={`trend-rank ${rank > 0 && rank <= 3 ? 'top' : ''}`}>{rank || '·'}</span>
      {showPlatform && <span className="trend-plat">{row.label}</span>}
      <div className="trend-main">
        <a className="trend-title" href={row.url || undefined} target="_blank" rel="noreferrer"
          title={row.title}>{row.title}</a>
        <div className="trend-meta">
          {row.hot && <span className="trend-hot">{row.hot}</span>}
          <TrendBadges item={row} />
        </div>
      </div>
      <button className="trend-save" title={saved ? '已收藏到选题库' : '收藏到选题库'}
        onClick={onSave}>
        {saved ? <IconCheck size={14} /> : <IconBookmark size={14} />}
      </button>
      <button className="trend-use" title="做成内容" onClick={onUse}>做内容</button>
    </div>
  );
}

interface RowHandlers {
  isSaved: (title: string) => boolean;
  onSave: (row: RowRef) => void;
  onUse: (title: string) => void;
}

/** 分列视图的一列（内置平台与自定义源同构）。 */
function TrendColumn({ group, rising, loading, isSaved, onSave, onUse }: {
  group: TrendGroup & { source: string };
  rising: boolean;
  loading: boolean;
} & RowHandlers) {
  const items = useMemo(() => sortItems(group.items, rising), [group.items, rising]);
  return (
    <div className="card trend-col">
      <div className="trend-col-head">
        {group.label}
        {group.stale && (
          <span className="trend-stale" title="内容来自最近一次成功快照">离线{group.at ? ` · 上次 ${fmtClock(group.at)}` : ''}</span>
        )}
        <span className="trend-count">{group.items.length}</span>
      </div>
      <div className="trend-list">
        {items.length === 0 && !loading && (
          <div className="trend-empty">
            {group.ok === false ? '该平台暂时取不到（数据源不可用）' : '暂无数据'}
          </div>
        )}
        {items.map((it, i) => {
          const row: RowRef = { ...it, platform: group.platform, label: group.label, source: group.source };
          return (
            <TrendRow key={it.url || `${it.title}-${i}`} row={row} saved={isSaved(it.title)}
              onSave={() => onSave(row)} onUse={() => onUse(it.title)} />
          );
        })}
      </div>
    </div>
  );
}

/** 「我的关注」置顶卡：每个命中词一行，各词最多 3 条。 */
function WatchCard({ watch, isSaved, onSave, onUse }: { watch: WatchGroup[] } & RowHandlers) {
  const total = watch.reduce((sum, g) => sum + g.items.length, 0);
  const newCount = watch.reduce((sum, g) => sum + g.items.filter((it) => it.isNew).length, 0);
  const shown = watch.slice(0, 5);
  return (
    <div className="card trend-watch-card">
      <div className="trend-col-head">
        我的关注
        <span className="trend-count">命中 {total} 条{newCount > 0 ? ` · 新 ${newCount}` : ''}</span>
      </div>
      {shown.map((g) => (
        <div key={g.keyword} className="trend-watch-group">
          <span className="trend-watch-key">{g.keyword}</span>
          <div className="trend-watch-items">
            {g.items.slice(0, 3).map((it, i) => {
              const row: RowRef = { ...it, source: sourceOf(it.label) };
              return (
                <TrendRow key={it.platform + (it.url || it.title) + i} row={row} showPlatform
                  saved={isSaved(it.title)} onSave={() => onSave(row)} onUse={() => onUse(it.title)} />
              );
            })}
          </div>
          {g.items.length > 3 && <span className="trend-more">还有 {g.items.length - 3} 条 · </span>}
        </div>
      ))}
      {watch.length > 5 && <div className="trend-more">还有 {watch.length - 5} 个词命中</div>}
    </div>
  );
}

/** 跨平台聚合卡：代表标题 + 平台标签；卡内各平台条目仍可单独右键。 */
function ClusterCard({ cluster, isSaved, onSave, onUse }: { cluster: TrendCluster } & RowHandlers) {
  const rep = cluster.items[0];
  const shownLabels = cluster.labels.slice(0, 4);
  const extra = cluster.labels.length - shownLabels.length;
  const source = `跨平台热搜（${cluster.labels.join('/')}）`;
  const payload = JSON.stringify({
    title: cluster.title, url: rep?.url ?? '', source,
    platform: cluster.platforms.join(','), rank: cluster.bestRank,
  });
  return (
    <div className="card trend-cluster">
      <div className="trend-cluster-head" data-easel-trend={payload}>
        <div className="trend-main">
          <a className="trend-title" href={rep?.url || undefined} target="_blank" rel="noreferrer"
            title={cluster.title}>{cluster.title}</a>
          <div className="trend-meta">
            <span className="trend-hot">{cluster.platforms.length} 平台在榜 · 最高第 {cluster.bestRank}</span>
            {cluster.isNew && <span className="trend-badge trend-badge-new">新</span>}
          </div>
        </div>
        <div className="trend-cluster-actions">
          <button className="trend-save" title={isSaved(cluster.title) ? '已收藏到选题库' : '收藏到选题库'}
            onClick={() => onSave({
              title: cluster.title, url: rep?.url ?? '', hot: '',
              platform: cluster.platforms.join(','), label: '聚合', source,
            })}>
            {isSaved(cluster.title) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
          </button>
          <button className="trend-use" title="做成内容" onClick={() => onUse(cluster.title)}>做内容</button>
        </div>
      </div>
      <div className="trend-cluster-platforms">
        {shownLabels.map((label) => <span key={label} className="trend-chip">{label}</span>)}
        {extra > 0 && <span className="trend-more">+{extra}</span>}
      </div>
      <div className="trend-list">
        {cluster.items.map((it, i) => {
          const row: RowRef = { ...it, source: sourceOf(it.label) };
          return (
            <TrendRow key={it.platform + (it.url || it.title) + i} row={row} showPlatform
              saved={isSaved(it.title)} onSave={() => onSave(row)} onUse={() => onUse(it.title)} />
          );
        })}
      </div>
    </div>
  );
}

/** 热点雷达的「源与代理」设置抽屉：关注词 + 自定义源（RSS/RSSHub/JSON）+ 代理 + CDP 端点。 */
function RadarSettings({ cfg, onSaved, onClose }: {
  cfg: RadarConfig;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RadarConfig>(() => ({
    ...cfg, sources: cfg.sources.map((s) => ({ ...s })), keywords: [...(cfg.keywords ?? [])],
  }));
  const [keywordText, setKeywordText] = useState((cfg.keywords ?? []).join(' '));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const updSource = (i: number, patch: Partial<RadarSource>) => {
    setDraft((d) => ({ ...d, sources: d.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  };
  const addSource = () => {
    setDraft((d) => ({
      ...d,
      sources: [...d.sources, { name: '', url: '', kind: 'rss' as const, category: '自定义', enabled: true }],
    }));
  };
  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const cleaned = {
        ...draft,
        proxyUrl: draft.proxyUrl.trim(),
        cdpEndpoint: draft.cdpEndpoint.trim(),
        keywords: keywordText.split(/[\s,，、;；]+/).map((s) => s.trim()).filter(Boolean),
        sources: draft.sources
          .filter((s) => s.name.trim() && s.url.trim())
          .map((s) => ({ ...s, name: s.name.trim(), url: s.url.trim(), category: s.category.trim() || '自定义' })),
      };
      await saveRadarConfig(cleaned);
      setMsg('已保存');
      onSaved();
      setTimeout(onClose, 500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const field = { width: '100%', boxSizing: 'border-box' as const, padding: '8px 10px',
    border: '0.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13 };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 620, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px' }}>热点雷达 · 源与代理</h3>

        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>关注词</div>
          <input style={field} placeholder="用逗号或空格分隔，例如：AI 考研 新能源汽车"
            value={keywordText}
            onChange={(e) => setKeywordText(e.target.value)} />
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            命中的热点会在页面顶部「我的关注」置顶（最多 20 个，每个 1–24 字）。
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>代理</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...field, flex: 1 }} placeholder="socks5://127.0.0.1:1080 或 http://… （留空=直连）"
              value={draft.proxyUrl}
              onChange={(e) => setDraft((d) => ({ ...d, proxyUrl: e.target.value }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={draft.proxyEnabled}
                onChange={(e) => setDraft((d) => ({ ...d, proxyEnabled: e.target.checked }))} />
              启用
            </label>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            应用于热点抓取、正文抓取与账号登录。环境变量 EASEL_PROXY=
            <code>{cfg.proxyEnv || '（未设）'}</code> 会被这里的配置覆盖。
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>CDP 接管端点（账号页「接管 Chrome」用）</div>
          <input style={field} placeholder="http://127.0.0.1:9222"
            value={draft.cdpEndpoint}
            onChange={(e) => setDraft((d) => ({ ...d, cdpEndpoint: e.target.value }))} />
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Chrome 需以 <code>chrome --remote-debugging-port=9222</code> 启动后，登录按钮选「接管 Chrome」。
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>自定义源（支持 RSS / RSSHub / JSON）</div>
            <button className="btn btn-sm" onClick={addSource}>+ 添加源</button>
          </div>
          {draft.sources.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              还没有自定义源。例：RSSHub 路由 <code>http://你的实例:1200/36kr/newsflashes</code>，
              分类填「科技」即可在热点页按类型筛选。
            </div>
          )}
          {draft.sources.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 74px 90px auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input style={field} placeholder="名称" value={s.name}
                onChange={(e) => updSource(i, { name: e.target.value })} />
              <input style={field} placeholder="http://…（RSSHub 路由或 JSON 热点接口）" value={s.url}
                onChange={(e) => updSource(i, { url: e.target.value })} />
              <select style={field} value={s.kind} onChange={(e) => updSource(i, { kind: e.target.value as 'rss' | 'json' })}>
                <option value="rss">RSS</option>
                <option value="json">JSON</option>
              </select>
              <input style={field} placeholder="分类" value={s.category}
                onChange={(e) => updSource(i, { category: e.target.value })} />
              <button className="btn btn-sm" title="删除" onClick={() => setDraft((d) => ({ ...d, sources: d.sources.filter((_, j) => j !== i) }))}>✕</button>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            分类 = 热点页的类型筛选标签；一条源只归一类（参考 news-radar-pusher 的源→组映射）。
          </div>
        </div>

        {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        {msg && <div style={{ color: 'var(--green)', fontSize: 12.5, marginBottom: 8 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

export default function TrendsPage({ onUseTopic }: TrendsPageProps) {
  const [selected, setSelected] = useState<string[]>(['weibo', 'douyin', 'zhihu', 'douyin_rule', 'douyin_activity']);
  const [groups, setGroups] = useState<TrendGroup[]>([]);
  const [clusters, setClusters] = useState<null | TrendCluster[]>(null);
  const [watch, setWatch] = useState<WatchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [radarCfg, setRadarCfg] = useState<RadarConfig | null>(null);
  // 视图与排序；聚合视图首次切换才带 view=cluster 请求（响应里仍含 trends）
  const [viewMode, setViewMode] = useState<'list' | 'cluster'>('list');
  const [rising, setRising] = useState(false);
  // 自定义源的分类筛选：'' = 全部显示；选中的分类只影响自定义源卡片的可见性
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadRadar = useCallback(() => {
    fetchRadarConfig().then(setRadarCfg).catch(() => {});
  }, []);

  const save = async (title: string, source: string) => {
    if (saved.has(title)) return;
    try {
      await createIdea({ title, source, status: 'pending' });
      setSaved((prev) => new Set(prev).add(title));
    } catch { /* ignore */ }
  };

  const load = useCallback((pfs: string[], options: { view?: 'list' | 'cluster'; force?: boolean } = {}) => {
    setLoading(true);
    setError('');
    fetchTrends(pfs.join(','), 15, options)
      .then((d) => {
        setGroups(d.trends);
        setWatch(d.watch ?? []);
        setUpdated(d.updated);
        if (d.clusters !== undefined) setClusters(d.clusters);
      })
      .catch(() => setError('热点拉取失败——请确认已配置外网代理（EASEL_PROXY 或热点页设置）。'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(selected); loadRadar(); }, []);   // 挂载拉一次（list 视图 + 关注词）

  // 右键菜单入库后同步书签标记
  useEffect(() => {
    const onSaved = (event: Event) => {
      const title = (event as CustomEvent<{ title?: string }>).detail?.title;
      if (title) setSaved((prev) => new Set(prev).add(title));
    };
    window.addEventListener('easel:trend-saved', onSaved);
    return () => window.removeEventListener('easel:trend-saved', onSaved);
  }, []);

  const refreshAll = useCallback(() => {
    load(selected, viewMode === 'cluster' ? { view: 'cluster', force: true } : { force: true });
    loadRadar();
  }, [load, selected, viewMode, loadRadar]);

  const toggle = (k: string) => {
    const next = selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k];
    setSelected(next);
    // 内置平台的勾选即时生效；自定义源不受影响，始终随响应返回
    load(next, viewMode === 'cluster' ? { view: 'cluster' } : {});
  };

  const toggleView = () => {
    const next = viewMode === 'list' ? 'cluster' : 'list';
    setViewMode(next);
    if (next === 'cluster' && clusters === null) load(selected, { view: 'cluster' });
  };

  const handlers: RowHandlers = useMemo(() => ({
    isSaved: (title) => saved.has(title),
    onSave: (row) => { void save(row.title, row.source); },
    onUse: (title) => { onUseTopic(title); },
  }), [saved, onUseTopic]);   // save 以闭包读最新 saved；handlers 随 saved 重建

  // 自定义源的分组与其分类标签
  const customGroups = groups.filter((g) => g.platform.startsWith('custom:'));
  const categories = Array.from(new Set(customGroups.map((g) => g.category || '自定义')));
  const visibleCustom = categoryFilter === ''
    ? customGroups
    : customGroups.filter((g) => g.category === categoryFilter);
  const columns = [
    ...builtinColumns(groups),
    ...visibleCustom.map((g) => ({ ...g, source: sourceOf(g.label) })),
  ];

  return (
    <div className="page-scroll trends-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconFire size={22} /> 热点雷达</h1>
          <p className="page-subtitle">
            多平台实时热搜：看升跌、跨平台同题、盯着你的关注词，右键把正文抓进内容库与选题库。
            {updated > 0 && <span style={{ color: 'var(--text-tertiary)' }}> · {new Date(updated * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 数据</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setSettingsOpen(true)} title="关注词 / 自定义源 / 代理 / CDP 端点">⚙ 源与代理</button>
          <button className="btn btn-sm" onClick={refreshAll} disabled={loading}>
            <IconRefresh size={14} /> {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>

      <div className="trend-platforms">
        {ALL_PLATFORMS.map((p) => (
          <button key={p.key} className={`chip ${selected.includes(p.key) ? 'active' : ''}`}
            onClick={() => toggle(p.key)}>{p.label}</button>
        ))}
        <span className="trend-viewsep" />
        <button className={`chip ${viewMode === 'list' ? 'active' : ''}`} onClick={toggleView}>分平台</button>
        <button className={`chip ${viewMode === 'cluster' ? 'active' : ''}`} onClick={toggleView}>聚合</button>
        <button className={`chip ${rising ? 'active' : ''}`} onClick={() => setRising(!rising)}
          title={rising ? '恢复榜单原序' : '按升幅重排（不重新请求）'}>
          {rising ? '升温 ✓' : '升温'}
        </button>
      </div>

      {error && <div className="notice-error">{error}</div>}

      {watch.length > 0 && <WatchCard watch={watch} {...handlers} />}

      {viewMode === 'list' && categories.length > 0 && (
        <div className="trend-platforms" style={{ marginTop: -4 }}>
          <button className={`chip ${categoryFilter === '' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('')}>全部类型</button>
          {categories.map((c) => (
            <button key={c} className={`chip ${categoryFilter === c ? 'active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}>{c}</button>
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="trend-grid">
          {columns.map((g) => (
            <TrendColumn key={g.platform} group={g} rising={rising} loading={loading} {...handlers} />
          ))}
        </div>
      )}

      {viewMode === 'cluster' && (
        <div className="trend-grid">
          {(clusters ?? []).map((c) => (
            <ClusterCard key={c.id} cluster={c} {...handlers} />
          ))}
          {!loading && clusters !== null && clusters.length === 0 && (
            <div className="trend-empty">当前源之间没有同题聚类。</div>
          )}
        </div>
      )}

      {settingsOpen && radarCfg && (
        <RadarSettings
          cfg={radarCfg}
          onSaved={() => { loadRadar(); load(selected, viewMode === 'cluster' ? { view: 'cluster' } : {}); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {settingsOpen && !radarCfg && (
        <div className="overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" style={{ padding: 30 }} onClick={(e) => e.stopPropagation()}>
            <div className="loading"><div className="spinner" />加载配置…</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 内置平台的列视图（label 即平台名，来源文案 = 「<label>热搜」）。 */
function builtinColumns(groups: TrendGroup[]): (TrendGroup & { source: string })[] {
  return groups
    .filter((g) => !g.platform.startsWith('custom:'))
    .map((g) => ({ ...g, source: sourceOf(g.label) }));
}
