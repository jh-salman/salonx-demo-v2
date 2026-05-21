import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'

async function rampFetch(path, init = {}) {
  const base = getV2AdminBase()
  if (!base) return null
  const sameOrigin = base.startsWith('/')
  return fetch(`${base}${path}`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

export function isRampApiAvailable() {
  return isAppointmentsApiAvailable()
}

/**
 * Fire Client Care Card (S2 → Climax checkout moment).
 * @param {{ recipientPhone: string, recipientName?: string, stylistName?: string, products?: string[], brandSlug?: string }} payload
 */
export async function fireCareCard(payload) {
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const res = await rampFetch('/api/fire-care-card', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `fire-care-card failed (${res?.status || 0})`)
  }
  return data
}

/** @param {string} token */
export async function fetchRampPost(token) {
  const t = String(token || '').trim()
  if (!t) throw new Error('token required')
  if (!isRampApiAvailable()) return null
  const res = await rampFetch(`/api/ramp/post/${encodeURIComponent(t)}`)
  if (!res?.ok) return null
  return res.json()
}

/** @param {{ token: string, mediaUrl: string, phone?: string, source?: string }} payload */
export async function storeSharedSelfie(payload) {
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const res = await rampFetch('/api/store-shared-selfie', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `store-shared-selfie failed (${res?.status || 0})`)
  }
  return data
}

/** @param {string} token @param {string} [eventType] */
export async function trackRampCopy(token, eventType = 'caption_copy') {
  if (!isRampApiAvailable()) return null
  const res = await rampFetch('/api/track-copy', {
    method: 'POST',
    body: JSON.stringify({ token, eventType }),
  })
  if (!res?.ok) return null
  return res.json()
}

function resolveUploadUrl(data, base) {
  const raw = data?.url || data?.path
  if (typeof raw !== 'string' || !raw.trim()) return null
  const u = raw.trim()
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) {
    return u
  }
  const origin = base.startsWith('/') && typeof window !== 'undefined'
    ? window.location.origin
    : base.replace(/\/$/, '')
  return `${origin}${u.startsWith('/') ? u : `/${u}`}`
}

/** Upload selfie/media for RAMP public flow. */
export async function uploadRampMedia(file) {
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
