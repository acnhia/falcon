import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('upload storage quota', () => {
  it('rejects a new upload before transfer when it would exceed 10 GiB', async () => {
    const first = await initiate('exact-limit.bin', 10 * 1024 * 1024 * 1024)
    const second = await initiate('over-limit.bin', 1)

    expect(first.status).toBe(201)
    expect(second.status).toBe(413)
    await expect(second.json()).resolves.toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED' })
  })
})

describe('shared downloads', () => {
  it('does not reveal a stored object when the share token is unknown', async () => {
    const response = await SELF.fetch('https://example.com/api/transfers/not-a-real-token')

    expect(response.status).toBe(404)
  })
})

function initiate(filename: string, totalBytes: number) {
  return SELF.fetch('https://example.com/api/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename, totalParts: 1, totalBytes }),
  })
}
