import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { scriptDirectory, projectRoot } from './cloudflare-client.mjs'

const dockerfile = resolve(scriptDirectory, '../Dockerfile.deploy')
const image = 'brokerage-onboarding-deploy'
const cloudflareModulesVolume = 'brokerage-onboarding-cloudflare-node-modules'
const frontendModulesVolume = 'brokerage-onboarding-frontend-node-modules'

run('docker', ['build', '-f', dockerfile, '-t', image, projectRoot], 'Build deploy image')

const runArgs = [
  'run', '--rm',
  '-v', `${projectRoot}:/workspace`,
  '-v', `${cloudflareModulesVolume}:/workspace/infrastructure/cloudflare/node_modules`,
  '-v', `${frontendModulesVolume}:/workspace/frontend/node_modules`,
  '-e', `SKIP_TESTS=${process.env.SKIP_TESTS ?? 'false'}`,
  image,
]
if (process.stdout.isTTY) runArgs.splice(2, 0, '-t')
run('docker', runArgs, 'Run deploy container')

console.log('\nContainerized launch complete.')

function run(command, args, label) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit code ${result.status})`)
  }
}
