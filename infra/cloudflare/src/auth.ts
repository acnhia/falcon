/**
 * Site-wide login gate (see index.ts) - a single shared admin credential plus a Turnstile CAPTCHA guard
 * a whole session, not any one screen. Sessions are a stateless, HMAC-signed cookie (no server-side
 * session store/table needed): `${issuedAtMs}.${hmacHex}`, verified by recomputing the HMAC and checking
 * the timestamp is both not in the future and within SESSION_TTL_MS.
 */
export const SESSION_COOKIE_NAME = 'aom_session'
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000

export interface AuthEnv {
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
}

export async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createSessionToken(secret: string): Promise<string> {
  const payload = String(Date.now())
  return `${payload}.${await signPayload(secret, payload)}`
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false
  const separator = token.indexOf('.')
  if (separator < 0) return false
  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  const expected = await signPayload(secret, payload)
  if (!timingSafeEqual(signature, expected)) return false

  const issuedAt = Number(payload)
  if (!Number.isFinite(issuedAt)) return false
  const age = Date.now() - issuedAt
  return age >= 0 && age < SESSION_TTL_MS
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
  return match?.slice(SESSION_COOKIE_NAME.length + 1)
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
}

/** Verifies a Turnstile response token server-side; the widget's secret key never reaches the browser. */
export async function verifyCaptcha(secretKey: string, responseToken: string, remoteIp?: string): Promise<boolean> {
  if (!responseToken) return false
  const body = new URLSearchParams({ secret: secretKey, response: responseToken })
  if (remoteIp) body.set('remoteip', remoteIp)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
  if (!response.ok) return false
  const result = await response.json<{ success: boolean }>()
  return result.success === true
}

export function verifyCredentials(env: AuthEnv, username: string, password: string): boolean {
  return username === (env.ADMIN_USERNAME || 'admin') && password === (env.ADMIN_PASSWORD || 'admin')
}
