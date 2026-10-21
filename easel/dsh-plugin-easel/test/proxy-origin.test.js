import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sameOriginAllowed } from '../index.js'

test('requests without an Origin are server-to-server traffic and pass', () => {
  assert.equal(sameOriginAllowed(undefined, '127.0.0.1:3099'), true)
})

test('an Origin identical to dsh Host is the workbench itself and passes', () => {
  assert.equal(sameOriginAllowed('http://127.0.0.1:3099', '127.0.0.1:3099'), true)
  assert.equal(sameOriginAllowed('http://localhost:3099', 'localhost:3099'), true)
})

test('a cross-site Origin cannot ride the proxy', () => {
  assert.equal(sameOriginAllowed('http://evil.example', '127.0.0.1:3099'), false)
  assert.equal(sameOriginAllowed('http://127.0.0.1:7860', '127.0.0.1:3099'), false)
})

test('an Origin with no Host header cannot be verified and is rejected', () => {
  assert.equal(sameOriginAllowed('http://127.0.0.1:3099', undefined), false)
})
