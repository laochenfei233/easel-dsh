import { useState, useRef, useEffect, useMemo } from 'react';
import {
  createSchedule, fetchAccounts, publishNow, publishStatus, submitPublishSms, fetchOutputs, fetchOutputContent, mediaUrl,
} from '../lib/api';
import type { AccountItem, OutputFile } from '../lib/api';
import { pushTask } from '../lib/task';
import { loadPublishDraft, savePublishDraft } from '../lib/store';
import { renderMarkdown } from '../lib/sanitize';
import { IconPublish, IconCopy, IconCheck, IconCalendar, IconSkills, IconEdit, IconStop, IconTrash } from './icons';

interface PublishPageProps {
  persona: string;
  onNavigate?: (page: string) => void;
}

// 平台列表须与后端 LOGIN_RUNNERS 对齐（有登录/发布链路的才列）
const PLATFORMS: { key: string; label: string; titleLimit?: number; bodyLimit: number; hint: string }[] = [
  { key: 'xiaohongshu', label: '小红书', titleLimit: 20, bodyLimit: 1000, hint: '标题≤20，正文≤1000，重情绪+话题标签' },
  { key: 'douyin', label: '抖音', titleLimit: 55, bodyLimit: 55, hint: '文案≤55，前几字是钩子' },
  { key: 'kuaishou', label: '快手', titleLimit: 30, bodyLimit: 1000, hint: '视频或图片(图文)，标题≤30，需附媒体' },
  { key: 'weixin-channels', label: '视频号', bodyLimit: 1000, hint: '需附视频，短描述+话题标签，微信扫码登录' },
  { key: 'zhihu', label: '知乎', bodyLimit: 5000, hint: '长文/回答，讲清逻辑' },
  { key: 'bilibili', label: 'B站', titleLimit: 80, bodyLimit: 2000, hint: '需附视频，标题≤80、简介≤2000，默认投「知识」分区' },
  { key: 'wechat-oa', label: '公众号', titleLimit: 64, bodyLimit: 20000, hint: '图文文章，正文用 Markdown，首图作封面，发到草稿箱；需先在账号页「登录公众号后台」扫码' },
];

// 必须附带媒体的平台（无媒体发不了）——公众号需要一张封面图，也计入
const MEDIA_REQUIRED = new Set(['xiaohongshu', 'douyin', 'kuaishou', 'weixin-channels', 'bilibili', 'wechat-oa']);
// 只能发视频的平台（抖音/视频号/B站：图文不走此链路，必须视频）
const VIDEO_ONLY = new Set(['douyin', 'weixin-channels', 'bilibili']);
const VIDEO_RE = /\.(mp4|mov|webm|mkv|avi|m4v|flv|ts)$/i;
// 分发并发：平台间最多 2 路并行（每账号独立浏览器实例/进程）；同平台内严格串行
const PUBLISH_CONCURRENCY = 2;

type PubState = { status: 'publishing' | 'ok' | 'fail'; msg: string };

export default function PublishPage({ persona, onNavigate }: PublishPageProps) {
  const draft0 = loadPublishDraft();
  const [title, setTitle] = useState(draft0.title);
  const [body, setBody] = useState(draft0.body);
  const [accountIds, setAccountIds] = useState<string[]>(draft0.accounts);
  const [overrides, setOverrides] = useState<Record<string, string>>(draft0.overrides);
  const [tags, setTags] = useState(draft0.tags || '');
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');
  const [adapting, setAdapting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState('');
  const adaptCtl = useRef<(() => void) | null>(null);
  const checkCtl = useRef<(() => void) | null>(null);

  // 发布相关
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [mediaFiles, setMediaFiles] = useState<OutputFile[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pub, setPub] = useState<Record<string, PubState>>({});   // key = 账号 id
  const [publishing, setPublishing] = useState(false);
  // 发布时的短信验证窗口（抖音风控条件触发；没触发就不弹）
  const [pubSms, setPubSms] = useState<{ platform: string; accountId: string; name: string; state: string; message: string } | null>(null);
  const [pubSmsCode, setPubSmsCode] = useState('');
  const [pubSmsBusy, setPubSmsBusy] = useState(false);

  // 草稿持久化：任何改动即写 localStorage，切页/刷新回来都在
  useEffect(() => {
    savePublishDraft({ title, body, accounts: accountIds, overrides, tags });
  }, [title, body, accountIds, overrides, tags]);
  // 任务（适配/预检）离开页面后继续在会话里跑，不做卸载中止。

  // 登录态 + 可选媒体列表
  useEffect(() => {
    fetchAccounts().then(setAccounts).catch(() => { /* 忽略 */ });
    fetchOutputs().then((roots) => {
      const files: OutputFile[] = [];
      const walk = (n: OutputFile) => {
        if (n.type === 'file') { if (n.kind === 'image' || n.kind === 'video') files.push(n); return; }
        for (const c of n.children || []) walk(c);
      };
      roots.forEach(walk);
      files.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      setMediaFiles(files);
    }).catch(() => { /* 忽略 */ });
  }, []);

  // 已删掉的账号从勾选中剔除（账号页删除后回来不至于留着幽灵勾选）
  useEffect(() => {
    if (accounts.length === 0) return;
    setAccountIds((ids) => {
      const alive = ids.filter((id) => accounts.some((a) => a.id === id));
      return alive.length === ids.length ? ids : alive;
    });
  }, [accounts]);

  // 当前勾选的账号（按勾选顺序）；预览/适配按其覆盖的平台展开
  const targets = useMemo(
    () => accountIds.map((id) => accounts.find((a) => a.id === id)).filter((a): a is AccountItem => !!a),
    [accountIds, accounts]);
  const selectedPlatformKeys = useMemo(() => {
    const set = new Set(targets.map((a) => a.platform));
    return PLATFORMS.filter((p) => set.has(p.key));
  }, [targets]);
  // 同平台勾了 ≥2 个号：提示去重/限流风险（改写走聊天名册，不做 UI）
  const samePlatformMulti = useMemo(() => {
    const count: Record<string, number> = {};
    for (const a of targets) count[a.platform] = (count[a.platform] || 0) + 1;
    return Object.values(count).some((n) => n >= 2);
  }, [targets]);

  const toggleAccount = (id: string) =>
    setAccountIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2800); };
  const effective = (k: string) => overrides[k] ?? body;
  const empty = !title.trim() && !body.trim();
  const isVideoPath = (p: string) => /\.(mp4|mov|flv|mkv|avi|webm|m4v|wmv|ts|mpe?g)$/i.test(p);
  const toggleMedia = (path: string) =>
    setSelectedMedia((prev) => {
      if (prev.includes(path)) return prev.filter((x) => x !== path);
      // 通用规则：图片和视频不能同时；视频一次只发一个
      if (isVideoPath(path)) {
        if (prev.length && !prev.every(isVideoPath)) { showToast('图片和视频不能同时发布，请先取消已选图片'); return prev; }
        return [path]; // 视频单选
      }
      if (prev.some(isVideoPath)) { showToast('图片和视频不能同时发布，请先取消已选视频'); return prev; }
      return [...prev, path]; // 图片可多选（图文）
    });

  // A. 智能一稿多改（方案 B：dsh 会话回合后台跑；agent 按【交付方式】把各平台正文
  // 写进 outputs/_adapt/<batch>/<key>.txt，回合静默后页面读回填卡——结果也在对话里留档）
  const adapt = async () => {
    if (empty || selectedPlatformKeys.length === 0 || adapting) return;
    const sel = selectedPlatformKeys;
    const batch = `adapt-${Date.now().toString(36)}`;
    const prompt =
      `请执行技能 skill-content-repurposing（先读取 skills/openclaw/skill-content-repurposing/SKILL.md，` +
      `务必参考该 SKILL 的 platform-specs 与改写配方）：把下面这条内容改编到这些平台：${sel.map((p) => p.label).join('、')}。\n` +
      `【硬性要求】每个平台输出“可直接复制发布的纯文本正文”，禁止任何 Markdown 语法：不要 **加粗**、# 标题、---、表格、代码块、编号列表符号；` +
      `小红书可用 emoji 和 #话题标签，按平台习惯自然分行即可。\n` +
      `【交付方式】把每个平台的正文分别写入以下文件（UTF-8 纯文本，一个平台一个文件，文件内容只有正文本身）：\n` +
      sel.map((p) => `outputs/_adapt/${batch}/${p.key}.txt ← ${p.label}版`).join('\n') +
      `\n除上述文件外不要写其它文件。\n\n原始内容：\n标题：${title}\n正文：${body}`;

    setAdapting(true);
    try {
      const handle = await pushTask(prompt, { open: false });
      adaptCtl.current = handle.abort;
      const verdict = await handle.settled;
      if (verdict === 'aborted') { setAdapting(false); return; }
      const next = { ...overrides };
      let hit = 0;
      for (const p of sel) {
        try {
          const file = await fetchOutputContent(`_adapt/${batch}/${p.key}.txt`);
          if (!file.isBinary && file.content.trim()) { next[p.key] = file.content.trim(); hit++; }
        } catch { /* 该平台未产出 → 保留原值 */ }
      }
      setOverrides(next);
      showToast(hit ? `已生成 ${hit} 个平台版本` : '未能读回结果，产出可能只在对话里，可重试');
    } catch {
      showToast('改写失败，请重试');
    } finally {
      setAdapting(false);
    }
  };
  const stopAdapt = () => adaptCtl.current?.();

  // 预检（方案 B）：一个 dsh 会话回合同时做合规/标题/人设一致性三项检查，
  // 报告写 outputs/_adapt/<batch>.md，回合静默后页面读回展示。
  const runPrecheck = async (): Promise<string> => {
    const batch = `precheck-${Date.now().toString(36)}.md`;
    const prompt =
      `你是社媒发布审核助手。对下面这条待发内容做三项检查，用简洁中文分点输出：\n` +
      `1. **合规风险**：是否含极限词/医疗功效/敏感或违规表述，列出问题词+替换建议；无则写"未见明显风险"。\n` +
      `2. **标题/钩子**：给标题打 1-10 分，并给 1-2 个更好的备选。\n` +
      (persona
        ? `3. **人设一致性**：结合我的画像「${persona}」（profiles/${persona}/ 下的六维文件）检查内容是否贴合人设。\n`
        : `3. **人设一致性**：未选择画像，注明"未选择画像，已跳过"。\n`) +
      `最后一行给「✅可发 / ⚠️建议修改」结论。\n` +
      `完成后把完整预检报告写入 outputs/_adapt/${batch}（Markdown）。除该文件外不要写其它文件。\n\n` +
      `待检内容：\n标题：${title}\n正文：${body}`;
    const handle = await pushTask(prompt, { open: false });
    checkCtl.current = handle.abort;
    const verdict = await handle.settled;
    if (verdict !== 'done') throw new Error('预检未完成（详情见对话）');
    const file = await fetchOutputContent(`_adapt/${batch}`);
    if (file.isBinary || !file.content.trim()) throw new Error('预检结果未落盘（详情见对话）');
    return file.content;
  };

  // C. 发布前一键预检
  const check = async () => {
    if (empty) return;
    setChecking(true); setCheckResult('');
    try {
      setCheckResult(await runPrecheck());
    } catch (e) {
      setCheckResult(e instanceof Error ? e.message : '预检失败');
    } finally { setChecking(false); }
  };

  // D. 一键分发（真发布，二次确认）：平台间并发 ≤2（worker pool），平台内严格串行
  const publishAll = async () => {
    if (empty || publishing || checking) return;
    const groups = PLATFORMS
      .map((p) => targets.filter((a) => a.platform === p.key))
      .filter((g) => g.length > 0);
    if (groups.length === 0) {
      showToast('请先勾选要发布的账号');
      return;
    }
    setChecking(true);
    try {
      setCheckResult(await runPrecheck());
    } catch (e) {
      setCheckResult(`预检失败：${e instanceof Error ? e.message : '未知错误'}\n\n预检仅用于提醒，不会阻止你继续发布。`);
    } finally {
      setChecking(false);
    }
    const plan = groups.map((g) => {
      const label = PLATFORMS.find((p) => p.key === g[0].platform)?.label || g[0].platform;
      return `${label}：${g.map((a) => a.name).join('、')}`;
    }).join('\n');
    const okToSend = window.confirm(
      `发布前预检已执行，结果已显示在页面中。人设评分只做提醒，不会阻止发布。\n\n` +
      `即将【真实发布】到以下账号（同平台串行、跨平台最多 ${PUBLISH_CONCURRENCY} 路并行）：\n${plan}\n` +
      `这会公开发布到你的账号，确定继续？`);
    if (!okToSend) return;

    setPublishing(true);
    let gi = 0;
    const worker = async (): Promise<void> => {
      while (gi < groups.length) {
        const group = groups[gi++];
        for (const a of group) await publishOne(a);   // 同平台严格串行，规避同 IP 密集风控
      }
    };
    await Promise.all(Array.from({ length: Math.min(PUBLISH_CONCURRENCY, groups.length) }, () => worker()));
    setPublishing(false);
    showToast('发布流程结束，见各账号状态');
  };

  // 单账号发布：预检媒体门槛 → publishNow(account) → 异步平台逐账号轮询
  const publishOne = async (a: AccountItem) => {
    const meta = PLATFORMS.find((p) => p.key === a.platform);
    if (!a.loggedIn) {
      setPub((r) => ({ ...r, [a.id]: { status: 'fail', msg: '未登录 · 去账号页登录' } }));
      return;
    }
    if (MEDIA_REQUIRED.has(a.platform) && selectedMedia.length === 0) {
      setPub((r) => ({ ...r, [a.id]: { status: 'fail', msg: '需附带图片/视频' } }));
      return;
    }
    if (meta && VIDEO_ONLY.has(a.platform) && !selectedMedia.some((p) => VIDEO_RE.test(p))) {
      setPub((r) => ({ ...r, [a.id]: { status: 'fail', msg: `${meta.label}只能发视频，请从内容库选一个视频` } }));
      return;
    }
    setPub((r) => ({ ...r, [a.id]: { status: 'publishing', msg: '发布中…可能需 1-2 分钟' } }));
    try {
      const res = await publishNow(a.platform, { title, body: effective(a.platform), media: selectedMedia, tags, account: a.id });
      if (res.async) {
        await pollAsyncPublish(a);
      } else {
        setPub((r) => ({
          ...r,
          [a.id]: res.ok
            ? { status: 'ok', msg: '已发布 ✅' }
            : { status: 'fail', msg: res.detail || res.message || '发布失败' },
        }));
      }
    } catch (e) {
      setPub((r) => ({ ...r, [a.id]: { status: 'fail', msg: e instanceof Error ? e.message : '发布失败' } }));
    }
  };

  // 异步发布轮询（抖音）：直到 success/error；遇 sms_required/verifying 弹短信窗口（按账号寻址）
  const pollAsyncPublish = (a: AccountItem) => new Promise<void>((resolve) => {
    const label = PLATFORMS.find((p) => p.key === a.platform)?.label || a.platform;
    const started = Date.now();
    const iv = setInterval(async () => {
      if (Date.now() - started > 15 * 60 * 1000) {   // 15min 兜底
        clearInterval(iv); setPubSms((m) => (m && m.accountId === a.id ? null : m));
        setPub((r) => ({ ...r, [a.id]: { status: 'fail', msg: '发布超时' } }));
        resolve(); return;
      }
      let s;
      try { s = await publishStatus(a.platform, a.id); } catch { return; }  // 单次失败忽略
      if (s.state === 'sms_required' || s.state === 'verifying') {
        setPubSms({ platform: a.platform, accountId: a.id, name: `${label} · ${a.name}`, state: s.state, message: s.message });
        setPub((r) => ({ ...r, [a.id]: { status: 'publishing', msg: s.message || '需短信验证' } }));
      } else if (s.state === 'success') {
        clearInterval(iv); setPubSms((m) => (m && m.accountId === a.id ? null : m));
        setPub((r) => ({ ...r, [a.id]: { status: 'ok', msg: '已发布 ✅' } }));
        resolve();
      } else if (s.state === 'error') {
        clearInterval(iv); setPubSms((m) => (m && m.accountId === a.id ? null : m));
        setPub((r) => ({ ...r, [a.id]: { status: 'fail', msg: s.message || '发布失败' } }));
        resolve();
      } else {
        setPub((r) => ({ ...r, [a.id]: { status: 'publishing', msg: s.message || '发布中…' } }));
      }
    }, 2500);
  });

  const submitPubSms = async () => {
    if (!pubSms) return;
    const code = pubSmsCode.replace(/\D/g, '');
    if (code.length < 4) { showToast('验证码应为 4-6 位数字'); return; }
    setPubSmsBusy(true);
    try {
      await submitPublishSms(pubSms.platform, code, pubSms.accountId);
      setPubSmsCode('');
      setPubSms((p) => p && ({ ...p, state: 'verifying', message: '正在验证验证码…' }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : '提交失败');
    } finally {
      setPubSmsBusy(false);
    }
  };

  const copyFor = (key: string) => {
    const text = (title ? title + '\n\n' : '') + effective(key);
    navigator.clipboard?.writeText(text);
    setCopied(key); setTimeout(() => setCopied(''), 1400);
  };
  const addToCalendar = async (key: string) => {
    if (empty) return;
    const d = new Date();
    await createSchedule({
      title: title.trim() || effective(key).slice(0, 20), date: d.toISOString().slice(0, 10),
      platform: PLATFORMS.find((p) => p.key === key)?.label || '', time: '', status: 'draft', note: effective(key),
    });
    showToast('已存为草稿并加入今天的日历');
  };

  const canPublish = targets.length > 0;

  return (
    <div className="publish-page">
      <div className="publish-editor">
        <h1 className="page-title"><IconPublish size={21} /> 发布中心</h1>
        <p className="page-subtitle">一次编辑 → AI 一键改写成各平台版本 → 预检 → 附媒体 → 按账号一键分发。</p>

        <label className="field-label">标题</label>
        <input className="field" value={title} placeholder="标题（部分平台需要）"
          onChange={(e) => setTitle(e.target.value)} />
        <label className="field-label">正文（母版）</label>
        <textarea className="field" style={{ minHeight: 180 }} value={body}
          placeholder="写下你的内容，右侧按各平台规则实时预览；点「一键适配」让 AI 分平台改写…"
          onChange={(e) => setBody(e.target.value)} />

        <label className="field-label">话题标签 <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12 }}>（逗号分隔，如「AI,职场,干货」；小红书会用 # 联想真正绑定话题）</span></label>
        <input className="field" value={tags} placeholder="AI,职场,干货"
          onChange={(e) => setTags(e.target.value)} />

        <label className="field-label">
          发布目标 <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12 }}>（平台 → 账号，可跨平台多选；同平台串行发布，跨平台最多 {PUBLISH_CONCURRENCY} 路并行）</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PLATFORMS.map((p) => {
            const accs = accounts.filter((a) => a.platform === p.key);
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13, minWidth: 70 }}>{p.label}</b>
                {accs.length === 0 ? (
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    该平台还没有账号
                    <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }}
                      onClick={() => onNavigate?.('accounts')}>
                      去账号页添加
                    </button>
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    {accs.map((a) => (
                      <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={accountIds.includes(a.id)} onChange={() => toggleAccount(a.id)} />
                        {a.name}
                        {!a.loggedIn && <span style={{ fontSize: 11.5, color: 'var(--amber)' }}>未登录</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label className="field-label" style={{ marginTop: 14 }}>
          媒体附件 {selectedMedia.length > 0 && <span className="pv-badge">{selectedMedia.length} 个</span>}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12 }}>（小红书/抖音/快手/微信视频号/B站必需，从内容库选；抖音、视频号、B站须为视频）</span>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-sm" onClick={() => setShowPicker((v) => !v)}>
            <IconSkills size={13} /> {showPicker ? '收起' : '选择媒体'}
          </button>
          {selectedMedia.map((path) => (
            <div key={path} className="media-chip" onClick={() => toggleMedia(path)} title="点击移除">
              {mediaFiles.find((f) => f.path === path)?.kind === 'image'
                ? <img src={mediaUrl(path)} alt="" /> : <span className="media-vid">🎬</span>}
              <span className="media-x">×</span>
            </div>
          ))}
        </div>
        {showPicker && (
          <div className="media-grid">
            {mediaFiles.length === 0 && <div className="dash-empty">内容库暂无图片/视频</div>}
            {mediaFiles.slice(0, 40).map((f) => (
              <div key={f.path}
                className={`media-cell ${selectedMedia.includes(f.path) ? 'sel' : ''}`}
                onClick={() => toggleMedia(f.path)} title={f.path}>
                {f.kind === 'image'
                  ? <img src={mediaUrl(f.path)} alt={f.name} loading="lazy" />
                  : <span className="media-vid">🎬<br />{f.name.slice(0, 12)}</span>}
                {selectedMedia.includes(f.path) && <span className="media-check">✓</span>}
              </div>
            ))}
          </div>
        )}

        <div className="publish-actions">
          {adapting ? (
            <button className="btn btn-sm" onClick={stopAdapt}><IconStop size={13} /> 停止生成</button>
          ) : (
            <button className="btn btn-sm btn-primary" disabled={empty || selectedPlatformKeys.length === 0} onClick={adapt}>
              <IconSkills size={14} /> 一键适配各平台
            </button>
          )}
          <button className="btn btn-sm" disabled={empty || checking || adapting} onClick={check}>
            <IconCheck size={14} /> {checking ? '预检中…' : '发布前预检'}
          </button>
          <button className="btn btn-sm" disabled={empty} onClick={() => addToCalendar(selectedPlatformKeys[0]?.key || 'xiaohongshu')}>
            <IconCalendar size={14} /> 存草稿并排期
          </button>
          <button className="btn btn-sm btn-primary" disabled={empty || publishing || checking || !canPublish}
            title={canPublish ? '真实发布到勾选的账号' : '请先勾选要发布的账号'}
            onClick={publishAll}>
            <IconPublish size={14} /> {publishing ? '发布中…' : '一键发布'}
          </button>
          <button className="btn btn-sm btn-ghost" disabled={empty || adapting}
            onClick={() => { setTitle(''); setBody(''); setTags(''); setOverrides({}); setCheckResult(''); setPub({}); showToast('已清空'); }}>
            <IconTrash size={13} /> 清空
          </button>
          {samePlatformMulti && (
            <span style={{ fontSize: 12, color: 'var(--amber)', alignSelf: 'center', lineHeight: 1.5 }}>
              ⚠️ 同平台多号发同一内容有去重/限流风险，可在聊天里让 agent 按各号画像改写文案
            </span>
          )}
        </div>
        {adapting && <div className="adapt-hint"><span className="live-pulse" />AI 正在逐字改写各平台版本…可随时停止。</div>}
        <p className="publish-saved-note">草稿已自动保存，切换页面/刷新回来内容都在。一键发布仅对「已登录 + 媒体齐全」的账号生效。</p>
        {checkResult && (
          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-title"><IconCheck size={14} /> 发布前预检</div>
            <div className="skill-body-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(checkResult) }} />
          </div>
        )}
      </div>

      <div className="publish-previews">
        {selectedPlatformKeys.length === 0 && <div className="dash-empty">选择至少一个账号查看预览</div>}
        {selectedPlatformKeys.map((p) => {
          const text = effective(p.key);
          const over = text.length > p.bodyLimit;
          const titleOver = p.titleLimit != null && title.length > p.titleLimit;
          const isEdit = editing === p.key;
          const accs = targets.filter((a) => a.platform === p.key);
          return (
            <div key={p.key} className={`card pv-card pv-${p.key}`}>
              <div className="pv-head">
                <span className="pv-plat">
                  {p.label}
                  {overrides[p.key] != null && <span className="pv-badge">AI 版</span>}
                  <span className="pv-badge">{accs.length} 个账号</span>
                </span>
                <span className={`pv-count ${over ? 'over' : ''}`}>{text.length}/{p.bodyLimit}</span>
              </div>
              <div className="pv-body">
                {p.titleLimit != null && (
                  <div className={`pv-title ${titleOver ? 'over' : ''}`}>{title || <span className="pv-ph">标题…</span>}</div>
                )}
                {isEdit
                  ? <textarea className="field" style={{ minHeight: 120 }} value={text} autoFocus
                      onChange={(e) => setOverrides((o) => ({ ...o, [p.key]: e.target.value }))} />
                  : <div className="pv-text">{text || <span className="pv-ph">正文预览…</span>}</div>}
              </div>
              {accs.map((a) => {
                const st = pub[a.id];
                return st ? (
                  <div key={a.id} className={`pv-pubstate ${st.status}`}>
                    {st.status === 'publishing' && <span className="live-pulse" />}
                    {st.status === 'ok' ? '✅ ' : st.status === 'fail' ? '⚠️ ' : ''}{a.name} · {st.msg}
                  </div>
                ) : (
                  <div key={a.id} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={a.loggedIn ? 'pv-badge pv-badge-ok' : 'pv-badge'}>{a.loggedIn ? '已登录' : '未登录'}</span>
                    {a.name}
                  </div>
                );
              })}
              <div className="pv-foot">
                <span className="pv-hint">{p.hint}{over ? ' · 已超字数' : ''}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="pv-copy" onClick={() => setEditing(isEdit ? null : p.key)}>
                    <IconEdit size={13} />{isEdit ? '完成' : '编辑'}
                  </button>
                  <button className="pv-copy" onClick={() => copyFor(p.key)}>
                    {copied === p.key ? <IconCheck size={13} /> : <IconCopy size={13} />}{copied === p.key ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}

      {pubSms && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setPubSms(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 4px' }}>发布验证 · {pubSms.name}</h3>
            <p style={{ fontSize: 13, color: /错误|过期|失败|重新|未完成|不正确|失效/.test(pubSms.message || '') ? 'var(--red)' : 'var(--text-secondary)' }}>
              {pubSms.message || '平台风控要求短信验证，验证码已发到你手机，请输入：'}
            </p>
            {pubSms.state === 'verifying' ? (
              <div className="dash-empty" style={{ padding: 16 }}>正在验证验证码…</div>
            ) : (
              <>
                <input inputMode="numeric" autoFocus
                  placeholder="请输入手机收到的验证码" value={pubSmsCode}
                  onChange={(e) => setPubSmsCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitPubSms(); }}
                  style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center',
                    letterSpacing: 6, fontSize: 20, padding: '10px 12px', margin: '4px 0 10px',
                    border: '1px solid var(--border)', borderRadius: 8 }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setPubSms(null)}>关闭</button>
                  <button className="btn btn-sm btn-primary" disabled={pubSmsBusy} onClick={() => void submitPubSms()}>
                    {pubSmsBusy ? '提交中…' : '提交验证码'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
