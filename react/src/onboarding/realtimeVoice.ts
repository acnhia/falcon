/**
 * Live speech-to-speech voice via OpenAI's Realtime API over WebRTC. The
 * browser never sees a long-lived API key - only a short-lived ephemeral
 * client secret minted server-side (requestRealtimeSession in api.ts).
 *
 * The interaction is voice-native end to end: the model proposes a field
 * value (propose_field_value), asks the user out loud whether to use it,
 * and only calls confirm_field_value after hearing a verbal yes (see the
 * instructions built in assistant.ts). This module enforces that as a real
 * safety boundary rather than trusting the model's own restraint: a
 * confirm_field_value call is only ever honored if it matches a field that
 * was actually proposed first (pendingProposals below) - a stray or
 * hallucinated confirm for an unproposed field is silently ignored.
 */
import { requestRealtimeSession } from './api'

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error'

export interface FieldProposal {
  fieldKey: string
  value: string
  message: string
}

export interface RealtimeVoiceCallbacks {
  /** The model has proposed a value and (per its instructions) is about to ask out loud whether to use it. */
  onPropose: (proposal: FieldProposal) => void
  /** The user verbally confirmed a previously-proposed value - safe to apply it now. */
  onConfirm: (proposal: FieldProposal) => void
  onStateChange: (state: ConnectionState) => void
  onError: (error: string) => void
  /**
   * Incremental transcript text of the assistant's spoken audio, as it's
   * spoken - lets the UI show the response typing in while it's heard, not
   * just after it finishes. `itemId` identifies which spoken turn a delta
   * belongs to, so consecutive deltas for the same turn can be appended to
   * one message instead of each starting a new one.
   */
  onAssistantTranscriptDelta?: (itemId: string, delta: string) => void
  /** That spoken turn's transcript is complete - stop treating it as still-typing. */
  onAssistantTranscriptDone?: (itemId: string) => void
}

export interface RealtimeVoiceSession {
  close: () => void
  /** Mutes/unmutes the outgoing microphone track - the assistant simply stops hearing you while muted; the connection stays open. */
  setMuted: (muted: boolean) => void
}

interface RealtimeEvent {
  type: string
  response?: {
    output?: { type: string; name?: string; arguments?: string; call_id?: string }[]
  }
  item_id?: string
  delta?: string
}

export function isRealtimeVoiceSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export async function startRealtimeSession(
  { onPropose, onConfirm, onStateChange, onError, onAssistantTranscriptDelta, onAssistantTranscriptDone }: RealtimeVoiceCallbacks,
): Promise<RealtimeVoiceSession | null> {
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
  const remoteAudio = new Audio()
  remoteAudio.autoplay = true
  remoteAudio.style.display = 'none'
  document.body.appendChild(remoteAudio)

  const cleanup = () => {
    micStream.getTracks().forEach((track) => track.stop())
    peerConnection.close()
    remoteAudio.pause()
    remoteAudio.srcObject = null
    remoteAudio.remove()
  }

  try {
    micStream.getTracks().forEach((track) => peerConnection.addTrack(track, micStream))

    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0]
      // Autoplay can be blocked without an explicit call even after a user gesture on some browsers.
      remoteAudio.play().catch(() => {})
    }

    const pendingProposals = new Map<string, FieldProposal>()
    const dataChannel = peerConnection.createDataChannel('oai-events')
    dataChannel.onmessage = (event) => {
      handleRealtimeEvent(event.data, dataChannel, pendingProposals, {
        onPropose, onConfirm, onAssistantTranscriptDelta, onAssistantTranscriptDone,
      })
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
      const detail = await sdpResponse.text().catch(() => '')
      cleanup()
      onError(`Voice connection failed (${sdpResponse.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`)
      return null
    }
    await peerConnection.setRemoteDescription({ type: 'answer', sdp: await sdpResponse.text() })

    return {
      close: () => {
        cleanup()
        dataChannel.close()
        onStateChange('closed')
      },
      setMuted: (muted: boolean) => {
        micStream.getAudioTracks().forEach((track) => { track.enabled = !muted })
      },
    }
  } catch (reason) {
    cleanup()
    onError(`Voice connection failed: ${(reason as Error).message}`)
    return null
  }
}

interface TranscriptCallbacks {
  onPropose: (proposal: FieldProposal) => void
  onConfirm: (proposal: FieldProposal) => void
  onAssistantTranscriptDelta?: (itemId: string, delta: string) => void
  onAssistantTranscriptDone?: (itemId: string) => void
}

function handleRealtimeEvent(
  raw: string,
  dataChannel: RTCDataChannel,
  pendingProposals: Map<string, FieldProposal>,
  { onPropose, onConfirm, onAssistantTranscriptDelta, onAssistantTranscriptDone }: TranscriptCallbacks,
) {
  let event: RealtimeEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return
  }

  if (event.type === 'response.output_audio_transcript.delta') {
    if (event.item_id && event.delta) onAssistantTranscriptDelta?.(event.item_id, event.delta)
    return
  }
  if (event.type === 'response.output_audio_transcript.done') {
    if (event.item_id) onAssistantTranscriptDone?.(event.item_id)
    return
  }

  if (event.type !== 'response.done') return

  for (const output of event.response?.output ?? []) {
    if (output.type !== 'function_call' || !output.name) continue

    if (output.name === 'propose_field_value' && output.arguments) {
      try {
        const proposal = JSON.parse(output.arguments) as FieldProposal
        pendingProposals.set(proposal.fieldKey, proposal)
        onPropose(proposal)
        acknowledge(dataChannel, output.call_id)
      } catch {
        // Malformed tool-call arguments - ignore rather than surface a broken proposal.
      }
      continue
    }

    if (output.name === 'confirm_field_value' && output.arguments) {
      try {
        const { fieldKey } = JSON.parse(output.arguments) as { fieldKey: string }
        const proposal = pendingProposals.get(fieldKey)
        // Only ever honored if it matches a field actually proposed first - see module docstring.
        if (proposal) {
          onConfirm(proposal)
          pendingProposals.delete(fieldKey)
        }
        acknowledge(dataChannel, output.call_id)
      } catch {
        // Malformed tool-call arguments - ignore.
      }
    }
  }
}

function acknowledge(dataChannel: RTCDataChannel, callId: string | undefined) {
  if (dataChannel.readyState === 'open' && callId) {
    dataChannel.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ acknowledged: true }) },
    }))
  }
}
