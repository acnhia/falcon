/**
 * Upload and download routes for the file-transfer demo, and the Durable Object handoff that
 * serialises each session. Returns null when the path is not ours, so the entrypoint can fall
 * through to static assets.
 */
import { Env, json } from '../platform/env'
import { InitiateRequest, safeFilename } from './session'
import { clearTestUploads, downloadTransfer, transferMetadata } from './transfers'

export async function handleFileTransferRequest(request: Request, env: Env, url: URL): Promise<Response | null> {
  const download = url.pathname.match(/^\/downloads\/([^/]+)$/)
  if (request.method === 'GET' && download) return downloadTransfer(env, download[1])

  const transfer = url.pathname.match(/^\/api\/transfers\/([^/]+)$/)
  if (request.method === 'GET' && transfer) return transferMetadata(env, transfer[1], url)

  if (!url.pathname.startsWith('/api/uploads')) return null

  if (request.method === 'DELETE' && url.pathname === '/api/uploads/test-data') return clearTestUploads(env)

  if (request.method === 'POST' && url.pathname === '/api/uploads') return initiateUpload(request, env)

  const match = url.pathname.match(/^\/api\/uploads\/([^/]+)(\/.*)?$/)
  if (!match) return json({ error: 'Not found' }, 404)
  return forwardToSession(request, env, url, match)
}

async function initiateUpload(request: Request, env: Env): Promise<Response> {
  const input = await request.json<InitiateRequest>()
  if (!input.filename?.trim() || !Number.isInteger(input.totalParts) || input.totalParts < 1
      || !Number.isSafeInteger(input.totalBytes) || input.totalBytes < 1) {
    return json({ error: 'filename, a positive totalParts, and totalBytes are required' }, 400)
  }
  const id = crypto.randomUUID()
  const shareToken = crypto.randomUUID()
  const objectKey = `uploads/${id}-${safeFilename(input.filename)}`
  const quota = env.STORAGE_QUOTA.get(env.STORAGE_QUOTA.idFromName('application-storage-quota'))
  const reservation = await quota.fetch('https://quota/reserve', {
    method: 'POST',
    body: JSON.stringify({ sessionId: id, bytes: input.totalBytes }),
  })
  if (!reservation.ok) return reservation
  const stub = env.UPLOAD_SESSIONS.get(env.UPLOAD_SESSIONS.idFromName(id))
  const response = await stub.fetch('https://session/initiate', {
    method: 'POST',
    body: JSON.stringify({ id, filename: input.filename, shareToken, objectKey, totalParts: input.totalParts, reservedBytes: input.totalBytes }),
  })
  if (!response.ok) await quota.fetch(`https://quota/release/${id}`, { method: 'POST' })
  return response
}

async function forwardToSession(request: Request, env: Env, url: URL, match: RegExpMatchArray): Promise<Response> {
  const stub = env.UPLOAD_SESSIONS.get(env.UPLOAD_SESSIONS.idFromName(match[1]))
  const response = await stub.fetch(`https://session${match[2] ?? '/'}`, {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  })
  if (request.method === 'POST' && match[2] === '/complete' && response.ok) {
    const completed = await response.json<{ shareToken: string }>()
    return json({
      ...completed,
      shareUrl: `${url.origin}/downloads/${completed.shareToken}`,
      downloadPageUrl: `${url.origin}/#/downloads/${completed.shareToken}`,
    }, response.status)
  }
  return response
}
