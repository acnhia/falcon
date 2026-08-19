/** Upload-session shape shared by the Durable Object and the routes that drive it. */
export interface InitiateRequest {
  filename: string
  totalParts: number
  totalBytes: number
}

export interface Session {
  id: string
  filename: string
  shareToken: string
  objectKey: string
  uploadId: string
  totalParts: number
  status: 'INITIATED' | 'UPLOADING' | 'COMPLETING' | 'COMPLETED' | 'ABORTED'
  reservedBytes: number
  parts: R2UploadedPart[]
}

export const safeFilename = (filename: string) => filename.replaceAll(/[^a-zA-Z0-9._-]/g, '_')
export const statusOf = (session: Session) => ({
  sessionId: session.id, status: session.status, completedParts: session.parts.length, totalParts: session.totalParts,
})
