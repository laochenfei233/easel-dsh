/** Removal of Host browser-session cookies that earlier launches left in the shell's cookie jar. */

/** Prefix of every cookie the Host's browser authentication mints. */
const AUTH_COOKIE_PREFIX = 'dsh-auth-'

/** Cookie-store operations a stale-session purge needs; Electron's Cookies API satisfies them. */
export interface AuthCookieStore {
  /**
   * @param filter - empty selects every cookie in the session.
   * @returns cookies with the name, domain, path, and Secure flag the purge needs.
   */
  get(filter: { url?: string }): Promise<readonly {
    readonly name: string
    readonly domain?: string
    readonly path?: string
    readonly secure?: boolean
  }[]>
  /**
   * @param url - address whose host selects the cookie.
   * @param name - exact cookie name.
   */
  remove(url: string, name: string): Promise<void>
}

/**
 * Delete every Host browser-session cookie before this launch mints its own.
 * The Host listens on a port chosen per launch, and browsers send a host's
 * cookies to every port, so cookies from earlier launches keep riding along
 * after their port stops matching; enough of them overflow the Host's request
 * header limit, which the welcome flow reports as an authentication failure.
 * @param store - Electron session cookie store.
 */
export async function clearStaleAuthCookies(store: AuthCookieStore): Promise<void> {
  for (const cookie of await store.get({})) {
    if (!cookie.name.startsWith(AUTH_COOKIE_PREFIX) || cookie.domain === undefined) continue
    const scheme = cookie.secure === true ? 'https' : 'http'
    await store.remove(`${scheme}://${cookie.domain.replace(/^\./u, '')}${cookie.path ?? '/'}`, cookie.name)
  }
}
