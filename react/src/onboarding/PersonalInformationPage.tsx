import { useEffect, useRef, useState } from 'react'
import { saveActivityDraft, continueActivity, type ResumeStateResponse } from './api'
import { suggestionFor, REQUIRED_FIELD_ORDER, OPTIONAL_FIELD_ORDER, type FieldSuggestion } from './mockAssistant'
import { isRealtimeVoiceSupported, startRealtimeSession, type RealtimeVoiceSession } from './realtimeVoice'

const MAX_VOICE_SESSION_MS = 3 * 60_000

interface Props {
  publicReference: string
  initialFieldValues: Record<string, string>
  initialCompletionPercentage: number
  onContinued: (state: ResumeStateResponse) => void
}

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  suggestion?: FieldSuggestion
}

type VoiceState = 'idle' | 'connecting' | 'live'

const FIELD_LABEL: Record<string, string> = {
  legalFirstName: 'Legal first name',
  legalLastName: 'Legal last name',
  dateOfBirth: 'Date of birth',
  email: 'Email',
  residentialCountry: 'Residential country',
  preferredFirstName: 'Preferred first name',
  preferredLastName: 'Preferred last name',
  phone: 'Phone',
}

const voiceSupported = isRealtimeVoiceSupported()

export default function PersonalInformationPage({
  publicReference,
  initialFieldValues,
  initialCompletionPercentage,
  onContinued,
}: Props) {
  const [fields, setFields] = useState<Record<string, string>>(initialFieldValues)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [completionPercentage, setCompletionPercentage] = useState(initialCompletionPercentage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I can suggest synthetic demo values for this form. Nothing you enter here is a real identity.',
    },
  ])
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const sessionRef = useRef<RealtimeVoiceSession | null>(null)
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => sessionRef.current?.close()
  }, [])

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function addMessage(message: ChatMessage) {
    setMessages((prev) => [...prev, message])
  }

  function handleAskAssistant() {
    const suggestion = suggestionFor(focusedField, fields)
    if (!suggestion) {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', text: 'Every field already has a value - nothing to suggest.' })
      return
    }
    addMessage({ id: crypto.randomUUID(), role: 'assistant', text: suggestion.message, suggestion })
  }

  function endVoiceSession() {
    sessionRef.current?.close()
    sessionRef.current = null
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
      sessionTimeoutRef.current = null
    }
    setVoiceState('idle')
  }

  async function handleMicClick() {
    if (voiceState !== 'idle') {
      endVoiceSession()
      return
    }
    setVoiceState('connecting')
    const session = await startRealtimeSession({
      onSuggestion: (suggestion) => addMessage({ id: crypto.randomUUID(), role: 'assistant', text: suggestion.message, suggestion }),
      onStateChange: (state) => {
        if (state === 'open') setVoiceState('live')
        if (state === 'error') {
          addMessage({ id: crypto.randomUUID(), role: 'assistant', text: 'Voice session had a problem - you can still use the text chat below.' })
          setVoiceState('idle')
        }
        if (state === 'closed') setVoiceState('idle')
      },
      onError: handleVoiceError,
    })
    sessionRef.current = session
    if (session) {
      sessionTimeoutRef.current = setTimeout(() => {
        addMessage({ id: crypto.randomUUID(), role: 'assistant', text: 'Ending the voice session after 3 minutes to limit usage.' })
        endVoiceSession()
      }, MAX_VOICE_SESSION_MS)
    }
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
      const state = await saveActivityDraft(publicReference, 3, fields, crypto.randomUUID())
      setCompletionPercentage(state.completionPercentage)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleContinue() {
    setBusy(true)
    setError(null)
    try {
      await saveActivityDraft(publicReference, 3, fields, crypto.randomUUID())
      const state = await continueActivity(publicReference, 3, crypto.randomUUID())
      onContinued(state)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="wizard-dark wizard-workspace">
      <p className="wizard-disclosure">
        Demonstration only - synthetic data. Voice sessions are a live AI conversation (ends automatically after
        3 minutes); any suggested value still requires your explicit approval before it fills a field.
      </p>
      <h1>Personal information — stage 2 of 21</h1>
      <div className="wizard-progress-overall">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${completionPercentage}%` }} />
        </div>
        <span>{completionPercentage}% complete</span>
      </div>

      <div className="wizard-two-panel">
        <section className="wizard-form-panel" aria-label="Personal information form">
          {REQUIRED_FIELD_ORDER.map((key) => (
            <div className="wizard-field" key={key}>
              <label htmlFor={`field-${key}`}>
                {FIELD_LABEL[key]} <span aria-hidden="true">*</span>
              </label>
              <input
                id={`field-${key}`}
                required
                value={fields[key] ?? ''}
                onFocus={() => setFocusedField(key)}
                onChange={(event) => updateField(key, event.target.value)}
              />
            </div>
          ))}
          {OPTIONAL_FIELD_ORDER.map((key) => (
            <div className="wizard-field" key={key}>
              <label htmlFor={`field-${key}`}>{FIELD_LABEL[key]} (optional)</label>
              <input
                id={`field-${key}`}
                value={fields[key] ?? ''}
                onFocus={() => setFocusedField(key)}
                onChange={(event) => updateField(key, event.target.value)}
              />
            </div>
          ))}

          <div className="actions">
            <button type="button" onClick={handleSaveDraft} disabled={busy}>
              Save draft
            </button>
            <button type="button" onClick={handleContinue} disabled={busy}>
              Continue
            </button>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <aside className="wizard-chat-panel" aria-label="Guided demo assistant">
          <h2>Guided assistant</h2>
          <ul className="wizard-chat-log" aria-live="polite">
            {messages.map((message) => (
              <li key={message.id} className={`wizard-chat-message wizard-chat-${message.role}`}>
                <p>{message.text}</p>
                {message.suggestion && (
                  <button type="button" onClick={() => handleUseSuggestion(message.suggestion as FieldSuggestion)}>
                    Use this
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={handleAskAssistant}>
            Ask for a suggestion
          </button>

          {voiceSupported ? (
            <div className="wizard-voice-control">
              {voiceState !== 'idle' && <div className={`voice-orb voice-orb-${voiceState}`} aria-hidden="true" />}
              <button type="button" className="wizard-mic-button" aria-pressed={voiceState === 'live'} onClick={handleMicClick}>
                {voiceState === 'connecting' && '🎤 Connecting…'}
                {voiceState === 'live' && '🎤 End voice session'}
                {voiceState === 'idle' && '🎤 Ask with voice'}
              </button>
            </div>
          ) : (
            <p className="wizard-voice-unsupported">Voice input isn't supported in this browser - use the text chat above.</p>
          )}
        </aside>
      </div>
    </main>
  )
}
