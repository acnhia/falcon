import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import {
  envPath, wranglerPath, edgeWorkerPath,
  parseEnvironment, required, setEnvironmentValues, cloudflare,
} from './cloudflare-client.mjs'

const envSource = await readFile(envPath, 'utf8')
const config = parseEnvironment(envSource)
const accountId = required(config, 'account_id')
const apiToken = required(config, 'api_token')

const wrangler = JSON.parse(await readFile(wranglerPath, 'utf8'))
const workerName = wrangler.name
const widgetName = `${workerName}-login`
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}`

const { result: subdomainResult } = await cloudflare(`${apiBase}/workers/subdomain`, apiToken)
const domain = `${workerName}.${subdomainResult.subdomain}.workers.dev`

const widgets = await cloudflare(`${apiBase}/challenges/widgets?per_page=1000`, apiToken)
let siteKey = widgets.result.find((widget) => widget.name === widgetName)?.sitekey

if (!siteKey) {
  const created = await cloudflare(`${apiBase}/challenges/widgets`, apiToken, {
    method: 'POST',
    body: JSON.stringify({ name: widgetName, domains: [domain], mode: 'managed' }),
  })
  siteKey = created.result.sitekey
  console.log(`Created Turnstile widget: ${widgetName} (${domain})`)
} else {
  console.log(`Reusing Turnstile widget: ${widgetName} (${domain})`)
}

// The list/get endpoints never return an existing widget's secret, so the only way to obtain one is to
// rotate - and rotation is locked out for 2 hours afterwards. So: reuse a stored secret when we have
// one, only rotate when we don't, and if that rotation is locked out, leave whatever secret the Worker
// already holds in place rather than failing the whole deploy.
let secretKey = config.TURNSTILE_SECRET_KEY
if (secretKey) {
  console.log('Reusing the stored Turnstile widget secret.')
} else {
  try {
    const rotated = await cloudflare(`${apiBase}/challenges/widgets/${siteKey}/rotate_secret`, apiToken, {
      method: 'POST',
      body: JSON.stringify({ invalidate_immediately: false }),
    })
    secretKey = rotated.result.secret
    console.log('Rotated the Turnstile widget secret (none was stored locally).')
  } catch (reason) {
    if (!/rotation is already in progress/i.test(reason.message)) throw reason
    console.warn('Turnstile secret rotation is in its cooldown window - keeping the secret already set on the Worker.')
  }
}

await writeFile(envPath, setEnvironmentValues(envSource, {
  TURNSTILE_SITE_KEY: siteKey,
  ...(secretKey ? { TURNSTILE_SECRET_KEY: secretKey } : {}),
}))

wrangler.vars = { ...wrangler.vars, TURNSTILE_SITE_KEY: siteKey }
await writeFile(wranglerPath, `${JSON.stringify(wrangler, null, 2)}\n`)

if (secretKey) {
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', 'TURNSTILE_SECRET_KEY', '--config', wranglerPath], {
    cwd: edgeWorkerPath,
    input: secretKey,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
  })
  if (result.status !== 0) {
    throw new Error(`Failed to set TURNSTILE_SECRET_KEY Worker secret (exit code ${result.status})`)
  }
}
console.log(`Set TURNSTILE_SITE_KEY (wrangler var)${secretKey ? ' and TURNSTILE_SECRET_KEY (Worker secret)' : ''}.`)
