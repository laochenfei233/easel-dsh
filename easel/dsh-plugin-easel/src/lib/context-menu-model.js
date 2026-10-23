/**
 * Pure helpers behind the Easel context menu: what the pointer is over, how a
 * path reads relative to the file tree root, and how a selection is quoted.
 * Kept free of DOM construction so node --test can cover the rules directly.
 */

/** Rows the file tree draws; the path attribute is the absolute path. */
export const FILE_ROW_SELECTOR = '[data-files-entry]'
/** The file tree's root wrapper; its attribute is the session working directory. */
export const FILE_ROOT_SELECTOR = '[data-files-root]'
/** Editable surfaces: the dsh composer and ordinary form fields. */
export const EDITABLE_SELECTOR = [
  '[data-composer-input]',
  'textarea',
  'input:not([type="checkbox"]):not([type="radio"]):not([type="file"])',
  '[contenteditable="true"]',
].join(', ')
/** The chat transcript column, present on every conversation flow. */
export const CHAT_FLOW_SELECTOR = '[data-chat-flow]'
/** One transcript message seat; its kind separates user/assistant text from process rows. */
export const CHAT_NODE_SELECTOR = '[data-chat-node-key]'
/** Presented deliverables: the card row and its hidden preview button. */
export const PRESENTED_FILE_SELECTOR = '[data-presented-file]'
/** Hotspot-trend rows in the Easel pages; the attribute carries the row payload as JSON. */
export const TREND_ROW_SELECTOR = '[data-easel-trend]'
/** Inline file mentions and presented-file preview buttons carry the path in `title`. */
export const FILE_LINK_SELECTOR = 'button[title]'

/** Node kinds whose text the conversation menu may act on without a selection. */
const MESSAGE_KINDS = new Set(['user', 'assistant-step'])

/**
 * Read an element's data attribute without assuming a real dataset.
 * @param {Element | null | undefined} element - element carrying the attribute.
 * @param {string} name - dataset key, e.g. `filesPath`.
 * @returns {string | undefined} the attribute value.
 */
function dataOf(element, name) {
  if (element == null) return undefined
  const value = element.dataset?.[name]
  return typeof value === 'string' ? value : undefined
}

/**
 * Whether a tooltip/attribute value names a file rather than describing an action.
 * @param {string | undefined} value - the candidate `title`.
 * @returns {boolean} true for a path with a basename extension.
 */
function isFilePath(value) {
  if (typeof value !== 'string' || value === '' || value.includes('\n')) return false
  if (!/[/\\]/.test(value)) return false
  const base = value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
  return /\.[A-Za-z0-9]{1,8}$/.test(base)
}

/**
 * Resolve a file surface from a presented deliverable card or an inline file
 * mention. The card's hidden preview button and the mention button both carry
 * the path in `title` (absolute on the card, workspace-relative on mentions).
 * @param {Element} target - the context-menu target.
 * @returns {null | { kind: 'file', path: string, root: undefined, entry: 'file', preview: Element }} the file surface.
 */
function fileLinkSurface(target) {
  const card = target.closest(PRESENTED_FILE_SELECTOR)
  if (card != null) {
    const preview = card.querySelector?.('button[title]') ?? null
    const path = preview?.getAttribute?.('title')?.trim()
    if (preview !== null && isFilePath(path)) {
      return { kind: 'file', path, root: undefined, entry: 'file', preview }
    }
    return null
  }
  const button = target.closest(FILE_LINK_SELECTOR)
  const path = button?.getAttribute?.('title')?.trim()
  if (button != null && isFilePath(path)) {
    return { kind: 'file', path, root: undefined, entry: 'file', preview: button }
  }
  return null
}

/**
 * Parse the `data-easel-trend` JSON payload of a hotspot row. A payload without
 * a title is not a menu surface.
 * @param {Element | null | undefined} element - the row carrying the attribute.
 * @returns {null | { title: string, url: string, source: string, platform: string, rank?: number, hot?: string }}
 *   the row payload, or null when absent or malformed.
 */
export function trendPayloadOf(element) {
  const raw = element?.dataset?.easelTrend
  if (typeof raw !== 'string' || raw === '') return null
  try {
    const data = JSON.parse(raw)
    if (data === null || typeof data !== 'object') return null
    const title = typeof data.title === 'string' ? data.title.trim() : ''
    if (title === '') return null
    return {
      title,
      url: typeof data.url === 'string' ? data.url : '',
      source: typeof data.source === 'string' ? data.source : '',
      platform: typeof data.platform === 'string' ? data.platform : '',
      ...(typeof data.rank === 'number' ? { rank: data.rank } : {}),
      ...(typeof data.hot === 'string' && data.hot !== '' ? { hot: data.hot } : {}),
    }
  } catch {
    return null
  }
}

/**
 * Classify what a context-menu event landed on.
 *
 * Order matters: the composer sits inside the conversation frame, so editables
 * win over the surrounding chat flow. A file row wins over both because the
 * sidebar can sit inside the same page frame. A trend row wins over everything
 * below it for the same reason — its rows live in a ported page, not in dsh's
 * own surfaces.
 * @param {Element | null | undefined} target - `event.target`, possibly a text node's parent.
 * @param {Selection | null | undefined} selection - the live selection.
 * @returns {null | { kind: 'file', row?: Element, path: string, root: string | undefined, entry: string, preview: Element | null }
 *   | { kind: 'trend', element: Element, trend: { title: string, url: string, source: string, platform: string, rank?: number, hot?: string } }
 *   | { kind: 'editable', element: Element }
 *   | { kind: 'conversation', element: Element, text: string }} the handled surface.
 */
export function resolveSurface(target, selection) {
  if (target == null || typeof target.closest !== 'function') return null

  const row = target.closest(FILE_ROW_SELECTOR)
  if (row != null && typeof row.closest === 'function') {
    const root = row.closest(FILE_ROOT_SELECTOR)
    const path = dataOf(row, 'filesPath')
    const entry = dataOf(row, 'filesEntry')
    if (root != null && typeof path === 'string' && path !== '' && entry !== 'other') {
      return {
        kind: 'file', row, path, root: dataOf(root, 'filesRoot'), entry,
        preview: row.querySelector?.('button') ?? null,
      }
    }
  }

  // Deliverable cards and inline file mentions carry their path in a title;
  // they are files, not conversation text.
  const link = fileLinkSurface(target)
  if (link !== null) return link

  // Hotspot rows carry their payload in data-easel-trend; act on that news
  // item (capture body / save / copy) instead of the WebView menu.
  const trendRow = target.closest(TREND_ROW_SELECTOR)
  if (trendRow != null) {
    const trend = trendPayloadOf(trendRow)
    if (trend !== null) return { kind: 'trend', element: trendRow, trend }
  }

  const editable = target.closest(EDITABLE_SELECTOR)
  if (editable != null) return { kind: 'editable', element: editable }

  const chat = target.closest(CHAT_FLOW_SELECTOR)
  if (chat == null) return null
  const inside = (node) => node != null && typeof chat.contains === 'function' && chat.contains(node)
  const selected = selection != null && !selection.isCollapsed
    ? String(selection.toString() ?? '').trim()
    : ''
  if (selected !== '' && (inside(selection.anchorNode) || inside(selection.focusNode))) {
    return { kind: 'conversation', element: chat, text: selected }
  }
  // A plain right-click on a message needs no selection: act on that message's
  // text instead of falling back to the WebView menu. Process rows (tool
  // chatter, turn usage) stay native.
  const node = target.closest(CHAT_NODE_SELECTOR)
  if (node != null && MESSAGE_KINDS.has(dataOf(node, 'chatFlowKind') ?? '')) {
    const text = messageText(node)
    if (text !== '') return { kind: 'conversation', element: chat, text }
  }
  return null
}

/**
 * Visible text of one message seat, with the user bubble's clock line removed
 * (the node seat owns both the bubble and its trailing time label).
 * @param {Element | null | undefined} node - a `[data-chat-node-key]` element.
 * @returns {string} the message text, empty when the seat has none.
 */
export function messageText(node) {
  const raw = typeof node?.innerText === 'string' ? node.innerText : String(node?.textContent ?? '')
  return raw
    .replace(/\r\n?/g, '\n')
    // Trailing clock-only line: "23:51", or "10月20日 23:51" in the user seat.
    .replace(/\n\s*(?:\d{1,2}月\d{1,2}日\s*)?\d{1,2}:\d{2}\s*$/u, '')
    .trim()
}

/**
 * Whether a path is already rooted (Windows drive/UNC or a POSIX root).
 * @param {string} path - candidate path.
 * @returns {boolean} true when joining a workspace root would be wrong.
 */
export function isAbsolutePath(path) {
  return /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path)
}

/**
 * Resolve a card/mention path against the session working directory.
 * @param {string | undefined} root - the session cwd.
 * @param {string} path - an absolute path or a workspace-relative one.
 * @returns {string} an absolute path when the root is known.
 */
export function absolutePathFor(root, path) {
  if (isAbsolutePath(path)) return path
  if (typeof root !== 'string' || root === '') return path
  return `${root.replace(/\\/g, '/').replace(/\/+$/, '')}/${path.replace(/^[\\/]+/, '')}`
}

/**
 * Present one absolute path relative to the file tree root, keeping the tree's
 * forward slashes. Paths outside the root come back unchanged, which is also
 * what the file tree's own root row would copy.
 * @param {string | undefined} root - the tree root (`data-files-root`).
 * @param {string} absolute - the row's absolute path.
 * @returns {string} a workspace-relative path, or the original absolute path.
 */
export function relativePath(root, absolute) {
  const path = String(absolute ?? '').replace(/\\/g, '/')
  if (typeof root !== 'string' || root === '') return path
  const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
  if (base === '') return path
  if (path === base) return ''
  const prefix = `${base}/`
  // Windows drive letters and the app's case-insensitive file tree both compare
  // without case; a differing-case segment still reads as the same file there.
  if (path.toLowerCase().startsWith(prefix.toLowerCase())) return path.slice(prefix.length)
  return path
}

/**
 * Quote text as a Markdown blockquote, preserving blank lines.
 * @param {string} text - selected text.
 * @returns {string} the quoted block, without a trailing newline.
 */
export function quoteBlock(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').trim().split('\n')
  if (lines.length === 1 && lines[0] === '') return ''
  return lines.map(line => (line === '' ? '>' : `> ${line}`)).join('\n')
}

/**
 * Wrap a quote for insertion after a draft; the surrounding blank lines keep it
 * a block instead of gluing onto the previous paragraph.
 * @param {string} text - selected text.
 * @returns {string} the draft insertion, empty when there is nothing to quote.
 */
export function draftBlock(text) {
  const quoted = quoteBlock(text)
  return quoted === '' ? '' : `\n\n${quoted}\n\n`
}

/**
 * Last path segment, for the copy-name menu item.
 * @param {string} path - absolute or relative path in either separator style.
 * @returns {string} the final segment.
 */
export function fileNameOf(path) {
  const parts = String(path ?? '').replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] ?? ''
}
