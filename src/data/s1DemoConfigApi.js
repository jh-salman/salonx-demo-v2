import { getV2AdminBase, syncFromV2Admin } from '../sync/v2AdminBootstrap.js'

const S1_SLOTS = ['topBar', 'hero', 'promo', 'curveStrip']

/**
 * Upload Build Station / S1 slot media (`POST /api/upload`).
 * @param {File | Blob} file
 * @returns {Promise<string>}
 */
export async function uploadBuildStationMedia(file) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')

  const fd = new FormData()
  fd.set('file', file)
  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}/api/upload`, {
    method: 'POST',
    mode: sameOrigin ? 'same-origin' : 'cors',
    body: fd,
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      if (typeof j?.error === 'string' && j.error.trim()) detail = `: ${j.error.trim()}`
    } catch {
      /* ignore */
    }
    throw new Error(`Upload failed${detail}`)
  }
  const data = await res.json()
  const url = data?.url || data?.path
  if (!url || typeof url !== 'string') throw new Error('Upload failed: no URL in response')
  return url
}

/** @param {string} dataUrl */
function dataUrlToFile(dataUrl, filename) {
  const parts = dataUrl.split(',')
  if (parts.length < 2) throw new Error('Invalid data URL')
  const header = parts[0] || ''
  const b64 = parts.slice(1).join(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

/**
 * Replace inline data URLs with hosted URLs before persisting to brand config.
 * @param {Record<string, string>} images
 */
async function resolveRemoteImageUrls(images) {
  /** @type {Record<string, string>} */
  const out = { ...images, topBar: '' }
  for (const slot of S1_SLOTS) {
    const url = String(out[slot] || '').trim()
    if (!url.startsWith('data:')) continue
    const isVideo = /^data:video\//i.test(url)
    const ext = isVideo ? 'mp4' : 'jpg'
    const file = dataUrlToFile(url, `s1-${slot}-${Date.now()}.${ext}`)
    out[slot] = await uploadBuildStationMedia(file)
  }
  return out
}

/**
 * PATCH active brand s1Demo and publish to salonx-web-v2 (`publishToApp: true`).
 * @param {{ images: Record<string, string>; adjust: Record<string, unknown>; mediaKinds?: Record<string, string>; variants?: unknown }} payload
 */
export async function patchS1DemoRemote(payload) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')

  const images = await resolveRemoteImageUrls(payload.images || {})
  const body = {
    s1Demo: {
      images,
      adjust: payload.adjust,
      mediaKinds: payload.mediaKinds,
      ...(payload.variants ? { variants: payload.variants } : {}),
    },
    publishToApp: true,
  }

  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}/api/config`, {
    method: 'PATCH',
    mode: sameOrigin ? 'same-origin' : 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      if (typeof j?.error === 'string' && j.error.trim()) detail = `: ${j.error.trim()}`
    } catch {
      /* ignore */
    }
    throw new Error(`Could not save S1${detail}`)
  }
  return res.json()
}

/**
 * Push S1 slot state to server so every device receives the same config.
 * @returns {Promise<boolean>}
 */
export async function syncS1DemoToServer(payload) {
  if (!getV2AdminBase()) return false
  try {
    await patchS1DemoRemote(payload)
    await syncFromV2Admin()
    return true
  } catch (err) {
    console.warn('[s1-demo:sync]', err)
    return false
  }
}

export function isS1DemoServerSyncAvailable() {
  return Boolean(getV2AdminBase())
}
