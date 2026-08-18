/**
 * Ported from com.falcon.onboarding (backend/src/main/java/com/falcon/onboarding/) -
 * the Java backend stays the reference implementation for local/container dev;
 * this is a parallel implementation of the same API contract for the
 * Cloudflare deployment path (Workers can't run the Spring Boot JAR).
 */
export interface OnboardingEnv {
  ONBOARDING_DB: D1Database
  UPLOADS: R2Bucket
}

export const TOTAL_ACTIVITIES = 21
export const STORAGE_PREFIX = 'onboarding'

export class ApplicationNotFoundError extends Error {
  constructor(publicReference: string) {
    super(`No onboarding application found for reference ${publicReference}`)
  }
}

export class InvalidCaptureLinkError extends Error {
  constructor() {
    super('This capture link is invalid, expired, or has already been used')
  }
}

export class TaskValidationError extends Error {}

export interface ApplicationRow {
  id: string
  public_reference: string
  overall_status: string
  validation_triggered: number
}

export async function findApplicationByPublicReference(env: OnboardingEnv, publicReference: string): Promise<ApplicationRow> {
  const row = await env.ONBOARDING_DB.prepare('SELECT * FROM onboarding_application WHERE public_reference = ?')
    .bind(publicReference).first<ApplicationRow>()
  if (!row) throw new ApplicationNotFoundError(publicReference)
  return row
}

export async function findApplicationById(env: OnboardingEnv, id: string): Promise<ApplicationRow | null> {
  return env.ONBOARDING_DB.prepare('SELECT * FROM onboarding_application WHERE id = ?').bind(id).first<ApplicationRow>()
}

export async function updateActivityStatus(
  env: OnboardingEnv, applicationId: string, activityNumber: number, status: string, blockedReasonCode: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  const result = await env.ONBOARDING_DB.prepare(
    'UPDATE onboarding_activity SET status = ?, blocked_reason_code = ?, updated_at = ? WHERE application_id = ? AND activity_number = ?',
  ).bind(status, blockedReasonCode, now, applicationId, activityNumber).run()
  if (result.meta.changes === 0) {
    await env.ONBOARDING_DB.prepare(
      'INSERT INTO onboarding_activity (application_id, activity_number, status, blocked_reason_code, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(applicationId, activityNumber, status, blockedReasonCode, now).run()
  }
}

export interface ActivityRow {
  activity_number: number
  status: string
  blocked_reason_code: string | null
}

export async function findAllActivities(env: OnboardingEnv, applicationId: string): Promise<ActivityRow[]> {
  const result = await env.ONBOARDING_DB.prepare(
    'SELECT activity_number, status, blocked_reason_code FROM onboarding_activity WHERE application_id = ? ORDER BY activity_number',
  ).bind(applicationId).all<ActivityRow>()
  return result.results
}

export function currentActivityNumber(activities: ActivityRow[]): number {
  const incomplete = activities.find((a) => a.status !== 'COMPLETED' && a.status !== 'NOT_APPLICABLE')
  return incomplete ? incomplete.activity_number : TOTAL_ACTIVITIES
}

export function completionPercentage(activities: ActivityRow[]): number {
  if (activities.length === 0) return 0
  const done = activities.filter((a) => a.status === 'COMPLETED' || a.status === 'NOT_APPLICABLE').length
  return Math.round((done * 100) / activities.length)
}

export function wizardScreenFor(activityNumber: number): number {
  if (activityNumber <= 2) return 1
  if (activityNumber <= 4) return 2
  if (activityNumber <= 7) return 3
  if (activityNumber <= 10) return 4
  if (activityNumber <= 13) return 5
  if (activityNumber <= 16) return 6
  if (activityNumber <= 19) return 7
  return 8
}

export async function recordAuditEvent(
  env: OnboardingEnv, applicationId: string, eventType: string, activityNumber: number | null, correlationId: string,
): Promise<void> {
  await env.ONBOARDING_DB.prepare(
    'INSERT INTO application_audit_event (id, application_id, event_type, activity_number, actor, correlation_id, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), applicationId, eventType, activityNumber, 'SYSTEM', correlationId, new Date().toISOString(), null).run()
}

/** Idempotency check-before-do: true if this key was already recorded as COMPLETED for this application. */
export async function isOperationAlreadyCompleted(env: OnboardingEnv, applicationId: string, idempotencyKey: string): Promise<boolean> {
  const row = await env.ONBOARDING_DB.prepare(
    "SELECT 1 FROM workflow_operation WHERE application_id = ? AND idempotency_key = ? AND status = 'COMPLETED'",
  ).bind(applicationId, idempotencyKey).first()
  return row !== null
}

export async function recordOperationCompleted(
  env: OnboardingEnv, applicationId: string, idempotencyKey: string, operationType: string,
): Promise<void> {
  const result = await env.ONBOARDING_DB.prepare(
    "UPDATE workflow_operation SET status = 'COMPLETED', operation_type = ? WHERE application_id = ? AND idempotency_key = ?",
  ).bind(operationType, applicationId, idempotencyKey).run()
  if (result.meta.changes === 0) {
    await env.ONBOARDING_DB.prepare(
      "INSERT INTO workflow_operation (application_id, idempotency_key, operation_type, status, error_code, created_at) VALUES (?, ?, ?, 'COMPLETED', NULL, ?)",
    ).bind(applicationId, idempotencyKey, operationType, new Date().toISOString()).run()
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}
