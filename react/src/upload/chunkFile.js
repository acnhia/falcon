/** R2 (like S3) requires every part except the last to be at least 5MB. */
export const MIN_PART_SIZE = 5 * 1024 * 1024
export const DEFAULT_PART_SIZE = 8 * 1024 * 1024

export function chunkFile(file, partSize = DEFAULT_PART_SIZE) {
  if (!file) return []

  const parts = []
  let offset = 0
  let partNumber = 1
  while (offset < file.size) {
    const end = Math.min(offset + partSize, file.size)
    parts.push({ partNumber, blob: file.slice(offset, end), size: end - offset })
    offset = end
    partNumber += 1
  }
  return parts
}
