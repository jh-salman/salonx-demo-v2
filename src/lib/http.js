import axios from 'axios'
import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

/**
 * Shared axios instance — every API call carries the cookie session.
 * Base URL is resolved per-request (getV2AdminBase can change after bootstrap),
 * so use `apiBase()` / `apiBaseOrNull()` and pass full URLs.
 */
export const http = axios.create({
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

/** Demo-api / v2-admin base URL. Throws when not configured. */
export function apiBase() {
  const base = getV2AdminBase()
  if (!base) throw new Error('API base not configured')
  return base.replace(/\/$/, '')
}

/** Demo-api / v2-admin base URL, or null when not configured. */
export function apiBaseOrNull() {
  const base = getV2AdminBase()
  return base ? base.replace(/\/$/, '') : null
}

/**
 * Normalize an axios failure to the app-wide error shape:
 * Error with `.status` and `.data` (server JSON), message from
 * `data.error` / `data.message`. Timeouts get `.code = 'TIMEOUT'`.
 */
export function toApiError(e, fallback = 'Request failed') {
  if (e?.code === 'ECONNABORTED' || /timeout/i.test(String(e?.message || ''))) {
    const err = new Error('This is taking too long. Please try again.')
    err.status = 0
    err.code = 'TIMEOUT'
    return err
  }
  const res = e?.response
  const data = res?.data && typeof res.data === 'object' ? res.data : {}
  const err = new Error(
    data.error || data.message || res?.statusText || e?.message || fallback,
  )
  err.status = res?.status ?? 0
  err.data = data
  return err
}

/**
 * JSON request against the demo-api base. Mirrors the old `jsonFetch`
 * behavior: resolves with the parsed body, throws normalized errors.
 * @param {string} path e.g. '/api/auth-app/me'
 * @param {{ method?: string, body?: unknown, headers?: object, timeoutMs?: number }} [opts]
 */
export async function apiJson(path, opts = {}) {
  const { method = 'GET', body, headers, timeoutMs } = opts
  try {
    const res = await http.request({
      url: `${apiBase()}${path}`,
      method,
      ...(body !== undefined ? { data: body } : {}),
      ...(headers ? { headers } : {}),
      ...(timeoutMs ? { timeout: timeoutMs } : {}),
    })
    return res.data
  } catch (e) {
    throw toApiError(e)
  }
}
