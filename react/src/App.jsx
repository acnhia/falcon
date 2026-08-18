import React from 'react'
import UploadPage from './upload/UploadPage'
import DownloadPage from './download/DownloadPage'
import StartApplicationPage from './onboarding/StartApplicationPage'
import DocumentCapturePage from './onboarding/DocumentCapturePage'
import OnboardingWizard from './onboarding/OnboardingWizard'

function App() {
  const downloadMatch = window.location.hash.match(/^#\/downloads\/([^/?#]+)$/)
  if (downloadMatch) return <DownloadPage shareToken={downloadMatch[1]} />

  const captureMatch = window.location.hash.match(/^#\/capture\/([^/?#]+)$/)
  if (captureMatch) return <DocumentCapturePage token={captureMatch[1]} />

  if (window.location.hash === '#/onboarding') return <StartApplicationPage />
  if (window.location.hash === '#/upload') return <UploadPage />

  return <OnboardingWizard />
}

export default App
