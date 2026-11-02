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
import { detectHostUpdateBridge, createUpdateStore } from './lib/hostUpdate'
import { DataRootSection, DATA_ROOT_STYLES } from './components/DataRootSection'
import { DATA_ROOT_COPY } from './locales/dataRoot'
import { AboutSection, ABOUT_STYLES } from './components/AboutSection'
import { UpdateNotice } from './components/UpdateNotice'
import { EASEL_ABOUT_COPY } from './locales/easelAbout'

const NS = 'easel.panel'
const STYLE_ID = 'dsh-plugin-easel-style'
const DATA_ROOT_STYLE_ID = 'easel-data-root-settings-styles'
const ABOUT_STYLE_ID = 'easel-about-settings-styles'

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

    // The data root is a desktop concern: the host half exposes the current
    // root and a pending migration request, and the section hides itself when
    // the shell did not provide one (web/CLI). The section styles itself with
    // the shared settings tokens, injected here beside the section.
    ctx.effect(
      () => ctx.locale.register('settings.dataRoot', DATA_ROOT_COPY),
      'easel: data root dictionaries',
    )
    ctx.effect(() => {
      const style = document.createElement('style')
      style.id = DATA_ROOT_STYLE_ID
      style.textContent = DATA_ROOT_STYLES
      document.head.append(style)
      return () => style.remove()
    }, 'easel: data root section styles')
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'data-root',
      order: 40,
      label: () => ctx.locale.bind('settings.dataRoot')('nav'),
      locale: 'settings.dataRoot',
      inject: () => ({}),
    }, DataRootSection))

    // EASEL-DIVERGENCE(easel-app-update): the About section reads the shell
    // updater through the desktop relay store; browsers and WebKit app
    // windows lack the bridge and get the desktop-only line. The same store
    // drives the update notice overlay entry.
    const update = createUpdateStore(detectHostUpdateBridge())
    ctx.effect(() => () => { update.dispose() }, 'easel: host update store lifecycle')
    ctx.effect(
      () => ctx.locale.register('settings.easelAbout', EASEL_ABOUT_COPY),
      'easel: about dictionaries',
    )
    ctx.effect(() => {
      const style = document.createElement('style')
      style.id = ABOUT_STYLE_ID
      style.textContent = ABOUT_STYLES
      document.head.append(style)
      return () => style.remove()
    }, 'easel: about styles')
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'easel.about',
      order: 90,
      label: () => ctx.locale.bind('settings.easelAbout')('nav'),
      locale: 'settings.easelAbout',
      inject: () => ({ update }),
    }, AboutSection))
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'easel.update-notice',
      locale: 'settings.easelAbout',
      inject: () => ({ update }),
    }, UpdateNotice))

    const t = ctx.locale.bind(NS)
    // The bridge is the one service feature plugins depend on. It owns the
    // shell store and the dsh adapters (sessions/workspaces/tasks).
    ctx.provide('easelShell', createShellBridge(ctx, t))

    for (const plugin of CLIENT_PLUGINS) ctx.plugin(plugin)
  },
}
