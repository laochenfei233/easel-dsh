// Backup settings section. Visual language follows the shared settings
// surfaces: 0.5px card strokes on --dsw-alias-settings-card-*, --dsw-radius-xl
// corners, 13/22 body type, sm/md control scale — same tokens as the handoff
// section. Secrets are write-only here: the server reports has/has-not and the
// client never sees a stored value.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectSmb,
  getBackupConfig,
  getBackupStatus,
  listRemoteBackups,
  putBackupConfig,
  restoreBackup,
  runBackup,
  testBackupDestination,
  type BackupConfig,
  type BackupGroupId,
  type BackupSecretsPresence,
  type RemoteBackupItem,
  type RestorePlanView,
} from '../lib/backup-api'
import { BACKUP_COPY, type BackupCopy } from '../locales/backup'

const GROUPS: Array<{ id: BackupGroupId; title: keyof BackupCopy; hint: keyof BackupCopy }> = [
  { id: 'config', title: 'scopeConfig', hint: 'scopeConfigHint' },
  { id: 'sessions', title: 'scopeSessions', hint: 'scopeSessionsHint' },
  { id: 'workspace', title: 'scopeWorkspace', hint: 'scopeWorkspaceHint' },
]

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

/** Stylesheet injected once per client by the section plugin. */
export const BACKUP_STYLES = `
.ebk-root { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; font-size: 13px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.ebk-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ebk-card { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px; border: 0.5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
.ebk-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; line-height: 22px; font-weight: 500; }
.ebk-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 4px 0; }
.ebk-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ebk-field label { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ebk-input, .ebk-select {
  box-sizing: border-box; width: 100%; height: 36px; padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-fill-primary); color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 14px; line-height: 22px;
}
.ebk-select { width: auto; min-width: 140px; }
.ebk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
.ebk-check { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; cursor: pointer; }
.ebk-check input { margin-top: 3px; accent-color: var(--dsw-alias-state-business-primary); }
.ebk-check-main { display: flex; flex-direction: column; gap: 2px; }
.ebk-check-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ebk-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ebk-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; font-family: inherit;
  height: 36px; padding: 0 14px; border-radius: var(--dsw-radius-md);
  font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-fill-secondary);
  transition: transform 100ms ease-out, background-color 120ms ease-out;
}
.ebk-btn:disabled { opacity: 0.5; cursor: default; }
.ebk-btn-primary { color: var(--dsw-alias-text-on-primary, #fff); background: var(--dsw-alias-state-business-primary); }
.ebk-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ebk-ok { color: var(--dsw-alias-state-success-primary, #2e9e63); font-size: 12px; line-height: 18px; }
.ebk-error { color: var(--dsw-alias-state-danger-primary, #d4453f); font-size: 12px; line-height: 18px; word-break: break-all; }
.ebk-progress { display: flex; flex-direction: column; gap: 4px; }
.ebk-bar { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l2); overflow: hidden; }
.ebk-bar-fill { height: 100%; background: var(--dsw-alias-state-business-primary); transition: width 200ms ease-out; }
.ebk-history { display: flex; flex-direction: column; }
.ebk-history-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
.ebk-history-row + .ebk-history-row { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.ebk-badge { flex: none; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 16px; background: var(--dsw-alias-fill-secondary); }
.ebk-badge-failed { color: var(--dsw-alias-state-danger-primary, #d4453f); }
.ebk-badge-ok { color: var(--dsw-alias-state-success-primary, #2e9e63); }
`

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

const formatTime = (ms: number): string => new Date(ms).toLocaleString()

/**
 * The backup settings section: destination form, scope, encryption, schedule,
 * manual run with progress, history, and two-step restore.
 * @param props - t: bound locale dictionary.
 */
export default function BackupSettings({ t }: { t: BackupCopy }) {
  const [config, setConfig] = useState<BackupConfig | null>(null)
  const [secrets, setSecrets] = useState<BackupSecretsPresence | null>(null)
  const [engineReady, setEngineReady] = useState(true)
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getBackupStatus>> | null>(null)
  const [remote, setRemote] = useState<Record<BackupGroupId, RemoteBackupItem[]> | null>(null)
  const [restoreGroup, setRestoreGroup] = useState<BackupGroupId>('config')
  const [restoreStamp, setRestoreStamp] = useState('')
  const [plan, setPlan] = useState<RestorePlanView | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const pollRef = useRef<number | undefined>(undefined)

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getBackupStatus()
      setStatus(next)
      return next
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    getBackupConfig()
      .then(data => {
        if (!active) return
        setConfig(data.config)
        setSecrets(data.secrets)
        setEngineReady(data.engineReady)
      })
      .catch(error => setNotice({ kind: 'error', text: error.message }))
    refreshStatus()
    return () => {
      active = false
      if (pollRef.current !== undefined) window.clearInterval(pollRef.current)
    }
  }, [refreshStatus])

  const busy = status?.busy === true

  // 备份进行中每秒轮询一次，结束后停表并刷新远端列表。
  useEffect(() => {
    if (!busy) {
      if (pollRef.current !== undefined) {
        window.clearInterval(pollRef.current)
        pollRef.current = undefined
      }
      return
    }
    pollRef.current = window.setInterval(() => {
      void refreshStatus().then(next => {
        if (next !== null && !next.busy) {
          void listRemoteBackups().then(setRemote).catch(() => {})
        }
      })
    }, 1000)
    return () => {
      if (pollRef.current !== undefined) window.clearInterval(pollRef.current)
    }
  }, [busy, refreshStatus])

  if (config === null || secrets === null) {
    return <div className="ebk-root">{notice?.kind === 'error' ? <p className="ebk-error">{notice.text}</p> : null}</div>
  }

  const patch = (changes: Partial<BackupConfig>): void => setConfig({ ...config, ...changes })
  const secretValue = (key: string): string => secretInputs[key] ?? ''

  const collectSecrets = (): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(secretInputs)) {
      if (value.length > 0) out[key] = value
    }
    return out
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setNotice(null)
    try {
      const saved = await putBackupConfig(config, collectSecrets())
      setConfig(saved.config)
      setSecrets(saved.secrets)
      setSecretInputs({})
      setNotice({ kind: 'ok', text: t.saved })
    } catch (error) {
      setNotice({ kind: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const test = async (): Promise<void> => {
    setTesting(true)
    setNotice(null)
    try {
      await testBackupDestination()
      setNotice({ kind: 'ok', text: t.testOk })
    } catch (error) {
      setNotice({ kind: 'error', text: error.message })
    } finally {
      setTesting(false)
    }
  }

  const run = async (): Promise<void> => {
    const groups = GROUPS.filter(group => config.groups[group.id]).map(group => group.id)
    if (groups.length === 0) {
      setNotice({ kind: 'error', text: t.noGroups })
      return
    }
    setNotice(null)
    try {
      await runBackup(groups)
      await refreshStatus()
    } catch (error) {
      setNotice({ kind: 'error', text: error.message })
    }
  }

  const openRestore = async (): Promise<void> => {
    setRestoring(true)
    setNotice(null)
    setPlan(null)
    try {
      const listing = await listRemoteBackups()
      setRemote(listing)
      const first = listing.groups[restoreGroup][0]
      setRestoreStamp(first?.stamp ?? '')
    } catch (error) {
      setNotice({ kind: 'error', text: error.message })
    } finally {
      setRestoring(false)
    }
  }

  const previewRestore = async (): Promise<void> => {
    setRestoring(true)
    setNotice(null)
    try {
      const response = await restoreBackup(restoreGroup, restoreStamp, false)
      setPlan(response.plan ?? null)
    } catch (error) {
      setNotice({ kind: 'error', text: error.message })
    } finally {
      setRestoring(false)
    }
  }

  const confirmRestore = async (): Promise<void> => {
    setRestoring(true)
    setNotice(null)
    try {
      const response = await restoreBackup(restoreGroup, restoreStamp, true)
      setPlan(null)
      setNotice({ kind: 'ok', text: `${t.restoreApplied(response.applied ?? 0)}${(response.skipped?.length ?? 0) > 0 ? ` ${t.restoreSkipped(response.skipped?.length ?? 0)}` : ''}` })
      await refreshStatus()
    } catch (error) {
      setNotice({ kind: 'error', text: error.message })
    } finally {
      setRestoring(false)
    }
  }

  const connectSmbShare = async (): Promise<void> => {
    setNotice(null)
    try {
      await connectSmb(config.root, secretValue('smbUser'), secretValue('smbPassword'))
      setNotice({ kind: 'ok', text: t.testOk })
    } catch (error) {
      setNotice({ kind: 'error', text: error.message })
    }
  }

  const progress = status?.progress ?? null
  const phaseLabel = progress === null ? '' : t[`phase${progress.phase[0]!.toUpperCase()}${progress.phase.slice(1)}` as keyof BackupCopy]
  const history = status?.history ?? []

  return (
    <div className="ebk-root">
      <p className="ebk-intro">{t.intro}</p>
      {!engineReady ? <p className="ebk-error">{t.engineMissing}</p> : null}
      {notice !== null && notice.text !== '' ? (
        <p className={notice.kind === 'ok' ? 'ebk-ok' : 'ebk-error'}>{notice.text}</p>
      ) : null}

      <section className="ebk-card">
        <div className="ebk-card-head">
          <span>{t.destinationTitle}</span>
          <span className="ebk-actions">
            <button type="button" className="ebk-btn" disabled={testing} onClick={() => void test()}>{testing ? t.testing : t.test}</button>
            <button type="button" className="ebk-btn ebk-btn-primary" disabled={saving} onClick={() => void save()}>{saving ? t.saving : t.save}</button>
          </span>
        </div>
        <div className="ebk-row">
          <div className="ebk-field">
            <label>{t.protocol}</label>
            <select
              className="ebk-select"
              value={config.protocol}
              onChange={event => patch({ protocol: event.target.value as BackupConfig['protocol'] })}
            >
              <option value="webdav">{t.protocolWebdav}</option>
              <option value="s3">{t.protocolS3}</option>
              <option value="smb">{t.protocolSmb}</option>
            </select>
          </div>
          <div className="ebk-field">
            <label>{t.remoteDir}</label>
            <input className="ebk-input" placeholder={t.remoteDirPlaceholder} value={config.remoteDir}
              onChange={event => patch({ remoteDir: event.target.value })} />
          </div>
        </div>
        {config.protocol === 'webdav' ? (
          <>
            <div className="ebk-field">
              <label>{t.endpoint}</label>
              <input className="ebk-input" placeholder={t.endpointPlaceholder} value={config.endpoint}
                onChange={event => patch({ endpoint: event.target.value })} />
            </div>
            <div className="ebk-grid">
              <div className="ebk-field">
                <label>{t.username}</label>
                <input className="ebk-input" value={config.username} onChange={event => patch({ username: event.target.value })} />
              </div>
              <div className="ebk-field">
                <label>{t.password}{secrets.webdavPassword ? ` · ${t.passwordSaved}` : ''}</label>
                <input className="ebk-input" type="password" value={secretValue('webdavPassword')}
                  onChange={event => setSecretInputs({ ...secretInputs, webdavPassword: event.target.value })} />
              </div>
            </div>
          </>
        ) : null}
        {config.protocol === 's3' ? (
          <div className="ebk-grid">
            <div className="ebk-field">
              <label>{t.s3Endpoint}</label>
              <input className="ebk-input" value={config.endpoint} onChange={event => patch({ endpoint: event.target.value })} />
            </div>
            <div className="ebk-field">
              <label>{t.s3Region}</label>
              <input className="ebk-input" value={config.region} onChange={event => patch({ region: event.target.value })} />
            </div>
            <div className="ebk-field">
              <label>{t.s3Bucket}</label>
              <input className="ebk-input" value={config.bucket} onChange={event => patch({ bucket: event.target.value })} />
            </div>
            <div className="ebk-field">
              <label>{'\u00a0'}</label>
              <label className="ebk-check">
                <input type="checkbox" checked={config.pathStyle} onChange={event => patch({ pathStyle: event.target.checked })} />
                <span className="ebk-check-hint">{t.s3PathStyle}</span>
              </label>
            </div>
            <div className="ebk-field">
              <label>{t.s3AccessKeyId}{secrets.s3Keys ? ` · ${t.passwordSaved}` : ''}</label>
              <input className="ebk-input" type="password" value={secretValue('s3AccessKeyId')}
                onChange={event => setSecretInputs({ ...secretInputs, s3AccessKeyId: event.target.value })} />
            </div>
            <div className="ebk-field">
              <label>{t.s3SecretAccessKey}</label>
              <input className="ebk-input" type="password" value={secretValue('s3SecretAccessKey')}
                onChange={event => setSecretInputs({ ...secretInputs, s3SecretAccessKey: event.target.value })} />
            </div>
          </div>
        ) : null}
        {config.protocol === 'smb' ? (
          <>
            <div className="ebk-field">
              <label>{t.smbRoot}</label>
              <input className="ebk-input" placeholder={t.smbRootPlaceholder} value={config.root}
                onChange={event => patch({ root: event.target.value })} />
            </div>
            <div className="ebk-grid">
              <div className="ebk-field">
                <label>{t.smbUser}</label>
                <input className="ebk-input" value={secretValue('smbUser')}
                  onChange={event => setSecretInputs({ ...secretInputs, smbUser: event.target.value })} />
              </div>
              <div className="ebk-field">
                <label>{t.smbPassword}</label>
                <input className="ebk-input" type="password" value={secretValue('smbPassword')}
                  onChange={event => setSecretInputs({ ...secretInputs, smbPassword: event.target.value })} />
              </div>
            </div>
            <div className="ebk-actions">
              <button type="button" className="ebk-btn" onClick={() => void connectSmbShare()}>{t.smbConnect}</button>
            </div>
          </>
        ) : null}
      </section>

      <section className="ebk-card">
        <div className="ebk-card-head"><span>{t.scopeTitle}</span></div>
        {GROUPS.map(group => (
          <label key={group.id} className="ebk-check">
            <input type="checkbox" checked={config.groups[group.id]}
              onChange={event => patch({ groups: { ...config.groups, [group.id]: event.target.checked } })} />
            <span className="ebk-check-main">
              <span>{t[group.title]}</span>
              <span className="ebk-check-hint">{t[group.hint]}</span>
            </span>
          </label>
        ))}
      </section>

      <section className="ebk-card">
        <div className="ebk-card-head"><span>{t.encryptionTitle}</span></div>
        <p className="ebk-muted" style={{ margin: 0 }}>{t.encryptionHint}</p>
        <label className="ebk-check">
          <input type="checkbox" checked={config.encryption.enabled}
            onChange={event => patch({ encryption: { enabled: event.target.checked } })} />
          <span className="ebk-check-main"><span>{t.encryptionOn}</span></span>
        </label>
        {config.encryption.enabled ? (
          <div className="ebk-field">
            <label>{t.passphrase}{secrets.passphrase ? ` · ${t.passwordSaved}` : ''}</label>
            <input className="ebk-input" type="password" value={secretValue('passphrase')}
              onChange={event => setSecretInputs({ ...secretInputs, passphrase: event.target.value })} />
          </div>
        ) : null}
      </section>

      <section className="ebk-card">
        <div className="ebk-card-head"><span>{t.scheduleTitle}</span></div>
        <div className="ebk-row">
          <div className="ebk-field">
            <label>{'\u00a0'}</label>
            <select className="ebk-select" value={config.schedule.mode}
              onChange={event => patch({ schedule: { ...config.schedule, mode: event.target.value as BackupConfig['schedule']['mode'] } })}>
              <option value="off">{t.scheduleOff}</option>
              <option value="daily">{t.scheduleDaily}</option>
              <option value="weekly">{t.scheduleWeekly}</option>
            </select>
          </div>
          {config.schedule.mode !== 'off' ? (
            <>
              <div className="ebk-field">
                <label>{t.scheduleAt}</label>
                <input className="ebk-input" style={{ width: 120 }} type="time" value={config.schedule.at}
                  onChange={event => patch({ schedule: { ...config.schedule, at: event.target.value } })} />
              </div>
              {config.schedule.mode === 'weekly' ? (
                <div className="ebk-field">
                  <label>{t.scheduleWeekday}</label>
                  <select className="ebk-select" value={config.schedule.weekday}
                    onChange={event => patch({ schedule: { ...config.schedule, weekday: Number(event.target.value) } })}>
                    {WEEKDAYS.map(day => <option key={day} value={day}>{t[`weekday${day}` as keyof BackupCopy]}</option>)}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="ebk-field">
            <label>{t.retention}</label>
            <span className="ebk-row" style={{ gap: 6 }}>
              <input className="ebk-input" style={{ width: 90 }} type="number" min={1} max={100} value={config.retention}
                onChange={event => patch({ retention: Number(event.target.value) })} />
              <span className="ebk-muted">{t.retentionUnit}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="ebk-card">
        <div className="ebk-card-head">
          <span>{t.runTitle}</span>
          <button type="button" className="ebk-btn ebk-btn-primary" disabled={busy} onClick={() => void run()}>{t.run}</button>
        </div>
        {progress !== null ? (
          <div className="ebk-progress">
            <span className="ebk-muted">
              {`${t.running} · ${progress.group} · ${phaseLabel} · ${progress.fileCount} · ${formatBytes(progress.totalBytes)}`}
            </span>
          </div>
        ) : null}
        <div className="ebk-history">
          <span className="ebk-muted">{t.historyTitle}</span>
          {history.length === 0 ? <span className="ebk-muted">{t.historyEmpty}</span> : history.map(entry => (
            <div key={entry.startedAt} className="ebk-history-row">
              <span className="ebk-muted">{formatTime(entry.startedAt)} · {entry.trigger === 'manual' ? t.historyManual : t.historySchedule} · {entry.groups.map(item => item.group).join(', ') || '—'}</span>
              <span className={`ebk-badge ${entry.status === 'completed' ? 'ebk-badge-ok' : 'ebk-badge-failed'}`}>
                {entry.status === 'completed' ? t.historyCompleted : t.historyFailed}
                {entry.status === 'failed' && entry.error !== undefined ? ` — ${entry.error}` : ''}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="ebk-card">
        <div className="ebk-card-head">
          <span>{t.restoreTitle}</span>
        </div>
        <div className="ebk-actions">
          <button type="button" className="ebk-btn" disabled={restoring || busy} onClick={() => void openRestore()}>{t.restorePreview}</button>
        </div>
        {remote !== null ? (
          <div className="ebk-row">
            <div className="ebk-field">
              <label>{t.restorePickGroup}</label>
              <select className="ebk-select" value={restoreGroup}
                onChange={event => {
                  const group = event.target.value as BackupGroupId
                  setRestoreGroup(group)
                  setRestoreStamp(remote.groups[group][0]?.stamp ?? '')
                  setPlan(null)
                }}>
                {GROUPS.map(group => <option key={group.id} value={group.id}>{t[group.title]}（{remote.groups[group.id].length}）</option>)}
              </select>
            </div>
            <div className="ebk-field">
              <label>{t.restorePickStamp}</label>
              <select className="ebk-select" value={restoreStamp} onChange={event => { setRestoreStamp(event.target.value); setPlan(null) }}>
                {remote.groups[restoreGroup].length === 0 ? <option value="">—</option> : remote.groups[restoreGroup].map(item => (
                  <option key={item.stamp} value={item.stamp}>{item.stamp} · {formatBytes(item.size)}</option>
                ))}
              </select>
            </div>
            <div className="ebk-actions">
              <button type="button" className="ebk-btn" disabled={restoring || restoreStamp === ''} onClick={() => void previewRestore()}>{t.restorePreview}</button>
            </div>
          </div>
        ) : null}
        {plan !== null ? (
          <div className="ebk-progress">
            <span className="ebk-muted">{t.restorePlan(plan.fileCount)} · {formatBytes(plan.bytes)}</span>
            {plan.preview.slice(0, 8).map(file => (
              <span key={file.path} className="ebk-muted" style={{ wordBreak: 'break-all' }}>{file.path} · {formatBytes(file.size)}</span>
            ))}
            <div className="ebk-actions">
              <button type="button" className="ebk-btn ebk-btn-primary" disabled={restoring} onClick={() => void confirmRestore()}>{t.restoreConfirm}</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
