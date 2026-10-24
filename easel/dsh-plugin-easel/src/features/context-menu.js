/**
 * EASEL-DIVERGENCE(easel-context-menu): the app's right-click surfaces.
 *
 * One document-level capture listener replaces the WebView's native menu on
 * four surfaces the workbench uses constantly — selected conversation text,
 * file-tree rows, editable fields, and hotspot-trend rows — and leaves every
 * other surface alone. The menu is plain DOM (no React tree, no portal
 * component): it must open from a capture-phase gesture and act on DOM that
 * may re-render underneath it.
 *
 * The auxiliary conversation is dsh's own new-Session path with the selected
 * text as its draft, so the Conversation UI, input, and history stay dsh's.
 */
import { captureTrendArticle, createIdea, fetchHandoffPaired, pushFileToPeer } from '../lib/api'
import {
  absolutePathFor, draftBlock, fileNameOf, isAbsolutePath, quoteBlock, relativePath, resolveSurface,
} from '../lib/context-menu-model.js'

const STYLE_ID = 'easel-context-menu-style'
const MENU_CLASS = 'easel-ctx-menu'
const ITEM_CLASS = 'easel-ctx-menu__item'
const SEPARATOR_CLASS = 'easel-ctx-menu__separator'
const HINT_CLASS = 'easel-ctx-menu__hint'
const TOAST_CLASS = 'easel-ctx-toast'

const CSS = `
.${MENU_CLASS} {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  min-width: 176px;
  max-width: 320px;
  max-height: min(420px, calc(100vh - 12px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-elevated, #ffffff));
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(15, 23, 42, 0.16));
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(12px) saturate(1.4));
  color: var(--dsw-alias-label-primary, #1f2329);
  font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: 1.35;
  user-select: none;
  -webkit-user-select: none;
}
.${ITEM_CLASS} {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 9px;
  border: 0;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.${ITEM_CLASS}:hover:not(:disabled),
.${ITEM_CLASS}:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, 0.06));
  outline: none;
}
.${ITEM_CLASS}:disabled {
  opacity: 0.45;
  cursor: default;
}
.${HINT_CLASS} {
  margin-left: auto;
  padding-left: 18px;
  color: var(--dsw-alias-label-secondary, rgba(31, 35, 41, 0.5));
  font-size: 11px;
}
.${SEPARATOR_CLASS} {
  height: 1px;
  margin: 4px 6px;
  background: var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.08));
}
.${TOAST_CLASS} {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 2147483000;
  max-width: min(70vw, 460px);
  padding: 9px 16px;
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-elevated, #ffffff));
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(15, 23, 42, 0.2));
  color: var(--dsw-alias-label-primary, #1f2329);
  font: var(--dsw-text-body-font, 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif);
  text-align: center;
  pointer-events: none;
}
.${TOAST_CLASS}--ok { color: var(--dsh-success-text, #0f9d58); }
.${TOAST_CLASS}--warn { color: var(--dsh-warning-text, #b45309); }
.${TOAST_CLASS}--error { color: var(--dsh-error-text, #dc2626); }
`

/** One menu row; separators carry no label. */
const SEPARATOR = Object.freeze({ separator: true })

/**
 * The client plugin mounted by the Easel core.
 *
 * Every service here is a dsh built-in the workbench already implies; a profile
 * without one leaves the menu waiting rather than taking the workbench down.
 */
export const plugin = {
  name: 'easel-context-menu',
  inject: [
    'sessions', 'uiSession', 'uiWorkspace', 'conversation',
    'remote', 'remote.session',
  ],
  apply(ctx) {
    ctx.effect(() => installStyles(), 'easel-context-menu: styles')
    ctx.effect(() => installListener(ctx), 'easel-context-menu: listener')
  },
}

/** Install the menu stylesheet once per page. */
function installStyles() {
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
  return () => { style.remove() }
}

/**
 * Watch every `contextmenu`, claim the three supported surfaces, and close the
 * previous menu before deciding — so a right-click anywhere also dismisses ours.
 * @param ctx - plugin context.
 * @returns disposer removing the listener and any open menu.
 */
function installListener(ctx) {
  let closeActive = null
  const close = () => {
    if (closeActive === null) return
    const active = closeActive
    closeActive = null
    active()
  }
  const onContextMenu = (event) => {
    let surface
    try {
      surface = resolveSurface(event.target, window.getSelection())
    } catch (error) {
      console.warn('easel-context-menu: surface resolution failed', error)
      return
    }
    if (surface === null) {
      close()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    close()
    try {
      closeActive = showMenu({
        x: event.clientX,
        y: event.clientY,
        items: itemsFor(ctx, surface),
        onClosed: () => { closeActive = null },
        onError: (error) => { reportError(ctx, error) },
      })
    } catch (error) {
      reportError(ctx, error)
    }
  }
  document.addEventListener('contextmenu', onContextMenu, true)
  return () => {
    document.removeEventListener('contextmenu', onContextMenu, true)
    close()
  }
}

/**
 * Build the rows for one surface. File rows may query the OS lazily; every
 * other row is synchronous.
 * @param ctx - plugin context.
 * @param surface - the classified gesture.
 * @returns the menu rows.
 */
function itemsFor(ctx, surface) {
  if (surface.kind === 'file') return fileItems(ctx, surface)
  if (surface.kind === 'trend') return trendItems(surface.trend)
  if (surface.kind === 'editable') return editableItems(surface.element)
  return [
    menuRow('复制', () => copyOrThrow(surface.text)),
    menuRow('复制 Markdown 引用', () => copyOrThrow(quoteBlock(surface.text))),
    SEPARATOR,
    menuRow('添加到当前任务', () => addToTask(ctx, surface.text), { disabled: currentInput(ctx) === undefined }),
    menuRow('在辅助对话中提问', () => askInAuxiliaryConversation(ctx, surface.text), { disabled: currentSessionId(ctx) === undefined }),
  ]
}

// ---- 热点行（spec easel-hotspot-radar D6）：抓正文入库是显式主操作，书签按钮保持轻量 ----

/**
 * Trend-row menu rows; every action is HTTP/plain-DOM so the menu does not
 * need the React tree.
 * @param {{title: string, url: string, source: string, platform: string, rank?: number, hot?: string}} trend - the row payload.
 * @returns the menu rows.
 */
function trendItems(trend) {
  const { title, url, source } = trend
  return [
    menuRow('抓取正文并入库', () => captureTrend(trend), {
      disabled: url === '', hint: url === '' ? '无原文链接' : undefined,
    }),
    menuRow('仅收藏标题到选题库', () => saveTrendTitle(title, source)),
    SEPARATOR,
    menuRow('复制标题', () => copyOrThrow(title)),
    menuRow('复制原文链接', () => copyOrThrow(url), { disabled: url === '' }),
    menuRow('打开原文', () => openTrendUrl(url), { disabled: url === '' }),
  ]
}

/** Fetch the article body into the content library and upsert the idea. */
async function captureTrend(trend) {
  contextToast('正在抓取正文…', 'info')
  try {
    const result = await captureTrendArticle({
      title: trend.title, url: trend.url, source: trend.source,
      platform: trend.platform, rank: trend.rank, hot: trend.hot,
    })
    if (typeof result.warning === 'string' && result.warning !== '') {
      contextToast(`已入库 · ${result.warning}`, 'warn')
    } else {
      contextToast(result.reused === true ? '正文已更新' : '已存入内容库与选题库', 'ok')
    }
    notifyTrendSaved(trend.title)
  } catch (error) {
    contextToast(`抓取失败：${messageOf(error)}`, 'error')
  }
}

/** Save the title only (no network fetch), matching the left bookmark button. */
function saveTrendTitle(title, source) {
  createIdea({ title, source })
    .then(() => {
      contextToast('已收藏到选题库', 'ok')
      notifyTrendSaved(title)
    })
    .catch((error) => { contextToast(`收藏失败：${messageOf(error)}`, 'error') })
}

/** The trend page marks its bookmark state from this event. */
function notifyTrendSaved(title) {
  window.dispatchEvent(new CustomEvent('easel:trend-saved', { detail: { title } }))
}

/** Open an external link the same way the trend page's title anchor does. */
function openTrendUrl(url) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

/** One transient status line; a failed capture on a ported page has no composer to notify. */
let contextToastTimer = null
function contextToast(message, kind) {
  const previous = document.querySelector(`.${TOAST_CLASS}`)
  if (previous !== null) previous.remove()
  if (contextToastTimer !== null) clearTimeout(contextToastTimer)
  const toast = document.createElement('div')
  toast.className = `${TOAST_CLASS} ${TOAST_CLASS}--${kind}`
  toast.setAttribute('role', 'status')
  toast.textContent = message
  document.body.append(toast)
  contextToastTimer = setTimeout(() => toast.remove(), 2600)
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * File rows. Directories get open/reveal/path copies; files add preview and
 * the OS application list.
 * @param ctx - plugin context.
 * @param surface - resolved file row.
 * @returns the menu rows.
 */
function fileItems(ctx, surface) {
  const { path, root, entry, preview } = surface
  const cwd = currentSessionCwd(ctx)
  const absolute = absolutePathFor(root ?? cwd, path)
  const relative = isAbsolutePath(path) ? relativePath(root ?? cwd, path) : path.replace(/\\/g, '/')
  const items = []
  if (entry === 'file') {
    if (preview !== null && typeof preview.click === 'function') items.push(menuRow('预览', () => { preview.click() }))
    items.push(menuRow('打开', () => openPath(ctx, surface)))
    items.push(menuRow('打开方式…', (menu) => showApplications(ctx, surface, menu), { keepOpen: true }))
  } else {
    items.push(menuRow('打开', () => openPath(ctx, surface)))
  }
  items.push(SEPARATOR)
  items.push(menuRow('在文件管理器中显示', () => revealPath(ctx, surface)))
  items.push(SEPARATOR)
  items.push(menuRow('复制相对路径', () => copyOrThrow(relative)))
  items.push(menuRow('复制绝对路径', () => copyOrThrow(absolute)))
  if (entry === 'file') items.push(menuRow('复制文件名', () => copyOrThrow(fileNameOf(absolute))))
  items.push(SEPARATOR)
  items.push(menuRow('推送到设备…', (menu) => showPushTargets(ctx, surface, menu, items), { keepOpen: true }))
  return items
}

// ---- 局域网快推（spec easel-handoff-payload §S2）：文件面 → 选设备 → 传输，轻提示回执 ----

/**
 * Replace the open menu's rows with the paired devices, then push on pick.
 * @param ctx - plugin context.
 * @param surface - the file surface being pushed.
 * @param menu - the row API handed to the keep-open item.
 * @param previousItems - the file rows, restored by the back row.
 */
async function showPushTargets(ctx, surface, menu, previousItems) {
  menu.render([{ label: '正在查找已配对设备…', disabled: true }])
  const path = await resolveHostPath(ctx, surface)
  let status
  try {
    status = await fetchHandoffPaired()
  } catch {
    status = { available: false, paired: [] }
  }
  const items = []
  if (status.available !== true || status.paired.length === 0) {
    items.push({ label: status.available ? '没有已配对的设备' : '隔空传送未启用', disabled: true })
  } else {
    for (const device of status.paired) {
      items.push(menuRow(`推送到「${device.name}」`, () => pushToDevice(device.id, device.name, path)))
    }
  }
  items.push(SEPARATOR)
  items.push(menuRow('← 返回', (row) => row.render(previousItems), { keepOpen: true }))
  menu.render(items)
}

/** Push one file/folder and report the outcome in a toast; never rethrows. */
async function pushToDevice(peerId, deviceName, path) {
  contextToast(`正在推送到「${deviceName}」…`, 'info')
  try {
    await pushFileToPeer(peerId, path)
    contextToast(`已推送到「${deviceName}」`, 'ok')
  } catch (error) {
    contextToast(`推送失败：${messageOf(error)}`, 'error')
  }
}

/**
 * Editable rows: the platform-standard edit set, plus plain-text paste.
 * @param element - the focused field.
 * @returns the menu rows.
 */
function editableItems(element) {
  const selected = hasSelection(element)
  const mod = isMac() ? '⌘' : 'Ctrl+'
  const redo = isMac() ? '⇧⌘Z' : 'Ctrl+Y'
  return [
    menuRow('撤销', () => runCommand(element, 'undo'), { hint: `${mod}Z` }),
    menuRow('重做', () => runCommand(element, 'redo'), { hint: redo }),
    SEPARATOR,
    menuRow('剪切', () => runCommand(element, 'cut'), { hint: `${mod}X`, disabled: !selected }),
    menuRow('复制', () => copyOrThrow(selectedText(element)), { hint: `${mod}C`, disabled: !selected }),
    menuRow('粘贴', () => pasteInto(element, false), { hint: `${mod}V` }),
    menuRow('粘贴为纯文本', () => pasteInto(element, true), { hint: isMac() ? '⇧⌘V' : 'Ctrl+Shift+V' }),
    menuRow('删除', () => runCommand(element, 'delete'), { hint: 'Del', disabled: !selected }),
    SEPARATOR,
    menuRow('全选', () => selectAll(element), { hint: `${mod}A` }),
  ]
}

/**
 * One menu row.
 * @param label - display text.
 * @param action - invoked after the menu closes, or in place for `keepOpen`.
 * @param options - hint, disabled, and keepOpen.
 * @returns a row descriptor.
 */
function menuRow(label, action, options = {}) {
  return { label, action, hint: options.hint, disabled: options.disabled === true, keepOpen: options.keepOpen === true }
}

/**
 * Show one menu at a viewport point.
 * @param {{ x: number, y: number, items: Array<object>, onClosed?: () => void, onError?: (error: unknown) => void }} options - anchor, rows, and reporting.
 * @returns {() => void} closes this menu.
 */
function showMenu({ x, y, items, onClosed, onError }) {
  const menu = document.createElement('div')
  menu.className = MENU_CLASS
  menu.setAttribute('role', 'menu')
  menu.style.visibility = 'hidden'
  menu.style.left = '0px'
  menu.style.top = '0px'
  const restoreTarget = document.activeElement
  let closed = false

  const restoreFocus = () => {
    if (restoreTarget !== null && restoreTarget.isConnected && typeof restoreTarget.focus === 'function') {
      restoreTarget.focus({ preventScroll: true })
    }
  }
  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', close)
    window.removeEventListener('blur', close)
    menu.remove()
    if (typeof onClosed === 'function') onClosed()
  }

  const enabledItems = () => [...menu.querySelectorAll(`.${ITEM_CLASS}:not(:disabled)`)]
  const focusFirst = () => {
    const first = enabledItems()[0]
    if (first !== undefined) first.focus({ preventScroll: true })
  }
  const place = () => {
    const margin = 6
    menu.style.visibility = 'hidden'
    menu.style.left = '0px'
    menu.style.top = '0px'
    const rect = menu.getBoundingClientRect()
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, x - rect.width)
    if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, y - rect.height)
    menu.style.left = `${Math.round(left)}px`
    menu.style.top = `${Math.round(top)}px`
    menu.style.visibility = 'visible'
  }
  const render = (nextItems) => {
    if (closed) return
    menu.replaceChildren()
    for (const item of nextItems) menu.append(item.separator === true ? separatorElement() : itemElement(item, close, restoreFocus, render, onError))
    place()
    focusFirst()
  }
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      restoreFocus()
      return
    }
    if (event.key === 'Tab') {
      close()
      return
    }
    const list = enabledItems()
    if (list.length === 0) return
    const current = list.indexOf(document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      list[current < 0 ? 0 : (current + 1) % list.length].focus({ preventScroll: true })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      list[current < 0 ? list.length - 1 : (current - 1 + list.length) % list.length].focus({ preventScroll: true })
    } else if (event.key === 'Home') {
      event.preventDefault()
      list[0].focus({ preventScroll: true })
    } else if (event.key === 'End') {
      event.preventDefault()
      list[list.length - 1].focus({ preventScroll: true })
    }
  }
  const onPointerDown = (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return
    close()
  }
  const onScroll = (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return
    close()
  }

  document.body.append(menu)
  render(items)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', close)
  window.addEventListener('blur', close)
  return close
}

/**
 * Build one interactive row.
 * @param item - row descriptor.
 * @param close - closes the menu.
 * @param restoreFocus - returns focus to the element that opened the menu.
 * @param render - replaces the menu's rows in place.
 * @param onError - reports a failed row action.
 * @returns the button element.
 */
function itemElement(item, close, restoreFocus, render, onError) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = ITEM_CLASS
  button.setAttribute('role', 'menuitem')
  button.disabled = item.disabled === true
  const label = document.createElement('span')
  label.textContent = item.label
  button.append(label)
  if (typeof item.hint === 'string' && item.hint !== '') {
    const hint = document.createElement('span')
    hint.className = HINT_CLASS
    hint.textContent = item.hint
    button.append(hint)
  }
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (button.disabled) return
    const report = onError ?? ((error) => { console.warn('easel-context-menu:', error) })
    const run = () => {
      try {
        Promise.resolve(item.action?.({ render, close })).catch(report)
      } catch (error) {
        report(error)
      }
    }
    if (item.keepOpen === true) {
      run()
      return
    }
    close()
    restoreFocus()
    run()
  })
  return button
}

/** One non-interactive divider. */
function separatorElement() {
  const separator = document.createElement('div')
  separator.className = SEPARATOR_CLASS
  separator.setAttribute('role', 'separator')
  return separator
}

/**
 * Replace the open menu's rows with the OS handlers for one file.
 * @param ctx - plugin context.
 * @param surface - the file surface.
 * @param menu - the row API handed to the keep-open item.
 */
async function showApplications(ctx, surface, menu) {
  menu.render([{ label: '正在查找应用…', disabled: true }])
  const path = await resolveHostPath(ctx, surface)
  let applications = null
  try {
    const result = await ctx.remote.session.workspacePathApplications({ path })
    applications = result.ok ? result.value : null
  } catch (_error) {
    applications = null
  }
  const items = []
  if (applications === null) {
    items.push({ label: '无法读取文件关联', disabled: true })
  } else if (applications.length === 0) {
    items.push({ label: '没有可用的应用', disabled: true })
  } else {
    for (const application of applications) {
      items.push({
        label: application.default ? `${application.name}（默认）` : application.name,
        action: () => openPathAt(ctx, path, application.id),
      })
    }
  }
  items.push(SEPARATOR)
  items.push(menuRow('在文件管理器中显示', () => revealPathAt(ctx, path)))
  menu.render(items)
}

/**
 * Resolve the path the Host should open. The installed layout exposes the
 * workspace through a junction (`%LOCALAPPDATA%\Easel` → `...\data\workspace`);
 * the Host verifier canonicalizes the filesystem path, so passing the junction
 * path fails its equality check. `workspaceFiles.stat` is the Host's own
 * resolution and returns the canonical process path.
 * @param ctx - plugin context.
 * @param surface - the file surface.
 * @returns {Promise<string>} the canonical absolute path, or the displayed one when the read fails.
 */
async function resolveHostPath(ctx, surface) {
  const cwd = currentSessionCwd(ctx)
  const display = absolutePathFor(surface.root ?? cwd, surface.path)
  const sessionId = currentSessionId(ctx)
  if (sessionId === undefined) return display
  const relative = isAbsolutePath(surface.path)
    ? relativePath(surface.root ?? cwd, surface.path)
    : surface.path.replace(/\\/g, '/')
  if (relative === '' || isAbsolutePath(relative)) return display
  try {
    const files = ctx.get?.('remote.workspaceFiles')
    if (files === undefined) return display
    const result = await files.stat(sessionId, relative, new AbortController().signal)
    const canonical = result.ok ? result.value?.absolutePath : undefined
    if (typeof canonical === 'string' && canonical !== '') return canonical
  } catch (_error) {
    // Fall through: the Host may still accept the displayed path.
  }
  return display
}

/**
 * Open one file surface in its default application or a chosen one.
 * @param ctx - plugin context.
 * @param surface - the file surface.
 * @param application - registered application id, or undefined for the OS default.
 */
async function openPath(ctx, surface, application) {
  const path = await resolveHostPath(ctx, surface)
  await openPathAt(ctx, path, application)
}

/**
 * Open one canonical Host path.
 * @param ctx - plugin context.
 * @param path - canonical absolute path.
 * @param application - registered application id, or undefined for the OS default.
 */
async function openPathAt(ctx, path, application) {
  const result = await ctx.remote.session.openWorkspacePath({
    path,
    ...(application === undefined ? {} : { application }),
  })
  if (!result.ok) throw new Error(result.error?.message ?? '打开失败')
}

/**
 * Reveal one file surface in the file manager.
 * @param ctx - plugin context.
 * @param surface - the file surface.
 */
async function revealPath(ctx, surface) {
  const path = await resolveHostPath(ctx, surface)
  await revealPathAt(ctx, path)
}

/**
 * Reveal one canonical Host path.
 * @param ctx - plugin context.
 * @param path - canonical absolute path.
 */
async function revealPathAt(ctx, path) {
  const result = await ctx.remote.session.openWorkspacePath({ path, action: 'reveal' })
  if (!result.ok) throw new Error(result.error?.message ?? '定位文件失败')
}

/**
 * The Session the main conversation currently shows.
 * @param ctx - plugin context.
 * @returns its id, or undefined without a selection.
 */
function currentSessionId(ctx) {
  const binding = ctx.uiSession?.adapter?.current?.value
  return typeof binding?.key === 'string' && binding.key !== '' ? binding.key : undefined
}

/**
 * The current Session's working directory, which inline file mentions are
 * relative to.
 * @param ctx - plugin context.
 * @returns its cwd, or undefined before the Session summary arrives.
 */
function currentSessionCwd(ctx) {
  const sessionId = currentSessionId(ctx)
  if (sessionId === undefined) return undefined
  return ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
}

/**
 * The current Session's input machine, when one is retained.
 * @param ctx - plugin context.
 * @returns the input facade, or undefined.
 */
function currentInput(ctx) {
  const sessionId = currentSessionId(ctx)
  if (sessionId === undefined) return undefined
  let binding
  try {
    binding = ctx.sessions.binding(sessionId)
  } catch (_error) {
    return undefined
  }
  if (binding === undefined) return undefined
  try {
    return ctx.conversation.input.for(binding.ctx)
  } catch (_error) {
    return undefined
  }
}

/**
 * Append the selected text as a Markdown quote at the composer caret, without
 * replacing what is already there.
 * @param ctx - plugin context.
 * @param text - selected conversation text.
 */
function addToTask(ctx, text) {
  const input = currentInput(ctx)
  if (input === undefined) throw new Error('当前没有可用的输入框')
  const block = draftBlock(text)
  if (block === '') return
  const actions = input.actions
  if (typeof actions?.captureInsertion === 'function' && typeof actions?.insertText === 'function') {
    if (actions.insertText(block, actions.captureInsertion())) {
      input.focus()
      return
    }
    // One retry covers a draft revision that moved while the menu was open.
    if (actions.insertText(block, actions.captureInsertion())) {
      input.focus()
      return
    }
  }
  const draft = input.state?.getSnapshot?.().draft
  input.setDraft(`${typeof draft === 'string' ? draft : ''}${block}`)
  input.focus()
}

/**
 * Open the workspace's new-Session path with the selected text as its draft.
 * The current conversation stays in the session list, and the reader can type
 * the actual question directly under the quote.
 * @param ctx - plugin context.
 * @param text - selected conversation text.
 */
function askInAuxiliaryConversation(ctx, text) {
  const prompt = `${quoteBlock(text)}\n\n`
  // startSession carries the draft through beforeOpen, so the composer receives
  // it in the same transaction that publishes the Session. A locally forked or
  // created Session needs a second binding and its draft does not reach the
  // resident composer reliably.
  ctx.uiWorkspace.startSession(undefined, { prompt, clearPreviousDraft: true })
}

/** Copy text, preferring the async clipboard and falling back to execCommand. */
async function copyOrThrow(text) {
  if (await writeClipboard(text)) return
  throw new Error('复制失败')
}

/**
 * Write one string to the clipboard.
 * @param {string} text - content to write.
 * @returns {Promise<boolean>} whether a clipboard path accepted it.
 */
async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (_error) {
    // WebViews without Clipboard API permission still allow the legacy gesture.
  }
  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'
    document.body.append(field)
    field.focus({ preventScroll: true })
    field.select()
    const copied = document.execCommand('copy')
    field.remove()
    return copied
  } catch (_error) {
    return false
  }
}

/** Whether the field currently owns a non-empty selection. */
function hasSelection(element) {
  if (isTextField(element)) return (element.selectionStart ?? 0) !== (element.selectionEnd ?? 0)
  const selection = window.getSelection()
  if (selection === null || selection.isCollapsed) return false
  const within = (node) => node !== null && element.contains(node)
  return within(selection.anchorNode) || within(selection.focusNode)
}

/** The field's selected text, read without depending on focus. */
function selectedText(element) {
  if (isTextField(element)) {
    const start = element.selectionStart ?? 0
    const end = element.selectionEnd ?? start
    return element.value.slice(start, end)
  }
  return window.getSelection()?.toString() ?? ''
}

/** Whether one element is an input/textarea rather than a contenteditable. */
function isTextField(element) {
  const name = element?.tagName
  return name === 'INPUT' || name === 'TEXTAREA'
}

/** Focus a field without scrolling the transcript. */
function focusField(element) {
  if (typeof element.focus === 'function') element.focus({ preventScroll: true })
}

/** Run one editing command against the field. */
function runCommand(element, command) {
  focusField(element)
  try {
    document.execCommand(command)
  } catch (error) {
    reportError(undefined, error)
  }
}

/**
 * Paste from the clipboard, preferring the browser's rich paste and falling
 * back to plain text insertion.
 * @param element - target field.
 * @param plain - skip the native paste command and insert text only.
 */
async function pasteInto(element, plain) {
  focusField(element)
  if (!plain) {
    try {
      if (document.execCommand('paste')) return
    } catch (_error) {
      // WebViews refuse the legacy command without a user gesture; read instead.
    }
  }
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch (_error) {
    return
  }
  if (text === '') return
  insertAtCaret(element, text)
}

/** Insert plain text at the field's current selection. */
function insertAtCaret(element, text) {
  if (isTextField(element)) {
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? start
    element.setRangeText(text, start, end, 'end')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
  try {
    document.execCommand('insertText', false, text)
  } catch (error) {
    reportError(undefined, error)
  }
}

/** Select the field's whole contents. */
function selectAll(element) {
  if (isTextField(element)) {
    element.focus({ preventScroll: true })
    element.select()
    return
  }
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = window.getSelection()
  if (selection === null) return
  selection.removeAllRanges()
  selection.addRange(range)
  focusField(element)
}

/** Whether this browser runs on macOS, for shortcut hints only. */
function isMac() {
  return /mac|iphone|ipad/i.test(navigator.userAgent)
}

/**
 * Surface a failed action without a toast service: the composer can show a
 * notice, and the console always receives it.
 * @param ctx - plugin context, absent for DOM-only command failures.
 * @param error - the failure.
 */
function reportError(ctx, error) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`easel-context-menu: ${message}`)
  if (ctx === undefined) return
  try {
    const input = currentInput(ctx)
    if (input !== undefined) input.notify('error', message)
  } catch (_error) {
    // Reporting is best-effort; the console line above is the guarantee.
  }
}
