import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractFields } from './fieldExtraction'
import { authedFetch } from '../test-support/auth'

const FIELD_DEFINITIONS = [
  { field_key: 'legalFirstName', data_type: 'STRING' },
  { field_key: 'dateOfBirth', data_type: 'DATE' },
  { field_key: 'maritalStatus', data_type: 'ENUM' },
  { field_key: 'isControlPerson', data_type: 'BOOLEAN' },
]

function mockOpenAiResponse(content: Record<string, string | null>) {
  return {
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  }
}

describe('POST /api/onboarding/assistant/extract-fields', () => {
  it('returns a safe 503 when extraction is not configured, without calling OpenAI', async () => {
    const res = await authedFetch('https://example.com/api/onboarding/assistant/extract-fields', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'My name is Ada Lovelace.' }),
    })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})

describe('extractFields', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds a nullable-string, strict json-schema request from the field catalogue', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOpenAiResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await extractFields('fake-key', 'My name is Ada.', FIELD_DEFINITIONS)

    const [, requestInit] = fetchMock.mock.calls[0]
    const requestBody = JSON.parse(requestInit.body)
    expect(requestBody.response_format.json_schema.strict).toBe(true)
    expect(requestBody.response_format.json_schema.schema.required).toEqual(
      FIELD_DEFINITIONS.map((d) => d.field_key))
    expect(requestBody.response_format.json_schema.schema.properties.legalFirstName.type).toEqual(['string', 'null'])
  })

  it('returns only the fields the model actually found, dropping nulls and blanks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOpenAiResponse({
      legalFirstName: 'Ada', dateOfBirth: null, maritalStatus: '', isControlPerson: 'false',
    })))

    const proposals = await extractFields('fake-key', 'text', FIELD_DEFINITIONS)

    expect(proposals).toEqual(expect.arrayContaining([
      { fieldKey: 'legalFirstName', value: 'Ada' },
      { fieldKey: 'isControlPerson', value: 'false' },
    ]))
    expect(proposals).toHaveLength(2)
  })

  it('drops a proposed enum value that is not in the allowlist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOpenAiResponse({
      maritalStatus: 'NOT_A_REAL_STATUS',
    })))

    const proposals = await extractFields('fake-key', 'text', FIELD_DEFINITIONS)

    expect(proposals).toEqual([])
  })

  it('drops a proposed boolean value that is not literally true/false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOpenAiResponse({
      isControlPerson: 'maybe',
    })))

    const proposals = await extractFields('fake-key', 'text', FIELD_DEFINITIONS)

    expect(proposals).toEqual([])
  })

  it('throws when the OpenAI request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(extractFields('fake-key', 'text', FIELD_DEFINITIONS)).rejects.toThrow(/failed/i)
  })
})
