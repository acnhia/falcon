import { useState } from 'react'
import { createApplication, requestCaptureLink } from './api'

export default function StartApplicationPage() {
  const [publicReference, setPublicReference] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleStart() {
    setError(null)
    setBusy(true)
    try {
      const application = await createApplication()
      setPublicReference(application.publicReference)
      setStatus(application.status)
      setCaptureUrl(null)
      setExpiresAt(null)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRequestCaptureLink() {
    if (!publicReference) return
    setError(null)
    setBusy(true)
    try {
      const link = await requestCaptureLink(publicReference)
      setCaptureUrl(link.captureUrl)
      setExpiresAt(link.expiresAt)
      setStatus('IDENTITY_CAPTURE_REQUESTED')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="upload-page">
      <h1>Synthetic brokerage onboarding (demo only)</h1>
      <p>
        This is a demonstration flow using synthetic applicant data. No real identity, KYC, AML, or fraud
        check is performed.
      </p>

      {!publicReference && (
        <button type="button" onClick={handleStart} disabled={busy}>
          Start demo onboarding
        </button>
      )}

      {publicReference && (
        <section aria-label="Onboarding application">
          <p>
            Application <strong>{publicReference}</strong> — status: <strong>{status}</strong>
          </p>

          {!captureUrl && (
            <button type="button" onClick={handleRequestCaptureLink} disabled={busy}>
              Request identity capture link
            </button>
          )}

          {captureUrl && (
            <div>
              <p>
                Capture link: <a href={captureUrl}>{captureUrl}</a>
              </p>
              <p>Expires at {expiresAt}. This link is one-time use only.</p>
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
