import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

/** In-memory mirror for today's appointments when API mode is active (no sessionStorage). */
/** @type {unknown[] | null} */
let memoryEvents = null

/**
 * Cached appointment rows for the current local day — in-memory only.
 * @returns {unknown[] | null}
 */
export function readApiAppointmentsSessionCache() {
  if (!getV2AdminBase()) return null
  return Array.isArray(memoryEvents) ? memoryEvents : null
}

/** @param {unknown[]} events Calendar `events` (Date start/end). */
export function writeApiAppointmentsSessionCache(events) {
  if (!getV2AdminBase()) return
  memoryEvents = Array.isArray(events) ? events : []
}

export function clearApiAppointmentsMemoryCache() {
  memoryEvents = null
}
