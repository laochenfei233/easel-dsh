// Sidebar import action: one icon button in the workspace header that starts
// the shared archive import. The settings card owns the discoverable text
// button; this is the fast path while browsing workspaces. It hides itself in
// the collapsed rail and wherever the host reports archives unsupported.
import { useEffect, useState } from 'react'
import type { ArchiveSnapshot, ProjectArchiveService } from '../lib/project-archive'

const NS = 'easel.archive'
const STYLE_ID = 'easel-project-import-style'

const STYLES = `
.easel-header-import {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--dsw-radius-sm);
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.easel-header-import:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.easel-header-import:disabled { opacity: .45; cursor: default; }
.easel-header-import:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.easel-header-import__spinner {
  width: 13px; height: 13px; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: easel-header-import-spin .7s linear infinite;
}
@keyframes easel-header-import-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .easel-header-import__spinner { animation: none; } }
`

function ImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v7.5m0 0L5.5 7.5M8 10l2.5-2.5M3 11.5v1.5h10v-1.5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function useArchiveSnapshot(archive: ProjectArchiveService): ArchiveSnapshot {
  const [snapshot, setSnapshot] = useState(() => archive.snapshot())
  useEffect(() => {
    setSnapshot(archive.snapshot())
    return archive.subscribe(() => setSnapshot(archive.snapshot()))
  }, [archive])
  return snapshot
}

/**
 * @param props - sidebar header owner share plus the injected service and copy.
 * @returns the import button, or null when it cannot apply here.
 */
function ImportButton({ wide, archive, t }: {
  wide: boolean
  archive: ProjectArchiveService
  t: (key: string) => string
}) {
  const snapshot = useArchiveSnapshot(archive)
  if (!wide || snapshot.supported !== true) return null
  const jobRunning = snapshot.job?.state === 'running'
  const busy = snapshot.picking || jobRunning
  const importing = snapshot.picking || (jobRunning && snapshot.job?.kind === 'import')
  return (
    <button
      type="button"
      className="easel-header-import"
      aria-label={t('import')}
      title={t('import')}
      aria-busy={importing}
      disabled={busy}
      onClick={() => { void archive.startImport() }}
    >
      {importing ? <span className="easel-header-import__spinner" aria-hidden="true" /> : <ImportIcon />}
    </button>
  )
}

export const plugin = {
  name: 'easel-project-import',
  inject: ['slots', 'locale', 'easelProjectArchive'],
  apply(ctx: any) {
    ctx.effect(() => {
      if (document.getElementById(STYLE_ID) !== null) return () => {}
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = STYLES
      document.head.append(style)
      return () => { style.remove() }
    }, 'easel: project import button styles')
    const t = ctx.locale.bind(NS)
    const archive = ctx.easelProjectArchive as ProjectArchiveService
    ctx.slots.inject('sidebar.workspaces.header.action', () => ctx.slots.register({
      name: 'sidebar.workspaces.header.action',
      id: 'easel-project-import',
      order: 10,
      locale: NS,
      inject: () => ({ archive, t }),
    }, ImportButton))
  },
}
