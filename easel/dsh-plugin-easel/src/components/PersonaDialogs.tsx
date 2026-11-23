// Shared persona dialogs for the topic surfaces (spec easel-topic-persona-switch):
// TopicPersonaDialog fronts 做内容, GreenlightDialog fronts 立项. Both fetch
// /easel/api/status on open so the list reflects personas created by agent
// sessions since the page mounted.
import { useState, useEffect } from 'react';
import { fetchStatus, projectizeTopic } from '../lib/api';
import { getWorkspaceService } from '../lib/task';
import { pickGreenlightPersona } from '../lib/topic-prompt.js';

interface PersonaChoice {
  personas: { name: string; description?: string }[];
  defaultPersona: string;
}

/** 弹窗打开时取最新画像清单与宿主默认画像；status 不可达时按无画像降级。 */
async function fetchPersonaChoice(): Promise<PersonaChoice> {
  const status = await fetchStatus();
  return { personas: status?.personas ?? [], defaultPersona: status?.defaultPersona ?? '' };
}

const shortTitle = (title: string) => `${title.slice(0, 20)}${title.length > 20 ? '…' : ''}`;

/**
 * 做内容前的画像弹窗：空选 = 默认画像（拆解页 easel-breakdown-persona-push 的
 * 空选语义），确认后把解析画像交给调用方进会话。
 */
export function TopicPersonaDialog({ topic, onConfirm, onClose, confirmLabel = '开始创作' }: {
  topic: string;
  onConfirm: (persona: string) => void;
  onClose: () => void;
  /** 确认按钮文案；雷达收藏复用本弹窗时传「收藏」。 */
  confirmLabel?: string;
}) {
  const [choice, setChoice] = useState<PersonaChoice | null>(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchPersonaChoice().then(setChoice).catch(() => setChoice({ personas: [], defaultPersona: '' })); }, []);

  const confirm = () => {
    if (!choice || busy) return;
    setBusy(true);
    onConfirm(pick || choice.defaultPersona);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>做内容：{shortTitle(topic)}</h3>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <p style={{ margin: '6px 0 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          选择这次创作使用的账户画像，确认后进入新会话动笔；提示词会指到对应画像资料。
        </p>
        <label className="field-label">账户画像</label>
        {choice === null ? (
          <div className="loading" style={{ padding: '10px 0' }}><div className="spinner" />加载画像…</div>
        ) : (
          <select className="field" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{choice.defaultPersona ? `默认画像（${choice.defaultPersona}）` : '不带画像'}</option>
            {choice.personas.map((p) => (
              <option key={p.name} value={p.name}>{p.name}{p.description ? ` — ${p.description}` : ''}</option>
            ))}
          </select>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button className="btn btn-sm" onClick={onClose}>取消</button>
          <button className="btn btn-sm btn-primary" onClick={confirm} disabled={choice === null || busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** 立项弹窗的选题载荷：日历/雷达没有选题卡，ideaId/ideaPersona 缺省。 */
export interface GreenlightTopic {
  title: string;
  note?: string;
  source?: string;
  deconstruct?: string;
  ideaId?: string;
  ideaPersona?: string;
}

/**
 * 立项弹窗（自 IdeasPage 抽出）：预选拆解带入的画像（空选 = 不带入快照），
 * 确认 = projectize + 建同名 dsh 工作区。失败留在弹窗内可重试。
 */
export function GreenlightDialog({ topic, onDone, onClose }: {
  topic: GreenlightTopic;
  onDone: (safe: string) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<PersonaChoice | null>(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchPersonaChoice().then((c) => {
      setChoice(c);
      setPick(pickGreenlightPersona(c.personas, topic.ideaPersona));
    }).catch(() => setChoice({ personas: [], defaultPersona: '' }));
  }, []);

  const confirm = async () => {
    if (!choice || busy) return;
    setBusy(true); setError('');
    try {
      const status = await fetchStatus();
      const root = status?.projectRoot ?? '';
      if (!root) throw new Error('拿不到项目根');
      const { safe } = await projectizeTopic({
        ideaId: topic.ideaId, title: topic.title, note: topic.note, source: topic.source,
        fallback: topic.ideaId ?? topic.title, deconstruct: topic.deconstruct, persona: pick,
      });
      const ws = getWorkspaceService();
      if (!ws) throw new Error('工作区服务不可达');
      try {
        await ws.create({ path: `${root.replace(/[\/]+$/, '')}/projects/${safe}/` });
      } catch {
        // 重复立项时工作区已存在：播种照常完成，这里不当作失败。
      }
      onDone(safe);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>立项：{shortTitle(topic.title)}</h3>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <p style={{ margin: '6px 0 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          将建同名项目工作区并装配资料{topic.deconstruct ? '（拆解报告、字幕、视频与关键帧）' : ''}，
          账户画像按下选择带入快照。侧栏出现同名工作区分组。
        </p>
        <label className="field-label">账户画像</label>
        {choice === null ? (
          <div className="loading" style={{ padding: '10px 0' }}><div className="spinner" />加载画像…</div>
        ) : (
          <select className="field" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">不带入</option>
            {choice.personas.map((p) => (
              <option key={p.name} value={p.name}>{p.name}{p.description ? ` — ${p.description}` : ''}</option>
            ))}
          </select>
        )}
        {error !== '' && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button className="btn btn-sm" onClick={onClose}>取消</button>
          <button className="btn btn-sm btn-primary" onClick={confirm} disabled={busy}>🚩 确认立项</button>
        </div>
      </div>
    </div>
  );
}
