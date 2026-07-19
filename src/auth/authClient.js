import { createAuthClient } from 'better-auth/react'
import { phoneNumberClient, organizationClient } from 'better-auth/client/plugins'
import { getV2AdminBase } from '../sync/v2AdminBootstrap.js'

/** Public API origin the browser should call (Vite proxy or production). */
export function authBaseURL() {
  if (import.meta.env.DEV) {
    const useDemo =
      String(import.meta.env.VITE_DEV_USE_DEMO_API || '')
        .trim()
        .toLowerCase() === 'true'
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:5173'
    // Always prefer demo-api proxy in local Vite when flag is on.
    if (useDemo) return `${origin}/salonx-demo-api`
  }

  const base = (getV2AdminBase() || '/salonx-admin').replace(/\/$/, '')
  if (base.startsWith('http')) return base
  if (typeof window === 'undefined') return `http://localhost:5173${base}`
  return `${window.location.origin}${base}`
}

let cachedBase = ''
let cachedClient = null

/** Fresh client when base URL changes (fixes stale HMR / bad first load). */
export function getAuthClient() {
  const base = authBaseURL()
  if (!cachedClient || cachedBase !== base) {
    cachedBase = base
    cachedClient = createAuthClient({
      baseURL: base,
      fetchOptions: {
        credentials: 'include',
      },
      plugins: [phoneNumberClient(), organizationClient()],
    })
    if (import.meta.env.DEV) {
      console.info('[salonx-auth] baseURL =', base)
    }
  }
  return cachedClient
}

/**
 * Forward to live client. Do NOT `.bind()` values — Better Auth nests callable
 * Proxies (`organization.inviteMember`, etc.) and bind() breaks them.
 */
export const authClient = new Proxy(
  {},
  {
    get(_t, prop) {
      const client = getAuthClient()
      const value = Reflect.get(client, prop, client)
      return value
    },
    apply(_t, _thisArg, args) {
      const client = getAuthClient()
      return Reflect.apply(client, client, args)
    },
  },
)

async function authJson(path, init = {}) {
  const url = `${authBaseURL()}${path}`
  const res = await fetch(url, {
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
    const err = new Error(
      data.message || data.error || res.statusText || 'Request failed',
    )
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/** Invite staff into the active organization (session cookie). */
export async function inviteOrgMember({
  email,
  role = 'member',
  resend = false,
}) {
  return authJson('/api/auth/organization/invite-member', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email || '').trim(),
      role,
      ...(resend ? { resend: true } : {}),
    }),
  })
}

/** Pending + recent invitations for the active organization. */
export async function listOrgInvitations() {
  const data = await authJson('/api/auth/organization/list-invitations')
  return Array.isArray(data) ? data : data?.invitations || []
}

/** Cancel a pending invitation. */
export async function cancelOrgInvitation(invitationId) {
  return authJson('/api/auth/organization/cancel-invitation', {
    method: 'POST',
    body: JSON.stringify({ invitationId: String(invitationId || '').trim() }),
  })
}

/** End the current session (better-auth core endpoint). */
export async function signOut() {
  return authJson('/api/auth/sign-out', { method: 'POST', body: '{}' })
}

function isUsNational(d) {
  return d.length === 10 && d[0] >= '2' && d[0] <= '9'
}

function isBdNational(d) {
  return d.length === 10 && d[0] === '1' && d[1] >= '3' && d[1] <= '9'
}

/**
 * Normalize a US or Bangladeshi number to E.164, or null if invalid.
 *   US: +1XXXXXXXXXX (area code 2–9)
 *   BD: +8801XXXXXXXXX (national 01[3-9]XXXXXXXX)
 */
export function toE164(input) {
  const d = String(input || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('880')) {
    const nat = d.slice(3)
    return isBdNational(nat) ? `+880${nat}` : null
  }
  if (d.length === 11 && d[0] === '0' && isBdNational(d.slice(1))) {
    return `+880${d.slice(1)}`
  }
  if (d.length === 11 && d[0] === '1') {
    const nat = d.slice(1)
    return isUsNational(nat) ? `+1${nat}` : null
  }
  if (d.length === 10) {
    if (isBdNational(d)) return `+880${d}`
    if (isUsNational(d)) return `+1${d}`
    return null
  }
  return null
}

/** @deprecated use toE164 — kept for backward compatibility. */
export function toUsE164(tenDigits) {
  return toE164(tenDigits)
}

/** Direct send-otp (avoids stale better-auth client base). */
export async function sendPhoneOtp(phoneNumber) {
  const url = `${authBaseURL()}/api/auth/phone-number/send-otp`
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ phoneNumber }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      data.message || data.error || res.statusText || 'Could not send code',
    )
    err.status = res.status
    err.url = url
    err.data = data
    throw err
  }
  return data
}

export async function verifyPhoneOtp(phoneNumber, code) {
  const url = `${authBaseURL()}/api/auth/phone-number/verify`
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ phoneNumber, code }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      data.message || data.error || res.statusText || 'Invalid code',
    )
    err.status = res.status
    err.url = url
    err.data = data
    throw err
  }
  return data
}
