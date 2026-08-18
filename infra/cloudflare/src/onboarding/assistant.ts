import { OnboardingEnv, jsonResponse } from './db'

/**
 * Live AI integration point (the only one in this repo) - mints a short-lived
 * ephemeral credential for OpenAI's Realtime API (WebRTC voice). The real
 * OPENAI_API_KEY never leaves this server; only the ephemeral client secret
 * (minutes-scale lifetime, scoped to one session) is ever sent to the
 * browser. Scope is deliberately narrow, and the interaction is voice-native
 * end to end: the model must ask out loud and get a verbal yes before a
 * value is ever applied. This is enforced with two separate tool calls
 * (propose, then confirm) rather than trusting the model's own restraint -
 * the client (realtimeVoice.ts) only applies a value on confirm_field_value,
 * and only if it matches a field that was actually proposed first. It is
 * not a general chat/advice assistant.
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

const INSTRUCTIONS = `You help a user fill in a synthetic demo brokerage-onboarding form, entirely by voice. This is a
demonstration only: never ask for or accept real government IDs, biometric data, or payment details, and never give
financial, legal, or investment advice.

When the user's speech supplies a value for one of the known form fields:
1. Call propose_field_value with that field's key and a normalized value (dates as YYYY-MM-DD).
2. Immediately ask the user out loud, by voice, something like "Should I use <value> for <field>?" - do not call any
   other tool yet.
3. Wait for the user's spoken reply.
4. If they clearly confirm (e.g. "yes", "correct", "go ahead"), call confirm_field_value for that same field. If they
   decline or correct you, do not call confirm_field_value - ask for the right value instead and start over from
   step 1.

Never call confirm_field_value without first calling propose_field_value for that field and getting a clear verbal
yes in between. Never assume a value is confirmed just because the user kept talking.`

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
          name: 'propose_field_value',
          description: 'Propose a value for one known onboarding form field. After calling this, ask the user out loud whether to use it - do not call confirm_field_value until they clearly say yes.',
          parameters: {
            type: 'object',
            properties: {
              fieldKey: { type: 'string', description: 'Which known field this value is for.', enum: FIELD_KEYS },
              value: { type: 'string', description: 'The normalized value (dates as YYYY-MM-DD).' },
              message: { type: 'string', description: 'A short, friendly summary of what is being proposed.' },
            },
            required: ['fieldKey', 'value', 'message'],
          },
        },
        {
          type: 'function',
          name: 'confirm_field_value',
          description: 'Confirms a previously proposed field value. Only call this after the user has verbally said yes to the exact field you proposed.',
          parameters: {
            type: 'object',
            properties: {
              fieldKey: { type: 'string', description: 'Which previously-proposed field the user just confirmed.', enum: FIELD_KEYS },
            },
            required: ['fieldKey'],
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
