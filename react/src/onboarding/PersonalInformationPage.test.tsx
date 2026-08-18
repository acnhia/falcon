import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  saveActivityDraft: vi.fn(),
  continueActivity: vi.fn(),
}))

vi.mock('./api', () => api)

import PersonalInformationPage from './PersonalInformationPage'

describe('PersonalInformationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  function renderPage(overrides: Partial<Parameters<typeof PersonalInformationPage>[0]> = {}) {
    return render(
      <PersonalInformationPage
        publicReference="ref-1"
        initialFieldValues={{}}
        initialCompletionPercentage={5}
        onContinued={vi.fn()}
        {...overrides}
      />,
    )
  }

  it('shows the stage heading and initial completion percentage', () => {
    renderPage()

    screen.getByText('Personal information — stage 2 of 21')
    screen.getByText('5% complete')
  })

  it('shows a visible mock-assistance disclosure', () => {
    renderPage()

    screen.getByText(/mock chat, and mock voice/i)
  })

  it('asking the assistant for a suggestion never changes the field until "Use this" is clicked', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask for a suggestion/i }))

    const suggestionButton = screen.getByRole('button', { name: /use this/i })
    const firstNameInput = screen.getByLabelText(/legal first name/i) as HTMLInputElement
    expect(firstNameInput.value).toBe('')

    fireEvent.click(suggestionButton)
    expect(firstNameInput.value).not.toBe('')
  })

  it('focusing a field and asking targets that field\'s suggestion', () => {
    renderPage()

    fireEvent.focus(screen.getByLabelText(/^email/i))
    fireEvent.click(screen.getByRole('button', { name: /ask for a suggestion/i }))

    const emailInput = screen.getByLabelText(/^email/i) as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: /use this/i }))
    expect(emailInput.value).toContain('@')
  })

  it('the mic button is a mock toggle that never requests real microphone access', () => {
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
    renderPage()

    const micButton = screen.getByRole('button', { name: /ask with voice/i })
    fireEvent.click(micButton)
    expect(screen.getByRole('button', { name: /listening/i }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /listening/i }))
    expect(getUserMedia).not.toHaveBeenCalled()
    screen.getByText('(mock voice) Can you suggest a value?')
  })

  it('saving a draft calls the API with the current field values', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 15 })
    renderPage()

    fireEvent.change(screen.getByLabelText(/legal first name/i), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveActivityDraft).toHaveBeenCalledWith(
      'ref-1', 3, expect.objectContaining({ legalFirstName: 'Grace' }), expect.any(String)))
    await waitFor(() => screen.getByText('15% complete'))
  })

  it('continuing saves the draft first, then calls continue, then reports the resulting state', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 15 })
    const resumeState = { publicReference: 'ref-1', wizardScreen: 3, completionPercentage: 19 }
    api.continueActivity.mockResolvedValue(resumeState)
    const onContinued = vi.fn()
    renderPage({ onContinued })

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    await waitFor(() => expect(onContinued).toHaveBeenCalledWith(resumeState))
    expect(api.saveActivityDraft).toHaveBeenCalledWith('ref-1', 3, expect.any(Object), expect.any(String))
    expect(api.continueActivity).toHaveBeenCalledWith('ref-1', 3, expect.any(String))
  })

  it('shows an accessible error message when continue fails', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 5 })
    api.continueActivity.mockRejectedValue(new Error('Missing required fields: email'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Missing required fields: email')
  })
})
