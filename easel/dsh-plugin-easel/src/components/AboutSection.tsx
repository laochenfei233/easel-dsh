// Settings section: the About card — the app identity, the update check and
// install row, and the update source. The shell update channel comes from the
// desktop relay store (`easelUpdate`); browsers and WebKit app windows lack
// it and get the muted desktop-only line, so no dead controls ever render.
//
// Visual language follows the shared settings surfaces (data root / backup /
// handoff): 0.5px card strokes on --dsw-alias-settings-card-*, --dsw-radius-xl
// corners, 13/22 body type. The one colored element is the brand tile; the
// rest is neutral so the page reads as a colophon, not a marketing panel.
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { EaselUpdate } from '../lib/hostUpdate'
import type { EaselAboutCopyKey } from '../locales/easelAbout'
import { IconChat, IconChevron, IconFile, IconGithub, IconGlobe } from './icons'
import appIcon from '../assets/app-icon.png'

/** Stylesheet injected once per client by the core plugin. */
export const ABOUT_STYLES = `
.eau-root { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 8px; font-size: 13px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.eau-card { border: 0.5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
.eau-hero { padding: 18px 18px 4px; }
.eau-brand { display: flex; align-items: flex-start; gap: 12px; }
.eau-mark {
  flex: none; width: 44px; height: 44px; border-radius: 11px; display: block; object-fit: contain;
  background: #fff; box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.12);
}
.eau-id { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding-top: 1px; }
.eau-name { font-size: 15px; line-height: 22px; font-weight: 600; letter-spacing: 0.01em; }
.eau-tagline { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.eau-version {
  align-self: flex-start; margin-top: 5px; padding: 0 8px; border-radius: 999px;
  font-size: 11px; line-height: 18px; font-variant-numeric: tabular-nums;
  background: var(--dsw-alias-fill-secondary); color: var(--dsw-alias-label-secondary);
}
.eau-grow { flex: 1; }
.eau-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; font-family: inherit; white-space: nowrap;
  height: 34px; padding: 0 14px; border-radius: var(--dsw-radius-md);
  font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-fill-secondary);
  transition: transform 100ms ease-out, background-color 120ms ease-out, opacity 120ms ease-out;
}
.eau-btn:hover:not(:disabled) { background: var(--dsw-alias-fill-tertiary, var(--dsw-alias-fill-secondary)); }
.eau-btn:active:not(:disabled) { transform: scale(0.98); }
.eau-btn:disabled { opacity: 0.5; cursor: default; }
.eau-btn-primary { color: var(--dsw-alias-text-on-primary, #fff); background: var(--dsw-alias-state-business-primary); }
.eau-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-state-business-primary); opacity: 0.92; }
.eau-status { display: flex; align-items: center; gap: 6px; margin: 10px 0 0 56px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.eau-status.is-available { color: var(--dsw-alias-state-business-primary); }
.eau-status.is-error { color: var(--dsw-alias-state-danger-primary, #d4453f); }
.eau-dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; flex: none; }
.eau-progress { display: flex; align-items: center; gap: 10px; margin: 12px 0 2px 56px; }
.eau-progress-track { flex: 1; min-width: 120px; height: 4px; border-radius: 999px; background: var(--dsw-alias-fill-secondary); overflow: hidden; }
.eau-progress-fill { height: 100%; border-radius: 999px; background: var(--dsw-alias-state-business-primary); transition: width 200ms ease-out; }
.eau-muted { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; word-break: break-all; }
.eau-divider { height: 0; border-top: 0.5px solid var(--dsw-alias-settings-card-stroke); margin: 14px -18px 0; }
.eau-row { display: flex; align-items: center; gap: 12px; min-height: 46px; }
.eau-row + .eau-row { border-top: 0.5px solid var(--dsw-alias-settings-card-stroke); }
.eau-row-label { flex: none; color: var(--dsw-alias-label-primary); }
.eau-row-body { flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
.eau-select, .eau-input {
  box-sizing: border-box; height: 32px; padding: 0 8px; font-family: inherit; font-size: 13px;
  color: var(--dsw-alias-label-primary); background: transparent;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-md);
}
.eau-select { max-width: 220px; cursor: pointer; }
.eau-input { flex: 1; min-width: 0; }
.eau-source-note { display: flex; flex-direction: column; gap: 8px; padding: 0 0 12px; }
.eau-hint { margin: 0; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.eau-custom { display: flex; align-items: center; gap: 8px; }
.eau-links { padding: 2px 18px; }
.eau-link-row {
  display: flex; align-items: center; gap: 12px; min-height: 50px;
  color: var(--dsw-alias-label-primary); text-decoration: none;
}
.eau-link-row + .eau-link-row { border-top: 0.5px solid var(--dsw-alias-settings-card-stroke); }
.eau-link-icon { flex: none; display: flex; color: var(--dsw-alias-label-secondary); transition: color 120ms ease-out; }
.eau-link-label { flex: 1; min-width: 0; }
.eau-link-action { flex: none; display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--dsw-alias-label-secondary); transition: color 120ms ease-out; }
.eau-link-row:hover .eau-link-icon, .eau-link-row:hover .eau-link-action { color: var(--dsw-alias-state-business-primary); }
.eau-root :is(.eau-btn, .eau-link-row, .eau-select, .eau-input):focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .eau-root :is(.eau-btn, .eau-link-icon, .eau-link-action, .eau-progress-fill) { transition: none; }
}

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

/** The deployed product site the links point at: `easel.xyern.com` serves the
 * pages, the download mirror, and the release notes. */
export const WEBSITE_URL = 'https://easel.xyern.com/'
export const CHANGELOG_URL = `${WEBSITE_URL}changelog/`
export const REPO_URL = 'https://github.com/laochenfei233/easel-dsh'
/** The repository issue tracker the feedback link opens. */
export const ISSUES_URL = 'https://github.com/laochenfei233/easel-dsh/issues'

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
  /** Unsaved selector choice; `undefined` follows the shell snapshot. */
  const [draftSource, setDraftSource] = useState<string | undefined>(undefined)
  const [customUrl, setCustomUrl] = useState('')
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourceNote, setSourceNote] = useState<string | undefined>(undefined)

  useEffect(() => { void update.refresh() }, [update])
  useEffect(() => { setCustomUrl(state.customUrl ?? '') }, [state.customUrl])

  const links = [
    { href: WEBSITE_URL, label: t('websiteLink'), Icon: IconGlobe },
    { href: CHANGELOG_URL, label: t('changelogLink'), Icon: IconFile },
    { href: REPO_URL, label: t('repoLink'), Icon: IconGithub },
    { href: ISSUES_URL, label: t('feedbackLink'), Icon: IconChat },
  ].map(({ href, label, Icon }) => (
    <a key={href} className="eau-link-row" href={href} target="_blank" rel="noreferrer">
      <span className="eau-link-icon"><Icon size={16} /></span>
      <span className="eau-link-label">{label}</span>
      <span className="eau-link-action">{t('openLink')}<IconChevron size={14} /></span>
    </a>
  ))

  if (!state.supported) {
    return <div className="eau-root">
      <p className="eau-muted">{t('desktopOnly')}</p>
      <section className="eau-card eau-links">{links}</section>
    </div>
  }

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
  const statusText = state.lastCheckStatus === 'up-to-date' ? t('upToDate')
    : state.lastCheckStatus === 'available' && state.latest
      ? t('availableFound').replace('{version}', state.latest.version)
    : state.lastCheckStatus === 'error' ? state.lastError ?? t('sourceUnavailable')
    : null
  const statusClass = state.lastCheckStatus === 'available' ? 'is-available'
    : state.lastCheckStatus === 'error' ? 'is-error' : ''

  const applies = async (source: string, url?: string) => {
    setSourceBusy(true)
    setSourceNote(undefined)
    const result = await update.setSource(source, url)
    setSourceBusy(false)
    if (result.ok) {
      setDraftSource(undefined)
      setSourceNote(t('saved'))
    }
  }
  const choice = draftSource ?? state.sourceKey
  const onSourceChange = (value: string) => {
    setDraftSource(value)
    setSourceNote(undefined)
    if (value !== 'custom') void applies(value)
  }
  const saveCustom = () => {
    if (!/^https?:\/\/\S+$/i.test(customUrl.trim())) {
      setSourceNote(t('invalidUrl'))
      return
    }
    void applies('custom', customUrl.trim())
  }

  return <div className="eau-root">
    <section className="eau-card eau-hero">
      <div className="eau-brand">
        <img className="eau-mark" src={appIcon} alt="" width={44} height={44} />
        <div className="eau-id">
          <span className="eau-name">{t('appName')}</span>
          <span className="eau-tagline">{t('tagline')}</span>
          {state.version ? <span className="eau-version">v{state.version}</span> : null}
        </div>
        <span className="eau-grow" />
        <button type="button" className={state.lastCheckStatus === 'available' ? 'eau-btn eau-btn-primary' : 'eau-btn'}
          disabled={buttonBusy} onClick={checkOrInstall}>{buttonLabel}</button>
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
      ) : statusText ? (
        <p className={`eau-status ${statusClass}`} role="status"><span className="eau-dot" />{statusText}</p>
      ) : null}

      <div className="eau-divider" />

      <div className="eau-row">
        <span className="eau-row-label">{t('sourceLabel')}</span>
        <div className="eau-row-body">
          <select className="eau-select" aria-label={t('sourceLabel')} value={choice} disabled={sourceBusy || installing}
            onChange={(event) => onSourceChange(event.target.value)}>
            <option value="default">{t('sourceDefault')}</option>
            <option value="github">{t('sourceGithub')}</option>
            <option value="custom">{t('sourceCustom')}</option>
          </select>
        </div>
      </div>

      <div className="eau-source-note">
        {choice === 'custom' ? (
          <div className="eau-custom">
            <input className="eau-input" aria-label={t('customUrlLabel')} placeholder="https://…/latest.json"
              value={customUrl} disabled={sourceBusy || installing} spellCheck={false}
              onChange={(event) => { setCustomUrl(event.target.value); setSourceNote(undefined) }}
              onKeyDown={(event) => { if (event.key === 'Enter') saveCustom() }} />
            <button type="button" className="eau-btn" disabled={sourceBusy || installing} onClick={saveCustom}>{t('save')}</button>
          </div>
        ) : null}
        <p className="eau-hint" role="status">
          {sourceNote ?? (choice === 'default' ? t('sourceHint')
            : choice === 'custom' && state.sourceKey !== 'custom' ? t('customUrlHint')
            : state.endpoints.length > 0 ? state.endpoints.join(' · ') : t('sourceUnavailable'))}
        </p>
      </div>

      {state.lastCheckMs && !statusText ? (
        <p className="eau-muted">{t('lastChecked').replace('{time}', new Date(state.lastCheckMs).toLocaleString())}</p>
      ) : null}
    </section>

    <section className="eau-card eau-links">{links}</section>
  </div>
}
