import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  saveActivityDraft: vi.fn(),
  continueActivity: vi.fn(),
  requestVoiceSuggestion: vi.fn(),
}))
const speech = vi.hoisted(() => ({
  isSpeechRecognitionSupported: vi.fn(() => true),
  startListening: vi.fn(),
  stopListening: vi.fn(),
}))

vi.mock('./api', () => api)
vi.mock('./speechRecognition', () => speech)

describe('PersonalInformationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speech.isSpeechRecognitionSupported.mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.resetModules()
  })

  async function renderPage(overrides: Record<string, unknown> = {}) {
    const { default: PersonalInformationPage } = await import('./PersonalInformationPage')
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

  it('shows the stage heading and initial completion percentage', async () => {
    await renderPage()

    screen.getByText('Personal information — stage 2 of 21')
    screen.getByText('5% complete')
  })

  it('shows a visible mock-assistance disclosure', async () => {
    await renderPage()

    screen.getByText(/browser's built-in speech recognition/i)
  })

  it('asking the assistant for a suggestion never changes the field until "Use this" is clicked', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask for a suggestion/i }))

    const suggestionButton = screen.getByRole('button', { name: /use this/i })
    const firstNameInput = screen.getByLabelText(/legal first name/i) as HTMLInputElement
    expect(firstNameInput.value).toBe('')

    fireEvent.click(suggestionButton)
    expect(firstNameInput.value).not.toBe('')
  })

  it('focusing a field and asking targets that field\'s suggestion', async () => {
    await renderPage()

    fireEvent.focus(screen.getByLabelText(/^email/i))
    fireEvent.click(screen.getByRole('button', { name: /ask for a suggestion/i }))

    const emailInput = screen.getByLabelText(/^email/i) as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: /use this/i }))
    expect(emailInput.value).toContain('@')
  })

  it('clicking the mic button starts real speech recognition', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))

    expect(speech.startListening).toHaveBeenCalledWith(expect.objectContaining({
      onResult: expect.any(Function), onError: expect.any(Function), onEnd: expect.any(Function),
    }))
    expect(screen.getByRole('button', { name: /listening/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a recognized transcript posts a real chat message and requests a server-side suggestion', async () => {
    api.requestVoiceSuggestion.mockResolvedValue({
      suggestion: { fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Got it - September 13, 1981.' },
    })
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    const { onResult } = speech.startListening.mock.calls[0][0]
    onResult('my birthday is sept 13 81')

    await waitFor(() => screen.getByText('my birthday is sept 13 81'))
    expect(api.requestVoiceSuggestion).toHaveBeenCalledWith('my birthday is sept 13 81', expect.any(Object))

    await waitFor(() => screen.getByText('Got it - September 13, 1981.'))
    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    expect(dobInput.value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /use this/i }))
    expect(dobInput.value).toBe('1981-09-13')
  })

  it('shows a friendly message and stays functional when the browser denies microphone permission', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    const { onError } = speech.startListening.mock.calls[0][0]
    onError('not-allowed')

    await waitFor(() => screen.getByText(/permission was denied/i))
    // text chat still works
    fireEvent.click(screen.getByRole('button', { name: /ask for a suggestion/i }))
    screen.getByRole('button', { name: /use this/i })
  })

  it('hides the mic button and keeps the text chat working when speech recognition is unsupported', async () => {
    speech.isSpeechRecognitionSupported.mockReturnValue(false)
    await renderPage()

    expect(screen.queryByRole('button', { name: /ask with voice/i })).toBeNull()
    screen.getByText(/isn't supported in this browser/i)
    fireEvent.click(screen.getByRole('button', { name: /ask for a suggestion/i }))
    screen.getByRole('button', { name: /use this/i })
  })

  it('saving a draft calls the API with the current field values', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 15 })
    await renderPage()

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
    await renderPage({ onContinued })

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    await waitFor(() => expect(onContinued).toHaveBeenCalledWith(resumeState))
    expect(api.saveActivityDraft).toHaveBeenCalledWith('ref-1', 3, expect.any(Object), expect.any(String))
    expect(api.continueActivity).toHaveBeenCalledWith('ref-1', 3, expect.any(String))
  })

  it('shows an accessible error message when continue fails', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 5 })
    api.continueActivity.mockRejectedValue(new Error('Missing required fields: email'))
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Missing required fields: email')
  })
})
