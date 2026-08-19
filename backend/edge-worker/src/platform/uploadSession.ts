/**
 * Durable Object serialising one multipart upload's lifecycle. Belongs to the file-transfer demo;
 * kept in platform/ because it is a Cloudflare runtime primitive rather than business logic.
 */
import { DurableObject } from 'cloudflare:workers'
import { Env, json } from './env'
import { Session, statusOf } from '../fileTransfer/session'

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

