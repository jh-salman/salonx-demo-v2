import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

function base() {
  const b = getV2AdminBase()
  if (!b) throw new Error('API base not configured')
  return b.replace(/\/$/, '')
}

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${base()}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const authAppApi = {
  me: () => jsonFetch('/api/auth-app/me'),
  onboard: (body) =>
    jsonFetch('/api/auth-app/onboard', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  createOrganization: (body) =>
    jsonFetch('/api/auth-app/organizations', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  switchOrganization: (organizationId) =>
    jsonFetch('/api/auth-app/switch-organization', {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    }),
}
