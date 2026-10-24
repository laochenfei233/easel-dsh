import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchSchedule, createSchedule, updateSchedule, deleteSchedule, fetchScheduleContext,
  fetchCaldavAccounts, putCaldavAccounts, discoverCaldav, syncCaldav, fetchCaldavEvents } from '../lib/api';
import type { ScheduleItem, ScheduleInput, ScheduleContext, CaldavAccount, CaldavEvent, CaldavCalendarRef } from '../lib/api';
import { festivalsFor } from '../lib/festivals';
import { IconCalendar, IconTrash, IconChevron } from './icons';

const STATUS_META: Record<string, { label: string; color: string }> = {
  idea: { label: '选题', color: 'var(--text-tertiary)' },
  draft: { label: '草稿', color: 'var(--layer-plan)' },
  scheduled: { label: '待发', color: 'var(--layer-attribute)' },
  published: { label: '已发', color: 'var(--layer-publish)' },
};
const EVENT_COLOR = 'var(--layer-discover)';
const EVENT_TYPES = ['节日', '电商', '平台活动', '行业'];
const SOURCE_LABEL: Record<string, string> = {
  chat: '对话页', 'publish-page': '发布页', manual: '手动', scheduler: '排期',
};
const PLATFORMS = ['小红书', '抖音', 'B站', '微信视频号', '快手', '公众号', '微博', '知乎'];
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
type Filter = 'all' | 'content' | 'event';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const kindOf = (it: ScheduleItem) => (it.kind === 'event' ? 'event' : 'content');
const MAX_VISIBLE = 3;   // 每格最多显示几条，超出折叠成「+N 更多」→ 点开当天详情
const EMPTY: ScheduleInput = {
  title: '', date: '', platform: '', time: '', status: 'idea', note: '',
  kind: 'content', url: '', source: 'manual', event_type: '', end_date: '', repeat: '',
};

// CalDAV 事件覆盖的日期：全天 end 独占，定时端日为 00:00 也按独占处理
function eventDates(ev: CaldavEvent): string[] {
  const [startDate, startTime] = ev.start.split(' ');
  const [endDate, endTime] = (ev.end || ev.start).split(' ');
  const cursor = new Date(`${startDate}T00:00`);
  const last = new Date(`${endDate}T00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return [startDate];
  const endInclusive = startTime && endTime ? last : new Date(last.getTime() - 86400000);
  const dates: string[] = [];
  for (let d = new Date(cursor); d.getTime() <= endInclusive.getTime() && dates.length < 62; d.setDate(d.getDate() + 1)) {
    dates.push(ymd(d));
  }
  return dates.length > 0 ? dates : [startDate];
}

function syncAgo(ts?: number | null): string {
  if (!ts) return '未同步';
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return '刚刚同步';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前同步`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前同步`;
  return `${Math.floor(s / 86400)} 天前同步`;
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);   // 现有项
  const [form, setForm] = useState<ScheduleInput | null>(null);        // 弹窗表单（null=关闭）
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [ctx, setCtx] = useState<ScheduleContext | null>(null);
  const [showSuggest, setShowSuggest] = useState(true);
  const [dayView, setDayView] = useState<string | null>(null);   // 展开查看某天全部（date，null=关闭）

  // CalDAV 订阅
  const [caldav, setCaldav] = useState<CaldavAccount[]>([]);
  const [caldavByAccount, setCaldavByAccount] = useState<Record<string, { syncedAt: number; events: CaldavEvent[] }>>({});
  const [subOpen, setSubOpen] = useState(false);
  const [subDraft, setSubDraft] = useState<CaldavAccount | null>(null);   // 新增/编辑中的账号表单
  const [subCals, setSubCals] = useState<CaldavCalendarRef[] | null>(null);   // 探测结果（null=未探测）
  const [subBusy, setSubBusy] = useState('');
  const [subError, setSubError] = useState('');

  const loadCaldav = useCallback(() => {
    fetchCaldavAccounts().then((r) => setCaldav(r.accounts)).catch(() => {});
    fetchCaldavEvents().then((r) => setCaldavByAccount(r.byAccount || {})).catch(() => {});
  }, []);

  const load = useCallback(() => {
    fetchSchedule().then(setItems).catch(() => {});
    fetchScheduleContext(14).then(setCtx).catch(() => {});
    loadCaldav();
  }, [loadCaldav]);
  useEffect(() => { load(); }, [load]);

  // 挂载时过期账号（>24h 或从未同步）静默补一次同步
  useEffect(() => {
    let cancelled = false;
    fetchCaldavAccounts().then(async (r) => {
      const stale = r.accounts.filter((a) => a.enabled && (!a.syncedAt || Date.now() / 1000 - a.syncedAt > 86400));
      if (cancelled || stale.length === 0) return;
      await Promise.allSettled(stale.map((a) => syncCaldav(a.id)));
      if (!cancelled) fetchCaldavEvents().then((res) => setCaldavByAccount(res.byAccount || {})).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((it) => kindOf(it) === filter)),
    [items, filter]);

  // 构造当月网格（周一开头）
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;  // 周一=0
    const start = new Date(first); start.setDate(1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
  }, [cursor]);

  // 节假日底图：网格会露出前后月的日期，取三个月合并
  const festivalMap = useMemo(() => {
    const merged = new Map();
    for (const offset of [-1, 0, 1]) {
      const anchor = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
      for (const [ymd, list] of festivalsFor(anchor.getFullYear(), anchor.getMonth() + 1)) {
        if (!merged.has(ymd)) merged.set(ymd, list);
      }
    }
    return merged;
  }, [cursor]);

  // 每格：活动（事件）在上、内容在下；repeat: yearly 按 月/日 展开进可见窗口
  const byDate = useMemo(() => {
    const m: Record<string, { events: ScheduleItem[]; content: ScheduleItem[] }> = {};
    const push = (date: string, it: ScheduleItem) => {
      const bucket = (m[date] ||= { events: [], content: [] });
      (kindOf(it) === 'event' ? bucket.events : bucket.content).push(it);
    };
    for (const it of visible) {
      if (it.repeat === 'yearly' && /^\d{4}-\d{2}-\d{2}$/.test(it.date)) {
        const [, mo, dd] = it.date.split('-').map(Number);
        for (const d of cells) {
          if (d.getMonth() + 1 === mo && d.getDate() === dd) push(ymd(d), it);
        }
        continue;
      }
      push(it.date, it);
    }
    return m;
  }, [visible, cells]);

  // CalDAV 订阅事件按日展开（含多日事件逐日落格）
  const caldavByDate = useMemo(() => {
    const m: Record<string, { ev: CaldavEvent; acc: CaldavAccount }[]> = {};
    for (const [aid, bucket] of Object.entries(caldavByAccount)) {
      const acc = caldav.find((a) => a.id === aid);
      if (!acc || !acc.enabled) continue;
      for (const ev of bucket.events) {
        for (const ds of eventDates(ev)) (m[ds] ||= []).push({ ev, acc });
      }
    }
    return m;
  }, [caldavByAccount, caldav]);

  // 右键菜单（日期格上的添加节日/活动/排期入口）
  const [menu, setMenu] = useState<{ x: number; y: number; ds: string } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const openNew = (date: string) => {
    setDayView(null);
    setEditing(null);
    setForm({ ...EMPTY, date, kind: filter === 'event' ? 'event' : 'content' });
  };
  const openEdit = (it: ScheduleItem) => { setDayView(null); setEditing(it); setForm({ ...EMPTY, ...it }); };
  const close = () => { setForm(null); setEditing(null); };

  // 单条 chip（活动=色条，内容=按状态上色的圆点），日历格与当天详情共用
  const renderChip = (it: ScheduleItem) => {
    if (kindOf(it) === 'event') {
      return (
        <div key={it.id} className="cal-event is-event"
          title={it.event_type ? `${it.event_type}·${it.title}` : it.title}
          style={{ ['--ev' as string]: EVENT_COLOR }}
          onClick={(e) => { e.stopPropagation(); openEdit(it); }}>
          <span className="cal-event-dot" />
          <span className="cal-event-title">{it.title}</span>
        </div>
      );
    }
    return (
      <div key={it.id} className="cal-event" title={it.title}
        style={{ ['--ev' as string]: STATUS_META[it.status]?.color || 'var(--text-tertiary)' }}
        onClick={(e) => { e.stopPropagation(); openEdit(it); }}>
        <span className="cal-event-dot" />
        <span className="cal-event-title">{it.platform ? `[${it.platform}] ` : ''}{it.title}</span>
        {it.status === 'published' && it.source && SOURCE_LABEL[it.source]
          && <span className="cal-src">{SOURCE_LABEL[it.source]}</span>}
      </div>
    );
  };

  // CalDAV 只读 chip（空心圆点 + 账号色，点击不进编辑）
  const renderCaldavChip = (ev: CaldavEvent, acc: CaldavAccount) => (
    <div key={`cd-${ev.uid}-${ev.start}`} className="cal-event is-caldav"
      title={`${acc.name} · ${ev.title}`}
      style={{ ['--ev' as string]: acc.color || 'var(--text-tertiary)' }}
      onClick={(e) => e.stopPropagation()}>
      <span className="cal-event-dot" />
      <span className="cal-event-title">{ev.title}</span>
    </div>
  );

  const save = async () => {
    if (!form || !form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      if (editing) await updateSchedule(editing.id, form);
      else await createSchedule(form);
      close(); load();
    } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try { await deleteSchedule(editing.id); close(); load(); } finally { setSaving(false); }
  };

  const monthLabel = `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`;
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const todayStr = ymd(today);
  const isEvent = form?.kind === 'event';
  const suggestions = ctx?.suggestions || [];

  return (
    <div className="page-scroll calendar-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconCalendar size={21} /> 内容日历</h1>
          <p className="page-subtitle">每天各平台发什么一目了然——发布自动落库，可记录排期与平台活动。</p>
        </div>
        <div className="cal-nav">
          <button className="btn btn-sm" onClick={() => shift(-1)}><span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevron size={14} /></span></button>
          <button className="btn btn-sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>本月</button>
          <span className="cal-month">{monthLabel}</span>
          <button className="btn btn-sm" onClick={() => shift(1)}><IconChevron size={14} /></button>
          <button className="btn btn-sm" onClick={() => { setSubOpen(true); setSubError(''); }}>📅 订阅</button>
        </div>
      </div>

      {showSuggest && suggestions.length > 0 && (
        <div className="cal-suggest">
          <div className="cal-suggest-head">
            <span>📅 日历建议（近 {ctx?.window_days ?? 14} 天）</span>
            <button className="icon-btn" onClick={() => setShowSuggest(false)}>×</button>
          </div>
          <ul>{suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      <div className="cal-legend">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <span key={k} className="cal-legend-item">
            <span className="cal-legend-swatch" style={{ ['--sw' as string]: m.color }} />{m.label}
          </span>
        ))}
        <span className="cal-legend-item">
          <span className="cal-legend-swatch sq" style={{ ['--sw' as string]: EVENT_COLOR }} />平台活动
        </span>
        <span className="cal-legend-item">
          <span className="cal-festival rest">休</span>法定节假日
        </span>
        <span className="cal-legend-item">
          <span className="cal-festival work">班</span>调休上班
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-swatch sq" style={{ ['--sw' as string]: 'var(--cal-festival)' }} />节日
        </span>
        <span className="cal-legend-filter">
          {(['all', 'content', 'event'] as Filter[]).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? '全部' : f === 'content' ? '内容' : '活动'}
            </button>
          ))}
        </span>
      </div>

      <div className="cal-grid-head">
        {WEEKDAYS.map((w) => <div key={w} className="cal-wd">周{w}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          const ds = ymd(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const bucket = byDate[ds] || { events: [], content: [] };
          // 活动在前，CalDAV 订阅次之，内容在后
          const dayChips: ({ kind: 'item'; it: ScheduleItem } | { kind: 'caldav'; ev: CaldavEvent; acc: CaldavAccount })[] = [
            ...bucket.events.map((it) => ({ kind: 'item' as const, it })),
            ...(caldavByDate[ds] || []).map(({ ev, acc }) => ({ kind: 'caldav' as const, ev, acc })),
            ...bucket.content.map((it) => ({ kind: 'item' as const, it })),
          ];
          const shown = dayChips.slice(0, MAX_VISIBLE);
          const hidden = dayChips.length - shown.length;
          const fests = festivalMap.get(ds) || [];
          const rest = fests.find((f) => f.kind === 'statutory-rest');
          const work = fests.find((f) => f.kind === 'statutory-work');
          const festNames = fests
            .filter((f) => f.kind !== 'statutory-rest' && f.kind !== 'statutory-work')
            .slice(0, 2)
            .map((f) => f.name);
          return (
            <div key={i} className={`cal-cell ${inMonth ? '' : 'dim'} ${ds === todayStr ? 'today' : ''}`}
              onClick={() => (dayChips.length ? setDayView(ds) : openNew(ds))}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, ds }); }}>
              <div className="cal-daynum-row">
                <div className="cal-daynum">{d.getDate()}</div>
                {rest && <span className="cal-festival rest" title={rest.name}>休</span>}
                {work && <span className="cal-festival work" title={work.name}>班</span>}
              </div>
              {festNames.length > 0 && (
                <div className="cal-festnames" title={festNames.join(' · ')}>{festNames.join(' · ')}</div>
              )}
              <div className="cal-events">
                {shown.map((chip) => (chip.kind === 'item' ? renderChip(chip.it) : renderCaldavChip(chip.ev, chip.acc)))}
                {hidden > 0 && (
                  <button className="cal-more" onClick={(e) => { e.stopPropagation(); setDayView(ds); }}>
                    +{hidden} 更多
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {menu && (() => {
        const customFests = (byDate[menu.ds]?.events || []).filter((it) => it.event_type === '节日' && it.source === 'manual');
        const openWith = (preset: Partial<ScheduleInput>) => {
          setMenu(null); setDayView(null); setEditing(null);
          setForm({ ...EMPTY, date: menu.ds, ...preset });
        };
        return (
          <div className="overlay is-menu" onClick={() => setMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
            <div className="cal-menu" style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 170) }}
              onClick={(e) => e.stopPropagation()}>
              <button onClick={() => openWith({ kind: 'event', event_type: '节日', status: 'idea' })}>🎉 添加节日…</button>
              <button onClick={() => openWith({ kind: 'event', status: 'idea' })}>📣 添加平台活动…</button>
              <button onClick={() => openWith({ kind: 'content' })}>📝 添加排期…</button>
              {customFests.length > 0 && <div className="cal-menu-sep" />}
              {customFests.map((it) => (
                <button key={it.id} className="cal-menu-del" title={it.repeat === 'yearly' ? '每年重复' : undefined}
                  onClick={async () => { setMenu(null); await deleteSchedule(it.id); load(); }}>
                  <span>删除「{it.title}」</span>
                  <IconTrash size={13} />
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {dayView && (() => {
        const b = byDate[dayView] || { events: [], content: [] };
        const list = [...b.events, ...b.content];
        return (
          <div className="overlay" onClick={() => setDayView(null)}>
            <div className="modal" style={{ width: 420, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{dayView}（{list.length} 项）</h3>
                <button className="icon-btn" onClick={() => setDayView(null)}>×</button>
              </div>
              {(festivalMap.get(dayView) || []).length > 0 && (
                <div className="cal-fest-day">
                  {(festivalMap.get(dayView) || []).map((f, i) => (
                    <span key={i} className={`cal-festival-tag is-${f.kind}`}>{f.name}</span>
                  ))}
                </div>
              )}
              <div className="cal-dayview-list">
                {list.map(renderChip)}
                {(caldavByDate[dayView] || []).map(({ ev, acc }) => (
                  <div key={`cd-${ev.uid}-${ev.start}`} className="cal-event is-caldav"
                    title={ev.location ? `${acc.name} · ${ev.location}` : acc.name}
                    style={{ ['--ev' as string]: acc.color || 'var(--text-tertiary)' }}>
                    <span className="cal-event-dot" />
                    <span className="cal-event-title">
                      {ev.allDay ? '全天' : ev.start.slice(11, 16)} · {ev.title}
                      {ev.location ? ` @${ev.location}` : ''}
                    </span>
                    <span className="cal-src">{acc.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-sm btn-primary" onClick={() => openNew(dayView)}>+ 新增</button>
              </div>
            </div>
          </div>
        );
      })()}

      {subOpen && (() => {
        const newDraft = (): CaldavAccount => ({
          id: Math.random().toString(16).slice(2, 14), name: '', url: '', username: '',
          password: '', enabled: true, calendars: [],
        });
        const startEdit = (acc: CaldavAccount | null) => {
          setSubDraft(acc ? { ...acc, password: '' } : newDraft());
          setSubCals(null); setSubError('');
        };
        const persist = async (accounts: CaldavAccount[]) => {
          setSubBusy('save'); setSubError('');
          try { await putCaldavAccounts(accounts); loadCaldav(); } catch (e) { setSubError((e as Error).message || String(e)); } finally { setSubBusy(''); }
        };
        const syncOne = async (acc: CaldavAccount) => {
          setSubBusy(acc.id); setSubError('');
          try { await syncCaldav(acc.id); loadCaldav(); } catch (e) { setSubError((e as Error).message || String(e)); } finally { setSubBusy(''); }
        };
        const saveDraft = async () => {
          if (!subDraft) return;
          await persist(caldav.some((a) => a.id === subDraft.id) ? caldav.map((a) => (a.id === subDraft.id ? subDraft : a)) : [...caldav, subDraft]);
          setSubDraft(null); setSubCals(null);
        };
        const probe = async () => {
          if (!subDraft) return;
          setSubBusy('probe'); setSubError('');
          try {
            // 先持久化表单（新账号拿 id 与凭据），再按当前凭据探测
            await putCaldavAccounts(caldav.some((a) => a.id === subDraft.id) ? caldav.map((a) => (a.id === subDraft.id ? subDraft : a)) : [...caldav, subDraft]);
            const res = await discoverCaldav(subDraft.id, {
              url: subDraft.url, username: subDraft.username, password: subDraft.password || undefined,
            });
            setSubCals(res.calendars);
            loadCaldav();
          } catch (e) { setSubError((e as Error).message || String(e)); } finally { setSubBusy(''); }
        };
        return (
          <div className="overlay" onClick={() => setSubOpen(false)}>
            <div className="modal" style={{ width: 540, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ margin: 0 }}>📅 订阅日历（CalDAV）</h3>
                <button className="icon-btn" onClick={() => setSubOpen(false)}>×</button>
              </div>
              <p className="cal-sub-hint">
                只读导入 iCloud / Fastmail / Nextcloud 等标准 CalDAV 日历。填服务器地址可自动发现，也可直接粘贴日历 URL；
                密码用各服务的「应用专用密码」。Google 日历需 OAuth，暂不支持。
              </p>
              {caldav.map((acc) => (
                <div key={acc.id} className="cal-sub-row">
                  <span className="cal-sub-dot" style={{ ['--ev' as string]: acc.color || 'var(--text-tertiary)' }} />
                  <div className="cal-sub-main">
                    <div style={{ fontWeight: 600 }}>
                      {acc.name}
                      {!acc.enabled && <span className="cal-src">（已停用）</span>}
                    </div>
                    <div className="cal-sub-url">{acc.url}{acc.username ? ` · ${acc.username}` : ''}</div>
                    <div className="cal-src">
                      {syncAgo(acc.syncedAt)}
                      {caldavByAccount[acc.id] ? ` · ${caldavByAccount[acc.id].events.length} 条事件` : ''}
                      {acc.calendars.length > 0 ? ` · ${acc.calendars.length} 个日历` : ''}
                    </div>
                  </div>
                  <label className="cal-repeat" style={{ margin: 0 }} title="启用/停用">
                    <input type="checkbox" checked={acc.enabled}
                      onChange={(e) => persist(caldav.map((a) => (a.id === acc.id ? { ...a, enabled: e.target.checked } : a)))} />
                  </label>
                  <button className="btn btn-sm" disabled={subBusy !== ''} onClick={() => syncOne(acc)}>
                    {subBusy === acc.id ? '同步中…' : '同步'}
                  </button>
                  <button className="btn btn-sm" onClick={() => startEdit(acc)}>编辑</button>
                  <button className="btn btn-sm btn-danger" onClick={() => persist(caldav.filter((a) => a.id !== acc.id))}>删除</button>
                </div>
              ))}
              {!subDraft && <button className="btn btn-sm" onClick={() => startEdit(null)}>+ 添加账号</button>}

              {subDraft && (
                <div className="cal-sub-form">
                  <label className="field-label">名称</label>
                  <input className="field" value={subDraft.name} placeholder="iCloud / 公司日历…"
                    onChange={(e) => setSubDraft({ ...subDraft, name: e.target.value })} />
                  <label className="field-label">服务器或日历 URL *</label>
                  <input className="field" value={subDraft.url} autoFocus
                    placeholder="https://caldav.icloud.com/ 或完整日历 URL"
                    onChange={(e) => setSubDraft({ ...subDraft, url: e.target.value })} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label className="field-label">用户名</label>
                      <input className="field" value={subDraft.username}
                        onChange={(e) => setSubDraft({ ...subDraft, username: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="field-label">应用专用密码</label>
                      <input className="field" type="password" value={subDraft.password}
                        placeholder={caldav.some((a) => a.id === subDraft.id) ? '已保存（留空不改）' : ''}
                        onChange={(e) => setSubDraft({ ...subDraft, password: e.target.value })} />
                    </div>
                  </div>
                  {subCals !== null && (
                    <>
                      <label className="field-label">选择要订阅的日历（{subCals.length} 个；不选则订阅填写的 URL）</label>
                      {subCals.length === 0 && <div className="cal-src">未发现日历</div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {subCals.map((cal) => (
                          <button key={cal.href} className={`chip ${subDraft.calendars.includes(cal.href) ? 'active' : ''}`}
                            title={cal.href}
                            onClick={() => setSubDraft({
                              ...subDraft,
                              calendars: subDraft.calendars.includes(cal.href)
                                ? subDraft.calendars.filter((h) => h !== cal.href)
                                : [...subDraft.calendars, cal.href],
                            })}>{cal.displayname}</button>
                        ))}
                      </div>
                    </>
                  )}
                  {subError && <div className="cal-sub-error">{subError}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                    <button className="btn btn-sm" onClick={() => { setSubDraft(null); setSubCals(null); }}>取消</button>
                    <button className="btn btn-sm" disabled={subBusy !== '' || !/^https?:\/\//i.test(subDraft.url)} onClick={probe}>
                      {subBusy === 'probe' ? '探测中…' : '探测日历'}
                    </button>
                    <button className="btn btn-sm btn-primary" disabled={subBusy !== '' || !subDraft.url.trim()} onClick={saveDraft}>
                      {subBusy === 'save' ? '保存中…' : '保存'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {form && (
        <div className="overlay" onClick={close}>
          <div className="modal" style={{ width: 440, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>{editing ? '编辑' : '新增'}{isEvent ? '平台活动' : '排期'}</h3>
              <button className="icon-btn" onClick={close}>×</button>
            </div>
            <label className="field-label">类型</label>
            <div style={{ display: 'flex', gap: 7 }}>
              <button className={`chip ${!isEvent ? 'active' : ''}`}
                onClick={() => setForm({ ...form, kind: 'content' })}>内容 / 发布</button>
              <button className={`chip ${isEvent ? 'active' : ''}`}
                onClick={() => setForm({ ...form, kind: 'event', status: 'idea' })}>平台活动</button>
            </div>
            <label className="field-label">标题 *</label>
            <input className="field" value={form.title} autoFocus placeholder={isEvent ? '活动/节点名称' : '要发什么内容'}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">{isEvent ? '开始日期 *' : '日期 *'}</label>
                <input className="field" type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              {isEvent ? (
                <div style={{ flex: 1 }}>
                  <label className="field-label">结束日期</label>
                  <input className="field" type="date" value={form.end_date || ''}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              ) : (
                <div style={{ width: 120 }}>
                  <label className="field-label">时间</label>
                  <input className="field" type="time" value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              )}
            </div>
            {isEvent ? (
              <>
                <label className="field-label">活动类型</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {EVENT_TYPES.map((t) => (
                    <button key={t} className={`chip ${form.event_type === t ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, event_type: form.event_type === t ? '' : t })}>{t}</button>
                  ))}
                </div>
                <label className="field-label">关联平台（可选）</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {PLATFORMS.map((p) => (
                    <button key={p} className={`chip ${form.platform === p ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, platform: form.platform === p ? '' : p })}>{p}</button>
                  ))}
                </div>
                <label className="cal-repeat">
                  <input type="checkbox" checked={form.repeat === 'yearly'}
                    onChange={(e) => setForm({ ...form, repeat: e.target.checked ? 'yearly' : '' })} />
                  每年重复（同月同日自动出现在每一年）
                </label>
              </>
            ) : (
              <>
                <label className="field-label">平台</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {PLATFORMS.map((p) => (
                    <button key={p} className={`chip ${form.platform === p ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, platform: form.platform === p ? '' : p })}>{p}</button>
                  ))}
                </div>
                <label className="field-label">状态</label>
                <div style={{ display: 'flex', gap: 7 }}>
                  {Object.entries(STATUS_META).map(([k, m]) => (
                    <button key={k} className={`chip ${form.status === k ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, status: k })}>{m.label}</button>
                  ))}
                </div>
              </>
            )}
            <label className="field-label">备注</label>
            <textarea className="field" style={{ minHeight: 60 }} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
              {editing
                ? <button className="btn btn-sm btn-danger" onClick={remove} disabled={saving}><IconTrash size={13} /> 删除</button>
                : <span />}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={close}>取消</button>
                <button className="btn btn-sm btn-primary" onClick={save} disabled={saving || !form.title.trim() || !form.date}>
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
