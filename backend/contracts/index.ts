/**
 * The onboarding field contract, shared by every runtime that implements the onboarding API.
 *
 * `onboarding-field-catalogue.json` is the single source of truth for which fields exist, which are
 * required, and which values the controlled-selection fields accept. The Cloudflare Worker
 * (canonical production runtime) and the Java service (reference implementation) must both agree
 * with it, and parity tests in each runtime fail if they do not - see backend/contracts/README.md.
 *
 * Deliberately narrow: this covers only what the runtimes must agree on. Presentation concerns such
 * as field labels and control types stay in the frontend, where disagreement is harmless.
 */
import catalogue from './onboarding-field-catalogue.json'

export type FieldType = 'STRING' | 'BOOLEAN' | 'ENUM'

export interface FieldContract {
  key: string
  type: FieldType
  required: boolean
  allowedValues?: string[]
}

export const CONTRACT_VERSION: number = catalogue.version
export const ACTIVITY_NUMBER: number = catalogue.activityNumber
export const FIELDS: readonly FieldContract[] = catalogue.fields as FieldContract[]

export const FIELD_KEYS: readonly string[] = FIELDS.map((f) => f.key)
export const REQUIRED_FIELD_KEYS: readonly string[] = FIELDS.filter((f) => f.required).map((f) => f.key)
export const ENUM_FIELD_KEYS: readonly string[] = FIELDS.filter((f) => f.type === 'ENUM').map((f) => f.key)
export const BOOLEAN_FIELD_KEYS: readonly string[] = FIELDS.filter((f) => f.type === 'BOOLEAN').map((f) => f.key)

const ALLOWED_VALUES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  FIELDS.filter((f) => f.allowedValues).map((f) => [f.key, new Set(f.allowedValues)] as const),
)

/** Undefined for a field with no controlled-selection allowlist. */
export function allowedValuesFor(fieldKey: string): ReadonlySet<string> | undefined {
  return ALLOWED_VALUES.get(fieldKey)
}
