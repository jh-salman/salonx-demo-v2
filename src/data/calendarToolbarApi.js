import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

/**
 * GET /api/calendar-toolbar — parked + waitlist toolbar JSON (salonx-web-v2).
 * @returns {Promise<{ stored: boolean, parkedFromDrag: unknown[], toolbarEvents: unknown[], updatedAt?: string } | null>}
 */
export async function fetchCalendarToolbar() {
  const base = getV2AdminBase()
  if (!base) return null
  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}/api/calendar-toolbar`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * PUT full replace — body `{ parkedFromDrag, toolbarEvents, expectedUpdatedAt? }`.
 */
export async function saveCalendarToolbarRemote(body) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')
  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}/api/calendar-toolbar`, {
    method: 'PUT',
    mode: sameOrigin ? 'same-origin' : 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const err = new Error(data.error || 'Toolbar conflict')
      err.code = 'CONFLICT'
      err.payload = data
      throw err
    }
    const t = typeof data.error === 'string' ? data.error : await res.text().catch(() => '')
    throw new Error(t || `HTTP ${res.status}`)
  }
  return res.json()
}
