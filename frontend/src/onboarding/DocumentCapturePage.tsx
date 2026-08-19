import { useEffect, useRef, useState } from 'react'
import { captureFrame, startCameraStream, stopStream } from './cameraCapture'
import { getCaptureContext, uploadDocument, type CaptureContextResponse, type DocumentSide } from './api'

interface Props {
  token: string
}

type SideUploadStatus = 'idle' | 'uploading' | 'done' | 'error'

const SIDES: DocumentSide[] = ['front', 'back']
const SIDE_LABEL: Record<DocumentSide, string> = { front: 'Front', back: 'Back' }

export default function DocumentCapturePage({ token }: Props) {
  const [context, setContext] = useState<CaptureContextResponse | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)

  const [activeSide, setActiveSide] = useState<DocumentSide | null>(null)
  const [cameraDenied, setCameraDenied] = useState<Record<DocumentSide, boolean>>({ front: false, back: false })
  const [previews, setPreviews] = useState<Record<DocumentSide, string | null>>({ front: null, back: null })
  const [pendingBlobs, setPendingBlobs] = useState<Record<DocumentSide, Blob | null>>({ front: null, back: null })
  const [uploadStatus, setUploadStatus] = useState<Record<DocumentSide, SideUploadStatus>>({
    front: 'idle',
    back: 'idle',
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [finalStatus, setFinalStatus] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    getCaptureContext(token)
      .then(setContext)
      .catch(() => setContextError('This capture link is invalid or has expired.'))
  }, [token])

  useEffect(() => {
    return () => stopStream(streamRef.current)
  }, [])

  async function handleStartCapture(side: DocumentSide) {
    setActiveSide(side)
    setCameraDenied((prev) => ({ ...prev, [side]: false }))
    try {
      const stream = await startCameraStream(videoRef.current as HTMLVideoElement)
      streamRef.current = stream
    } catch {
      setCameraDenied((prev) => ({ ...prev, [side]: true }))
      setActiveSide(null)
    }
  }

  async function handleCapture(side: DocumentSide) {
    const blob = await captureFrame(videoRef.current as HTMLVideoElement, canvasRef.current as HTMLCanvasElement)
    stopStream(streamRef.current)
    streamRef.current = null
    setActiveSide(null)
    setPendingBlobs((prev) => ({ ...prev, [side]: blob }))
    setPreviews((prev) => ({ ...prev, [side]: URL.createObjectURL(blob) }))
  }

  function handleFileSelected(side: DocumentSide, file: File | undefined) {
    if (!file) return
    setPendingBlobs((prev) => ({ ...prev, [side]: file }))
    setPreviews((prev) => ({ ...prev, [side]: URL.createObjectURL(file) }))
  }

  function handleRetake(side: DocumentSide) {
    setPendingBlobs((prev) => ({ ...prev, [side]: null }))
    setPreviews((prev) => ({ ...prev, [side]: null }))
    setUploadStatus((prev) => ({ ...prev, [side]: 'idle' }))
    setCameraDenied((prev) => ({ ...prev, [side]: false }))
  }

  async function handleSubmit() {
    const front = pendingBlobs.front
    const back = pendingBlobs.back
    if (!front || !back) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      setUploadStatus((prev) => ({ ...prev, front: 'uploading' }))
      await uploadDocument(token, 'front', front)
      setUploadStatus((prev) => ({ ...prev, front: 'done' }))

      setUploadStatus((prev) => ({ ...prev, back: 'uploading' }))
      const backResult = await uploadDocument(token, 'back', back)
      setUploadStatus((prev) => ({ ...prev, back: 'done' }))

      setFinalStatus(backResult.status)
    } catch (reason) {
      setSubmitError((reason as Error).message)
      setUploadStatus((prev) => ({
        front: prev.front === 'uploading' ? 'error' : prev.front,
        back: prev.back === 'uploading' ? 'error' : prev.back,
      }))
    } finally {
      setSubmitting(false)
    }
  }

  if (contextError) {
    return (
      <main className="upload-page">
        <h1>Identity document capture</h1>
        <p className="error" role="alert">
          {contextError}
        </p>
        <p>Please return to the onboarding application and request a new capture link.</p>
      </main>
    )
  }

  if (!context) {
    return (
      <main className="upload-page">
        <h1>Identity document capture</h1>
        <p>Loading…</p>
      </main>
    )
  }

  if (finalStatus) {
    return (
      <main className="upload-page">
        <h1>Identity document capture</h1>
        <section aria-label="Validation result">
          <p>
            <strong>Mock validation completed.</strong> This is a demonstration result, not a real identity,
            KYC, AML, or fraud check.
          </p>
          <p>Application status: {finalStatus}</p>
        </section>
      </main>
    )
  }

  const bothCaptured = Boolean(pendingBlobs.front && pendingBlobs.back)

  return (
    <main className="upload-page">
      <h1>Identity document capture</h1>
      <p>Use a synthetic/sample driver license only. Do not use a real document.</p>

      {SIDES.map((side) => (
        <section key={side} aria-label={`${SIDE_LABEL[side]} of license`}>
          <h2>{SIDE_LABEL[side]}</h2>

          {previews[side] && (
            <div>
              <img src={previews[side] as string} alt={`${SIDE_LABEL[side]} of license preview`} width={200} />
              <button type="button" onClick={() => handleRetake(side)} disabled={submitting}>
                Retake {SIDE_LABEL[side].toLowerCase()}
              </button>
            </div>
          )}

          {!previews[side] && activeSide !== side && (
            <button type="button" onClick={() => handleStartCapture(side)} disabled={submitting}>
              Capture {SIDE_LABEL[side].toLowerCase()}
            </button>
          )}

          {!previews[side] && activeSide === side && (
            <div>
              <video ref={videoRef} autoPlay playsInline muted />
              <canvas ref={canvasRef} hidden />
              <button type="button" onClick={() => handleCapture(side)}>
                Take photo
              </button>
            </div>
          )}

          {!previews[side] && cameraDenied[side] && (
            <div>
              <p>No camera image was uploaded. Select a synthetic sample file instead (development fallback).</p>
              <label htmlFor={`file-input-${side}`}>Select {SIDE_LABEL[side].toLowerCase()} image</label>
              <input
                id={`file-input-${side}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleFileSelected(side, event.target.files?.[0])}
              />
            </div>
          )}
        </section>
      ))}

      <button type="button" onClick={handleSubmit} disabled={!bothCaptured || submitting}>
        Submit for mock validation
      </button>

      <p aria-live="polite">
        {uploadStatus.front === 'uploading' && 'Uploading front image…'}
        {uploadStatus.back === 'uploading' && 'Uploading back image…'}
      </p>

      {submitError && (
        <p className="error" role="alert">
          {submitError}
        </p>
      )}
    </main>
  )
}
