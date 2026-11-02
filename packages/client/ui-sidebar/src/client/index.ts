/** Registers the sidebar shell and global panel navigation. */
import type {} from '@deepseek-ai/dsh-client-product-analytics/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session root standard-props merge.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SidebarPanelMetadata, SidebarRootInjected } from './contract/slots.ts'
import { createPanelPins } from './panel-pins.ts'
import { HeaderLeadingControls } from './HeaderLeadingControls.tsx'
import { SidebarRoot } from './SidebarRoot.tsx'
import { en, ja, es, fr, de, ru, pt, zh, type SidebarKey } from './locales.ts'

export type {
  SidebarBrandMarkOwnerProps, SidebarBrandNameOwnerProps, SidebarFooterActionOwnerProps,
  SidebarPanelActionEntry, SidebarPanelActionsOwnerProps, SidebarPanelIconOwnerProps, SidebarPanelMetadata,
  SidebarRootComponentProps, SidebarRootInjected, SidebarSectionOwnerProps, SidebarSettingsOwnerProps,
} from './contract/slots.ts'
export type { SidebarKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar controls and global panel copy. */
    sidebar: SidebarKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'sidebar'

interface WorkspaceNavigation {
  startSession(workspaceId?: Parameters<SidebarRootInjected['startSession']>[0]): void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Root-scoped nav-entry registry for panel visibility challenges. */
    uiSidebarPanels: SidebarPanelService
  }
}

/**
 * Deployment-side picture: which global panel ids another plugin hides from
 * the sidebar icon rail. The panel itself stays registered and reachable
 * (selectPanel, layout.filters) — only the rail row disappears.
 */
export interface SidebarPanelService {
  /**
   * Hide one global panel id's icon row.
   * @param id - the panel id (the same value as the list registration's id).
   * @returns the disposer; hiding stops when the returned disposer runs.
   */
  hidden(id: MainPanelId): () => void
}

/** Services required by the sidebar plugin. */
export const inject = ['slots', 'layout', 'uiWorkspace', 'locale', 'shortcuts']

/** Registers the sidebar shell and its service callbacks.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const workspaceNavigation = ctx.get('uiWorkspace') as unknown as WorkspaceNavigation
  const hiddenPanels = new Set<MainPanelId>()
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-sidebar: dictionaries')
  const panels = createSnapshotStore<readonly SidebarPanelMetadata[]>([])
  const syncPanels = (): void => {
    const next = ctx.slots.entriesOfSlot('sidebar.panellist').map(({ options }) => {
      // The list registration requires an id; StoredEntry erases the slot kind.
      const id = options.id as MainPanelId
      return { id, order: options.order ?? 0, label: resolveSlotLabel(options.label) ?? id }
    }).filter(panel => !hiddenPanels.has(panel.id)).sort((a, b) => a.order - b.order)
    const previous = panels.getSnapshot()
    if (previous.length === next.length && previous.every((panel, index) => {
      const candidate = next[index] as SidebarPanelMetadata
      return panel.id === candidate.id && panel.order === candidate.order && panel.label === candidate.label
    })) return
    panels.set(next)
  }
  ctx.effect(() => ctx.slots.subscribe('sidebar.panellist', syncPanels), 'ui-sidebar: panel entries')
  ctx.effect(() => ctx.locale.subscribe(syncPanels), 'ui-sidebar: panel labels')
  ctx.effect(() => ctx.reflect.provide('uiSidebarPanels', {
    // Hidden-nav declarations are the caller fiber's effect: registering under
    // ctx.effect means panel entry collapse or plugin removal removes the hide
    // with it and reruns syncPanels through the returned disposer chain.
    hidden(id: MainPanelId): () => void {
      if (hiddenPanels.has(id)) {
        ctx.logger?.warn?.(`ui-sidebar: panel "${id}" hidden by a second registrant; keeping the first`)
        return () => {}
      }
      hiddenPanels.add(id)
      syncPanels()
      return () => {
        if (!hiddenPanels.has(id)) return
        hiddenPanels.delete(id)
        syncPanels()
      }
    },
  }), 'ui-sidebar: panel visibility service')
  const panelPins = createPanelPins()
  const entryActions = {
    getSnapshot: () => ctx.slots.entriesOfSlot('sidebar.panellist.actions').length > 0,
    subscribe: (listener: () => void) => ctx.slots.subscribe('sidebar.panellist.actions', listener),
  }

  const injectProps = (): SidebarRootInjected => ({
    // The shell's New Session button rides the Workspace UI's shared action
    // (current Session Workspace, then recent Workspace).
    startSession: (workspaceId) => { workspaceNavigation.startSession(workspaceId) },
    toggleSidebar: () => { ctx.layout.toggleSidebar() },
    selectPanel: (id) => { ctx.layout.selectPanel(id) },
    setPinned: panelPins.setPinned,
    trackEntryClick: (attributes) => { ctx.get('productAnalytics')?.track('sidebar_menu_click', attributes) },
    hooks: { panels, shortcuts: ctx.shortcuts.catalog, entryPins: panelPins.unpinned, entryActions },
  })
  ctx.slots.inject('sidebar', () => ctx.slots.register({
    name: 'sidebar',
    locale: NS,
    children: {
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      'sidebar.toggle.badge': { kind: 'single', scope: 'root' },
      'sidebar.panellist': { kind: 'list', scope: 'root' },
      'sidebar.panellist.actions': { kind: 'list', scope: 'root' },
      'sidebar.workspaces': { kind: 'single', scope: 'root' },
      'sidebar.settings': { kind: 'single', scope: 'root' },
      'sidebar.footer.action': { kind: 'list', scope: 'root' },
    },
    inject: injectProps,
  }, SidebarRoot))
  // macOS desktop hides the collapsed sidebar entirely, so the open/New
  // Session controls move into the frame's window-chrome seat beside the
  // traffic lights; the occupant reuses the shell's injected actions, and
  // the AppFrame mounts the seat only while the column is fully hidden.
  ctx.slots.inject('shell.leading', () => ctx.slots.register({
    name: 'shell.leading',
    locale: NS,
    inject: injectProps,
  }, HeaderLeadingControls))
  syncPanels()
}
