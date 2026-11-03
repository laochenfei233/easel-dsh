/** Desktop startup purge of Host session cookies left by earlier launches. */
import { describe, expect, it } from 'vitest'
import { clearStaleAuthCookies, type AuthCookieStore } from '../src/auth-cookies.ts'

type StoredCookie = Awaited<ReturnType<AuthCookieStore['get']>>[number]

function fakeStore(cookies: readonly StoredCookie[]): { store: AuthCookieStore; removed: string[] } {
  const removed: string[] = []
  return {
    store: {
      async get() { return cookies },
      async remove(url, name) { removed.push(`${url} ${name}`) },
    },
    removed,
  }
}

describe('desktop stale authentication cookies', () => {
  it('removes every Host session cookie before the launch mints its own', async () => {
    const { store, removed } = fakeStore([
      { name: 'dsh-auth-port-51234', domain: '127.0.0.1', path: '/', secure: false },
      { name: 'dsh-auth-port-51235', domain: '127.0.0.1', path: '/', secure: false },
      { name: 'dsh-auth-tls', domain: '127.0.0.1', path: '/', secure: true },
      { name: 'unrelated', domain: '127.0.0.1', path: '/', secure: false },
      { name: 'dsh-auth-dotted', domain: '.example.test', path: '/app', secure: false },
    ])
    await clearStaleAuthCookies(store)
    expect(removed).toEqual([
      'http://127.0.0.1/ dsh-auth-port-51234',
      'http://127.0.0.1/ dsh-auth-port-51235',
      'https://127.0.0.1/ dsh-auth-tls',
      'http://example.test/app dsh-auth-dotted',
    ])
  })

  it('surfaces a store failure instead of reporting a clean purge', async () => {
    const store: AuthCookieStore = {
      async get() { return [{ name: 'dsh-auth-stale', domain: '127.0.0.1', path: '/', secure: false }] },
      async remove() { throw new Error('cookie store unavailable') },
    }
    await expect(clearStaleAuthCookies(store)).rejects.toThrow('cookie store unavailable')
  })
})
