/**
 * Remembers an invitation id across the sign-in detour.
 * Set when an unauthenticated visitor opens `/invite/:id`, then consumed by
 * Screen0 after phone sign-in to return the user to the accept flow.
 */
const KEY = '@salonx/pending-invite'

export function setPendingInvite(invitationId) {
  try {
    sessionStorage.setItem(KEY, String(invitationId || ''))
  } catch {
    /* storage unavailable */
  }
}

export function getPendingInvite() {
  try {
    return sessionStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}
