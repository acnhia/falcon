import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { edgeWorkerPath, wranglerPath, envPath, parseEnvironment, required } from './cloudflare-client.mjs'

const envSource = await readFile(envPath, 'utf8')
const config = parseEnvironment(envSource)

if (!config.OPENAPI_KEY) {
  console.log('OPENAPI_KEY not set in .env - skipping. Voice suggestions will return a safe 503 until this is configured.')
  process.exit(0)
}

const accountId = required(config, 'account_id')
const apiToken = required(config, 'api_token')

const result = spawnSync('npx', ['wrangler', 'secret', 'put', 'OPENAI_API_KEY', '--config', wranglerPath], {
  cwd: edgeWorkerPath,
  input: config.OPENAPI_KEY,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
  env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
})
if (result.status !== 0) {
  throw new Error(`Failed to set OPENAI_API_KEY Worker secret (exit code ${result.status})`)
}
console.log('Set OPENAI_API_KEY Worker secret.')
