import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

/**
 * @typedef {object} AppointmentDto
 * @property {string} id
 * @property {string} clientName
 * @property {string} service
 * @property {string} start
 * @property {string} end
 * @property {string} color
 * @property {number} price
 * @property {string} notes
 * @property {string | null} [seriesId]
 * @property {string | null} [staffId]
 */

/** @param {AppointmentDto} dto */
export function appointmentDtoToEvent(dto) {
  const start = new Date(dto.start)
  const end = new Date(dto.end)
  return {
    id: dto.id,
    clientName: dto.clientName,
    service: dto.service || '',
    start,
    end,
    color: dto.color || '#3b82f6',
    price: typeof dto.price === 'number' ? dto.price : 0,
    notes: dto.notes || '',
    ...(dto.seriesId ? { seriesId: dto.seriesId } : {}),
    ...(dto.staffId ? { staffId: dto.staffId } : {}),
  }
}

export function isAppointmentsApiAvailable() {
  return Boolean(getV2AdminBase())
}

function apiFetch(path, init = {}) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin URL is not configured')
  const sameOrigin = base.startsWith('/')
  return fetch(`${base}${path}`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    credentials: 'include',
    cache: 'no-store',
    ...init,
  })
}

async function readJson(res) {
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    let msg =
      data && typeof data === 'object' && typeof data.error === 'string'
        ? data.error
        : `HTTP ${res.status}`
    if (msg === `HTTP ${res.status}` && text && text.length > 0 && text.length < 400) {
      msg = `${msg}: ${text.trim()}`
    }
    throw new Error(msg)
  }
  return data
}

/**
 * @param {Date} from
 * @param {Date} to
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<AppointmentDto[]>}
 */
export async function fetchAppointmentsRange(from, to, opts = {}) {
  if (!getV2AdminBase()) return []
  const qs = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  })
  const res = await apiFetch(`/api/appointments?${qs}`, {
    signal: opts.signal,
  })
  const data = await readJson(res)
  return Array.isArray(data?.appointments) ? data.appointments : []
}

/**
 * @param {object} body
 * @returns {Promise<{ appointment: AppointmentDto }>}
 */
export async function createAppointmentRemote(body) {
  const res = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readJson(res)
}

/**
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<{ appointment: AppointmentDto }>}
 */
export async function updateAppointmentRemote(id, patch) {
  const res = await apiFetch(`/api/appointments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return readJson(res)
}

/**
 * @param {string} id
 */
export async function deleteAppointmentRemote(id) {
  const res = await apiFetch(`/api/appointments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (res.status === 204) return
  await readJson(res)
}
