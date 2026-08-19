import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { scriptDirectory, projectRoot, envPath, parseEnvironment, required } from './cloudflare-client.mjs'

const cloudflareDirectory = resolve(scriptDirectory, '..')
const frontendDirectory = resolve(projectRoot, 'frontend')
const skipTests = process.env.SKIP_TESTS === 'true'

const envSource = await readFile(envPath, 'utf8')
const config = parseEnvironment(envSource)
required(config, 'account_id')
required(config, 'api_token')

run('npm', ['ci'], cloudflareDirectory, 'Cloudflare Worker dependency install')
run('npm', ['run', 'check'], cloudflareDirectory, 'Cloudflare Worker type check')
if (!skipTests) run('npm', ['test'], cloudflareDirectory, 'Cloudflare Worker tests')

run('npm', ['ci'], frontendDirectory, 'Frontend dependency install')
run('npm', ['run', 'typecheck'], frontendDirectory, 'Frontend type check')
if (!skipTests) run('npm', ['test'], frontendDirectory, 'Frontend tests')
run('npm', ['run', 'build'], frontendDirectory, 'Frontend production build')

run('node', ['scripts/provision-r2.mjs'], cloudflareDirectory, 'R2 bucket provisioning')
run('node', ['scripts/provision-d1.mjs'], cloudflareDirectory, 'D1 database provisioning (file-transfer)')
run('node', ['scripts/provision-onboarding-d1.mjs'], cloudflareDirectory, 'D1 database provisioning (onboarding)')
run('node', ['scripts/provision-openai-secret.mjs'], cloudflareDirectory, 'Voice-assistant secret provisioning (optional)')
run('node', ['scripts/provision-auth-secrets.mjs'], cloudflareDirectory, 'Login gate secret provisioning (admin credentials + session key)')
run('node', ['scripts/provision-turnstile.mjs'], cloudflareDirectory, 'Turnstile CAPTCHA widget provisioning')

run('npx', ['wrangler', 'deploy'], cloudflareDirectory, 'Worker deployment', {
  CLOUDFLARE_API_TOKEN: config.api_token,
  CLOUDFLARE_ACCOUNT_ID: config.account_id,
})

console.log('\nLaunch complete: Frontend assets built, R2/D1 provisioned, Worker deployed.')

function run(command, args, cwd, label, extraEnv = {}) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...extraEnv } })
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit code ${result.status})`)
  }
}
