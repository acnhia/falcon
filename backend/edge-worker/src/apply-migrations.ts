import { env } from 'cloudflare:test'
import transfersSchema from '../../../infrastructure/cloudflare/migrations/0001_create_transfers.sql?raw'
import onboardingSchema from '../../../infrastructure/cloudflare/migrations-onboarding/0001_create_onboarding.sql?raw'

async function apply(db: D1Database, schema: string) {
  for (const statement of schema.split(';').map((sql) => sql.trim()).filter(Boolean)) {
    await db.prepare(statement).run()
  }
}

await apply(env.TRANSFERS, transfersSchema)
await apply(env.ONBOARDING_DB, onboardingSchema)
