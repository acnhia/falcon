import {
  OnboardingEnv, TaskValidationError, findApplicationByPublicReference, isOperationAlreadyCompleted,
  recordAuditEvent, recordOperationCompleted, updateActivityStatus,
} from './db'
import { buildResumeState, ResumeState } from './applications'
import { evaluateAgeIdentityPrecheck } from './mockChecks'

const CONSENT_ACTIVITY = 1
/** Only activities 1 (consent) and 3 (personal information) have real save/continue logic in this phase. */
const PERSONAL_INFORMATION_ACTIVITY = 3
const AGE_IDENTITY_PRECHECK_ACTIVITY = 4
const DATE_OF_BIRTH_FIELD = 'dateOfBirth'

export async function saveActivityDraft(
  env: OnboardingEnv, publicReference: string, activityNumber: number, fields: Record<string, string>, idempotencyKey: string,
): Promise<ResumeState> {
  const application = await findApplicationByPublicReference(env, publicReference)
  if (await isOperationAlreadyCompleted(env, application.id, idempotencyKey)) {
    return buildResumeState(env, application)
  }
  requireSupportedActivity(activityNumber)

  const before = await currentFieldValues(env, application.id)
  const previousDateOfBirth = before[DATE_OF_BIRTH_FIELD] ?? null

  const now = new Date().toISOString()
  for (const [fieldKey, value] of Object.entries(fields)) {
    await upsertFieldValue(env, application.id, fieldKey, value, now)
  }

  await markStaleIfDateOfBirthChanged(env, application.id, previousDateOfBirth, fields[DATE_OF_BIRTH_FIELD] ?? null)

  const activity3 = await env.ONBOARDING_DB.prepare(
    'SELECT status FROM onboarding_activity WHERE application_id = ? AND activity_number = ?',
  ).bind(application.id, PERSONAL_INFORMATION_ACTIVITY).first<{ status: string }>()
  if (!activity3 || activity3.status !== 'COMPLETED') {
    await updateActivityStatus(env, application.id, PERSONAL_INFORMATION_ACTIVITY, 'IN_PROGRESS', null)
  }

  await recordOperationCompleted(env, application.id, idempotencyKey, 'SaveActivityDraft')
  await recordAuditEvent(env, application.id, 'ACTIVITY_DRAFT_SAVED', activityNumber, idempotencyKey)
  return buildResumeState(env, application)
}

export async function continueActivity(
  env: OnboardingEnv, publicReference: string, activityNumber: number, idempotencyKey: string,
): Promise<ResumeState> {
  const application = await findApplicationByPublicReference(env, publicReference)
  if (await isOperationAlreadyCompleted(env, application.id, idempotencyKey)) {
    return buildResumeState(env, application)
  }

  if (activityNumber === CONSENT_ACTIVITY) {
    await updateActivityStatus(env, application.id, CONSENT_ACTIVITY, 'COMPLETED', null)
    await recordOperationCompleted(env, application.id, idempotencyKey, 'ContinueActivity')
    await recordAuditEvent(env, application.id, 'ACTIVITY_CONTINUED', activityNumber, idempotencyKey)
    return buildResumeState(env, application)
  }
  requireSupportedActivity(activityNumber)

  const values = await currentFieldValues(env, application.id)
  const definitions = await env.ONBOARDING_DB.prepare(
    'SELECT field_key, required FROM field_definition WHERE activity_number = ?',
  ).bind(PERSONAL_INFORMATION_ACTIVITY).all<{ field_key: string; required: number }>()
  const missing = definitions.results
    .filter((d) => d.required === 1)
    .map((d) => d.field_key)
    .filter((key) => !values[key]?.trim())
  if (missing.length > 0) {
    throw new TaskValidationError(`Missing required fields: ${missing.join(', ')}`)
  }

  await updateActivityStatus(env, application.id, PERSONAL_INFORMATION_ACTIVITY, 'COMPLETED', null)
  await runAgeIdentityPrecheck(env, application.id, values[DATE_OF_BIRTH_FIELD] ?? null, idempotencyKey)

  await recordOperationCompleted(env, application.id, idempotencyKey, 'ContinueActivity')
  await recordAuditEvent(env, application.id, 'ACTIVITY_CONTINUED', activityNumber, idempotencyKey)
  return buildResumeState(env, application)
}

async function runAgeIdentityPrecheck(env: OnboardingEnv, applicationId: string, dateOfBirth: string | null, correlationId: string) {
  const result = evaluateAgeIdentityPrecheck(dateOfBirth, new Date())

  await env.ONBOARDING_DB.prepare(
    'INSERT INTO provider_check (id, application_id, check_type, provider_mode, status, result_code, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), applicationId, 'AGE_IDENTITY_PRECHECK', 'MOCK', result, result, correlationId, new Date().toISOString()).run()

  const status = result === 'PASS' ? 'COMPLETED' : 'BLOCKED'
  const reasonCode = result === 'PASS' ? null : result
  await updateActivityStatus(env, applicationId, AGE_IDENTITY_PRECHECK_ACTIVITY, status, reasonCode)
}

async function markStaleIfDateOfBirthChanged(
  env: OnboardingEnv, applicationId: string, previousDateOfBirth: string | null, newDateOfBirth: string | null,
) {
  if (!newDateOfBirth || newDateOfBirth === previousDateOfBirth) return
  const activity4 = await env.ONBOARDING_DB.prepare(
    'SELECT status FROM onboarding_activity WHERE application_id = ? AND activity_number = ?',
  ).bind(applicationId, AGE_IDENTITY_PRECHECK_ACTIVITY).first<{ status: string }>()
  if (activity4 && activity4.status === 'COMPLETED') {
    await updateActivityStatus(env, applicationId, AGE_IDENTITY_PRECHECK_ACTIVITY, 'STALE', 'SOURCE_FIELD_CHANGED')
  }
}

async function currentFieldValues(env: OnboardingEnv, applicationId: string): Promise<Record<string, string>> {
  const result = await env.ONBOARDING_DB.prepare(
    'SELECT field_key, value FROM application_field_value WHERE application_id = ?',
  ).bind(applicationId).all<{ field_key: string; value: string | null }>()
  const values: Record<string, string> = {}
  for (const row of result.results) {
    if (row.value !== null) values[row.field_key] = row.value
  }
  return values
}

async function upsertFieldValue(env: OnboardingEnv, applicationId: string, fieldKey: string, value: string, now: string) {
  const result = await env.ONBOARDING_DB.prepare(
    'UPDATE application_field_value SET value = ?, updated_at = ? WHERE application_id = ? AND field_key = ?',
  ).bind(value, now, applicationId, fieldKey).run()
  if (result.meta.changes === 0) {
    await env.ONBOARDING_DB.prepare(
      'INSERT INTO application_field_value (application_id, field_key, value, updated_at) VALUES (?, ?, ?, ?)',
    ).bind(applicationId, fieldKey, value, now).run()
  }
}

function requireSupportedActivity(activityNumber: number) {
  if (activityNumber !== PERSONAL_INFORMATION_ACTIVITY) {
    throw new TaskValidationError(`Activity ${activityNumber} does not yet support save/continue`)
  }
}
