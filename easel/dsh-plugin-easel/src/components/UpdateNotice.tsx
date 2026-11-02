// Frame-wide update notice: opens on the shell's deferred-check announcement
// (easel://update-available relayed through the host bridge), stays up while
// the install downloads, and hands over to the installer window afterwards.
// "暂不" only closes the dialog — the version is already noted shell-side, so
// it will not pop again; the About section keeps the persistent hint.
//
// The overlay host places entries in the frame's fixed overlay layer, so the
// dialog needs no portal; it renders its own mask + card because the easel
// bundle does not resolve the host's Modal primitive.
import { useSyncExternalStore } from 'react'
import type { EaselUpdate } from '../lib/hostUpdate'
import type { EaselAboutCopyKey } from '../locales/easelAbout'
import { CHANGELOG_URL } from './AboutSection'

export interface UpdateNoticeProps {
  /** Locale-bound copy for `settings.easelAbout`. */
  t: (key: EaselAboutCopyKey) => string
  /** The shared desktop-update store. */
  update: EaselUpdate
}

/** Render the update notice dialog.
 * @param props Locale-bound copy and the update store.
 * @returns The dialog while an announcement is live, otherwise nothing.
 */
export function UpdateNotice({ t, update }: UpdateNoticeProps) {
  const state = useSyncExternalStore(update.subscribe, update.snapshot)
  if (!state.supported || state.announce === undefined) return null

  // First paragraph of the release notes; the full changelog link carries the rest.
  const notes = (state.announce.notes ?? '').trim()
  const summary = notes.slice(0, notes.indexOf('\n') === -1 ? notes.length : notes.indexOf('\n')).trim()
  const busy = state.progress?.phase === 'downloading' || state.progress?.phase === 'installing'
  const downloading = state.progress?.phase === 'downloading'

  return <div className="eau-overlay" role="dialog" aria-modal="true" aria-labelledby="eau-notice-title">
    <div className="eau-overlay-mask" aria-hidden="true" onClick={update.dismiss} />
    <div className="eau-dialog">
      <h2 id="eau-notice-title">{t('noticeTitle').replace('{version}', state.announce.version)}</h2>
      {summary ? <p className="eau-muted">{summary}</p> : null}
      {busy ? (
        <div className="eau-progress">
          <div className="eau-progress-track" aria-hidden="true">
            <div className="eau-progress-fill" style={{ width: `${state.progress?.percent ?? 0}%` }} />
          </div>
          <span className="eau-muted" role="status">
            {downloading && state.progress?.percent !== undefined
              ? t('downloadProgress').replace('{percent}', String(state.progress.percent))
              : state.progress?.phase === 'installing' ? t('installing') : t('downloading')}
          </span>
        </div>
      ) : (
        <div className="eau-row eau-dialog-actions">
          <button type="button" className="eau-btn" onClick={update.dismiss}>{t('noticeLater')}</button>
          <button type="button" className="eau-btn eau-btn-primary" onClick={() => { void update.install() }}>
            {t('noticeInstallNow')}
          </button>
        </div>
      )}
      {state.progress?.phase === 'failed' && state.lastError ? (
        <p className="eau-error" role="alert">{state.lastError}</p>
      ) : null}
      <div className="eau-row">
        <a className="eau-link" href={CHANGELOG_URL} target="_blank" rel="noreferrer">{t('noticeFullChangelog')}</a>
      </div>
    </div>
  </div>
}
