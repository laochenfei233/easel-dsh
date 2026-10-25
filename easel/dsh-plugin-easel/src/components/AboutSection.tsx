// Settings section: the About card — the app's version, the update check and
// install row, and the update source. The shell update channel comes from the
// desktop relay store (`easelUpdate`); browsers and WebKit app windows lack
// it and get the muted desktop-only line, so no dead controls ever render.
//
// Visual language follows the shared settings surfaces (data root / backup /
// handoff): 0.5px card strokes on --dsw-alias-settings-card-*, --dsw-radius-xl
// corners, 13/22 body type, 36px control scale.
import { useEffect, useSyncExternalStore } from 'react'
import type { EaselUpdate } from '../lib/hostUpdate'
import type { EaselAboutCopyKey } from '../locales/easelAbout'

/** Stylesheet injected once per client by the core plugin. */
export const ABOUT_STYLES = `
.eau-root { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; font-size: 13px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.eau-card { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px; border: 0.5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
.eau-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; line-height: 22px; font-weight: 500; }
.eau-badge { flex: none; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 16px; font-weight: 400; background: var(--dsw-alias-fill-secondary); color: var(--dsw-alias-label-secondary); }
.eau-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.eau-muted { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; word-break: break-all; }
.eau-error { margin: 0; color: var(--dsw-alias-state-danger-primary, #d4453f); font-size: 12px; line-height: 18px; word-break: break-all; }
.eau-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; font-family: inherit;
  height: 36px; padding: 0 14px; border-radius: var(--dsw-radius-md);
  font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-fill-secondary);
  transition: transform 100ms ease-out, background-color 120ms ease-out;
}
.eau-btn:disabled { opacity: 0.5; cursor: default; }
.eau-btn-primary { color: var(--dsw-alias-text-on-primary, #fff); background: var(--dsw-alias-state-business-primary); }
.eau-link { border: none; background: none; padding: 0; cursor: pointer; font-family: inherit; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-business-primary); text-decoration: none; }
.eau-progress { display: flex; align-items: center; gap: 10px; }
.eau-progress-track { flex: 1; min-width: 120px; height: 4px; border-radius: 999px; background: var(--dsw-alias-fill-secondary); overflow: hidden; }
.eau-progress-fill { height: 100%; border-radius: 999px; background: var(--dsw-alias-state-business-primary); transition: width 200ms ease-out; }
.eau-note { margin: 0; padding: 8px 10px; border-radius: var(--dsw-radius-md, 8px); font-size: 12px; line-height: 18px; background: var(--dsw-alias-fill-secondary); }

.eau-overlay { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; }
.eau-overlay-mask { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.4); }
.eau-dialog {
  position: relative; box-sizing: border-box; width: 440px; max-width: calc(100vw - 48px);
  display: flex; flex-direction: column; gap: 12px; padding: 20px 24px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-fill-primary); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.eau-dialog h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.eau-dialog-actions { justify-content: flex-end; margin-top: 4px; }
`

/** The product site the links point at; the deployment belongs to the
 * easel-website spec, and a domain change lands here once it is bought. */
export const WEBSITE_URL = 'https://laochenfei233.github.io/easel-dsh/'
export const CHANGELOG_URL = `${WEBSITE_URL}#changelog`

export interface AboutSectionProps {
  /** Locale-bound copy for `settings.easelAbout`. */
  t: (key: EaselAboutCopyKey) => string
  /** The shared desktop-update store. */
  update: EaselUpdate
}

/** Render the About settings section.
 * @param props Locale-bound copy and the update store.
 * @returns The section body.
 */
export function AboutSection({ t, update }: AboutSectionProps) {
  const state = useSyncExternalStore(update.subscribe, update.snapshot)

  useEffect(() => { void update.refresh() }, [update])

  if (!state.supported) {
    return <div className="eau-root"><p className="eau-muted">{t('desktopOnly')}</p></div>
  }

  // The check row: the primary button and the outcome text share the state
  // machine (idle / busy / error / up-to-date / available), and an install in
  // flight replaces the row with its progress.
  const installing = state.progress?.phase === 'installing'
  const downloading = state.progress?.phase === 'downloading'
  const buttonLabel = state.checking ? t('checking')
    : state.lastCheckStatus === 'error' ? t('retry')
    : state.lastCheckStatus === 'available' ? t('install')
    : t('checkUpdate')
  const buttonBusy = state.checking || downloading || installing
  const checkOrInstall = () => {
    void (state.lastCheckStatus === 'available' ? update.install() : update.check())
  }
  const statusText = state.lastCheckStatus === 'error' ? null
    : state.lastCheckStatus === 'up-to-date' ? t('upToDate')
    : state.lastCheckStatus === 'available' && state.latest
      ? t('availableFound').replace('{version}', state.latest.version)
    : null

  return <div className="eau-root">
    <section className="eau-card">
      <div className="eau-card-head">
        <span>{t('appName')}</span>
        {state.version ? <span className="eau-badge">v{state.version}</span> : null}
      </div>
      {downloading || installing ? (
        <div className="eau-progress">
          <div className="eau-progress-track" aria-hidden="true">
            <div className="eau-progress-fill" style={{ width: `${state.progress?.percent ?? 0}%` }} />
          </div>
          <span className="eau-muted" role="status">
            {downloading && state.progress?.percent !== undefined
              ? t('downloadProgress').replace('{percent}', String(state.progress.percent))
              : installing ? t('installing') : t('downloading')}
          </span>
        </div>
      ) : (
        <div className="eau-row">
          <button type="button" className={state.lastCheckStatus === 'available' ? 'eau-btn eau-btn-primary' : 'eau-btn'}
            disabled={buttonBusy} onClick={checkOrInstall}>{buttonLabel}</button>
          {statusText ? <span className={state.lastCheckStatus === 'available' ? 'eau-error' : 'eau-muted'} role="status">{statusText}</span> : null}
        </div>
      )}
      {state.lastError ? <p className="eau-error" role="alert">{state.lastError}</p> : null}
      {state.lastCheckMs ? (
        <p className="eau-muted">{t('lastChecked').replace('{time}', new Date(state.lastCheckMs).toLocaleString())}</p>
      ) : null}
    </section>

    <section className="eau-card">
      <div className="eau-card-head">
        <span>{t('sourceLabel')}</span>
        <span className="eau-badge">{state.source === 'override' ? t('sourceOverride')
          : state.source === 'error' ? t('sourceUnavailable') : t('sourceDefault')}</span>
      </div>
      {state.endpoints.length > 0
        ? state.endpoints.map(endpoint => <p key={endpoint} className="eau-muted">{endpoint}</p>)
        : <p className="eau-muted">{t('sourceUnavailable')}</p>}
    </section>

    <div className="eau-row">
      <a className="eau-link" href={WEBSITE_URL} target="_blank" rel="noreferrer">{t('websiteLink')}</a>
      <a className="eau-link" href={CHANGELOG_URL} target="_blank" rel="noreferrer">{t('changelogLink')}</a>
    </div>
  </div>
}
