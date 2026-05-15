import {
  fetchAppointmentVisit,
  fetchClientConsultation,
  fetchProductCatalog,
  normalizeClientKey,
  saveAppointmentVisitRemote,
  saveClientConsultationRemote,
} from './screen2RemoteApi.js'
import { uploadClientProfileImage } from './clientProfileAvatar.js'
import { getApptState, makeEmptySvcQueue } from './appointmentStateStore.js'
import { isAppointmentsApiAvailable } from './v2AppointmentsApi.js'

export { normalizeClientKey } from './screen2RemoteApi.js'

export const CONSULT_STORAGE_KEY = '@salonx/consultations/v1'
export const CONSULTATION_REMOTE_UPDATED = 'salonx:consultation-remote-updated'
export const APPOINTMENT_VISIT_REMOTE_UPDATED = 'salonx:appointment-visit-remote-updated'
export const PRODUCTS_CATALOG_UPDATED = 'salonx:products-catalog-updated'

const consultUpdatedAt = new Map()
const visitUpdatedAt = new Map()
let pauseConsultPersist = 0
let pauseVisitPersist = 0

function dispatch(name) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name))
}

export function pauseRemoteConsultPersist() {
  pauseConsultPersist += 1
}

export function resumeRemoteConsultPersist() {
  pauseConsultPersist = Math.max(0, pauseConsultPersist - 1)
}

export function isRemoteConsultPersistPaused() {
  return pauseConsultPersist > 0
}

export function pauseRemoteVisitPersist() {
  pauseVisitPersist += 1
}

export function resumeRemoteVisitPersist() {
  pauseVisitPersist = Math.max(0, pauseVisitPersist - 1)
}

export function isRemoteVisitPersistPaused() {
  return pauseVisitPersist > 0
}

export function visitPayloadFromApptState(state) {
  return {
    svcQueue: state.svcQueue,
    productQueue: state.productQueue,
    hourlyRate: state.hourlyRate,
    consultRate: state.consultRate,
    updatedAt: Date.now(),
  }
}

/** @returns {ReturnType<typeof getApptState> | null} */
export function apptStateFromVisitPayload(visit) {
  if (!visit || typeof visit !== 'object') return null
  const v = visit
  return {
    svcQueue:
      Array.isArray(v.svcQueue) && v.svcQueue.length ? v.svcQueue : makeEmptySvcQueue(),
    productQueue: Array.isArray(v.productQueue) ? v.productQueue : [],
    hourlyRate: typeof v.hourlyRate === 'number' ? v.hourlyRate : 0,
    consultRate: typeof v.consultRate === 'number' ? v.consultRate : 0,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
  }
}

export function loadConsultStore() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CONSULT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveConsultStore(store) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSULT_STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* noop */
  }
}

/** Merge remote consultation row into localStorage (cache for offline + Clients list). */
export function mergeConsultRecordIntoStore(clientKey, record) {
  if (!clientKey || !record || typeof record !== 'object') return loadConsultStore()
  const store = loadConsultStore()
  store[clientKey] = record
  saveConsultStore(store)
  dispatch(CONSULTATION_REMOTE_UPDATED)
  return store
}

export function consultRecordUpdatedAtMs(rec) {
  if (!rec || typeof rec !== 'object') return 0
  const u = rec.updatedAt
  if (typeof u === 'number' && !Number.isNaN(u)) return u
  if (typeof u === 'string') {
    const p = Date.parse(u)
    return Number.isNaN(p) ? 0 : p
  }
  return 0
}

function countConsultPhotos(rec) {
  if (!rec || !Array.isArray(rec.photos)) return 0
  return rec.photos.filter((p) => p && typeof p.url === 'string' && p.url.trim()).length
}

/**
 * Don't apply stale server JSON over in-memory LOOK edits (poll/socket can fire
 * before the debounced PUT has landed).
 */
export function shouldApplyRemoteConsult(localRow, remoteRow) {
  if (!remoteRow || typeof remoteRow !== 'object') return false
  if (!localRow || typeof localRow !== 'object') return true
  const lt = consultRecordUpdatedAtMs(localRow)
  const rt = consultRecordUpdatedAtMs(remoteRow)
  if (lt > rt) return false
  if (lt === rt && lt > 0) {
    if (countConsultPhotos(localRow) > countConsultPhotos(remoteRow)) return false
  }
  return true
}

/**
 * @param {string} clientKey normalized
 * @param {object} remoteRecord
 * @param {object | null} reactSnapshot consultRecordRef.current when merging from network
 */
export function mergeRemoteConsultIntoStore(clientKey, remoteRecord, reactSnapshot = null) {
  const store = loadConsultStore()
  const fromLs = store[clientKey] || {}
  const localRow =
    reactSnapshot && typeof reactSnapshot === 'object' ? reactSnapshot : fromLs
  if (!shouldApplyRemoteConsult(localRow, remoteRecord)) {
    return { store, didMerge: false }
  }
  store[clientKey] = remoteRecord
  saveConsultStore(store)
  dispatch(CONSULTATION_REMOTE_UPDATED)
  return { store, didMerge: true }
}

/** Best image for Clients grid tile: catalog avatar → consult avatar → first LOOK photo. */
export function consultTileImageUrl(client, rec) {
  if (client) {
    const fromCatalog =
      typeof client.avatar === 'string' && client.avatar.trim() ? client.avatar.trim() : ''
    if (fromCatalog) return fromCatalog
  }
  const av = typeof rec?.avatar === 'string' ? rec.avatar.trim() : ''
  if (av && (av.startsWith('http://') || av.startsWith('https://') || av.startsWith('data:'))) {
    return av
  }
  const photos = Array.isArray(rec?.photos) ? rec.photos : []
  for (const p of photos) {
    const u = typeof p?.url === 'string' ? p.url.trim() : ''
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u
  }
  return null
}

/** Upload inline `data:` LOOK photos before persisting to Postgres. */
export async function ensureConsultPhotosAreHosted(record) {
  if (!record || typeof record !== 'object' || !isAppointmentsApiAvailable()) {
    return record
  }
  const photos = Array.isArray(record.photos) ? record.photos : []
  if (!photos.some((p) => typeof p?.url === 'string' && p.url.startsWith('data:'))) {
    return record
  }
  let changed = false
  const nextPhotos = await Promise.all(
    photos.map(async (p) => {
      const url = typeof p?.url === 'string' ? p.url : ''
      if (!url.startsWith('data:')) return p
      try {
        const blob = await fetch(url).then((r) => r.blob())
        const file = new File([blob], 'look.jpg', {
          type: blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
        })
        const hosted = await uploadClientProfileImage(file)
        changed = true
        return { ...p, url: hosted }
      } catch {
        return p
      }
    }),
  )
  return changed ? { ...record, photos: nextPhotos } : record
}

/** Pull all client consultations from API into localStorage (Clients list + offline). */
export async function hydrateConsultStoreFromApi(clientNames) {
  if (!isAppointmentsApiAvailable() || !Array.isArray(clientNames) || !clientNames.length) {
    return loadConsultStore()
  }
  const store = loadConsultStore()
  const keys = [
    ...new Set(
      clientNames
        .map((n) => (typeof n === 'string' ? normalizeClientKey(n) : ''))
        .filter(Boolean),
    ),
  ]
  await Promise.all(
    keys.map(async (key) => {
      const data = await fetchClientConsultation(key)
      if (data?.stored && data.record && typeof data.record === 'object') {
        store[key] = data.record
        if (typeof data.updatedAt === 'string') {
          consultUpdatedAt.set(key, data.updatedAt)
        }
      }
    }),
  )
  saveConsultStore(store)
  dispatch(CONSULTATION_REMOTE_UPDATED)
  return store
}

export async function loadRemoteConsultation(clientName) {
  if (!isAppointmentsApiAvailable()) return null
  const key = normalizeClientKey(clientName)
  const data = await fetchClientConsultation(key)
  if (data?.stored && typeof data.updatedAt === 'string') {
    consultUpdatedAt.set(key, data.updatedAt)
  }
  return data
}

export async function persistRemoteConsultation(clientName, record) {
  if (!isAppointmentsApiAvailable() || isRemoteConsultPersistPaused()) return null
  const key = normalizeClientKey(clientName)
  const hosted = await ensureConsultPhotosAreHosted(record)
  if (hosted !== record) {
    mergeConsultRecordIntoStore(key, hosted)
  }
  const res = await saveClientConsultationRemote(key, {
    record: hosted,
    expectedUpdatedAt: consultUpdatedAt.get(key) ?? null,
  })
  if (typeof res?.updatedAt === 'string') {
    consultUpdatedAt.set(key, res.updatedAt)
  }
  dispatch(CONSULTATION_REMOTE_UPDATED)
  return res
}

export async function loadRemoteAppointmentVisit(appointmentId) {
  if (!isAppointmentsApiAvailable() || !appointmentId) return null
  const data = await fetchAppointmentVisit(appointmentId)
  if (data?.stored && typeof data.updatedAt === 'string') {
    visitUpdatedAt.set(appointmentId, data.updatedAt)
  }
  return data
}

export async function persistRemoteAppointmentVisit(appointmentId, visit) {
  if (!isAppointmentsApiAvailable() || !appointmentId || isRemoteVisitPersistPaused()) {
    return null
  }
  const res = await saveAppointmentVisitRemote(appointmentId, {
    visit,
    expectedUpdatedAt: visitUpdatedAt.get(appointmentId) ?? null,
  })
  if (typeof res?.updatedAt === 'string') {
    visitUpdatedAt.set(appointmentId, res.updatedAt)
  }
  dispatch(APPOINTMENT_VISIT_REMOTE_UPDATED)
  return res
}

let productsCache = null

export function getCachedProductCatalog() {
  return productsCache
}

export async function refreshProductCatalogCache() {
  if (!isAppointmentsApiAvailable()) {
    productsCache = null
    return null
  }
  const data = await fetchProductCatalog()
  if (data?.stored && Array.isArray(data.products) && data.products.length) {
    productsCache = data.products
    dispatch(PRODUCTS_CATALOG_UPDATED)
    return productsCache
  }
  return null
}
