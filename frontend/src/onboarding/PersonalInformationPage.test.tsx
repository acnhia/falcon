import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  saveActivityDraft: vi.fn(),
  continueActivity: vi.fn(),
  extractFieldsFromText: vi.fn(),
}))
const voice = vi.hoisted(() => ({
  isRealtimeVoiceSupported: vi.fn(() => true),
  startRealtimeSession: vi.fn(),
}))

vi.mock('./api', () => api)
vi.mock('./realtimeVoice', () => voice)

describe('PersonalInformationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    voice.isRealtimeVoiceSupported.mockReturnValue(true)
    voice.startRealtimeSession.mockResolvedValue({ close: vi.fn(), setMuted: vi.fn() })
    api.extractFieldsFromText.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
    vi.resetModules()
  })

  /**
   * Dismisses the intro voice-hint modal, which otherwise covers the form in every test.
   *
   * Dismissing it now also starts a voice session by design, so the helper closes that session
   * again and clears the mock. Tests below therefore start from an idle baseline and keep testing
   * what they were written to test; the auto-start behaviour has its own dedicated test.
   */
  async function renderPage(overrides: Record<string, unknown> = {}) {
    const { default: PersonalInformationPage } = await import('./PersonalInformationPage')
    const result = render(
      <PersonalInformationPage
        publicReference="ref-1"
        initialFieldValues={{}}
        onContinued={vi.fn()}
        onRestart={vi.fn()}
        {...overrides}
      />,
    )
    const dismiss = screen.queryByRole('button', { name: /start talking/i })
    if (dismiss) {
      fireEvent.click(dismiss)
      await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: /end voice session|connecting to voice session/i }))
      voice.startRealtimeSession.mockClear()
    }
    return result
  }

  function sendComposerMessage(text: string) {
    fireEvent.change(screen.getByPlaceholderText(/type a message/i), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
  }

  function goToStep2() {
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  }

  function goToStep3() {
    goToStep2()
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  }

  it('shows a titled progress bar for all 3 steps, marking the current one', async () => {
    await renderPage()

    screen.getByText('Personal information')
    screen.getByText('1. Personal information')
    screen.getByText('2. Regulatory & employment')
    screen.getByText('3. Investment profile & preferences')
    expect(screen.getByText('1. Personal information').closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(screen.queryByText(/% complete/i)).toBeNull()
  })

  it('greets a first-time visitor with a modal suggesting the voice option', async () => {
    const { default: PersonalInformationPage } = await import('./PersonalInformationPage')
    render(
      <PersonalInformationPage publicReference="ref-1" initialFieldValues={{}} onContinued={vi.fn()} onRestart={vi.fn()} />,
    )

    const dialog = screen.getByRole('dialog', { name: /try the voice option/i })
    expect(dialog.textContent).toMatch(/try filling this form by voice/i)
    expect(dialog.textContent).toMatch(/spacebar/i)

    fireEvent.click(screen.getByRole('button', { name: /start talking/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('starts a voice session on dismissing the hint, so a reviewer never hunts for the mic button', async () => {
    const { default: PersonalInformationPage } = await import('./PersonalInformationPage')
    render(
      <PersonalInformationPage publicReference="ref-1" initialFieldValues={{}} onContinued={vi.fn()} onRestart={vi.fn()} />,
    )

    expect(voice.startRealtimeSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /start talking/i }))

    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalledOnce())
  })

  it('does not start voice when the browser cannot support it', async () => {
    voice.isRealtimeVoiceSupported.mockReturnValue(false)
    await renderPage()

    expect(screen.queryByRole('dialog', { name: /try the voice option/i })).toBeNull()
    expect(voice.startRealtimeSession).not.toHaveBeenCalled()
  })

  it('moves between the 3 wizard steps with Back/Next, keeping field values', async () => {
    await renderPage()

    fireEvent.change(screen.getByLabelText(/legal first name/i), { target: { value: 'Ada' } })
    goToStep2()
    expect(screen.getByText('2. Regulatory & employment').closest('li')?.getAttribute('aria-current')).toBe('step')
    screen.getByText('Regulatory disclosures')
    expect(screen.queryByLabelText(/legal first name/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    expect(screen.getByText('3. Investment profile & preferences').closest('li')?.getAttribute('aria-current')).toBe('step')
    screen.getByText('Investment profile')

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect((screen.getByLabelText(/legal first name/i) as HTMLInputElement).value).toBe('Ada')
  })

  it('shows a demo hint that voice or chat can fill fields, with a short-form date example', async () => {
    await renderPage()

    screen.getByText(/9\/14\/1981/)
  })

  it('shows a visible mock-assistance disclosure that no real SSN is collected', async () => {
    await renderPage()

    screen.getByText(/live AI conversation/i)
    screen.getByText(/no real ssn/i)
  })

  it('step 1 renders the personal, address, and marital/citizenship groups', async () => {
    await renderPage()

    screen.getByText('Personal')
    screen.getByText('Address')
    screen.getByText('Marital status & citizenship')
    screen.getByLabelText(/suffix/i)
    screen.getByLabelText(/street address/i)
    screen.getByLabelText(/marital status/i)
    screen.getByLabelText(/citizenship/i)
  })

  it('step 2 renders the regulatory disclosures and employment/finances groups', async () => {
    await renderPage()
    goToStep2()

    screen.getByText('Regulatory disclosures')
    screen.getByText('Employment & finances')
    screen.getByText(/affiliated with a broker-dealer/i)
    screen.getByText(/politically exposed person/i)
    screen.getByLabelText(/employment status/i)
    screen.getByLabelText(/annual income/i)
  })

  it('step 3 renders the investment profile, trusted contact, account features, and delivery groups', async () => {
    await renderPage()
    goToStep3()

    screen.getByText('Investment profile')
    screen.getByText('Trusted contact (optional)')
    screen.getByText('Account features (optional)')
    screen.getByText('Delivery & tax certifications')
    screen.getByLabelText(/investment objective/i)
    screen.getByLabelText(/risk tolerance/i)
    screen.getByLabelText(/margin account/i)
    screen.getByLabelText(/statement\/document delivery preference/i)
    screen.getByText(/backup withholding/i)
  })

  it('uses a native date picker for date of birth', async () => {
    await renderPage()

    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    expect(dobInput.type).toBe('date')
  })

  it('renders a field with 5 or fewer options as a dropdown', async () => {
    await renderPage()

    // maritalStatus has 4 options - should still be a <select>, same as any other field.
    const marital = screen.getByLabelText(/marital status/i)
    expect(marital.tagName).toBe('SELECT')
    fireEvent.change(marital, { target: { value: 'MARRIED' } })
    expect((marital as HTMLSelectElement).value).toBe('MARRIED')
  })

  it('renders a field with more than 5 options as a dropdown, not radio buttons', async () => {
    await renderPage()
    goToStep2()

    // employmentStatus has 6 options - should stay a <select>.
    const employmentStatus = screen.getByLabelText(/employment status/i)
    expect(employmentStatus.tagName).toBe('SELECT')
  })

  it('does not show the mailing address section until the toggle is checked', async () => {
    await renderPage()

    expect(screen.queryByLabelText(/mailing street address/i)).toBeNull()

    fireEvent.click(screen.getByLabelText(/use a different mailing address/i))

    screen.getByLabelText(/mailing street address/i)
  })

  it('does not show employer fields until employment status is Employed or Self-employed', async () => {
    await renderPage()
    goToStep2()

    expect(screen.queryByLabelText(/employer name/i)).toBeNull()

    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'SELF_EMPLOYED' } })

    screen.getByLabelText(/employer name/i)
  })

  it('does not show the broker-dealer firm name field until that Yes/No question is answered Yes', async () => {
    await renderPage()
    goToStep2()

    expect(screen.queryByLabelText(/broker-dealer firm name/i)).toBeNull()

    fireEvent.change(screen.getByLabelText(/affiliated with a broker-dealer/i), { target: { value: 'true' } })

    screen.getByLabelText(/broker-dealer firm name/i)
  })

  it('sending a composer message never changes a field until "Use this" is clicked', async () => {
    api.extractFieldsFromText.mockResolvedValue([{ fieldKey: 'legalFirstName', value: 'Ada' }])
    await renderPage()

    sendComposerMessage('My name is Ada.')

    const suggestionButton = await screen.findByRole('button', { name: /use this/i })
    const firstNameInput = screen.getByLabelText(/legal first name/i) as HTMLInputElement
    expect(firstNameInput.value).toBe('')

    fireEvent.click(suggestionButton)
    expect(firstNameInput.value).toBe('Ada')
  })

  it('shows a user chat bubble for the sent message and an acknowledgment listing what was found', async () => {
    api.extractFieldsFromText.mockResolvedValue([{ fieldKey: 'email', value: 'ada@example.test' }])
    await renderPage()

    sendComposerMessage('my email is ada@example.test')

    screen.getByText('my email is ada@example.test')
    await waitFor(() => screen.getByText(/I can suggest values for: Email/i))
  })

  it('shows a generic message when nothing could be extracted from the message', async () => {
    api.extractFieldsFromText.mockResolvedValue([])
    await renderPage()

    sendComposerMessage('hello there')

    await waitFor(() => screen.getByText(/didn't find anything/i))
  })

  it('clicking the mic button starts a realtime voice session and reflects the live state', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalledWith(expect.objectContaining({
      onPropose: expect.any(Function), onConfirm: expect.any(Function), onStateChange: expect.any(Function), onError: expect.any(Function),
    })))

    const { onStateChange } = voice.startRealtimeSession.mock.calls[0][0]
    onStateChange('open')

    await waitFor(() => expect(screen.getByRole('button', { name: /end voice session/i }).getAttribute('aria-pressed')).toBe('true'))
  })

  it('a voice proposal is shown as text only - it never fills the field by itself', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())

    const { onPropose, onAssistantTranscriptDelta } = voice.startRealtimeSession.mock.calls[0][0]
    onPropose({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Should I use September 13, 1981?' })
    onAssistantTranscriptDelta('item-1', 'Should I use September 13, 1981?')

    await waitFor(() => screen.getByText('Should I use September 13, 1981?'))
    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    expect(dobInput.value).toBe('')
    expect(screen.queryByRole('button', { name: /use this/i })).toBeNull()
  })

  it('an assistant\'s spoken response types in incrementally as transcript deltas arrive, appending to one message', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())

    const { onAssistantTranscriptDelta, onAssistantTranscriptDone } = voice.startRealtimeSession.mock.calls[0][0]
    onAssistantTranscriptDelta('item-1', 'Hel')
    await waitFor(() => screen.getByText('Hel'))
    onAssistantTranscriptDelta('item-1', 'lo there!')
    await waitFor(() => screen.getByText('Hello there!'))
    onAssistantTranscriptDone('item-1')

    // A second turn starts a new message rather than appending to the first.
    onAssistantTranscriptDelta('item-2', 'A new thought.')
    await waitFor(() => screen.getByText('A new thought.'))
    screen.getByText('Hello there!')
  })

  it('a verbal confirmation for a proposed field fills it directly, with no button click needed', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())

    const { onConfirm } = voice.startRealtimeSession.mock.calls[0][0]
    onConfirm({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Should I use September 13, 1981?' })

    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    await waitFor(() => expect(dobInput.value).toBe('1981-09-13'))
    screen.getByText(/confirmed by voice/i)
  })

  it('clicking again while live ends the voice session', async () => {
    const close = vi.fn()
    voice.startRealtimeSession.mockResolvedValue({ close })
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())
    const { onStateChange } = voice.startRealtimeSession.mock.calls[0][0]
    onStateChange('open')
    await waitFor(() => screen.getByRole('button', { name: /end voice session/i }))

    fireEvent.click(screen.getByRole('button', { name: /end voice session/i }))

    expect(close).toHaveBeenCalled()
    await waitFor(() => screen.getByRole('button', { name: /^ask with voice$/i }))
  })

  it('the mute button only appears during a live session, and toggles the mic with a log message each way', async () => {
    const setMuted = vi.fn()
    voice.startRealtimeSession.mockResolvedValue({ close: vi.fn(), setMuted })
    await renderPage()
    expect(screen.queryByRole('button', { name: /mute microphone/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())
    voice.startRealtimeSession.mock.calls[0][0].onStateChange('open')

    const muteButton = await screen.findByRole('button', { name: /^mute microphone$/i })
    fireEvent.click(muteButton)
    expect(setMuted).toHaveBeenCalledWith(true)
    await screen.findByText(/microphone muted \(mute button\)/i)

    fireEvent.click(screen.getByRole('button', { name: /^unmute microphone$/i }))
    expect(setMuted).toHaveBeenCalledWith(false)
    await screen.findByText(/microphone unmuted \(mute button\)/i)
  })

  it('the spacebar toggles mute during a live session and logs that it was the spacebar', async () => {
    const setMuted = vi.fn()
    voice.startRealtimeSession.mockResolvedValue({ close: vi.fn(), setMuted })
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())
    voice.startRealtimeSession.mock.calls[0][0].onStateChange('open')
    await screen.findByRole('button', { name: /^mute microphone$/i })

    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' })

    expect(setMuted).toHaveBeenCalledWith(true)
    await screen.findByText(/microphone muted \(spacebar\)/i)
  })

  it('the spacebar does not toggle mute while the user is typing in the composer', async () => {
    const setMuted = vi.fn()
    voice.startRealtimeSession.mockResolvedValue({ close: vi.fn(), setMuted })
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())
    voice.startRealtimeSession.mock.calls[0][0].onStateChange('open')
    await screen.findByRole('button', { name: /^mute microphone$/i })

    fireEvent.keyDown(screen.getByPlaceholderText(/type a message/i), { key: ' ', code: 'Space' })

    expect(setMuted).not.toHaveBeenCalled()
  })

  it('shows a friendly message and stays functional when the browser denies microphone permission', async () => {
    api.extractFieldsFromText.mockResolvedValue([{ fieldKey: 'legalFirstName', value: 'Ada' }])
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())
    const { onError } = voice.startRealtimeSession.mock.calls[0][0]
    onError('not-allowed')

    await waitFor(() => screen.getByText(/permission was denied/i))
    // text chat still works
    sendComposerMessage('My name is Ada.')
    await screen.findByRole('button', { name: /use this/i })
  })

  it('hides the mic button and keeps the text chat working when realtime voice is unsupported', async () => {
    voice.isRealtimeVoiceSupported.mockReturnValue(false)
    api.extractFieldsFromText.mockResolvedValue([{ fieldKey: 'legalFirstName', value: 'Ada' }])
    await renderPage()

    expect(screen.queryByRole('button', { name: /ask with voice/i })).toBeNull()
    screen.getByText(/isn't supported in this browser/i)
    sendComposerMessage('My name is Ada.')
    await screen.findByRole('button', { name: /use this/i })
  })

  it('saving a draft calls the API with the current field values', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 15 })
    await renderPage()

    fireEvent.change(screen.getByLabelText(/legal first name/i), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => expect(api.saveActivityDraft).toHaveBeenCalledWith(
      'ref-1', 3, expect.objectContaining({ legalFirstName: 'Grace' }), expect.any(String)))
  })

  it('submitting saves the draft first, then continues, then shows the submitted checks popup', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 100 })
    const resumeState = { publicReference: 'ref-1', wizardScreen: 3, completionPercentage: 100 }
    api.continueActivity.mockResolvedValue(resumeState)
    const onContinued = vi.fn()
    await renderPage({ onContinued })
    goToStep3()

    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => expect(onContinued).toHaveBeenCalledWith(resumeState))
    expect(api.saveActivityDraft).toHaveBeenCalledWith('ref-1', 3, expect.any(Object), expect.any(String))
    expect(api.continueActivity).toHaveBeenCalledWith('ref-1', 3, expect.any(String))

    screen.getByRole('dialog', { name: /application submitted/i })
    screen.getByText(/we'll let you know once your submission finishes processing/i)

    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows an accessible error message when submit fails', async () => {
    api.saveActivityDraft.mockResolvedValue({ completionPercentage: 5 })
    api.continueActivity.mockRejectedValue(new Error('Missing required fields: email'))
    await renderPage()
    goToStep3()

    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Missing required fields: email')
  })

  it('auto-scrolls the chat log to the bottom as new messages arrive, but not after the user scrolls up to read history', async () => {
    api.extractFieldsFromText.mockResolvedValue([{ fieldKey: 'legalFirstName', value: 'Ada' }])
    await renderPage()

    const chatLog = document.querySelector('.wizard-chat-log') as HTMLUListElement
    Object.defineProperty(chatLog, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(chatLog, 'clientHeight', { value: 200, configurable: true })
    chatLog.scrollTop = 300 // already at the bottom: 500 - 300 - 200 = 0

    sendComposerMessage('My name is Ada.')
    await screen.findByRole('button', { name: /use this/i })
    expect(chatLog.scrollTop).toBe(500)

    // The user scrolls up to read earlier messages.
    chatLog.scrollTop = 0
    fireEvent.scroll(chatLog)

    sendComposerMessage('My name is Ada.')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /use this/i }).length).toBeGreaterThan(1))

    expect(chatLog.scrollTop).toBe(0)
  })

  it('shows a Restart control that calls onRestart after confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const onRestart = vi.fn()
    await renderPage({ onRestart })

    fireEvent.click(screen.getByRole('button', { name: /restart/i }))

    expect(onRestart).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
