// Client half of project archives: one service owns the native picker call,
// job polling, workspace registration, and the shared progress toast. Both the
// data-location settings card and the workspace sidebar import button consume
// this instance, so a job keeps reporting after its initiating surface closes.
import {
  ArchiveRequestError, fetchArchiveJob, fetchArchiveProjects, fetchStatus, startArchiveExport, startArchiveImport,
  type ArchiveJob, type ArchiveProjectSummary,
} from './api'
import { archivePathKey, fillArchiveText, formatArchiveBytes, isProjectDirectory } from './archive-text'
import { showToast, type ToastHandle } from './ui-toast'

export { fillArchiveText as fill, formatArchiveBytes as formatBytes } from './archive-text'

/** One immutable service snapshot for subscriber components. */
export interface ArchiveSnapshot {
  /** Undefined until the first project list answers. */
  supported: boolean | undefined
  projects: ArchiveProjectSummary[]
  projectsReady: boolean
  /** A native picker is open; no job exists yet. */
  picking: boolean
  job: ArchiveJob | null
  /** Host project root, used to classify workspace rows without a list refresh. */
  projectRoot?: string
}

/** Shared project-archive client surface. */
export interface ProjectArchiveService {
  /** Locale-bound archive copy. */
  readonly t: (key: string) => string
  /** Current snapshot; the object changes on every publish. */
  snapshot: () => ArchiveSnapshot
  /** Subscribe to snapshot changes. */
  subscribe: (listener: () => void) => () => void
  /** Fetch the project list and refresh the supported flag. */
  loadProjects: () => Promise<ArchiveProjectSummary[]>
  /** Whether this deployment enables project archives. */
  supported: () => boolean
  /** Native picker, import job, workspace registration. */
  startImport: () => Promise<void>
  /** Native save dialog and export job for one project path. */
  startExport: (path: string, name: string) => Promise<void>
  /** Whether this path is a direct child of projects/ and therefore exportable. */
  isProject: (path: string) => boolean
  /** Whether an import or export is running. */
  busy: () => boolean
  /** Stop polling and dismiss the toast. */
  dispose: () => void
}

const POLL_INTERVAL_MS = 600
const POLL_FAILURE_LIMIT = 3
const KNOWN_ERROR_CODES = new Set([
  'unsupported', 'picker-unavailable', 'busy', 'not-a-project', 'destination-inside-source',
  'invalid-archive', 'unsafe-path', 'path-conflict', 'too-many-entries', 'manifest-version',
  'no-files', 'file-too-large', 'file-changed', 'disk-space', 'archive-engine-unavailable', 'io',
  'bad-destination', 'bad-name', 'name-conflict',
])

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function browserLocale(): 'zh' | 'en' {
  const language = typeof navigator === 'undefined' ? 'zh' : navigator.language
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/**
 * Build the shared archive client service.
 * @param ctx - client plugin context; `ctx.workspaces.create` registers imports.
 * @param t - locale-bound archive copy.
 * @returns the service instance.
 */
export function createProjectArchiveService(ctx: any, t: (key: string) => string): ProjectArchiveService {
  let state: ArchiveSnapshot = { supported: undefined, projects: [], projectsReady: false, picking: false, job: null }
  const listeners = new Set<() => void>()
  let toast: ToastHandle | null = null
  let disposed = false

  const publish = (patch: Partial<ArchiveSnapshot>): void => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  const currentLocale = (): 'zh' | 'en' => {
    const active = ctx.locale?.getSnapshot?.().active
    return active === 'zh' || active === 'en' ? active : browserLocale()
  }
  const setToast = (next: Parameters<typeof showToast>[0]): void => {
    if (toast === null) toast = showToast({ closeLabel: t('close'), ...next })
    else toast.update(next)
  }
  const closeToast = (): void => {
    toast?.dismiss()
    toast = null
  }
  const toastError = (code: string | undefined, detail: string): void => {
    const known = code !== undefined && KNOWN_ERROR_CODES.has(code)
    setToast({
      kind: 'error',
      message: known ? t(`error.${code}`) : `${t('error.generic')}：${detail}`,
      detail,
      progress: undefined,
      dismissible: true,
      duration: 8000,
    })
  }

  const loadProjects = async (): Promise<ArchiveProjectSummary[]> => {
    const list = await fetchArchiveProjects()
    publish({ supported: list.supported, projects: list.projects, projectsReady: true })
    return list.projects
  }

  const toastProgress = (job: ArchiveJob): void => {
    const name = job.name ?? ''
    if (job.kind === 'import') {
      const detail = job.files !== undefined && job.files > 0
        ? fillArchiveText(t('progressImport'), { files: job.files, size: formatArchiveBytes(job.bytes ?? 0) })
        : undefined
      setToast({ kind: 'info', message: fillArchiveText(t('importing'), { name }), detail, duration: 0 })
      return
    }
    const total = job.totalBytes ?? 0
    const progress = total > 0 ? Math.min(1, (job.bytes ?? 0) / total) : undefined
    const detail = progress === undefined
      ? undefined
      : fillArchiveText(t('progressExport'), { percent: Math.round(progress * 100), size: formatArchiveBytes(job.bytes ?? 0) })
    setToast({ kind: 'info', message: fillArchiveText(t('exporting'), { name }), detail, progress, duration: 0 })
  }

  const finishImport = async (job: ArchiveJob): Promise<void> => {
    const result = job.result
    if (result?.path === undefined || result.name === undefined) {
      toastError('io', t('error.generic'))
      return
    }
    let registered = true
    try {
      const created = await ctx.workspaces.create({ path: result.path })
      if (!created.ok) throw new Error(created.error?.message ?? 'workspace create failed')
    } catch (error) {
      registered = false
      setToast({
        kind: 'warn',
        message: fillArchiveText(t('workspaceFailed'), { message: error instanceof Error ? error.message : String(error) }),
        detail: undefined,
        progress: undefined,
        dismissible: true,
        duration: 8000,
      })
    }
    if (registered) {
      setToast({
        kind: 'ok',
        message: result.renamed === true
          ? fillArchiveText(t('importedRenamed'), { name: result.name })
          : fillArchiveText(t('imported'), { name: result.name }),
        detail: undefined,
        progress: undefined,
        duration: 4000,
      })
    }
    await loadProjects().catch(() => {})
  }

  const finishExport = (job: ArchiveJob): void => {
    const result = job.result
    const target = result?.path ?? job.destination ?? ''
    const links = result?.skippedLinks ?? 0
    const unreadable = result?.skippedUnreadable ?? 0
    const junk = result?.skippedJunk ?? 0
    const skipped = links + unreadable + junk
    setToast({
      kind: skipped > 0 ? 'warn' : 'ok',
      message: skipped > 0
        ? fillArchiveText(t('exportedSkipped'), { path: target, links, unreadable, junk })
        : fillArchiveText(t('exported'), { path: target }),
      detail: undefined,
      progress: undefined,
      duration: 6000,
    })
  }

  const poll = async (jobId: string): Promise<void> => {
    let failures = 0
    while (!disposed) {
      await delay(POLL_INTERVAL_MS)
      if (disposed) return
      let job: ArchiveJob
      try {
        job = await fetchArchiveJob()
      } catch (error) {
        failures += 1
        if (failures >= POLL_FAILURE_LIMIT) {
          closeToast()
          publish({ job: null })
          toastError(error instanceof ArchiveRequestError ? error.code : undefined,
            error instanceof Error ? error.message : String(error))
          return
        }
        continue
      }
      failures = 0
      if (job.state === 'idle' || (job.jobId !== undefined && job.jobId !== jobId)) {
        publish({ job: null })
        closeToast()
        return
      }
      publish({ job })
      if (job.state === 'running') {
        toastProgress(job)
        continue
      }
      if (job.state === 'failed') {
        toastError(job.error?.code, job.error?.detail ?? t('error.generic'))
        return
      }
      if (job.kind === 'import') await finishImport(job)
      else finishExport(job)
      return
    }
  }

  const startJob = async (kind: 'import' | 'export', name: string, start: () => Promise<{
    cancelled?: true
    jobId?: string
    sourceName?: string
    destination?: string
  }>): Promise<void> => {
    if (disposed) return
    if (state.picking || state.job?.state === 'running') return
    publish({ picking: true })
    setToast({
      kind: 'info',
      message: kind === 'import' ? t('pickingImport') : t('pickingExport'),
      duration: 0,
    })
    try {
      const started = await start()
      if (disposed) {
        publish({ picking: false })
        closeToast()
        return
      }
      if (started.cancelled === true) {
        publish({ picking: false })
        closeToast()
        return
      }
      if (started.jobId === undefined) throw new Error(t('error.generic'))
      const initial: ArchiveJob = {
        jobId: started.jobId,
        kind,
        state: 'running',
        phase: kind === 'import' ? 'extracting' : 'scanning',
        name: started.sourceName ?? name,
        files: 0,
        bytes: 0,
        ...(started.destination === undefined ? {} : { destination: started.destination }),
      }
      publish({ picking: false, job: initial })
      toastProgress(initial)
      await poll(started.jobId)
    } catch (error) {
      closeToast()
      publish({ picking: false, job: null })
      toastError(error instanceof ArchiveRequestError ? error.code : undefined,
        error instanceof Error ? error.message : String(error))
    }
  }

  const service: ProjectArchiveService = {
    t,
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    loadProjects,
    supported: () => state.supported === true,
    startImport: () => startJob('import', '', () => startArchiveImport(currentLocale())),
    startExport: (path, name) => startJob('export', name, () => startArchiveExport(path, currentLocale())),
    isProject(path) {
      if (state.supported !== true) return false
      if (state.projectRoot !== undefined) return isProjectDirectory(state.projectRoot, path)
      const key = archivePathKey(path)
      return state.projects.some(project => archivePathKey(project.path) === key)
    },
    busy: () => state.picking || state.job?.state === 'running',
    dispose() {
      disposed = true
      closeToast()
      listeners.clear()
    },
  }

  // Capability prefetch: the sidebar button and the right-click export item
  // read the cached answer synchronously.
  void loadProjects().catch(() => {
    publish({ projectsReady: true })
  })
  // The project root classifies a workspace row immediately, before the
  // projects list refreshes for a project created in this session.
  void fetchStatus().then((status) => {
    if (status?.projectRoot !== undefined) publish({ projectRoot: status.projectRoot })
  }).catch(() => {})

  return service
}
