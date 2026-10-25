// EASEL-DIVERGENCE(easel-scheduled-tasks): 定时任务 view — its own client plugin.
// The core plugin owns the shell bridge (persona state, navigation, topic
// hand-off, task adapters); this module contributes its page slot and rail
// entry, plus the faces the page needs beyond it: the session/workspace list
// projection for the target-session picker and the engine's schedule/changed
// catalog events. So one failing feature cannot take the workbench down.
import type { PageProps } from '../lib/shell'
import { IconClock } from '../components/icons'
import SchedulesPage from '../components/SchedulesPage'
import { pageKey } from '../lib/shell'

export const view = 'schedules'
export const order = 34
export const labels = { zh: '定时任务', en: 'Schedule' }
export const Icon = IconClock
export const Component = SchedulesPage

export const plugin = {
  name: 'easel-view-schedules',
  inject: ['slots', 'easelShell', 'sessions', 'workspaces', 'remote'],
  apply(ctx: any) {
    const { useShellProps, t } = ctx.easelShell
    ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: pageKey(view),
      inject: () => ({
        sessions: ctx.sessions,
        workspaces: ctx.workspaces,
        subscribeChanged: (listener: () => void) => ctx.remote.$on('schedule/changed', listener),
      }),
    }, function EaselPage(injected: Record<string, unknown>) {
      const props: PageProps = useShellProps()
      // The scoped stylesheets only match under .easel-scope.
      return <div className="easel-scope"><Component {...props} {...injected} /></div>
    }))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist',
      id: pageKey(view),
      order,
      locale: 'easel.panel',
      label: () => t(view),
    }, function EaselRailIcon({ size }: { size?: number }) {
      return <Icon size={size} />
    }))
  },
}
