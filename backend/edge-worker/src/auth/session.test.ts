import { describe, expect, it } from 'vitest'
import { createSessionToken, verifySessionToken, verifyCredentials, signPayload, SESSION_TTL_MS } from './session'

describe('session tokens', () => {
  it('round-trips a freshly created token as valid', async () => {
    const token = await createSessionToken('secret')

    expect(await verifySessionToken(token, 'secret')).toBe(true)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken('secret')

    expect(await verifySessionToken(token, 'a-different-secret')).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const token = await createSessionToken('secret')
    const tampered = `${token.slice(0, -1)}${token.at(-1) === '0' ? '1' : '0'}`

    expect(await verifySessionToken(tampered, 'secret')).toBe(false)
  })

  it('rejects a missing token', async () => {
    expect(await verifySessionToken(undefined, 'secret')).toBe(false)
  })

  it('rejects an expired token', async () => {
    const expiredPayload = String(Date.now() - SESSION_TTL_MS - 1_000)
    const token = `${expiredPayload}.${await signPayload('secret', expiredPayload)}`

    expect(await verifySessionToken(token, 'secret')).toBe(false)
  })

  it('rejects a token with no secret configured', async () => {
    const token = await createSessionToken('secret')

    expect(await verifySessionToken(token, '')).toBe(false)
  })
})

describe('verifyCredentials', () => {
  it('accepts the configured admin username/password', () => {
    expect(verifyCredentials({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin' }, 'admin', 'admin')).toBe(true)
  })

  it('defaults to admin/admin when unset', () => {
    expect(verifyCredentials({}, 'admin', 'admin')).toBe(true)
  })

  it('rejects the wrong password', () => {
    expect(verifyCredentials({}, 'admin', 'wrong')).toBe(false)
  })

  it('rejects the wrong username', () => {
    expect(verifyCredentials({}, 'someone-else', 'admin')).toBe(false)
  })
})
