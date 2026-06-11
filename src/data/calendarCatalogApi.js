import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

async function apiFetch(path, init = {}) {
  const base = getV2AdminBase()
  if (!base) return null
  const sameOrigin = base.startsWith('/')
  const res = await fetch(`${base}${path}`, {
    mode: sameOrigin ? 'same-origin' : 'cors',
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  return res
}

export async function fetchClientsCatalog() {
  const res = await apiFetch('/api/clients')
  if (!res?.ok) return null
  return res.json()
}

export async function saveClientsCatalogRemote(body) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')
  const res = await apiFetch('/api/clients', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const err = new Error(data.error || 'Clients catalog conflict')
      err.code = 'CONFLICT'
      err.payload = data
      throw err
    }
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchStaffCatalog() {
  const res = await apiFetch('/api/staff')
  if (!res?.ok) return null
  return res.json()
}

export async function fetchServiceCatalog() {
  const res = await apiFetch('/api/service-catalog')
  if (!res?.ok) return null
  return res.json()
}

export async function saveServiceCatalogRemote(body) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')
  const res = await apiFetch('/api/service-catalog', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const err = new Error(data.error || 'Service catalog conflict')
      err.code = 'CONFLICT'
      err.payload = data
      throw err
    }
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function saveProductCatalogRemote(body) {
  const base = getV2AdminBase()
  if (!base) throw new Error('V2 admin / demo-api base URL is not configured')
  const res = await apiFetch('/api/product-catalog', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const err = new Error(data.error || 'Product catalog conflict')
      err.code = 'CONFLICT'
      err.payload = data
      throw err
    }
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}
