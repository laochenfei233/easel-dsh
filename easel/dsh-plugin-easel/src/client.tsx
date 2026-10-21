// Client half core: the Easel workbench shell.
//
// Everything here is infrastructure shared by every view — the scoped style
// sheet, the rail dictionaries, the shell bridge (persona state, navigation,
// topic hand-off, task/workspace adapters) and the admin rail hygiene. Each
// sidebar feature is its own client plugin under `src/features/*`, mounted
// through `ctx.plugin` below: a feature owns its page slot and rail entry, so
// one failing or disabled feature cannot take the workbench down.
//
// The module wrapper (`window.__ModuleLoader__.load` with a `require` that
// resolves the host's platform seed) is added by build.mjs around this
// module's default export — do not wrap it here again.
import { EASEL_CSS } from './generated/easel-css'
import { createShellBridge } from './lib/shell'
import { CLIENT_PLUGINS, FEATURES } from './features'

const NS = 'easel.panel'
const STYLE_ID = 'dsh-plugin-easel-style'

// The ported pages style themselves with Easel's global classes. The build
// scopes those sheets under .easel-scope and rewrites the dark palette to key
// off dsh's own body[data-ds-dark-theme], so the pages follow the host theme.
const STYLES = EASEL_CSS

const COPY = {
  zh: Object.fromEntries(FEATURES.map((feature) => [feature.view, feature.labels.zh])),
  en: Object.fromEntries(FEATURES.map((feature) => [feature.view, feature.labels.en])),
}

// The module wrapper (`window.__ModuleLoader__.load` with a `require` that
// resolves the host's platform seed) is added by build.mjs around this
// module's default export — do not wrap it here again.
export default {
  inject: ['slots', 'locale', 'uiSidebarPanels', 'sessions', 'uiWorkspace', 'remote', 'remote.session'],
  apply(ctx: any) {
    ctx.effect(() => ctx.locale.register(NS, COPY), 'easel: rail dictionaries')
    ctx.effect(() => {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = STYLES
      document.head.append(style)
      return () => style.remove()
    }, 'easel: workbench styles')
    // The sidebar rail belongs to Easel's navigation; dsh's own global panels
    // keep their pages (page keys stay registered) but leave the rail.
    // `plugins` is handled by disabling that row in cordis.patch.yml;
    // `schedules` is hidden here so its reminder surfaces stay active.
    ctx.effect(() => ctx.uiSidebarPanels.hidden('schedules'), 'easel: hide schedules rail icon')

    const t = ctx.locale.bind(NS)
    // The bridge is the one service feature plugins depend on. It owns the
    // shell store and the dsh adapters (sessions/workspaces/tasks).
    ctx.provide('easelShell', createShellBridge(ctx, t))

    for (const plugin of CLIENT_PLUGINS) ctx.plugin(plugin)
  },
}
