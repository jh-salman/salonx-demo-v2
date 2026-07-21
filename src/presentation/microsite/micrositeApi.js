import { apiJson } from '../../lib/http.js'

const DEFAULT_TIMEOUT_MS = 15000

/**
 * Fetch a microsite endpoint with a hard timeout so a cold/slow backend never
 * leaves the booking UI stuck on "Loading…". Times out after `timeoutMs`
 * (axios timeout → error with `.code = 'TIMEOUT'`).
 */
function apiFetch(path, init = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return apiJson(path, {
    method: init.method || 'GET',
    ...(init.body !== undefined ? { body: init.body } : {}),
    timeoutMs,
  })
}

export const micrositeApi = {
  listTemplates: () => apiFetch('/api/microsite/templates'),
  listSalons: () => apiFetch('/api/microsite/salons'),
  checkSlug: (slug) =>
    apiFetch(`/api/microsite/slug-available?slug=${encodeURIComponent(slug)}`),
  create: (body) =>
    apiFetch('/api/microsite/create', {
      method: 'POST',
      body,
    }),
  patchSalon: (slug, body) =>
    apiFetch(`/api/microsite/salons/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body,
    }),
  getPublicSalon: (slug) =>
    apiFetch(`/api/microsite/public/salons/${encodeURIComponent(slug)}`),
  getServices: (slug) =>
    apiFetch(`/api/microsite/public/salons/${encodeURIComponent(slug)}/services`),
  getStaff: (slug) =>
    apiFetch(`/api/microsite/public/salons/${encodeURIComponent(slug)}/staff`),
  getAvailability: (slug, { date, serviceId, staffId }) => {
    const q = new URLSearchParams({ date })
    if (serviceId) q.set('serviceId', serviceId)
    if (staffId) q.set('staffId', staffId)
    return apiFetch(
      `/api/microsite/public/salons/${encodeURIComponent(slug)}/availability?${q}`,
    )
  },
  smartAvailability: (slug, body) =>
    apiFetch(
      `/api/microsite/public/salons/${encodeURIComponent(slug)}/smart-availability`,
      { method: 'POST', body },
    ),
  joinWaitlist: (slug, body) =>
    apiFetch(
      `/api/microsite/public/salons/${encodeURIComponent(slug)}/waitlist`,
      { method: 'POST', body },
    ),
  book: (slug, body) =>
    apiFetch(`/api/microsite/public/salons/${encodeURIComponent(slug)}/book`, {
      method: 'POST',
      body,
    }),
}

/** Platform hosts that are never salon microsite subdomains. */
export const RESERVED_HOST_SLUGS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'book',
  'cdn',
  'mail',
  'status',
  'demo', // demo.salonx.com = main Salon X app
  'demo-api',
  'm',
  'salonx',
])

/**
 * Host-only slug: `samu.salonx.com` → `samu`.
 * Returns null on demo/localhost/reserved.
 */
export function getHostMicrositeSlug(location = window.location) {
  const host = (location.hostname || '').toLowerCase()
  if (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return null
  }

  const hostParts = host.split('.').filter(Boolean)
  if (hostParts.length < 3) return null
  const sub = hostParts[0]
  if (!sub || RESERVED_HOST_SLUGS.has(sub)) return null
  return sub
}

/** Resolve slug from host (`{slug}.salonx.com`) or preview path `/m/:slug`. */
export function resolveMicrositeSlugFromLocation(location = window.location) {
  const hostSlug = getHostMicrositeSlug(location)
  if (hostSlug) return hostSlug
  const m = location.pathname.match(/^\/m\/([a-z0-9-]+)/i)
  if (m) return m[1].toLowerCase()
  return null
}

/**
 * In-app paths for microsite links.
 * On `{slug}.salonx.com` → `/`, `/book`, `/success` (clean public URL).
 * On demo/localhost → `/m/:slug` preview paths.
 */
export function micrositePublicPath(slug, page = '') {
  const hostSlug = typeof window !== 'undefined' ? getHostMicrositeSlug() : null
  const onOwnHost = hostSlug && hostSlug === String(slug || '').toLowerCase()

  if (onOwnHost) {
    if (!page || page === 'home') return '/'
    return `/${page}`
  }

  const base = `/m/${encodeURIComponent(slug)}`
  if (!page || page === 'home') return base
  return `${base}/${page}`
}

/**
 * Canonical public URL for production:
 *   https://{slug}.salonx.com
 * web-v2 = Vercel · demo-api = Render (proxied via /salonx-admin)
 */
export function micrositeCanonicalUrl(slug) {
  const root =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      String(import.meta.env.VITE_MICROSITE_ROOT_DOMAIN || '').trim()) ||
    'salonx.com'
  return `https://${encodeURIComponent(slug)}.${root}`
}

/** Local/dev preview path on current origin. */
export function micrositePreviewUrl(slug) {
  if (typeof window === 'undefined') return micrositePublicPath(slug)
  return `${window.location.origin}${micrositePublicPath(slug)}`
}
