import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureFrame, startCameraStream, stopStream } from './cameraCapture'

describe('startCameraStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches the returned stream to the video element', async () => {
    const fakeStream = { getTracks: () => [] } as unknown as MediaStream
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) } })
    const videoEl = {} as HTMLVideoElement

    const stream = await startCameraStream(videoEl)

    expect(stream).toBe(fakeStream)
    expect(videoEl.srcObject).toBe(fakeStream)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } })
  })

  it('propagates a permission-denied rejection', async () => {
    const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(denied) } })

    await expect(startCameraStream({} as HTMLVideoElement)).rejects.toThrow('Permission denied')
  })
})

describe('stopStream', () => {
  it('calls stop on every track', () => {
    const track1 = { stop: vi.fn() }
    const track2 = { stop: vi.fn() }
    stopStream({ getTracks: () => [track1, track2] } as unknown as MediaStream)

    expect(track1.stop).toHaveBeenCalledOnce()
    expect(track2.stop).toHaveBeenCalledOnce()
  })

  it('does nothing when given no stream', () => {
    expect(() => stopStream(null)).not.toThrow()
  })
})

describe('captureFrame', () => {
  let canvasEl: HTMLCanvasElement
  let videoEl: HTMLVideoElement
  let drawImage: ReturnType<typeof vi.fn>
  let toBlob: ReturnType<typeof vi.fn>

  beforeEach(() => {
    videoEl = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement
    drawImage = vi.fn()
    toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(['fake-image'], { type: 'image/jpeg' })))
    canvasEl = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob,
    } as unknown as HTMLCanvasElement
  })

  it('resolves with the blob produced by canvas.toBlob', async () => {
    const blob = await captureFrame(videoEl, canvasEl)

    expect(canvasEl.width).toBe(640)
    expect(canvasEl.height).toBe(480)
    expect(drawImage).toHaveBeenCalledWith(videoEl, 0, 0, 640, 480)
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('rejects when canvas.toBlob yields no blob', async () => {
    canvasEl.toBlob = (callback: BlobCallback) => callback(null)

    await expect(captureFrame(videoEl, canvasEl)).rejects.toThrow('Failed to capture image from camera')
  })
})
