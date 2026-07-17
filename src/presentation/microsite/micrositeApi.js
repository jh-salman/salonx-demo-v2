import { getV2AdminBase } from '../../sync/v2AdminBootstrap.js'

function apiFetch(path, init = {}) {
  const base = getV2AdminBase()
  if (!base) {
    return Promise.reject(new Error('API base not configured'))
  }
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data?.error || res.statusText || 'Request failed')
      err.status = res.status
      err.data = data
      throw err
    }
    return data
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
      body: JSON.stringify(body),
    }),
  patchSalon: (slug, body) =>
    apiFetch(`/api/microsite/salons/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
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
  book: (slug, body) =>
    apiFetch(`/api/microsite/public/salons/${encodeURIComponent(slug)}/book`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

/** Resolve public microsite slug from host or path. */
export function resolveMicrositeSlugFromLocation(location = window.location) {
  const host = (location.hostname || '').toLowerCase()
  // Path always wins for local/dev: /m/:slug
  const m = location.pathname.match(/^\/m\/([a-z0-9-]+)/i)
  if (m) return m[1].toLowerCase()

  if (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return null
  }

  // tast.salonx.com → tast (require known parent or at least 3 labels)
  const hostParts = host.split('.').filter(Boolean)
  if (hostParts.length < 3) return null
  const sub = hostParts[0]
  // Platform hosts — never treat as salon microsite slugs
  const reserved = new Set([
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
  if (!sub || reserved.has(sub)) return null
  return sub
}

export function micrositePublicPath(slug, page = '') {
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
