import {
  refreshClientsCatalogCache,
  findClientInCatalog,
  catalogAvatarForClient,
  getCachedClientsCatalog,
} from './clientProfileAvatar.js'
import { MOCK_CLIENTS } from './mockClients.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'

/** First letter of client name for avatar fallback. */
export function clientInitialLetter(name) {
  const text = String(name || '').trim()
  return text ? text.charAt(0).toUpperCase() : '?'
}

/** Resolve profile photo from cached `/api/clients` catalog. */
export function resolveClientAvatarFromCatalog({ id, name } = {}) {
  const hit = findClientInCatalog({ id, name })
  if (!hit) return null
  return catalogAvatarForClient(hit)
}

/** Attach `avatar` from catalog when queue rows only carry clientId/name. */
export function enrichRampQueueItem(item) {
  if (!item || typeof item !== 'object') return item
  const avatar =
    (typeof item.avatar === 'string' && item.avatar.trim()) ||
    resolveClientAvatarFromCatalog({ id: item.clientId, name: item.name }) ||
    null
  return avatar ? { ...item, avatar } : item
}

export function enrichRampQueueItems(items) {
  return (Array.isArray(items) ? items : []).map(enrichRampQueueItem)
}

/** Load salon clients from `/api/clients` when API is on; else mock catalog. */
export async function loadRampClientsCatalog() {
  if (isAppointmentsApiAvailable()) {
    const list = await refreshClientsCatalogCache()
    if (Array.isArray(list)) return list
    const cached = getCachedClientsCatalog()
    if (Array.isArray(cached)) return cached
    return []
  }
  return MOCK_CLIENTS
}

/** Match name, email, or phone digits against catalog rows. */
export function filterRampClients(clients, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const digits = q.replace(/\D/g, '')
  const list = Array.isArray(clients) ? clients : []

  return list.filter((client) => {
    const name = String(client?.name || '').toLowerCase()
    const email = String(client?.email || '').toLowerCase()
    const phone = String(client?.phone || '').replace(/\D/g, '')
    if (name.includes(q)) return true
    if (email && email.includes(q)) return true
    if (digits.length >= 3 && phone.includes(digits)) return true
    return false
  })
}

/** Clients for picker UI — search results or first N from catalog when query empty. */
export function listRampClientsForPicker(catalog, query, limit = 8) {
  const list = Array.isArray(catalog) ? catalog : []
  const q = String(query || '').trim()
  const source = q ? filterRampClients(list, q) : list.slice(0, limit)
  return source.map(catalogClientToRamp).filter(Boolean)
}

/** Map Postgres catalog row → RAMP queue / build client shape. */
export function catalogClientToRamp(client) {
  if (!client || typeof client !== 'object') return null
  const name = String(client.name || '').trim()
  if (!name) return null
  const phone = String(client.phone || '').trim()
  const email = String(client.email || '').trim()
  return {
    id: client.id,
    name,
    sub: phone || email || 'Client',
    emoji: '🧑',
    avatar: typeof client.avatar === 'string' && client.avatar.trim() ? client.avatar.trim() : null,
  }
}

export function newRampClientFromQuery(query) {
  const value = String(query || '').trim()
  if (!value) return null
  const isPhone = /^[\d()\-\s.+]+$/.test(value)
  return {
    name: value,
    sub: isPhone ? 'New client · phone' : 'New client',
    emoji: '🧑',
  }
}
