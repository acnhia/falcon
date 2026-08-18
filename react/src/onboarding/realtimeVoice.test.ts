import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ requestRealtimeSession: vi.fn() }))
vi.mock('./api', () => api)

import { isRealtimeVoiceSupported, startRealtimeSession } from './realtimeVoice'

class FakeDataChannel {
  onmessage: ((event: { data: string }) => void) | null = null
  readyState: 'open' | 'closed' = 'open'
  sent: string[] = []
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 'closed'
  }
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = []
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  connectionState = 'new'
  addedTracks: unknown[] = []
  dataChannel = new FakeDataChannel()
  closed = false

  constructor() {
    FakePeerConnection.instances.push(this)
  }
  addTrack(track: unknown) {
    this.addedTracks.push(track)
  }
  createDataChannel() {
    return this.dataChannel
  }
  async createOffer() {
    return { sdp: 'fake-offer-sdp', type: 'offer' as const }
  }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  close() {
    this.closed = true
  }
}

function fakeMicStream() {
  const track = { stop: vi.fn() }
  return { getTracks: () => [track], stopped: () => track.stop.mock.calls.length > 0 }
}

beforeEach(() => {
  vi.clearAllMocks()
  FakePeerConnection.instances = []
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(fakeMicStream()) },
    configurable: true,
  })
  vi.stubGlobal('Audio', class {
    autoplay = false
    srcObject: unknown = null
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'fake-answer-sdp' }))
  api.requestRealtimeSession.mockResolvedValue({ clientSecret: 'ephemeral-secret', model: 'gpt-realtime-2.1' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isRealtimeVoiceSupported', () => {
  it('is true when RTCPeerConnection and getUserMedia both exist', () => {
    expect(isRealtimeVoiceSupported()).toBe(true)
  })

  it('is false when RTCPeerConnection is missing', () => {
    vi.stubGlobal('RTCPeerConnection', undefined)
    expect(isRealtimeVoiceSupported()).toBe(false)
  })
})

describe('startRealtimeSession', () => {
  it('reports unsupported and never requests the microphone when WebRTC is unavailable', async () => {
    vi.stubGlobal('RTCPeerConnection', undefined)
    const onError = vi.fn()

    const session = await startRealtimeSession({ onSuggestion: vi.fn(), onStateChange: vi.fn(), onError })

    expect(session).toBeNull()
    expect(onError).toHaveBeenCalledWith('unsupported')
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  })

  it('reports not-allowed when the browser denies microphone permission', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    const onError = vi.fn()

    const session = await startRealtimeSession({ onSuggestion: vi.fn(), onStateChange: vi.fn(), onError })

    expect(session).toBeNull()
    expect(onError).toHaveBeenCalledWith('not-allowed')
  })

  it('requests an ephemeral session before exchanging SDP, and posts the offer with the ephemeral secret', async () => {
    await startRealtimeSession({ onSuggestion: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })

    expect(api.requestRealtimeSession).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/realtime/calls', expect.objectContaining({
      method: 'POST',
      body: 'fake-offer-sdp',
      headers: { authorization: 'Bearer ephemeral-secret', 'content-type': 'application/sdp' },
    }))
  })

  it('maps a suggest_field_value function-call event to onSuggestion', async () => {
    const onSuggestion = vi.fn()
    await startRealtimeSession({ onSuggestion, onStateChange: vi.fn(), onError: vi.fn() })

    const pc = FakePeerConnection.instances[0]
    pc.dataChannel.onmessage?.({
      data: JSON.stringify({
        type: 'response.done',
        response: {
          output: [{
            type: 'function_call', name: 'suggest_field_value', call_id: 'call-1',
            arguments: JSON.stringify({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Got it.' }),
          }],
        },
      }),
    })

    expect(onSuggestion).toHaveBeenCalledWith({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Got it.' })
    expect(pc.dataChannel.sent).toHaveLength(1)
  })

  it('ignores non-function-call and unrelated event types without throwing', async () => {
    const onSuggestion = vi.fn()
    await startRealtimeSession({ onSuggestion, onStateChange: vi.fn(), onError: vi.fn() })

    const pc = FakePeerConnection.instances[0]
    expect(() => pc.dataChannel.onmessage?.({ data: 'not json' })).not.toThrow()
    expect(() => pc.dataChannel.onmessage?.({ data: JSON.stringify({ type: 'session.created' }) })).not.toThrow()
    expect(onSuggestion).not.toHaveBeenCalled()
  })

  it('close() stops the microphone tracks and closes the peer connection', async () => {
    const session = await startRealtimeSession({ onSuggestion: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })
    const pc = FakePeerConnection.instances[0]

    session?.close()

    expect(pc.closed).toBe(true)
  })
})
