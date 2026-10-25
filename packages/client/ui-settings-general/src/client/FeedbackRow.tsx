/** General Settings feedback entry linking to the product repository's issue tracker. */
import { IconPaperPlaneOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './FeedbackRow.module.css'

/** Easel-dsh public repository issue tracker. */
const ISSUES_URL = 'https://github.com/laochenfei233/easel-dsh/issues'

/**
 * Render the feedback entry that opens the repository issue tracker in a new tab.
 * @param props - runtime share and localized copy.
 * @returns the General Settings feedback row.
 */
export function FeedbackRow({ t }: PropsRuntime<'settings.general.item'> & PropsLocale<'settings'>) {
  return <a className={css.row} href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
    {t('general.feedback')}
    <IconPaperPlaneOutlineMedium size={16} />
  </a>
}
