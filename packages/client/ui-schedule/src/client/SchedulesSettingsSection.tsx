/** Settings section that keeps the schedules page reachable without a rail entry. */
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import clsx from 'clsx'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SchedulesSettingsSection.module.css'

/** The section's one injected action. */
export interface SchedulesSettingsInjected {
  /** Select the schedules main panel; the caller closes the settings panel separately. */
  selectPanel: () => void
}

/** Root-scoped settings-section props for this section. */
export type SchedulesSettingsSectionProps =
  PropsRuntime<'settings.section'> & PropsLocale<'schedule.manager'> & InjectFace<SchedulesSettingsInjected>

/**
 * Render the schedules settings section.
 * @param props - the shell's close action, this page's locale, and the inject face.
 * @returns the section content: a hint plus the row that opens the main panel.
 */
export function SchedulesSettingsSection({ close, selectPanel, t }: SchedulesSettingsSectionProps) {
  return (
    <section className={css.body} aria-label={t('title')}>
      <p>{t('settings.hint')}</p>
      <Button
        type="button"
        className={clsx(css.open)}
        onClick={() => {
          selectPanel()
          close()
        }}
      >
        {t('settings.open')}
      </Button>
    </section>
  )
}
