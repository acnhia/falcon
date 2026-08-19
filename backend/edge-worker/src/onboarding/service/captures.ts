import { InvalidCaptureLinkError } from '../domain/errors'
import { OnboardingEnv, STORAGE_PREFIX, findApplicationById, findApplicationByPublicReference } from '../repository/onboardingRepository'
import { validateDocument } from '../validation/documentValidation'
import { mockValidateDocuments } from '../workflow/mockChecks'

const CAPTURE_LINK_EXPIRY_MINUTES = 15

export class IllegalStateTransitionError extends Error {}

export interface CaptureLink {
  rawToken: string
  expiresAt: string
}

export async function issueCaptureLink(env: OnboardingEnv, publicReference: string): Promise<CaptureLink> {
  const application = await findApplicationByPublicReference(env, publicReference)
  if (application.overall_status !== 'DRAFT') {
    throw new IllegalStateTransitionError(`Cannot perform 'issuing a capture link' while application is in state ${application.overall_status}`)
  }

  const rawToken = crypto.randomUUID()
  const tokenHash = await sha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + CAPTURE_LINK_EXPIRY_MINUTES * 60_000).toISOString()

  await env.ONBOARDING_DB.prepare(
    'INSERT INTO identity_capture_session (token_hash, application_id, expires_at, consumed) VALUES (?, ?, ?, 0)',
  ).bind(tokenHash, application.id, expiresAt).run()

  await env.ONBOARDING_DB.prepare(
    'UPDATE onboarding_application SET overall_status = ?, updated_at = ? WHERE id = ?',
  ).bind('IDENTITY_CAPTURE_REQUESTED', new Date().toISOString(), application.id).run()

  return { rawToken, expiresAt }
}

export interface CaptureContext {
  frontCaptured: boolean
  backCaptured: boolean
  status: string
}

export async function getCaptureContext(env: OnboardingEnv, rawToken: string): Promise<CaptureContext> {
  const token = await resolveActiveToken(env, rawToken)
  const application = await findApplicationById(env, token.application_id)
  if (!application) throw new InvalidCaptureLinkError()

  const sides = await documentSides(env, application.id)
  return { frontCaptured: sides.has('front'), backCaptured: sides.has('back'), status: application.overall_status }
}

export interface DocumentUploadResult {
  side: string
  accepted: boolean
  bothSidesCaptured: boolean
  status: string
}

export async function uploadDocument(
  env: OnboardingEnv, rawToken: string, side: 'front' | 'back', content: Uint8Array, contentType: string,
): Promise<DocumentUploadResult> {
  const token = await resolveActiveToken(env, rawToken)
  const application = await findApplicationById(env, token.application_id)
  if (!application) throw new InvalidCaptureLinkError()

  validateDocument(content, contentType)

  const objectKey = `${STORAGE_PREFIX}/${application.id}/${side}-${crypto.randomUUID()}.${extensionFor(contentType)}`
  await env.UPLOADS.put(objectKey, content, { httpMetadata: { contentType } })
  const checksum = await sha256Hex(content)
  const capturedAt = new Date().toISOString()

  const updated = await env.ONBOARDING_DB.prepare(
    'UPDATE identity_document SET object_key = ?, mime_type = ?, byte_size = ?, checksum = ?, captured_at = ? WHERE application_id = ? AND side = ?',
  ).bind(objectKey, contentType, content.byteLength, checksum, capturedAt, application.id, side).run()
  if (updated.meta.changes === 0) {
    await env.ONBOARDING_DB.prepare(
      'INSERT INTO identity_document (application_id, side, object_key, mime_type, byte_size, checksum, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(application.id, side, objectKey, contentType, content.byteLength, checksum, capturedAt).run()
  }

  const sides = await documentSides(env, application.id)
  const bothSidesCaptured = sides.has('front') && sides.has('back')
  let status = application.overall_status

  if (bothSidesCaptured) {
    const claimed = await env.ONBOARDING_DB.prepare(
      'UPDATE onboarding_application SET validation_triggered = 1 WHERE id = ? AND validation_triggered = 0',
    ).bind(application.id).run()
    if (claimed.meta.changes === 1) {
      // Exactly one concurrent request wins this race - mirrors the Java aggregate's
      // AtomicBoolean.compareAndSet guard around triggering mock validation once.
      await env.ONBOARDING_DB.prepare(
        'UPDATE identity_capture_session SET consumed = 1 WHERE token_hash = ? AND consumed = 0',
      ).bind(token.token_hash).run()

      mockValidateDocuments()
      status = 'READY_FOR_REVIEW'
      await env.ONBOARDING_DB.prepare(
        'UPDATE onboarding_application SET overall_status = ?, updated_at = ? WHERE id = ?',
      ).bind(status, new Date().toISOString(), application.id).run()
    }
  }

  return { side, accepted: true, bothSidesCaptured, status }
}

interface CaptureSessionRow {
  token_hash: string
  application_id: string
  expires_at: string
  consumed: number
}

async function resolveActiveToken(env: OnboardingEnv, rawToken: string): Promise<CaptureSessionRow> {
  const tokenHash = await sha256Hex(rawToken)
  const row = await env.ONBOARDING_DB.prepare('SELECT * FROM identity_capture_session WHERE token_hash = ?')
    .bind(tokenHash).first<CaptureSessionRow>()
  if (!row) throw new InvalidCaptureLinkError()
  if (row.consumed === 1 || new Date(row.expires_at).getTime() < Date.now()) throw new InvalidCaptureLinkError()
  return row
}

async function documentSides(env: OnboardingEnv, applicationId: string): Promise<Set<string>> {
  const result = await env.ONBOARDING_DB.prepare('SELECT side FROM identity_document WHERE application_id = ?')
    .bind(applicationId).all<{ side: string }>()
  return new Set(result.results.map((r) => r.side))
}

function extensionFor(contentType: string): string {
  const baseType = (contentType.split(';')[0] ?? '').trim().toLowerCase()
  switch (baseType) {
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    default: return 'bin'
  }
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
