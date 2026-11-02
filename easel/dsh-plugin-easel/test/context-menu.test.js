import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAT_FLOW_SELECTOR, CHAT_NODE_SELECTOR, EDITABLE_SELECTOR, FILE_LINK_SELECTOR, FILE_ROOT_SELECTOR,
  FILE_ROW_SELECTOR, PRESENTED_FILE_SELECTOR, TREND_ROW_SELECTOR,
  absolutePathFor, draftBlock, fileNameOf, isAbsolutePath, messageText, quoteBlock, relativePath, resolveSurface,
  trendPayloadOf,
} from '../src/lib/context-menu-model.js'

/** Minimal stand-in for the DOM chain `resolveSurface` walks. */
function fakeNode({
  selectors = [], dataset = {}, contains = [], parent = null, innerText = '', title = '', querySelector = null,
} = {}) {
  const node = {
    dataset,
    parentElement: parent,
    innerText,
    closest(selector) {
      if (selectors.includes(selector)) return node
      return parent === null ? null : parent.closest(selector)
    },
    contains(candidate) { return contains.includes(candidate) },
    getAttribute(name) { return name === 'title' ? title : null },
    ...(querySelector === null ? {} : { querySelector: () => querySelector }),
  }
  return node
}

test('resolveSurface: file row needs the tree root and a real path', () => {
  const root = fakeNode({ selectors: [FILE_ROOT_SELECTOR], dataset: { filesRoot: 'C:/work' } })
  const row = fakeNode({
    selectors: [FILE_ROW_SELECTOR],
    dataset: { filesPath: 'C:/work/notes.md', filesEntry: 'file' },
    parent: root,
  })
  assert.deepEqual(resolveSurface(row, null), {
    kind: 'file', row, path: 'C:/work/notes.md', root: 'C:/work', entry: 'file', preview: null,
  })
  const orphan = fakeNode({
    selectors: [FILE_ROW_SELECTOR],
    dataset: { filesPath: 'C:/work/notes.md', filesEntry: 'file' },
  })
  assert.equal(resolveSurface(orphan, null), null)
  const other = fakeNode({
    selectors: [FILE_ROW_SELECTOR],
    dataset: { filesPath: 'C:/work/loop', filesEntry: 'other' },
    parent: root,
  })
  assert.equal(resolveSurface(other, null), null)
})

test('resolveSurface: editables win over the surrounding chat flow', () => {
  const editable = fakeNode({ selectors: [EDITABLE_SELECTOR, CHAT_FLOW_SELECTOR] })
  assert.deepEqual(resolveSurface(editable, null), { kind: 'editable', element: editable })
})

test('resolveSurface: conversation needs a non-collapsed selection inside it', () => {
  const anchor = { nodeType: 3 }
  const chat = fakeNode({ selectors: [CHAT_FLOW_SELECTOR], contains: [anchor] })
  const text = '  quoted line\nsecond  '
  const selection = { isCollapsed: false, anchorNode: anchor, focusNode: anchor, toString: () => text }
  assert.deepEqual(resolveSurface(chat, selection), {
    kind: 'conversation', element: chat, text: 'quoted line\nsecond',
  })
  assert.equal(resolveSurface(chat, { ...selection, isCollapsed: true }), null)
  const outside = fakeNode({ selectors: [CHAT_FLOW_SELECTOR] })
  assert.equal(resolveSurface(outside, selection), null)
  assert.equal(resolveSurface(chat, { ...selection, toString: () => '   ' }), null)
})

test('resolveSurface: a plain right-click on a message uses that message text', () => {
  const user = fakeNode({
    selectors: [CHAT_FLOW_SELECTOR, CHAT_NODE_SELECTOR],
    dataset: { chatFlowKind: 'user' },
    innerText: 'hi\n10月20日 23:51',
  })
  assert.deepEqual(resolveSurface(user, null), { kind: 'conversation', element: user, text: 'hi' })
  const assistant = fakeNode({
    selectors: [CHAT_FLOW_SELECTOR, CHAT_NODE_SELECTOR],
    dataset: { chatFlowKind: 'assistant-step' },
    innerText: 'Hey! 👋 What can I help you with today?',
  })
  assert.deepEqual(resolveSurface(assistant, null), {
    kind: 'conversation', element: assistant, text: 'Hey! 👋 What can I help you with today?',
  })
  const process = fakeNode({
    selectors: [CHAT_FLOW_SELECTOR, CHAT_NODE_SELECTOR],
    dataset: { chatFlowKind: 'turn-process' },
    innerText: '已完成，用时 30秒',
  })
  assert.equal(resolveSurface(process, null), null)
  const empty = fakeNode({
    selectors: [CHAT_FLOW_SELECTOR, CHAT_NODE_SELECTOR],
    dataset: { chatFlowKind: 'assistant-step' },
  })
  assert.equal(resolveSurface(empty, null), null)
})

test('resolveSurface: a selection still wins over the message fallback', () => {
  const anchor = { nodeType: 3 }
  const node = fakeNode({
    selectors: [CHAT_FLOW_SELECTOR, CHAT_NODE_SELECTOR],
    dataset: { chatFlowKind: 'assistant-step' },
    contains: [anchor],
    innerText: 'the whole message',
  })
  const selection = { isCollapsed: false, anchorNode: anchor, focusNode: anchor, toString: () => 'part' }
  assert.deepEqual(resolveSurface(node, selection), { kind: 'conversation', element: node, text: 'part' })
})

test('messageText: strips the user bubble clock line only', () => {
  assert.equal(messageText({ innerText: 'hi\n10月20日 23:51' }), 'hi')
  assert.equal(messageText({ innerText: 'answer\n\n23:51' }), 'answer')
  assert.equal(messageText({ innerText: 'line one\n23:51 or later' }), 'line one\n23:51 or later')
  assert.equal(messageText({ innerText: '   ' }), '')
})

test('resolveSurface: presented file cards and inline mentions are file surfaces', () => {
  const preview = { click() {}, getAttribute: name => (name === 'title' ? 'C:\\work\\a\\report.md' : null) }
  const card = fakeNode({ selectors: [PRESENTED_FILE_SELECTOR], querySelector: preview })
  assert.deepEqual(resolveSurface(card, null), {
    kind: 'file', path: 'C:\\work\\a\\report.md', root: undefined, entry: 'file', preview,
  })
  const mention = fakeNode({ selectors: [FILE_LINK_SELECTOR], title: 'outputs/a/report.md' })
  assert.deepEqual(resolveSurface(mention, null), {
    kind: 'file', path: 'outputs/a/report.md', root: undefined, entry: 'file', preview: mention,
  })
  const action = fakeNode({ selectors: [FILE_LINK_SELECTOR], title: 'Copy message' })
  assert.equal(resolveSurface(action, null), null)
  const emptyCard = fakeNode({ selectors: [PRESENTED_FILE_SELECTOR] })
  assert.equal(resolveSurface(emptyCard, null), null)
})

test('absolutePathFor: joins relative mention paths and keeps rooted ones', () => {
  assert.equal(isAbsolutePath('C:\\work\\a.md'), true)
  assert.equal(isAbsolutePath('\\\\server\\share\\a.md'), true)
  assert.equal(isAbsolutePath('outputs/a.md'), false)
  assert.equal(absolutePathFor('C:\\work', 'outputs/a.md'), 'C:/work/outputs/a.md')
  assert.equal(absolutePathFor('C:\\work', 'C:\\other\\a.md'), 'C:\\other\\a.md')
  assert.equal(absolutePathFor(undefined, 'outputs/a.md'), 'outputs/a.md')
})

test('resolveSurface: unknown targets keep the native menu', () => {
  assert.equal(resolveSurface(null, null), null)
  assert.equal(resolveSurface(fakeNode(), null), null)
})

test('relativePath: root-relative with either separator and Windows case folding', () => {
  assert.equal(relativePath('C:\\Users\\me\\work', 'C:\\Users\\me\\work\\a\\b.md'), 'a/b.md')
  assert.equal(relativePath('C:/Users/me/work/', 'C:/Users/me/work/a/b.md'), 'a/b.md')
  assert.equal(relativePath('C:\\Users\\me\\WORK', 'C:\\Users\\me\\work\\a.md'), 'a.md')
  assert.equal(relativePath('C:/work', 'C:/work'), '')
  assert.equal(relativePath('C:/work', 'D:/elsewhere/a.md'), 'D:/elsewhere/a.md')
  assert.equal(relativePath(undefined, 'C:\\work\\a.md'), 'C:/work/a.md')
})

test('quoteBlock / draftBlock: blank lines survive as bare quote markers', () => {
  assert.equal(quoteBlock('one\n\ntwo'), '> one\n>\n> two')
  assert.equal(quoteBlock('  trailing  '), '> trailing')
  assert.equal(quoteBlock('   '), '')
  assert.equal(draftBlock('one'), '\n\n> one\n\n')
  assert.equal(draftBlock(''), '')
})

test('fileNameOf: both separator styles', () => {
  assert.equal(fileNameOf('C:\\work\\a\\notes.md'), 'notes.md')
  assert.equal(fileNameOf('a/b/c.tar.gz'), 'c.tar.gz')
  assert.equal(fileNameOf('top'), 'top')
})

test('resolveSurface: trend rows resolve their JSON payload and win over the chat chain', () => {
  const payload = JSON.stringify({
    title: '苹果发布会', url: 'https://a.com/1', source: '微博热搜', platform: 'weibo', rank: 3,
  })
  const row = fakeNode({ selectors: [TREND_ROW_SELECTOR], dataset: { easelTrend: payload } })
  assert.deepEqual(resolveSurface(row, null), {
    kind: 'trend', element: row,
    trend: { title: '苹果发布会', url: 'https://a.com/1', source: '微博热搜', platform: 'weibo', rank: 3 },
  })
  const nested = fakeNode({ selectors: [], dataset: {}, parent: fakeNode({ selectors: [TREND_ROW_SELECTOR], dataset: { easelTrend: payload } }) })
  assert.equal(resolveSurface(nested, null)?.kind, 'trend', 'closest walks up from a child control')
})

test('resolveSurface: malformed or title-less trend payload is no menu surface', () => {
  assert.equal(resolveSurface(fakeNode({ selectors: [TREND_ROW_SELECTOR], dataset: { easelTrend: '{oops' } }), null), null)
  assert.equal(resolveSurface(fakeNode({ selectors: [TREND_ROW_SELECTOR], dataset: { easelTrend: JSON.stringify({ url: 'x' }) } }), null), null)
  assert.equal(resolveSurface(fakeNode({ selectors: [TREND_ROW_SELECTOR], dataset: {} }), null), null)
})

test('trendPayloadOf: rank/hot optional, url defaults to empty string', () => {
  assert.deepEqual(trendPayloadOf({ dataset: { easelTrend: JSON.stringify({ title: 'T', platform: 'douyin' }) } }),
    { title: 'T', url: '', source: '', platform: 'douyin' })
  assert.deepEqual(trendPayloadOf({ dataset: { easelTrend: JSON.stringify({ title: 'T', hot: '99', rank: 2 }) } }),
    { title: 'T', url: '', source: '', platform: '', rank: 2, hot: '99' })
  assert.equal(trendPayloadOf(null), null)
  assert.equal(trendPayloadOf({ dataset: { easelTrend: JSON.stringify({ title: '  ' }) } }), null)
})
