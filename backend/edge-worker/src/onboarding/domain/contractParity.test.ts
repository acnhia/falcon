import { describe, expect, it } from 'vitest'
import { ENUM_FIELD_KEYS, FIELDS, allowedValuesFor as contractAllowedValues } from '../../../../contracts/index'
import { allowedValuesFor } from './enumFieldValues'

/**
 * Parity between this runtime and backend/contracts. The Java service has an equivalent suite
 * (OnboardingContractParityTest), so the shared contract is enforced on both sides rather than
 * maintained by discipline - the drift risk the code-standards review raised as its P0 finding.
 */
describe('edge worker matches the onboarding field contract', () => {
  it('implements an allowlist for every controlled-selection field the contract declares', () => {
    for (const key of ENUM_FIELD_KEYS) {
      expect(allowedValuesFor(key), `no allowlist implemented for '${key}'`).toBeDefined()
    }
  })

  it('accepts exactly the values the contract permits, for every enum field', () => {
    for (const key of ENUM_FIELD_KEYS) {
      const expected = [...(contractAllowedValues(key) ?? [])].sort()
      const actual = [...(allowedValuesFor(key) ?? [])].sort()
      expect(actual, `allowed values for '${key}' drifted from the contract`).toEqual(expected)
    }
  })

  it('does not enforce allowlists on fields the contract leaves open', () => {
    const open = FIELDS.filter((f) => f.type !== 'ENUM').map((f) => f.key)
    for (const key of open) {
      expect(allowedValuesFor(key), `'${key}' is constrained here but open in the contract`).toBeUndefined()
    }
  })
})
