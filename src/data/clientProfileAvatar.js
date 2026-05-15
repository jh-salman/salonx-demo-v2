/**
 * Client profile photos — stored on the client row in `/api/clients` catalog (Postgres).
 * Upload via `/api/upload`; UI unchanged (Screen2 / Clients keep same markup).
 */

import { fetchClientsCatalog, saveClientsCatalogRemote } from './calendarCatalogApi.js'
import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'

export const CLIENTS_CATALOG_UPDATED = 'salonx:clients-catalog-updated'

let catalogCache = null
let catalogUpdatedAt = null

function dispatchCatalogUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CLIENTS_CATALOG_UPDATED))
}

export function getCachedClientsCatalog() {
  return catalogCache
}

export async function refreshClientsCatalogCache() {
  if (!isAppointmentsApiAvailable()) {
    catalogCache = null
    catalogUpdatedAt = null
    return null
  }
  const data = await fetchClientsCatalog()
  if (data?.stored && Array.isArray(data.clients)) {
    catalogCache = data.clients
    catalogUpdatedAt =
      typeof data.updatedAt === 'string' ? data.updatedAt : null
    return catalogCache
  }
  return null
}

export function findClientInCatalog({ id, name } = {}) {
  const list = catalogCache || []
  if (id) {
    const hit = list.find((c) => c && c.id === id)
    if (hit) return hit
  }
  const key = typeof name === 'string' ? name.trim().toLowerCase() : ''
  if (!key) return null
  return list.find((c) => (c?.name || '').toLowerCase() === key) || null
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

/** Upload image file to demo-api / v2-admin (Cloudinary / blob / disk). */
export async function uploadClientProfileImage(file) {
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

export async function persistClientAvatarToCatalog({ clientId, name, avatarUrl }) {
  if (!isAppointmentsApiAvailable()) return false

  await refreshClientsCatalogCache()
  const list = Array.isArray(catalogCache) ? [...catalogCache] : []
  const key = typeof name === 'string' ? name.trim().toLowerCase() : ''

  let idx = -1
  if (clientId) idx = list.findIndex((c) => c?.id === clientId)
  if (idx < 0 && key) {
    idx = list.findIndex((c) => (c?.name || '').toLowerCase() === key)
  }
  if (idx < 0) return false

  const nextUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
  list[idx] = { ...list[idx], avatar: nextUrl }

  const data = await saveClientsCatalogRemote({
    clients: list,
    ...(catalogUpdatedAt ? { expectedUpdatedAt: catalogUpdatedAt } : {}),
  })
  catalogCache = Array.isArray(data?.clients) ? data.clients : list
  catalogUpdatedAt =
    typeof data?.updatedAt === 'string' ? data.updatedAt : catalogUpdatedAt
  dispatchCatalogUpdated()
  return true
}

export function catalogAvatarForClient(client) {
  if (!client) return null
  const u = typeof client.avatar === 'string' ? client.avatar.trim() : ''
  return u || null
}
