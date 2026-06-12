import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'

async function rampFetch(path, init = {}) {
  const base = getV2AdminBase()
  if (!base) return null
  const sameOrigin = base.startsWith('/')
  const headers = { ...(init.headers || {}) }
  if (!(init.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  return fetch(`${base}${path}`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    cache: 'no-store',
    ...init,
    headers,
  })
}

export function isRampApiAvailable() {
  return isAppointmentsApiAvailable()
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

/** Recent ready RAMP posts for Screen1 queue. */
export async function fetchRampRecent(limit = 24) {
  if (!isRampApiAvailable()) return { items: [] }
  const res = await rampFetch(`/api/ramp/recent?limit=${encodeURIComponent(String(limit))}`)
  if (!res?.ok) return { items: [] }
  const data = await res.json().catch(() => ({}))
  return {
    items: Array.isArray(data?.items) ? data.items : [],
  }
}

/** Cloud library — built RAMP artifacts (ready/posted/sent), any device. */
export async function fetchRampLibrary(limit = 40) {
  if (!isRampApiAvailable()) return { items: [] }
  const res = await rampFetch(`/api/ramp/library?limit=${encodeURIComponent(String(limit))}`)
  if (!res?.ok) return { items: [] }
  const data = await res.json().catch(() => ({}))
  return {
    items: Array.isArray(data?.items) ? data.items : [],
  }
}

/** Recent RAMP queue rows for Screen1 — DB source of truth. */
export async function dismissRampFromQueue(tokenOrId) {
  const key = String(tokenOrId || '').trim()
  if (!key || !isRampApiAvailable()) return null
  const res = await rampFetch(`/api/ramp/${encodeURIComponent(key)}/dismiss-queue`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data?.error || `dismiss-queue failed (${res?.status || 0})`)
  }
  return data
}

/**
 * Stylist bolt-tap — create processing token before capture/upload.
 * @param {{
 *   backgroundPosterUrl?: string
 *   stylistStyleReferenceUrl?: string
 *   clientStyleReferenceUrl?: string
 *   recipientName?: string
 *   recipientPhone?: string
 *   appointmentId?: string | null
 *   stylistName?: string
 *   products?: string[]
 *   tags?: string[]
 *   links?: string[]
 *   captureType?: string
 * }} payload
 */
export async function startRampPost(payload) {
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const res = await rampFetch('/api/ramp/start-post', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `start-post failed (${res?.status || 0})`)
  }
  return data
}

/** Upload capture file via demo-api `/api/upload` (Cloudinary / blob / disk). */
export async function uploadRampMedia(file) {
  const base = getV2AdminBase()
  if (!base) throw new Error('API base URL is not configured')
  if (!file) throw new Error('file required')

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
  const raw = data?.url || data?.path
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Upload response missing url')
  }
  const u = raw.trim()
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) {
    return u
  }
  const origin = base.startsWith('/') && typeof window !== 'undefined'
    ? window.location.origin
    : base.replace(/\/$/, '')
  return `${origin}${u.startsWith('/') ? u : `/${u}`}`
}

/**
 * Park multiple candidate shots without picking a hero (S4 multi-shot review).
 * The post becomes `pending_pick` — a "Pick a photo" card in the queue.
 * @param {string} token @param {string[]} mediaUrls @param {string} [phone]
 */
export async function parkRampPick(token, mediaUrls, phone) {
  const t = String(token || '').trim()
  if (!t) throw new Error('token required')
  if (!isRampApiAvailable()) throw new Error('RAMP API is not configured')
  const urls = (Array.isArray(mediaUrls) ? mediaUrls : [])
    .map((u) => String(u || '').trim())
    .filter(Boolean)
  const res = await rampFetch(`/api/ramp/${encodeURIComponent(t)}/park-pick`, {
    method: 'POST',
    body: JSON.stringify({ mediaUrls: urls, ...(phone ? { phone } : {}) }),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `park-pick failed (${res?.status || 0})`)
  }
  return data
}

/** Candidate shots parked for a `pending_pick` post. */
export async function fetchRampCandidates(token) {
  const t = String(token || '').trim()
  if (!t || !isRampApiAvailable()) return { candidates: [] }
  const res = await rampFetch(`/api/ramp/${encodeURIComponent(t)}/candidates`)
  if (!res?.ok) return { candidates: [] }
  const data = await res.json().catch(() => ({}))
  return { candidates: Array.isArray(data?.candidates) ? data.candidates : [] }
}

/** @param {{ token: string, mediaUrl: string, phone?: string, source?: string, note?: string }} payload */
export async function submitRampCapture(payload) {
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const res = await rampFetch('/api/ramp/submit-capture', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `submit-capture failed (${res?.status || 0})`)
  }
  return data
}

/** Stylist S5 — poll generation status for any queue state. */
export async function fetchRampStatus(token) {
  const t = String(token || '').trim()
  if (!t) throw new Error('token required')
  if (!isRampApiAvailable()) return null
  const res = await rampFetch(`/api/ramp/status/${encodeURIComponent(t)}`)
  if (!res?.ok) return null
  return res.json()
}

/** Carrier send — Salesmsg/Twilio MMS via backend (`/api/ramp/:token/send-sms`). */
export async function sendRampSms(token) {
  const t = String(token || '').trim()
  if (!t) throw new Error('token required')
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const res = await rampFetch(`/api/ramp/${encodeURIComponent(t)}/send-sms`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `send-sms failed (${res?.status || 0})`)
  }
  return data
}

/**
 * Re-run AI generation for an existing RAMP token (edit / update if the
 * generated poster is not good). Reuses the stored source capture.
 * @param {string} token
 * @param {{ note?: string, visualDirection?: string, imageEdit?: string }} [opts]
 */
export async function regenerateRampPost(token, opts = {}) {
  const t = String(token || '').trim()
  if (!t) throw new Error('token required')
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const note =
    typeof opts.note === 'string' && opts.note.trim() ? opts.note.trim() : undefined
  const mediaUrl =
    typeof opts.mediaUrl === 'string' && opts.mediaUrl.trim() ? opts.mediaUrl.trim() : undefined

  const res = await rampFetch(`/api/ramp/${encodeURIComponent(t)}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({
      ...(note ? { note } : {}),
      ...(opts.visualDirection ? { visualDirection: opts.visualDirection } : {}),
      ...(opts.imageEdit ? { imageEdit: opts.imageEdit } : {}),
    }),
  })
  const data = await res?.json().catch(() => ({}))
  if (res?.ok) return data

  // Older demo-api builds without POST /regenerate — re-queue via submit-capture.
  if (res?.status === 404 && mediaUrl) {
    return submitRampCapture({
      token: t,
      mediaUrl,
      source: 'regenerate',
      ...(note ? { note } : {}),
    })
  }

  if (res?.status === 404) {
    throw new Error(
      'Regenerate API not available — restart demo-api (port 4000) or redeploy, then try again.',
    )
  }
  throw new Error(data.error || `regenerate failed (${res?.status || 0})`)
}

/** Set / update MMS recipient on any RAMP post (override appointment phone). */
export async function updateRampRecipient(token, payload = {}) {
  const t = String(token || '').trim()
  if (!t) throw new Error('token required')
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const recipientPhone =
    typeof payload.recipientPhone === 'string' ? payload.recipientPhone.trim() : ''
  const recipientName =
    typeof payload.recipientName === 'string' ? payload.recipientName.trim() : undefined
  const res = await rampFetch(`/api/ramp/${encodeURIComponent(t)}/recipient`, {
    method: 'POST',
    body: JSON.stringify({
      ...(recipientPhone ? { recipientPhone } : {}),
      ...(recipientName ? { recipientName } : {}),
    }),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `update-recipient failed (${res?.status || 0})`)
  }
  return data
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

/** Cash checkout — send Client Care Card SMS to unlock / session phone. */
export async function fireClientCareCard(payload) {
  if (!isRampApiAvailable()) {
    throw new Error('RAMP API is not configured')
  }
  const res = await rampFetch('/api/fire-care-card', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `fire-care-card failed (${res?.status || 0})`)
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
