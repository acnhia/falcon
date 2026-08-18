import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { scriptDirectory, projectRoot, envPath, parseEnvironment, required } from './cloudflare-client.mjs'

const cloudflareDirectory = resolve(scriptDirectory, '..')
const reactDirectory = resolve(projectRoot, 'react')
const skipTests = process.env.SKIP_TESTS === 'true'

const envSource = await readFile(envPath, 'utf8')
const config = parseEnvironment(envSource)
required(config, 'account_id')
required(config, 'api_token')

run('npm', ['ci'], cloudflareDirectory, 'Cloudflare Worker dependency install')
run('npm', ['run', 'check'], cloudflareDirectory, 'Cloudflare Worker type check')
if (!skipTests) run('npm', ['test'], cloudflareDirectory, 'Cloudflare Worker tests')

run('npm', ['ci'], reactDirectory, 'React dependency install')
run('npm', ['run', 'typecheck'], reactDirectory, 'React type check')
if (!skipTests) run('npm', ['test'], reactDirectory, 'React tests')
run('npm', ['run', 'build'], reactDirectory, 'React production build')

run('node', ['scripts/provision-r2.mjs'], cloudflareDirectory, 'R2 bucket provisioning')
run('node', ['scripts/provision-d1.mjs'], cloudflareDirectory, 'D1 database provisioning')

run('npx', ['wrangler', 'deploy'], cloudflareDirectory, 'Worker deployment', {
  CLOUDFLARE_API_TOKEN: config.api_token,
  CLOUDFLARE_ACCOUNT_ID: config.account_id,
})

console.log('\nLaunch complete: React assets built, R2/D1 provisioned, Worker deployed.')

function run(command, args, cwd, label, extraEnv = {}) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...extraEnv } })
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit code ${result.status})`)
  }
}
