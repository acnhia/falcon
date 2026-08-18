import React, { useMemo, useRef, useState } from 'react'
import { chunkFile, DEFAULT_PART_SIZE } from './chunkFile'
import { uploadParts } from './uploadManager'
import { initiateUpload, completeUpload, abortUpload, clearTestUploads } from './api'
import { formatUploadSpeed } from './uploadSpeed'

const CONCURRENCY = 4

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [partProgress, setPartProgress] = useState({})
  const [effectiveSpeed, setEffectiveSpeed] = useState(0)
  const [share, setShare] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | uploading | completing | completed | error | aborted
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)
  const uploadStartedAtRef = useRef(null)

  const parts = useMemo(() => chunkFile(file, DEFAULT_PART_SIZE), [file])
  const overallProgress = parts.length
    ? Object.values(partProgress).reduce((sum, fraction) => sum + fraction, 0) / parts.length
    : 0
  const busy = phase === 'uploading' || phase === 'completing'

  async function startUpload() {
    if (!file || parts.length === 0) return
    setPhase('uploading')
    setError(null)
    setPartProgress({})
    setEffectiveSpeed(0)
    setShare(null)
    setSessionId(null)

    const controller = new AbortController()
    abortControllerRef.current = controller
    uploadStartedAtRef.current = performance.now()

    let currentSessionId = null
    try {
      const initiated = await initiateUpload(file.name, parts.length, file.size)
      currentSessionId = initiated.sessionId
      setSessionId(currentSessionId)

      await uploadParts(currentSessionId, parts, {
        concurrency: CONCURRENCY,
        signal: controller.signal,
        onPartProgress: (partNumber, fraction) => {
          setPartProgress((previous) => {
            const next = { ...previous, [partNumber]: fraction }
            const uploadedBytes = parts.reduce(
              (total, part) => total + part.size * (next[part.partNumber] ?? 0),
              0,
            )
            const elapsedSeconds = (performance.now() - uploadStartedAtRef.current) / 1000
            setEffectiveSpeed(elapsedSeconds > 0 ? uploadedBytes / elapsedSeconds : 0)
            return next
          })
        },
      })

      setPhase('completing')
      const completed = await completeUpload(currentSessionId)
      const elapsedSeconds = (performance.now() - uploadStartedAtRef.current) / 1000
      setEffectiveSpeed(elapsedSeconds > 0 ? file.size / elapsedSeconds : 0)
      setShare(completed)
      setPhase('completed')
    } catch (err) {
      if (err.code === 'STORAGE_QUOTA_EXCEEDED') {
        const confirmed = window.confirm(
          'This upload would exceed the 10 GiB test-storage limit. Delete this application’s previous test uploads and retry?'
        )
        if (confirmed) {
          try {
            await clearTestUploads()
            return startUpload()
          } catch (clearError) {
            setPhase('error')
            setError(clearError.message)
            return
          }
        }
      }
      setPhase(err.name === 'AbortError' ? 'aborted' : 'error')
      if (err.name !== 'AbortError') setError(err.message)
      if (currentSessionId) abortUpload(currentSessionId).catch(() => {})
    }
  }

  function cancelUpload() {
    abortControllerRef.current?.abort()
  }

  return (
    <main className="upload-page">
      <h1>Multipart Upload to Cloudflare R2</h1>
      <p className="subtitle">
        The file is split into parts in the browser; up to {CONCURRENCY} parts upload to the Java
        backend concurrently, which forwards each to R2.
      </p>

      <label htmlFor="upload-file">Choose a file</label>
      <input
        id="upload-file"
        type="file"
        disabled={busy}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          setPhase('idle')
          setPartProgress({})
          setError(null)
          setShare(null)
        }}
      />

      {file && (
        <p className="file-info">
          {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB in {parts.length} part
          {parts.length === 1 ? '' : 's'}
        </p>
      )}

      <div className="actions">
        <button onClick={startUpload} disabled={!file || busy}>
          Start upload
        </button>
        <button onClick={cancelUpload} disabled={phase !== 'uploading'}>
          Cancel
        </button>
      </div>

      {phase !== 'idle' && (
        <div className="progress-overall">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.round(overallProgress * 100)}%` }} />
          </div>
          <span>
            {Math.round(overallProgress * 100)}% — {phase}
          </span>
        </div>
      )}

      {(phase === 'uploading' || phase === 'completing' || phase === 'completed') && (
        <p className="upload-speed" aria-live="polite">
          {phase === 'completed' ? 'Effective upload speed' : 'Current upload speed'}: {formatUploadSpeed(effectiveSpeed)}
        </p>
      )}

      {sessionId && (
        <>
          <p className="session-id">Session: {sessionId}</p>
          <ul className="part-list">
            {parts.map((part) => (
              <li key={part.partNumber}>
                Part {part.partNumber}
                <div className="progress-bar small">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.round((partProgress[part.partNumber] ?? 0) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {phase === 'completed' && share?.downloadPageUrl && (
        <section className="share-result" aria-label="Shared download">
          <p>Your file is ready to share.</p>
          <a href={share.downloadPageUrl}>Open download page</a>
          {' · '}
          <a href={share.shareUrl}>Download file</a>
        </section>
      )}
    </main>
  )
}
