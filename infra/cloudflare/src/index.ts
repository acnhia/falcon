import { handleOnboardingRequest } from './onboarding/router'

interface Env {
  UPLOADS: R2Bucket
  UPLOAD_SESSIONS: DurableObjectNamespace<UploadSession>
  STORAGE_QUOTA: DurableObjectNamespace<StorageQuota>
  TRANSFERS: D1Database
  ONBOARDING_DB: D1Database
  OPENAI_API_KEY?: string
  ASSETS: Fetcher
}

interface InitiateRequest {
  filename: string
  totalParts: number
  totalBytes: number
}

interface Session {
  id: string
  filename: string
  shareToken: string
  objectKey: string
  uploadId: string
  totalParts: number
  status: 'INITIATED' | 'UPLOADING' | 'COMPLETING' | 'COMPLETED' | 'ABORTED'
  reservedBytes: number
  parts: R2UploadedPart[]
}

/** Routes API calls; one Durable Object serializes each upload session's lifecycle. */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const download = url.pathname.match(/^\/downloads\/([^/]+)$/)
    if (request.method === 'GET' && download) return downloadTransfer(env, download[1])

    const transfer = url.pathname.match(/^\/api\/transfers\/([^/]+)$/)
    if (request.method === 'GET' && transfer) return transferMetadata(env, transfer[1], url)

    if (url.pathname.startsWith('/api/onboarding/')) return handleOnboardingRequest(request, env)

    if (!url.pathname.startsWith('/api/uploads')) return env.ASSETS.fetch(request)

    if (request.method === 'DELETE' && url.pathname === '/api/uploads/test-data') {
      return clearTestUploads(env)
    }

    if (request.method === 'POST' && url.pathname === '/api/uploads') {
      const input = await request.json<InitiateRequest>()
      if (!input.filename?.trim() || !Number.isInteger(input.totalParts) || input.totalParts < 1 || !Number.isSafeInteger(input.totalBytes) || input.totalBytes < 1) {
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

    const match = url.pathname.match(/^\/api\/uploads\/([^/]+)(\/.*)?$/)
    if (!match) return json({ error: 'Not found' }, 404)
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
  },
} satisfies ExportedHandler<Env>

export class UploadSession extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/initiate') return this.initiate(request)

    const session = await this.ctx.storage.get<Session>('session')
    if (!session) return json({ error: 'Upload session not found' }, 404)
    if (request.method === 'GET' && url.pathname === '/') return json(statusOf(session))
    if (request.method === 'POST' && url.pathname === '/abort') return this.abort(session)
    if (request.method === 'POST' && url.pathname === '/complete') return this.complete(session)

    const part = url.pathname.match(/^\/parts\/(\d+)$/)
    if (request.method === 'PUT' && part) return this.uploadPart(session, Number(part[1]), request)
    return json({ error: 'Not found' }, 404)
  }

  private async initiate(request: Request): Promise<Response> {
    const input = await request.json<Pick<Session, 'id' | 'filename' | 'shareToken' | 'objectKey' | 'totalParts' | 'reservedBytes'>>()
    const upload = await this.env.UPLOADS.createMultipartUpload(input.objectKey)
    const session: Session = { ...input, uploadId: upload.uploadId, status: 'INITIATED', parts: [] }
    await this.ctx.storage.put('session', session)
    return json({ sessionId: input.id, objectKey: input.objectKey, totalParts: input.totalParts }, 201)
  }

  private async uploadPart(session: Session, partNumber: number, request: Request): Promise<Response> {
    if (session.status === 'ABORTED' || session.status === 'COMPLETED') return json({ error: `Upload is ${session.status.toLowerCase()}` }, 409)
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > session.totalParts) return json({ error: 'Invalid part number' }, 400)
    if (!request.body) return json({ error: 'Part body is required' }, 400)

    const upload = this.env.UPLOADS.resumeMultipartUpload(session.objectKey, session.uploadId)
    const result = await upload.uploadPart(partNumber, request.body)
    session.parts = [...session.parts.filter((part) => part.partNumber !== partNumber), result]
    session.status = 'UPLOADING'
    await this.ctx.storage.put('session', session)
    return json({ partNumber: result.partNumber, eTag: result.etag })
  }

  private async complete(session: Session): Promise<Response> {
    if (session.status === 'COMPLETED') return json({ shareToken: session.shareToken }, 202)
    if (session.status === 'ABORTED') return json({ error: 'Upload is aborted' }, 409)
    if (session.parts.length !== session.totalParts) return json(statusOf(session), 409)

    session.status = 'COMPLETING'
    await this.ctx.storage.put('session', session)
    await this.env.UPLOADS.resumeMultipartUpload(session.objectKey, session.uploadId).complete(session.parts)
    session.status = 'COMPLETED'
    await this.ctx.storage.put('session', session)
    await this.quota().fetch(`https://quota/commit/${session.id}`, { method: 'POST' })
    await this.env.TRANSFERS.prepare(`
      INSERT INTO transfers (share_token, object_key, filename, byte_size, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(share_token) DO UPDATE SET
        object_key = excluded.object_key,
        filename = excluded.filename,
        byte_size = excluded.byte_size
    `).bind(session.shareToken, session.objectKey, session.filename, session.reservedBytes, new Date().toISOString()).run()
    return json({ shareToken: session.shareToken }, 202)
  }

  private async abort(session: Session): Promise<Response> {
    if (session.status !== 'COMPLETED' && session.status !== 'ABORTED') {
      await this.env.UPLOADS.resumeMultipartUpload(session.objectKey, session.uploadId).abort()
      session.status = 'ABORTED'
      await this.ctx.storage.put('session', session)
      await this.quota().fetch(`https://quota/release/${session.id}`, { method: 'POST' })
    }
    return new Response(null, { status: 204 })
  }

  private quota() {
    return this.env.STORAGE_QUOTA.get(this.env.STORAGE_QUOTA.idFromName('application-storage-quota'))
  }
}

/** A single durable coordinator prevents concurrent sessions from exceeding the application quota. */
export class StorageQuota extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const usage = (await this.ctx.storage.get<QuotaUsage>('usage')) ?? { pending: {}, committed: {} }

    if (request.method === 'POST' && url.pathname === '/reserve') {
      const input = await request.json<{ sessionId: string; bytes: number }>()
      if (!Number.isSafeInteger(input.bytes) || input.bytes < 1) return json({ error: 'Invalid storage reservation' }, 400)
      const used = sum(usage.pending) + sum(usage.committed)
      if (used + input.bytes > MAX_APPLICATION_STORAGE_BYTES) {
        return json({
          code: 'STORAGE_QUOTA_EXCEEDED',
          error: 'Upload would exceed the 10 GiB application storage limit',
          remainingBytes: MAX_APPLICATION_STORAGE_BYTES - used,
        }, 413)
      }
      usage.pending[input.sessionId] = input.bytes
      await this.ctx.storage.put('usage', usage)
      return new Response(null, { status: 201 })
    }

    if (request.method === 'POST' && url.pathname === '/clear-committed') {
      usage.committed = {}
      await this.ctx.storage.put('usage', usage)
      return new Response(null, { status: 204 })
    }

    const match = url.pathname.match(/^\/(commit|release)\/([^/]+)$/)
    if (!match || request.method !== 'POST') return json({ error: 'Not found' }, 404)
    const [, action, sessionId] = match
    const bytes = usage.pending[sessionId]
    if (bytes !== undefined) {
      delete usage.pending[sessionId]
      if (action === 'commit') usage.committed[sessionId] = bytes
      await this.ctx.storage.put('usage', usage)
    }
    return new Response(null, { status: 204 })
  }
}

interface QuotaUsage {
  pending: Record<string, number>
  committed: Record<string, number>
}

const json = (body: unknown, status = 200) => Response.json(body, { status })
const safeFilename = (filename: string) => filename.replaceAll(/[^a-zA-Z0-9._-]/g, '_')
const statusOf = (session: Session) => ({ sessionId: session.id, status: session.status, completedParts: session.parts.length, totalParts: session.totalParts })
const MAX_APPLICATION_STORAGE_BYTES = 10 * 1024 * 1024 * 1024
const sum = (entries: Record<string, number>) => Object.values(entries).reduce((total, bytes) => total + bytes, 0)

interface Transfer {
  share_token: string
  object_key: string
  filename: string
  byte_size: number
  created_at: string
}

async function findTransfer(env: Env, shareToken: string): Promise<Transfer | null> {
  return env.TRANSFERS.prepare(
    'SELECT share_token, object_key, filename, byte_size, created_at FROM transfers WHERE share_token = ?'
  ).bind(shareToken).first<Transfer>()
}

async function transferMetadata(env: Env, shareToken: string, url: URL): Promise<Response> {
  const transfer = await findTransfer(env, shareToken)
  if (!transfer) return json({ error: 'Shared transfer not found' }, 404)
  return json({
    filename: transfer.filename,
    byteSize: transfer.byte_size,
    createdAt: transfer.created_at,
    downloadUrl: `${url.origin}/downloads/${transfer.share_token}`,
  })
}

async function downloadTransfer(env: Env, shareToken: string): Promise<Response> {
  const transfer = await findTransfer(env, shareToken)
  if (!transfer) return json({ error: 'Shared transfer not found' }, 404)
  const object = await env.UPLOADS.get(transfer.object_key)
  if (!object) return json({ error: 'Shared file is no longer available' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('content-disposition', `attachment; filename="${downloadFilename(transfer.filename)}"`)
  headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}

const downloadFilename = (filename: string) => filename.replaceAll(/["\\\r\n]/g, '_')

async function clearTestUploads(env: Env): Promise<Response> {
  let cursor: string | undefined
  let deleted = 0
  do {
    const listed = await env.UPLOADS.list({ prefix: 'uploads/', cursor })
    if (listed.objects.length) {
      await env.UPLOADS.delete(listed.objects.map((object) => object.key))
      deleted += listed.objects.length
    }
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)

  const quota = env.STORAGE_QUOTA.get(env.STORAGE_QUOTA.idFromName('application-storage-quota'))
  await quota.fetch('https://quota/clear-committed', { method: 'POST' })
  return json({ deletedObjects: deleted })
}
import { DurableObject } from 'cloudflare:workers'
