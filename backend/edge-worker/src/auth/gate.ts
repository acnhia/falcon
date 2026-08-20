/**
 * Site-wide login gate. Every request passes through here before reaching any page, asset, API or
 * download, so an unauthenticated browser session can reach nothing (see REQUIREMENTS.md).
 */
import { renderLoginPage } from './loginPage'
import { createSessionToken, sessionCookieHeader, verifyCaptcha, verifyCredentials } from './session'
import { Env, html, json } from '../platform/env'
import { describeCaller, recordLoginEvent } from './loginEventRepository'

/** Login page for unauthenticated page/asset requests; a 401 for API and download requests. */
export function denyUnauthenticated(env: Env, pathname: string): Response {
  if (pathname.startsWith('/api/') || pathname.startsWith('/downloads/')) {
    return json({ error: 'Login required' }, 401)
  }
  return html(renderLoginPage(env.TURNSTILE_SITE_KEY))
}

export async function handleLoginRequest(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET) return json({ error: 'Login is not configured' }, 503)

  const form = await request.formData()
  const username = String(form.get('username') ?? '')
  const password = String(form.get('password') ?? '')
  const captchaToken = String(form.get('cf-turnstile-response') ?? '')

  const captchaOk = env.TURNSTILE_SECRET_KEY
    ? await verifyCaptcha(env.TURNSTILE_SECRET_KEY, captchaToken, request.headers.get('cf-connecting-ip') ?? undefined)
    : false

  if (!captchaOk || !verifyCredentials(env, username, password)) {
    // Failed attempts are recorded too - a burst of them is the signal that matters.
    await recordLoginEvent(env, describeCaller(request, captchaOk ? 'BAD_CREDENTIALS' : 'FAILED_CAPTCHA'))
    return html(renderLoginPage(env.TURNSTILE_SITE_KEY, { error: 'Invalid username, password, or verification - please try again.' }), 401)
  }

  await recordLoginEvent(env, describeCaller(request, 'SUCCESS'))
  const token = await createSessionToken(env.SESSION_SECRET)
  return new Response(null, { status: 302, headers: { location: '/', 'set-cookie': sessionCookieHeader(token) } })
}
