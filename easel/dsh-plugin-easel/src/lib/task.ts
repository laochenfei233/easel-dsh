// One-shot agent tasks pushed into dsh conversations（方案 B，spec easel-dsh-runtime §S2.2 B3）。
//
// `conversation.send()` 只在「入队受理」时 resolve，不代表回合完成——完成信号是
// session 快照上的 `running` true→false 边沿（ISessions 文档面，retain 后订阅
// reference.binding.session）。页面需要拿回结果时，由 agent 按提示词把产物写进
// `outputs/_adapt/**`（下划线开头不进内容库），页面在回合静默后经 B1 的
// output-content 路由读回。
//
// 会话以 cwd=项目根创建（sessions.create({cwd})），因此 agent 的文件工具能直接
// 读写 profiles/outputs/skills。任务离开页面后继续在会话里跑（dsh 原生
// 「断线不杀」），审批/提问卡片在对话面板里处理——这正是把执行交给 dsh 的意义。

type SessionService = any;
type Snapshot = { running?: boolean; promptError?: unknown; lastAgentError?: unknown };

let getServices: (() => {
  sessions: SessionService
  uiWorkspace: SessionService
  workspaces?: WorkspaceService
} | null) | null = null;

type WorkspaceListItem = {
  workspaceId: string; path: string; title: string; sessionIds: readonly string[];
};
type WorkspaceService = {
  create(input: { path: string }): Promise<{ workspace: { id: string; title: string } }>;
  list?: { getSnapshot(): { items: WorkspaceListItem[]; archivedSessionIds?: readonly string[] } };
};
let cwdResolver: (() => Promise<string>) | null = null;

/** Wire the task channel once from apply(): service accessors + the session cwd. */
export function configureTasks(cfg: {
  getServices: () => { sessions: SessionService; uiWorkspace: SessionService } | null;
  cwd: () => Promise<string>;
}): void {
  getServices = cfg.getServices;
  cwdResolver = cfg.cwd;
}

export interface PushHandle {
  sessionId: string;
  /** 'done' = 回合已静默；'error' = 入队被拒/启动失败；'aborted' = 调用方中止。 */
  settled: Promise<'done' | 'error' | 'aborted'>;
  /** 停止回合（conversation.cancel）。已结束的会话上调用是安全的空操作。 */
  abort(): void;
}

/**
 * Create a session (cwd = project root), optionally open it in the workspace,
 * subscribe to the running edge, then send the prompt as the user.
 * The reference is released on settlement; the session itself stays open in dsh.
 */
export async function pushTask(
  prompt: string,
  opts: {
    open?: boolean
    signal?: AbortSignal
    /** 会话级模型选择（拆解页选视觉模型）；会话服务不支持时静默跳过。 */
    model?: { provider?: string; model?: string }
  } = {},
): Promise<PushHandle> {
  if (getServices === null || cwdResolver === null) throw new Error('task channel not configured');
  const services = getServices();
  if (services === null) throw new Error('session services absent');
  const { sessions, uiWorkspace } = services;
  const cwd = await cwdResolver();
  // EASEL-DIVERGENCE(easel-deconstruct-title-attach D2): 有路径=项目根的工作区时
  // 走 create({workspaceId})——cwd 仍是项目根（工作区路径即项目根）且真归组；
  // 没有就回退纯 cwd 创建（未分组但功能无损）。
  const home = cwd ? findWorkspaceByPath(cwd) : null;
  const id: string = home
    ? await sessions.create({ workspaceId: home.workspaceId })
    : await sessions.create(cwd ? { cwd } : undefined);
  if (opts.open !== false) uiWorkspace.openSession(id);

  // EASEL-DIVERGENCE(easel-breakdown-fullpage): 页面选定的分析模型落在会话上
  // （dsh 的 sessions.selectModel 远端）；不可达时保持会话默认模型。
  const selectModel = (sessions as { selectModel?: (req: unknown) => Promise<unknown> }).selectModel
  if (opts.model !== undefined && typeof selectModel === 'function') {
    await selectModel.call(sessions, {
      sessionId: id,
      provider: opts.model.provider,
      model: opts.model.model,
    }).catch(() => {})
  }

  const reference = sessions.retain(id, { source: 'easelTask' });
  await reference.ready;
  const conversation = sessions.scope(id)?.get('conversation');
  if (conversation === undefined) {
    reference.release();
    throw new Error('conversation face unavailable in the session scope');
  }

  let conclude: (verdict: 'done' | 'error' | 'aborted') => void = () => {};
  const settled = new Promise<'done' | 'error' | 'aborted'>((resolve) => {
    let closed = false;
    let unsubscribe: () => void = () => {};
    const onAbort = () => conclude('aborted');
    conclude = (verdict) => {
      if (closed) return;
      closed = true;
      unsubscribe();
      opts.signal?.removeEventListener('abort', onAbort);
      // openSession 已持有 mainView 引用，这里释放任务引用不会拆掉会话。
      reference.release();
      resolve(verdict);
    };
    const session = reference.binding.session as {
      getSnapshot(): Snapshot;
      subscribe(listener: () => void): () => void;
    };
    let sawRunning = session.getSnapshot().running === true;
    unsubscribe = session.subscribe(() => {
      const snap = session.getSnapshot() ?? {};
      if (snap.running === true) { sawRunning = true; return; }
      if (sawRunning) return conclude('done');
      // 还没见到运行就静默：可能尚未启动（继续等），也可能已经失败。
      if (snap.promptError != null || snap.lastAgentError != null) return conclude('error');
    });
    opts.signal?.addEventListener('abort', onAbort, { once: true });
  });

  try {
    await conversation.send(prompt);
  } catch (error) {
    conclude('error');
    throw error;
  }
  return {
    sessionId: id,
    settled,
    abort() {
      try {
        const cancelling = conversation.cancel();
        if (cancelling && typeof cancelling.catch === 'function') cancelling.catch(() => {});
      } catch { /* 回合已结束 */ }
    },
  };
}

/** 拆解页/选题页共用的 workspace 服务访问器（configureTasks 时注入）。 */
export function getWorkspaceService(): WorkspaceService | null {
  return getServices?.()?.workspaces ?? null;
}

/** 项目根（configureTasks 注入的 cwd 解析器）。 */
export function projectRoot(): Promise<string> {
  return cwdResolver ? cwdResolver() : Promise.resolve('');
}

/**
 * 按路径找工作区：支持项目根绝对路径或 `projects/<safe>` 相对尾段。
 * 分隔符与大小写归一（Windows canonical 路径大小写不保证）。
 */
export function findWorkspaceByPath(pathOrRel: string): WorkspaceListItem | null {
  const items = getWorkspaceService()?.list?.getSnapshot().items ?? [];
  if (items.length === 0) return null;
  const want = pathOrRel.replace(/\/+$/, '').replaceAll('\\', '/').toLowerCase();
  const match = items.find((view) => {
    const p = view.path.replaceAll('\\', '/').toLowerCase();
    return p === want || p.endsWith(`/${want}`);
  });
  return match ?? null;
}

/**
 * 新会话的落点（spec easel-deconstruct-title-attach D2）：dsh 里归组的唯一正道是
 * `sessions.create({workspaceId})`（cwd=工作区路径 + 成员授予；insertSessionBefore
 * 只能重排已有成员）。已立项选题 → 项目工作区（cwd=项目目录，资料都在手边）；
 * 其余 → 路径钉在项目根的主项目（cwd 仍是项目根，文件协议不破）。返回 null =
 * 工作区尚未就绪，调用方回退纯 create（现状行为，未分组但功能无损）。
 */
export async function resolveHomeWorkspaceId(projectDir?: string): Promise<string | null> {
  if (projectDir) {
    const project = findWorkspaceByPath(projectDir);
    if (project) return project.workspaceId;
  }
  const root = await projectRoot();
  return root ? findWorkspaceByPath(root)?.workspaceId ?? null : null;
}
