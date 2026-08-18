/**
 * Thin wrapper around the browser's built-in Web Speech API (SpeechRecognition /
 * webkitSpeechRecognition) - free, no API key, no server round-trip for audio.
 * Not available in every browser (notably Safari/Firefox); callers must check
 * isSpeechRecognitionSupported() and fall back to a fully working text path,
 * per REQUIREMENTS.md's "denial must retain a fully functional text path".
 */
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionWindow {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as SpeechRecognitionWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

export interface StartListeningCallbacks {
  onResult: (transcript: string) => void
  onError: (error: string) => void
  onEnd: () => void
}

/** Starts listening and returns the active recognition instance, or null if unsupported (onError is still called). */
export function startListening({ onResult, onError, onEnd }: StartListeningCallbacks): SpeechRecognitionLike | null {
  const Constructor = getSpeechRecognitionConstructor()
  if (!Constructor) {
    onError('unsupported')
    return null
  }

  const recognition = new Constructor()
  recognition.lang = 'en-US'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onresult = (event) => onResult(event.results[0][0].transcript)
  recognition.onerror = (event) => onError(event.error)
  recognition.onend = () => onEnd()
  recognition.start()
  return recognition
}

export function stopListening(recognition: SpeechRecognitionLike | null | undefined): void {
  recognition?.stop()
}
