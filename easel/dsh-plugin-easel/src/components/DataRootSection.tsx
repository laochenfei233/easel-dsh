// Settings section: where the data root lives, which projects it holds, and
// how to move it.
//
// This is a desktop-only surface. The host half exposes the current/default
// root, the projects directly under projects/, and the archive job; moving the
// root stays a pending request the Rust supervisor applies on the next start.
//
// Visual language follows the shared settings surfaces (backup/handoff):
// 0.5px card strokes on --dsw-alias-settings-card-*, --dsw-radius-xl corners,
// 13/22 body type, 36px sm/md control scale. The move action is armed on the
// first click and confirmed on the second, because it restarts the app.
import { useEffect, useState } from 'react'
import type { DataRootCopyKey } from '../locales/dataRoot'
import type { ArchiveSnapshot, ProjectArchiveService } from '../lib/project-archive'
import { fill } from '../lib/project-archive'

interface DataRootStatus {
  supported: boolean
  current?: string
  default?: string
  isDefault?: boolean
  cloudSynced?: boolean
  pending?: string | null
  lastError?: string | null
}

export interface DataRootSectionProps {
  /** Locale-bound copy for `settings.dataRoot`. */
  t: (key: DataRootCopyKey) => string
  /** Shared project-archive service (picker, job polling, workspace registration). */
  archive: ProjectArchiveService
}

/** Stylesheet injected once per client by the core plugin. */
export const DATA_ROOT_STYLES = `
.dtr-root { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; font-size: 13px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.dtr-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dtr-card { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px; border: 0.5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
.dtr-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; line-height: 22px; font-weight: 500; }
.dtr-card-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dtr-badge { flex: none; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 16px; font-weight: 400; background: var(--dsw-alias-fill-secondary); color: var(--dsw-alias-label-secondary); }
.dtr-path { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 20px; word-break: break-all; }
.dtr-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; word-break: break-all; }
.dtr-note { margin: 0; padding: 8px 10px; border-radius: var(--dsw-radius-md, 8px); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); }
.dtr-note-warn { background: rgba(214,158,46,.12); }
.dtr-note-info { background: var(--dsw-alias-fill-secondary); }
.dtr-error { margin: 0; color: var(--dsw-alias-state-danger-primary, #d4453f); font-size: 12px; line-height: 18px; word-break: break-all; }
.dtr-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dtr-field label { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dtr-input {
  box-sizing: border-box; width: 100%; height: 36px; padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-fill-primary); color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 22px;
}
.dtr-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dtr-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: none; cursor: pointer; font-family: inherit;
  height: 36px; padding: 0 14px; border-radius: var(--dsw-radius-md);
  font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-fill-secondary);
  transition: transform 100ms ease-out, background-color 120ms ease-out;
}
.dtr-btn:disabled { opacity: 0.5; cursor: default; }
.dtr-btn-primary { color: var(--dsw-alias-text-on-primary, #fff); background: var(--dsw-alias-state-business-primary); }
.dtr-btn-danger { color: var(--dsw-alias-text-on-primary, #fff); background: var(--dsw-alias-state-danger-primary, #d4453f); }
.dtr-link { border: none; background: none; padding: 0; cursor: pointer; font-family: inherit; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-business-primary); }
.dtr-project-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; }
.dtr-project { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 4px; border-top: 0.5px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md); }
.dtr-project:first-child { border-top: 0; }
.dtr-project:hover { background: var(--dsw-alias-fill-secondary); }
.dtr-project:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }
.dtr-project-icon { flex: none; display: inline-flex; color: var(--dsw-alias-label-secondary); }
.dtr-project-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtr-project-export {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--dsw-radius-sm);
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; opacity: .7;
}
.dtr-project-export:hover:not(:disabled) { opacity: 1; background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, .06)); }
.dtr-project-export:disabled { opacity: .3; cursor: default; }
.dtr-project-export:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }
.dtr-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 8px 0 4px; }
.dtr-empty-icon { color: var(--dsw-alias-label-secondary); }
.dtr-empty-title { font-size: 13px; line-height: 20px; }
.dtr-spinner {
  width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: dtr-spin .7s linear infinite;
}
@keyframes dtr-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .dtr-spinner { animation: none; } }
`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(init?.headers as Record<string, string> | undefined),
  }
  const res = await fetch(`/easel/api${path}`, { ...init, headers, cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = (data as { detail?: string; message?: string }).detail
      ?? (data as { message?: string }).message
      ?? `HTTP ${res.status}`
    throw new Error(detail)
  }
  return data as T
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5 4 2.5h8l1.5 2M2.5 4.5v8h11v-8M2.5 4.5h11M6 7.5h4M8 7.5v4m0 0L6.5 10m1.5 1.5L9.5 10"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v7.5m0 0L5.5 7.5M8 10l2.5-2.5M3 11.5v1.5h10v-1.5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5c0-.55.45-1 1-1h3l1.5 1.5h4.5c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-9c-.55 0-1-.45-1-1v-7.5Z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Subscribe one component to the archive service.
 * @param archive - shared service.
 * @returns the latest snapshot.
 */
function useArchiveSnapshot(archive: ProjectArchiveService): ArchiveSnapshot {
  const [snapshot, setSnapshot] = useState(() => archive.snapshot())
  useEffect(() => {
    setSnapshot(archive.snapshot())
    return archive.subscribe(() => setSnapshot(archive.snapshot()))
  }, [archive])
  return snapshot
}

/** Render the data-location settings section.
 * @param props Locale-bound copy and the shared archive service.
 * @returns The section body.
 */
export function DataRootSection({ t, archive }: DataRootSectionProps) {
  const [status, setStatus] = useState<DataRootStatus | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const archiveState = useArchiveSnapshot(archive)
  const at = archive.t
  const archiveBusy = archiveState.picking || archiveState.job?.state === 'running'
  const archiveImporting = archiveState.picking
    || (archiveState.job?.state === 'running' && archiveState.job?.kind === 'import')

  useEffect(() => {
    let active = true
    request<DataRootStatus>('/data-root')
      .then((next) => {
        if (!active) return
        setStatus(next)
        setValue(next.current ?? next.default ?? '')
      })
      .catch((err: Error) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (status === null || !status.supported) return
    let active = true
    archive.loadProjects()
      .then(() => { if (active) setArchiveError(null) })
      .catch((err: Error) => { if (active) setArchiveError(err.message) })
    return () => { active = false }
  }, [archive, status])

  if (status !== null && !status.supported) {
    return <div className="dtr-root"><p className="dtr-muted">{t('onlyDesktop')}</p></div>
  }
  if (status === null) {
    return <div className="dtr-root">
      <p className="dtr-muted">{t('loading')}</p>
      {error === null ? null : <p className="dtr-error" role="alert">{error}</p>}
    </div>
  }

  const choose = async () => {
    setBusy(true)
    setError(null)
    try {
      const picked = await request<{ path: string | null }>('/data-root/pick', { method: 'POST' })
      if (picked.path) {
        setValue(picked.path)
        setArmed(false)
      }
    } catch (err) {
      const message = (err as Error).message
      setNotice(message === 'picker-unavailable' ? t('pickUnavailable') : message)
    } finally {
      setBusy(false)
    }
  }

  const migrate = async () => {
    setBusy(true)
    setError(null)
    setArmed(false)
    try {
      await request('/data-root', { method: 'POST', body: JSON.stringify({ path: value.trim() }) })
      setNotice(t('migrating'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const trimmed = value.trim().replace(/[\\/]+$/, '')
  const current = (status.current ?? '').replace(/[\\/]+$/, '')
  const unchanged = trimmed.length === 0 || trimmed === current
  const job = archiveState.job
  const jobLine = job?.state === 'running'
    ? job.kind === 'import'
      ? fill(t('projectsImporting'), { name: job.name ?? '' })
      : fill(t('projectsExporting'), { name: job.name ?? '' })
    : null
  // A failed list request must not hide the import action: show the card once
  // the first answer settled, and surface the list error inline.
  const archiveVisible = archiveState.supported === true
    || (archiveState.supported === undefined && archiveState.projectsReady)

  return <div className="dtr-root">
    <p className="dtr-intro">{t('intro')}</p>

    <section className="dtr-card">
      <div className="dtr-card-head">
        <span>{t('currentTitle')}</span>
        <span className="dtr-badge">{status.isDefault ? t('badgeDefault') : t('badgeCustom')}</span>
      </div>
      <p className="dtr-path">{status.current}</p>
      {status.isDefault || status.default === undefined ? null : (
        <p className="dtr-muted">{t('defaultLine').replace('{path}', status.default)}</p>
      )}
      {status.cloudSynced ? <p className="dtr-note dtr-note-warn">{t('cloudWarning')}</p> : null}
      {status.pending ? <p className="dtr-note dtr-note-info">{t('pending')}</p> : null}
      {status.lastError ? <p className="dtr-error" role="alert">{status.lastError}</p> : null}
    </section>

    {archiveVisible ? (
      <section className="dtr-card">
        <div className="dtr-card-head">
          <span className="dtr-card-title">
            {t('projectsTitle')}
            <span className="dtr-badge">{fill(t('projectsCount'), { count: archiveState.projects.length })}</span>
          </span>
          <button type="button" className="dtr-btn" disabled={archiveBusy}
            onClick={() => { void archive.startImport() }}>
            {archiveImporting ? <span className="dtr-spinner" aria-hidden="true" /> : <DownloadIcon />}
            {at('import')}
          </button>
        </div>
        {archiveState.projects.length === 0 ? (
          <div className="dtr-empty">
            <span className="dtr-empty-icon"><FolderIcon size={20} /></span>
            <span className="dtr-empty-title">{t('projectsEmpty')}</span>
            <span className="dtr-muted">{t('projectsEmptyHint')}</span>
            <button type="button" className="dtr-link" disabled={archiveBusy}
              onClick={() => { void archive.startImport() }}>
              {at('import')}
            </button>
          </div>
        ) : (
          <ul className="dtr-project-list">
            {archiveState.projects.map(project => (
              <li key={project.path} className="dtr-project" title={project.path} tabIndex={0}
                data-easel-project={project.path} data-easel-project-name={project.name}
                onKeyDown={(event) => {
                  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
                  event.preventDefault()
                  const rect = event.currentTarget.getBoundingClientRect()
                  event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
                    bubbles: true, cancelable: true, clientX: rect.left + 24, clientY: rect.top + 20,
                  }))
                }}>
                <span className="dtr-project-icon"><FolderIcon /></span>
                <span className="dtr-project-name">{project.name}</span>
                <button type="button" className="dtr-project-export" disabled={archiveBusy}
                  aria-label={at('export')} title={at('export')}
                  onClick={(event) => {
                    event.stopPropagation()
                    void archive.startExport(project.path, project.name)
                  }}>
                  <ArchiveIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
        {jobLine === null ? null : <p className="dtr-muted">{jobLine}</p>}
        {archiveError === null ? null : <p className="dtr-error" role="alert">{fill(t('projectsLoadFailed'), { message: archiveError })}</p>}
        <p className="dtr-muted">{t('projectsHint')}</p>
      </section>
    ) : null}

    <section className="dtr-card">
      <div className="dtr-card-head">
        <span>{t('moveToTitle')}</span>
        <span className="dtr-actions">
          {armed ? <button type="button" className="dtr-btn dtr-btn-danger" disabled={busy} onClick={() => { void migrate() }}>{t('confirmMigrate')}</button> : (
            <button type="button" className="dtr-btn dtr-btn-primary" disabled={busy || unchanged}
              onClick={() => { setArmed(true); setNotice(null) }}>
              {t('migrate')}
            </button>
          )}
          {armed ? <button type="button" className="dtr-btn" disabled={busy} onClick={() => setArmed(false)}>{t('cancel')}</button> : null}
        </span>
      </div>
      <div className="dtr-field">
        <label>{t('newLocation')}</label>
        <input className="dtr-input" value={value} spellCheck={false} placeholder={t('newLocationPlaceholder')}
          onChange={event => { setValue(event.target.value); setArmed(false); setNotice(null) }} />
      </div>
      <div className="dtr-actions">
        <button type="button" className="dtr-btn" disabled={busy} onClick={() => { void choose() }}>{t('choose')}</button>
        {status.isDefault || status.default === undefined ? null : (
          <button type="button" className="dtr-link" disabled={busy}
            onClick={() => { setValue(status.default ?? ''); setArmed(false) }}>
            {t('useDefault')}
          </button>
        )}
      </div>
      <p className="dtr-muted">{t('moveToHint')}</p>
      {notice ? <p className="dtr-note dtr-note-info">{notice}</p> : null}
      {error ? <p className="dtr-error" role="alert">{error}</p> : null}
    </section>
  </div>
}
