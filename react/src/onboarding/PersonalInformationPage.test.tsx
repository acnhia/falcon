import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  saveActivityDraft: vi.fn(),
  continueActivity: vi.fn(),
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
    voice.startRealtimeSession.mockResolvedValue({ close: vi.fn() })
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

    screen.getByText(/live AI conversation/i)
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

    const { onPropose } = voice.startRealtimeSession.mock.calls[0][0]
    onPropose({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Should I use September 13, 1981?' })

    await waitFor(() => screen.getByText('Should I use September 13, 1981?'))
    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    expect(dobInput.value).toBe('')
    expect(screen.queryByRole('button', { name: /use this/i })).toBeNull()
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
    await waitFor(() => screen.getByRole('button', { name: /^🎤 ask with voice$/i }))
  })

  it('shows a friendly message and stays functional when the browser denies microphone permission', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /ask with voice/i }))
    await waitFor(() => expect(voice.startRealtimeSession).toHaveBeenCalled())
    const { onError } = voice.startRealtimeSession.mock.calls[0][0]
    onError('not-allowed')

    await waitFor(() => screen.getByText(/permission was denied/i))
    // text chat still works
    fireEvent.click(screen.getByRole('button', { name: /ask for a suggestion/i }))
    screen.getByRole('button', { name: /use this/i })
  })

  it('hides the mic button and keeps the text chat working when realtime voice is unsupported', async () => {
    voice.isRealtimeVoiceSupported.mockReturnValue(false)
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
