import { useState } from 'react'
import WelcomePage, { RESUME_STORAGE_KEY } from './WelcomePage'
import PersonalInformationPage from './PersonalInformationPage'
import type { ResumeStateResponse } from './api'

/**
 * Top-level container for the wizard (see
 * docs/brokerage-onboarding/05-wizard-data-and-services.md). This demo is a
 * single form/stage - once the welcome screen hands off, the personal
 * information page is the whole wizard.
 */
export default function OnboardingWizard() {
  const [state, setState] = useState<ResumeStateResponse | null>(null)

  function handleRestart() {
    localStorage.removeItem(RESUME_STORAGE_KEY)
    setState(null)
  }

  if (!state) {
    return <WelcomePage onReady={setState} onRestart={handleRestart} />
  }

  return (
    <PersonalInformationPage
      publicReference={state.publicReference}
      initialFieldValues={state.fieldValues}
      onContinued={setState}
      onRestart={handleRestart}
    />
  )
}
