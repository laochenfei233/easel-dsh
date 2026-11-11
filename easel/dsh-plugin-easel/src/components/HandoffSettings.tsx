// LAN handoff settings section. Visual language follows the shared settings
// surfaces: 0.5px card strokes on --dsw-alias-settings-card-*, --dsw-radius-xl
// corners, 13/22 body type, and the sm/md control scale. The one deliberate
// flourish is the pairing code — tabular monospace digits, wide tracking — the
// single number both people look at before trusting a device.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acceptPairing,
  getHandoffStatus,
  getHandoffWorkspaces,
  pairWithAddress,
  pairWithPeer,
  rejectPairing,
  forgetPeer,
  sendHandoff,
  type HandoffPayload,
  type HandoffPending,
  type HandoffReceiving,
  type HandoffStatus,
  type HandoffWorkspace,
} from '../lib/handoff-api'

/** Bilingual copy for the settings section. */
export const COPY = {
  en: {
    nav: 'Air Transfer',
    intro: 'Send a project and its agent sessions to another device on this network, or receive one. Both devices stay on the same network with the app open.',
    unavailable: 'Air Transfer is not enabled in this profile.',
    device: 'This device',
    port: 'port',
    refresh: 'Refresh',
    paired: 'Paired devices',
    pairedBadge: 'Paired',
    noPaired: 'Nothing paired yet. Pair a nearby device first.',
    unpair: 'Unpair',
    unpairConfirm: 'Unpair this device? It stays visible in Nearby devices and can be paired again; sending to it needs a new pairing.',
    nearby: 'Nearby devices',
    noNearby: 'No devices found. Keep both apps open on the same network, then refresh.',
    pair: 'Pair',
    pending: 'Waiting for confirmation',
    sasHint: 'Check that both screens show this number, then confirm on each. Only pair when they match.',
    confirm: 'They match — pair',
    reject: 'Decline',
    sendTitle: 'Send a project',
    pickWorkspace: 'Choose a project',
    pickPeer: 'Choose a device',
    payloadTitle: 'Include',
    withSessions: 'Sessions (agent continuation)',
    withMaterials: 'Project materials (素材/)',
    withLibrary: 'Content library (outputs/)',
    withConfig: 'Config (.env / profiles / skills / models)',
    configHint: 'Contains API keys. Sent only when selected; model providers, the default model, and their keys merge into the receiving device’s own config on arrival.',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Handoff complete.',
    failed: 'Handoff failed',
    receiving: 'Receiving',
    receivingVerifying: 'Verifying the received files',
    receivingImporting: 'Importing sessions',
    manualTitle: 'Pair by address',
    manualHost: 'Address',
    manualPort: 'Port',
    manualHint: 'Use the address and port shown on the other device when discovery cannot find it.',
    pairByAddress: 'Pair',
    pairedIncompatible: 'This device runs an older Air Transfer protocol. Update both devices before sending.',
  },
  zh: {
    nav: '隔空传送',
    intro: '把项目连同 agent 会话发到本网络的另一台设备，或从另一台设备接收。两台设备需在同一网络并都保持应用开启。',
    unavailable: '当前 profile 未启用隔空传送。',
    device: '本机',
    port: '端口',
    refresh: '刷新',
    paired: '已配对设备',
    pairedBadge: '已配对',
    noPaired: '还没有已配对的设备，先在附近设备里配对。',
    unpair: '解除配对',
    unpairConfirm: '解除与这台设备的配对？它会继续出现在「附近设备」里，可以重新配对；再次互传前需要重新配对。',
    nearby: '附近设备',
    noNearby: '尚未发现设备。请让两台设备都开着应用并处于同一网络，然后刷新。',
    pair: '配对',
    pending: '等待确认',
    sasHint: '请核对两台屏幕显示的是同一串数字，再分别在各自设备上确认；一致才配对。',
    confirm: '一致，配对',
    reject: '拒绝',
    sendTitle: '发送项目',
    pickWorkspace: '选择项目',
    pickPeer: '选择设备',
    payloadTitle: '随包内容',
    withSessions: '会话（agent 续作上下文）',
    withMaterials: '项目素材（素材/）',
    withLibrary: '内容库（outputs/）',
    withConfig: '配置项（.env / 画像 / 技能 / 大模型）',
    configHint: '配置项含 API 密钥，只在勾选后随包发送；到达后模型列表、默认模型与密钥会合并进对方本机配置。',
    send: '发送',
    sending: '发送中…',
    sent: '交接完成。',
    failed: '交接失败',
    receiving: '接收中',
    receivingVerifying: '正在校验接收的文件',
    receivingImporting: '正在导入会话',
    manualTitle: '按地址配对',
    manualHost: '地址',
    manualPort: '端口',
    manualHint: '发现不到设备时，填入对方「本机」卡片上显示的地址和端口。',
    pairByAddress: '配对',
    pairedIncompatible: '该设备运行旧版隔空传送协议；两端都更新后才能发送。',
  },
} as const

export type HandoffCopy = { [K in keyof typeof COPY.en]: string }

/** Stylesheet injected once per client by the section plugin. */
export const HANDOFF_STYLES = `
.ehs-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.ehs-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-settings-card-fill);
}
.ehs-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}
.ehs-pending { border-color: var(--dsw-alias-state-business-primary); }
.ehs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}
.ehs-row + .ehs-row { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.ehs-row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ehs-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ehs-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-device { display: flex; flex-direction: column; gap: 2px; }
.ehs-device-name { font-size: 14px; line-height: 22px; }
.ehs-device-meta { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-device-meta code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.02em; }
.ehs-sas-block { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0 2px; text-align: center; }
.ehs-sas {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 32px;
  line-height: 40px;
  font-weight: 600;
  letter-spacing: 0.18em;
  padding-left: 0.18em;
}
.ehs-actions { display: flex; gap: 8px; justify-content: center; }
.ehs-empty { padding: 6px 0; color: var(--dsw-alias-label-secondary); }
.ehs-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-family: inherit;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--dsw-radius-sm);
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
  background: transparent;
  transition: transform 100ms ease-out, background-color 120ms ease-out;
}
.ehs-btn-md { height: 36px; padding: 0 14px; border-radius: var(--dsw-radius-md); font-size: 14px; line-height: 22px; }
.ehs-btn:active:not(:disabled) { transform: scale(0.97); }
.ehs-btn:disabled { cursor: not-allowed; opacity: 0.4; }
.ehs-btn:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.ehs-btn-primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.ehs-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.ehs-btn-outline { border: 0.5px solid var(--dsw-alias-border-l3); }
.ehs-btn-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.ehs-btn-ghost:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.ehs-chip {
  flex: none;
  padding: 1px 8px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.ehs-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.ehs-field { display: flex; flex-direction: column; gap: 4px; min-width: 160px; flex: 1; }
.ehs-field > span { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-payload { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.ehs-payload-row { display: flex; flex-wrap: wrap; gap: 4px 18px; }
.ehs-check { display: inline-flex; align-items: center; gap: 7px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; cursor: pointer; }
.ehs-check input { width: 14px; height: 14px; margin: 0; accent-color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.ehs-check input:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.ehs-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.ehs-select, .ehs-input {
  box-sizing: border-box;
  height: 32px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
}
.ehs-input { min-width: 140px; }
.ehs-select:focus-visible, .ehs-input:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ehs-receiving { border-color: var(--dsw-alias-state-business-primary); }
.ehs-progress {
  height: 4px;
  border-radius: 2px;
  background: var(--dsw-alias-border-l2);
  overflow: hidden;
}
.ehs-progress-fill {
  display: block;
  height: 100%;
  background: var(--dsw-alias-state-business-primary);
  transition: width 200ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .ehs-progress-fill { transition: none; }
}
.ehs-outcome { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.ehs-outcome[data-tone='ok'] { color: var(--dsw-alias-state-success-primary); }
.ehs-outcome[data-tone='fail'] { color: var(--dsw-alias-state-error-primary); }
.ehs-error { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px; }
@media (prefers-reduced-motion: reduce) {
  .ehs-btn { transition: none; }
  .ehs-btn:active:not(:disabled) { transform: none; }
}
`

interface HandoffSettingsProps {
  t: (key: keyof HandoffCopy) => string
}

type BusyAction = 'refresh' | 'send' | `pair:${string}` | `accept:${string}` | `reject:${string}` | `forget:${string}`

/**
 * Locale key naming one receipt phase.
 * @param phase - the phase reported by the host.
 * @returns the copy key for its label.
 */
function receivingLabel(phase: HandoffReceiving['phase']): keyof HandoffCopy {
  return phase === 'verifying' ? 'receivingVerifying' : phase === 'importing' ? 'receivingImporting' : 'receiving'
}

/**
 * Format a byte count for the progress line.
 * @param bytes - non-negative byte count.
 * @returns a short decimal size (`12.3 MB`).
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB'] as const
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit] ?? 'TB'}`
}

/**
 * Render the LAN handoff settings section.
 * @param props - the bound copy function.
 * @returns the section content.
 */
export default function HandoffSettings({ t }: HandoffSettingsProps) {
  const [status, setStatus] = useState<HandoffStatus | undefined>(undefined)
  const [workspaces, setWorkspaces] = useState<HandoffWorkspace[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<BusyAction | undefined>(undefined)
  const [workspacePath, setWorkspacePath] = useState('')
  const [peerId, setPeerId] = useState('')
  const [manualHost, setManualHost] = useState('')
  const [manualPort, setManualPort] = useState('')
  const [payload, setPayload] = useState<HandoffPayload>({ sessions: true, materials: true, library: false, config: false })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await getHandoffStatus()
      if (!mounted.current) return
      setStatus(next)
      if (next.available) {
        const listing = await getHandoffWorkspaces()
        if (!mounted.current) return
        setWorkspaces(listing.workspaces)
        setWorkspacePath(current => current !== '' && listing.workspaces.some(item => item.path === current)
          ? current
          : listing.workspaces[0]?.path ?? '')
        setPeerId(current => current !== '' && next.paired.some(item => item.id === current)
          ? current
          : next.paired[0]?.id ?? '')
      }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => {
      if (!document.hidden) void refresh()
    }, 3000)
    return () => { clearInterval(timer) }
  }, [refresh])

  const run = async (action: BusyAction, work: () => Promise<unknown>): Promise<void> => {
    setBusy(action)
    setError('')
    try {
      await work()
      await refresh()
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      if (mounted.current) setBusy(undefined)
    }
  }

  if (status === undefined) {
    return <div className="ehs-root"><p className="ehs-muted">{error || '…'}</p></div>
  }

  const pending: readonly HandoffPending[] = status.pending
  const unpaired = status.discovered.filter(peer => !status.paired.some(paired => paired.id === peer.id))
  const last = status.last ?? undefined
  const canSend = workspacePath !== '' && peerId !== ''
  const receiving = status.receiving ?? undefined
  const receivingPercent = receiving === undefined || receiving.bytesTotal <= 0
    ? 0
    : Math.min(100, Math.round((receiving.bytesDone / receiving.bytesTotal) * 100))
  const manualPortNumber = Number(manualPort)
  const canManualPair = manualHost.trim() !== ''
    && Number.isInteger(manualPortNumber)
    && manualPortNumber >= 1
    && manualPortNumber <= 65535

  return (
    <div className="ehs-root">
      <p className="ehs-intro">{t('intro')}</p>

      {status.available && receiving !== undefined && (
        <section className="ehs-card ehs-receiving" aria-live="polite">
          <div className="ehs-card-head">
            <span>{t(receivingLabel(receiving.phase))}</span>
            <span className="ehs-muted">{receiving.entriesDone}/{receiving.entriesTotal}</span>
          </div>
          <div className="ehs-device-name">{receiving.projectTitle}</div>
          <div
            className="ehs-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={receivingPercent}
          >
            <span className="ehs-progress-fill" style={{ width: `${String(receivingPercent)}%` }} />
          </div>
          <div className="ehs-muted">{formatBytes(receiving.bytesDone)} / {formatBytes(receiving.bytesTotal)} · {receivingPercent}%</div>
        </section>
      )}

      {status.available && status.device !== undefined && (
        <section className="ehs-card">
          <div className="ehs-card-head">
            <span>{t('device')}</span>
            <button
              type="button"
              className="ehs-btn ehs-btn-ghost"
              disabled={busy !== undefined}
              onClick={() => { void run('refresh', refresh) }}
            >{t('refresh')}</button>
          </div>
          <div className="ehs-device">
            <div className="ehs-device-name">{status.device.name}</div>
            <div className="ehs-device-meta">
              <code>{status.device.id.slice(0, 12)}</code>
              <span>·</span>
              <span>{t('port')} {status.device.port}</span>
            </div>
          </div>
        </section>
      )}

      {!status.available && <p className="ehs-empty">{status.reason ?? t('unavailable')}</p>}

      {status.available && pending.length > 0 && (
        <section className="ehs-card ehs-pending">
          <div className="ehs-card-head"><span>{t('pending')}</span></div>
          {pending.map(offer => (
            <div className="ehs-sas-block" key={offer.id}>
              <div>{offer.peer.name} <span className="ehs-muted">({offer.peer.platform})</span></div>
              <div className="ehs-sas" aria-label={`${offer.sas}`}>{offer.sas}</div>
              <div className="ehs-muted">{t('sasHint')}</div>
              <div className="ehs-actions">
                <button
                  type="button"
                  className="ehs-btn ehs-btn-outline"
                  disabled={busy !== undefined}
                  onClick={() => { void run(`reject:${offer.id}`, () => rejectPairing(offer.id)) }}
                >{t('reject')}</button>
                <button
                  type="button"
                  className="ehs-btn ehs-btn-primary"
                  disabled={busy !== undefined}
                  onClick={() => { void run(`accept:${offer.id}`, () => acceptPairing(offer.id)) }}
                >{t('confirm')}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {status.available && (
        <section className="ehs-card">
          <div className="ehs-card-head"><span>{t('nearby')}</span></div>
          {unpaired.length === 0
            ? <div className="ehs-empty">{t('noNearby')}</div>
            : unpaired.map(peer => (
              <div className="ehs-row" key={peer.id}>
                <div className="ehs-row-main">
                  <span className="ehs-row-title">{peer.name}</span>
                  <span className="ehs-muted">{peer.platform}{peer.compatible === false ? ' · ⚠' : ''}</span>
                </div>
                <button
                  type="button"
                  className="ehs-btn ehs-btn-outline"
                  disabled={busy !== undefined}
                  onClick={() => { void run(`pair:${peer.id}`, () => pairWithPeer(peer.id)) }}
                >{t('pair')}</button>
              </div>
            ))}
        </section>
      )}

      {status.available && (
        <section className="ehs-card">
          <div className="ehs-card-head"><span>{t('manualTitle')}</span></div>
          <div className="ehs-form">
            <label className="ehs-field">
              <span>{t('manualHost')}</span>
              <input
                className="ehs-input"
                value={manualHost}
                onChange={event => { setManualHost(event.target.value) }}
                placeholder="192.168.1.20"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="ehs-field">
              <span>{t('manualPort')}</span>
              <input
                className="ehs-input"
                value={manualPort}
                onChange={event => { setManualPort(event.target.value) }}
                placeholder="40123"
                inputMode="numeric"
              />
            </label>
            <button
              type="button"
              className="ehs-btn ehs-btn-md ehs-btn-outline"
              disabled={busy !== undefined || !canManualPair}
              onClick={() => { void run('pair:manual', () => pairWithAddress(manualHost.trim(), manualPortNumber)) }}
            >{t('pairByAddress')}</button>
          </div>
          <span className="ehs-hint">{t('manualHint')}</span>
        </section>
      )}

      {status.available && (
        <section className="ehs-card">
          <div className="ehs-card-head"><span>{t('paired')}</span></div>
          {status.paired.length === 0
            ? <div className="ehs-empty">{t('noPaired')}</div>
            : status.paired.map(peer => (
              <div className="ehs-row" key={peer.id}>
                <div className="ehs-row-main">
                  <span className="ehs-row-title">{peer.name}</span>
                  <span className="ehs-muted">{peer.platform} · {peer.id.slice(0, 8)}{peer.compatible === false ? ' · ⚠' : ''}</span>
                </div>
                <span className="ehs-chip">{t('pairedBadge')}</span>
                <button
                  type="button"
                  className="ehs-btn ehs-btn-ghost"
                  disabled={busy !== undefined}
                  onClick={() => {
                    if (!window.confirm(t('unpairConfirm'))) return
                    void run(`forget:${peer.id}`, () => forgetPeer(peer.id))
                  }}
                >{t('unpair')}</button>
              </div>
            ))}
          {status.paired.some(peer => peer.compatible === false) && (
            <span className="ehs-hint">{t('pairedIncompatible')}</span>
          )}
        </section>
      )}

      {status.available && (
        <section className="ehs-card">
          <div className="ehs-card-head"><span>{t('sendTitle')}</span></div>
          <div className="ehs-form">
            <label className="ehs-field">
              <span>{t('pickWorkspace')}</span>
              <select
                className="ehs-select"
                value={workspacePath}
                onChange={event => { setWorkspacePath(event.target.value) }}
              >
                {workspaces.length === 0 && <option value="">{t('pickWorkspace')}</option>}
                {workspaces.map(workspace => (
                  <option key={workspace.path} value={workspace.path}>{workspace.title}</option>
                ))}
              </select>
            </label>
            <label className="ehs-field">
              <span>{t('pickPeer')}</span>
              <select
                className="ehs-select"
                value={peerId}
                onChange={event => { setPeerId(event.target.value) }}
              >
                {status.paired.length === 0 && <option value="">{t('pickPeer')}</option>}
                {status.paired.map(peer => (
                  <option key={peer.id} value={peer.id}>{peer.name}{peer.compatible === false ? ' ⚠' : ''}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="ehs-btn ehs-btn-md ehs-btn-primary"
              disabled={busy !== undefined || !canSend}
              onClick={() => { void run('send', () => sendHandoff(peerId, workspacePath, payload)) }}
            >{busy === 'send' ? t('sending') : t('send')}</button>
            <div className="ehs-payload">
              <span className="ehs-hint">{t('payloadTitle')}</span>
              <div className="ehs-payload-row">
                <label className="ehs-check">
                  <input
                    type="checkbox"
                    checked={payload.sessions}
                    onChange={event => { setPayload(current => ({ ...current, sessions: event.target.checked })) }}
                  />
                  {t('withSessions')}
                </label>
                <label className="ehs-check">
                  <input
                    type="checkbox"
                    checked={payload.materials}
                    onChange={event => { setPayload(current => ({ ...current, materials: event.target.checked })) }}
                  />
                  {t('withMaterials')}
                </label>
                <label className="ehs-check">
                  <input
                    type="checkbox"
                    checked={payload.library}
                    onChange={event => { setPayload(current => ({ ...current, library: event.target.checked })) }}
                  />
                  {t('withLibrary')}
                </label>
                <label className="ehs-check">
                  <input
                    type="checkbox"
                    checked={payload.config}
                    onChange={event => { setPayload(current => ({ ...current, config: event.target.checked })) }}
                  />
                  {t('withConfig')}
                </label>
              </div>
              {payload.config && <span className="ehs-hint">{t('configHint')}</span>}
            </div>
          </div>
          {last !== undefined && (
            <div className="ehs-outcome" data-tone={last.ok ? 'ok' : 'fail'} aria-live="polite">
              {last.ok ? t('sent') : `${t('failed')}：${last.detail}`}
            </div>
          )}
        </section>
      )}

      {error !== '' && <p className="ehs-error" role="alert">{error}</p>}
    </div>
  )
}
