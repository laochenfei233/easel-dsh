// LAN handoff settings section: its own entry in the settings dialog sidebar,
// with the panel as that section's page. The section draws inside the shared
// settings panel, so it injects one prefixed stylesheet instead of relying on
// the plugin's `.easel-scope` styles.
import HandoffSettings, { COPY, HANDOFF_STYLES } from '../components/HandoffSettings'

const NS = 'easel.handoff'
const STYLE_ID = 'easel-handoff-settings-styles'

export const plugin = {
  name: 'easel-handoff-settings',
  inject: ['slots', 'locale'],
  apply(ctx: any) {
    ctx.effect(() => ctx.locale.register(NS, COPY), 'easel: handoff dictionaries')
    ctx.effect(() => {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = HANDOFF_STYLES
      document.head.append(style)
      return () => { style.remove() }
    }, 'easel: handoff styles')
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
