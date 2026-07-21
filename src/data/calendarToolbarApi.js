import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { http, toApiError } from '../lib/http.js'

/**
 * GET /api/calendar-toolbar — parked + waitlist toolbar JSON (salonx-web-v2).
 * @returns {Promise<{ stored: boolean, parkedFromDrag: unknown[], toolbarEvents: unknown[], updatedAt?: string } | null>}
 */
export async function fetchCalendarToolbar() {
  const base = getV2AdminBase()
  if (!base) return null
  try {
    const res = await http.get(`${base}/api/calendar-toolbar`)
    return res.data
  } catch {
    return null
  }
}

/**
 * PUT full replace — body `{ parkedFromDrag, toolbarEvents, expectedUpdatedAt? }`.
 */
export async function saveCalendarToolbarRemote(body) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')
  try {
    const res = await http.put(`${base}/api/calendar-toolbar`, body)
    return res.data
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 409) {
      const conflict = new Error(err.data?.error || 'Toolbar conflict')
      conflict.code = 'CONFLICT'
      conflict.payload = err.data
      throw conflict
    }
    throw new Error(err.data?.error || `HTTP ${err.status}`)
  }
}
