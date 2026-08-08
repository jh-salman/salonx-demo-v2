/**
 * Solo / Team build toggle (pre-launch testing switch on S1).
 *
 * Solo scopes the calendar to the signed-in stylist only; Team keeps the
 * role-based behavior (owner/admin see every staff column, a member sees
 * their own). Device-local on purpose — no server setting until launch.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = '@salonx/salon-mode/v1'

export const SALON_MODE_SOLO = 'solo'
export const SALON_MODE_TEAM = 'team'
export const SALON_MODE_EVENT = 'salonx:salon-mode-changed'

/** @returns {'solo' | 'team'} */
export function readSalonMode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === SALON_MODE_TEAM ? SALON_MODE_TEAM : SALON_MODE_SOLO
  } catch {
    return SALON_MODE_SOLO
  }
}

/** @param {'solo' | 'team'} mode */
export function writeSalonMode(mode) {
  const next = mode === SALON_MODE_TEAM ? SALON_MODE_TEAM : SALON_MODE_SOLO
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* noop — toggle still applies for this session */
  }
  try {
    window.dispatchEvent(new CustomEvent(SALON_MODE_EVENT, { detail: next }))
  } catch {
    /* noop */
  }
  return next
}

export function isSoloMode() {
  return readSalonMode() === SALON_MODE_SOLO
}

/**
 * Live mode for a component. Updates on toggle (same tab) and on `storage`
 * (other tabs), so Calendar reacts without a reload.
 * @returns {['solo' | 'team', (mode: 'solo' | 'team') => void]}
 */
export function useSalonMode() {
  const [mode, setMode] = useState(readSalonMode)

  useEffect(() => {
    const sync = () => setMode(readSalonMode())
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) sync()
    }
    window.addEventListener(SALON_MODE_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SALON_MODE_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const set = useCallback((next) => {
    setMode(writeSalonMode(next))
  }, [])

  return [mode, set]
}
