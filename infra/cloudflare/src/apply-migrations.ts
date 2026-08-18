import { env } from 'cloudflare:test'
import schema from '../migrations/0001_create_transfers.sql?raw'

for (const statement of schema.split(';').map((sql) => sql.trim()).filter(Boolean)) {
  await env.TRANSFERS.prepare(statement).run()
}
