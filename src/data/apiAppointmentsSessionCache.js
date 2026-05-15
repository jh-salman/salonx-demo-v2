import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

const STORAGE_KEY = '@salonx/v2-appointments-session/v1'

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function apiBaseFingerprint() {
  const b = getV2AdminBase() || ''
  return String(b).slice(0, 160)
}

/**
 * Cached appointment rows for the current **local calendar day** + API base.
 * Survives Calendar unmount so Stylist / ClientList still see today until the next fetch.
 * @returns {unknown[] | null}
 */
export function readApiAppointmentsSessionCache() {
  if (typeof window === 'undefined') return null
  if (!getV2AdminBase()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return null
    if (o.baseKey !== apiBaseFingerprint()) return null
    if (o.dayKey !== localDayKey()) return null
    if (!Array.isArray(o.events)) return null
    return o.events
      .map((ev) => {
        if (!ev || typeof ev !== 'object') return null
        const start =
          ev.start instanceof Date ? ev.start : new Date(/** @type {string} */ (ev.start))
        const end = ev.end instanceof Date ? ev.end : new Date(/** @type {string} */ (ev.end))
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
        return { ...ev, start, end }
      })
      .filter(Boolean)
  } catch {
    return null
  }
}

/** @param {unknown[]} events Calendar `events` (Date start/end). */
export function writeApiAppointmentsSessionCache(events) {
  if (typeof window === 'undefined') return
  if (!getV2AdminBase()) return
  try {
    const serializable = events.map((ev) => ({
      ...ev,
      start: ev.start instanceof Date ? ev.start.toISOString() : ev.start,
      end: ev.end instanceof Date ? ev.end.toISOString() : ev.end,
    }))
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dayKey: localDayKey(),
        baseKey: apiBaseFingerprint(),
        savedAt: Date.now(),
        events: serializable,
      }),
    )
  } catch {
    /* quota */
  }
}
