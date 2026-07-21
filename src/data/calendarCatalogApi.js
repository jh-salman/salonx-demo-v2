import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { http, toApiError } from '../lib/http.js'

/** GET catalog JSON — null when API is unavailable or the request fails. */
async function getCatalog(path) {
  const base = getV2AdminBase()
  if (!base) return null
  try {
    const res = await http.get(`${base}${path}`)
    return res.data
  } catch {
    return null
  }
}

/** PUT/PATCH catalog JSON — throws, 409 gets `.code = 'CONFLICT'` + `.payload`. */
async function saveCatalog(path, body, conflictLabel, method = 'PUT') {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')
  try {
    const res = await http.request({ url: `${base}${path}`, method, data: body })
    return res.data
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 409) {
      const conflict = new Error(err.data?.error || conflictLabel)
      conflict.code = 'CONFLICT'
      conflict.payload = err.data
      throw conflict
    }
    throw new Error(err.data?.error || err.data?.message || `HTTP ${err.status}`)
  }
}

export async function fetchClientsCatalog() {
  return getCatalog('/api/clients')
}

export async function saveClientsCatalogRemote(body) {
  return saveCatalog('/api/clients', body, 'Clients catalog conflict')
}

export async function fetchStaffCatalog() {
  return getCatalog('/api/staff')
}

export async function saveStaffCatalogRemote(body) {
  return saveCatalog('/api/staff', body, 'Staff catalog conflict')
}

/** PATCH one stylist's schedule (owner or canSelfManage member). */
export async function patchStaffScheduleRemote(staffId, body) {
  return saveCatalog(
    `/api/staff/${encodeURIComponent(staffId)}/schedule`,
    body,
    'Staff schedule conflict',
    'PATCH',
  )
}

export async function fetchServiceCatalog() {
  return getCatalog('/api/service-catalog')
}

export async function saveServiceCatalogRemote(body) {
  return saveCatalog('/api/service-catalog', body, 'Service catalog conflict')
}

export async function saveProductCatalogRemote(body) {
  return saveCatalog('/api/product-catalog', body, 'Product catalog conflict')
}
