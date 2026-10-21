// Multi-persona browser for the 画像 page.
//
// Easel's original UX selects one persona in its sidebar and the profile page
// edits just that one; inside dsh there is no Easel sidebar, so this view
// shows ALL account personas in an inset grouped list (通用模式 first) and
// renders the selected persona's profile beside it. Switching here also
// switches the shell persona the other ported pages consume.
import { useEffect, useState } from 'react'
import ProfilePage from './ProfilePage'
import OnboardingWizard from './OnboardingWizard'
import type { PageProps } from '../nav'

export default function PersonaBrowser({ persona, personas, onPersonaChange, onDeleted, onRefresh }: PageProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  // Agent sessions create/rename persona directories behind this page's back;
  // the shell list is a boot-time snapshot, so re-read it on every mount.
  useEffect(() => { onRefresh?.() }, [onRefresh])

  const handleDeleted = (name: string) => {
    onDeleted()
    if (name === persona) onPersonaChange('')
  }

  return (
    <div className="persona-browser">
      <aside className="persona-list">
        <div className="persona-list-head">
          <span className="persona-list-title">账号画像</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" title="重新读取画像目录（agent 会话可能建过/改名）" onClick={() => onRefresh?.()}>⟳</button>
            <button className="btn btn-sm" onClick={() => setWizardOpen(true)}>+ 新建画像</button>
          </div>
        </div>
        <div className="persona-groups">
          <button
            className={`persona-row ${persona === '' ? 'active' : ''}`}
            onClick={() => onPersonaChange('')}
          >
            <span className="persona-row-name">通用模式</span>
            <span className="persona-row-desc">不指定画像，各页面按通用方式生成</span>
          </button>
          {personas.map((p) => (
            <button
              key={p.name}
              className={`persona-row ${persona === p.name ? 'active' : ''}`}
              onClick={() => onPersonaChange(p.name)}
              title={p.description}
            >
              <span className="persona-row-name">{p.name}</span>
              {p.description && <span className="persona-row-desc">{p.description}</span>}
            </button>
          ))}
          {personas.length === 0 && (
            <div className="persona-row persona-row-static">
              <span className="persona-row-desc">还没有账号画像——点右上「+ 新建画像」创建第一个。</span>
            </div>
          )}
        </div>
      </aside>
      <div className="persona-detail">
        <ProfilePage
          persona={persona}
          onNewProfile={() => setWizardOpen(true)}
          onDeleted={handleDeleted}
        />
      </div>
      {wizardOpen && (
        <OnboardingWizard
          onClose={() => setWizardOpen(false)}
          onCreated={(name: string) => {
            setWizardOpen(false)
            onDeleted()
            onPersonaChange(name)
          }}
        />
      )}
    </div>
  )
}
