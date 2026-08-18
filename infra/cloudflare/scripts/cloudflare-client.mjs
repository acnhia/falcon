import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const scriptDirectory = dirname(fileURLToPath(import.meta.url))
export const projectRoot = resolve(scriptDirectory, '../../..')
export const envPath = resolve(projectRoot, '.env')
export const wranglerPath = resolve(scriptDirectory, '../wrangler.jsonc')

export function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator), line.slice(separator + 1)]
    }))
}

export function required(values, name) {
  if (!values[name]) throw new Error(`Missing ${name} in ${envPath}`)
  return values[name]
}

export function setEnvironmentValues(source, values) {
  let result = source
  for (const [name, value] of Object.entries(values)) {
    const line = new RegExp(`^${name}=.*$`, 'm')
    result = line.test(result) ? result.replace(line, `${name}=${value}`) : `${result.trimEnd()}\n${name}=${value}\n`
  }
  return result.endsWith('\n') ? result : `${result}\n`
}

export async function cloudflare(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join('; ') || `Cloudflare request failed (${response.status})`)
  }
  return payload
}
