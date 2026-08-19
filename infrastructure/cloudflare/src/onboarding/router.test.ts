import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { authedFetch } from '../test-support/auth'

const adultFields = () => ({
  legalFirstName: 'Ada',
  legalLastName: 'Lovelace',
  dateOfBirth: '1990-01-01',
  email: 'ada@example.test',
  phone: '555-123-4567',
  residentialCountry: 'US',
  residentialAddressLine1: '123 Synthetic St',
  residentialCity: 'Springfield',
  residentialState: 'IL',
  residentialPostalCode: '62701',
  maritalStatus: 'SINGLE',
  citizenship: 'US_CITIZEN',
  isBrokerDealerAffiliated: 'false',
  isControlPerson: 'false',
  isPoliticallyExposedPerson: 'false',
  employmentStatus: 'EMPLOYED',
  annualIncomeRange: 'FROM_50K_TO_100K',
  netWorthRange: 'FROM_50K_TO_100K',
  liquidNetWorthRange: 'FROM_25K_TO_50K',
  sourceOfFunds: 'EMPLOYMENT_INCOME',
  investmentObjective: 'GROWTH',
  riskTolerance: 'MODERATE',
  investmentExperience: 'LIMITED',
  timeHorizon: 'LONG_TERM',
  deliveryPreference: 'E_DELIVERY',
  w9Certification: 'true',
  esignatureConsent: 'true',
})

describe('onboarding: create and resume', () => {
  it('creates a DRAFT application with activity 2 auto-completed and resumes at activity 1', async () => {
    const application = await createApplication()
    expect(application.status).toBe('DRAFT')
    expect(application.publicReference).toBeTruthy()

    const state = await resumeState(application.publicReference)
    expect(state.currentActivityNumber).toBe(1)
    expect(state.wizardScreen).toBe(1)
    expect(state.activities).toHaveLength(21)
    expect(state.activities.find((a: { activityNumber: number }) => a.activityNumber === 2).status).toBe('COMPLETED')
  })

  it('resuming an unknown public reference returns a safe 404', async () => {
    const res = await authedFetch('https://example.com/api/onboarding/applications/does-not-exist/resume')
    expect(res.status).toBe(404)
  })
})

describe('onboarding: consent activity', () => {
  it('continuing activity 1 completes it and advances resume to activity 3', async () => {
    const application = await createApplication()
    const res = await continueActivity(application.publicReference, 1)
    expect(res.status).toBe(200)

    const state = await resumeState(application.publicReference)
    expect(state.currentActivityNumber).toBe(3)
    expect(state.wizardScreen).toBe(2)
  })
})

describe('onboarding: personal information activity', () => {
  it('saves a draft, then continuing with all required fields completes activity 3 and runs the mock pre-check', async () => {
    const application = await createApplication()
    await continueActivity(application.publicReference, 1)

    const draftRes = await saveDraft(application.publicReference, 3, adultFields())
    expect(draftRes.status).toBe(200)
    const drafted = await draftRes.json()
    expect(drafted.fieldValues.legalFirstName).toBe('Ada')

    const continueRes = await continueActivity(application.publicReference, 3)
    expect(continueRes.status).toBe(200)
    const state = await continueRes.json()
    expect(activityStatus(state, 3)).toBe('COMPLETED')
    expect(activityStatus(state, 4)).toBe('COMPLETED')
  })

  it('continuing activity 3 with missing required fields returns a safe 400', async () => {
    const application = await createApplication()
    await continueActivity(application.publicReference, 1)
    const incomplete = { ...adultFields() }
    delete (incomplete as Record<string, string>).email
    await saveDraft(application.publicReference, 3, incomplete)

    const res = await continueActivity(application.publicReference, 3)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('email')
  })

  it('an underage date of birth leaves activity 4 blocked rather than completed', async () => {
    const application = await createApplication()
    await continueActivity(application.publicReference, 1)
    await saveDraft(application.publicReference, 3, { ...adultFields(), dateOfBirth: '2015-01-01' })

    const res = await continueActivity(application.publicReference, 3)
    const state = await res.json()
    expect(activityStatus(state, 3)).toBe('COMPLETED')
    expect(activityStatus(state, 4)).toBe('BLOCKED')
  })

  it('retrying continue with the same idempotency key does not re-run the mock pre-check', async () => {
    const application = await createApplication()
    await continueActivity(application.publicReference, 1)
    await saveDraft(application.publicReference, 3, adultFields())

    const idempotencyKey = crypto.randomUUID()
    await continueActivity(application.publicReference, 3, idempotencyKey)
    const secondState = await (await continueActivity(application.publicReference, 3, idempotencyKey)).json()
    expect(activityStatus(secondState, 4)).toBe('COMPLETED')

    const row = await env.ONBOARDING_DB.prepare(
      'SELECT COUNT(*) as count FROM provider_check pc JOIN onboarding_application a ON a.id = pc.application_id WHERE a.public_reference = ?',
    ).bind(application.publicReference).first<{ count: number }>()
    expect(row?.count).toBe(1)
  })

  it('changing date of birth after the pre-check completed marks activity 4 stale', async () => {
    const application = await createApplication()
    await continueActivity(application.publicReference, 1)
    await saveDraft(application.publicReference, 3, adultFields())
    await continueActivity(application.publicReference, 3)

    const res = await saveDraft(application.publicReference, 3, { dateOfBirth: '1985-05-05' })
    const state = await res.json()
    expect(activityStatus(state, 4)).toBe('STALE')
  })

  it('rejects save/continue for an activity number this phase does not support', async () => {
    const application = await createApplication()
    const res = await saveDraft(application.publicReference, 5, {})
    expect(res.status).toBe(400)
  })

  it('rejects an invalid enum value for a controlled-selection field', async () => {
    const application = await createApplication()
    const res = await saveDraft(application.publicReference, 3, { ...adultFields(), maritalStatus: 'NOT_A_REAL_STATUS' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('maritalStatus')
  })

  it('rejects an invalid boolean value for a Yes/No field', async () => {
    const application = await createApplication()
    const res = await saveDraft(application.publicReference, 3, { ...adultFields(), isControlPerson: 'maybe' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('isControlPerson')
  })
})

describe('onboarding: identity capture', () => {
  it('issues a capture link, tracks front/back capture, and reaches READY_FOR_REVIEW after both sides', async () => {
    const application = await createApplication()
    const linkRes = await authedFetch(
      `https://example.com/api/onboarding/applications/${application.publicReference}/capture-links`, { method: 'POST' })
    expect(linkRes.status).toBe(200)
    const link = await linkRes.json()
    const token = link.captureUrl.match(/#\/capture\/([^/?#]+)$/)[1]

    const contextBefore = await (await authedFetch(`https://example.com/api/onboarding/captures/${token}`)).json()
    expect(contextBefore.frontCaptured).toBe(false)

    const frontRes = await uploadDocument(token, 'front', jpegBytes(100, 100))
    expect(frontRes.status).toBe(200)
    const frontBody = await frontRes.json()
    expect(frontBody.bothSidesCaptured).toBe(false)

    const backRes = await uploadDocument(token, 'back', jpegBytes(100, 100))
    const backBody = await backRes.json()
    expect(backBody.bothSidesCaptured).toBe(true)
    expect(backBody.status).toBe('READY_FOR_REVIEW')
  })

  it('a used capture token returns a safe generic error on reuse', async () => {
    const application = await createApplication()
    const link = await (await authedFetch(
      `https://example.com/api/onboarding/applications/${application.publicReference}/capture-links`, { method: 'POST' })).json()
    const token = link.captureUrl.match(/#\/capture\/([^/?#]+)$/)[1]

    await uploadDocument(token, 'front', jpegBytes(100, 100))
    await uploadDocument(token, 'back', jpegBytes(100, 100))

    const res = await authedFetch(`https://example.com/api/onboarding/captures/${token}`)
    expect(res.status).toBe(404)
  })

  it('issuing a second capture link before the first is used is rejected as an illegal state transition', async () => {
    const application = await createApplication()
    await authedFetch(`https://example.com/api/onboarding/applications/${application.publicReference}/capture-links`, { method: 'POST' })

    const res = await authedFetch(
      `https://example.com/api/onboarding/applications/${application.publicReference}/capture-links`, { method: 'POST' })
    expect(res.status).toBe(409)
  })

  it('rejects an oversized document', async () => {
    const application = await createApplication()
    const link = await (await authedFetch(
      `https://example.com/api/onboarding/applications/${application.publicReference}/capture-links`, { method: 'POST' })).json()
    const token = link.captureUrl.match(/#\/capture\/([^/?#]+)$/)[1]

    const oversized = new Uint8Array(8_388_609)
    const res = await uploadDocument(token, 'front', oversized)
    expect(res.status).toBe(400)
  })

  it('rejects a document whose content does not match its declared content type', async () => {
    const application = await createApplication()
    const link = await (await authedFetch(
      `https://example.com/api/onboarding/applications/${application.publicReference}/capture-links`, { method: 'POST' })).json()
    const token = link.captureUrl.match(/#\/capture\/([^/?#]+)$/)[1]

    const notActuallyJpeg = new TextEncoder().encode('this is not an image')
    const res = await uploadDocument(token, 'front', notActuallyJpeg)
    expect(res.status).toBe(400)
  })

  it('rejects a document whose dimensions exceed the allowed maximum', async () => {
    const application = await createApplication()
    const link = await (await authedFetch(
      `https://example.com/api/onboarding/applications/${application.publicReference}/capture-links`, { method: 'POST' })).json()
    const token = link.captureUrl.match(/#\/capture\/([^/?#]+)$/)[1]

    const res = await uploadDocument(token, 'front', jpegBytes(5000, 5000))
    expect(res.status).toBe(400)
  })
})

async function createApplication(): Promise<{ publicReference: string; status: string }> {
  const res = await authedFetch('https://example.com/api/onboarding/applications', { method: 'POST' })
  return res.json()
}

async function resumeState(publicReference: string) {
  const res = await authedFetch(`https://example.com/api/onboarding/applications/${publicReference}/resume`)
  return res.json()
}

function continueActivity(publicReference: string, activityNumber: number, idempotencyKey = crypto.randomUUID()) {
  return authedFetch(
    `https://example.com/api/onboarding/applications/${publicReference}/activities/${activityNumber}/continue`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey }) },
  )
}

function saveDraft(publicReference: string, activityNumber: number, fields: Record<string, string>, idempotencyKey = crypto.randomUUID()) {
  return authedFetch(
    `https://example.com/api/onboarding/applications/${publicReference}/activities/${activityNumber}`,
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields, idempotencyKey }) },
  )
}

function uploadDocument(token: string, side: 'front' | 'back', bytes: Uint8Array) {
  return authedFetch(`https://example.com/api/onboarding/captures/${token}/documents/${side}`, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg' },
    body: bytes,
  })
}

interface ActivityView {
  activityNumber: number
  status: string
}

function activityStatus(state: { activities: ActivityView[] }, activityNumber: number): string {
  return state.activities.find((a: { activityNumber: number }) => a.activityNumber === activityNumber).status
}

function jpegBytes(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(23)
  const view = new DataView(buf.buffer)
  buf[0] = 0xff
  buf[1] = 0xd8 // SOI
  buf[2] = 0xff
  buf[3] = 0xc0 // SOF0
  view.setUint16(4, 17, false) // segment length
  buf[6] = 8 // precision
  view.setUint16(7, height, false)
  view.setUint16(9, width, false)
  buf[11] = 3 // number of components
  buf[21] = 0xff
  buf[22] = 0xd9 // EOI
  return buf
}
