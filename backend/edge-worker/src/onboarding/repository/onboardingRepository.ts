/**
 * D1 persistence for the onboarding workflow - the Cloudflare counterpart of the
 * repository/jdbc package in the Java reference implementation. Every SQL statement in the
 * onboarding module lives here; services above call these functions and never touch D1 directly.
 */
import { ActivityRow } from '../domain/activityProgress'
import { ApplicationNotFoundError } from '../domain/errors'

export interface OnboardingEnv {
  ONBOARDING_DB: D1Database
  UPLOADS: R2Bucket
}

export const STORAGE_PREFIX = 'onboarding'

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

export async function findAllActivities(env: OnboardingEnv, applicationId: string): Promise<ActivityRow[]> {
  const result = await env.ONBOARDING_DB.prepare(
    'SELECT activity_number, status, blocked_reason_code FROM onboarding_activity WHERE application_id = ? ORDER BY activity_number',
  ).bind(applicationId).all<ActivityRow>()
  return result.results
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
