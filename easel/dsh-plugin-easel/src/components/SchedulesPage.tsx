// 定时任务页（spec easel-scheduled-tasks）：Host schedule 引擎的产品入口。
// 数据面：目录/编辑/删除/运行记录走 dsh 的 remote.schedule（变更事件驱动刷新），
// 创建走 easel 的 /api/automation/tasks（引擎 create 是 host 进程 API）。
// 时机表单只做四种形状（仅一次/每天/每周/每 N 小时或分钟）；cron 任务只读展示。
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { createScheduledTask, type ScheduledTiming } from '../lib/api';
import { fetchRoster, platformLabel, type RosterAccount } from '../lib/roster';
import type { PageProps } from '../lib/shell';
import { IconChevron, IconClock, IconEdit, IconPlus, IconRefresh, IconTrash } from './icons';

/** 目录里的一个定时任务（引擎 ScheduleRecord + 会话绑定与状态）。 */
export interface ScheduleEntry {
  id: string;
  kind: 'after' | 'at' | 'every' | 'daily' | 'weekly' | 'cron';
  title: string;
  prompt: string;
  scheduledAt: string;
  sessionId: string;
  status: 'active' | 'inactive';
  lastDelivery?: { scheduledAt: string; deliveredAt: string };
  time?: string;
  timeZone?: string;
  weekdays?: number[];
  everySeconds?: number;
  afterSeconds?: number;
  expression?: string;
}

/** Typert remote 方法的返回信封。 */
interface RemoteEnvelope<T> { ok?: boolean; value?: T; error?: { message?: string } }

interface ScheduleHistoryResult {
  records?: { scheduledAt: string; deliveredAt: string }[];
  nextBefore?: string;
  code?: string;
}

/** 会话/工作区列表投影（picker 数据源；行结构与 dsh api-session-controller 对齐）。 */
interface SessionSource { list?: { getSnapshot?: () => { ids?: string[]; byId?: Record<string, { title?: string }>; phase?: string } } }
interface WorkspaceSource { list?: { getSnapshot?: () => { archivedSessionIds?: string[]; phase?: string } } }

export interface SchedulesPageProps extends PageProps {
  sessions?: SessionSource;
  workspaces?: WorkspaceSource;
  /** 订阅引擎目录变更；返回退订函数。 */
  subscribeChanged?: (listener: () => void) => () => void;
  /** 引擎目录（feature 插件注入的绑定回调；页面不直接碰 remote 代理）。 */
  catalog?: () => Promise<RemoteEnvelope<ScheduleEntry[]>>;
  updateTask?: (req: { sessionId: string; id: string; expected: ScheduleEntry; change?: Record<string, unknown> }) => Promise<RemoteEnvelope<Record<string, unknown>>>;
  deleteTask?: (req: { sessionId: string; id: string }) => Promise<RemoteEnvelope<Record<string, unknown>>>;
  history?: (req: { sessionId: string; id: string; limit: number; before?: string }) => Promise<RemoteEnvelope<ScheduleHistoryResult>>;
}

interface TimingDraft {
  kind: ScheduledTiming['kind'];
  date: string;
  time: string;
  weekdays: number[];
  value: number;
  unit: ScheduledTiming['unit'];
}

const TIMING_KINDS: { key: TimingDraft['kind']; label: string }[] = [
  { key: 'at', label: '仅一次' },
  { key: 'daily', label: '每天' },
  { key: 'weekly', label: '每周' },
  { key: 'every', label: '每 N 小时/分钟' },
];
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: '一' }, { value: 2, label: '二' }, { value: 3, label: '三' },
  { value: 4, label: '四' }, { value: 5, label: '五' }, { value: 6, label: '六' }, { value: 7, label: '日' },
];
const EMPTY_TIMING: TimingDraft = { kind: 'daily', date: '', time: '09:00', weekdays: [1, 2, 3, 4, 5], value: 1, unit: 'hour' };

const localZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const pad = (n: number): string => String(n).padStart(2, '0');

/** 'HH:mm:ss[.SSS]' → 'HH:mm'。 */
const hhmm = (time?: string): string | undefined => {
  const match = /^(\d{2}:\d{2})/.exec(String(time ?? ''));
  return match === null ? undefined : match[1];
};

/** 目录行的一句时机摘要；cron 走自定义只读态。 */
const freqLine = (e: ScheduleEntry): string => {
  if (e.kind === 'at' || e.kind === 'after') return '仅一次';
  if (e.kind === 'every') {
    const s = e.everySeconds ?? 0;
    if (s % 3600 === 0) return `每 ${s / 3600} 小时`;
    return `每 ${Math.ceil(s / 60)} 分钟`;
  }
  if (e.kind === 'daily') return `每天 ${hhmm(e.time) ?? ''}`.trim();
  if (e.kind === 'weekly') return `每周${(e.weekdays ?? []).map(d => WEEKDAYS[d - 1]?.label ?? '').join('、')} ${hhmm(e.time) ?? ''}`.trim();
  return '自定义时机';
};

/** 下一次触发的相对时间（签名元素：相对时间为主、绝对时间为辅）。 */
const relativeNext = (scheduledAt: string): string => {
  const diff = Date.parse(scheduledAt) - Date.now();
  if (Number.isNaN(diff)) return '';
  if (diff <= 0) return '即将执行';
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${Math.max(1, min)} 分钟后`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.round(hours / 24)} 天后`;
};

/** 次要展示的绝对时间：'10-26 09:00'。 */
const absoluteShort = (scheduledAt: string): string => {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 表单时机 → 引擎 ScheduleTimingChange（与宿主 timingToSelector 同语义）。 */
const timingToChange = (t: TimingDraft, timeZone: string): Record<string, unknown> => {
  const time = /^(\d{1,2}):(\d{2})$/.exec(t.time.trim()) !== null ? `${t.time.trim()}:00` : t.time.trim();
  if (t.kind === 'at') return { kind: 'at', at: { date: t.date, time, time_zone: timeZone } };
  if (t.kind === 'daily') return { kind: 'daily', daily: { time, time_zone: timeZone } };
  if (t.kind === 'weekly') return { kind: 'weekly', weekly: { time, weekdays: [...t.weekdays].sort((a, b) => a - b), time_zone: timeZone } };
  return { kind: 'every', every_seconds: t.value * (t.unit === 'hour' ? 3600 : 60) };
};

/** 记录时机 → 表单草稿（编辑预填；一次性按本地日历展开）。 */
const timingFromRecord = (e: ScheduleEntry): TimingDraft => {
  const local = new Date(e.scheduledAt);
  const time = hhmm(e.time) ?? (Number.isNaN(local.getTime()) ? '09:00' : `${pad(local.getHours())}:${pad(local.getMinutes())}`);
  if (e.kind === 'daily') return { ...EMPTY_TIMING, kind: 'daily', time };
  if (e.kind === 'weekly') return { ...EMPTY_TIMING, kind: 'weekly', time, weekdays: [...(e.weekdays ?? [1])] };
  if (e.kind === 'every') {
    const s = e.everySeconds ?? 3600;
    return s >= 3600
      ? { ...EMPTY_TIMING, kind: 'every', value: Math.max(1, Math.round(s / 3600)), unit: 'hour' }
      : { ...EMPTY_TIMING, kind: 'every', value: Math.max(1, Math.round(s / 60)), unit: 'minute' };
  }
  return {
    ...EMPTY_TIMING,
    kind: 'at',
    date: Number.isNaN(local.getTime()) ? '' : `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
    time,
  };
};

/** 四种形状之外的时机（cron）不能在 easel 表单编辑。 */
const isEditableKind = (e: ScheduleEntry): boolean => e.kind !== 'cron';

/** 新建/编辑共用的时机表单块。 */
function TimingFields({ draft, onChange }: { draft: TimingDraft; onChange: (next: TimingDraft) => void }) {
  return (
    <>
      <label className="field-label">时机</label>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {TIMING_KINDS.map(k => (
          <button key={k.key} type="button" className={`chip ${draft.kind === k.key ? 'active' : ''}`}
            onClick={() => onChange({ ...draft, kind: k.key })}>{k.label}</button>
        ))}
      </div>
      {draft.kind === 'at' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="field" type="date" value={draft.date} onChange={e => onChange({ ...draft, date: e.target.value })} />
          <input className="field" type="time" value={draft.time} onChange={e => onChange({ ...draft, time: e.target.value })} />
        </div>
      )}
      {draft.kind === 'daily' && (
        <input className="field" style={{ marginTop: 8 }} type="time" value={draft.time}
          onChange={e => onChange({ ...draft, time: e.target.value })} />
      )}
      {draft.kind === 'weekly' && (
        <>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
            {WEEKDAYS.map(d => (
              <button key={d.value} type="button"
                className={`chip ${draft.weekdays.includes(d.value) ? 'active' : ''}`}
                onClick={() => onChange({
                  ...draft,
                  weekdays: draft.weekdays.includes(d.value)
                    ? draft.weekdays.filter(w => w !== d.value)
                    : [...draft.weekdays, d.value],
                })}>{d.label}</button>
            ))}
          </div>
          <input className="field" style={{ marginTop: 8 }} type="time" value={draft.time}
            onChange={e => onChange({ ...draft, time: e.target.value })} />
        </>
      )}
      {draft.kind === 'every' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input className="field" style={{ width: 90 }} type="number" min={1} value={Number.isFinite(draft.value) ? draft.value : 1}
            onChange={e => onChange({ ...draft, value: Number(e.target.value) })} />
          {(['hour', 'minute'] as const).map(u => (
            <button key={u} type="button" className={`chip ${draft.unit === u ? 'active' : ''}`}
              onClick={() => onChange({ ...draft, unit: u })}>{u === 'hour' ? '小时' : '分钟'}</button>
          ))}
        </div>
      )}
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>到点后，任务内容会作为一条消息发给所选会话并自动执行。</p>
    </>
  );
}

/** 引擎 tool-error 稳定 code 的客户端文案（与宿主 SCHEDULE_ERROR_DETAILS 同表）。 */
const TOOL_ERROR_ZH: Record<string, string> = {
  invalid_prompt: '任务内容为空、过长或含首尾空白',
  invalid_selector: '时机设置不完整或有冲突',
  invalid_rule: '规则参数无效',
  invalid_time_zone: '时区无效',
  not_future: '一次性任务必须选择未来的日期时刻',
  time_out_of_range: '时间超出可设置的范围',
  frequency_too_high: '触发频率过高（最小间隔 1 分钟）',
  subagent_session: '子 agent 会话不能承载定时任务',
};

/** PageProps.remote 上的 `schedule` 命名空间由 feature 插件注入为绑定回调。 */
export default function SchedulesPage({
  sessions, workspaces, subscribeChanged, catalog, updateTask, deleteTask, history,
}: SchedulesPageProps) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState<null | { title: string; prompt: string; timing: TimingDraft; sessionId: string; accountId: string }>(null);
  const [rosterList, setRosterList] = useState<RosterAccount[]>([]);
  const [detail, setDetail] = useState<ScheduleEntry | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [editingTiming, setEditingTiming] = useState<TimingDraft | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [records, setRecords] = useState<{ scheduledAt: string; deliveredAt: string }[]>([]);
  const [recordsError, setRecordsError] = useState('');
  const [recordsCursor, setRecordsCursor] = useState<string | undefined>(undefined);
  const [recordsDone, setRecordsDone] = useState(true);
  const [sessionsTick, bumpSessions] = useReducer(x => x + 1, 0);
  const [, setTick] = useState(0);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400); };

  const load = useCallback(async (): Promise<ScheduleEntry[] | undefined> => {
    setLoading(true);
    try {
      const read = catalog;
      if (read === undefined) throw new Error('任务数据不可达（调度远端未连接）');
      const res = await read();
      if (res?.ok === true && Array.isArray(res.value)) {
        setEntries(res.value);
        setError('');
        return res.value;
      }
      throw new Error(res?.error?.message ?? '无法加载任务');
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法加载任务');
      return undefined;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (subscribeChanged === undefined) return undefined;
    return subscribeChanged(() => { void load(); });
  }, [subscribeChanged, load]);
  // 相对时间倒计：每 30 秒重渲染一次。
  useEffect(() => {
    const timer = setInterval(() => setTick(x => x + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  // 会话列表投影变化时刷新选择器（store 订阅缺席时保持现状）。
  useEffect(() => {
    const unsub = sessions?.list?.subscribe?.(() => bumpSessions());
    return typeof unsub === 'function' ? unsub : undefined;
  }, [sessions]);

  /** 目标会话选择器：非归档、按会话列表顺序（近期在前），空标题回退 id。 */
  const sessionOptions = useMemo(() => {
    const wsSnap = workspaces?.list?.getSnapshot?.();
    const sSnap = sessions?.list?.getSnapshot?.();
    const archived = new Set(wsSnap?.archivedSessionIds ?? []);
    return (sSnap?.ids ?? [])
      .filter(id => !archived.has(id))
      .map(id => ({ id, title: sSnap?.byId?.[id]?.title?.trim() || id }));
  }, [sessions, workspaces, sessionsTick]);

  const filtered = useMemo(() => entries.filter((e) => {
    if (filter !== 'all' && e.status !== filter) return false;
    if (query.trim() === '') return true;
    const q = query.trim().toLowerCase();
    return e.title.toLowerCase().includes(q) || e.prompt.toLowerCase().includes(q);
  }), [entries, filter, query]);

  const nextUp = useMemo(() => entries.find(e => e.status === 'active'), [entries]);

  const submitCreate = async () => {
    if (form === null || detailBusy) return;
    if (!form.title.trim()) { showToast('任务名称必填'); return; }
    if (form.title.trim().length > 120) { showToast('任务名称不超过 120 个字符'); return; }
    if (!form.prompt.trim()) { showToast('任务内容必填'); return; }
    if (!form.sessionId) { showToast('必须选择目标会话'); return; }
    if (form.timing.kind === 'at') {
      const due = new Date(`${form.timing.date}T${form.timing.time}:00`);
      if (!form.timing.date || !(due > new Date())) { showToast('一次性任务必须选择未来的日期时刻'); return; }
    }
    setDetailBusy(true);
    try {
      // 关联账号不进调度引擎：直接追加到提示词（模型可见 ⟺ 日志可见，prompt 即权威）。
      const linked = rosterList.find(a => a.id === form.accountId);
      const persona = linked?.persona ? `，画像「${linked.persona}」` : '';
      const promptBody = linked === undefined ? form.prompt.trim()
        : `${form.prompt.trim()}\n\n目标账号：${platformLabel(linked.platform)}「${linked.name}」（账号 id：${linked.id}${persona}）`;
      await createScheduledTask({
        sessionId: form.sessionId,
        title: form.title.trim(),
        prompt: promptBody,
        timeZone: localZone(),
        timing: {
          kind: form.timing.kind,
          date: form.timing.date || undefined,
          time: form.timing.time,
          weekdays: form.timing.kind === 'weekly' ? form.timing.weekdays : undefined,
          value: form.timing.kind === 'every' ? form.timing.value : undefined,
          unit: form.timing.kind === 'every' ? form.timing.unit : undefined,
        },
      });
      setForm(null);
      showToast('已创建：到点会自动运行');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '创建失败');
    } finally {
      setDetailBusy(false);
    }
  };

  /** 打开详情：拉一份最近运行记录。 */
  const openDetail = (e: ScheduleEntry) => {
    setDetail(e);
    setEditingTiming(null);
    setConfirmingDelete(false);
    setRecords([]);
    setRecordsError('');
    setRecordsCursor(undefined);
    setRecordsDone(true);
    void (async () => {
      try {
        const res = await history?.({ sessionId: e.sessionId, id: e.id, limit: 20 });
        if (res?.ok !== true) throw new Error(res?.error?.message ?? '');
        const value = res.value;
        setRecords(value?.records ?? []);
        setRecordsCursor(value?.nextBefore);
        setRecordsDone(value?.nextBefore === undefined);
        setRecordsError('');
      } catch {
        setRecordsDone(true);
        setRecordsError('无法加载运行记录');
      }
    })();
  };

  const loadMoreRecords = async () => {
    const e = detail;
    if (e === null || recordsCursor === undefined || detailBusy) return;
    setDetailBusy(true);
    try {
      // 引擎的游标字段是 before（返回侧是 nextBefore）。
      const res = await history?.({ sessionId: e.sessionId, id: e.id, limit: 20, before: recordsCursor });
      if (res?.ok !== true) throw new Error(res?.error?.message ?? '');
      const value = res.value;
      setRecords(cur => [...cur, ...(value?.records ?? [])]);
      setRecordsCursor(value?.nextBefore);
      setRecordsDone(value?.nextBefore === undefined);
      setRecordsError('');
    } catch {
      setRecordsDone(true);
      setRecordsError('无法加载运行记录');
    } finally { setDetailBusy(false); }
  };

  const saveTiming = async () => {
    const e = detail;
    if (e === null || editingTiming === null || detailBusy) return;
    if (editingTiming.kind === 'at') {
      const due = new Date(`${editingTiming.date}T${editingTiming.time}:00`);
      if (!editingTiming.date || !(due > new Date())) { showToast('一次性任务必须选择未来的日期时刻'); return; }
    }
    if (editingTiming.kind === 'every' && (!Number.isSafeInteger(editingTiming.value) || editingTiming.value < 1)) {
      showToast('间隔必须是正整数'); return;
    }
    setDetailBusy(true);
    try {
      const call = updateTask;
      if (call === undefined) throw new Error('更新通道不可用（远端平面未连接）');
      const res = await call({
        sessionId: e.sessionId, id: e.id, expected: e,
        change: timingToChange(editingTiming, e.timeZone || localZone()),
      });
      if (res?.ok !== true) throw new Error(res?.error?.message ?? '无法确认更新');
      const value = res.value as Record<string, unknown> | undefined;
      if (value?.updated === false) {
        if (value.code === 'schedule_conflict') showToast('任务已变化，请刷新后重试');
        else if (value.code === 'schedule_ended') showToast('任务已结束，无法修改');
        else showToast('任务已不可用');
      } else if (value?.updated === true) {
        setEditingTiming(null);
        showToast('时机已更新');
        const fresh = await load();
        const freshEntry = fresh?.find(x => x.id === e.id) ?? null;
        if (freshEntry !== null) setDetail(freshEntry);
      } else {
        // 拒绝的编辑以 tool-error 值返回（有 code 无 updated），不当成保存成功。
        const code = typeof value?.code === 'string' ? value.code : '';
        showToast(TOOL_ERROR_ZH[code] ?? '无法确认时机更新');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新失败');
    } finally {
      setDetailBusy(false);
    }
  };

  const remove = async (e: ScheduleEntry) => {
    if (detailBusy) return;
    setDetailBusy(true);
    try {
      const call = deleteTask;
      if (call === undefined) throw new Error('删除通道不可用（远端平面未连接）');
      const res = await call({ sessionId: e.sessionId, id: e.id });
      if (res?.ok !== true) throw new Error(res?.error?.message ?? '无法确认删除');
      const value = res.value as Record<string, unknown> | undefined;
      if (value?.deleted === true) {
        showToast('任务已删除');
        setDetail(null);
        setConfirmingDelete(false);
        await load();
      } else if (value?.code === 'schedule_not_found') {
        showToast('任务已不存在');
        setDetail(null);
        await load();
      } else {
        showToast('删除未生效，请重试');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDetailBusy(false);
    }
  };

  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconClock size={21} /> 定时任务</h1>
          <p className="page-subtitle">到点自动把任务内容发给所选会话——每日简报、周更初稿、素材巡检都交给它。</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => {
          void fetchRoster().then(setRosterList);
          setForm({
            title: '', prompt: '', timing: { ...EMPTY_TIMING }, sessionId: sessionOptions[0]?.id ?? '', accountId: '',
          });
        }}><IconPlus size={13} /> 新建任务</button>
      </div>

      {nextUp !== undefined && (
        <div className="sch-strip accent" role="status">
          <IconClock size={16} />
          <span className="sch-strip-label">下一次触发</span>
          <span className="sch-strip-title">{nextUp.title}</span>
          <span className="sch-strip-relative">{relativeNext(nextUp.scheduledAt)}</span>
        </div>
      )}

      <div className="sch-toolbar">
        <div style={{ display: 'flex', gap: 7 }}>
          {([['all', '全部'], ['active', '已开启'], ['inactive', '已结束']] as const).map(([key, label]) => (
            <button key={key} className={`chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
        <input className="field sch-search" value={query} placeholder="搜索任务…" onChange={e => setQuery(e.target.value)} />
      </div>

      {loading && entries.length === 0 && <p className="sch-empty">正在加载任务…</p>}
      {!loading && error !== '' && (
        <div className="sch-empty">
          {error}
          <button className="btn btn-sm" style={{ marginLeft: 10 }} onClick={() => { void load(); }}><IconRefresh size={13} /> 重试</button>
        </div>
      )}
      {!loading && error === '' && filtered.length === 0 && (
        <div className="sch-empty">还没有定时任务。新建一个，到点它会自动在所选会话里运行。</div>
      )}

      <div className="sch-list">
        {filtered.map(e => (
          <div key={e.id} className="card sch-card">
            <div className="sch-card-top">
              <span className={`sch-dot ${e.status === 'active' ? 'on' : 'off'}`} />
              <span className="sch-title">{e.title}</span>
              <span className="sch-freq">{freqLine(e)}</span>
              <span className="sch-card-actions">
                <button className="session-act" title="详情" onClick={() => openDetail(e)}><IconChevron size={13} /></button>
                <button className="session-act danger" title="删除" onClick={() => { openDetail(e); setConfirmingDelete(true); }}><IconTrash size={13} /></button>
              </span>
            </div>
            {e.status === 'active' && (
              <div className="sch-next">
                {absoluteShort(e.scheduledAt)} · {relativeNext(e.scheduledAt)}
              </div>
            )}
            <div className="sch-meta">
              会话「{sessionOptions.find(s => s.id === e.sessionId)?.title ?? e.sessionId.slice(0, 12)}」
              {e.lastDelivery !== undefined && <> · 上次 {absoluteShort(e.lastDelivery.deliveredAt)} 已投递</>}
            </div>
          </div>
        ))}
      </div>

      {form !== null && (
        <div className="overlay" onClick={() => setForm(null)}>
          <div className="modal" style={{ width: 480, maxWidth: '100%' }} onClick={e => e.stopPropagation()} aria-label="新建定时任务">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>新建定时任务</h3>
              <button className="icon-btn" onClick={() => setForm(null)}>×</button>
            </div>
            <label className="field-label">任务名称 *</label>
            <input className="field" value={form.title} autoFocus placeholder="如：今日热点简报"
              onChange={e => setForm({ ...form, title: e.target.value })} />
            <label className="field-label">任务内容（提示词）*</label>
            <textarea className="field" style={{ minHeight: 84 }} value={form.prompt}
              placeholder="到点发给会话执行的内容，如：整理今天的热点，给一份简报。"
              onChange={e => setForm({ ...form, prompt: e.target.value })} />
            <TimingFields draft={form.timing} onChange={timing => setForm({ ...form, timing })} />
            <label className="field-label">目标会话 *</label>
            <select className="field" value={form.sessionId} onChange={e => setForm({ ...form, sessionId: e.target.value })}>
              {sessionOptions.length === 0 && <option value="">（暂无可用会话，先新建一个对话）</option>}
              {sessionOptions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <label className="field-label">关联发布账号（可选）</label>
            <select className="field" value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}>
              <option value="">不关联</option>
              {rosterList.map(a => (
                <option key={a.id} value={a.id}>
                  {platformLabel(a.platform)}「{a.name}」{a.persona ? `（画像：${a.persona}）` : ''}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn btn-sm" onClick={() => setForm(null)}>取消</button>
              <button className="btn btn-sm btn-primary" disabled={detailBusy} onClick={() => { void submitCreate(); }}>创建</button>
            </div>
          </div>
        </div>
      )}

      {detail !== null && (
        <div className="overlay" onClick={() => { setDetail(null); setConfirmingDelete(false); }}>
          <div className="modal" style={{ width: 520, maxWidth: '100%' }} onClick={e => e.stopPropagation()} aria-label="任务详情">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>{detail.title}</h3>
              <button className="icon-btn" onClick={() => { setDetail(null); setConfirmingDelete(false); }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <span className={`chip ${detail.status === 'active' ? 'active' : ''}`}>{detail.status === 'active' ? '已开启' : '已结束'}</span>
              <span className="chip">{freqLine(detail)}</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>任务内容</p>
            <div className="sch-prompt">{detail.prompt}</div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {detail.status === 'active'
                ? <>下次 {absoluteShort(detail.scheduledAt)}（{relativeNext(detail.scheduledAt)}）</>
                : '已结束，不会再触发。'}
              {detail.lastDelivery !== undefined && <> · 上次 {absoluteShort(detail.lastDelivery.deliveredAt)} 已投递</>}
            </div>
            {isEditableKind(detail) && detail.status === 'active' && editingTiming === null && (
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setEditingTiming(timingFromRecord(detail))}>
                <IconEdit size={13} /> 编辑时机
              </button>
            )}
            {!isEditableKind(detail) && (
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                自定义时机（cron）任务请在 设置 → 自动化任务 中编辑。
              </p>
            )}
            {editingTiming !== null && (
              <div style={{ marginTop: 12 }}>
                <TimingFields draft={editingTiming} onChange={setEditingTiming} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-sm" onClick={() => setEditingTiming(null)}>取消</button>
                  <button className="btn btn-sm btn-primary" disabled={detailBusy} onClick={() => { void saveTiming(); }}>保存修改</button>
                </div>
              </div>
            )}
            <p style={{ marginTop: 14, marginBottom: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>运行记录</p>
            <div className="sch-records">
              {recordsError !== '' && <p style={{ fontSize: 12, color: 'var(--red)' }}>{recordsError}</p>}
              {recordsError === '' && records.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>暂无运行记录</p>}
              {records.map((r, i) => (
                <div key={`${r.deliveredAt}-${i}`} className="sch-record">
                  <span className="ok">✓</span>
                  <span className="sch-time">{absoluteShort(r.deliveredAt)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>已投递</span>
                </div>
              ))}
              {!recordsDone && (
                <button className="btn btn-sm" disabled={detailBusy} onClick={() => { void loadMoreRecords(); }}>加载更多</button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              {confirmingDelete
                ? (
                  <>
                    <button className="btn btn-sm" onClick={() => setConfirmingDelete(false)}>取消</button>
                    <button className="btn btn-sm btn-danger" disabled={detailBusy} onClick={() => { void remove(detail); }}>确认删除</button>
                  </>
                )
                : (
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirmingDelete(true)}>
                    <IconTrash size={13} /> 删除任务
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {toast !== '' && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}
