// LAN handoff settings item: device identity, paired list, discovery, the
// six-digit confirmation step, and the send control. It mounts as one row in
// the shared settings dialog (`settings.general.item`) rather than a rail page,
// and draws with inline styles because the settings dialog sits outside the
// plugin's scoped stylesheets.
import { useEffect, useState } from 'react'
import {
  acceptPairing,
  getHandoffStatus,
  getHandoffWorkspaces,
  pairWithPeer,
  rejectPairing,
  sendHandoff,
  type HandoffStatus,
  type HandoffWorkspace,
} from '../lib/handoff-api'

/** Bilingual copy for the settings item. */
export const COPY = {
  en: {
    title: 'LAN project handoff',
    description: 'Send a project and its agent sessions to another device on this network, or receive one.',
    unavailable: 'LAN handoff is not enabled in this profile.',
    device: 'This device',
    paired: 'Paired devices',
    noPaired: 'No paired devices yet.',
    nearby: 'Nearby devices',
    noNearby: 'Nothing discovered yet. Keep both apps open on the same network.',
    pair: 'Pair',
    pending: 'Waiting for confirmation',
    sasHint: 'Compare this number on both screens; confirm only when they match.',
    confirm: 'Match, pair',
    reject: 'Decline',
    sendTitle: 'Send a project',
    pickWorkspace: 'Choose a project',
    pickPeer: 'Choose a device',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Handoff complete.',
    failed: 'Handoff failed',
    refresh: 'Refresh',
  },
  zh: {
    title: '局域网项目交接',
    description: '把项目连同 agent 会话发到本网络的另一台设备，或从另一台设备接收。',
    unavailable: '当前 profile 未启用局域网交接。',
    device: '本机',
    paired: '已配对设备',
    noPaired: '还没有已配对的设备。',
    nearby: '附近设备',
    noNearby: '尚未发现设备。请让两台设备都开着应用并处于同一网络。',
    pair: '配对',
    pending: '等待确认',
    sasHint: '请核对两台屏幕上是否显示同一串数字；一致才点确认。',
    confirm: '一致，配对',
    reject: '拒绝',
    sendTitle: '发送项目',
    pickWorkspace: '选择项目',
    pickPeer: '选择设备',
    send: '发送',
    sending: '发送中…',
    sent: '交接完成。',
    failed: '交接失败',
    refresh: '刷新',
  },
} as const

export type HandoffCopy = { [K in keyof typeof COPY.en]: string }

interface HandoffSettingsProps {
  t: (key: keyof HandoffCopy) => string
}

const card = {
  border: '1px solid var(--dsh-border, rgba(0,0,0,0.12))',
  borderRadius: 12,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
  maxWidth: 560,
}

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
const muted = { opacity: 0.62, fontSize: 12 }
const sasStyle = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 22, letterSpacing: 4 }
const button = {
  border: '1px solid rgba(0,0,0,0.18)',
  background: 'transparent',
  borderRadius: 8,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 13,
}

/**
 * Render the LAN handoff settings item.
 * @param props - the bound copy function.
 * @returns the settings row.
 */
export default function HandoffSettings({ t }: HandoffSettingsProps) {
  const [status, setStatus] = useState<HandoffStatus | undefined>(undefined)
  const [workspaces, setWorkspaces] = useState<HandoffWorkspace[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [workspacePath, setWorkspacePath] = useState('')
  const [peerId, setPeerId] = useState('')
  const [outcome, setOutcome] = useState('')

  const refresh = async (): Promise<void> => {
    try {
      const next = await getHandoffStatus()
      setStatus(next)
      if (next.available) {
        const listing = await getHandoffWorkspaces()
        setWorkspaces(listing.workspaces)
        setWorkspacePath(current => current || listing.workspaces[0]?.path || '')
        setPeerId(current => current || next.paired[0]?.id || '')
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, 3000)
    return () => { clearInterval(timer) }
  }, [])

  const run = async (action: () => Promise<unknown>, success: string): Promise<void> => {
    setBusy(true)
    setError('')
    setOutcome('')
    try {
      await action()
      setOutcome(success)
      await refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  if (status === undefined) {
    return <div style={card}><div style={muted}>{error || '…'}</div></div>
  }

  return (
    <div style={card}>
      <div>
        <div style={{ fontWeight: 600 }}>{t('title')}</div>
        <div style={muted}>{t('description')}</div>
      </div>
      {!status.available && <div style={muted}>{status.reason ?? t('unavailable')}</div>}
      {status.available && status.device && (
        <div style={rowStyle}>
          <span style={muted}>{t('device')}</span>
          <span>
            {status.device.name} · <code>{status.device.id.slice(0, 10)}</code> · :{status.device.port}
          </span>
          <button style={button} disabled={busy} onClick={() => { void refresh() }}>{t('refresh')}</button>
        </div>
      )}

      {status.available && (
        <div>
          <div style={muted}>{t('paired')}</div>
          {status.paired.length === 0
            ? <div style={muted}>{t('noPaired')}</div>
            : status.paired.map(peer => (
              <div key={peer.id} style={rowStyle}>
                <span>{peer.name} <span style={muted}>({peer.platform})</span></span>
                <span style={muted}><code>{peer.id.slice(0, 10)}</code></span>
              </div>
            ))}
        </div>
      )}

      {status.available && (
        <div>
          <div style={muted}>{t('nearby')}</div>
          {status.discovered.length === 0
            ? <div style={muted}>{t('noNearby')}</div>
            : status.discovered.map(peer => (
              <div key={peer.id} style={rowStyle}>
                <span>{peer.name} <span style={muted}>({peer.platform})</span></span>
                <button
                  style={button}
                  disabled={busy || status.paired.some(paired => paired.id === peer.id)}
                  onClick={() => { void run(() => pairWithPeer(peer.id), '') }}
                >{t('pair')}</button>
              </div>
            ))}
        </div>
      )}

      {status.available && status.pending.length > 0 && (
        <div>
          <div style={muted}>{t('pending')}</div>
          {status.pending.map(pending => (
            <div key={pending.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
              <div style={rowStyle}>
                <span>{pending.peer.name} <span style={muted}>({pending.peer.platform})</span></span>
                <span style={sasStyle}>{pending.sas}</span>
              </div>
              <div style={muted}>{t('sasHint')}</div>
              <div style={rowStyle}>
                <button style={button} disabled={busy}
                  onClick={() => { void run(() => acceptPairing(pending.id), '') }}>{t('confirm')}</button>
                <button style={button} disabled={busy}
                  onClick={() => { void run(() => rejectPairing(pending.id), '') }}>{t('reject')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {status.available && (
        <div>
          <div style={muted}>{t('sendTitle')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={workspacePath} onChange={event => { setWorkspacePath(event.target.value) }}>
              {workspaces.length === 0 && <option value="">{t('pickWorkspace')}</option>}
              {workspaces.map(workspace => (
                <option key={workspace.path} value={workspace.path}>{workspace.title}</option>
              ))}
            </select>
            <select value={peerId} onChange={event => { setPeerId(event.target.value) }}>
              {status.paired.length === 0 && <option value="">{t('pickPeer')}</option>}
              {status.paired.map(peer => (
                <option key={peer.id} value={peer.id}>{peer.name}</option>
              ))}
            </select>
            <button
              style={button}
              disabled={busy || workspacePath === '' || peerId === ''}
              onClick={() => {
                void run(() => sendHandoff(peerId, workspacePath), t('sent'))
              }}
            >{busy ? t('sending') : t('send')}</button>
          </div>
          {status.last && (
            <div style={muted}>
              {status.last.ok ? t('sent') : `${t('failed')}: ${status.last.detail}`}
            </div>
          )}
        </div>
      )}

      {outcome !== '' && <div style={muted}>{outcome}</div>}
      {error !== '' && <div style={{ ...muted, color: 'crimson' }}>{error}</div>}
    </div>
  )
}
