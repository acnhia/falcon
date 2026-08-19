/**
 * Bindings available to tests through `cloudflare:test`, which types its `env` export as
 * `Cloudflare.Env`. These mirror the bindings declared in infrastructure/cloudflare/wrangler.jsonc
 * plus the fake auth values injected by vitest.config.ts.
 */
declare namespace Cloudflare {
  interface Env {
    TRANSFERS: D1Database
    ONBOARDING_DB: D1Database
    UPLOADS: R2Bucket
    ADMIN_USERNAME: string
    ADMIN_PASSWORD: string
    SESSION_SECRET: string
    TURNSTILE_SITE_KEY: string
    TURNSTILE_SECRET_KEY: string
  }
}
