/**
 * Live speech-to-speech voice via OpenAI's Realtime API over WebRTC. The
 * browser never sees a long-lived API key - only a short-lived ephemeral
 * client secret minted server-side (requestRealtimeSession in api.ts). The
 * model may only *propose* a field value via the suggest_field_value tool
 * call; it never fills a form field directly (see PersonalInformationPage's
 * "Use this" explicit-acceptance step).
 */
import { requestRealtimeSession } from './api'

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error'

export interface FieldSuggestionPayload {
  fieldKey: string
  value: string
  message: string
}

export interface RealtimeVoiceCallbacks {
  onSuggestion: (suggestion: FieldSuggestionPayload) => void
  onStateChange: (state: ConnectionState) => void
  onError: (error: string) => void
}

export interface RealtimeVoiceSession {
  close: () => void
}

interface RealtimeEvent {
  type: string
  response?: {
    output?: { type: string; name?: string; arguments?: string; call_id?: string }[]
  }
}

export function isRealtimeVoiceSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export async function startRealtimeSession({ onSuggestion, onStateChange, onError }: RealtimeVoiceCallbacks): Promise<RealtimeVoiceSession | null> {
  if (!isRealtimeVoiceSupported()) {
    onError('unsupported')
    return null
  }

  onStateChange('connecting')
  let micStream: MediaStream
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    onError('not-allowed')
    return null
  }

  let session: { clientSecret: string }
  try {
    session = await requestRealtimeSession()
  } catch (reason) {
    micStream.getTracks().forEach((track) => track.stop())
    onError((reason as Error).message)
    return null
  }

  const peerConnection = new RTCPeerConnection()
  micStream.getTracks().forEach((track) => peerConnection.addTrack(track, micStream))

  const remoteAudio = new Audio()
  remoteAudio.autoplay = true
  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0]
  }

  const dataChannel = peerConnection.createDataChannel('oai-events')
  dataChannel.onmessage = (event) => {
    handleRealtimeEvent(event.data, dataChannel, onSuggestion)
  }

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') onStateChange('open')
    if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') onStateChange('error')
    if (peerConnection.connectionState === 'closed') onStateChange('closed')
  }

  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    body: offer.sdp,
    headers: { authorization: `Bearer ${session.clientSecret}`, 'content-type': 'application/sdp' },
  })
  if (!sdpResponse.ok) {
    micStream.getTracks().forEach((track) => track.stop())
    peerConnection.close()
    onError(`Voice connection failed (${sdpResponse.status})`)
    return null
  }
  await peerConnection.setRemoteDescription({ type: 'answer', sdp: await sdpResponse.text() })

  return {
    close: () => {
      micStream.getTracks().forEach((track) => track.stop())
      dataChannel.close()
      peerConnection.close()
      onStateChange('closed')
    },
  }
}

function handleRealtimeEvent(raw: string, dataChannel: RTCDataChannel, onSuggestion: (suggestion: FieldSuggestionPayload) => void) {
  let event: RealtimeEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return
  }
  if (event.type !== 'response.done') return

  for (const output of event.response?.output ?? []) {
    if (output.type !== 'function_call' || output.name !== 'suggest_field_value' || !output.arguments) continue
    try {
      const args = JSON.parse(output.arguments) as FieldSuggestionPayload
      onSuggestion(args)
      if (dataChannel.readyState === 'open' && output.call_id) {
        dataChannel.send(JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: output.call_id, output: JSON.stringify({ acknowledged: true }) },
        }))
      }
    } catch {
      // Malformed tool-call arguments - ignore rather than surface a raw suggestion.
    }
  }
}
