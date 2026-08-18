/**
 * Ported from DocumentValidator (backend/.../storage/DocumentValidator.java), with one
 * deliberate, documented gap: Workers has no ImageIO-equivalent full decoder. This checks
 * magic-byte signatures (confirms the declared content type matches the actual file, not
 * just trusting the header) and reads width/height directly from PNG/JPEG headers (both
 * formats embed dimensions in their first bytes - no full decode needed). WebP dimension
 * parsing is intentionally not implemented (signature-only check) - see
 * docs/brokerage-onboarding/03-deployment.md for this known gap versus the Java reference
 * implementation's full decode-and-inspect validation.
 */
export const MAX_DOCUMENT_BYTES = 8_388_608
export const MAX_IMAGE_DIMENSION_PX = 4096
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class DocumentValidationError extends Error {}

export function validateDocument(content: Uint8Array, contentType: string): void {
  const baseType = (contentType.split(';')[0] ?? '').trim().toLowerCase()
  if (!ALLOWED_MIME_TYPES.has(baseType)) {
    throw new DocumentValidationError(`Unsupported content type: ${baseType || '(none)'}`)
  }
  if (content.byteLength < 1 || content.byteLength > MAX_DOCUMENT_BYTES) {
    throw new DocumentValidationError('Document size is outside the allowed range')
  }
  if (!verifySignature(content, baseType)) {
    throw new DocumentValidationError('File content does not match the declared content type')
  }

  const dimensions = baseType === 'image/webp' ? null : readDimensions(content, baseType)
  if (baseType !== 'image/webp' && !dimensions) {
    throw new DocumentValidationError('Could not decode image header')
  }
  if (dimensions && (dimensions.width > MAX_IMAGE_DIMENSION_PX || dimensions.height > MAX_IMAGE_DIMENSION_PX)) {
    throw new DocumentValidationError('Image dimensions exceed the allowed maximum')
  }
}

function verifySignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  }
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  }
  return false
}

function readDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } | null {
  if (mimeType === 'image/png') return readPngDimensions(bytes)
  if (mimeType === 'image/jpeg') return readJpegDimensions(bytes)
  return null
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) }
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = view.getUint16(offset + 2, false)
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)
    if (isStartOfFrame) {
      if (offset + 9 > bytes.length) return null
      return { height: view.getUint16(offset + 5, false), width: view.getUint16(offset + 7, false) }
    }
    offset += 2 + length
  }
  return null
}
