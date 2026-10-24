// Settings section: where the data root lives, and how to move it.
//
// This is a desktop-only surface. The host half exposes the current/default
// root and accepts a pending relocation request; the Rust supervisor performs
// the move on the next server start, so this component only validates the
// choice and then tells the user the app is restarting.
import { useEffect, useState, type CSSProperties } from 'react'

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
  t: (key: string) => string
}

const box: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }
const row: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const label: CSSProperties = { opacity: 0.7 }
const code: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, wordBreak: 'break-all' }
const actions: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }
const inputStyle: CSSProperties = {
  flex: '1 1 320px', minWidth: 0, padding: '6px 8px', borderRadius: 6,
  border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
}
const buttonStyle: CSSProperties = {
  padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(127,127,127,.35)',
  background: 'transparent', color: 'inherit', cursor: 'pointer',
}
const primaryStyle: CSSProperties = {
  ...buttonStyle, border: 'none', background: 'var(--dsw-accent, #4f7cff)', color: '#fff',
}
const warningStyle: CSSProperties = { margin: 0, padding: '8px 10px', borderRadius: 6, background: 'rgba(214,158,46,.12)', color: 'inherit' }
const errorStyle: CSSProperties = { margin: 0, color: 'var(--dsw-danger, #d14)', whiteSpace: 'pre-wrap' }

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
    return <section style={box}><h2>{t('nav')}</h2><p>{t('onlyDesktop')}</p></section>
  }
  if (status === null) {
    return <section style={box}>
      <h2>{t('nav')}</h2>
      <p>{t('loading')}</p>
      {error === null ? null : <p style={errorStyle} role="alert">{error}</p>}
    </section>
  }

  const choose = async () => {
    setBusy(true)
    setError(null)
    try {
      const picked = await request<{ path: string | null }>('/data-root/pick', { method: 'POST' })
      if (picked.path) setValue(picked.path)
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

  return <section style={box}>
    <h2>{t('nav')}</h2>
    <p style={{ margin: 0 }}>{t('intro')}</p>

    <div style={row}>
      <span style={label}>{t('current')}</span>
      <code style={code}>{status.current}</code>
    </div>
    <div style={row}>
      <span style={label}>{t('default')}</span>
      <code style={code}>{status.default}</code>
    </div>
    {status.isDefault ? null : (
      <div style={actions}>
        <button type="button" style={buttonStyle} disabled={busy}
          onClick={() => { setValue(status.default ?? ''); setNotice(null) }}>
          {t('useDefault')}
        </button>
      </div>
    )}

    {status.cloudSynced ? <p style={warningStyle}>{t('cloudWarning')}</p> : null}
    {status.pending ? <p style={{ margin: 0 }}>{t('pending')}</p> : null}
    {status.lastError ? <p style={errorStyle} role="alert">{status.lastError}</p> : null}
    {notice ? <p style={{ margin: 0 }}>{notice}</p> : null}
    {error ? <p style={errorStyle} role="alert">{error}</p> : null}

    <div style={actions}>
      <input style={inputStyle} value={value} spellCheck={false}
        onChange={event => { setValue(event.target.value); setNotice(null) }}
        aria-label={t('current')} />
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => { void choose() }}>
        {t('choose')}
      </button>
      <button type="button" style={primaryStyle} disabled={busy || unchanged} onClick={() => { void migrate() }}>
        {t('migrate')}
      </button>
    </div>
  </section>
}
