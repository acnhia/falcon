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

class FakeAudio {
  static instances: FakeAudio[] = []
  autoplay = false
  style = { display: '' }
  srcObject: unknown = null
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  remove = vi.fn()

  constructor() {
    FakeAudio.instances.push(this)
  }
}

function fakeMicStream() {
  const track = { stop: vi.fn() }
  return { getTracks: () => [track] }
}

function functionCallEvent(name: string, args: unknown, callId = 'call-1') {
  return { data: JSON.stringify({ type: 'response.done', response: { output: [{ type: 'function_call', name, call_id: callId, arguments: JSON.stringify(args) }] } }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  FakePeerConnection.instances = []
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(fakeMicStream()) },
    configurable: true,
  })
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
  // The Audio stub isn't a real DOM Node - appendChild/remove around it are irrelevant to what these tests verify.
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'fake-answer-sdp' }))
  api.requestRealtimeSession.mockResolvedValue({ clientSecret: 'ephemeral-secret', model: 'gpt-realtime-2.1' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

    const session = await startRealtimeSession({ onPropose: vi.fn(), onConfirm: vi.fn(), onStateChange: vi.fn(), onError })

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

    const session = await startRealtimeSession({ onPropose: vi.fn(), onConfirm: vi.fn(), onStateChange: vi.fn(), onError })

    expect(session).toBeNull()
    expect(onError).toHaveBeenCalledWith('not-allowed')
  })

  it('requests an ephemeral session before exchanging SDP, and posts the offer with the ephemeral secret', async () => {
    await startRealtimeSession({ onPropose: vi.fn(), onConfirm: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })

    expect(api.requestRealtimeSession).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/realtime/calls', expect.objectContaining({
      method: 'POST',
      body: 'fake-offer-sdp',
      headers: { authorization: 'Bearer ephemeral-secret', 'content-type': 'application/sdp' },
    }))
  })

  it('attaches and plays the remote audio track when it arrives', async () => {
    await startRealtimeSession({ onPropose: vi.fn(), onConfirm: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })

    const pc = FakePeerConnection.instances[0]
    const fakeStream = {} as MediaStream
    pc.ontrack?.({ streams: [fakeStream] })

    const audio = FakeAudio.instances[0]
    expect(audio.srcObject).toBe(fakeStream)
    expect(audio.play).toHaveBeenCalled()
  })

  it('a propose_field_value call notifies onPropose and acknowledges the tool call', async () => {
    const onPropose = vi.fn()
    await startRealtimeSession({ onPropose, onConfirm: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })

    const pc = FakePeerConnection.instances[0]
    pc.dataChannel.onmessage?.(functionCallEvent('propose_field_value', { fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Should I use September 13, 1981?' }))

    expect(onPropose).toHaveBeenCalledWith({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Should I use September 13, 1981?' })
    expect(pc.dataChannel.sent).toHaveLength(1)
  })

  it('a confirm_field_value call for a previously proposed field notifies onConfirm', async () => {
    const onConfirm = vi.fn()
    await startRealtimeSession({ onPropose: vi.fn(), onConfirm, onStateChange: vi.fn(), onError: vi.fn() })

    const pc = FakePeerConnection.instances[0]
    pc.dataChannel.onmessage?.(functionCallEvent('propose_field_value', { fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Should I use this?' }, 'call-1'))
    pc.dataChannel.onmessage?.(functionCallEvent('confirm_field_value', { fieldKey: 'dateOfBirth' }, 'call-2'))

    expect(onConfirm).toHaveBeenCalledWith({ fieldKey: 'dateOfBirth', value: '1981-09-13', message: 'Should I use this?' })
  })

  it('ignores a confirm_field_value call for a field that was never proposed', async () => {
    const onConfirm = vi.fn()
    await startRealtimeSession({ onPropose: vi.fn(), onConfirm, onStateChange: vi.fn(), onError: vi.fn() })

    const pc = FakePeerConnection.instances[0]
    pc.dataChannel.onmessage?.(functionCallEvent('confirm_field_value', { fieldKey: 'dateOfBirth' }))

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('ignores non-function-call and unrelated event types without throwing', async () => {
    const onPropose = vi.fn()
    await startRealtimeSession({ onPropose, onConfirm: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })

    const pc = FakePeerConnection.instances[0]
    expect(() => pc.dataChannel.onmessage?.({ data: 'not json' })).not.toThrow()
    expect(() => pc.dataChannel.onmessage?.({ data: JSON.stringify({ type: 'session.created' }) })).not.toThrow()
    expect(onPropose).not.toHaveBeenCalled()
  })

  it('close() stops the microphone tracks and closes the peer connection', async () => {
    const session = await startRealtimeSession({ onPropose: vi.fn(), onConfirm: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })
    const pc = FakePeerConnection.instances[0]

    session?.close()

    expect(pc.closed).toBe(true)
  })
})
