import { env, SELF } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubTurnstile(success: boolean) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    if (String(input).includes('challenges.cloudflare.com/turnstile')) {
      return new Response(JSON.stringify({ success }), { status: 200 })
    }
    throw new Error(`Unexpected fetch to ${input}`)
  }))
}

function login(username: string, password: string) {
  return SELF.fetch('https://example.com/api/auth/login', {
    method: 'POST',
    body: new URLSearchParams({ username, password, 'cf-turnstile-response': 'token' }),
    redirect: 'manual',
  })
}

const events = () => env.ONBOARDING_DB
  .prepare('SELECT outcome, ip_address, user_agent FROM auth_login_event ORDER BY occurred_at')
  .all<{ outcome: string; ip_address: string | null; user_agent: string | null }>()

describe('login access log', () => {
  beforeEach(async () => { await env.ONBOARDING_DB.prepare('DELETE FROM auth_login_event').run() })
  afterEach(() => vi.unstubAllGlobals())

  it('records a successful sign-in', async () => {
    stubTurnstile(true)

    await login('admin', 'admin')

    const { results } = await events()
    expect(results).toHaveLength(1)
    expect(results[0].outcome).toBe('SUCCESS')
  })

  it('records a wrong password separately from a failed captcha, so the two are distinguishable', async () => {
    stubTurnstile(true)
    await login('admin', 'wrong-password')
    stubTurnstile(false)
    await login('admin', 'admin')

    const { results } = await events()
    expect(results.map((r) => r.outcome)).toEqual(['BAD_CREDENTIALS', 'FAILED_CAPTCHA'])
  })

  it('counts repeat sign-ins, which is what "how many times did people log in" needs', async () => {
    stubTurnstile(true)

    await login('admin', 'admin')
    await login('admin', 'admin')
    await login('admin', 'admin')

    const row = await env.ONBOARDING_DB
      .prepare("SELECT COUNT(*) AS n FROM auth_login_event WHERE outcome = 'SUCCESS'")
      .first<{ n: number }>()
    expect(row?.n).toBe(3)
  })

  it('a logging failure never blocks sign-in', async () => {
    stubTurnstile(true)
    await env.ONBOARDING_DB.prepare('DROP TABLE auth_login_event').run()

    const res = await login('admin', 'admin')

    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toBeTruthy()
    await env.ONBOARDING_DB.prepare(
      'CREATE TABLE IF NOT EXISTS auth_login_event (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, outcome TEXT NOT NULL, ip_address TEXT, country TEXT, region TEXT, city TEXT, timezone TEXT, network TEXT, user_agent TEXT)',
    ).run()
  })
})
