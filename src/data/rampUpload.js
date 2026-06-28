import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

function resolveUploadUrl(data, base) {
  const raw = data?.url || data?.path
  if (typeof raw !== 'string' || !raw.trim()) return null
  const u = raw.trim()
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) {
    return u
  }
  const origin =
    base.startsWith('/') && typeof window !== 'undefined'
      ? window.location.origin
      : base.replace(/\/$/, '')
  return `${origin}${u.startsWith('/') ? u : `/${u}`}`
}

/** Upload image file → demo-api `/api/upload` (Cloudinary / disk). */
export async function uploadRampImageFile(file) {
  const base = getV2AdminBase()
  if (!base) throw new Error('API base URL is not configured')

  const fd = new FormData()
  fd.append('file', file)
  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}/api/upload`, {
    method: 'POST',
    mode: sameOrigin ? 'same-origin' : 'cors',
    body: fd,
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `Upload failed (${res.status})`)
  }
  const data = await res.json().catch(() => ({}))
  const url = resolveUploadUrl(data, base)
  if (!url) throw new Error('Upload response missing url')
  return url
}

export function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl).split(',')
  if (parts.length < 2) throw new Error('Invalid data URL')
  const mime = parts[0].match(/data:([^;]+)/)?.[1] || 'image/jpeg'
  const binary = atob(parts[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Canvas snap / gallery pick stored as data URL → remote upload URL. */
export async function uploadRampImageFromDataUrl(dataUrl, filename = 'ramp-capture.jpg') {
  const blob = dataUrlToBlob(dataUrl)
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
  return uploadRampImageFile(file)
}

/**
 * Ensure capture image is a persisted remote URL (not base64/blob).
 * Skips re-upload when already http(s).
 */
export async function ensureRampImageUploaded(imageRef, { filename } = {}) {
  if (!imageRef || typeof imageRef !== 'string') return null
  if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
    return imageRef
  }
  if (imageRef.startsWith('data:')) {
    return uploadRampImageFromDataUrl(imageRef, filename)
  }
  if (imageRef.startsWith('blob:')) {
    const res = await fetch(imageRef)
    const blob = await res.blob()
    const file = new File([blob], filename || 'ramp-upload.jpg', {
      type: blob.type || 'image/jpeg',
    })
    return uploadRampImageFile(file)
  }
  return imageRef
}
