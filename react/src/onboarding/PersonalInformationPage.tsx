import { useState } from 'react'
import { saveActivityDraft, continueActivity, type ResumeStateResponse } from './api'
import { suggestionFor, REQUIRED_FIELD_ORDER, OPTIONAL_FIELD_ORDER, type FieldSuggestion } from './mockAssistant'

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
  const [listening, setListening] = useState(false)

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function pushAssistantSuggestion(source: 'text' | 'voice') {
    const suggestion = suggestionFor(focusedField, fields)
    if (!suggestion) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Every field already has a value - nothing to suggest.' },
      ])
      return
    }
    if (source === 'voice') {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', text: '(mock voice) Can you suggest a value?' },
      ])
    }
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', text: suggestion.message, suggestion },
    ])
  }

  function handleAskAssistant() {
    pushAssistantSuggestion('text')
  }

  function handleMicClick() {
    if (!listening) {
      setListening(true)
      return
    }
    setListening(false)
    pushAssistantSuggestion('voice')
  }

  function handleUseSuggestion(suggestion: FieldSuggestion) {
    updateField(suggestion.fieldKey, suggestion.value)
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', text: `Applied to ${FIELD_LABEL[suggestion.fieldKey]}.` },
    ])
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
        Demonstration only - synthetic data, mock chat, and mock voice. No real identity or financial advice.
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
          <h2>Guided assistant (mock)</h2>
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
          <button
            type="button"
            className="wizard-mic-button"
            aria-pressed={listening}
            onClick={handleMicClick}
          >
            {listening ? '🎤 Listening… (mock, click to stop)' : '🎤 Ask with voice (mock)'}
          </button>
        </aside>
      </div>
    </main>
  )
}
