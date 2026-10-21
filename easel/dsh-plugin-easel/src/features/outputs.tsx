// EASEL-DIVERGENCE(easel-view-split): 内容库 view — its own client plugin.
// The core plugin owns the shell bridge (persona state, navigation, topic
// hand-off, task adapters); this module only contributes its page slot and its
// rail entry, so the feature can fail or be unmounted on its own.
import type { PageProps } from '../lib/shell'
import { IconOutputs } from '../components/icons'
import OutputsPage from '../components/OutputsPage'
import { pageKey } from '../lib/shell'

export const view = 'outputs'
export const order = 35
export const labels = { zh: '内容库', en: 'Outputs' }
export const Icon = IconOutputs
export const Component = OutputsPage

export const plugin = {
  name: 'easel-view-outputs',
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
