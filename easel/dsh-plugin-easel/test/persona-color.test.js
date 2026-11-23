import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PERSONA_PALETTE, personaColor } from '../src/lib/persona-color.js'

test('personaColor returns the explicit color when set', () => {
  assert.equal(personaColor('美食号', { '美食号': '#123abc' }), '#123abc')
})

test('personaColor ignores malformed explicit colors', () => {
  assert.notEqual(personaColor('美食号', { '美食号': 'red' }), 'red')
  assert.match(personaColor('美食号', { '美食号': 'red' }), /^#[0-9a-f]{6}$/i)
})

test('personaColor is stable for the same name and in the palette', () => {
  const a = personaColor('美食号')
  const b = personaColor('美食号')
  assert.equal(a, b)
  assert.ok(PERSONA_PALETTE.includes(a))
})

test('personaColor distributes distinct names across the palette', () => {
  const names = ['美食号', '科技号', '旅行号', '职场号', '母婴号', '健身号', '数码号', '美妆号', '读书号', '游戏号', '汽车号']
  const used = new Set(names.map((n) => personaColor(n)))
  assert.ok(used.size >= 5, `expected broad distribution, got ${used.size}`)
})

test('personaColor handles empty and unicode names without crashing', () => {
  assert.match(personaColor(''), /^#[0-9a-f]{6}$/i)
  assert.match(personaColor('🚀火箭画像'), /^#[0-9a-f]{6}$/i)
})
