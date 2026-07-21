import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { http } from '../lib/http.js'

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

  let payload
  if (imageFile instanceof File) {
    const fd = new FormData()
    fd.append('prompt', trimmedPrompt)
    fd.append('image', imageFile, imageFile.name || 'source.png')
    if (size) fd.append('size', size)
    if (model) fd.append('model', model)
    payload = fd
  } else {
    payload = { prompt: trimmedPrompt, size }
    if (model) payload.model = model
    const url = String(imageUrl || '').trim()
    if (url) payload.imageUrl = url
  }

  let res
  try {
    res = await http.post(`${base}/api/ramp/generate-image`, payload, {
      responseType: 'blob',
    })
  } catch (e) {
    const errBlob = e?.response?.data
    if (errBlob instanceof Blob && errBlob.type.includes('application/json')) {
      const data = await errBlob
        .text()
        .then((t) => JSON.parse(t))
        .catch(() => ({}))
      if (typeof data?.error === 'string') throw new Error(data.error)
    }
    throw new Error(`HTTP ${e?.response?.status || 0}`)
  }

  const contentType = String(res.headers?.['content-type'] || res.data?.type || '')
  if (!contentType.includes('image/')) {
    throw new Error('Image generation returned an unexpected response')
  }

  const blob = res.data
  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
  }
}
