import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RestartButton from './RestartButton'

describe('RestartButton', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('calls onRestart when the user confirms', () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const onRestart = vi.fn()

    render(<RestartButton onRestart={onRestart} />)
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))

    expect(window.confirm).toHaveBeenCalledOnce()
    expect(onRestart).toHaveBeenCalledOnce()
  })

  it('does not call onRestart when the user cancels the confirmation', () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    const onRestart = vi.fn()

    render(<RestartButton onRestart={onRestart} />)
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))

    expect(onRestart).not.toHaveBeenCalled()
  })
})
