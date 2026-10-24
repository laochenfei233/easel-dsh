// The sidebar feature registry: one plugin per view, plus the non-view client
// features (media previewer, app-wide context menu). Order here is the rail
// order; each plugin owns its own slot registrations.
import * as dashboard from './dashboard'
import * as trends from './trends'
import * as ideas from './ideas'
import * as calendar from './calendar'
import * as skills from './skills'
import * as outputs from './outputs'
import * as publish from './publish'
import * as accounts from './accounts'
import * as profile from './profile'
import * as breakdown from './breakdown'
import { plugin as media } from './media'
import { plugin as backup } from './backup'
import { plugin as contextMenu } from './context-menu.js'

const views = [dashboard, trends, ideas, calendar, skills, outputs, publish, accounts, profile, breakdown]

/** Rail/page descriptors, one per view (labels feed the shared dictionaries). */
export const FEATURES = views.map(module => ({
  view: module.view,
  order: module.order,
  labels: module.labels,
  plugin: module.plugin,
}))

/** Every client plugin the core mounts: the views, the media previewer, and the context menu. */
export const CLIENT_PLUGINS = [...FEATURES.map(feature => feature.plugin), media, backup, contextMenu]
