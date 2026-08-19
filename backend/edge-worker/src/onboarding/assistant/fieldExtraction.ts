import { OnboardingEnv } from '../repository/onboardingRepository'
import { jsonResponse } from '../web/http'
import { allowedValuesFor } from '../domain/enumFieldValues'

/**
 * Second live AI integration in this repo (the first is the voice Realtime
 * session in assistant.ts) - a narrow, single-shot structured-extraction
 * call used by the chat composer for both "paste a blob of info" and short
 * typed messages. Deliberately extraction-only: it proposes values for
 * known form fields found in the text, never a free-form conversational
 * reply, and never applies anything directly - the client shows each
 * proposal through the same `Use this`-confirmation UI already used for
 * voice. The real OPENAI_API_KEY never leaves this Worker.
 */
export interface FieldExtractionEnv extends OnboardingEnv {
  OPENAI_API_KEY?: string
}

const EXTRACTION_MODEL = 'gpt-4o-mini'
const MAX_TEXT_LENGTH = 4000
const PERSONAL_INFORMATION_ACTIVITY = 3

const EXTRACTION_INSTRUCTIONS = `You extract values for a synthetic demo brokerage-onboarding form from the user's message.
This is a demonstration only: never infer, request, or output a value for a real government ID, Social Security
number, or payment/bank detail, even though the schema doesn't list one - those are never asked for here. Only
output a value for a field if it is actually stated or clearly implied in the message; set anything not mentioned
to null. Do not guess or fabricate. Normalize dates as YYYY-MM-DD. For fields that are boolean yes/no questions,
output exactly the string "true" or "false" based on what the user said, never anything else.`

export interface FieldProposal {
  fieldKey: string
  value: string
}

interface FieldDefinitionRow {
  field_key: string
  data_type: string
}

export async function handleExtractFieldsRequest(request: Request, env: FieldExtractionEnv): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: 'Field extraction is not configured' }, 503)
  }
  const body = await request.json<{ text?: string }>()
  const text = (body.text ?? '').trim()
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonResponse({ error: `Text exceeds the maximum length of ${MAX_TEXT_LENGTH} characters` }, 400)
  }
  if (text.length === 0) {
    return jsonResponse({ proposals: [] })
  }

  const definitions = await env.ONBOARDING_DB.prepare(
    'SELECT field_key, data_type FROM field_definition WHERE activity_number = ?',
  ).bind(PERSONAL_INFORMATION_ACTIVITY).all<FieldDefinitionRow>()

  const proposals = await extractFields(env.OPENAI_API_KEY, text, definitions.results)
  return jsonResponse({ proposals })
}

export async function extractFields(
  apiKey: string, text: string, fieldDefinitions: FieldDefinitionRow[],
): Promise<FieldProposal[]> {
  const properties: Record<string, { type: string[]; description: string }> = {}
  const dataTypes = new Map<string, string>()
  for (const definition of fieldDefinitions) {
    properties[definition.field_key] = {
      type: ['string', 'null'],
      description: `Value for ${definition.field_key} (${definition.data_type}), or null if not mentioned in the message.`,
    }
    dataTypes.set(definition.field_key, definition.data_type)
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      messages: [
        { role: 'system', content: EXTRACTION_INSTRUCTIONS },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'field_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties,
            required: Object.keys(properties),
            additionalProperties: false,
          },
        },
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`Field extraction request failed (${response.status})`)
  }

  const body = await response.json<{ choices?: { message?: { content?: string } }[] }>()
  const content = body.choices?.[0]?.message?.content
  if (!content) return []

  let parsed: Record<string, string | null>
  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }

  return Object.entries(parsed)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
    .map(([fieldKey, value]) => [fieldKey, value.trim()] as [string, string])
    .filter(([fieldKey, value]) => isValidForFieldType(fieldKey, value, dataTypes.get(fieldKey)))
    .map(([fieldKey, value]) => ({ fieldKey, value }))
}

function isValidForFieldType(fieldKey: string, value: string, dataType: string | undefined): boolean {
  if (dataType === 'ENUM') {
    const allowed = allowedValuesFor(fieldKey)
    return !allowed || allowed.has(value)
  }
  if (dataType === 'BOOLEAN') {
    return value === 'true' || value === 'false'
  }
  return true
}
