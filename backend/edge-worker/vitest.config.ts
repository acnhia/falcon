import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

/**
 * Test bindings are declared here rather than discovered from a `.dev.vars` file, for two reasons:
 * the deployment descriptor now lives in infrastructure/, so `.dev.vars` discovery relative to it
 * would reach across boundaries; and an untracked file must never be what makes the suite pass, or
 * a fresh clone fails for reasons nobody can see.
 *
 * Every value below is deliberately fake. admin/admin is the demo credential, and the Turnstile pair
 * is Cloudflare's publicly documented "always passes" test key, which keeps the login-gate tests
 * offline and deterministic instead of calling the real siteverify endpoint. The deployed Worker
 * shares none of these - it receives real values as Worker secrets at provisioning time.
 */
const TEST_BINDINGS = {
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin',
  SESSION_SECRET: 'test-only-session-secret-do-not-use-in-production',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
}

export default defineConfig({
  test: {
    setupFiles: ['./src/apply-migrations.ts'],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: '../../infrastructure/cloudflare/wrangler.jsonc' },
      miniflare: { bindings: TEST_BINDINGS },
    }),
  ],
})
