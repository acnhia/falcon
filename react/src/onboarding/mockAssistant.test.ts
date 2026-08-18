import { describe, expect, it } from 'vitest'
import { suggestionFor } from './mockAssistant'

describe('mockAssistant', () => {
  it('suggests a value for the focused field when one is given', () => {
    const suggestion = suggestionFor('email', {})

    expect(suggestion?.fieldKey).toBe('email')
    expect(suggestion?.value).toContain('@')
  })

  it('falls back to the first empty required field when nothing is focused', () => {
    const suggestion = suggestionFor(null, { legalFirstName: 'Ada', legalLastName: 'Lovelace' })

    expect(suggestion?.fieldKey).toBe('dateOfBirth')
  })

  it('returns null when every required field already has a value and none is focused', () => {
    const suggestion = suggestionFor(null, {
      legalFirstName: 'Ada',
      legalLastName: 'Lovelace',
      dateOfBirth: '1990-01-01',
      email: 'ada@example.test',
      residentialCountry: 'US',
    })

    expect(suggestion).toBeNull()
  })

  it('falls back to the first empty required field for an unrecognized field key', () => {
    const suggestion = suggestionFor('notAField', {})

    expect(suggestion?.fieldKey).toBe('legalFirstName')
  })

  it('returns null for an unrecognized field key when every required field is already filled', () => {
    const suggestion = suggestionFor('notAField', {
      legalFirstName: 'Ada',
      legalLastName: 'Lovelace',
      dateOfBirth: '1990-01-01',
      email: 'ada@example.test',
      residentialCountry: 'US',
    })

    expect(suggestion).toBeNull()
  })
})
