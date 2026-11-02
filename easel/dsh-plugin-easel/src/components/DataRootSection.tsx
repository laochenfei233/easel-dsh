// Settings section: where the data root lives, and how to move it.
//
// This is a desktop-only surface. The host half exposes the current/default
// root and accepts a pending relocation request; the Rust supervisor performs
// the move on the next server start, so this component only validates the
// choice and then tells the user the app is restarting.
//
// Visual language follows the shared settings surfaces (backup/handoff):
// 0.5px card strokes on --dsw-alias-settings-card-*, --dsw-radius-xl corners,
// 13/22 body type, 36px sm/md control scale. The move action is armed on the
// first click and confirmed on the second, because it restarts the app.
import { useEffect, useState } from 'react'
import type { DataRootCopyKey } from '../locales/dataRoot'

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
}

/** Stylesheet injected once per client by the core plugin. */
export const DATA_ROOT_STYLES = `
.dtr-root { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; font-size: 13px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.dtr-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dtr-card { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px; border: 0.5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
.dtr-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; line-height: 22px; font-weight: 500; }
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
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
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

/** Render the data-location settings section.
 * @param props Locale-bound copy.
 * @returns The section body.
 */
export function DataRootSection({ t }: DataRootSectionProps) {
  const [status, setStatus] = useState<DataRootStatus | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
