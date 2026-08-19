import { SELF } from 'cloudflare:test'
import { createSessionToken } from '../auth'

/** Must match `.dev.vars`'s SESSION_SECRET - the test-only value used by vitest-pool-workers, never the real deployed secret. */
const TEST_SESSION_SECRET = 'test-only-session-secret-do-not-use-in-production'

/**
 * Drop-in replacement for `SELF.fetch` that attaches a valid session cookie, for tests that exercise
 * something other than the login gate itself (see loginGate.test.ts for gate/login-flow coverage).
 * Mints the cookie directly from the shared test secret rather than going through the real
 * `/api/auth/login` + CAPTCHA flow, since that's not what these tests are checking.
 */
export async function authedFetch(input: string | Request, init: RequestInit = {}): Promise<Response> {
  const token = await createSessionToken(TEST_SESSION_SECRET)
  return SELF.fetch(input, { ...init, headers: { ...(init.headers ?? {}), cookie: `aom_session=${token}` } })
}
