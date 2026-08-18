import { useEffect, useState } from 'react'
import { getSharedTransfer } from '../upload/api'

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1)
  return `${(bytes / 1024 ** (index + 1)).toFixed(1)} ${units[index]}`
}

export default function DownloadPage({ shareToken }) {
  const [transfer, setTransfer] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSharedTransfer(shareToken).then(setTransfer).catch((reason) => setError(reason.message))
  }, [shareToken])

  return (
    <main className="upload-page">
      <h1>Shared file download</h1>
      {!transfer && !error && <p>Loading shared file…</p>}
      {error && <p className="error">{error}</p>}
      {transfer && (
        <section className="share-result">
          <p><strong>{transfer.filename}</strong> — {formatFileSize(transfer.byteSize)}</p>
          <a href={transfer.downloadUrl}>Download file</a>
        </section>
      )}
    </main>
  )
}
