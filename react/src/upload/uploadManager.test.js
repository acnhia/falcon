import { beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadPart } = vi.hoisted(() => ({ uploadPart: vi.fn() }))
vi.mock('./api', () => ({ uploadPart }))

import { uploadParts } from './uploadManager'

describe('uploadParts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retries one failed part once and preserves result order', async () => {
    uploadPart
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ partNumber: 1, eTag: 'one' })
      .mockResolvedValueOnce({ partNumber: 2, eTag: 'two' })

    const results = await uploadParts('session-1', [part(1), part(2)], { concurrency: 1 })

    expect(uploadPart).toHaveBeenCalledTimes(3)
    expect(results).toEqual([{ partNumber: 1, eTag: 'one' }, { partNumber: 2, eTag: 'two' }])
  })
})

const part = (partNumber) => ({ partNumber, blob: new Blob(['part']) })
