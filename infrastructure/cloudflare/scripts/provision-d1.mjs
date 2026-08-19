import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  scriptDirectory, envPath, wranglerPath,
  parseEnvironment, required, setEnvironmentValues, cloudflare,
} from './cloudflare-client.mjs'

const migrationPath = resolve(scriptDirectory, '../migrations/0001_create_transfers.sql')

const envSource = await readFile(envPath, 'utf8')
const config = parseEnvironment(envSource)
const accountId = required(config, 'account_id')
const apiToken = required(config, 'api_token')
const databaseName = config.D1_DATABASE_NAME || 'upload-transfer-test'
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`

const databases = await cloudflare(`${apiBase}?per_page=100`, apiToken)
let database = databases.result.find((candidate) => candidate.name === databaseName)
if (!database) {
  const created = await cloudflare(apiBase, apiToken, {
    method: 'POST',
    body: JSON.stringify({ name: databaseName }),
  })
  database = created.result
  console.log(`Created D1 database: ${databaseName}`)
} else {
  console.log(`Reusing D1 database: ${databaseName}`)
}

const migration = await readFile(migrationPath, 'utf8')
await cloudflare(`${apiBase}/${database.uuid}/query`, apiToken, {
  method: 'POST',
  body: JSON.stringify({ sql: migration }),
})
console.log('Applied idempotent transfer schema.')

await writeFile(envPath, setEnvironmentValues(envSource, {
  D1_DATABASE_NAME: databaseName,
  D1_DATABASE_ID: database.uuid,
}))

const wrangler = JSON.parse(await readFile(wranglerPath, 'utf8'))
const otherDatabases = (wrangler.d1_databases ?? []).filter((db) => db.binding !== 'TRANSFERS')
wrangler.d1_databases = [...otherDatabases, {
  binding: 'TRANSFERS',
  database_name: databaseName,
  database_id: database.uuid,
  migrations_dir: 'migrations',
}]
await writeFile(wranglerPath, `${JSON.stringify(wrangler, null, 2)}\n`)
console.log('Updated local environment and Wrangler binding.')
