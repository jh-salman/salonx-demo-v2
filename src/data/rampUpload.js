import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { http } from '../lib/http.js'

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
  let data
  try {
    const res = await http.post(`${base}/api/upload`, fd)
    data = res.data || {}
  } catch (e) {
    const d = e?.response?.data
    const t = typeof d === 'string' ? d : d?.error || ''
    throw new Error(t || `Upload failed (${e?.response?.status || 0})`)
  }
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
    const res = await http.get(imageRef, { responseType: 'blob' })
    const blob = res.data
    const file = new File([blob], filename || 'ramp-upload.jpg', {
      type: blob.type || 'image/jpeg',
    })
    return uploadRampImageFile(file)
  }
  return imageRef
}
