// EASEL-DIVERGENCE(easel-view-split): 内容日历 view — its own client plugin.
// The core plugin owns the shell bridge (persona state, navigation, topic
// hand-off, task adapters); this module only contributes its page slot and its
// rail entry, so the feature can fail or be unmounted on its own.
import type { PageProps } from '../lib/shell'
import { IconCalendar } from '../components/icons'
import CalendarPage from '../components/CalendarPage'
import { pageKey } from '../lib/shell'

export const view = 'calendar'
export const order = 33
export const labels = { zh: '内容日历', en: 'Calendar' }
export const Icon = IconCalendar
export const Component = CalendarPage

export const plugin = {
  name: 'easel-view-calendar',
  inject: ['slots', 'easelShell'],
  apply(ctx: any) {
    const { useShellProps, t } = ctx.easelShell
    ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: pageKey(view),
      inject: () => ({}),
    }, function EaselPage() {
      const props: PageProps = useShellProps()
      // The scoped stylesheets only match under .easel-scope.
      return <div className="easel-scope"><Component {...props} /></div>
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
