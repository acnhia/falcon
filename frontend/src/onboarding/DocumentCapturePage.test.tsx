import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getCaptureContext: vi.fn(),
  uploadDocument: vi.fn(),
}))
const camera = vi.hoisted(() => ({
  startCameraStream: vi.fn(),
  stopStream: vi.fn(),
  captureFrame: vi.fn(),
}))

vi.mock('./api', () => api)
vi.mock('./cameraCapture', () => camera)

import DocumentCapturePage from './DocumentCapturePage'

describe('DocumentCapturePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:fake-url')
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a generic error message when the capture context fetch fails', async () => {
    api.getCaptureContext.mockRejectedValue(new Error('not found'))

    render(<DocumentCapturePage token="bad-token" />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('This capture link is invalid or has expired.')
    expect(screen.queryByText(/bad-token/)).toBeNull()
  })

  it('does not request the camera on initial render', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))

    expect(camera.startCameraStream).not.toHaveBeenCalled()
  })

  it('clicking capture requests the camera and shows a video preview', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
    camera.startCameraStream.mockResolvedValue({ getTracks: () => [] })

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))
    fireEvent.click(screen.getByRole('button', { name: /capture front/i }))

    await waitFor(() => expect(camera.startCameraStream).toHaveBeenCalled())
    await waitFor(() => screen.getByRole('button', { name: /take photo/i }))
  })

  it('denied camera permission falls back to file input with an explanation', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
    camera.startCameraStream.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))
    fireEvent.click(screen.getByRole('button', { name: /capture front/i }))

    await waitFor(() => screen.getByLabelText(/select front image/i))
    screen.getByText(/no camera image was uploaded/i)
  })

  it('capturing front shows a preview and a retake button', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
    camera.startCameraStream.mockResolvedValue({ getTracks: () => [] })
    camera.captureFrame.mockResolvedValue(new Blob(['front'], { type: 'image/jpeg' }))

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))
    fireEvent.click(screen.getByRole('button', { name: /capture front/i }))
    await waitFor(() => screen.getByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))

    await waitFor(() => screen.getByAltText(/front of license preview/i))
    screen.getByRole('button', { name: /retake front/i })
  })

  it('retaking front clears only the front preview, leaving back intact', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
    camera.startCameraStream.mockResolvedValue({ getTracks: () => [] })
    camera.captureFrame
      .mockResolvedValueOnce(new Blob(['front'], { type: 'image/jpeg' }))
      .mockResolvedValueOnce(new Blob(['back'], { type: 'image/jpeg' }))

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))

    fireEvent.click(screen.getByRole('button', { name: /capture front/i }))
    await waitFor(() => screen.getByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
    await waitFor(() => screen.getByAltText(/front of license preview/i))

    fireEvent.click(screen.getByRole('button', { name: /capture back/i }))
    await waitFor(() => screen.getAllByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
    await waitFor(() => screen.getByAltText(/back of license preview/i))

    fireEvent.click(screen.getByRole('button', { name: /retake front/i }))

    expect(screen.queryByAltText(/front of license preview/i)).toBeNull()
    screen.getByAltText(/back of license preview/i)
  })

  it('submit button is disabled until both sides are captured', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
    camera.startCameraStream.mockResolvedValue({ getTracks: () => [] })
    camera.captureFrame.mockResolvedValue(new Blob(['front'], { type: 'image/jpeg' }))

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))

    const initialSubmitButton = screen.getByRole('button', { name: /submit for mock validation/i }) as HTMLButtonElement
    expect(initialSubmitButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /capture front/i }))
    await waitFor(() => screen.getByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
    await waitFor(() => screen.getByAltText(/front of license preview/i))

    const submitButton = screen.getByRole('button', { name: /submit for mock validation/i }) as HTMLButtonElement
    expect(submitButton.disabled).toBe(true)
  })

  it('submitting both sides shows a mock-labeled result on success', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
    camera.startCameraStream.mockResolvedValue({ getTracks: () => [] })
    camera.captureFrame
      .mockResolvedValueOnce(new Blob(['front'], { type: 'image/jpeg' }))
      .mockResolvedValueOnce(new Blob(['back'], { type: 'image/jpeg' }))
    api.uploadDocument
      .mockResolvedValueOnce({ side: 'front', accepted: true, bothSidesCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
      .mockResolvedValueOnce({ side: 'back', accepted: true, bothSidesCaptured: true, status: 'READY_FOR_REVIEW' })

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))

    fireEvent.click(screen.getByRole('button', { name: /capture front/i }))
    await waitFor(() => screen.getByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
    await waitFor(() => screen.getByAltText(/front of license preview/i))

    fireEvent.click(screen.getByRole('button', { name: /capture back/i }))
    await waitFor(() => screen.getAllByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
    await waitFor(() => screen.getByAltText(/back of license preview/i))

    fireEvent.click(screen.getByRole('button', { name: /submit for mock validation/i }))

    const result = await screen.findByText(/mock validation completed/i)
    expect(result).toBeTruthy()
    expect(screen.queryByText(/real identity/i)).toBeTruthy()
    expect(screen.queryByText(/KYC/)).toBeTruthy()
  })

  it('shows an accessible retryable error when an upload fails', async () => {
    api.getCaptureContext.mockResolvedValue({ frontCaptured: false, backCaptured: false, status: 'IDENTITY_CAPTURE_REQUESTED' })
    camera.startCameraStream.mockResolvedValue({ getTracks: () => [] })
    camera.captureFrame
      .mockResolvedValueOnce(new Blob(['front'], { type: 'image/jpeg' }))
      .mockResolvedValueOnce(new Blob(['back'], { type: 'image/jpeg' }))
    api.uploadDocument.mockRejectedValue(new Error('Unsupported content type: image/gif'))

    render(<DocumentCapturePage token="token-1" />)
    await waitFor(() => screen.getByText('Front'))

    fireEvent.click(screen.getByRole('button', { name: /capture front/i }))
    await waitFor(() => screen.getByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
    await waitFor(() => screen.getByAltText(/front of license preview/i))

    fireEvent.click(screen.getByRole('button', { name: /capture back/i }))
    await waitFor(() => screen.getAllByRole('button', { name: /take photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
    await waitFor(() => screen.getByAltText(/back of license preview/i))

    fireEvent.click(screen.getByRole('button', { name: /submit for mock validation/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Unsupported content type: image/gif')
    const submitButton = screen.getByRole('button', { name: /submit for mock validation/i }) as HTMLButtonElement
    expect(submitButton.disabled).toBe(false)
  })
})
