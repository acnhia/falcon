import { useState } from 'react'
import WelcomePage from './WelcomePage'
import PersonalInformationPage from './PersonalInformationPage'
import type { ResumeStateResponse } from './api'

/**
 * Top-level container for the resumable wizard (see
 * docs/brokerage-onboarding/05-wizard-data-and-services.md). Only screens 1
 * and 2 are built so far; later wizard screens show a status placeholder
 * rather than pretending to be implemented.
 */
export default function OnboardingWizard() {
  const [state, setState] = useState<ResumeStateResponse | null>(null)

  if (!state) {
    return <WelcomePage onReady={setState} />
  }

  if (state.wizardScreen <= 2) {
    return (
      <PersonalInformationPage
        publicReference={state.publicReference}
        initialFieldValues={state.fieldValues}
        initialCompletionPercentage={state.completionPercentage}
        onContinued={setState}
      />
    )
  }

  return (
    <main className="wizard-dark wizard-workspace">
      <h1>Personal information saved</h1>
      <p>
        Application <strong>{state.publicReference}</strong> is {state.completionPercentage}% complete.
      </p>
      <p>Later wizard screens are not built yet in this phase.</p>
    </main>
  )
}
