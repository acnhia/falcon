import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { api, uploadParts } = vi.hoisted(() => ({ api: {
  initiateUpload: vi.fn(),
  completeUpload: vi.fn(),
  abortUpload: vi.fn(),
  clearTestUploads: vi.fn(),
}, uploadParts: vi.fn() }))

vi.mock('./api', () => api)
vi.mock('./uploadManager', () => ({ uploadParts }))

import UploadPage from './UploadPage'

describe('UploadPage storage quota flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('clears test uploads after explicit confirmation and retries the blocked upload', async () => {
    const quotaError = Object.assign(new Error('Upload would exceed the 10 GiB application storage limit'), {
      code: 'STORAGE_QUOTA_EXCEEDED',
    })
    api.initiateUpload
      .mockRejectedValueOnce(quotaError)
      .mockResolvedValueOnce({ sessionId: 'session-1' })
    api.clearTestUploads.mockResolvedValue({ deletedObjects: 2 })
    uploadParts.mockResolvedValue([])
    api.completeUpload.mockResolvedValue({
      shareUrl: 'https://example.com/downloads/share-token',
      downloadPageUrl: 'https://example.com/#/downloads/share-token',
    })

    render(<UploadPage />)
    fireEvent.change(screen.getByLabelText(/file/i), {
      target: { files: [new File(['test'], 'test.txt', { type: 'text/plain' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /start upload/i }))

    await waitFor(() => expect(api.clearTestUploads).toHaveBeenCalledOnce())
    await waitFor(() => expect(api.completeUpload).toHaveBeenCalledWith('session-1'))
    expect(api.initiateUpload).toHaveBeenCalledTimes(2)
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: /open download page/i }).getAttribute('href')).toBe(
      'https://example.com/#/downloads/share-token',
    )
  })
})
