/** Cloudflare bindings this Worker is deployed with. Declared in infrastructure/cloudflare/wrangler.jsonc. */
import { AuthEnv } from '../auth/session'
import type { UploadSession } from './uploadSession'
import type { StorageQuota } from './storageQuota'

export interface Env extends AuthEnv {
  UPLOADS: R2Bucket
  UPLOAD_SESSIONS: DurableObjectNamespace<UploadSession>
  STORAGE_QUOTA: DurableObjectNamespace<StorageQuota>
  TRANSFERS: D1Database
  ONBOARDING_DB: D1Database
  OPENAI_API_KEY?: string
  ASSETS: Fetcher
}

export const json = (body: unknown, status = 200) => Response.json(body, { status })
export const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
