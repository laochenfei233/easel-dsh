// EASEL-DIVERGENCE(easel-view-split): 账号 view — its own client plugin.
// The core plugin owns the shell bridge (persona state, navigation, topic
// hand-off, task adapters); this module only contributes its page slot and its
// rail entry, so the feature can fail or be unmounted on its own.
import type { PageProps } from '../lib/shell'
import { IconAccounts } from '../components/icons'
import AccountsPage from '../components/AccountsPage'
import { pageKey } from '../lib/shell'

export const view = 'accounts'
export const order = 37
export const labels = { zh: '账号', en: 'Accounts' }
export const Icon = IconAccounts
export const Component = AccountsPage

export const plugin = {
  name: 'easel-view-accounts',
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
