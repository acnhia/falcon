import { describe, expect, it } from 'vitest'
import { chunkFile } from './chunkFile'

describe('chunkFile', () => {
  it('splits a file into sequentially numbered parts and preserves all bytes', () => {
    const file = new File(['abcdefghij'], 'sample.txt')

    const parts = chunkFile(file, 4)

    expect(parts.map(({ partNumber, size }) => ({ partNumber, size }))).toEqual([
      { partNumber: 1, size: 4 },
      { partNumber: 2, size: 4 },
      { partNumber: 3, size: 2 },
    ])
  })

  it('returns no parts when no file is selected', () => {
    expect(chunkFile(null)).toEqual([])
  })
})
