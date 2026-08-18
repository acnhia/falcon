/**
 * Deterministic, client-side-only mock assistant for the personal-information
 * workspace. No network call, no real AI, no speech-to-text - see
 * REQUIREMENTS.md's "Personal-information workspace POC" section. Every
 * suggestion requires an explicit user "Use this" action before it ever
 * touches a form field.
 */
export interface FieldSuggestion {
  fieldKey: string
  message: string
  value: string
}

const SUGGESTIONS: Record<string, FieldSuggestion> = {
  legalFirstName: { fieldKey: 'legalFirstName', value: 'Ada', message: 'A synthetic first name like "Ada" works well here.' },
  legalLastName: { fieldKey: 'legalLastName', value: 'Lovelace', message: 'Try a synthetic last name such as "Lovelace".' },
  dateOfBirth: { fieldKey: 'dateOfBirth', value: '1990-01-01', message: 'Use a synthetic adult date of birth, for example 1990-01-01.' },
  email: { fieldKey: 'email', value: 'demo@example.test', message: 'A synthetic address like "demo@example.test" works for this demo.' },
  residentialCountry: { fieldKey: 'residentialCountry', value: 'US', message: 'Try "US" for this demo.' },
  preferredFirstName: { fieldKey: 'preferredFirstName', value: 'Ada', message: 'This is optional - "Ada" is a fine synthetic example.' },
  preferredLastName: { fieldKey: 'preferredLastName', value: 'Lovelace', message: 'This is optional - "Lovelace" is a fine synthetic example.' },
  phone: { fieldKey: 'phone', value: '+15550100', message: 'This is optional - a synthetic number like "+15550100" works here.' },
}

/** Suggests a value for a field, or the first still-empty required field if none is given. */
export function suggestionFor(fieldKey: string | null, values: Record<string, string>): FieldSuggestion | null {
  if (fieldKey && SUGGESTIONS[fieldKey]) {
    return SUGGESTIONS[fieldKey]
  }
  const firstEmptyRequired = REQUIRED_FIELD_ORDER.find((key) => !values[key]?.trim())
  return firstEmptyRequired ? SUGGESTIONS[firstEmptyRequired] : null
}

export const REQUIRED_FIELD_ORDER = ['legalFirstName', 'legalLastName', 'dateOfBirth', 'email', 'residentialCountry']
export const OPTIONAL_FIELD_ORDER = ['preferredFirstName', 'preferredLastName', 'phone']
