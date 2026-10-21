// @vitest-environment jsdom
/** The schedules settings section: the page's only entry point when its rail icon is claimed away. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { SchedulesSettingsSection, type SchedulesSettingsSectionProps } from '../src/client/SchedulesSettingsSection.tsx'
import { en, zh } from '../src/client/task-manager-locales.ts'

afterEach(cleanup)

function unusedHook(): never {
  throw new Error('This section does not read global slot sources')
}

/** Render the section with plain stubs for every framework seat it does not read. */
function view(overrides: Partial<SchedulesSettingsSectionProps> = {}): SchedulesSettingsSectionProps {
  const props: SchedulesSettingsSectionProps = {
    close: vi.fn(),
    selectPanel: vi.fn(),
    usePanelInfo: unusedHook,
    useRemoteAccess: unusedHook,
    useSessionAccess: unusedHook,
    useSessions: unusedHook,
    useSessionStatus: unusedHook,
    useSessionRetainInfo: unusedHook,
    useWorkspaceAccess: unusedHook,
    useWorkspaces: unusedHook,
    useResource: unusedHook,
    t: makeTranslate(en),
    ...overrides,
  }
  render(<SchedulesSettingsSection {...props} />)
  return props
}

describe('schedules settings section', () => {
  it('renders its hint under the localized section title', () => {
    const props = view()
    const section = document.querySelector('section')
    expect(section?.getAttribute('aria-label')).toBe(en.title)
    expect(screen.getByText(en['settings.hint'])).toBeTruthy()
    expect(props.close).not.toHaveBeenCalled()
  })

  it('selects the main panel before closing settings, on the single row action', () => {
    const selectPanel = vi.fn()
    const close = vi.fn()
    view({ selectPanel, close })
    fireEvent.click(screen.getByRole('button', { name: en['settings.open'] }))
    expect(selectPanel).toHaveBeenCalledExactlyOnceWith()
    expect(close).toHaveBeenCalledExactlyOnceWith()
  })

  it('localizes hint and action through the same dictionary', () => {
    view({ t: makeTranslate(zh) })
    expect(screen.getByText(zh['settings.hint'])).toBeTruthy()
    expect(screen.getByRole('button', { name: zh['settings.open'] })).toBeTruthy()
  })
})
