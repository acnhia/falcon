import { SELF } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

function stubTurnstile(success: boolean) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    if (String(input).includes('challenges.cloudflare.com/turnstile')) {
      return new Response(JSON.stringify({ success }), { status: 200 })
    }
    throw new Error(`Unexpected fetch to ${input} in a login-gate test`)
  }))
}

function login(username: string, password: string, captchaToken: string) {
  const body = new URLSearchParams({ username, password, 'cf-turnstile-response': captchaToken })
  return SELF.fetch('https://example.com/api/auth/login', { method: 'POST', body, redirect: 'manual' })
}

describe('login gate', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('serves a login page instead of the app for an unauthenticated page request', async () => {
    const res = await SELF.fetch('https://example.com/')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('cf-turnstile')
    expect(body).toContain('name="username"')
    expect(body).toContain('name="password"')
  })

  it('returns a safe 401 JSON error for an unauthenticated API request, rather than a page', async () => {
    const res = await SELF.fetch('https://example.com/api/onboarding/applications/ref-1/resume')

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns a safe 401 for an unauthenticated download request, even for a real-shaped share token', async () => {
    const res = await SELF.fetch('https://example.com/downloads/some-token')

    expect(res.status).toBe(401)
  })

  it('rejects login with the wrong password even when the CAPTCHA passes', async () => {
    stubTurnstile(true)

    const res = await login('admin', 'wrong-password', 'a-token')

    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('rejects login when the CAPTCHA check fails, even with the right credentials', async () => {
    stubTurnstile(false)

    const res = await login('admin', 'admin', 'a-token')

    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('logs in with the right credentials and a passing CAPTCHA, and the resulting cookie unlocks the API', async () => {
    stubTurnstile(true)

    const loginRes = await login('admin', 'admin', 'a-token')
    expect(loginRes.status).toBe(302)
    expect(loginRes.headers.get('location')).toBe('/')
    const cookie = loginRes.headers.get('set-cookie')
    expect(cookie).toBeTruthy()
    expect(cookie).toContain('HttpOnly')

    const sessionCookie = cookie!.split(';')[0]
    const followUp = await SELF.fetch('https://example.com/api/onboarding/applications/ref-1/resume', {
      headers: { cookie: sessionCookie },
    })
    expect(followUp.status).not.toBe(401)
  })
})
