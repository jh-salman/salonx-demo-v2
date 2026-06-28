import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'

async function careFetch(path, init = {}) {
  const base = getV2AdminBase()
  if (!base) return null
  const sameOrigin = base.startsWith('/')
  const headers = { ...(init.headers || {}), 'Content-Type': 'application/json' }
  return fetch(`${base}${path}`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    cache: 'no-store',
    ...init,
    headers,
  })
}

/** Cash checkout — send Client Care Card SMS to unlock / session phone. */
export async function fireClientCareCard(payload) {
  if (!isAppointmentsApiAvailable()) {
    throw new Error('API is not configured')
  }
  const res = await careFetch('/api/fire-care-card', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
  const data = await res?.json().catch(() => ({}))
  if (!res?.ok) {
    throw new Error(data.error || `fire-care-card failed (${res?.status || 0})`)
  }
  return data
}
