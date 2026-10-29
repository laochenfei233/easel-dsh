// The composer remains in ConversationRoot so switching out of the blank-draft
// phase does not remount its textarea.

import { useEffect, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  EaselMark, IconChevronDownOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path'
import type { ConversationContentProps } from '../contract/slots.ts'
import css from './HeroShell.module.css'

/** The owner's locale seat type, passed to hero chrome as a plain prop. */
type HeroTranslate = ConversationContentProps['t']

/** How often the hero re-reads the clock so a long-lived window changes greeting. */
const GREETING_REFRESH_MS = 60_000

/** The day-period buckets the hero greeting names. */
export type HeroGreetingPeriod = 'morning' | 'noon' | 'afternoon' | 'evening'

const GREETING_KEYS = {
  morning: 'hero.greeting.morning',
  noon: 'hero.greeting.noon',
  afternoon: 'hero.greeting.afternoon',
  evening: 'hero.greeting.evening',
} as const satisfies Record<HeroGreetingPeriod, string>

/**
 * Bucket a local clock reading into the hero's greeting period: 05–11
 * morning, 11–13 noon, 13–18 afternoon, otherwise evening.
 * @param now - wall-clock instant in the viewer's timezone.
 * @returns the greeting period for that instant.
 */
export function heroGreetingPeriod(now: Date): HeroGreetingPeriod {
  const hour = now.getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 13) return 'noon'
  if (hour >= 13 && hour < 18) return 'afternoon'
  return 'evening'
}

/**
 * Basename label for the workspace chip (the shared derivation);
 * separator-only paths echo the raw cwd.
 * @param cwd - workspace directory path (non-empty).
 * @returns chip label.
 */
export function workspaceLabel(cwd: string): string {
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

/**
 * The workspace chip (folder + label + chevron), always interactive: before
 * the first message the workspace stays switchable — picking another one
 * moves the New Session flow to that workspace's blank session. Without a
 * label the chip renders its placeholder state: closed folder + the
 * "Choose workspace" call to action.
 * @param props.label - chip label (see {@link workspaceLabel}); omitted → placeholder.
 * @param props.menuOpen - menu expansion echo.
 * @param props.onClick - menu toggle.
 * @returns the chip button element.
 */
export function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }: {
  buttonRef?: RefObject<HTMLButtonElement>
  label?: string | undefined
  menuOpen?: boolean
  onClick?: () => void
  t: HeroTranslate
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={css.workspace}
      aria-label={t('hero.chooseWorkspace')}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onClick}
    >
      {label === undefined
        ? <IconFolderCloseRegular className={css.folder} size={16} />
        : <IconFolderOpenRegular className={css.folder} size={16} />}
      <span className={css.workspaceLabel}>{label ?? t('hero.chooseWorkspace')}</span>
      <IconChevronDownOutlineRegular className={css.chevron} size={12} />
    </button>
  )
}

/** Hero chrome props. The workspace row rides the InputBar accessory hole, not here. */
export interface HeroShellProps {
  /** The owner's locale seat, passed down as a plain prop. */
  t: HeroTranslate
  /** Authorized renderer for the hero brand-mark slot. */
  renderSlot: ConversationContentProps['renderSlot']
  /** Overlay content after the stack (modals). */
  children?: ReactNode
}

/**
 * Render the hero chrome (greeting + mark; no composer, no workspace row).
 * @param props - see {@link HeroShellProps}.
 * @returns the centered hero element tree.
 */
export function HeroShell({ t, renderSlot, children }: HeroShellProps) {
  const [period, setPeriod] = useState(() => heroGreetingPeriod(new Date()))
  useEffect(() => {
    const timer = setInterval(() => {
      const next = heroGreetingPeriod(new Date())
      setPeriod(current => (current === next ? current : next))
    }, GREETING_REFRESH_MS)
    return () => { clearInterval(timer) }
  }, [])
  return (
    <div className={css.root}>
      <div className={css.stack}>
        <div className={css.headline}>
          {/* figma 34:10412: mark leading the greeting, gap 10. */}
          {renderSlot('conversation.hero.brand.mark', { size: 34, className: css.mark }, {
            fallback: <EaselMark size={34} className={css.mark} />,
          })}
          <span className={css.titleGroup}>
            {/* Own element: keeps the greeting addressable apart from the badge. */}
            <span data-testid="hero-headline">{t(GREETING_KEYS[period])}</span>
            <span className={css.previewBadge}>{t('hero.preview')}</span>
          </span>
        </div>
        <div className={css.body}>
          {/* The composer remains mounted outside this component. */}
        </div>
      </div>
      {children}
    </div>
  )
}
