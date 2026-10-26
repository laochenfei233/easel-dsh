import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchSkillDetail, fetchOutputContent, saveEnv } from '../lib/api';
import type { SkillDetail } from '../lib/api';
import { pushTask } from '../lib/task';
import { rosterPrompt } from '../lib/roster';
import { renderMarkdown } from '../lib/sanitize';
import { displayName } from '../lib/skillDisplayNames';

interface SkillDrawerProps {
  skillName: string;
  persona: string;
  onClose: () => void;
  onConfigured: () => void;   // 保存 API 后通知父组件刷新卡片状态
  onNavigate?: (page: string) => void;
}

export default function SkillDrawer({ skillName, persona, onClose, onConfigured, onNavigate }: SkillDrawerProps) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loadErr, setLoadErr] = useState('');

  // API 配置输入（env -> 明文，只提交非空项）
  const [envInputs, setEnvInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // 执行区
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState('');
  const runCtl = useRef<(() => void) | null>(null);

  const loadDetail = () => {
    let ignore = false;
    fetchSkillDetail(skillName)
      .then((d) => { if (!ignore) { setDetail(d); setLoadErr(''); } })
      .catch(() => { if (!ignore) setLoadErr('加载 SKILL 详情失败'); });
    return () => { ignore = true; };
  };

  useEffect(loadDetail, [skillName]);

  const bodyHtml = useMemo(() => renderMarkdown(detail?.body || ''), [detail?.body]);
  const resultHtml = useMemo(() => renderMarkdown(result), [result]);

  const handleSaveEnv = async () => {
    const updates = Object.fromEntries(
      Object.entries(envInputs).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(updates).length === 0) { setSavedMsg('没有填写新值'); return; }
    setSaving(true);
    setSavedMsg('');
    try {
      await saveEnv(updates);
      setEnvInputs({});
      setDetail(await fetchSkillDetail(skillName));
      setSavedMsg('已保存 ✓');
      onConfigured();
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 方案 B：技能执行 = dsh 会话回合（后台跑，不打断当前页）。agent 按【交付方式】把
  // 产出写到 outputs/_adapt/<batch>，回合静默后页面读回该文件展示——结果仍在对话里留档。
  const handleRun = async () => {
    if (!input.trim() || running) return;
    setRunning(true);
    setRunErr('');
    setResult('');
    const batch = `skill-${Date.now().toString(36)}.md`;
    const roster = await rosterPrompt();
    const prompt =
      `请严格执行技能「${skillName}」：读取 skills/openclaw/${skillName}/SKILL.md，按它的流程、数据源与工具执行。\n` +
      (persona ? `执行时使用我的画像「${persona}」（profiles/${persona}/ 下的六维文件）。\n` : '') +
      roster +
      `任务输入：\n${input.trim()}\n\n` +
      `【交付方式】完成后，把最终产出全文写入 outputs/_adapt/${batch}（Markdown，内容只有产出本身）。除该文件外不要写其它文件。`;
    try {
      const handle = await pushTask(prompt, { open: false });
      runCtl.current = handle.abort;
      const verdict = await handle.settled;
      if (verdict === 'aborted') { setRunning(false); return; }
      const file = await fetchOutputContent(`_adapt/${batch}`);
      if (file.isBinary || !file.content.trim()) throw new Error('结果未落盘');
      setResult(file.content);
    } catch (e) {
      setRunErr(`${e instanceof Error ? e.message : '执行失败'}（产出也可能只在对话里，可打开对话查看）`);
    } finally {
      setRunning(false);
    }
  };

  const blocked = detail?.needsApi && !detail.apiConfigured;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="skill-detail-title">{displayName(skillName)}</div>
              <div className="skill-detail-rawname">{skillName}</div>
              <div className="skill-detail-meta">
                {detail?.layer && <span className="badge badge-accent">{{discover:'发现',plan:'策划',produce:'制作',publish:'发布',attribute:'归因',general:'通用'}[detail.layer] || detail.layer}</span>}
                {detail?.needsApi && (
                  detail.apiConfigured
                    ? <span className="badge badge-ok">✓ 已配置</span>
                    : <span className="badge badge-warn">❗ 需配置 API</span>
                )}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose} title="关闭">×</button>
          </div>
        </div>

        <div className="drawer-body">
          {loadErr && <div style={{ color: 'var(--red)', fontSize: 14 }}>{loadErr}</div>}

          {/* API 配置 */}
          {detail?.needsApi && detail.apiSpec && (
            <div className="panel">
              <div className="panel-title">🔑 {detail.apiSpec.label} · API 配置
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 12 }}>
                  （任选一个服务商填齐即可用）
                </span>
              </div>
              {detail.apiSpec.settings.length > 0 && (
                <div className="provider-block">
                  <div className="provider-head"><strong style={{ fontSize: 13 }}>默认选择与能力</strong></div>
                  {detail.apiSpec.settings.map((k) => (
                    <div key={k.env}>
                      <label className="field-label">
                        {k.label} · 可选
                        {k.configured && <span style={{ color: 'var(--green)', marginLeft: 6 }}>
                          已配置{k.masked ? `：${k.masked}` : ''}
                        </span>}
                      </label>
                      {k.choices.length > 0 ? (
                        <select
                          className="field"
                          value={envInputs[k.env] ?? ''}
                          onChange={(e) => setEnvInputs((p) => ({ ...p, [k.env]: e.target.value }))}
                        >
                          <option value="">{k.configured ? `当前：${k.masked}` : `请选择 ${k.env}`}</option>
                          {k.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                        </select>
                      ) : (
                        <input
                          className="field"
                          type={k.secret ? 'password' : 'text'}
                          placeholder={k.configured ? '留空则保持不变，输入以覆盖' : `请输入 ${k.env}`}
                          value={envInputs[k.env] || ''}
                          onChange={(e) => setEnvInputs((p) => ({ ...p, [k.env]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {detail.apiSpec.providers.map((prov) => {
                const provOk = prov.keys.filter(k => k.required).every(k => k.configured);
                return (
                  <div key={prov.id} className={`provider-block ${provOk ? 'configured' : ''}`}>
                    <div className="provider-head">
                      <strong style={{ fontSize: 13 }}>{prov.name}</strong>
                      {provOk
                        ? <span className="badge badge-ok">✓ 就绪</span>
                        : <span className="badge">未配置</span>}
                    </div>
                    {prov.keys.map((k) => (
                      <div key={k.env}>
                        <label className="field-label">
                          {k.label}{k.required ? '' : ' · 可选'}
                          {k.configured && <span style={{ color: 'var(--green)', marginLeft: 6 }}>
                            已配置{k.secret && k.masked ? `（${k.masked}）` : k.masked ? `：${k.masked}` : ''}
                          </span>}
                        </label>
                        {k.choices.length > 0 ? (
                          <select className="field" value={envInputs[k.env] ?? ''}
                            onChange={(e) => setEnvInputs((p) => ({ ...p, [k.env]: e.target.value }))}>
                            <option value="">{k.configured ? `当前：${k.masked}` : `请选择 ${k.env}`}</option>
                            {k.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                          </select>
                        ) : (
                          <input
                            className="field"
                            type={k.secret ? 'password' : 'text'}
                            placeholder={k.configured ? '留空则保持不变，输入以覆盖' : `请输入 ${k.env}`}
                            value={envInputs[k.env] || ''}
                            onChange={(e) => setEnvInputs((p) => ({ ...p, [k.env]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveEnv} disabled={saving}>
                  {saving ? '保存中…' : '保存到 .env'}
                </button>
                {savedMsg && <span style={{ fontSize: 13, color: savedMsg.includes('✓') ? 'var(--green)' : 'var(--text-secondary)' }}>{savedMsg}</span>}
              </div>
            </div>
          )}

          {/* 执行 */}
          <div className="panel">
            <div className="panel-title">▶ 运行</div>
            {blocked && (
              <div style={{ fontSize: 13, color: 'var(--amber)', marginBottom: 10 }}>
                该 SKILL 需要先配置上面的 API 才能运行。
              </div>
            )}
            <textarea
              className="field"
              placeholder="输入内容，例如主题 / 素材 / 要求…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ minHeight: 100 }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={handleRun} disabled={running || !input.trim() || blocked}>
                {running
                  ? <><span className="spinner" style={{ width: 14, height: 14, margin: 0 }} />执行中…</>
                  : '执行'}
              </button>
              {running && (
                <>
                  <button className="btn btn-sm" onClick={() => runCtl.current?.()}>停止</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => onNavigate?.('chat')}>打开对话</button>
                </>
              )}
            </div>
            {running && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                任务在 dsh 对话里后台执行；遇到工具确认/提问请到对话里处理。
              </div>
            )}
            {runErr && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{runErr}</div>}
            {resultHtml && (
              <div className="skill-result" dangerouslySetInnerHTML={{ __html: resultHtml }} />
            )}
          </div>

          {/* 描述 */}
          <div className="panel">
            <div className="panel-title">📖 说明</div>
            {detail
              ? <div className="skill-body-md" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              : !loadErr && <div className="loading"><div className="spinner" />加载中…</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
