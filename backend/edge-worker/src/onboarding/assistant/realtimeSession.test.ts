import { describe, expect, it } from 'vitest'
import { buildRealtimeSessionRequest } from './realtimeSession'
import { authedFetch } from '../../test-support/auth'
import { readJson } from '../../test-support/http'

describe('buildRealtimeSessionRequest', () => {
  it('declares both propose_field_value and confirm_field_value tools with the known field keys', () => {
    const body = buildRealtimeSessionRequest()
    const propose = body.session.tools.find((t) => t.name === 'propose_field_value')
    const confirm = body.session.tools.find((t) => t.name === 'confirm_field_value')

    expect(propose?.parameters.properties.fieldKey.enum).toContain('dateOfBirth')
    expect(propose?.parameters.required).toEqual(['fieldKey', 'value', 'message'])
    expect(confirm?.parameters.properties.fieldKey.enum).toContain('dateOfBirth')
    expect(confirm?.parameters.required).toEqual(['fieldKey'])
  })

  it('instructs the model to ask out loud and wait for a verbal yes before confirming', () => {
    const body = buildRealtimeSessionRequest()

    expect(body.session.instructions).toContain('ask the user out loud')
    expect(body.session.instructions).toContain('Never call confirm_field_value without first calling propose_field_value')
  })

  it('never claims to give financial/legal advice and stays synthetic-data scoped', () => {
    const body = buildRealtimeSessionRequest()

    expect(body.session.instructions).toContain('demonstration only')
    expect(body.session.instructions).toContain('never')
  })

  it('specifies a realtime session type and a model', () => {
    const body = buildRealtimeSessionRequest()

    expect(body.session.type).toBe('realtime')
    expect(body.session.model).toBeTruthy()
  })
})

describe('POST /api/onboarding/assistant/realtime-session', () => {
  it('returns a safe 503 when the assistant is not configured, without calling OpenAI', async () => {
    const res = await authedFetch('https://example.com/api/onboarding/assistant/realtime-session', { method: 'POST' })

    expect(res.status).toBe(503)
    const body = await readJson(res)
    expect(body.error).toBeTruthy()
  })
})
