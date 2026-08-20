import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { extractFieldsFromText, saveActivityDraft, continueActivity, type ResumeStateResponse } from './api'
import { isRealtimeVoiceSupported, startRealtimeSession, type FieldProposal, type RealtimeVoiceSession } from './realtimeVoice'
import RestartButton from './RestartButton'

const MAX_VOICE_SESSION_MS = 3 * 60_000

interface Props {
  publicReference: string
  initialFieldValues: Record<string, string>
  onContinued: (state: ResumeStateResponse) => void
  onRestart: () => void
}

/** The single Personal Information activity, broken into 3 wizard steps for readability. */
const STEP_TITLES = ['Personal information', 'Regulatory & employment', 'Investment profile & preferences'] as const

/** Shown in the submitted modal - a demo stand-in, not a real check pipeline. */
const SUBMISSION_CHECKS = [
  'Identity verification',
  'Address validation',
  'Regulatory & watchlist screening',
  'Account setup',
]

interface FieldSuggestion {
  fieldKey: string
  value: string
}

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  suggestion?: FieldSuggestion
  /** Still being spoken/typed in - shown with a live indicator, not yet a finished message. */
  streaming?: boolean
}

type VoiceState = 'idle' | 'connecting' | 'live'
import { FIELD_LABEL } from './fields/catalogue'
import { FieldInput } from './fields/FieldInput'


const voiceSupported = isRealtimeVoiceSupported()

export default function PersonalInformationPage({
  publicReference,
  initialFieldValues,
  onContinued,
  onRestart,
}: Props) {
  const [fields, setFields] = useState<Record<string, string>>(initialFieldValues)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showVoiceHint, setShowVoiceHint] = useState(true)
  const [muted, setMuted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! Fill this out however is easiest - type here, paste a blob of info, or use voice. For example, try '
        + 'saying or typing "my date of birth is 9/14/1981" and I\'ll convert it to the right format for you. '
        + 'Nothing here is a real identity.',
    },
  ])
  const [composerText, setComposerText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const sessionRef = useRef<RealtimeVoiceSession | null>(null)
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptMessageIds = useRef<Map<string, string>>(new Map())

  const chatLogRef = useRef<HTMLUListElement>(null)
  const pinnedToBottomRef = useRef(true)

  useEffect(() => {
    return () => sessionRef.current?.close()
  }, [])

  useEffect(() => {
    if (pinnedToBottomRef.current && chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
    }
  }, [messages])

  function handleChatScroll() {
    const el = chatLogRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedToBottomRef.current = distanceFromBottom < 24
  }

  function toggleMute(source: 'button' | 'spacebar') {
    if (!sessionRef.current) return
    const next = !muted
    sessionRef.current.setMuted(next)
    setMuted(next)
    addMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      text: next
        ? `Microphone muted (${source === 'spacebar' ? 'spacebar' : 'mute button'}) - the assistant can't hear you. Press space or the mute button to unmute.`
        : `Microphone unmuted (${source === 'spacebar' ? 'spacebar' : 'mute button'}) - the assistant can hear you again.`,
    })
  }

  // Spacebar toggles mute while a voice session is live - but never while the user is typing
  // into the composer or a form field, where space is just a space.
  useEffect(() => {
    if (voiceState !== 'live') return
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.code !== 'Space' && event.key !== ' ') return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      event.preventDefault()
      toggleMute('spacebar')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function addMessage(message: ChatMessage) {
    setMessages((prev) => [...prev, message])
  }

  /** Appends to the same message bubble as more of a spoken turn arrives, so it reads as typing in live. */
  function handleAssistantTranscriptDelta(itemId: string, delta: string) {
    setMessages((prev) => {
      const existingId = transcriptMessageIds.current.get(itemId)
      if (existingId) {
        return prev.map((message) => (message.id === existingId ? { ...message, text: message.text + delta } : message))
      }
      const newId = crypto.randomUUID()
      transcriptMessageIds.current.set(itemId, newId)
      return [...prev, { id: newId, role: 'assistant', text: delta, streaming: true }]
    })
  }

  function handleAssistantTranscriptDone(itemId: string) {
    const messageId = transcriptMessageIds.current.get(itemId)
    if (!messageId) return
    transcriptMessageIds.current.delete(itemId)
    setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, streaming: false } : message)))
  }

  async function handleSendComposer() {
    const text = composerText.trim()
    if (!text || extracting) return
    addMessage({ id: crypto.randomUUID(), role: 'user', text })
    setComposerText('')
    setExtracting(true)
    try {
      const proposals = await extractFieldsFromText(text)
      if (proposals.length === 0) {
        addMessage({
          id: crypto.randomUUID(), role: 'assistant',
          text: "I didn't find anything I could use for the form in that message - try adding more detail.",
        })
      } else {
        const labels = proposals.map((p) => FIELD_LABEL[p.fieldKey] ?? p.fieldKey).join(', ')
        addMessage({
          id: crypto.randomUUID(), role: 'assistant',
          text: `I can suggest values for: ${labels}. Use the buttons below to apply them.`,
        })
        for (const proposal of proposals) {
          addMessage({
            id: crypto.randomUUID(), role: 'assistant',
            text: `${FIELD_LABEL[proposal.fieldKey] ?? proposal.fieldKey}: ${proposal.value}`,
            suggestion: { fieldKey: proposal.fieldKey, value: proposal.value },
          })
        }
      }
    } catch (reason) {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', text: (reason as Error).message })
    } finally {
      setExtracting(false)
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendComposer()
    }
  }

  function endVoiceSession() {
    sessionRef.current?.close()
    sessionRef.current = null
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
      sessionTimeoutRef.current = null
    }
    setVoiceState('idle')
    setMuted(false)
    addMessage({ id: crypto.randomUUID(), role: 'assistant', text: 'Voice session ended.' })
  }

  /**
   * Dismissing the hint starts voice straight away, so a reviewer never has to find the mic button.
   * It must happen in this click handler: microphone permission requires a user gesture, and a
   * session started from an effect would be blocked by the browser.
   */
  function handleDismissVoiceHint() {
    setShowVoiceHint(false)
    if (voiceSupported && voiceState === 'idle') handleMicClick()
  }

  async function handleMicClick() {
    if (voiceState !== 'idle') {
      endVoiceSession()
      return
    }
    setVoiceState('connecting')
    const session = await startRealtimeSession({
      // The proposal's spoken "should I use X?" ask is shown live via the transcript-delta stream below,
      // not duplicated here - the two would otherwise show near-identical text twice.
      onPropose: () => {},
      onConfirm: handleVoiceConfirm,
      onStateChange: (state) => {
        if (state === 'open') {
          setVoiceState('live')
          addMessage({
            id: crypto.randomUUID(), role: 'assistant',
            text: 'Voice session started - microphone is live. Press the spacebar or the mute button to mute yourself at any time.',
          })
        }
        if (state === 'error') {
          addMessage({ id: crypto.randomUUID(), role: 'assistant', text: 'Voice session had a problem - you can still use the text chat below.' })
          setVoiceState('idle')
        }
        if (state === 'closed') setVoiceState('idle')
      },
      onError: handleVoiceError,
      onAssistantTranscriptDelta: handleAssistantTranscriptDelta,
      onAssistantTranscriptDone: handleAssistantTranscriptDone,
    })
    sessionRef.current = session
    if (session) {
      sessionTimeoutRef.current = setTimeout(() => {
        addMessage({ id: crypto.randomUUID(), role: 'assistant', text: 'Ending the voice session after 3 minutes to limit usage.' })
        endVoiceSession()
      }, MAX_VOICE_SESSION_MS)
    }
  }

  function handleVoiceConfirm(proposal: FieldProposal) {
    updateField(proposal.fieldKey, proposal.value)
    addMessage({
      id: crypto.randomUUID(), role: 'assistant',
      text: `Confirmed by voice - applied to ${FIELD_LABEL[proposal.fieldKey] ?? proposal.fieldKey}. You can still edit it directly if needed.`,
    })
  }

  function handleVoiceError(errorCode: string) {
    const text = errorCode === 'unsupported'
      ? "Voice input isn't supported in this browser - you can still use the text chat below."
      : errorCode === 'not-allowed'
        ? 'Microphone permission was denied - you can still use the text chat below.'
        : `Voice input had a problem (${errorCode}) - you can still use the text chat below.`
    addMessage({ id: crypto.randomUUID(), role: 'assistant', text })
    setVoiceState('idle')
  }

  function handleUseSuggestion(suggestion: FieldSuggestion) {
    updateField(suggestion.fieldKey, suggestion.value)
    addMessage({ id: crypto.randomUUID(), role: 'assistant', text: `Applied to ${FIELD_LABEL[suggestion.fieldKey] ?? suggestion.fieldKey}.` })
  }

  async function handleSaveDraft() {
    setBusy(true)
    setError(null)
    try {
      await saveActivityDraft(publicReference, 3, fields, crypto.randomUUID())
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      await saveActivityDraft(publicReference, 3, fields, crypto.randomUUID())
      const state = await continueActivity(publicReference, 3, crypto.randomUUID())
      onContinued(state)
      setSubmitted(true)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function renderField(key: string, required: boolean) {
    return <FieldInput key={key} fieldKey={key} required={required} value={fields[key]} onChange={updateField} />
  }


  const showMailingAddress = fields.hasMailingAddress === 'true'
  const showBrokerDealerFirmName = fields.isBrokerDealerAffiliated === 'true'
  const showControlPersonCompany = fields.isControlPerson === 'true'
  const showEmployerFields = fields.employmentStatus === 'EMPLOYED' || fields.employmentStatus === 'SELF_EMPLOYED'

  return (
    <main className="wizard-dark wizard-workspace">
      <RestartButton onRestart={onRestart} />
      <p className="wizard-disclosure">
        Demonstration only - synthetic data. No real SSN or tax ID is ever collected. Voice sessions are a live AI
        conversation (ends automatically after 3 minutes) - the assistant asks out loud before using anything you
        say; say "yes" to confirm, or just say the right value instead.
      </p>
      <h1>{STEP_TITLES[step - 1]}</h1>
      <ol className="wizard-steps" aria-label={`Step ${step} of ${STEP_TITLES.length}`}>
        {STEP_TITLES.map((title, index) => {
          const stepNumber = index + 1
          const state = stepNumber < step ? 'done' : stepNumber === step ? 'current' : 'upcoming'
          return (
            <li key={title} className={`wizard-step wizard-step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="wizard-step-bar" aria-hidden="true" />
              <span className="wizard-step-title">{stepNumber}. {title}</span>
            </li>
          )
        })}
      </ol>

      <div className="wizard-two-panel">
        <section className="wizard-form-panel" aria-label={`${STEP_TITLES[step - 1]} form`}>
          {step === 1 && (
            <>
              <h3>Personal</h3>
              {renderField('legalFirstName', true)}
              {renderField('middleName', false)}
              {renderField('legalLastName', true)}
              {renderField('suffix', false)}
              {renderField('preferredFirstName', false)}
              {renderField('preferredLastName', false)}
              {renderField('dateOfBirth', true)}
              {renderField('email', true)}
              {renderField('phone', true)}

              <h3>Address</h3>
              {renderField('residentialAddressLine1', true)}
              {renderField('residentialAddressLine2', false)}
              {renderField('residentialCity', true)}
              {renderField('residentialState', true)}
              {renderField('residentialPostalCode', true)}
              {renderField('residentialCountry', true)}
              {renderField('hasMailingAddress', false)}
              {showMailingAddress && (
                <div className="wizard-conditional-block">
                  <h3>Mailing address</h3>
                  {renderField('mailingAddressLine1', false)}
                  {renderField('mailingAddressLine2', false)}
                  {renderField('mailingCity', false)}
                  {renderField('mailingState', false)}
                  {renderField('mailingPostalCode', false)}
                </div>
              )}

              <h3>Marital status &amp; citizenship</h3>
              {renderField('maritalStatus', true)}
              {renderField('citizenship', true)}
            </>
          )}

          {step === 2 && (
            <>
              <h3>Regulatory disclosures</h3>
              {renderField('isBrokerDealerAffiliated', true)}
              {showBrokerDealerFirmName && renderField('brokerDealerFirmName', false)}
              {renderField('isControlPerson', true)}
              {showControlPersonCompany && renderField('controlPersonCompany', false)}
              {renderField('isPoliticallyExposedPerson', true)}
              {renderField('hasOtherBrokerageAccounts', false)}

              <h3>Employment &amp; finances</h3>
              {renderField('employmentStatus', true)}
              {showEmployerFields && (
                <div className="wizard-conditional-block">
                  {renderField('employerName', false)}
                  {renderField('occupation', false)}
                  {renderField('employerAddress', false)}
                  {renderField('yearsWithEmployer', false)}
                </div>
              )}
              {renderField('annualIncomeRange', true)}
              {renderField('netWorthRange', true)}
              {renderField('liquidNetWorthRange', true)}
              {renderField('taxBracketRange', false)}
              {renderField('sourceOfFunds', true)}
            </>
          )}

          {step === 3 && (
            <>
              <h3>Investment profile</h3>
              {renderField('investmentObjective', true)}
              {renderField('riskTolerance', true)}
              {renderField('investmentExperience', true)}
              {renderField('timeHorizon', true)}

              <h3>Trusted contact (optional)</h3>
              {renderField('trustedContactName', false)}
              {renderField('trustedContactPhone', false)}
              {renderField('trustedContactEmail', false)}
              {renderField('trustedContactRelationship', false)}

              <h3>Account features (optional)</h3>
              {renderField('wantsMarginAccount', false)}
              {renderField('wantsOptionsTrading', false)}
              {renderField('wantsDividendReinvestment', false)}

              <h3>Delivery &amp; tax certifications</h3>
              {renderField('deliveryPreference', true)}
              {renderField('costBasisMethod', false)}
              {renderField('w9Certification', true)}
              {renderField('esignatureConsent', true)}
            </>
          )}

          <div className="actions">
            {step > 1 && (
              <button type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={busy}>
                Back
              </button>
            )}
            <button type="button" onClick={handleSaveDraft} disabled={busy}>
              Save draft
            </button>
            {step < STEP_TITLES.length ? (
              <button type="button" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)} disabled={busy}>
                Next
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={busy}>
                Submit
              </button>
            )}
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <aside className="wizard-chat-panel" aria-label="Guided demo assistant">
          <h2>Guided assistant</h2>
          <ul className="wizard-chat-log" aria-live="polite" ref={chatLogRef} onScroll={handleChatScroll}>
            {messages.map((message) => (
              <li key={message.id} className={`wizard-chat-message wizard-chat-${message.role}`}>
                <p>
                  {message.text}
                  {message.streaming && <span className="wizard-chat-cursor" aria-hidden="true" />}
                </p>
                {message.suggestion && (
                  <button type="button" onClick={() => handleUseSuggestion(message.suggestion as FieldSuggestion)}>
                    Use this
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="wizard-composer">
            <textarea
              className="wizard-composer-input"
              placeholder="Type a message, or paste your info…"
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={extracting}
              rows={1}
            />
            <div className="wizard-composer-toolbar">
              {voiceSupported && (
                <button
                  type="button"
                  className="wizard-icon-button wizard-mic-button"
                  aria-pressed={voiceState === 'live'}
                  aria-label={
                    voiceState === 'live' ? 'End voice session' : voiceState === 'connecting' ? 'Connecting to voice session' : 'Ask with voice'
                  }
                  title={voiceState === 'live' ? 'End voice session' : voiceState === 'connecting' ? 'Connecting…' : 'Ask with voice'}
                  onClick={handleMicClick}
                >
                  🎤
                  {voiceState !== 'idle' && <span className={`voice-orb voice-orb-${voiceState}`} aria-hidden="true" />}
                </button>
              )}

              {voiceState === 'live' && (
                <button
                  type="button"
                  className="wizard-icon-button wizard-mute-button"
                  aria-pressed={muted}
                  aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                  title={`${muted ? 'Unmute' : 'Mute'} microphone (spacebar)`}
                  onClick={() => toggleMute('button')}
                >
                  {muted ? '🔇' : '🔊'}
                </button>
              )}
              <span className="wizard-composer-spacer" />
              <button
                type="button"
                className="wizard-icon-button wizard-send-button"
                onClick={handleSendComposer}
                disabled={extracting || !composerText.trim()}
                aria-label="Send"
                title="Send"
              >
                ➤
              </button>
            </div>
          </div>

          {!voiceSupported && (
            <p className="wizard-voice-unsupported">Voice input isn't supported in this browser - use the text chat above.</p>
          )}
        </aside>
      </div>

      {showVoiceHint && voiceSupported && (
        <div className="wizard-modal-backdrop">
          <div className="wizard-modal" role="dialog" aria-modal="true" aria-label="Try the voice option">
            <h2>Try filling this form by voice</h2>
            <p>
              Try filling this form by voice instead of typing. Closing this message starts a voice session right
              away, so just say your details - it understands every field on all three steps, and you can give
              several at once ("my name is Ada Lovelace, I live at 123 Main Street, Springfield, Illinois 62704").
            </p>
            <p>
              Your browser will ask for microphone permission. While a session is live, press the{' '}
              <strong>spacebar</strong> or the mute button to mute yourself, and the microphone button to end it.
              You can also type or paste your details into the chat instead.
            </p>
            <button type="button" onClick={handleDismissVoiceHint}>
              Start talking
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="wizard-modal-backdrop">
          <div className="wizard-modal" role="dialog" aria-modal="true" aria-label="Application submitted">
            <h2>Application submitted</h2>
            <p>We're running {SUBMISSION_CHECKS.length} checks in the background:</p>
            <ul className="wizard-modal-checks">
              {SUBMISSION_CHECKS.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
            <p>
              You can close this message - we'll let you know once your submission finishes processing.
            </p>
            <button type="button" onClick={() => setSubmitted(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
