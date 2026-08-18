const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function initiateUpload(filename, totalParts, totalBytes) {
  const res = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, totalParts, totalBytes }),
  })
  if (!res.ok) throw await responseError(res, 'Failed to initiate upload')
  return res.json()
}

export async function clearTestUploads() {
  const res = await fetch(`${API_BASE}/uploads/test-data`, { method: 'DELETE' })
  if (!res.ok) throw await responseError(res, 'Failed to clear test uploads')
  return res.json()
}

async function responseError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  const error = new Error(body.error ?? `${fallback} (${res.status})`)
  error.code = body.code
  return error
}

/** Uploads one part via XHR (not fetch) because only XHR exposes upload progress events. */
export function uploadPart(sessionId, partNumber, blob, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${API_BASE}/uploads/${sessionId}/parts/${partNumber}`)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(`Part ${partNumber} failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error(`Network error uploading part ${partNumber}`))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))

    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(blob)
  })
}

export async function completeUpload(sessionId) {
  const res = await fetch(`${API_BASE}/uploads/${sessionId}/complete`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to complete upload (${res.status})`)
  const body = await res.text()
  return body ? JSON.parse(body) : null
}

export async function abortUpload(sessionId) {
  await fetch(`${API_BASE}/uploads/${sessionId}/abort`, { method: 'POST' })
}

export async function getStatus(sessionId) {
  const res = await fetch(`${API_BASE}/uploads/${sessionId}`)
  if (!res.ok) throw new Error(`Failed to fetch status (${res.status})`)
  return res.json()
}

export async function getSharedTransfer(shareToken) {
  const res = await fetch(`${API_BASE}/transfers/${encodeURIComponent(shareToken)}`)
  if (!res.ok) throw await responseError(res, 'Failed to fetch shared transfer')
  return res.json()
}
