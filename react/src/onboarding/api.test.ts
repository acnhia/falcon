import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCaptureContext, requestCaptureLink, uploadDocument } from './api'

describe('onboarding api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requestCaptureLink throws with the server error message on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'No onboarding application found for reference ref-1' }),
    } as Response)

    await expect(requestCaptureLink('ref-1')).rejects.toThrow(
      'No onboarding application found for reference ref-1',
    )
  })

  it('getCaptureContext returns parsed JSON on success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' }),
    } as Response)

    const context = await getCaptureContext('token-1')

    expect(context).toEqual({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
  })

  it('getCaptureContext throws a generic message when the link is invalid', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'This capture link is invalid or has expired.' }),
    } as Response)

    await expect(getCaptureContext('bad-token')).rejects.toThrow(
      'This capture link is invalid or has expired.',
    )
  })
})

describe('uploadDocument', () => {
  let instances: FakeXhr[]

  class FakeXhr {
    method = ''
    url = ''
    sent = false
    upload: { onprogress?: (event: ProgressEvent) => void } = {}
    open(method: string, url: string) {
      this.method = method
      this.url = url
    }
    setRequestHeader(_name: string, _value: string) {}
    send(_body?: unknown) {
      this.sent = true
    }
  }

  beforeEach(() => {
    instances = []
    class TrackedFakeXhr extends FakeXhr {
      constructor() {
        super()
        instances.push(this)
      }
    }
    vi.stubGlobal('XMLHttpRequest', TrackedFakeXhr)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a PUT to the correct per-side documents path', () => {
    const blob = new Blob(['data'], { type: 'image/jpeg' })
    uploadDocument('token-1', 'front', blob)

    expect(instances).toHaveLength(1)
    expect(instances[0].method).toBe('PUT')
    expect(instances[0].url).toContain('/onboarding/captures/token-1/documents/front')
    expect(instances[0].sent).toBe(true)
  })
})
