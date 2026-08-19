import { uploadPart } from './api'

/**
 * Hand-rolled concurrency-limited pool: `concurrency` "worker" async
 * functions all pull from the same shared `nextIndex` cursor and race to
 * grab the next part, mirroring the queue + fixed worker pool pattern used
 * on the Java backend (there it's a BlockingQueue drained by N virtual
 * threads; here it's an index shared by N in-flight promises).
 *
 * Each part gets one retry before the whole upload is treated as failed.
 */
export async function uploadParts(sessionId, parts, { concurrency = 4, onPartProgress, signal } = {}) {
  let nextIndex = 0
  const results = new Array(parts.length)

  async function uploadWithRetry(part, attempt = 1) {
    try {
      return await uploadPart(sessionId, part.partNumber, part.blob, {
        signal,
        onProgress: (fraction) => onPartProgress?.(part.partNumber, fraction),
      })
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError' || attempt >= 2) throw err
      return uploadWithRetry(part, attempt + 1)
    }
  }

  async function worker() {
    while (nextIndex < parts.length) {
      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')
      const index = nextIndex++
      results[index] = await uploadWithRetry(parts[index])
    }
  }

  const workerCount = Math.min(concurrency, parts.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}
