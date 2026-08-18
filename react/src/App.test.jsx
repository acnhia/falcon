import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

vi.mock('./upload/UploadPage', () => ({ default: () => <div>upload-page-stub</div> }))
vi.mock('./download/DownloadPage', () => ({ default: ({ shareToken }) => <div>download-page-stub-{shareToken}</div> }))
vi.mock('./onboarding/StartApplicationPage', () => ({ default: () => <div>start-application-page-stub</div> }))
vi.mock('./onboarding/DocumentCapturePage', () => ({ default: ({ token }) => <div>document-capture-page-stub-{token}</div> }))
vi.mock('./onboarding/OnboardingWizard', () => ({ default: () => <div>onboarding-wizard-stub</div> }))

import App from './App.jsx'

describe('App routing', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  afterEach(() => {
    cleanup()
    window.location.hash = ''
  })

  it('renders the onboarding wizard at the bare root route', () => {
    render(<App />)

    screen.getByText('onboarding-wizard-stub')
  })

  it('renders the file-transfer upload demo at #/upload', () => {
    window.location.hash = '#/upload'
    render(<App />)

    screen.getByText('upload-page-stub')
  })

  it('renders the download page for a share token', () => {
    window.location.hash = '#/downloads/token-abc'
    render(<App />)

    screen.getByText('download-page-stub-token-abc')
  })

  it('renders the document capture page for a capture token', () => {
    window.location.hash = '#/capture/token-xyz'
    render(<App />)

    screen.getByText('document-capture-page-stub-token-xyz')
  })

  it('still supports the legacy #/onboarding route', () => {
    window.location.hash = '#/onboarding'
    render(<App />)

    screen.getByText('start-application-page-stub')
  })
})
