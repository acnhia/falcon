/** Ported from AgeIdentityPrecheckService/MockDocumentValidationService - deterministic, no external call. */
export type PrecheckStatus = 'PASS' | 'NEEDS_INPUT' | 'REVIEW'

const MINIMUM_AGE = 18

export function evaluateAgeIdentityPrecheck(dateOfBirth: string | null | undefined, today: Date): PrecheckStatus {
  if (!dateOfBirth) return 'NEEDS_INPUT'
  const dob = new Date(`${dateOfBirth}T00:00:00Z`)
  if (Number.isNaN(dob.getTime())) return 'NEEDS_INPUT'

  let age = today.getUTCFullYear() - dob.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) age--

  return age >= MINIMUM_AGE ? 'PASS' : 'REVIEW'
}

export interface MockValidationResult {
  status: 'VALIDATED'
  validatedAt: string
}

/** Performs no OCR, biometric processing, or external call - not a real identity/KYC/AML check. */
export function mockValidateDocuments(): MockValidationResult {
  return { status: 'VALIDATED', validatedAt: new Date().toISOString() }
}
