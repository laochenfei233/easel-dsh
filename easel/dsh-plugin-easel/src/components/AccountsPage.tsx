import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchAccounts, createAccount, updateAccount, deleteAccount,
  startLogin, loginStatus, mediaUrl, fetchStatus,
  accountWhoami, logoutAccount, submitLoginSms,
  saveCredentials, getCredentials, startMpLogin, mpLoginStatus,
} from '../lib/api';
import type { AccountItem, AccountWhoami, LoginMode } from '../lib/api';
import { getWhoamiCache, setWhoamiCache, verifyStale } from '../lib/whoami';

type QRState = {
  account: AccountItem;
  title?: string;      // 弹窗标题（缺省 = 账号名；公众号后台登录加「后台取数」后缀）
  state: string;       // starting | qr_ready | success | expired | error | unknown
  message: string;
  qr: string;          // outputs 相对路径
  qrTs?: number;       // 二维码文件 mtime，作 img 缓存键：码刷新一次就变，避免看到过期旧码
};

type DirectState = {
  account: AccountItem;
  message: string;
  checking: boolean;
  verdict: '' | 'ok' | 'no';
};

const STATE_LABEL: Record<string, string> = {
  starting: '启动中…',
  qr_ready: '请扫码',
  scanned: '扫码成功',
  sms_required: '需短信验证',
  verifying: '验证中…',
  success: '登录成功 ✅',
  expired: '二维码已过期',
  error: '登录出错',
  unknown: '等待中…',
};

// 平台须与后端 LOGIN_RUNNERS 对齐；没有账号的平台也展示分组（首个账号从这里添加）
const PLATFORM_META: { key: string; label: string; backend: string }[] = [
  { key: 'xiaohongshu', label: '小红书', backend: 'xhs' },
  { key: 'douyin', label: '抖音', backend: 'douyin' },
  { key: 'kuaishou', label: '快手', backend: 'web' },
  { key: 'weixin-channels', label: '微信视频号', backend: 'web' },
  { key: 'zhihu', label: '知乎', backend: 'web' },
  { key: 'bilibili', label: 'B站', backend: 'biliup' },
  { key: 'wechat-oa', label: '微信公众号', backend: 'wechat-oa' },
];

const WECHAT_PLACEHOLDER: AccountItem = {
  id: 'wechat-oa', platform: 'wechat-oa', name: '微信公众号', persona: '',
  backend: 'wechat-oa', profileDir: '', loggedIn: false, direct: false,
};

/** 头像：有 URL 就显示图（加载失败退回首字），否则显示昵称/账号名首字。 */
function Avatar({ url, name }: { url?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().charAt(0);
  if (url && !broken) {
    return <img className="account-avatar" src={url} alt={name}
      referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <div className="account-avatar account-avatar-fallback">{initial}</div>;
}

/** 拆解数据源登录态（spec easel-breakdown-fullpage 设计增补）：cookie 只进不出。 */
function DeconstructSources() {
  interface SourceRow { platform: string; authRequired: boolean; cookieSet: boolean; loggedIn: boolean }
  const NAMES: Record<string, string> = { douyin: '抖音', xhs: '小红书', bili: 'B站', youtube: 'YouTube' };
  const HINTS: Record<string, string> = {
    douyin: '移动端接口直连，免登录。',
    xhs: '登录 web 版小红书 → F12 → 网络 → 任一请求的 Cookie 请求头整串粘贴。',
    bili: '公开视频免登录；投稿/评论抓取用上方扫码登录。',
    youtube: '公开视频免登录（需本机 yt-dlp）。',
  };
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(() => {
    fetch('/easel/api/source-status', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('读取失败'))))
      .then((data: { platforms: SourceRow[] }) => { setRows(data.platforms ?? []); setDraft(''); })
      .catch(() => setMsg('读取数据源状态失败，稍后重试。'));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // 登录成功后的自动回传 / 别处改动 → 窗口重新聚焦时对账一次。
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const importFromLogin = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/easel/api/cookies/import', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'xhs' }),
      });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message ?? '导入失败');
      setMsg(`已从登录会话导入 ${String((data as { count?: number }).count ?? '')} 条 cookie。`);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '导入失败');
    } finally {
      setSaving(false);
    }
  };

  const save = async (platform: string, value: string) => {
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/easel/api/cookies', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform, cookie: value }),
      });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message ?? '保存失败');
      setMsg(value.trim() ? '已保存，回「爆款拆解」重新点开始采集即可。' : '已清除。');
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const badge = (row: SourceRow) => {
    if (!row.authRequired) return <span style={{ fontSize: 12, color: 'var(--green)' }}>免登录</span>;
    if (row.loggedIn) return <span style={{ fontSize: 12, color: 'var(--green)' }}>已扫码登录</span>;
    if (row.cookieSet) return <span style={{ fontSize: 12, color: 'var(--green)' }}>cookie 已配置</span>;
    return <span style={{ fontSize: 12, color: 'var(--amber)' }}>未配置</span>;
  };

  return (
    <div className="card" style={{ marginTop: 16, padding: 14 }}>
      <div className="account-card-head">
        <span className="account-card-name">拆解数据源（爆款拆解的视频抓取登录态）</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {rows.map((row) => (
          <div key={row.platform} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13, flexWrap: 'wrap' }}>
            <b style={{ minWidth: 52 }}>{NAMES[row.platform] ?? row.platform}</b>
            {badge(row)}
            <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{HINTS[row.platform] ?? ''}</span>
          </div>
        ))}
      </div>
      <textarea
        className="field" style={{ minHeight: 54, marginTop: 10, fontFamily: 'monospace', fontSize: 12 }}
        placeholder="小红书 cookie：粘贴网页版登录后的 Cookie 请求头整串（明文不回显；留空并保存=清除）"
        value={draft} onChange={(e) => setDraft(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={saving || !draft.trim()} onClick={() => void save('xhs', draft)}>
          {saving ? '保存中…' : '保存小红书 cookie'}
        </button>
        <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void save('xhs', '')}>清除</button>
        {rows.find(r => r.platform === 'xhs')?.loggedIn && (
          <button className="btn btn-sm" disabled={saving} onClick={() => void importFromLogin()}>
            从登录会话导入
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [personas, setPersonas] = useState<{ name: string; description?: string }[]>([]);
  const [err, setErr] = useState('');
  const [loginTarget, setLoginTarget] = useState<AccountItem | null>(null);   // 登录弹窗：模式选择 + 进行中
  const [loginErr, setLoginErr] = useState('');
  const [qr, setQr] = useState<QRState | null>(null);       // 扫码模式进行中
  const [direct, setDirect] = useState<DirectState | null>(null);   // 直启窗口模式进行中
  const [qrNonce, setQrNonce] = useState(0);   // 每次登录 +1，稳定缓存 key，避免每次轮询 img 闪烁
  const [busy, setBusy] = useState('');
  const [logoutBusy, setLogoutBusy] = useState('');
  const [delBusy, setDelBusy] = useState('');
  const [personaBusy, setPersonaBusy] = useState('');
  const [rename, setRename] = useState<{ id: string; value: string } | null>(null);
  // 添加账号（平台头部入口）
  const [addTarget, setAddTarget] = useState<{ platform: string; label: string } | null>(null);
  const [addName, setAddName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsErr, setSmsErr] = useState('');
  // whoami 结果缓存到 localStorage（key = 账号 id；默认账号 id 恰为平台 key，与工作台共享）：
  // 打开页面秒显示昵称/头像，不必每次都起浏览器校验
  const [whoami, setWhoami] = useState<Record<string, AccountWhoami | 'loading'>>(() => getWhoamiCache());
  // 凭证式登录（微信公众号 AppID/AppSecret）
  const [cred, setCred] = useState<{ platform: string; name: string } | null>(null);
  const [credForm, setCredForm] = useState({ appId: '', appSecret: '', author: '' });
  const [credBusy, setCredBusy] = useState(false);
  const [credMsg, setCredMsg] = useState('');
  const [credErr, setCredErr] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef = useRef(true);
  const smsAccountRef = useRef<AccountItem | null>(null);   // 当前登录中的账号，供 submitSms 稳定引用

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // 真校验某账号登录态 + 拉昵称/头像（后端起浏览器，数秒）；手动「校验账号」或登录成功后调
  const runWhoami = useCallback((a: AccountItem) => {
    setWhoami((w) => ({ ...w, [a.id]: 'loading' }));
    accountWhoami(a.platform, a.id)
      .then((r) => { if (aliveRef.current) { setWhoami((w) => ({ ...w, [a.id]: r })); setWhoamiCache(a.id, r); } })
      .catch(() => {
        if (aliveRef.current) setWhoami((w) => { const n = { ...w }; delete n[a.id]; return n; });
      });
  }, []);

  // 打开页面：拉账号列表（快），随后后台自愈——对缓存缺失/过期的浏览器账号逐个真校验（whoami）。
  const load = useCallback(() => {
    setErr('');
    fetchAccounts()
      .then((list) => {
        if (!aliveRef.current) return;
        setAccounts(list);
        const byId = new Map(list.map((a) => [a.id, a] as const));
        // B站走 cookie 判定、公众号走凭证/mp 会话判定，都不起浏览器，不自动校验。
        verifyStale(
          list.filter((a) => a.backend !== 'biliup' && a.backend !== 'wechat-oa').map((a) => a.id),
          {
            alive: () => aliveRef.current,
            resolve: (id) => ({ platform: byId.get(id)?.platform ?? '', account: id }),
            onUpdate: (id, r) => setWhoami((w) => ({ ...w, [id]: r })),
          },
        );
      })
      .catch(() => setErr('加载账号列表失败'));
    fetchStatus().then((s) => { if (aliveRef.current && s?.personas) setPersonas(s.personas); }).catch(() => { /* 画像下拉留空 */ });
  }, []);

  useEffect(() => { load(); }, [load]);

  // 切回本标签页 / 窗口重新获得焦点时自动重拉账号态——登录/退出后即使漏了一次刷新，切回来也是最新的。
  // （登录中弹着二维码时不打扰，避免打断轮询。）
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !pollRef.current) load(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const closeLogin = useCallback(() => {
    stopPoll();
    setLoginTarget(null);
    setQr(null);
    setDirect(null);
    setLoginErr('');
    setSmsCode(''); setSmsErr(''); setSmsBusy(false);
    load();
  }, [stopPoll, load]);

  const openLogin = useCallback((a: AccountItem) => {
    setLoginErr('');
    setQr(null);
    setDirect(null);
    setLoginTarget(a);
  }, []);

  // 登录成功后的公共收尾：拉账号信息；xhs 把该账号登录态里的 cookie 回传给拆解下载器。
  const onLoginSuccess = useCallback((a: AccountItem) => {
    runWhoami(a);
    if (a.platform === 'xiaohongshu') {
      void fetch('/easel/api/cookies/import', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'xhs', account: a.id }),
      }).catch(() => {});
    }
    load();
  }, [runWhoami, load]);

  const handleLogin = useCallback(async (a: AccountItem, mode: LoginMode) => {
    setLoginErr('');
    setBusy(a.id);
    setSmsCode(''); setSmsErr('');
    smsAccountRef.current = a;
    setQrNonce((n) => n + 1);
    try {
      const res = await startLogin(a.platform, mode, { account: a.id });
      if (res.mode === 'credentials') {   // 公众号：后端引导走凭证表单
        setLoginTarget(null);
        openCred(a);
        return;
      }
      if (mode === 'direct') {
        stopPoll();
        setQr(null);
        setDirect({
          account: a,
          message: res.message || '请在打开的窗口中登录，完成后点「校验登录态」',
          checking: false, verdict: '',
        });
        load();   // 列表里的「窗口」标记翻新
        return;
      }
      stopPoll();
      setQr({ account: a, state: res.state || 'starting', message: res.message || '', qr: res.qr || '' });
      pollRef.current = setInterval(async () => {
        try {
          const s = await loginStatus(a.platform, a.id);
          setQr((prev) => (prev && prev.account.id === a.id
            ? { ...prev, state: s.state, message: s.message, qr: s.qr, qrTs: s.qrTs } : prev));
          if (['success', 'expired', 'error'].includes(s.state)) {
            stopPoll();
            if (s.state === 'success') onLoginSuccess(a);
          }
        } catch { /* 忽略单次轮询失败 */ }
      }, 2000);
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : '启动登录失败');
    } finally {
      setBusy('');
    }
  }, [stopPoll, onLoginSuccess, load]);

  // 直启窗口模式：人工登录后手动校验（后端起浏览器实测登录态）
  const verifyDirect = useCallback((a: AccountItem) => {
    setDirect((d) => (d && d.account.id === a.id ? { ...d, checking: true, verdict: '' } : d));
    accountWhoami(a.platform, a.id)
      .then((r) => {
        if (!aliveRef.current) return;
        setWhoami((w) => ({ ...w, [a.id]: r }));
        setWhoamiCache(a.id, r);
        const ok = r.loggedIn;
        setDirect((d) => (d && d.account.id === a.id ? { ...d, checking: false, verdict: ok ? 'ok' : 'no' } : d));
        if (ok) load();
      })
      .catch(() => {
        if (aliveRef.current) setDirect((d) => (d && d.account.id === a.id ? { ...d, checking: false, verdict: 'no' } : d));
      });
  }, [load]);

  const submitSms = useCallback(async () => {
    const target = smsAccountRef.current;
    const code = smsCode.replace(/\D/g, '');
    if (!target) return;
    if (code.length < 4) { setSmsErr('请输入手机收到的验证码'); return; }
    setSmsBusy(true); setSmsErr('');
    try {
      await submitLoginSms(target.platform, code, target.id);
      setSmsCode('');
      // 乐观切到「验证中」转圈：后端读走码→verifying；成功→success，失败→退回 sms_required 带错误
      setQr((prev) => prev && ({ ...prev, state: 'verifying', message: '正在验证验证码…' }));
      // 不停轮询：runner 读走验证码填码提交后，state 会转 success / 或退回 sms_required 重试
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : '提交验证码失败');
    } finally {
      setSmsBusy(false);
    }
  }, [smsCode]);

  // 凭证式（公众号）：打开 AppID/AppSecret 表单
  const openCred = useCallback((a: AccountItem) => {
    setCred({ platform: a.platform, name: a.name });
    setCredForm({ appId: '', appSecret: '', author: '' });
    setCredMsg(''); setCredErr('');
    getCredentials(a.platform)
      .then((c) => { if (aliveRef.current && c.configured) setCredMsg(`已配置：AppID ${c.appIdMasked}`); })
      .catch(() => { /* 未配置，忽略 */ });
  }, []);

  const closeCred = useCallback(() => { setCred(null); setCredBusy(false); load(); }, [load]);

  const submitCred = useCallback(async () => {
    if (!cred) return;
    const appId = credForm.appId.trim();
    const appSecret = credForm.appSecret.trim();
    if (!appId || !appSecret) { setCredErr('AppID 和 AppSecret 都要填'); return; }
    setCredBusy(true); setCredErr(''); setCredMsg('');
    try {
      const r = await saveCredentials(cred.platform, { appId, appSecret, name: cred.name, author: credForm.author.trim() });
      if (r.ok) {
        const entry = accounts.find((a) => a.platform === cred.platform);
        if (entry) runWhoami(entry);
        closeCred();
      } else {
        setCredErr(r.message || '验证未通过');
      }
    } catch (e) {
      setCredErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setCredBusy(false);
    }
  }, [cred, credForm, accounts, runWhoami, closeCred]);

  // 公众号后台扫码登录（数据中心取数用，独立于 AppID 凭证）
  const handleMpLogin = useCallback(async (a: AccountItem) => {
    setBusy(a.id + ':mp');
    setSmsCode(''); setSmsErr('');
    setQrNonce((n) => n + 1);
    try {
      const res = await startMpLogin(a.platform);
      setLoginTarget(a);
      setQr({ account: a, title: `${a.name} · 后台取数`, state: res.state || 'starting',
              message: res.message || '', qr: res.qr || '', qrTs: res.qrTs });
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const s = await mpLoginStatus(a.platform);
          setQr((prev) => (prev && prev.account.id === a.id
            ? { ...prev, state: s.state, message: s.message, qr: s.qr, qrTs: s.qrTs } : prev));
          if (['success', 'expired', 'error'].includes(s.state)) {
            stopPoll();
            if (s.state === 'success') {
              // 内存态立即翻「已登录」，不等 load() 那趟网络往返（后面 load() 再对账兜底）。
              setAccounts((list) => list.map((x) => x.id === a.id ? { ...x, loggedIn: true } : x));
              setWhoami((w) => { const n = { ...w }; delete n[a.id]; return n; });
              setWhoamiCache(a.id, null);
              runWhoami(a);
              load();
            }
          }
        } catch { /* 忽略单次轮询失败 */ }
      }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '启动后台登录失败');
    } finally {
      setBusy('');
    }
  }, [stopPoll, runWhoami, load]);

  const handleLogout = useCallback(async (a: AccountItem) => {
    if (!window.confirm(`确定退出「${a.name}」的登录？该账号的登录态将被清除，下次发布需重新登录。`)) return;
    setLogoutBusy(a.id);
    try {
      await logoutAccount(a.platform, a.id);
      // 内存态立即翻未登录（同登录路径），不等 load() 回来
      setAccounts((list) => list.map((x) => x.id === a.id ? { ...x, loggedIn: false } : x));
      setWhoami((w) => { const n = { ...w }; delete n[a.id]; return n; });
      setWhoamiCache(a.id, null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '退出登录失败');
    } finally {
      setLogoutBusy('');
    }
  }, [load]);

  const handleDelete = useCallback(async (a: AccountItem) => {
    if (!window.confirm(`确定删除账号「${a.name}」？将删除账号条目并清除该账号的登录态与本地浏览器数据，不可恢复。`)) return;
    setDelBusy(a.id);
    try {
      await deleteAccount(a.id);
      setWhoami((w) => { const n = { ...w }; delete n[a.id]; return n; });
      setWhoamiCache(a.id, null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '删除账号失败');
    } finally {
      setDelBusy('');
    }
  }, [load]);

  // 画像下拉选中即绑定（'' = 解绑，走通用模式）
  const setPersona = useCallback(async (a: AccountItem, persona: string) => {
    setPersonaBusy(a.id);
    setAccounts((list) => list.map((x) => x.id === a.id ? { ...x, persona } : x));
    try {
      await updateAccount(a.id, { persona: persona || null });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '画像绑定失败');
      load();
    } finally {
      setPersonaBusy('');
    }
  }, [load]);

  const commitRename = useCallback(() => {
    if (!rename) return;
    const { id, value } = rename;
    setRename(null);
    const name = value.trim();
    if (!name) return;
    updateAccount(id, { name })
      .then(load)
      .catch((e) => setErr(e instanceof Error ? e.message : '改名失败'));
  }, [rename, load]);

  const submitAdd = useCallback(async () => {
    if (!addTarget) return;
    const name = addName.trim();
    if (!name) { setAddErr('请输入账号名字'); return; }
    setAddBusy(true); setAddErr('');
    try {
      const created = await createAccount(addTarget.platform, name);
      setAddTarget(null);
      setAddName('');
      load();
      openLogin({
        id: created.id, platform: created.platform, name: created.name,
        persona: created.persona, backend: PLATFORM_META.find((p) => p.key === created.platform)?.backend ?? '',
        profileDir: created.profileDir, loggedIn: false, direct: false,
      });
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : '创建账号失败');
    } finally {
      setAddBusy(false);
    }
  }, [addTarget, addName, load, openLogin]);

  // 卡片真实登录态：whoami 权威（已返回则以它为准，自愈假阳性），否则用后端 last-known。
  // 公众号(wechat-oa)例外：后端查 mp 会话即真值(快且权威)，直接用它，避免过期的 whoami 缓存把已登录盖成未登录。
  const effLoggedIn = (a: AccountItem): boolean => {
    if (a.backend === 'wechat-oa') return a.loggedIn;
    const w = whoami[a.id];
    if (w && w !== 'loading') return w.loggedIn;
    return a.loggedIn;
  };

  // 按平台分组（保持固定平台顺序；后端新平台追加在后面）
  const groups = useMemo(() => {
    const m = new Map<string, AccountItem[]>();
    for (const p of PLATFORM_META) m.set(p.key, []);
    for (const a of accounts) {
      if (!m.has(a.platform)) m.set(a.platform, []);
      m.get(a.platform)!.push(a);
    }
    return [...m.entries()];
  }, [accounts]);

  const renderRow = (a: AccountItem) => {
    const w = whoami[a.id];
    const info = w && w !== 'loading' ? w : null;
    const logged = effLoggedIn(a);
    const isWechat = a.backend === 'wechat-oa';
    return (
      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <Avatar url={info?.avatar} name={info?.name || a.name} />
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {rename?.id === a.id ? (
              <input className="field" style={{ padding: '3px 8px', fontSize: 13, width: 150 }}
                value={rename.value} autoFocus
                onChange={(e) => setRename({ id: a.id, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRename(null);
                }}
                onBlur={commitRename} />
            ) : (
              <span style={{ fontWeight: 650, fontSize: 14 }}>{a.name}</span>
            )}
            {logged ? (
              w === 'loading'
                ? <span className="badge">校验中…</span>
                : <span className="badge badge-ok">✓ 已登录</span>
            ) : (
              <span className="badge">未登录</span>
            )}
            {a.direct && <span className="badge" title="该账号的直启登录窗口还开着">🪟 窗口开启</span>}
            {rename?.id !== a.id && (
              <button className="icon-btn" title="改名" style={{ fontSize: 12 }}
                onClick={() => setRename({ id: a.id, value: a.name })}>✎</button>
            )}
          </div>
          {logged && info?.name && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{info.name}</div>}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          画像
          <select value={a.persona} disabled={personaBusy === a.id}
            title="绑定画像：发布到该账号时按画像定位；未绑定走通用模式"
            onChange={(e) => void setPersona(a, e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, background: 'var(--surface)', color: 'var(--text)', maxWidth: 170 }}>
            <option value="">未绑定（通用模式）</option>
            {personas.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {logged ? (
            <button className="btn btn-sm" disabled={w === 'loading' || busy === a.id}
              onClick={() => runWhoami(a)}>
              {w === 'loading' ? '校验中…' : '校验账号'}
            </button>
          ) : a.direct ? (
            <button className="btn btn-sm btn-primary"
              onClick={() => { setQr(null); setDirect({ account: a, message: '请在打开的窗口中登录，完成后点「校验登录态」', checking: false, verdict: '' }); setLoginTarget(a); }}>
              校验登录态
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" disabled={busy === a.id || busy === a.id + ':mp'}
              onClick={() => (isWechat ? openCred(a) : openLogin(a))}>
              {(busy === a.id || busy === a.id + ':mp') ? '启动中…' : '登录'}
            </button>
          )}
          {isWechat && (
            <button className="btn btn-sm" disabled={busy === a.id + ':mp'}
              title="登录公众号后台（数据中心取数用，独立于 AppID 凭证）"
              onClick={() => void handleMpLogin(a)}>
              {busy === a.id + ':mp' ? '启动中…' : '登录后台'}
            </button>
          )}
          <button className="btn btn-sm btn-ghost" disabled={logoutBusy === a.id}
            onClick={() => void handleLogout(a)}>
            {logoutBusy === a.id ? '退出中…' : '退出登录'}
          </button>
          <button className="btn btn-sm btn-danger" disabled={delBusy === a.id}
            title="删除账号条目并清除该账号登录态"
            onClick={() => void handleDelete(a)}>
            {delBusy === a.id ? '删除中…' : '删除'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="accounts-page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title">账号管理 Accounts</h1>
          <p className="page-subtitle">
            同一平台可添加多个账号，各自独立登录态、可绑定不同画像，发布时按账号分发。<br />
            ⚠️ 平台可能对机房/代理 IP 判风险：推荐「打开浏览器窗口」人工登录，干净/家宽 IP 更稳。
          </p>
        </div>
        <button className="btn btn-sm" onClick={load}>⟳ 刷新</button>
      </div>

      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{err}</div>}

      {groups.map(([platform, rows]) => {
        const meta = PLATFORM_META.find((p) => p.key === platform);
        const label = meta?.label ?? platform;
        return (
          <div key={platform} className="card" style={{ marginTop: 14, padding: 14 }}>
            <div className="account-card-head">
              <span className="account-card-name">{label}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {rows.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rows.length} 个账号</span>}
                {platform === 'wechat-oa' ? (
                  rows.length === 0 && (
                    <button className="btn btn-sm" onClick={() => openCred(WECHAT_PLACEHOLDER)}>配置公众号凭证</button>
                  )
                ) : (
                  <button className="btn btn-sm"
                    onClick={() => { setAddTarget({ platform, label }); setAddName(''); setAddErr(''); }}>
                    ＋ 添加账号
                  </button>
                )}
              </div>
            </div>
            {rows.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '10px 0 2px' }}>
                {platform === 'wechat-oa'
                  ? '公众号暂只支持一个账号：填 AppID/AppSecret 凭证后自动建档。'
                  : '还没有账号：点右上角「添加账号」，登录后自动出现在这里。'}
              </div>
            ) : (
              rows.map(renderRow)
            )}
          </div>
        );
      })}

      <DeconstructSources />

      {loginTarget && (
        <div className="overlay" onClick={closeLogin}>
          <div className="modal" style={{ width: 380, maxWidth: '100%', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}>
            {!qr && !direct && (
              <>
                <h3 style={{ margin: '0 0 4px' }}>登录「{loginTarget.name}」</h3>
                {loginTarget.backend === 'wechat-oa' ? (
                  <>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
                      公众号发布走 AppID 凭证；数据中心取数走后台扫码。
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setLoginTarget(null); openCred(loginTarget); }}>
                        配置凭证
                      </button>
                      <button className="btn" style={{ flex: 1 }} disabled={busy === loginTarget.id + ':mp'}
                        onClick={() => void handleMpLogin(loginTarget)}>
                        登录后台
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      {loginTarget.backend !== 'biliup' && (
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy === loginTarget.id}
                          onClick={() => void handleLogin(loginTarget, 'direct')}>
                          {busy === loginTarget.id ? '启动中…' : '🪟 打开浏览器窗口（推荐）'}
                        </button>
                      )}
                      <button className={`btn ${loginTarget.backend === 'biliup' ? 'btn-primary' : ''}`} style={{ flex: 1 }}
                        disabled={busy === loginTarget.id}
                        onClick={() => void handleLogin(loginTarget, 'qr')}>
                        扫码登录
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.7, textAlign: 'left' }}>
                      {loginTarget.backend === 'biliup'
                        ? 'B站走 TV 端扫码：出二维码后用手机 B站 App 扫码确认。'
                        : '推荐「打开浏览器窗口」：真实浏览器里人工登录，风控最稳；扫码为无头浏览器出二维码，受平台风控影响较大。'}
                    </div>
                  </>
                )}
                {loginErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 10 }}>{loginErr}</div>}
              </>
            )}

            {qr && (
              <>
                <h3 style={{ margin: '0 0 4px' }}>登录 {qr.title || qr.account.name}</h3>
                <div style={{ fontSize: 13, marginBottom: 14,
                  color: qr.state === 'success' ? 'var(--green)'
                    : ['error', 'expired'].includes(qr.state) ? 'var(--red)' : 'var(--text-secondary)' }}>
                  {STATE_LABEL[qr.state] || qr.state}{qr.message ? ` — ${qr.message}` : ''}
                </div>
                {qr.state === 'sms_required' ? (
                  <div style={{ padding: '6px 4px 2px' }}>
                    <div style={{ fontSize: 13, marginBottom: 10,
                      color: /错误|过期|失败|重新|未找到|未完成|不正确|失效/.test(qr.message || '')
                        ? 'var(--red)' : 'var(--text-secondary)' }}>
                      {qr.message || '平台风控要求短信验证，验证码已发到你手机，请输入：'}
                    </div>
                    <input
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      onKeyDown={(e) => { if (e.key === 'Enter') void submitSms(); }}
                      placeholder="短信验证码" inputMode="numeric" autoFocus
                      style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center',
                        letterSpacing: 6, fontSize: 20, padding: '10px 12px',
                        border: '1px solid var(--border)', borderRadius: 8 }} />
                    {smsErr && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{smsErr}</div>}
                    <button className="btn btn-primary btn-block" style={{ marginTop: 12 }}
                      disabled={smsBusy} onClick={() => void submitSms()}>
                      {smsBusy ? '提交中…' : '提交验证码'}
                    </button>
                  </div>
                ) : qr.state === 'qr_ready' && qr.qr ? (
                  <img className="qr-img" src={`${mediaUrl(qr.qr)}?v=${qr.qrTs || qrNonce}`} alt="登录二维码" />
                ) : qr.state === 'scanned' ? (
                  <div className="loading" style={{ padding: 40 }}><div className="spinner" />扫码成功，正在跳转验证…（首次可能等十几秒）</div>
                ) : qr.state === 'verifying' ? (
                  <div className="loading" style={{ padding: 40 }}><div className="spinner" />正在验证验证码，登录中…</div>
                ) : qr.state === 'success' ? (
                  <div style={{ fontSize: 48, padding: 40 }}>✅</div>
                ) : ['error', 'expired'].includes(qr.state) ? (
                  <div style={{ fontSize: 13, color: 'var(--red)', padding: 30 }}>
                    {qr.message || '登录失败'}<br />可关闭后重试（或换干净 IP）。
                  </div>
                ) : (
                  <div className="loading" style={{ padding: 40 }}><div className="spinner" />准备二维码…</div>
                )}
              </>
            )}

            {direct && (
              <>
                <h3 style={{ margin: '0 0 4px' }}>登录 {direct.account.name}</h3>
                <div style={{ fontSize: 30, margin: '10px 0 6px' }}>🪟</div>
                <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.7,
                  color: direct.verdict === 'ok' ? 'var(--green)' : direct.verdict === 'no' ? 'var(--red)' : 'var(--text-secondary)' }}>
                  {direct.verdict === 'ok'
                    ? '✅ 已检测到登录态'
                    : direct.verdict === 'no'
                      ? '还没有检测到登录态：请在窗口里完成登录后，再点一次「校验登录态」。'
                      : direct.message || '请在打开的窗口中登录，完成后点「校验登录态」。'}
                </div>
                {direct.verdict !== 'ok' && (
                  <button className="btn btn-primary btn-block" style={{ marginTop: 10 }}
                    disabled={direct.checking}
                    onClick={() => verifyDirect(direct.account)}>
                    {direct.checking ? '校验中…（起浏览器实测，约几秒）' : '校验登录态'}
                  </button>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.7, textAlign: 'left' }}>
                  窗口可以一直开着：发布时会自动附身这个窗口，你可随时插手验证码/短信。登录态保存在本地，关掉窗口也不丢。
                </div>
              </>
            )}

            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={closeLogin}>
                {(qr?.state === 'success' || direct?.verdict === 'ok') ? '完成' : '关闭'}
              </button>
            </div>
          </div>
        </div>
      )}

      {addTarget && (
        <div className="overlay" onClick={() => { setAddTarget(null); setAddErr(''); }}>
          <div className="modal" style={{ width: 360, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>添加{addTarget.label}账号</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              起个好认的名字（如「主号」「小号 A」）。每个账号有独立登录态，可绑定不同画像。
            </div>
            <input className="field" value={addName} autoFocus placeholder="账号名字"
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submitAdd(); }} />
            {addErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{addErr}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => { setAddTarget(null); setAddErr(''); }}>取消</button>
              <button className="btn btn-sm btn-primary" disabled={addBusy || !addName.trim()}
                onClick={() => void submitAdd()}>
                {addBusy ? '创建中…' : '创建并登录'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cred && (
        <div className="overlay" onClick={closeCred}>
          <div className="modal" style={{ width: 420, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>配置 {cred.name}</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
              公众号用官方接口发布，需填开发者凭证（公众平台 → 设置与开发 → 开发接口管理）。<br />
              ⚠️ 需把本服务器出口 IP 加入公众号「IP 白名单」，否则报 40164。文章发到<b>草稿箱</b>，群发请到 mp 后台确认。
            </div>
            {credMsg && <div style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 10 }}>{credMsg}</div>}
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AppID</label>
            <input value={credForm.appId} autoFocus
              onChange={(e) => setCredForm((f) => ({ ...f, appId: e.target.value.trim() }))}
              placeholder="wx..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                margin: '4px 0 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AppSecret</label>
            <input value={credForm.appSecret} type="password"
              onChange={(e) => setCredForm((f) => ({ ...f, appSecret: e.target.value.trim() }))}
              placeholder="开发者密钥（不会回显）" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                margin: '4px 0 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>默认作者（可选）</label>
            <input value={credForm.author}
              onChange={(e) => setCredForm((f) => ({ ...f, author: e.target.value }))}
              placeholder="文章署名" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                margin: '4px 0 4px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
            {credErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{credErr}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={credBusy} onClick={() => void submitCred()}>
                {credBusy ? '验证中…' : '保存并验证'}
              </button>
              <button className="btn" onClick={closeCred}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
