import { readFile, writeFile } from 'node:fs/promises'
import {
  envPath, wranglerPath,
  parseEnvironment, required, setEnvironmentValues, cloudflare,
} from './cloudflare-client.mjs'

const envSource = await readFile(envPath, 'utf8')
const config = parseEnvironment(envSource)
const accountId = required(config, 'account_id')
const apiToken = required(config, 'api_token')
const bucketName = config.BUCKET_NAME || 'upload-demo-test'
const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`

const buckets = await cloudflare(`${apiBase}?per_page=1000`, apiToken)
const exists = buckets.result.buckets.some((candidate) => candidate.name === bucketName)
if (!exists) {
  await cloudflare(apiBase, apiToken, {
    method: 'POST',
    body: JSON.stringify({ name: bucketName }),
  })
  console.log(`Created R2 bucket: ${bucketName}`)
} else {
  console.log(`Reusing R2 bucket: ${bucketName}`)
}

await writeFile(envPath, setEnvironmentValues(envSource, { BUCKET_NAME: bucketName }))

const wrangler = JSON.parse(await readFile(wranglerPath, 'utf8'))
wrangler.r2_buckets = [{ binding: 'UPLOADS', bucket_name: bucketName }]
await writeFile(wranglerPath, `${JSON.stringify(wrangler, null, 2)}\n`)
console.log('Updated local environment and Wrangler binding.')
