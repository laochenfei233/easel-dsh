import { useCallback, useEffect, useRef, useState } from 'react';
import { pushTask } from '../lib/task';
import { rosterPrompt } from '../lib/roster';
import { fetchOutputContent } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';
import { IconFire, IconIdea, IconSkills } from './icons';

interface BreakdownPageProps {
  persona: string;
  onNavigate?: (page: string) => void;
  /** Host remote plane: `remote.session.modelCatalog` feeds the model dropdowns. */
  remote?: { session?: { modelCatalog?: () => Promise<{ ok: boolean; value?: CatalogPayload; error?: { message?: string } }> } };
}

/** 采集任务状态（job.json 的镜像）。 */
interface DeconstructJob {
  id: string;
  url: string;
  stage: 'fetch' | 'frames' | 'asr' | 'ready' | 'failed';
  error?: string;
  /** 平台真实标题（已剥话题段；easel-deconstruct-title-attach D1）。 */
  title?: string;
  video?: string;
  frames?: number;
  framesDir?: string;
  framesError?: string;
  srt?: string;
  seconds?: number;
}

/** modelCatalog 里的一个模型（dsh 会话控制器投影）。 */
interface CatalogModel {
  id: string;
  name: string;
  inputModalities?: string[];
}

interface CatalogPayload {
  default?: { provider: string; model: string };
  groups: Array<{ id: string; name: string; models: CatalogModel[] }>;
  failures?: Array<{ id: string; name: string; message: string }>;
}

/** GET /easel/api/source-status 的一行。 */
interface SourceRow {
  platform: string;
  authRequired: boolean;
  cookieSet: boolean;
  loggedIn: boolean;
}

interface Preflight {
  platform: string;
  blocked: boolean;
  row: SourceRow | null;
}

const FETCH_STAGES: Array<{ key: DeconstructJob['stage']; label: string }> = [
  { key: 'fetch', label: '下载视频' },
  { key: 'frames', label: '抽取画面' },
  { key: 'asr', label: '语音转写' },
];

const PLATFORM_NAMES: Record<string, string> = {
  douyin: '抖音',
  xhs: '小红书',
  bili: 'B站',
  youtube: 'YouTube',
  other: '通用链接',
};

function stageIndex(stage: DeconstructJob['stage']): number {
  const i = FETCH_STAGES.findIndex(item => item.key === stage);
  return i < 0 ? FETCH_STAGES.length : i;
}

/** 模型目录拍平（含 provider 名）；目录加载失败返回空并让页面降级为提示。 */
function flattenCatalog(payload: CatalogPayload | null): Array<{ provider: string; providerName: string; model: CatalogModel }> {
  if (!payload) return [];
  return payload.groups.flatMap(group =>
    group.models.map(model => ({ provider: group.id, providerName: group.name, model })),
  );
}

/**
 * 爆款拆解完整页（spec easel-breakdown-fullpage + 设计增补）：链接 → preflight
 * 登录门控（未配置不启动，三条出路）→ 宿主直驱采集 → agent 分析 → 报告 → 入库。
 * ASR/视觉模型都从 dsh 模型管理目录（modelCatalog）下拉选择，不手填。
 */
export default function BreakdownPage({ persona, onNavigate, remote }: BreakdownPageProps) {
  const [input, setInput] = useState('');
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [asrModel, setAsrModel] = useState('');
  const [visionModel, setVisionModel] = useState('');
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [gateChecking, setGateChecking] = useState(false);
  const [job, setJob] = useState<DeconstructJob | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [analyzeState, setAnalyzeState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [report, setReport] = useState('');
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { abortRef.current?.(); }, []);

  // 模型管理目录：与「设置 → 模型」同一份数据（remote.session.modelCatalog）。
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const read = remote?.session?.modelCatalog;
        const response = read
          ? await read.call(remote.session)
          : await Promise.reject(new Error('模型目录通道不可用'));
        if (!alive) return;
        if (!response.ok || !response.value) throw new Error(response.error?.message ?? '模型目录读取失败');
        setCatalog(response.value);
        const models = flattenCatalog(response.value);
        // ASR 默认选名字/ID 带 asr 的第一个；没有就留给用户选。
        const asr = models.find(entry => /asr/i.test(entry.model.id) || /asr/i.test(entry.model.name));
        if (asr) setAsrModel(`${asr.provider}::${asr.model.id}`);
      } catch (error) {
        if (alive) setCatalogError(String((error as Error).message ?? error));
      }
    })();
    return () => { alive = false; };
  }, [remote]);

  const poll = useCallback(async (id: string) => {
    for (;;) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const res = await fetch(`/easel/api/deconstruct/${id}`, { headers: { accept: 'application/json' } })
        .catch(() => null);
      if (!res?.ok) continue;
      const data = await res.json() as DeconstructJob;
      setJob(data);
      if (data.stage === 'ready' || data.stage === 'failed') return;
    }
  }, []);

  /** 登录门控：需要登录态的平台（小红书）在 cookie/登录就绪前不创建任务。 */
  const checkGate = useCallback(async (): Promise<Preflight | null> => {
    const url = input.trim();
    if (!url) return null;
    const res = await fetch('/easel/api/deconstruct/preflight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => null);
    if (!res?.ok) return null;
    return await res.json() as Preflight;
  }, [input]);

  const startCapture = async () => {
    const url = input.trim();
    if (!url || capturing) return;
    setCapturing(true);
    setPreflight(null);
    try {
      const gate = await checkGate();
      if (gate === null) {
        setPreflight({ platform: 'other', blocked: true, row: null });
        return;
      }
      if (gate.blocked) {
        setPreflight(gate);
        return;
      }
      setJob(null);
      setReport('');
      setAnalyzeState('idle');
      const res = await fetch('/easel/api/deconstruct', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 完整 provider::model：宿主按服务商解析「设置→模型」里配置的凭据。
        body: JSON.stringify({ url, asrModel: asrModel || undefined }),
      });
      const data = await res.json() as DeconstructJob & { message?: string };
      if (!res.ok) throw new Error(data.message ?? '采集任务创建失败');
      setJob(data);
      void poll(data.id);
    } catch (error) {
      setJob({ id: '', url, stage: 'failed', error: String((error as Error).message ?? error) });
    } finally {
      setCapturing(false);
    }
  };

  const startAnalyze = async () => {
    if (!job || analyzeState === 'running') return;
    setAnalyzeState('running');
    setReport('');
    const firstLine = job.url.split('\n')[0].slice(0, 24);
    // EASEL-DIVERGENCE(easel-deconstruct-title-attach D1): 流水线从平台元数据拿到的
    // 真实标题（已剥话题段）优先作为选题名；老任务没有 title 才退回 URL 前缀。
    const ideaTitle = job.title ?? `拆解模板：${firstLine}`;
    const assets = [
      job.video ? `- 视频文件：${job.video}` : '',
      job.framesDir ? `- 抽帧目录：${job.framesDir}（共 ${job.frames ?? 0} 张 f-*.jpg，用 Read 逐张看关键帧）` : '',
      job.srt ? `- 字幕文件：${job.srt}（口播全文，必读）` : '',
      job.framesError ? `- 注意：抽帧失败（${job.framesError}），本次只靠字幕拆解` : '',
    ].filter(Boolean).join('\n');
    const roster = await rosterPrompt();
    const prompt =
      `你是爆款内容拆解专家。素材已由流水线采集完成，直接基于以下素材做拆解` +
      `${visionModel ? `（本会话已切到视觉模型 ${visionModel.split('::')[1]}，务必 Read 看帧引用画面证据）` : ''}：\n` +
      `${assets}\n\n` +
      `用中文分点输出：\n` +
      `1. **一句话概括**\n` +
      `2. **钩子拆解**：开头为什么抓人（前 3 秒画面 + 口播如何配合，须引用画面/字幕证据）\n` +
      `3. **结构套路**：分段/节奏/信息编排\n` +
      `4. **为什么会火**：情绪/共鸣/实用/争议点\n` +
      `5. **可复制模板**：把套路抽象成能直接套用的结构框架\n` +
      `6. **借这个套路${persona ? `、结合我的画像「${persona}」` : ''}可做的 3 个选题**\n` +
      `${roster}${roster ? '\n' : ''}` +
      `【完成后必须执行】\n` +
      `a) 把上面 1-6 点的完整 Markdown 报告写入 outputs/_deconstruct/${job.id}/report.md；\n` +
      `b) 读取 outputs/_ideas.json（不存在当 []），在最前插入一条：\n` +
      `{"id":"<12位随机hex>","title":${JSON.stringify(ideaTitle)},"note":"<完整报告Markdown>","source":"爆款拆解","status":"pending","deconstruct":"${job.id}","created":<当前unix秒>}，\n` +
      `保存为合法 JSON（UTF-8、缩进 2、注意 Markdown 转义）。title 已是合法 JSON 字面量，原样保留；deconstruct 字段是拆解批次号，立项时凭它把素材装配进项目工作区，必须原样保留。`;
    try {
      const handle = await pushTask(prompt, {
        model: visionModel
          ? (() => {
            const [provider, model] = visionModel.split('::');
            return { provider, model };
          })()
          : undefined,
      });
      abortRef.current = handle.abort;
      const verdict = await handle.settled;
      if (verdict !== 'done') {
        setAnalyzeState('error');
        return;
      }
      const content = await fetchOutputContent(`outputs/_deconstruct/${job.id}/report.md`)
        .then(data => (data.isBinary ? '' : data.content))
        .catch(() => '');
      setReport(content);
      setAnalyzeState(content ? 'done' : 'error');
    } catch {
      setAnalyzeState('error');
    }
  };

  const captureFailed = job?.stage === 'failed';
  const captureReady = job?.stage === 'ready';
  const currentStage = job ? stageIndex(job.stage) : -1;
  const models = flattenCatalog(catalog);
  const anyModalitiesDeclared = models.some(entry => entry.model.inputModalities !== undefined);
  const visionModels = models.filter(entry =>
    !anyModalitiesDeclared || (entry.model.inputModalities?.includes('image') ?? false));
  const gatePlatform = preflight ? PLATFORM_NAMES[preflight.platform] ?? preflight.platform : '';

  const modelSelect = (
    value: string,
    onChange: (next: string) => void,
    allowEmpty: boolean,
    emptyLabel: string,
    list: typeof models,
    disabled: boolean,
  ) => (
    <select
      className="field" style={{ marginLeft: 6, width: 250, padding: '5px 8px' }}
      value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {!allowEmpty && models.length === 0 && <option value="">（无可用模型）</option>}
      {catalog?.groups.map(group => {
        const groupModels = list.filter(entry => entry.provider === group.id);
        if (groupModels.length === 0) return null;
        return (
          <optgroup key={group.id} label={group.name}>
            {groupModels.map(entry => (
              <option key={`${group.id}::${entry.model.id}`} value={`${group.id}::${entry.model.id}`}>
                {entry.model.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );

  return (
    <div className="page-scroll breakdown-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconFire size={21} /> 爆款拆解</h1>
          <p className="page-subtitle">
            贴一条视频链接（抖音/小红书/B站/…），流水线自动下载、抽帧、转写字幕，再由 AI
            结合画面与口播拆出钩子、结构、火的原因与可复制模板，报告存档并自动入库选题库。
          </p>
        </div>
      </div>

      <div className="breakdown-body">
        <textarea
          className="field" style={{ minHeight: 72 }} value={input}
          placeholder="把视频链接贴进来，例如 https://v.douyin.com/…"
          disabled={capturing || (captureReady && analyzeState !== 'idle')}
          onChange={(e) => setInput(e.target.value)}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            ASR 模型
            {modelSelect(asrModel, setAsrModel, false, '', models, capturing)}
          </label>
          <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            视觉模型
            {modelSelect(visionModel, setVisionModel, true, '跟随会话当前模型', visionModels, capturing)}
          </label>
          <button
            className="btn btn-primary" style={{ marginLeft: 'auto' }}
            disabled={capturing || !input.trim() || (captureReady && analyzeState !== 'idle')}
            onClick={startCapture}
          >
            <IconSkills size={15} /> {capturing ? '检查中…' : '① 开始采集'}
          </button>
        </div>
        {catalogError && (
          <p style={{ fontSize: 12.5, color: 'var(--amber, #d97706)', margin: '8px 0 0' }}>
            模型目录读取失败（{catalogError}）。请在「设置 → 模型」确认模型配置后刷新本页；
            采集与拆解需要可用模型。
          </p>
        )}
        {!anyModalitiesDeclared && models.length > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            模型未标注视觉能力：请自行确认所选视觉模型支持图像输入，否则看帧拆解会退化。
          </p>
        )}

        {preflight?.blocked && (
          <div className="panel" style={{ marginTop: 16, borderColor: 'var(--amber, #d97706)' }}>
            <div className="panel-title"><IconFire size={14} /> {gatePlatform}还没准备好</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 10px' }}>
              {gatePlatform}抓取需要登录态：还没有可用的 cookie，也没有扫码登录。先把这一步补上，
              拆解工作流才能启动。
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => onNavigate?.('accounts')}>去账号页（填 cookie / 扫码登录）</button>
              <button className="btn btn-ghost" onClick={() => onNavigate?.('chat')}>让 Agent 在对话里登录</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary, #9ca3af)', margin: '10px 0 0' }}>
              完成任意一种后回到本页重新点「开始采集」即可；抖音无需登录。
            </p>
          </div>
        )}

        {job !== null && (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-title"><IconFire size={14} /> 采集流水线</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              {FETCH_STAGES.map((stage, i) => {
                const done = captureReady || (currentStage > i && !captureFailed);
                const active = job.stage === stage.key;
                const color = done ? 'var(--green, #16a34a)'
                  : active ? 'var(--amber, #d97706)'
                    : captureFailed && currentStage === i ? 'var(--red)'
                      : 'var(--text-tertiary, #9ca3af)';
                return (
                  <span key={stage.key} style={{ fontSize: 13, color }}>
                    {done ? '✓' : active ? '◐' : captureFailed && currentStage === i ? '✕' : '○'} {stage.label}
                  </span>
                );
              })}
              {captureReady && <span style={{ fontSize: 13, color: 'var(--green, #16a34a)' }}>✓ 采集完成</span>}
              {captureFailed && <span style={{ fontSize: 13, color: 'var(--red)' }}>✕ 采集失败</span>}
              {(capturing || (!captureReady && !captureFailed)) && <span className="loading" style={{ padding: 0 }}><div className="spinner" /></span>}
            </div>
            {captureFailed && (
              <p style={{ fontSize: 13, color: 'var(--red)', margin: '10px 0 0' }}>{job.error}</p>
            )}
            {captureReady && (
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '10px 0 0' }}>
                {job.title && <span style={{ display: 'block', color: 'var(--text)', marginBottom: 2 }}>《{job.title}》</span>}
                视频{job.seconds !== undefined ? `（${Math.round(job.seconds)}s）` : ''} · 帧 {job.frames ?? 0} 张
                {job.framesError ? `（抽帧失败：${job.framesError}）` : ''} · 字幕已生成
              </p>
            )}
          </div>
        )}

        {captureReady && (
          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-title"><IconFire size={14} /> AI 拆解</div>
            {analyzeState === 'idle' && (
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={startAnalyze}>
                  <IconFire size={15} /> ② 开始 AI 拆解
                </button>
                <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => onNavigate?.('chat')}>
                  在对话中跟进
                </button>
              </div>
            )}
            {analyzeState === 'running' && (
              <div className="loading" style={{ marginTop: 10 }}><div className="spinner" />AI 正在看素材拆解（对话里可审批/追问）…</div>
            )}
            {analyzeState === 'error' && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--red)', margin: '0 0 8px' }}>
                  拆解回合未正常完成，详情见对话。
                </p>
                <button className="btn btn-sm" onClick={startAnalyze}>重试</button>
              </div>
            )}
            {analyzeState === 'done' && (
              <div style={{ marginTop: 10 }}>
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-sm" onClick={() => onNavigate?.('ideas')}><IconIdea size={13} /> 去选题库</button>
                  <button className="btn btn-sm" onClick={() => onNavigate?.('chat')}>查看对话</button>
                </div>
              </div>
            )}
          </div>
        )}

        {job === null && !capturing && !preflight?.blocked && (
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 14 }}>
            小红书需要登录态（设置里填 cookie 或账号页扫码）；抖音免登录直连。素材与报告归档在
            outputs/_deconstruct/&lt;任务id&gt;/ 下。
          </p>
        )}
      </div>
    </div>
  );
}
