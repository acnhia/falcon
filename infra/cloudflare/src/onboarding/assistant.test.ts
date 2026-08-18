import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { buildRealtimeSessionRequest } from './assistant'

describe('buildRealtimeSessionRequest', () => {
  it('declares the suggest_field_value tool with the known field keys', () => {
    const body = buildRealtimeSessionRequest()
    const tool = body.session.tools[0]

    expect(tool.name).toBe('suggest_field_value')
    expect(tool.parameters.properties.fieldKey.enum).toContain('dateOfBirth')
    expect(tool.parameters.required).toEqual(['fieldKey', 'value', 'message'])
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
    const res = await SELF.fetch('https://example.com/api/onboarding/assistant/realtime-session', { method: 'POST' })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
