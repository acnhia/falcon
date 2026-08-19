import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { RESUME_STORAGE_KEY } = vi.hoisted(() => ({ RESUME_STORAGE_KEY: 'onboarding.publicReference' }))

vi.mock('./WelcomePage', () => ({
  RESUME_STORAGE_KEY,
  default: ({ onReady, onRestart }: { onReady: (state: unknown) => void; onRestart: () => void }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onReady({
            publicReference: 'ref-1',
            currentActivityNumber: 3,
            wizardScreen: 2,
            completionPercentage: 10,
            activities: [],
            fieldValues: {},
          })
        }
      >
        go-to-stage-2
      </button>
      <button type="button" onClick={onRestart}>
        welcome-restart
      </button>
    </div>
  ),
}))

vi.mock('./PersonalInformationPage', () => ({
  default: ({ onRestart }: { onRestart: () => void }) => (
    <button type="button" onClick={onRestart}>
      stage2-restart
    </button>
  ),
}))

import OnboardingWizard from './OnboardingWizard'

describe('OnboardingWizard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('starts on the welcome screen', () => {
    render(<OnboardingWizard />)

    screen.getByText('go-to-stage-2')
  })

  it('restarting from the welcome screen clears the stored reference', () => {
    localStorage.setItem(RESUME_STORAGE_KEY, 'ref-existing')
    render(<OnboardingWizard />)

    fireEvent.click(screen.getByText('welcome-restart'))

    expect(localStorage.getItem(RESUME_STORAGE_KEY)).toBeNull()
  })

  it('restarting from a later stage returns to the beginning and clears the stored reference', () => {
    localStorage.setItem(RESUME_STORAGE_KEY, 'ref-1')
    render(<OnboardingWizard />)
    fireEvent.click(screen.getByText('go-to-stage-2'))
    screen.getByText('stage2-restart')

    fireEvent.click(screen.getByText('stage2-restart'))

    screen.getByText('go-to-stage-2')
    expect(localStorage.getItem(RESUME_STORAGE_KEY)).toBeNull()
  })
})
