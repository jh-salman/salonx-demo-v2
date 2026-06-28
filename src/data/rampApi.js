import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

export function isRampApiAvailable() {
  return Boolean(getV2AdminBase())
}

/**
 * AI image generation — `POST /api/ramp/generate-image` (PNG response).
 * Pass `imageFile` (multipart) or `imageUrl` (JSON) when using a reference photo.
 */
export async function generateRampImage({
  prompt,
  imageFile = null,
  imageUrl = null,
  size = '1024x1024',
  model = null,
} = {}) {
  const base = getV2AdminBase()
  if (!base) throw new Error('API is not configured')

  const trimmedPrompt = String(prompt || '').trim()
  if (!trimmedPrompt) throw new Error('prompt is required')

  const sameOrigin = base.startsWith('/')
  let res

  if (imageFile instanceof File) {
    const fd = new FormData()
    fd.append('prompt', trimmedPrompt)
    fd.append('image', imageFile, imageFile.name || 'source.png')
    if (size) fd.append('size', size)
    if (model) fd.append('model', model)
    res = await fetch(`${base}/api/ramp/generate-image`, {
      method: 'POST',
      mode: sameOrigin ? 'same-origin' : 'cors',
      cache: 'no-store',
      body: fd,
    })
  } else {
    const body = { prompt: trimmedPrompt, size }
    if (model) body.model = model
    const url = String(imageUrl || '').trim()
    if (url) body.imageUrl = url
    res = await fetch(`${base}/api/ramp/generate-image`, {
      method: 'POST',
      mode: sameOrigin ? 'same-origin' : 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}))
      const msg =
        data && typeof data === 'object' && typeof data.error === 'string'
          ? data.error
          : `HTTP ${res.status}`
      throw new Error(msg)
    }
    throw new Error(`HTTP ${res.status}`)
  }

  if (!contentType.includes('image/')) {
    throw new Error('Image generation returned an unexpected response')
  }

  const blob = await res.blob()
  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
  }
}
