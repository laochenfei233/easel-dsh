import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scopeCss, scopeSelector, splitSelectorParts } from '../tools/scope-css.mjs'

const SCOPE = '.easel-scope'

test('splits selector groups on top-level commas only', () => {
  assert.deepEqual(splitSelectorParts('.a, .b:hover'), ['.a', ' .b:hover'])
  assert.deepEqual(splitSelectorParts(':is(.a, .b) .c'), [':is(.a, .b) .c'])
})

test('scopeSelector rewrites the Easel roots to the scope and the host dark attribute', () => {
  assert.equal(scopeSelector(':root', SCOPE), SCOPE)
  assert.equal(scopeSelector(":root[data-theme='dark']", SCOPE), `body[data-ds-dark-theme] ${SCOPE}`)
  assert.equal(
    scopeSelector(":root[data-theme='dark'] .sidebar", SCOPE),
    `body[data-ds-dark-theme] ${SCOPE} .sidebar`,
  )
  assert.equal(scopeSelector('body', SCOPE), SCOPE)
  assert.equal(scopeSelector('body', SCOPE), SCOPE)
})

test('scopeSelector drops the host-owned parts', () => {
  assert.equal(scopeSelector('html, body, #root', SCOPE), SCOPE)
  assert.equal(scopeSelector('html', SCOPE), null)
  assert.equal(scopeSelector('#root', SCOPE), null)
})

test('scopeSelector scopes star selectors and scrollbar pseudos', () => {
  assert.equal(scopeSelector('*', SCOPE), `${SCOPE}, ${SCOPE} *`)
  assert.equal(scopeSelector('*::before', SCOPE), `${SCOPE} *::before`)
  assert.equal(scopeSelector('::-webkit-scrollbar', SCOPE), `${SCOPE}::-webkit-scrollbar`)
})

test('scopeSelector prefixes plain class selectors', () => {
  assert.equal(scopeSelector('.card', SCOPE), `${SCOPE} .card`)
  assert.equal(scopeSelector('.a, .b', SCOPE), `${SCOPE} .a, ${SCOPE} .b`)
})

test('scopeCss prefixes rules but not keyframe bodies', () => {
  const css = '@keyframes spin { to { transform: rotate(360deg); } }\n.card { color: red; }'
  const out = scopeCss(css, SCOPE)
  assert.ok(out.includes('@keyframes spin { to { transform: rotate(360deg); } }'))
  assert.ok(out.includes(`${SCOPE} .card { color: red; }`))
  assert.ok(!out.includes(`${SCOPE} to`))
})

test('scopeCss recurses into media queries', () => {
  const css = '@media (min-width: 10px) { .card { color: red; } }'
  const out = scopeCss(css, SCOPE)
  assert.ok(out.startsWith('@media (min-width: 10px) {'))
  assert.ok(out.includes(`${SCOPE} .card { color: red; }`))
})

test('scopeCss keeps comments and re-scopes the viewport rule to the container', () => {
  const css = '/* head */\nhtml, body, #root { height: 100%; overflow: hidden; }\n.page { padding: 0; }'
  const out = scopeCss(css, SCOPE)
  assert.ok(out.includes('/* head */'))
  assert.ok(out.includes(`${SCOPE} .page { padding: 0; }`))
  // the body part of the group becomes the scope itself: the ported pages keep
  // Easel's full-height viewport behavior inside their own container only
  assert.ok(out.includes(`${SCOPE} { height: 100%; overflow: hidden; }`))
})

test('scopeCss leaves the light :root palette on the scope element', () => {
  const css = ':root { --bg: #fff; }\n:root { color-scheme: light; }'
  const out = scopeCss(css, SCOPE)
  assert.equal(out.match(/\.easel-scope \{/g)?.length, 2)
})
