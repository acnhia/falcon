import { OnboardingEnv, jsonResponse } from './db'
import { allowedValuesFor } from './enumFieldValues'

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

// Mirrors the full field set in react/src/onboarding/PersonalInformationPage.tsx's FIELD_LABEL - kept as a
// duplicated list rather than a shared module, matching this codebase's existing pattern of parallel
// independent field-key constants across the React app and this Worker (see e.g. the US-state list).
const FIELD_KEYS = [
  'legalFirstName', 'middleName', 'legalLastName', 'suffix', 'preferredFirstName', 'preferredLastName',
  'dateOfBirth', 'email', 'phone',
  'residentialAddressLine1', 'residentialAddressLine2', 'residentialCity', 'residentialState',
  'residentialPostalCode', 'residentialCountry',
  'hasMailingAddress', 'mailingAddressLine1', 'mailingAddressLine2', 'mailingCity', 'mailingState', 'mailingPostalCode',
  'maritalStatus', 'citizenship',
  'isBrokerDealerAffiliated', 'brokerDealerFirmName', 'isControlPerson', 'controlPersonCompany',
  'isPoliticallyExposedPerson', 'hasOtherBrokerageAccounts',
  'employmentStatus', 'employerName', 'occupation', 'employerAddress', 'yearsWithEmployer',
  'annualIncomeRange', 'netWorthRange', 'liquidNetWorthRange', 'taxBracketRange', 'sourceOfFunds',
  'investmentObjective', 'riskTolerance', 'investmentExperience', 'timeHorizon',
  'trustedContactName', 'trustedContactPhone', 'trustedContactEmail', 'trustedContactRelationship',
  'wantsMarginAccount', 'wantsOptionsTrading', 'wantsDividendReinvestment',
  'deliveryPreference', 'costBasisMethod', 'w9Certification', 'esignatureConsent',
] as const

// Fields with a fixed set of internal codes (see enumFieldValues.ts, the same allowlist the server validates
// against on save) - the model needs to normalize spoken answers to these exact codes, not free text.
const ENUM_FIELD_KEYS = [
  'suffix', 'residentialState', 'mailingState', 'maritalStatus', 'citizenship', 'employmentStatus',
  'annualIncomeRange', 'netWorthRange', 'liquidNetWorthRange', 'taxBracketRange', 'sourceOfFunds',
  'investmentObjective', 'riskTolerance', 'investmentExperience', 'timeHorizon', 'deliveryPreference', 'costBasisMethod',
] as const

// Yes/No fields (including the mailing-address toggle and the two consent checkboxes) - the value must be
// exactly "true" or "false", never "yes"/"no" or a sentence.
const BOOLEAN_FIELD_KEYS = [
  'hasMailingAddress', 'isBrokerDealerAffiliated', 'isControlPerson', 'isPoliticallyExposedPerson',
  'hasOtherBrokerageAccounts', 'wantsMarginAccount', 'wantsOptionsTrading', 'wantsDividendReinvestment',
  'w9Certification', 'esignatureConsent',
] as const

const ENUM_CODES_TEXT = ENUM_FIELD_KEYS
  .map((key) => `- ${key}: ${Array.from(allowedValuesFor(key) ?? []).join(', ')}`)
  .join('\n')

const INSTRUCTIONS = `You help a user fill in a synthetic demo brokerage-onboarding form, entirely by voice. This is a
demonstration only: never ask for or accept real government IDs, biometric data, or payment details, and never give
financial, legal, or investment advice.

The user will often give you several fields at once in a single sentence or paragraph - for example "my first name is
Ada, last name is Lovelace, date of birth is January 1st 1990, and my email is ada at example dot test." Listen for
every known field mentioned in what they just said, not only the first one. This includes a full mailing/residential
address given as one sentence (e.g. "123 Main St, Springfield, IL 62704") - split it into its separate known fields
(street address, city, state, ZIP code) and propose each one separately; never lump a whole address into a single
field's value.

1. For EACH known field value you heard in that turn, call propose_field_value with that field's key and a
   normalized value (dates as YYYY-MM-DD; a state is always its 2-letter USPS code). Make one propose_field_value
   call per field - if they gave you four fields, call it four times before moving on. Skip anything that doesn't
   match one of the known fields rather than guessing or getting stuck.
2. Once you've proposed everything you heard from that turn, ask the user out loud, by voice, ONE consolidated
   question that lists everything you have so far, e.g. "I have first name Ada, last name Lovelace, and date of birth
   January 1st 1990 - should I use all of these?" Do not ask field-by-field when multiple fields came in together.
3. Wait for the user's spoken reply.
4. If they clearly confirm all of it (e.g. "yes", "correct", "go ahead", "yes to all"), call confirm_field_value once
   for each field you proposed in step 1. If they only confirm some, or correct one, only call confirm_field_value
   for the ones actually confirmed - for anything corrected or declined, propose the corrected value instead and ask
   again before confirming it.

Never call confirm_field_value without first calling propose_field_value for that field and getting a clear verbal
yes in between. Never assume a value is confirmed just because the user kept talking.

Some fields only accept one of a fixed set of internal codes rather than free text - normalize what the user says to
the exact code listed below (e.g. "single" -> SINGLE, "U.S. citizen" -> US_CITIZEN, "under $25,000" -> UNDER_25K):
${ENUM_CODES_TEXT}

These fields are Yes/No questions - propose the value as exactly "true" or "false" (never "yes"/"no" or a sentence):
${BOOLEAN_FIELD_KEYS.join(', ')}.`

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
