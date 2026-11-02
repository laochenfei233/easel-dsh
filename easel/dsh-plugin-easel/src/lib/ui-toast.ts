// One lightweight bottom-center status toast shared by archive progress and
// the context menu. It is deliberately DOM-only: the archive service is not a
// React component, and the menu already owns its own DOM rendering.

const STYLE_ID = 'easel-ui-toast-style'
const TOAST_CLASS = 'easel-ui-toast'

const CSS = `
.${TOAST_CLASS} {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 2147483000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: max-content;
  min-width: 220px;
  max-width: min(70vw, 460px);
  padding: 10px 14px;
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-elevated, #ffffff));
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(15, 23, 42, 0.2));
  color: var(--dsw-alias-label-primary, #1f2329);
  font: var(--dsw-text-body-font, 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif);
  pointer-events: none;
}
.${TOAST_CLASS}--dismissible { pointer-events: auto; }
.${TOAST_CLASS}__row { display: flex; align-items: center; gap: 10px; }
.${TOAST_CLASS}__text { flex: 1 1 auto; min-width: 0; word-break: break-word; }
.${TOAST_CLASS}__detail { color: var(--dsw-alias-label-secondary, rgba(31, 35, 41, 0.6)); font-size: 12px; line-height: 16px; }
.${TOAST_CLASS}__bar { height: 3px; border-radius: 2px; background: var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.12)); overflow: hidden; }
.${TOAST_CLASS}__fill { height: 100%; background: var(--dsw-alias-state-business-primary, #4f7cff); transition: width 180ms ease-out; }
.${TOAST_CLASS}__close {
  flex: none; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 4px;
  background: transparent; color: inherit; cursor: pointer; opacity: .65; line-height: 16px;
}
.${TOAST_CLASS}__close:hover { opacity: 1; background: var(--dsw-alias-interactive-bg-hover, rgba(15, 23, 42, .06)); }
.${TOAST_CLASS}--ok .${TOAST_CLASS}__text { color: var(--dsh-success-text, #0f9d58); }
.${TOAST_CLASS}--warn .${TOAST_CLASS}__text { color: var(--dsh-warning-text, #b45309); }
.${TOAST_CLASS}--error .${TOAST_CLASS}__text { color: var(--dsh-error-text, #dc2626); }
@media (prefers-reduced-motion: reduce) {
  .${TOAST_CLASS}__fill { transition: none; }
}
`

/** Toast variants. */
export type ToastKind = 'info' | 'ok' | 'warn' | 'error'

/** Everything one toast renders. */
export interface ToastOptions {
  /** Status color and accessible role. */
  kind?: ToastKind
  /** Primary line. */
  message: string
  /** Optional secondary line (progress detail, destination). */
  detail?: string
  /** 0..1 progress; omitted hides the bar. */
  progress?: number
  /** Keep an explicit close button and allow pointer interaction. */
  dismissible?: boolean
  /** Auto-hide delay in ms; 0 keeps it until replaced or dismissed. */
  duration?: number
  /** Accessible label for the close button. */
  closeLabel?: string
}

/** Handle for updating or dismissing one toast. */
export interface ToastHandle {
  /** Replace the visible fields; omitted fields keep their current value. */
  update: (next: Partial<ToastOptions>) => void
  /** Remove the toast immediately. */
  dismiss: () => void
}

let styleInstalled = false

function ensureStyle(): void {
  if (styleInstalled || typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) {
    styleInstalled = true
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
  styleInstalled = true
}

/**
 * Show one status toast. A new call replaces the previous toast; the archive
 * service relies on that single-slot behavior for its job progress.
 * @param options - initial toast fields.
 * @returns a handle that updates or dismisses this toast.
 */
export function showToast(options: ToastOptions): ToastHandle {
  ensureStyle()
  let current = { ...options }
  let root: HTMLDivElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let dismissed = false

  const dismiss = (): void => {
    if (dismissed) return
    dismissed = true
    if (timer !== undefined) clearTimeout(timer)
    root?.remove()
    root = null
  }
  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    const duration = current.duration ?? 2600
    if (duration > 0) timer = setTimeout(dismiss, duration)
  }
  const render = (): void => {
    if (root === null) return
    root.className = `${TOAST_CLASS} ${TOAST_CLASS}--${current.kind ?? 'info'}`
      + (current.dismissible === true ? ` ${TOAST_CLASS}--dismissible` : '')
    root.setAttribute('role', current.kind === 'error' ? 'alert' : 'status')
    root.replaceChildren()
    const row = document.createElement('div')
    row.className = `${TOAST_CLASS}__row`
    const text = document.createElement('span')
    text.className = `${TOAST_CLASS}__text`
    text.textContent = current.message
    row.append(text)
    const close = document.createElement('button')
    close.type = 'button'
    close.className = `${TOAST_CLASS}__close`
    close.setAttribute('aria-label', current.closeLabel ?? '关闭')
    close.textContent = '×'
    close.style.display = current.dismissible === true ? '' : 'none'
    close.addEventListener('click', dismiss)
    row.append(close)
    const detail = document.createElement('span')
    detail.className = `${TOAST_CLASS}__detail`
    detail.textContent = current.detail ?? ''
    detail.style.display = current.detail === undefined || current.detail === '' ? 'none' : ''
    const bar = document.createElement('div')
    bar.className = `${TOAST_CLASS}__bar`
    const fill = document.createElement('div')
    fill.className = `${TOAST_CLASS}__fill`
    bar.append(fill)
    if (current.progress === undefined) {
      bar.style.display = 'none'
    } else {
      const clamped = Math.max(0, Math.min(1, current.progress))
      fill.style.width = `${Math.round(clamped * 100)}%`
    }
    root.append(row, detail, bar)
  }
  const mount = (): void => {
    if (dismissed) return
    document.querySelector(`.${TOAST_CLASS}`)?.remove()
    root = document.createElement('div')
    // A toast shown while a modal is open must live inside that dialog: an
    // aria-modal ancestor suppresses outside content for assistive technology,
    // and the dialog's focus trap would exclude the close button.
    const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
    const host = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document.body
    host.append(root)
    render()
    if (timer !== undefined) clearTimeout(timer)
    schedule()
  }
  mount()

  return {
    update(next) {
      if (dismissed) return
      current = { ...current, ...next }
      // Another toast may have taken the single visible slot while this job
      // kept polling; remount this handle instead of updating detached DOM.
      if (root === null || !root.isConnected) mount()
      else {
        render()
        schedule()
      }
    },
    dismiss,
  }
}
