/**
 * Scope Easel's global stylesheet under one container class so it can be
 * injected into the dsh document without touching the host's own UI.
 *
 * The transform is a small state machine over well-formed CSS (the two Easel
 * sheets use no nesting, no attribute tricks beyond `:root[data-theme]`, and
 * comments never contain braces), which is all the build needs:
 *
 * - `:root`                                  → the scope class itself (light palette custom props)
 * - `:root[data-theme='dark'] …`             → `body[data-ds-dark-theme] <scope> …`
 *   (dsh's presenter toggles that exact body attribute, so the ported pages
 *   follow the host's light/dark switch with no JS observer)
 * - the `html, body, #root` viewport rule    → dropped (the host owns the viewport)
 * - `body`                                   → the scope class (font/color base)
 * - `*, *::before, *::after`                 → scoped star selectors
 * - any part that is or starts with bare `html` → dropped
 * - everything else                          → every comma part prefixed with `<scope> `
 *
 * @media blocks recurse; @keyframes bodies pass through untouched.
 */

const DARK_ROOT = ":root[data-theme='dark']";

/** Split one selector group on top-level commas (commas inside `:is(...)` etc. don't split). */
export function splitSelectorParts(group) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of group) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim() !== '') parts.push(current)
  return parts
}

/**
 * Rewrite one selector group.
 * @param group - the raw text between two rule braces (no trailing `{`).
 * @param scope - the scoping class selector, e.g. `.easel-scope`.
 * @returns the scoped group, or null when every part must be dropped.
 */
export function scopeSelector(group, scope) {
  const out = []
  for (const raw of splitSelectorParts(group)) {
    const part = raw.trim()
    if (part === '') continue
    if (part === DARK_ROOT) {
      out.push(`body[data-ds-dark-theme] ${scope}`)
      continue
    }
    if (part.startsWith(`${DARK_ROOT} `)) {
      out.push(`body[data-ds-dark-theme] ${scope} ${part.slice(DARK_ROOT.length + 1)}`)
      continue
    }
    if (part === 'html' || part === '#root') {
      continue
    }
    if (part === 'body') {
      out.push(scope)
      continue
    }
    if (part === '*') {
      out.push(`${scope}, ${scope} *`)
      continue
    }
    if (part === '*::before' || part === '*::after') {
      out.push(`${scope} ${part}`)
      continue
    }
    if (part.startsWith('::')) {
      // scrollbar pseudo rules attach to the scoped container
      out.push(`${scope}${part}`)
      continue
    }
    if (part.startsWith(':root')) {
      // `:root` plus extra qualifiers we don't model — scope conservatively
      out.push(`${scope}${part.slice(':root'.length)}`)
      continue
    }
    out.push(`${scope} ${part}`)
  }
  return out.length === 0 ? null : out.join(', ')
}

/**
 * Scope a stylesheet.
 * @param css - the source stylesheet text.
 * @param scope - the scoping class selector.
 * @returns the scoped stylesheet text.
 */
export function scopeCss(css, scope = '.easel-scope') {
  let out = ''
  let i = 0
  const n = css.length
  let token = ''

  const flushRuleHead = () => {
    const head = token.trim()
    token = ''
    return head
  }

  while (i < n) {
    const ch = css[i]
    // comments pass through verbatim
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      out += css.slice(i, stop)
      i = stop
      continue
    }
    if (ch === '{') {
      const head = flushRuleHead()
      if (head.startsWith('@keyframes') || head.startsWith('@-webkit-keyframes')) {
        // verbatim block, braces balanced
        let depth = 1
        let j = i + 1
        while (j < n && depth > 0) {
          if (css[j] === '{') depth += 1
          if (css[j] === '}') depth -= 1
          j += 1
        }
        out += `${head} {` + css.slice(i + 1, j)
        i = j
        continue
      }
      if (head.startsWith('@media') || head.startsWith('@supports')) {
        // recurse into the inner block
        let depth = 1
        let j = i + 1
        while (j < n && depth > 0) {
          if (css[j] === '{') depth += 1
          if (css[j] === '}') depth -= 1
          j += 1
        }
        out += `${head} {` + scopeCss(css.slice(i + 1, j - 1), scope) + '}'
        i = j
        continue
      }
      // plain ruleset: scope the head, copy the body verbatim
      let depth = 1
      let j = i + 1
      while (j < n && depth > 0) {
        if (css[j] === '{') depth += 1
        if (css[j] === '}') depth -= 1
        j += 1
      }
      const scoped = scopeSelector(head, scope)
      if (scoped !== null) out += `${scoped} {` + css.slice(i + 1, j)
      // dropped rule: emit nothing (body copied too)
      i = j
      continue
    }
    token += ch
    i += 1
    if (ch === ';') out += flushRuleHead() + ';'
  }
  out += flushRuleHead()
  return out
}
