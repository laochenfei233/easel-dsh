// Backup settings section: its own entry in the settings dialog sidebar, with
// the panel as that section's page. Mirrors the handoff section's shape — the
// component draws inside the shared settings panel, so it injects one
// prefixed stylesheet instead of relying on the plugin's `.easel-scope` styles.
import BackupSettings, { BACKUP_STYLES } from '../components/BackupSettings'
import { BACKUP_COPY } from '../locales/backup'

const NS = 'easel.backup'
const STYLE_ID = 'easel-backup-settings-styles'

export const plugin = {
  name: 'easel-backup-settings',
  inject: ['slots', 'locale'],
  apply(ctx: any) {
    ctx.effect(() => ctx.locale.register(NS, BACKUP_COPY), 'easel: backup dictionaries')
    ctx.effect(() => {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = BACKUP_STYLES
      document.head.append(style)
      return () => {
        style.remove()
      }
    }, 'easel: backup styles')
    const t = ctx.locale.bind(NS)
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'easel-backup',
      order: 70,
      locale: NS,
      label: () => t('nav'),
      inject: () => ({ t }),
    }, BackupSettings))
  },
}
