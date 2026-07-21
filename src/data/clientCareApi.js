import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'
import { http, toApiError } from '../lib/http.js'

/** Cash checkout — send Client Care Card SMS to unlock / session phone. */
export async function fireClientCareCard(payload) {
  if (!isAppointmentsApiAvailable()) {
    throw new Error('API is not configured')
  }
  const base = getV2AdminBase()
  try {
    const res = await http.post(`${base}/api/fire-care-card`, payload || {})
    return res.data
  } catch (e) {
    const err = toApiError(e)
    throw new Error(
      err.data?.error || `fire-care-card failed (${err.status || 0})`,
    )
  }
}
