/**
 * Records login attempts against the site-wide gate, so "who reviewed this demo, and when" is
 * answerable after the fact. Cloudflare's built-in Workers analytics are aggregate-only and expose
 * no client IP, and Logpush is a paid-plan feature, so this is written explicitly.
 *
 * With one shared admin credential there is no identity to record. Visitors are distinguished by
 * IP, approximate location and user agent instead - enough to tell "three different reviewers"
 * from "one reviewer who logged in three times", which is what the count is actually for.
 *
 * The geo fields come from Cloudflare's `request.cf` object, which is city-level at best and
 * absent in local development.
 */
export type LoginOutcome = 'SUCCESS' | 'BAD_CREDENTIALS' | 'FAILED_CAPTCHA'

export interface LoginEventEnv {
  ONBOARDING_DB: D1Database
}

export interface LoginEvent {
  occurredAt: string
  outcome: LoginOutcome
  ipAddress: string | null
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
  network: string | null
  userAgent: string | null
}

/** Reads what Cloudflare already knows about the caller. No extra lookup or third-party service. */
export function describeCaller(request: Request, outcome: LoginOutcome): LoginEvent {
  const cf = request.cf as IncomingRequestCfProperties | undefined
  return {
    occurredAt: new Date().toISOString(),
    outcome,
    ipAddress: request.headers.get('cf-connecting-ip'),
    country: (cf?.country as string) ?? null,
    region: (cf?.region as string) ?? null,
    city: (cf?.city as string) ?? null,
    timezone: (cf?.timezone as string) ?? null,
    network: (cf?.asOrganization as string) ?? null,
    userAgent: request.headers.get('user-agent'),
  }
}

/**
 * Never throws: a logging failure must not stop someone signing in. A failure to record is
 * surfaced to Workers Logs instead, where it is visible without breaking the gate.
 */
export async function recordLoginEvent(env: LoginEventEnv, event: LoginEvent): Promise<void> {
  try {
    await env.ONBOARDING_DB.prepare(
      `INSERT INTO auth_login_event
         (id, occurred_at, outcome, ip_address, country, region, city, timezone, network, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), event.occurredAt, event.outcome, event.ipAddress,
      event.country, event.region, event.city, event.timezone, event.network, event.userAgent,
    ).run()
  } catch (reason) {
    console.error('login-event write failed', { outcome: event.outcome, reason: String(reason) })
  }
}
