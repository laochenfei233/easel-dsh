// Core bridge of the Easel client half.
//
// Everything that is not a single view lives here: the shared shell store
// (persona, personas, gateway state), navigation, the topic hand-off into a
// dsh conversation, and the task/workspace adapters. Feature views are mounted
// as child plugins (src/features/*) and read this bridge through the
// `easelShell` service — the views own their own slot registrations, so one
// failing or disabled view cannot take the workbench down.
import { useSyncExternalStore } from 'react'
import {
  configureTasks, findWorkspaceByPath, getWorkspaceService, projectRoot, resolveHomeWorkspaceId,
} from './task'

/** Everything the shell can hand a ported page; each page destructures its own. */
export interface PageProps {
  persona: string
  /** All account personas (/api/personas), for the 画像 browser. */
  personas: { name: string; description: string }[]
  /** Switch the shell persona; other ported pages follow on their next mount. */
  onPersonaChange: (name: string) => void
  gatewayStatus: string
  apiDirect: boolean
  onNavigate: (page: string) => void
  onUseTopic: (title: string) => void
  jumpPath: string
  onJumpHandled: () => void
  onDeleted: () => void
  /**
   * Host remote plane (dsh client inject `remote`): pages read session-scoped
   * services off it — BreakdownPage reads `remote.session.modelCatalog` for the
   * model-management dropdowns. Absent when the host plane is unavailable.
   */
  remote?: unknown
  /** Re-read the shell facts (/easel/api/status): personas may have been
   *  created or renamed by agent sessions since the plugin booted. */
  onRefresh?: () => void
}

/** The `main` slot key for a view (also the rail entry id). */
export function pageKey(view: string): string {
  return `easel.${view}`
}

/** Easel's topic prompt, verbatim from the App component this port replaces. */
export function topicPrompt(title: string, projectDir?: string, inProject = false): string {
  const base = `围绕当前热点「${title}」：先判断它适不适合我的账号赛道；若合适，给 2-3 个差异化的二创角度，并把你最推荐的那条写成可直接发布的文案初稿。`
  // EASEL-DIVERGENCE(easel-project-materials/easel-deconstruct-title-attach): 已立项
  // 选题注入项目目录落点。inProject = 会话 cwd 已是项目目录（create({workspaceId})），
  // 路径用目录内语义；否则 cwd=项目根，带前缀。
  if (!projectDir) return base
  return inProject
    ? `${base}\n\n本项目已立项：先读 项目资料.md（就在当前目录，选题卡、拆解素材、画像快照都在里面，按需参考），本次创作的脚本/文案/成片等产物一律写入当前目录（项目工作区）。`
    : `${base}\n\n本项目已立项：先读 ${projectDir}/项目资料.md（选题卡、拆解素材、画像快照都在里面，按需参考），本次创作的脚本/文案/成片等产物一律写入 ${projectDir}/ 目录。`
}

interface StatusPayload {
  personas: { name: string; description?: string }[]
  gateway: boolean
  transport?: string
}

interface ShellState {
  persona: string
  personas: { name: string; description: string }[]
  gatewayStatus: string
  apiDirect: boolean
}

/**
 * One shared store for the shell facts every ported page reads.
 * Created per plugin materialization, so an invalidation starts clean.
 */
export function createShell() {
  let state: ShellState = { persona: '', personas: [], gatewayStatus: 'connecting', apiDirect: false }
  const readers = new Set<() => void>()
  const notify = () => readers.forEach((r) => r())
  const refresh = () => {
    fetch('/easel/api/status', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<StatusPayload>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        const personas = data.personas ?? []
        // Keep a selection that still exists; default to the first persona.
        const persona = personas.some((p) => p.name === state.persona)
          ? state.persona
          : (personas[0]?.name ?? '')
        state = {
          persona,
          personas,
          gatewayStatus: data.gateway ? 'connected' : 'disconnected',
          apiDirect: data.transport === 'api',
        }
        notify()
      })
      .catch(() => {
        state = { ...state, gatewayStatus: 'disconnected' }
        notify()
      })
  }
  return {
    refresh,
    setPersona: (persona: string) => {
      state = { ...state, persona }
      notify()
    },
    subscribe: (notifyFn: () => void) => {
      readers.add(notifyFn)
      return () => { readers.delete(notifyFn) }
    },
    snapshot: (): ShellState => state,
  }
}

/** What the core plugin publishes as `easelShell` for feature plugins. */
export interface EaselShell {
  /** Hook producing the shared page props; one instance per mounted view. */
  useShellProps: () => PageProps
  /** Select a dsh main panel (`chat` maps to the conversation). */
  navigate: (page: string) => void
  /** Hand a topic to a fresh dsh conversation. */
  useTopic: (title: string, projectDir?: string) => void
  /** Rail label lookup, bound to the `easel.panel` dictionaries. */
  t: (view: string) => string
  /** Re-read /easel/api/status. */
  refresh: () => void
  /** Store setter for the selected persona. */
  setPersona: (name: string) => void
}

/**
 * Build the bridge and the long-lived adapters the feature views rely on.
 * @param ctx - the core client context (sessions/uiWorkspace/layout services).
 * @param t - rail label lookup bound to this plugin's dictionaries.
 */
export function createShellBridge(ctx: any, t: (view: string) => string): EaselShell {
  const shell = createShell()
  shell.refresh()

  const navigate = (page: string) => {
    const layout = ctx.get('layout')
    if (layout === undefined) throw new Error('dsh-plugin-easel: the layout service is absent; cannot navigate')
    layout.selectPanel(page === 'chat' ? 'conversation' : pageKey(page))
  }

  /**
   * Hand a topic to dsh's conversation for real: create a session, open it
   * (selection + conversation panel), and send the prompt as the user — the
   * agent turn starts immediately. Falls back to the clipboard when the
   * session plane is unavailable.
   */
  const useTopic = (title: string, projectDir?: string) => {
    const fallbackPrompt = topicPrompt(title, projectDir)
    const clipboardFallback = () => {
      void navigator.clipboard?.writeText(fallbackPrompt).catch(() => {})
      navigate('chat')
    }
    try {
      const sessions = ctx.get('sessions')
      const uiWorkspace = ctx.get('uiWorkspace')
      if (sessions === undefined || uiWorkspace === undefined) throw new Error('session services absent')
      void (async () => {
        // EASEL-DIVERGENCE(easel-deconstruct-title-attach D2): 归组正道 =
        // create({workspaceId})。已立项选题生在项目工作区（cwd=项目目录，
        // prompt 用目录内语义——仅当项目工作区真的命中；缺失时落主项目，
        // prompt 退回带前缀措辞）；否则主项目（cwd=项目根）。
        const project = projectDir ? findWorkspaceByPath(projectDir) : null
        const homeId = project?.workspaceId ?? await resolveHomeWorkspaceId()
        const prompt = topicPrompt(title, projectDir, project !== null)
        const id = homeId ? await sessions.create({ workspaceId: homeId }) : await sessions.create()
        uiWorkspace.openSession(id)
        await sessions.using(id, { source: 'easelTopic' }, async () => {
          const scoped = sessions.scope(id)
          const conversation = scoped?.get('conversation')
          if (conversation === undefined) throw new Error('conversation face unavailable in the session scope')
          await conversation.send(prompt)
        })
      })().catch(clipboardFallback)
    } catch {
      clipboardFallback()
    }
  }

  /**
   * One-shot agent tasks (拆解/技能执行/文案适配/预检) run as dsh conversation
   * turns; the client needs the project root as the session cwd so the agent's
   * file tools can write results back into the repo.
   */
  // EASEL-DIVERGENCE(easel-single-workspace D1): 模式落 localStorage，键与
  // dsh ui-workspace 的 easel-mode.ts 约定一致（globalThis 共享）。
  const storedMode = localStorage.getItem('easel.workspace.mode')
  ;(globalThis as { __easelWorkspaceUIMode?: string }).__easelWorkspaceUIMode =
    storedMode === 'full' ? 'full' : 'single'
  configureTasks({
    getServices: () => {
      const sessions = ctx.get('sessions')
      const uiWorkspace = ctx.get('uiWorkspace')
      // EASEL-DIVERGENCE(easel-single-workspace D1/D3): 选题立项要建工作区。
      const workspaces = (ctx as { get(name: string): unknown }).get('workspaces') as
        | { create(input: { path: string }): Promise<unknown> }
        | undefined
      return sessions !== undefined && uiWorkspace !== undefined
        ? { sessions, uiWorkspace, workspaces: workspaces ?? undefined }
        : null
    },
    cwd: () => fetch('/easel/api/status', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<{ projectRoot?: string }>) : null))
      .then((data) => data?.projectRoot ?? '')
      .catch(() => ''),
  })

  /**
   * EASEL-DIVERGENCE(easel-deconstruct-title-attach D2): 主项目 = 路径钉在
   * 项目根的工作区——归组的前提（cwd 必须等于工作区路径，create({workspaceId})
   * 才既给 cwd 又给成员）。启动后没有就建一个；标题落文件夹名，重名/服务
   * 未就绪等失败静默重试（至多三轮）。已存在则不动。
   */
  const ensureHomeWorkspace = async () => {
    const root = await projectRoot()
    if (!root) return false
    if (findWorkspaceByPath(root)) return true
    await getWorkspaceService()?.create({ path: root }).catch(() => {})
    return true
  }
  const ensureHomeAttempt = (attempt: number) => {
    void ensureHomeWorkspace().then((resolved) => {
      if (!resolved && attempt < 2) setTimeout(() => ensureHomeAttempt(attempt + 1), 8_000)
    })
  }
  setTimeout(() => ensureHomeAttempt(0), 2_000)

  /** The shared page props; one hook instance per mounted slot component. */
  const useShellProps = (): PageProps => {
    const snap = useSyncExternalStore(shell.subscribe, shell.snapshot)
    return {
      persona: snap.persona,
      personas: snap.personas,
      onPersonaChange: shell.setPersona,
      gatewayStatus: snap.gatewayStatus,
      apiDirect: snap.apiDirect,
      onNavigate: navigate,
      onUseTopic: useTopic,
      jumpPath: '',
      onJumpHandled: () => {},
      onDeleted: () => shell.refresh(),
      onRefresh: shell.refresh,
      remote: ctx.remote,
    }
  }

  return { useShellProps, navigate, useTopic, t, refresh: shell.refresh, setPersona: shell.setPersona }
}
