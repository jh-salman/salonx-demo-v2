import { ensureRampImageUploaded, uploadRampImageFile } from './rampUpload.js'

/** Upload a captured photo (File/Blob/object-url) → returns a hosted URL string. */
export async function uploadRampCapture(fileOrUrl) {
  if (fileOrUrl instanceof File) {
    return uploadRampImageFile(fileOrUrl)
  }
  if (fileOrUrl instanceof Blob) {
    return uploadRampImageFile(
      new File([fileOrUrl], 'capture.jpg', { type: fileOrUrl.type || 'image/jpeg' }),
    )
  }
  if (typeof fileOrUrl === 'string') {
    return ensureRampImageUploaded(fileOrUrl)
  }
  throw new Error('Capture upload failed')
}

/** Upload a generated/composed image blob → returns a hosted URL string. */
export async function uploadRampComposed(blob) {
  const file = new File([blob], 'ramp-composed.png', { type: blob.type || 'image/png' })
  return uploadRampImageFile(file)
}
