import {
  ApplicationRow, OnboardingEnv, TOTAL_ACTIVITIES, completionPercentage, currentActivityNumber,
  findApplicationByPublicReference, findAllActivities, updateActivityStatus, wizardScreenFor,
} from './db'

export interface ApplicationSummary {
  publicReference: string
  status: string
}

export async function createApplication(env: OnboardingEnv): Promise<ApplicationSummary> {
  const id = crypto.randomUUID()
  const publicReference = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.ONBOARDING_DB.prepare(
    'INSERT INTO onboarding_application (id, public_reference, overall_status, validation_triggered, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
  ).bind(id, publicReference, 'DRAFT', now, now).run()

  for (let activityNumber = 1; activityNumber <= TOTAL_ACTIVITIES; activityNumber++) {
    await env.ONBOARDING_DB.prepare(
      'INSERT INTO onboarding_activity (application_id, activity_number, status, blocked_reason_code, updated_at) VALUES (?, ?, ?, NULL, ?)',
    ).bind(id, activityNumber, 'NOT_STARTED', now).run()
  }
  // Activity 2 ("create or resume application") is a system activity, completed by the act of
  // creating this row; activity 1 (consent) is a user activity, completed only via /activities/1/continue.
  await updateActivityStatus(env, id, 2, 'COMPLETED', null)

  return { publicReference, status: 'DRAFT' }
}

export async function getApplicationStatus(env: OnboardingEnv, publicReference: string): Promise<ApplicationSummary> {
  const application = await findApplicationByPublicReference(env, publicReference)
  return { publicReference: application.public_reference, status: application.overall_status }
}

export interface ResumeState {
  publicReference: string
  currentActivityNumber: number
  wizardScreen: number
  completionPercentage: number
  activities: { activityNumber: number; status: string; blockedReasonCode: string | null }[]
  fieldValues: Record<string, string>
}

export async function getResumeState(env: OnboardingEnv, publicReference: string): Promise<ResumeState> {
  const application = await findApplicationByPublicReference(env, publicReference)
  return buildResumeState(env, application)
}

export async function buildResumeState(env: OnboardingEnv, application: ApplicationRow): Promise<ResumeState> {
  const activities = await findAllActivities(env, application.id)
  const current = currentActivityNumber(activities)

  const values = await env.ONBOARDING_DB.prepare(
    'SELECT field_key, value FROM application_field_value WHERE application_id = ?',
  ).bind(application.id).all<{ field_key: string; value: string | null }>()
  const fieldValues: Record<string, string> = {}
  for (const row of values.results) {
    if (row.value !== null) fieldValues[row.field_key] = row.value
  }

  return {
    publicReference: application.public_reference,
    currentActivityNumber: current,
    wizardScreen: wizardScreenFor(current),
    completionPercentage: completionPercentage(activities),
    activities: activities.map((a) => ({
      activityNumber: a.activity_number, status: a.status, blockedReasonCode: a.blocked_reason_code,
    })),
    fieldValues,
  }
}
