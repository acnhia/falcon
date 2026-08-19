/** Requests the camera and attaches the resulting stream to a <video> element. Rejects if the user denies permission. */
export async function startCameraStream(videoEl: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  videoEl.srcObject = stream
  return stream
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop())
}

/** Draws the current video frame to a canvas and resolves with a JPEG blob. */
export function captureFrame(videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): Promise<Blob> {
  canvasEl.width = videoEl.videoWidth
  canvasEl.height = videoEl.videoHeight
  const context = canvasEl.getContext('2d')
  context?.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height)

  return new Promise((resolve, reject) => {
    canvasEl.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture image from camera'))),
      'image/jpeg',
      0.9,
    )
  })
}
