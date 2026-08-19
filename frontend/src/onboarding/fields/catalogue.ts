/**
 * Presentation catalogue for the onboarding form: how each field is labelled and which control
 * renders it.
 *
 * Deliberately separate from backend/contracts, which governs the things the runtimes must agree
 * on (field keys, required-ness, allowed values). Labels and control types are presentation, so a
 * difference here is harmless - but the keys must still exist, which fields/catalogue.test.ts
 * asserts against the contract.
 */
export type FieldKind = 'text' | 'date' | 'email' | 'tel' | 'select' | 'checkbox' | 'yesno'

export const FIELD_LABEL: Record<string, string> = {
  legalFirstName: 'Legal first name',
  middleName: 'Middle name or initial',
  legalLastName: 'Legal last name',
  suffix: 'Suffix',
  preferredFirstName: 'Preferred first name',
  preferredLastName: 'Preferred last name',
  dateOfBirth: 'Date of birth',
  email: 'Email',
  phone: 'Mobile number',
  residentialAddressLine1: 'Street address',
  residentialAddressLine2: 'Apt., suite, or unit',
  residentialCity: 'City',
  residentialState: 'State',
  residentialPostalCode: 'ZIP code',
  residentialCountry: 'Residential country',
  hasMailingAddress: 'Use a different mailing address',
  mailingAddressLine1: 'Mailing street address',
  mailingAddressLine2: 'Mailing apt., suite, or unit',
  mailingCity: 'Mailing city',
  mailingState: 'Mailing state',
  mailingPostalCode: 'Mailing ZIP code',
  maritalStatus: 'Marital status',
  citizenship: 'Citizenship',
  isBrokerDealerAffiliated: 'Affiliated with a broker-dealer or FINRA member firm (you or immediate family)',
  brokerDealerFirmName: 'Broker-dealer firm name',
  isControlPerson: 'A control person, senior officer, director, or 10%+ shareholder of a publicly traded company',
  controlPersonCompany: 'Company name',
  isPoliticallyExposedPerson: 'A politically exposed person (senior political figure or close associate)',
  hasOtherBrokerageAccounts: 'You have existing brokerage accounts at other firms',
  employmentStatus: 'Employment status',
  employerName: 'Employer name',
  occupation: 'Occupation / job title',
  employerAddress: 'Employer address',
  yearsWithEmployer: 'Years with employer',
  annualIncomeRange: 'Annual income',
  netWorthRange: 'Net worth (excluding primary residence)',
  liquidNetWorthRange: 'Liquid net worth',
  taxBracketRange: 'Federal tax bracket',
  sourceOfFunds: 'Source of funds for this account',
  investmentObjective: 'Investment objective',
  riskTolerance: 'Risk tolerance',
  investmentExperience: 'Investment experience',
  timeHorizon: 'Time horizon',
  trustedContactName: 'Trusted contact name',
  trustedContactPhone: 'Trusted contact phone',
  trustedContactEmail: 'Trusted contact email',
  trustedContactRelationship: 'Trusted contact relationship',
  wantsMarginAccount: 'Margin account',
  wantsOptionsTrading: 'Options trading',
  wantsDividendReinvestment: 'Dividend reinvestment',
  deliveryPreference: 'Statement/document delivery preference',
  costBasisMethod: 'Cost basis method',
  w9Certification: 'I certify my tax ID under penalty of perjury (backup withholding / W-9 certification)',
  esignatureConsent: 'I consent to sign this synthetic demo application electronically',
}

export const FIELD_KIND: Record<string, FieldKind> = {
  dateOfBirth: 'date',
  email: 'email',
  phone: 'tel',
  suffix: 'select',
  residentialState: 'select',
  mailingState: 'select',
  maritalStatus: 'select',
  citizenship: 'select',
  hasMailingAddress: 'checkbox',
  isBrokerDealerAffiliated: 'yesno',
  isControlPerson: 'yesno',
  isPoliticallyExposedPerson: 'yesno',
  hasOtherBrokerageAccounts: 'yesno',
  employmentStatus: 'select',
  annualIncomeRange: 'select',
  netWorthRange: 'select',
  liquidNetWorthRange: 'select',
  taxBracketRange: 'select',
  sourceOfFunds: 'select',
  investmentObjective: 'select',
  riskTolerance: 'select',
  investmentExperience: 'select',
  timeHorizon: 'select',
  deliveryPreference: 'select',
  costBasisMethod: 'select',
  trustedContactPhone: 'tel',
  trustedContactEmail: 'email',
  wantsMarginAccount: 'checkbox',
  wantsOptionsTrading: 'checkbox',
  wantsDividendReinvestment: 'checkbox',
  w9Certification: 'checkbox',
  esignatureConsent: 'checkbox',
}

const SUFFIX_OPTIONS: [string, string][] = [
  ['JR', 'Jr.'], ['SR', 'Sr.'], ['I', 'I'], ['II', 'II'], ['III', 'III'], ['IV', 'IV'],
]

const US_STATE_OPTIONS: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
  ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
  ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'], ['PR', 'Puerto Rico'],
]

const MARITAL_STATUS_OPTIONS: [string, string][] = [
  ['SINGLE', 'Single'], ['MARRIED', 'Married'], ['DIVORCED', 'Divorced'], ['WIDOWED', 'Widowed'],
]

const CITIZENSHIP_OPTIONS: [string, string][] = [
  ['US_CITIZEN', 'U.S. citizen'], ['RESIDENT_ALIEN', 'Resident alien'], ['NON_RESIDENT_ALIEN', 'Non-resident alien'],
]

const EMPLOYMENT_STATUS_OPTIONS: [string, string][] = [
  ['EMPLOYED', 'Employed'], ['SELF_EMPLOYED', 'Self-employed'], ['RETIRED', 'Retired'],
  ['STUDENT', 'Student'], ['HOMEMAKER', 'Homemaker'], ['UNEMPLOYED', 'Unemployed'],
]

const MONEY_RANGE_OPTIONS: [string, string][] = [
  ['UNDER_25K', 'Under $25,000'], ['FROM_25K_TO_50K', '$25,000–$50,000'], ['FROM_50K_TO_100K', '$50,000–$100,000'],
  ['FROM_100K_TO_200K', '$100,000–$200,000'], ['FROM_200K_TO_500K', '$200,000–$500,000'], ['OVER_500K', 'Over $500,000'],
]

const TAX_BRACKET_OPTIONS: [string, string][] = [
  ['LOW', 'Low'], ['MODERATE', 'Moderate'], ['HIGH', 'High'], ['HIGHEST', 'Highest'],
]

const SOURCE_OF_FUNDS_OPTIONS: [string, string][] = [
  ['EMPLOYMENT_INCOME', 'Employment income'], ['INVESTMENTS', 'Investments'], ['INHERITANCE', 'Inheritance'],
  ['RETIREMENT_SAVINGS', 'Retirement savings'], ['BUSINESS_INCOME', 'Business income'], ['OTHER', 'Other'],
]

const INVESTMENT_OBJECTIVE_OPTIONS: [string, string][] = [
  ['INCOME', 'Income'], ['GROWTH', 'Growth'], ['GROWTH_AND_INCOME', 'Growth & income'],
  ['SPECULATION', 'Speculation / aggressive growth'], ['CAPITAL_PRESERVATION', 'Capital preservation'],
]

const RISK_TOLERANCE_OPTIONS: [string, string][] = [
  ['CONSERVATIVE', 'Conservative'], ['MODERATE', 'Moderate'], ['AGGRESSIVE', 'Aggressive'],
]

const INVESTMENT_EXPERIENCE_OPTIONS: [string, string][] = [
  ['NONE', 'None'], ['LIMITED', 'Limited'], ['GOOD', 'Good'], ['EXTENSIVE', 'Extensive'],
]

const TIME_HORIZON_OPTIONS: [string, string][] = [
  ['SHORT_TERM', 'Short-term (under 3 years)'], ['MEDIUM_TERM', 'Medium-term (3–10 years)'], ['LONG_TERM', 'Long-term (10+ years)'],
]

const DELIVERY_PREFERENCE_OPTIONS: [string, string][] = [
  ['E_DELIVERY', 'Electronic delivery'], ['PAPER', 'Paper mail'],
]

const COST_BASIS_OPTIONS: [string, string][] = [
  ['FIFO', 'FIFO'], ['LIFO', 'LIFO'], ['SPECIFIC_IDENTIFICATION', 'Specific identification'], ['AVERAGE_COST', 'Average cost'],
]

export const SELECT_OPTIONS: Record<string, [string, string][]> = {
  suffix: SUFFIX_OPTIONS,
  residentialState: US_STATE_OPTIONS,
  mailingState: US_STATE_OPTIONS,
  maritalStatus: MARITAL_STATUS_OPTIONS,
  citizenship: CITIZENSHIP_OPTIONS,
  employmentStatus: EMPLOYMENT_STATUS_OPTIONS,
  annualIncomeRange: MONEY_RANGE_OPTIONS,
  netWorthRange: MONEY_RANGE_OPTIONS,
  liquidNetWorthRange: MONEY_RANGE_OPTIONS,
  taxBracketRange: TAX_BRACKET_OPTIONS,
  sourceOfFunds: SOURCE_OF_FUNDS_OPTIONS,
  investmentObjective: INVESTMENT_OBJECTIVE_OPTIONS,
  riskTolerance: RISK_TOLERANCE_OPTIONS,
  investmentExperience: INVESTMENT_EXPERIENCE_OPTIONS,
  timeHorizon: TIME_HORIZON_OPTIONS,
  deliveryPreference: DELIVERY_PREFERENCE_OPTIONS,
  costBasisMethod: COST_BASIS_OPTIONS,
}
