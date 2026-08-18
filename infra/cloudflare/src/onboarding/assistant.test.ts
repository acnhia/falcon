import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { buildExtractionPrompt, parseExtractionResponse } from './assistant'

describe('buildExtractionPrompt', () => {
  it('includes the field catalogue and the transcript', () => {
    const messages = buildExtractionPrompt('my birthday is sept 13 81', { legalFirstName: 'Ada' })

    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('dateOfBirth')
    expect(messages[0].content).toContain('[current value: Ada]')
    expect(messages[1]).toEqual({ role: 'user', content: 'my birthday is sept 13 81' })
  })
})

describe('parseExtractionResponse', () => {
  it('accepts a well-formed suggestion for a known field', () => {
    const result = parseExtractionResponse(JSON.stringify({
      fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Got it - September 13, 1981.',
    }))

    expect(result).toEqual({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Got it - September 13, 1981.' })
  })

  it('returns null for an unknown field key', () => {
    const result = parseExtractionResponse(JSON.stringify({ fieldKey: 'ssn', value: '123-45-6789', message: 'x' }))

    expect(result).toBeNull()
  })

  it('returns null when the model reports no confident match', () => {
    const result = parseExtractionResponse(JSON.stringify({ fieldKey: null, value: null, message: 'Not sure what you meant.' }))

    expect(result).toBeNull()
  })

  it('returns null for malformed JSON rather than throwing', () => {
    expect(parseExtractionResponse('not json')).toBeNull()
  })
})

describe('POST /api/onboarding/assistant/extract', () => {
  it('returns a safe 503 when the assistant is not configured, without calling OpenAI', async () => {
    const res = await SELF.fetch('https://example.com/api/onboarding/assistant/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: 'my birthday is sept 13 81', fieldValues: {} }),
    })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
