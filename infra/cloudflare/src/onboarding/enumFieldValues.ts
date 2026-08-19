/**
 * Allowed-value lists for the activity-3 fields typed ENUM. There is no
 * `allowed_values` column on `field_definition` - this stays a small, local
 * constant rather than a schema change, kept narrow to just the new
 * enum-typed fields introduced alongside it. Mirrors
 * `backend/.../domain/EnumFieldValues.java`.
 */
const SUFFIXES = new Set(['JR', 'SR', 'I', 'II', 'III', 'IV'])

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR',
])

const MARITAL_STATUSES = new Set(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'])

const CITIZENSHIP_STATUSES = new Set(['US_CITIZEN', 'RESIDENT_ALIEN', 'NON_RESIDENT_ALIEN'])

const EMPLOYMENT_STATUSES = new Set(['EMPLOYED', 'SELF_EMPLOYED', 'RETIRED', 'STUDENT', 'HOMEMAKER', 'UNEMPLOYED'])

/** Shared coarse-range buckets for income/net-worth/liquid-net-worth. */
const MONEY_RANGES = new Set([
  'UNDER_25K', 'FROM_25K_TO_50K', 'FROM_50K_TO_100K', 'FROM_100K_TO_200K', 'FROM_200K_TO_500K', 'OVER_500K',
])

const TAX_BRACKET_RANGES = new Set(['LOW', 'MODERATE', 'HIGH', 'HIGHEST'])

/** Simplified to single-select - no array/multi-select support in this schema's flat string values. */
const SOURCE_OF_FUNDS = new Set([
  'EMPLOYMENT_INCOME', 'INVESTMENTS', 'INHERITANCE', 'RETIREMENT_SAVINGS', 'BUSINESS_INCOME', 'OTHER',
])

const INVESTMENT_OBJECTIVES = new Set(['INCOME', 'GROWTH', 'GROWTH_AND_INCOME', 'SPECULATION', 'CAPITAL_PRESERVATION'])

const RISK_TOLERANCES = new Set(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'])

/** Simplified to one overall experience level rather than a per-product breakdown. */
const INVESTMENT_EXPERIENCES = new Set(['NONE', 'LIMITED', 'GOOD', 'EXTENSIVE'])

const TIME_HORIZONS = new Set(['SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM'])

const DELIVERY_PREFERENCES = new Set(['E_DELIVERY', 'PAPER'])

const COST_BASIS_METHODS = new Set(['FIFO', 'LIFO', 'SPECIFIC_IDENTIFICATION', 'AVERAGE_COST'])

const BY_FIELD_KEY: Record<string, Set<string>> = {
  suffix: SUFFIXES,
  residentialState: US_STATES,
  mailingState: US_STATES,
  maritalStatus: MARITAL_STATUSES,
  citizenship: CITIZENSHIP_STATUSES,
  employmentStatus: EMPLOYMENT_STATUSES,
  annualIncomeRange: MONEY_RANGES,
  netWorthRange: MONEY_RANGES,
  liquidNetWorthRange: MONEY_RANGES,
  taxBracketRange: TAX_BRACKET_RANGES,
  sourceOfFunds: SOURCE_OF_FUNDS,
  investmentObjective: INVESTMENT_OBJECTIVES,
  riskTolerance: RISK_TOLERANCES,
  investmentExperience: INVESTMENT_EXPERIENCES,
  timeHorizon: TIME_HORIZONS,
  deliveryPreference: DELIVERY_PREFERENCES,
  costBasisMethod: COST_BASIS_METHODS,
}

/** Undefined for a field key with no enum allowlist. */
export function allowedValuesFor(fieldKey: string): Set<string> | undefined {
  return BY_FIELD_KEY[fieldKey]
}
