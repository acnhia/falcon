import { OnboardingEnv, jsonResponse } from './db'

/**
 * Live AI integration point (the only one in this repo) - extracts a single
 * wizard field value from a natural-language voice transcript. Scope is
 * deliberately narrow: one structured extraction call, no general chat, no
 * text-to-speech. OPENAI_API_KEY is a Worker secret (never in wrangler.jsonc,
 * never sent to the browser) - see scripts/provision-openai-secret.mjs.
 * Transcripts are never logged (REQUIREMENTS.md: "voice transcripts...
 * redact them from logs").
 */
export interface AssistantEnv extends OnboardingEnv {
  OPENAI_API_KEY?: string
}

const FIELD_CATALOGUE = [
  { fieldKey: 'legalFirstName', dataType: 'STRING', description: 'legal first name' },
  { fieldKey: 'legalLastName', dataType: 'STRING', description: 'legal last name' },
  { fieldKey: 'dateOfBirth', dataType: 'DATE', description: 'date of birth, normalized to YYYY-MM-DD' },
  { fieldKey: 'email', dataType: 'EMAIL', description: 'email address' },
  { fieldKey: 'residentialCountry', dataType: 'COUNTRY', description: 'residential country, as a 2-letter ISO code when possible' },
  { fieldKey: 'preferredFirstName', dataType: 'STRING', description: 'preferred first name (optional)' },
  { fieldKey: 'preferredLastName', dataType: 'STRING', description: 'preferred last name (optional)' },
  { fieldKey: 'phone', dataType: 'PHONE', description: 'phone number (optional)' },
] as const

const KNOWN_FIELD_KEYS = new Set<string>(FIELD_CATALOGUE.map((f) => f.fieldKey))

export interface ExtractionSuggestion {
  fieldKey: string
  value: string
  message: string
}

export interface ExtractionRequestBody {
  transcript: string
  fieldValues: Record<string, string>
}

export function buildExtractionPrompt(transcript: string, fieldValues: Record<string, string>) {
  const catalogue = FIELD_CATALOGUE
    .map((f) => `- ${f.fieldKey} (${f.dataType}): ${f.description}${fieldValues[f.fieldKey] ? ` [current value: ${fieldValues[f.fieldKey]}]` : ''}`)
    .join('\n')

  const system = `You help fill a synthetic demo onboarding form. This is a demonstration only - never ask for or infer real government IDs, biometric data, or payment details.
Given the user's spoken sentence, decide if it supplies a value for exactly one of these known fields:
${catalogue}

Respond with a single JSON object and nothing else:
{"fieldKey": string or null, "value": string or null, "message": string}
- If the sentence clearly supplies a value for one known field, set fieldKey/value to that field's key and a normalized value (dates as YYYY-MM-DD), and message to a short confirmation.
- If it does not clearly map to exactly one known field, set fieldKey and value to null, and message to a brief, friendly clarifying note.
- Never invent a fieldKey that is not in the list above.`

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: transcript },
  ]
}

export function parseExtractionResponse(raw: string): ExtractionSuggestion | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const candidate = parsed as { fieldKey?: unknown; value?: unknown; message?: unknown }
  if (typeof candidate.fieldKey !== 'string' || typeof candidate.value !== 'string' || !KNOWN_FIELD_KEYS.has(candidate.fieldKey)) {
    return null
  }
  return {
    fieldKey: candidate.fieldKey,
    value: candidate.value,
    message: typeof candidate.message === 'string' ? candidate.message : `Applied to ${candidate.fieldKey}.`,
  }
}

export async function callOpenAiExtraction(
  transcript: string, fieldValues: Record<string, string>, apiKey: string,
): Promise<ExtractionSuggestion | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: buildExtractionPrompt(transcript, fieldValues),
    }),
  })
  if (!response.ok) {
    throw new Error(`OpenAI extraction request failed (${response.status})`)
  }
  const body = await response.json<{ choices: { message: { content: string } }[] }>()
  const content = body.choices[0]?.message.content
  return content ? parseExtractionResponse(content) : null
}

export async function handleAssistantExtractRequest(request: Request, env: AssistantEnv): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: 'Voice assistant is not configured' }, 503)
  }
  const body = await request.json<ExtractionRequestBody>()
  if (typeof body.transcript !== 'string' || !body.transcript.trim()) {
    return jsonResponse({ error: 'transcript is required' }, 400)
  }

  const suggestion = await callOpenAiExtraction(body.transcript, body.fieldValues ?? {}, env.OPENAI_API_KEY)
  return jsonResponse({ suggestion })
}
