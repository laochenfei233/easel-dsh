// LAN handoff settings item: not a rail view, so it contributes only one
// `settings.general.item` row plus its own locale namespace.
import HandoffSettings, { COPY } from '../components/HandoffSettings'

const NS = 'easel.handoff'

export const plugin = {
  name: 'easel-handoff-settings',
  inject: ['slots', 'locale'],
  apply(ctx: any) {
    ctx.effect(() => ctx.locale.register(NS, COPY), 'easel: handoff dictionaries')
    const t = ctx.locale.bind(NS)
    ctx.slots.inject('settings.general.item', () => ctx.slots.register({
      name: 'settings.general.item',
      id: 'easel-handoff',
      order: 95,
      inject: () => ({ t }),
    }, HandoffSettings))
  },
}
