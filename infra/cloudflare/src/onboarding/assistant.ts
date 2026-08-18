import { OnboardingEnv, jsonResponse } from './db'

/**
 * Live AI integration point (the only one in this repo) - mints a short-lived
 * ephemeral credential for OpenAI's Realtime API (WebRTC voice). The real
 * OPENAI_API_KEY never leaves this server; only the ephemeral client secret
 * (minutes-scale lifetime, scoped to one session) is ever sent to the
 * browser. Scope is deliberately narrow: the model may only *propose* a
 * value for one known wizard field via a tool call - it never fills a form
 * field directly, and it is not a general chat/advice assistant.
 */
export interface AssistantEnv extends OnboardingEnv {
  OPENAI_API_KEY?: string
}

const REALTIME_MODEL = 'gpt-realtime-2.1'
const REALTIME_VOICE = 'marin'

const FIELD_KEYS = [
  'legalFirstName', 'legalLastName', 'dateOfBirth', 'email', 'residentialCountry',
  'preferredFirstName', 'preferredLastName', 'phone',
] as const

const INSTRUCTIONS = `You help a user fill in a synthetic demo brokerage-onboarding form. This is a demonstration only:
never ask for or accept real government IDs, biometric data, or payment details, and never give financial, legal, or
investment advice. When the user's speech supplies a value for one of the known form fields, call the
suggest_field_value tool with that field's key and a normalized value (dates as YYYY-MM-DD). Only ever suggest -
you never fill the form yourself. If nothing maps clearly to a known field, do not call the tool.`

export interface RealtimeSessionRequestBody {
  session: {
    type: 'realtime'
    model: string
    instructions: string
    audio: { output: { voice: string } }
    tools: {
      type: 'function'
      name: string
      description: string
      parameters: {
        type: 'object'
        properties: Record<string, { type: string; description: string; enum?: readonly string[] }>
        required: string[]
      }
    }[]
  }
}

export function buildRealtimeSessionRequest(): RealtimeSessionRequestBody {
  return {
    session: {
      type: 'realtime',
      model: REALTIME_MODEL,
      instructions: INSTRUCTIONS,
      audio: { output: { voice: REALTIME_VOICE } },
      tools: [
        {
          type: 'function',
          name: 'suggest_field_value',
          description: 'Propose a value for one known onboarding form field, for the user to explicitly accept or reject.',
          parameters: {
            type: 'object',
            properties: {
              fieldKey: { type: 'string', description: 'Which known field this value is for.', enum: FIELD_KEYS },
              value: { type: 'string', description: 'The normalized value (dates as YYYY-MM-DD).' },
              message: { type: 'string', description: 'A short, friendly confirmation to show the user.' },
            },
            required: ['fieldKey', 'value', 'message'],
          },
        },
      ],
    },
  }
}

export async function createRealtimeSession(apiKey: string): Promise<{ clientSecret: string; model: string }> {
  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'openai-safety-identifier': crypto.randomUUID(),
    },
    body: JSON.stringify(buildRealtimeSessionRequest()),
  })
  if (!response.ok) {
    throw new Error(`Failed to create a realtime voice session (${response.status})`)
  }
  const body = await response.json<{ value: string }>()
  return { clientSecret: body.value, model: REALTIME_MODEL }
}

export async function handleRealtimeSessionRequest(_request: Request, env: AssistantEnv): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: 'Voice assistant is not configured' }, 503)
  }
  const session = await createRealtimeSession(env.OPENAI_API_KEY)
  return jsonResponse(session)
}
