import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { scriptDirectory, envPath, parseEnvironment, required, setEnvironmentValues } from './cloudflare-client.mjs'

const cloudflareDirectory = resolve(scriptDirectory, '..')
const envSource = await readFile(envPath, 'utf8')
const config = parseEnvironment(envSource)
const accountId = required(config, 'account_id')
const apiToken = required(config, 'api_token')

const adminUsername = config.ADMIN_USERNAME || 'admin'
const adminPassword = config.ADMIN_PASSWORD || 'admin'
// A stateless session-cookie signing key - generated once and reused, not the same secret as anything else.
const sessionSecret = config.SESSION_SECRET || randomHex(32)

await writeFile(envPath, setEnvironmentValues(envSource, {
  ADMIN_USERNAME: adminUsername,
  ADMIN_PASSWORD: adminPassword,
  SESSION_SECRET: sessionSecret,
}))

for (const [name, value] of [
  ['ADMIN_USERNAME', adminUsername],
  ['ADMIN_PASSWORD', adminPassword],
  ['SESSION_SECRET', sessionSecret],
]) {
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    cwd: cloudflareDirectory,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
  })
  if (result.status !== 0) {
    throw new Error(`Failed to set ${name} Worker secret (exit code ${result.status})`)
  }
}
console.log('Set ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET Worker secrets.')

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
