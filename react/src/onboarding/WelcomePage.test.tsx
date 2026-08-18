import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  createApplication: vi.fn(),
  continueActivity: vi.fn(),
  getResumeState: vi.fn(),
}))

vi.mock('./api', () => api)

import WelcomePage, { RESUME_STORAGE_KEY } from './WelcomePage'

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('disables Continue until both acknowledgements are checked', async () => {
    render(<WelcomePage onReady={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))

    const continueButton = screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement
    expect(continueButton.disabled).toBe(true)

    fireEvent.click(screen.getByText(/demonstration using synthetic data only/i))
    expect(continueButton.disabled).toBe(true)

    fireEvent.click(screen.getByText(/mock chat\/voice guidance/i))
    expect(continueButton.disabled).toBe(false)
  })

  it('creates an application, completes consent, and calls onReady with the resulting state', async () => {
    api.createApplication.mockResolvedValue({ publicReference: 'ref-1', status: 'DRAFT' })
    api.continueActivity.mockResolvedValue({
      publicReference: 'ref-1',
      currentActivityNumber: 3,
      wizardScreen: 2,
      completionPercentage: 10,
      activities: [],
      fieldValues: {},
    })
    const onReady = vi.fn()

    render(<WelcomePage onReady={onReady} />)
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByText(/demonstration using synthetic data only/i))
    fireEvent.click(screen.getByText(/mock chat\/voice guidance/i))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(onReady).toHaveBeenCalled())
    expect(api.continueActivity).toHaveBeenCalledWith('ref-1', 1, expect.any(String))
    expect(localStorage.getItem(RESUME_STORAGE_KEY)).toBe('ref-1')
  })

  it('resumes automatically when a public reference is already stored', async () => {
    localStorage.setItem(RESUME_STORAGE_KEY, 'ref-existing')
    const resumeState = {
      publicReference: 'ref-existing',
      currentActivityNumber: 5,
      wizardScreen: 3,
      completionPercentage: 20,
      activities: [],
      fieldValues: {},
    }
    api.getResumeState.mockResolvedValue(resumeState)
    const onReady = vi.fn()

    render(<WelcomePage onReady={onReady} />)

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(resumeState))
    expect(api.createApplication).not.toHaveBeenCalled()
  })

  it('clears a stale stored reference and shows the welcome screen when resume fails', async () => {
    localStorage.setItem(RESUME_STORAGE_KEY, 'ref-gone')
    api.getResumeState.mockRejectedValue(new Error('Failed to resume onboarding application (404)'))

    render(<WelcomePage onReady={vi.fn()} />)

    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    expect(localStorage.getItem(RESUME_STORAGE_KEY)).toBeNull()
  })
})
