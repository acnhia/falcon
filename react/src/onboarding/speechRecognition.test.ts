import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSpeechRecognitionSupported, startListening, stopListening } from './speechRecognition'

class FakeSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  started = false
  stopped = false
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null

  start() {
    this.started = true
  }

  stop() {
    this.stopped = true
    this.onend?.()
  }
}

declare global {
  interface Window {
    SpeechRecognition?: typeof FakeSpeechRecognition
    webkitSpeechRecognition?: typeof FakeSpeechRecognition
  }
}

afterEach(() => {
  delete window.SpeechRecognition
  delete window.webkitSpeechRecognition
})

describe('isSpeechRecognitionSupported', () => {
  it('is false when neither constructor is present', () => {
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('is true when SpeechRecognition is present', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('is true when only webkitSpeechRecognition is present', () => {
    window.webkitSpeechRecognition = FakeSpeechRecognition
    expect(isSpeechRecognitionSupported()).toBe(true)
  })
})

describe('startListening', () => {
  it('calls onError with "unsupported" and returns null when no recognizer exists', () => {
    const onError = vi.fn()
    const result = startListening({ onResult: vi.fn(), onError, onEnd: vi.fn() })

    expect(result).toBeNull()
    expect(onError).toHaveBeenCalledWith('unsupported')
  })

  it('starts the recognizer and forwards a recognized transcript to onResult', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const onResult = vi.fn()

    const recognition = startListening({ onResult, onError: vi.fn(), onEnd: vi.fn() }) as FakeSpeechRecognition
    expect(recognition.started).toBe(true)

    recognition.onresult?.({ results: { 0: { 0: { transcript: 'my birthday is sept 13 81' } } } })
    expect(onResult).toHaveBeenCalledWith('my birthday is sept 13 81')
  })

  it('forwards recognition errors to onError', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const onError = vi.fn()

    const recognition = startListening({ onResult: vi.fn(), onError, onEnd: vi.fn() }) as FakeSpeechRecognition
    recognition.onerror?.({ error: 'not-allowed' })

    expect(onError).toHaveBeenCalledWith('not-allowed')
  })

  it('calls onEnd when recognition ends', () => {
    window.SpeechRecognition = FakeSpeechRecognition
    const onEnd = vi.fn()

    const recognition = startListening({ onResult: vi.fn(), onError: vi.fn(), onEnd }) as FakeSpeechRecognition
    recognition.onend?.()

    expect(onEnd).toHaveBeenCalled()
  })
})

describe('stopListening', () => {
  it('stops an active recognition instance', () => {
    const recognition = new FakeSpeechRecognition()
    stopListening(recognition)
    expect(recognition.stopped).toBe(true)
  })

  it('does nothing when given null or undefined', () => {
    expect(() => stopListening(null)).not.toThrow()
    expect(() => stopListening(undefined)).not.toThrow()
  })
})
