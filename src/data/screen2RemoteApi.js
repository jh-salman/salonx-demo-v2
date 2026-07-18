import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

async function apiFetch(path, init = {}) {
  const base = getV2AdminBase()
  if (!base) return null
  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}${path}`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return res
}

export function normalizeClientKey(name) {
  return (name || '').trim().toLowerCase()
}

export async function fetchClientConsultation(clientKey) {
  const key = encodeURIComponent(normalizeClientKey(clientKey))
  const res = await apiFetch(`/api/client-consultation/${key}`)
  if (!res?.ok) return null
  return res.json()
}

export async function saveClientConsultationRemote(clientKey, body) {
  const base = getV2AdminBase()
  if (!base) throw new Error('API base URL is not configured')
  const key = encodeURIComponent(normalizeClientKey(clientKey))
  const res = await apiFetch(`/api/client-consultation/${key}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const err = new Error(data.error || 'Consultation conflict')
      err.code = 'CONFLICT'
      err.payload = data
      throw err
    }
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchAppointmentVisit(appointmentId) {
  const id = encodeURIComponent(String(appointmentId || '').trim())
  if (!id) return null
  const res = await apiFetch(`/api/appointment-visit/${id}`)
  if (!res?.ok) return null
  return res.json()
}

export async function saveAppointmentVisitRemote(appointmentId, body) {
  const base = getV2AdminBase()
  if (!base) throw new Error('API base URL is not configured')
  const id = encodeURIComponent(String(appointmentId || '').trim())
  const res = await apiFetch(`/api/appointment-visit/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const err = new Error(data.error || 'Appointment visit conflict')
      err.code = 'CONFLICT'
      err.payload = data
      throw err
    }
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchProductCatalog() {
  const res = await apiFetch('/api/product-catalog')
  if (!res?.ok) return null
  return res.json()
}
