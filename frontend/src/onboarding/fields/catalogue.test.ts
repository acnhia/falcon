import { describe, expect, it } from 'vitest'
import { FIELDS, FIELD_KEYS } from '../../../../backend/contracts/index'
import { FIELD_KIND, FIELD_LABEL, SELECT_OPTIONS } from './catalogue'

/**
 * The frontend catalogue is presentation, so labels and control types are free to differ from the
 * contract. What is not free to differ is which fields exist and which values a controlled-selection
 * field offers - a dropdown offering a value the backends reject is a defect the user only discovers
 * on submit.
 */
describe('frontend catalogue agrees with the onboarding contract', () => {
  it('labels every field the contract declares', () => {
    for (const key of FIELD_KEYS) {
      expect(FIELD_LABEL[key], `no label for contract field '${key}'`).toBeTruthy()
    }
  })

  it('does not offer fields the contract does not declare', () => {
    const declared = new Set(FIELD_KEYS)
    for (const key of Object.keys(FIELD_LABEL)) {
      expect(declared.has(key), `'${key}' is shown to users but absent from the contract`).toBe(true)
    }
  })

  it('offers exactly the values the contract permits for each controlled-selection field', () => {
    for (const field of FIELDS.filter((f) => f.allowedValues)) {
      const offered = (SELECT_OPTIONS[field.key] ?? []).map(([value]) => value).sort()
      expect(offered, `options for '${field.key}' drifted from the contract`)
        .toEqual([...(field.allowedValues ?? [])].sort())
    }
  })

  it('renders every contract enum field as a selection control', () => {
    for (const field of FIELDS.filter((f) => f.type === 'ENUM')) {
      expect(FIELD_KIND[field.key], `'${field.key}' is an enum but not rendered as a select`).toBe('select')
    }
  })
})
