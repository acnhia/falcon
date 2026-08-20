/**
 * Prints the login access log as a readable table.
 *
 * wrangler's own output is JSON wrapped in progress chrome, which is unpleasant to read when the
 * question is simply "how many people looked at this, and when". Pass `summary` to group by IP.
 */
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { edgeWorkerPath, wranglerPath, envPath, parseEnvironment, required } from './cloudflare-client.mjs'

const summary = process.argv[2] === 'summary'
const config = parseEnvironment(await readFile(envPath, 'utf8'))

const sql = summary
  ? `SELECT ip_address, country, region, city, network, COUNT(*) AS logins,
            MIN(occurred_at) AS first_seen, MAX(occurred_at) AS last_seen
     FROM auth_login_event WHERE outcome = 'SUCCESS'
     GROUP BY ip_address ORDER BY logins DESC`
  : `SELECT occurred_at, outcome, ip_address, city, region, country, network
     FROM auth_login_event ORDER BY occurred_at DESC LIMIT 100`

const result = spawnSync('npx', [
  'wrangler', 'd1', 'execute', 'onboarding-test', '--remote', '--json',
  '--config', wranglerPath, '--command', sql,
], {
  cwd: edgeWorkerPath,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: required(config, 'api_token'),
    CLOUDFLARE_ACCOUNT_ID: required(config, 'account_id'),
  },
})
if (result.status !== 0) {
  throw new Error(`Query failed:\n${result.stderr || result.stdout}`)
}

// wrangler prints progress chrome around the JSON payload; take the array.
const json = result.stdout.slice(result.stdout.indexOf('['))
const rows = JSON.parse(json)[0]?.results ?? []

if (rows.length === 0) {
  console.log('\nNo logins recorded yet.\n')
  process.exit(0)
}

const columns = Object.keys(rows[0])
const width = (c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '-').length))
const widths = Object.fromEntries(columns.map((c) => [c, width(c)]))
const line = (cells) => columns.map((c) => String(cells[c] ?? '-').padEnd(widths[c])).join('  ')

console.log()
console.log(line(Object.fromEntries(columns.map((c) => [c, c]))))
console.log(columns.map((c) => '-'.repeat(widths[c])).join('  '))
rows.forEach((r) => console.log(line(r)))

if (summary) {
  const total = rows.reduce((sum, r) => sum + r.logins, 0)
  console.log(`\n${rows.length} distinct IP(s), ${total} successful login(s) in total.\n`)
} else {
  console.log(`\n${rows.length} attempt(s) shown.\n`)
}
