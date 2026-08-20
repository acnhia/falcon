import { env } from 'cloudflare:test'
import transfersSchema from '../../../infrastructure/cloudflare/migrations/0001_create_transfers.sql?raw'
import onboardingSchema from '../../../infrastructure/cloudflare/migrations-onboarding/0001_create_onboarding.sql?raw'

/**
 * Builds the in-memory D1 schema for tests.
 *
 * Line comments are stripped before splitting on `;`, because prose in a comment may legitimately
 * contain a semicolon - which would otherwise be treated as a statement boundary and leave D1 with
 * a comment-only fragment to execute.
 */
async function apply(db: D1Database, schema: string) {
  const executable = schema
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')

  for (const statement of executable.split(';').map((sql) => sql.trim()).filter(Boolean)) {
    await db.prepare(statement).run()
  }
}

await apply(env.TRANSFERS, transfersSchema)
await apply(env.ONBOARDING_DB, onboardingSchema)
