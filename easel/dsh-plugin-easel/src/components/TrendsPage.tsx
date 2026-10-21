import { useState, useEffect, useCallback } from 'react';
import { fetchTrends, createIdea, fetchRadarConfig, saveRadarConfig } from '../lib/api';
import type { TrendGroup, RadarConfig, RadarSource } from '../lib/api';
import { IconFire, IconRefresh, IconBookmark, IconCheck } from './icons';

interface TrendsPageProps {
  onUseTopic: (title: string) => void;   // 一键做成内容 → 跳 chat
}

const ALL_PLATFORMS: { key: string; label: string }[] = [
  { key: 'weibo', label: '微博' },
  { key: 'douyin', label: '抖音' },
  { key: 'zhihu', label: '知乎' },
  { key: 'bilibili', label: 'B站' },
  { key: 'baidu', label: '百度' },
  { key: 'toutiao', label: '头条' },
];

/** 热点雷达的「源与代理」设置抽屉：自定义源（RSS/RSSHub/JSON）+ 代理 + CDP 端点。 */
function RadarSettings({ cfg, onSaved, onClose }: {
  cfg: RadarConfig;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RadarConfig>(() => ({
    ...cfg, sources: cfg.sources.map((s) => ({ ...s })),
  }));
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
            应用于热点抓取与账号登录。环境变量 EASEL_PROXY=
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
  const [selected, setSelected] = useState<string[]>(['weibo', 'douyin', 'zhihu']);
  const [groups, setGroups] = useState<TrendGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [radarCfg, setRadarCfg] = useState<RadarConfig | null>(null);
  // 自定义源的分类筛选：'' = 全部显示；选中的分类只影响自定义源卡片的可见性
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadRadar = useCallback(() => {
    fetchRadarConfig().then(setRadarCfg).catch(() => {});
  }, []);

  const save = async (title: string, source: string) => {
    if (saved.has(title)) return;
    try {
      await createIdea({ title, source: `${source}热搜`, status: 'pending' });
      setSaved((prev) => new Set(prev).add(title));
    } catch { /* ignore */ }
  };

  const load = useCallback((pfs: string[]) => {
    setLoading(true);
    setError('');
    fetchTrends(pfs.join(','), 15)
      .then((d) => { setGroups(d.trends); setUpdated(d.updated); })
      .catch(() => setError('热点拉取失败——请确认已配置外网代理（EASEL_PROXY 或热点页设置）。'))
      .finally(() => setLoading(false));
  }, []);

  const loadAll = useCallback(() => { load(selected); loadRadar(); }, [load, selected, loadRadar]);
  useEffect(() => { loadAll(); }, []);   // 挂载拉一次（含自定义源与配置）

  const toggle = (k: string) => {
    const next = selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k];
    setSelected(next);
    load(next);   // 内置平台的勾选即时生效；自定义源不受影响，始终随响应返回
  };

  // 自定义源的分组（platform 形如 custom:名字）与其分类标签
  const customGroups = groups.filter((g) => g.platform.startsWith('custom:'));
  const categories = Array.from(new Set(customGroups.map((g) => (g as TrendGroup & { category?: string }).category || '自定义')));
  const visibleCustom = categoryFilter === ''
    ? customGroups
    : customGroups.filter((g) => (g as TrendGroup & { category?: string }).category === categoryFilter);
  const builtinGroups = groups.filter((g) => !g.platform.startsWith('custom:'));

  return (
    <div className="page-scroll trends-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconFire size={22} /> 热点雷达</h1>
          <p className="page-subtitle">
            多平台实时热搜，挑值得蹭的选题，一键交给 AI 做成你的内容。
            {updated > 0 && <span style={{ color: 'var(--text-tertiary)' }}> · {new Date(updated * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setSettingsOpen(true)} title="自定义源 / 代理 / CDP 端点">⚙ 源与代理</button>
          <button className="btn btn-sm" onClick={loadAll} disabled={loading}>
            <IconRefresh size={14} /> {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>

      <div className="trend-platforms">
        {ALL_PLATFORMS.map((p) => (
          <button key={p.key} className={`chip ${selected.includes(p.key) ? 'active' : ''}`}
            onClick={() => toggle(p.key)}>{p.label}</button>
        ))}
      </div>

      {error && <div className="notice-error">{error}</div>}

      {customGroups.length > 0 && categories.length > 0 && (
        <div className="trend-platforms" style={{ marginTop: -4 }}>
          <button className={`chip ${categoryFilter === '' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('')}>全部类型</button>
          {categories.map((c) => (
            <button key={c} className={`chip ${categoryFilter === c ? 'active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}>{c}</button>
          ))}
        </div>
      )}

      <div className="trend-grid">
        {visibleCustom.map((g) => (
          <div key={g.platform} className="card trend-col">
            <div className="trend-col-head">{g.label}<span className="trend-count">{g.items.length}</span></div>
            <div className="trend-list">
              {g.items.length === 0 && !loading && (
                <div className="trend-empty">
                  {g.ok === false ? '该源暂时取不到（检查 URL/网络/代理）' : '暂无数据'}
                </div>
              )}
              {g.items.map((it, i) => (
                <div key={i} className="trend-item">
                  <span className={`trend-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
                  <div className="trend-main">
                    <a className="trend-title" href={it.url || undefined} target="_blank" rel="noreferrer"
                      title={it.title}>{it.title}</a>
                    {it.hot && <span className="trend-hot">{it.hot}</span>}
                  </div>
                  <button className="trend-save" title={saved.has(it.title) ? '已收藏到选题库' : '收藏到选题库'}
                    onClick={() => save(it.title, g.label)}>
                    {saved.has(it.title) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
                  </button>
                  <button className="trend-use" title="做成内容"
                    onClick={() => onUseTopic(it.title)}>做内容</button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {builtinGroups.map((g) => (
          <div key={g.platform} className="card trend-col">
            <div className="trend-col-head">{g.label}<span className="trend-count">{g.items.length}</span></div>
            <div className="trend-list">
              {g.items.length === 0 && !loading && (
                <div className="trend-empty">
                  {g.ok === false ? '该平台暂时取不到（数据源不可用）' : '暂无数据'}
                </div>
              )}
              {g.items.map((it, i) => (
                <div key={i} className="trend-item">
                  <span className={`trend-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
                  <div className="trend-main">
                    <a className="trend-title" href={it.url || undefined} target="_blank" rel="noreferrer"
                      title={it.title}>{it.title}</a>
                    {it.hot && <span className="trend-hot">{it.hot}</span>}
                  </div>
                  <button className="trend-save" title={saved.has(it.title) ? '已收藏到选题库' : '收藏到选题库'}
                    onClick={() => save(it.title, g.label)}>
                    {saved.has(it.title) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
                  </button>
                  <button className="trend-use" title="做成内容"
                    onClick={() => onUseTopic(it.title)}>做内容</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {settingsOpen && radarCfg && (
        <RadarSettings
          cfg={radarCfg}
          onSaved={() => { loadRadar(); load(selected); }}
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
