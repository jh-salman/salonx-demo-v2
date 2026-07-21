import { io } from 'socket.io-client'
import { getV2AdminBase } from './v2AdminBootstrap.js'

const DEBOUNCE_MS = 250
const POLL_FALLBACK_MS = 5000

/**
 * Socket.IO endpoint for demo-api (REST base may be a Vite proxy path).
 * @returns {{ origin: string, path: string } | null}
 */
export function resolveCalendarSocketEndpoint() {
  const base = getV2AdminBase()
  if (!base) return null

  if (base.startsWith('http://') || base.startsWith('https://')) {
    return { origin: base.replace(/\/$/, ''), path: '/socket.io/' }
  }

  if (base === '/salonx-demo-api' && typeof window !== 'undefined') {
    return {
      origin: window.location.origin,
      path: '/salonx-demo-api/socket.io/',
    }
  }

  // `/salonx-admin` (Next) has no Socket.IO — in dev, connect to demo-api directly if configured.
  if (import.meta.env.DEV) {
    const direct = String(import.meta.env.VITE_DEMO_API_PROXY_TARGET || '')
      .trim()
      .replace(/\/$/, '')
    if (direct) return { origin: direct, path: '/socket.io/' }
  }

  return null
}

/**
 * Subscribe to demo-api Socket.IO calendar events.
 * @param {{
 *   onAppointmentCreated?: (p: { appointment?: object }) => void
 *   onAppointmentUpdated?: (p: { appointment?: object }) => void
 *   onAppointmentDeleted?: (p: { id?: string }) => void
 *   onToolbarUpdated?: (p: object) => void
 *   onClientsCatalogUpdated?: (p: object) => void
 *   onServiceCatalogUpdated?: (p: object) => void
 *   onConsultationUpdated?: (p: object) => void
 *   onAppointmentVisitUpdated?: (p: object) => void
 *   onProductCatalogUpdated?: (p: object) => void
 *   onPoll?: (ctx: { socketConnected: boolean }) => void
 * }} handlers
 * @param {{ salonId?: string | null }} [options]
 * @returns {() => void}
 */
export function startCalendarRealtimeSync(handlers, options = {}) {
  const endpoint = resolveCalendarSocketEndpoint()
  const salonId =
    typeof options.salonId === 'string' && options.salonId.trim()
      ? options.salonId.trim()
      : null
  let socket = null
  let debounceTimer = null
  let socketConnected = false

  const debounce = (fn) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      fn()
    }, DEBOUNCE_MS)
  }

  const subscribeSalon = () => {
    if (socket?.connected && salonId) {
      socket.emit('subscribe:salon', { salonId })
    }
  }

  if (endpoint) {
    try {
      socket = io(endpoint.origin, {
        path: endpoint.path,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
      })
      socket.on('connect', () => {
        socketConnected = true
        subscribeSalon()
      })
      socket.on('disconnect', () => {
        socketConnected = false
      })
      socket.on('appointment:created', (p) =>
        debounce(() => handlers.onAppointmentCreated?.(p)),
      )
      socket.on('appointment:updated', (p) =>
        debounce(() => handlers.onAppointmentUpdated?.(p)),
      )
      socket.on('appointment:deleted', (p) =>
        debounce(() => handlers.onAppointmentDeleted?.(p)),
      )
      // Toolbar park/waitlist — apply immediately (no debounce) for multi-staff sync.
      socket.on('calendar-toolbar:updated', (p) => handlers.onToolbarUpdated?.(p))
      socket.on('clients-catalog:updated', (p) =>
        debounce(() => handlers.onClientsCatalogUpdated?.(p)),
      )
      socket.on('service-catalog:updated', (p) =>
        debounce(() => handlers.onServiceCatalogUpdated?.(p)),
      )
      socket.on('consultation:updated', (p) =>
        debounce(() => handlers.onConsultationUpdated?.(p)),
      )
      socket.on('appointment-visit:updated', (p) =>
        debounce(() => handlers.onAppointmentVisitUpdated?.(p)),
      )
      socket.on('product-catalog:updated', (p) =>
        debounce(() => handlers.onProductCatalogUpdated?.(p)),
      )
    } catch {
      socket = null
    }
  }

  subscribeSalon()

  const pollId = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    debounce(() => handlers.onPoll?.({ socketConnected }))
  }, POLL_FALLBACK_MS)

  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      debounce(() => handlers.onPoll?.({ socketConnected }))
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible)
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    clearInterval(pollId)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible)
    }
    try {
      socket?.disconnect()
    } catch {
      /* */
    }
  }
}
