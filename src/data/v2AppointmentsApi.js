import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'
import { http, toApiError } from '../lib/http.js'

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
    ...(dto.clientPhone ? { clientPhone: dto.clientPhone } : {}),
    service: dto.service || '',
    start,
    end,
    color: dto.color || '#3b82f6',
    price: typeof dto.price === 'number' ? dto.price : 0,
    notes: dto.notes || '',
    ...(dto.seriesId ? { seriesId: dto.seriesId } : {}),
    ...(dto.staffId ? { staffId: dto.staffId } : {}),
    ...(dto.referenceImageUrl
      ? { referenceImageUrl: dto.referenceImageUrl }
      : {}),
    ...(dto.referenceImageReviewedAt
      ? { referenceImageReviewedAt: dto.referenceImageReviewedAt }
      : {}),
  }
}

export function isAppointmentsApiAvailable() {
  return Boolean(getV2AdminBase())
}

async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin URL is not configured')
  try {
    const res = await http.request({
      url: `${base}${path}`,
      method,
      ...(body !== undefined ? { data: body } : {}),
      ...(signal ? { signal } : {}),
    })
    return res.data
  } catch (e) {
    if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') throw e
    throw toApiError(e, `HTTP ${e?.response?.status || 0}`)
  }
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
  const data = await apiRequest(`/api/appointments?${qs}`, {
    signal: opts.signal,
  })
  return Array.isArray(data?.appointments) ? data.appointments : []
}

/**
 * @param {object} body
 * @returns {Promise<{ appointment: AppointmentDto }>}
 */
export async function createAppointmentRemote(body) {
  return apiRequest('/api/appointments', { method: 'POST', body })
}

/**
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<{ appointment: AppointmentDto }>}
 */
export async function updateAppointmentRemote(id, patch) {
  return apiRequest(`/api/appointments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  })
}

/**
 * @param {string} id
 */
export async function deleteAppointmentRemote(id) {
  await apiRequest(`/api/appointments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/**
 * Cash checkout — archive visit notes for Ghost Notes + remove from calendar.
 * @param {string} id
 */
export async function completeAppointmentRemote(id) {
  return apiRequest(`/api/appointments/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
  })
}

/**
 * Upcoming appointments with an unreviewed client reference image (#11 popup).
 * @param {{ staffId?: string | null }} [opts]
 * @returns {Promise<AppointmentDto[]>}
 */
export async function fetchPendingReferenceReviews(opts = {}) {
  if (!getV2AdminBase()) return []
  const qs = new URLSearchParams()
  if (opts.staffId) qs.set('staffId', opts.staffId)
  const suffix = qs.toString() ? `?${qs}` : ''
  const data = await apiRequest(
    `/api/appointments/pending-reference-reviews${suffix}`,
  )
  return Array.isArray(data?.appointments) ? data.appointments : []
}

/**
 * Staff → client note/SMS for an appointment (#9).
 * @param {string} id
 * @param {{ body: string, clientPhone?: string }} payload
 */
export async function sendAppointmentMessage(id, payload) {
  return apiRequest(`/api/appointments/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: payload,
  })
}

/**
 * List staff → client messages for an appointment.
 * @param {string} id
 */
export async function fetchAppointmentMessages(id) {
  const data = await apiRequest(
    `/api/appointments/${encodeURIComponent(id)}/messages`,
  )
  return Array.isArray(data?.messages) ? data.messages : []
}
