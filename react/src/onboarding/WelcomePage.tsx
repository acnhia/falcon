import { useEffect, useState } from 'react'
import { createApplication, continueActivity, getResumeState, type ResumeStateResponse } from './api'

export const RESUME_STORAGE_KEY = 'onboarding.publicReference'

interface Props {
  onReady: (state: ResumeStateResponse) => void
}

export default function WelcomePage({ onReady }: Props) {
  const [checking, setChecking] = useState(true)
  const [demoAcknowledged, setDemoAcknowledged] = useState(false)
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedReference = localStorage.getItem(RESUME_STORAGE_KEY)
    if (!storedReference) {
      setChecking(false)
      return
    }
    getResumeState(storedReference)
      .then(onReady)
      .catch(() => {
        localStorage.removeItem(RESUME_STORAGE_KEY)
        setChecking(false)
      })
    // onReady is expected to be stable for the lifetime of this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleContinue() {
    setBusy(true)
    setError(null)
    try {
      const application = await createApplication()
      localStorage.setItem(RESUME_STORAGE_KEY, application.publicReference)
      const state = await continueActivity(application.publicReference, 1, crypto.randomUUID())
      onReady(state)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (checking) {
    return (
      <main className="wizard-dark wizard-welcome">
        <p>Loading…</p>
      </main>
    )
  }

  return (
    <main className="wizard-dark wizard-welcome">
      <p className="wizard-disclosure">
        This is a demonstration of a brokerage account-onboarding experience. All data is synthetic; no real
        identity, KYC, AML, or fraud check occurs.
      </p>
      <h1>Welcome</h1>
      <p>Before you continue, please acknowledge the following:</p>

      <label className="wizard-checkbox">
        <input
          type="checkbox"
          checked={demoAcknowledged}
          onChange={(event) => setDemoAcknowledged(event.target.checked)}
        />
        I understand this is a demonstration using synthetic data only, not a real brokerage account.
      </label>
      <label className="wizard-checkbox">
        <input
          type="checkbox"
          checked={privacyAcknowledged}
          onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
        />
        I understand this demo may show mock chat/voice guidance and must not enter real personal information.
      </label>

      <button type="button" onClick={handleContinue} disabled={!demoAcknowledged || !privacyAcknowledged || busy}>
        Continue
      </button>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
