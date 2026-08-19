/**
 * Durable Object enforcing the application-wide storage ceiling. A single coordinator prevents
 * concurrent uploads from collectively exceeding the limit.
 */
import { DurableObject } from 'cloudflare:workers'
import { Env, json } from './env'

export const MAX_APPLICATION_STORAGE_BYTES = 10 * 1024 * 1024 * 1024
const sum = (entries: Record<string, number>) => Object.values(entries).reduce((total, bytes) => total + bytes, 0)

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
