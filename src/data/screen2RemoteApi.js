import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { http, toApiError } from '../lib/http.js'

/** GET JSON — null when API is unavailable or the request fails. */
async function getJson(path) {
  const base = getV2AdminBase()
  if (!base) return null
  try {
    const res = await http.get(`${base}${path}`)
    return res.data
  } catch {
    return null
  }
}

/** PUT JSON — throws, 409 gets `.code = 'CONFLICT'` + `.payload`. */
async function putJson(path, body, conflictLabel) {
  const base = getV2AdminBase()
  if (!base) throw new Error('API base URL is not configured')
  try {
    const res = await http.put(`${base}${path}`, body)
    return res.data
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 409) {
      const conflict = new Error(err.data?.error || conflictLabel)
      conflict.code = 'CONFLICT'
      conflict.payload = err.data
      throw conflict
    }
    throw new Error(err.data?.error || `HTTP ${err.status}`)
  }
}

export function normalizeClientKey(name) {
  return (name || '').trim().toLowerCase()
}

export async function fetchClientConsultation(clientKey) {
  const key = encodeURIComponent(normalizeClientKey(clientKey))
  return getJson(`/api/client-consultation/${key}`)
}

export async function saveClientConsultationRemote(clientKey, body) {
  const key = encodeURIComponent(normalizeClientKey(clientKey))
  return putJson(
    `/api/client-consultation/${key}`,
    body,
    'Consultation conflict',
  )
}

export async function fetchAppointmentVisit(appointmentId) {
  const id = encodeURIComponent(String(appointmentId || '').trim())
  if (!id) return null
  return getJson(`/api/appointment-visit/${id}`)
}

export async function saveAppointmentVisitRemote(appointmentId, body) {
  const id = encodeURIComponent(String(appointmentId || '').trim())
  return putJson(
    `/api/appointment-visit/${id}`,
    body,
    'Appointment visit conflict',
  )
}

export async function fetchProductCatalog() {
  return getJson('/api/product-catalog')
}
