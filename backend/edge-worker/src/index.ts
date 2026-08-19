/**
 * Worker entrypoint. Composition only: authenticate, then dispatch to exactly one module.
 *
 * The two product domains stay separate below and in their own directories - REQUIREMENTS.md:56
 * requires that onboarding is not mixed into the file-transfer demo's code paths.
 */
import { denyUnauthenticated, handleLoginRequest } from './auth/gate'
import { readSessionCookie, verifySessionToken } from './auth/session'
import { handleFileTransferRequest } from './fileTransfer/routes'
import { handleOnboardingRequest } from './onboarding/web/router'
import { Env } from './platform/env'

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      return handleLoginRequest(request, env)
    }

    const authenticated = await verifySessionToken(readSessionCookie(request), env.SESSION_SECRET ?? '')
    if (!authenticated) return denyUnauthenticated(env, url.pathname)

    if (url.pathname.startsWith('/api/onboarding/')) return handleOnboardingRequest(request, env)

    const fileTransfer = await handleFileTransferRequest(request, env, url)
    if (fileTransfer) return fileTransfer

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

export { UploadSession } from './platform/uploadSession'
export { StorageQuota } from './platform/storageQuota'
