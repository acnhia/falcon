import { describe, expect, it } from 'vitest'
import { formatUploadSpeed } from './uploadSpeed'

describe('formatUploadSpeed', () => {
  it('formats bytes per second in human-readable binary units', () => {
    expect(formatUploadSpeed(0)).toBe('0 B/s')
    expect(formatUploadSpeed(1536)).toBe('1.5 KiB/s')
    expect(formatUploadSpeed(5 * 1024 * 1024)).toBe('5.0 MiB/s')
  })

  it('uses a zero-safe value while no elapsed upload time has passed', () => {
    expect(formatUploadSpeed(Number.POSITIVE_INFINITY)).toBe('0 B/s')
  })
})
