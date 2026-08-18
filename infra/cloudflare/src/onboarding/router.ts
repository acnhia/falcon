import { ApplicationNotFoundError, InvalidCaptureLinkError, TaskValidationError, jsonResponse } from './db'
import { createApplication, getApplicationStatus, getResumeState } from './applications'
import { saveActivityDraft, continueActivity } from './activities'
import { IllegalStateTransitionError, getCaptureContext, issueCaptureLink, uploadDocument } from './captures'
import { DocumentValidationError } from './documentValidation'
import { AssistantEnv, handleRealtimeSessionRequest } from './assistant'

/** Allowlisted onboarding routes - the Cloudflare-deployment counterpart of OnboardingController/CaptureController. */
export async function handleOnboardingRequest(request: Request, env: AssistantEnv): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  try {
    if (request.method === 'POST' && path === '/api/onboarding/applications') {
      return jsonResponse(await createApplication(env), 200)
    }

    if (request.method === 'POST' && path === '/api/onboarding/assistant/realtime-session') {
      return handleRealtimeSessionRequest(request, env)
    }

    const resumeMatch = path.match(/^\/api\/onboarding\/applications\/([^/]+)\/resume$/)
    if (request.method === 'GET' && resumeMatch) {
      return jsonResponse(await getResumeState(env, resumeMatch[1]))
    }

    const activityContinueMatch = path.match(/^\/api\/onboarding\/applications\/([^/]+)\/activities\/(\d+)\/continue$/)
    if (request.method === 'POST' && activityContinueMatch) {
      const body = await request.json<{ idempotencyKey: string }>()
      return jsonResponse(await continueActivity(env, activityContinueMatch[1], Number(activityContinueMatch[2]), body.idempotencyKey))
    }

    const activityDraftMatch = path.match(/^\/api\/onboarding\/applications\/([^/]+)\/activities\/(\d+)$/)
    if (request.method === 'PUT' && activityDraftMatch) {
      const body = await request.json<{ fields: Record<string, string>; idempotencyKey: string }>()
      return jsonResponse(await saveActivityDraft(env, activityDraftMatch[1], Number(activityDraftMatch[2]), body.fields, body.idempotencyKey))
    }

    const captureLinkMatch = path.match(/^\/api\/onboarding\/applications\/([^/]+)\/capture-links$/)
    if (request.method === 'POST' && captureLinkMatch) {
      const link = await issueCaptureLink(env, captureLinkMatch[1])
      const captureUrl = `${url.origin}/#/capture/${link.rawToken}`
      return jsonResponse({ captureUrl, expiresAt: link.expiresAt })
    }

    const applicationStatusMatch = path.match(/^\/api\/onboarding\/applications\/([^/]+)$/)
    if (request.method === 'GET' && applicationStatusMatch) {
      return jsonResponse(await getApplicationStatus(env, applicationStatusMatch[1]))
    }

    const captureDocumentMatch = path.match(/^\/api\/onboarding\/captures\/([^/]+)\/documents\/(front|back)$/)
    if (request.method === 'PUT' && captureDocumentMatch) {
      const content = new Uint8Array(await request.arrayBuffer())
      const contentType = request.headers.get('content-type') ?? 'application/octet-stream'
      return jsonResponse(await uploadDocument(env, captureDocumentMatch[1], captureDocumentMatch[2] as 'front' | 'back', content, contentType))
    }

    const captureContextMatch = path.match(/^\/api\/onboarding\/captures\/([^/]+)$/)
    if (request.method === 'GET' && captureContextMatch) {
      return jsonResponse(await getCaptureContext(env, captureContextMatch[1]))
    }

    return jsonResponse({ error: 'Not found' }, 404)
  } catch (error) {
    return mapError(error)
  }
}

function mapError(error: unknown): Response {
  if (error instanceof ApplicationNotFoundError || error instanceof InvalidCaptureLinkError) {
    return jsonResponse({ error: (error as Error).message }, 404)
  }
  if (error instanceof IllegalStateTransitionError) {
    return jsonResponse({ error: error.message }, 409)
  }
  if (error instanceof DocumentValidationError || error instanceof TaskValidationError) {
    return jsonResponse({ error: error.message }, 400)
  }
  throw error
}
