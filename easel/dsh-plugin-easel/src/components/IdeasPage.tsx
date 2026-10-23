import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchIdeas, createIdea, updateIdea, deleteIdea, createSchedule, fetchStatus, projectizeTopic, fetchOutputContent } from '../lib/api';
import { getWorkspaceService } from '../lib/task';
import type { Idea, IdeaInput } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';
import { IconIdea, IconEdit, IconTrash, IconChat, IconCalendar, IconChevron } from './icons';

interface IdeasPageProps {
  onUseTopic: (title: string, projectDir?: string, bodyPath?: string) => void;
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'pending', label: '待做', color: 'var(--text-tertiary)' },
  { key: 'doing', label: '进行中', color: 'var(--layer-attribute)' },
  { key: 'project', label: '已立项', color: 'var(--accent, #7c5cff)' },
  { key: 'done', label: '已完成', color: 'var(--layer-publish)' },
];
// EASEL-DIVERGENCE(easel-single-workspace D3): 已立项的选题拥有同名工作区，
// 不再参与 往复推进，只保留编辑/删除。
const NEXT: Record<string, string> = { pending: 'doing', doing: 'done', done: 'pending' };
const EMPTY: IdeaInput = { title: '', note: '', source: '', status: 'pending' };

export default function IdeasPage({ onUseTopic }: IdeasPageProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [form, setForm] = useState<IdeaInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [greenlight, setGreenlight] = useState<Idea | null>(null);
  const [personas, setPersonas] = useState<{ name: string; description?: string }[]>([]);
  const [personaPick, setPersonaPick] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { fetchIdeas().then(setIdeas).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  // easel-hotspot-radar D6: 正文只存内容库一份，卡片「正文」按 bodyPath 现读现渲染。
  const [bodyPreview, setBodyPreview] = useState<null | { idea: Idea; content: string; error: string }>(null);
  const openBody = async (it: Idea) => {
    setBodyPreview({ idea: it, content: '', error: '' });
    try {
      const file = await fetchOutputContent(it.bodyPath!);
      const error = file.isBinary ? '该文件不是文本' : '';
      setBodyPreview({ idea: it, content: error === '' ? file.content : '', error });
    } catch (e) {
      setBodyPreview({ idea: it, content: '', error: e instanceof Error ? e.message : '正文读取失败（文件可能已删除）' });
    }
  };
  const byStatus = useMemo(() => {
    const g: Record<string, Idea[]> = { pending: [], doing: [], project: [], done: [] };
    for (const it of ideas) (g[it.status] || g.pending).push(it);
    return g;
  }, [ideas]);

  const openNew = () => { setEditId(null); setForm({ ...EMPTY }); };
  const openEdit = (it: Idea) => { setEditId(it.id); setForm({ title: it.title, note: it.note, source: it.source, status: it.status }); };
  const save = async () => {
    if (!form || !form.title.trim()) return;
    if (editId) await updateIdea(editId, form); else await createIdea(form);
    setForm(null); setEditId(null); load();
  };
  // EASEL-DIVERGENCE(easel-project-materials): 立项 = 宿主建 projects/<safe>/ 并播种
  // 资料（选题卡/拆解素材/画像快照；标题清洗与媒体硬链接都在宿主侧），前端拿 safe
  // 建 dsh 工作区。projectDir 由宿主写回选题卡，「做内容」凭它注入产物落点。
  const openGreenlight = async (it: Idea) => {
    setGreenlight(it);
    setPersonaPick('');
    const status = await fetchStatus();
    const list = status?.personas ?? [];
    setPersonas(list);
    if (list.length === 1) setPersonaPick(list[0].name);
  };
  const confirmGreenlight = async () => {
    const it = greenlight;
    if (!it || busy) return;
    setBusy(true);
    try {
      const status = await fetchStatus();
      const root = status?.projectRoot ?? '';
      if (!root) throw new Error('拿不到项目根');
      const { safe } = await projectizeTopic({
        ideaId: it.id, title: it.title, note: it.note, source: it.source,
        fallback: it.id, deconstruct: it.deconstruct, persona: personaPick,
      });
      const ws = getWorkspaceService();
      if (!ws) throw new Error('工作区服务不可达');
      try {
        await ws.create({ path: `${root.replace(/[\/]+$/, '')}/projects/${safe}/` });
      } catch {
        // 重复立项时工作区已存在：播种照常完成，这里不当作失败。
      }
      setGreenlight(null);
      showToast('已立项：资料已装入项目工作区');
      load();
    } catch (error) {
      showToast(`立项失败：${(error as Error).message ?? error}`);
    } finally {
      setBusy(false);
    }
  };

  const advance = async (it: Idea) => { await updateIdea(it.id, { ...it, status: NEXT[it.status] }); load(); };
  const remove = async (it: Idea) => { await deleteIdea(it.id); load(); };
  const schedule = async (it: Idea) => {
    const d = new Date();
    await createSchedule({ title: it.title, date: d.toISOString().slice(0, 10), platform: '', time: '', status: 'idea', note: it.note });
    showToast('已加入日历（今天）');
  };

  return (
    <div className="page-scroll ideas-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconIdea size={21} /> 选题库</h1>
          <p className="page-subtitle">攒住每一个灵感——从热点收藏或手动新增，推进到「做内容」再进日历。</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={openNew}>+ 新建选题</button>
      </div>

      <div className="kanban">
        {COLUMNS.map((col) => (
          <div key={col.key} className="kanban-col">
            <div className="kanban-col-head">
              <span className="kanban-dot" style={{ background: col.color }} />
              {col.label}<span className="kanban-count">{byStatus[col.key].length}</span>
            </div>
            <div className="kanban-list">
              {byStatus[col.key].length === 0 && <div className="kanban-empty">拖点选题进来吧</div>}
              {byStatus[col.key].map((it) => (
                <div key={it.id} className="card idea-card">
                  <div className="idea-card-actions">
                    <button className="session-act" title="编辑" onClick={() => openEdit(it)}><IconEdit size={13} /></button>
                    <button className="session-act danger" title="删除" onClick={() => remove(it)}><IconTrash size={13} /></button>
                  </div>
                  <div className="idea-title">{it.title}</div>
                  {it.source && <span className="badge" style={{ marginTop: 6 }}>{it.source}</span>}
                  {it.note && <div className="idea-note">{it.note}</div>}
                  {(it.bodyPath || it.url) && (
                    <div className="idea-links">
                      {it.bodyPath && <button className="idea-link" onClick={() => openBody(it)}>正文</button>}
                      {it.url && <a className="idea-link" href={it.url} target="_blank" rel="noreferrer">原文</a>}
                    </div>
                  )}
                  <div className="idea-foot">
                    <button className="idea-act" onClick={() => onUseTopic(it.title, it.projectDir, it.bodyPath)}><IconChat size={13} /> 做内容</button>
                    <button className="idea-act" onClick={() => schedule(it)}><IconCalendar size={13} /> 排期</button>
                    {it.status !== 'project' && (
                      <button className="idea-act" title="确认立项：建同名工作区并装配资料" onClick={() => openGreenlight(it)}>🚩 立项</button>
                    )}
                    {it.status !== 'project' && (
                      <button className="idea-act next" onClick={() => advance(it)} title="推进状态">
                        {COLUMNS.find((c) => c.key === NEXT[it.status])?.label} <IconChevron size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <div className="modal" style={{ width: 440, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>{editId ? '编辑选题' : '新建选题'}</h3>
              <button className="icon-btn" onClick={() => setForm(null)}>×</button>
            </div>
            <label className="field-label">选题 *</label>
            <input className="field" value={form.title} autoFocus placeholder="想做的内容 / 角度"
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label className="field-label">备注 / 角度</label>
            <textarea className="field" style={{ minHeight: 70 }} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <label className="field-label">来源</label>
            <input className="field" value={form.source} placeholder="如：微博热搜 / 灵感"
              onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <label className="field-label">状态</label>
            <div style={{ display: 'flex', gap: 7 }}>
              {COLUMNS.map((c) => (
                <button key={c.key} className={`chip ${form.status === c.key ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, status: c.key })}>{c.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn btn-sm" onClick={() => setForm(null)}>取消</button>
              <button className="btn btn-sm btn-primary" onClick={save} disabled={!form.title.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}

      {bodyPreview && (
        <div className="overlay" onClick={() => setBodyPreview(null)}>
          <div className="modal" style={{ width: 760, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{bodyPreview.idea.title}</h3>
              <button className="icon-btn" onClick={() => setBodyPreview(null)}>×</button>
            </div>
            {bodyPreview.error !== ''
              ? <div style={{ color: 'var(--red)', fontSize: 12.5, padding: '12px 0' }}>{bodyPreview.error}</div>
              : (
                <div className="idea-body-preview outputs-viewer-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(bodyPreview.content) }} />
              )}
          </div>
        </div>
      )}

      {greenlight && (
        <div className="overlay" onClick={() => setGreenlight(null)}>
          <div className="modal" style={{ width: 420, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>立项：{greenlight.title.slice(0, 20)}{greenlight.title.length > 20 ? '…' : ''}</h3>
              <button className="icon-btn" onClick={() => setGreenlight(null)}>×</button>
            </div>
            <p style={{ margin: '6px 0 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              将建同名项目工作区并装配资料{greenlight.deconstruct ? '（拆解报告、字幕、视频与关键帧）' : ''}，
              账户画像按下选择带入快照。侧栏出现同名工作区分组。
            </p>
            <label className="field-label">账户画像</label>
            <select className="field" value={personaPick} onChange={(e) => setPersonaPick(e.target.value)}>
              <option value="">不带入</option>
              {personas.map((p) => (
                <option key={p.name} value={p.name}>{p.name}{p.description ? ` — ${p.description}` : ''}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn btn-sm" onClick={() => setGreenlight(null)}>取消</button>
              <button className="btn btn-sm btn-primary" onClick={confirmGreenlight} disabled={busy}>🚩 确认立项</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}
