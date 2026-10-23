// LAN handoff settings section: its own entry in the settings dialog sidebar,
// with the panel as that section's page.
import HandoffSettings, { COPY } from '../components/HandoffSettings'

const NS = 'easel.handoff'

export const plugin = {
  name: 'easel-handoff-settings',
  inject: ['slots', 'locale'],
  apply(ctx: any) {
    ctx.effect(() => ctx.locale.register(NS, COPY), 'easel: handoff dictionaries')
    const t = ctx.locale.bind(NS)
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'easel-handoff',
      order: 60,
      locale: NS,
      label: () => t('nav'),
      inject: () => ({ t }),
    }, HandoffSettings))
  },
}
