/**
 * The file-transfer demo: share-token lookups, downloads and test-data cleanup.
 *
 * Isolated from the onboarding module by REQUIREMENTS.md:56 - onboarding must not be mixed into
 * this application's code paths. Previously both lived together in index.ts.
 */
import { Env, json } from '../platform/env'

interface Transfer {
  share_token: string
  object_key: string
  filename: string
  byte_size: number
  created_at: string
}

export async function findTransfer(env: Env, shareToken: string): Promise<Transfer | null> {
  return env.TRANSFERS.prepare(
    'SELECT share_token, object_key, filename, byte_size, created_at FROM transfers WHERE share_token = ?'
  ).bind(shareToken).first<Transfer>()
}

export async function transferMetadata(env: Env, shareToken: string, url: URL): Promise<Response> {
  const transfer = await findTransfer(env, shareToken)
  if (!transfer) return json({ error: 'Shared transfer not found' }, 404)
  return json({
    filename: transfer.filename,
    byteSize: transfer.byte_size,
    createdAt: transfer.created_at,
    downloadUrl: `${url.origin}/downloads/${transfer.share_token}`,
  })
}

export async function downloadTransfer(env: Env, shareToken: string): Promise<Response> {
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

export async function clearTestUploads(env: Env): Promise<Response> {
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
