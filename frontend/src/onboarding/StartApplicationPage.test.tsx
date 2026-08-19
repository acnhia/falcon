import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  createApplication: vi.fn(),
  requestCaptureLink: vi.fn(),
}))

vi.mock('./api', () => api)

import StartApplicationPage from './StartApplicationPage'

describe('StartApplicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('starting an application shows the public reference and DRAFT status', async () => {
    api.createApplication.mockResolvedValue({ publicReference: 'ref-123', status: 'DRAFT' })

    render(<StartApplicationPage />)
    fireEvent.click(screen.getByRole('button', { name: /start demo onboarding/i }))

    await waitFor(() => screen.getByText('ref-123'))
    screen.getByText('DRAFT')
  })

  it('requesting a capture link shows the capture URL, expiry, and one-time-use warning', async () => {
    api.createApplication.mockResolvedValue({ publicReference: 'ref-123', status: 'DRAFT' })
    api.requestCaptureLink.mockResolvedValue({
      captureUrl: 'http://localhost:5173/#/capture/token-abc',
      expiresAt: '2026-08-17T19:00:00Z',
    })

    render(<StartApplicationPage />)
    fireEvent.click(screen.getByRole('button', { name: /start demo onboarding/i }))
    await waitFor(() => screen.getByRole('button', { name: /request identity capture link/i }))
    fireEvent.click(screen.getByRole('button', { name: /request identity capture link/i }))

    await waitFor(() => screen.getByRole('link', { name: /capture\/token-abc/i }))
    screen.getByText(/one-time use only/i)
    screen.getByText(/2026-08-17T19:00:00Z/)
  })

  it('shows an accessible error message when starting an application fails', async () => {
    api.createApplication.mockRejectedValue(new Error('Failed to start onboarding application (500)'))

    render(<StartApplicationPage />)
    fireEvent.click(screen.getByRole('button', { name: /start demo onboarding/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Failed to start onboarding application (500)')
  })
})
