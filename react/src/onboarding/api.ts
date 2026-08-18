const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export type DocumentSide = 'front' | 'back'

export interface CreateApplicationResponse {
  publicReference: string
  status: string
}

export interface ApplicationStatusResponse {
  publicReference: string
  status: string
}

export interface CaptureLinkResponse {
  captureUrl: string
  expiresAt: string
}

export interface CaptureContextResponse {
  frontCaptured: boolean
  backCaptured: boolean
  status: string
}

export interface DocumentUploadResponse {
  side: string
  accepted: boolean
  bothSidesCaptured: boolean
  status: string
}

export interface ActivityStatusResponse {
  activityNumber: number
  status: string
  blockedReasonCode: string | null
}

export interface ResumeStateResponse {
  publicReference: string
  currentActivityNumber: number
  wizardScreen: number
  completionPercentage: number
  activities: ActivityStatusResponse[]
  fieldValues: Record<string, string>
}

interface ApiErrorBody {
  error?: string
  code?: string
}

async function responseError(res: Response, fallback: string): Promise<Error> {
  const body: ApiErrorBody = await res.json().catch(() => ({}))
  const error = new Error(body.error ?? `${fallback} (${res.status})`) as Error & { code?: string }
  error.code = body.code
  return error
}

export async function createApplication(): Promise<CreateApplicationResponse> {
  const res = await fetch(`${API_BASE}/onboarding/applications`, { method: 'POST' })
  if (!res.ok) throw await responseError(res, 'Failed to start onboarding application')
  return res.json()
}

export async function getApplicationStatus(publicReference: string): Promise<ApplicationStatusResponse> {
  const res = await fetch(`${API_BASE}/onboarding/applications/${encodeURIComponent(publicReference)}`)
  if (!res.ok) throw await responseError(res, 'Failed to fetch application status')
  return res.json()
}

export async function getResumeState(publicReference: string): Promise<ResumeStateResponse> {
  const res = await fetch(`${API_BASE}/onboarding/applications/${encodeURIComponent(publicReference)}/resume`)
  if (!res.ok) throw await responseError(res, 'Failed to resume onboarding application')
  return res.json()
}

export interface RealtimeSessionResponse {
  clientSecret: string
  model: string
}

/** Mints a short-lived ephemeral credential for a live voice session. The real AI provider key never leaves the server. */
export async function requestRealtimeSession(): Promise<RealtimeSessionResponse> {
  const res = await fetch(`${API_BASE}/onboarding/assistant/realtime-session`, { method: 'POST' })
  if (!res.ok) throw await responseError(res, 'Voice assistant is unavailable right now')
  return res.json()
}

export async function saveActivityDraft(
  publicReference: string,
  activityNumber: number,
  fields: Record<string, string>,
  idempotencyKey: string,
): Promise<ResumeStateResponse> {
  const res = await fetch(
    `${API_BASE}/onboarding/applications/${encodeURIComponent(publicReference)}/activities/${activityNumber}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields, idempotencyKey }),
    },
  )
  if (!res.ok) throw await responseError(res, 'Failed to save your progress')
  return res.json()
}

export async function continueActivity(
  publicReference: string,
  activityNumber: number,
  idempotencyKey: string,
): Promise<ResumeStateResponse> {
  const res = await fetch(
    `${API_BASE}/onboarding/applications/${encodeURIComponent(publicReference)}/activities/${activityNumber}/continue`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey }),
    },
  )
  if (!res.ok) throw await responseError(res, 'Failed to continue')
  return res.json()
}

export async function requestCaptureLink(publicReference: string): Promise<CaptureLinkResponse> {
  const res = await fetch(
    `${API_BASE}/onboarding/applications/${encodeURIComponent(publicReference)}/capture-links`,
    { method: 'POST' },
  )
  if (!res.ok) throw await responseError(res, 'Failed to request a capture link')
  return res.json()
}

export async function getCaptureContext(token: string): Promise<CaptureContextResponse> {
  const res = await fetch(`${API_BASE}/onboarding/captures/${encodeURIComponent(token)}`)
  if (!res.ok) throw await responseError(res, 'This capture link is invalid or has expired.')
  return res.json()
}

export interface UploadDocumentOptions {
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/** Uploads one document image via XHR (not fetch) so upload progress can be shown. */
export function uploadDocument(
  token: string,
  side: DocumentSide,
  blob: Blob,
  { onProgress, signal }: UploadDocumentOptions = {},
): Promise<DocumentUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${API_BASE}/onboarding/captures/${encodeURIComponent(token)}/documents/${side}`)
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve(JSON.parse(xhr.responseText))
      } else {
        const body: ApiErrorBody = (() => {
          try {
            return JSON.parse(xhr.responseText)
          } catch {
            return {}
          }
        })()
        reject(new Error(body.error ?? `Failed to upload ${side} image (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error(`Network error uploading ${side} image`))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))

    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(blob)
  })
}
