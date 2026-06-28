/** @returns {boolean} */
export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Phone-sized touch device (not tablet/desktop). */
export function isMobilePhoneDevice() {
  if (typeof window === 'undefined') return false
  const w = window.innerWidth
  const h = window.innerHeight
  const min = Math.min(w, h)
  if (min > 520) return false
  if (!('ontouchstart' in window) && navigator.maxTouchPoints <= 0) return false
  return true
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (typeof navigator.standalone === 'boolean' && navigator.standalone === true)
  )
}

export function applyIosStandalonePwaClass() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (isIosDevice()) {
    document.documentElement.classList.add('salonx-ios')
  }
  if (isIosDevice() && isStandalonePwa()) {
    document.documentElement.classList.add('salonx-ios-pwa')
  }
}

const STORAGE_PORTRAIT_H = 'salonx.shell.portraitH'
const STORAGE_PORTRAIT_W = 'salonx.shell.portraitW'

let cachedPortraitShellHeight = null
let cachedPortraitShellWidth = null
let orientationLockAttempted = false
let landscapeGuardEl = null

function loadCachedPortraitFromStorage() {
  if (typeof sessionStorage === 'undefined') return
  try {
    const h = Number(sessionStorage.getItem(STORAGE_PORTRAIT_H))
    const w = Number(sessionStorage.getItem(STORAGE_PORTRAIT_W))
    if (h > 0 && w > 0) {
      cachedPortraitShellHeight = h
      cachedPortraitShellWidth = w
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function saveCachedPortraitToStorage(width, height) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_PORTRAIT_H, String(height))
    sessionStorage.setItem(STORAGE_PORTRAIT_W, String(width))
  } catch {
    /* ignore */
  }
}

loadCachedPortraitFromStorage()

function readViewportSize() {
  const vv = window.visualViewport
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  }
}

function portraitDimsFromViewport(w, h) {
  return {
    w: Math.min(w, h),
    h: Math.max(w, h),
  }
}

function isLandscapeViewport(w, h) {
  if (typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches) {
    return Math.min(w, h) <= 520
  }
  return w > h && Math.min(w, h) <= 520
}

function shouldUsePortraitLock() {
  return isIosDevice() || isMobilePhoneDevice() || (isIosDevice() && isStandalonePwa())
}

function applyShellDimensions(width, height) {
  if (height > 0) {
    document.documentElement.style.setProperty('--salonx-shell-height', `${height}px`)
  }
  if (width > 0) {
    document.documentElement.style.setProperty('--salonx-shell-width', `${width}px`)
  }
}

function ensureLandscapeGuard() {
  if (typeof document === 'undefined') return null
  if (landscapeGuardEl && document.body.contains(landscapeGuardEl)) {
    return landscapeGuardEl
  }
  landscapeGuardEl = document.getElementById('salonx-landscape-guard')
  if (landscapeGuardEl) return landscapeGuardEl

  landscapeGuardEl = document.createElement('div')
  landscapeGuardEl.id = 'salonx-landscape-guard'
  landscapeGuardEl.hidden = true
  landscapeGuardEl.setAttribute('role', 'dialog')
  landscapeGuardEl.setAttribute('aria-live', 'polite')
  landscapeGuardEl.setAttribute('aria-label', 'Rotate your phone to portrait')
  landscapeGuardEl.innerHTML =
    '<p class="salonx-landscape-guard__text">Rotate your phone to portrait</p>'
  document.body.appendChild(landscapeGuardEl)
  return landscapeGuardEl
}

function updateLandscapeGuard(isActive) {
  if (typeof document === 'undefined') return
  const guard = ensureLandscapeGuard()
  if (!guard) return
  guard.hidden = !isActive
  document.documentElement.classList.toggle('salonx-landscape-blocked', isActive)
}

function resolvePortraitShellDims(w, h, isLandscape) {
  if (!isLandscape && h > 0) {
    return { w, h }
  }

  if (cachedPortraitShellHeight != null && cachedPortraitShellWidth != null) {
    return {
      w: cachedPortraitShellWidth,
      h: cachedPortraitShellHeight,
    }
  }

  return portraitDimsFromViewport(w, h)
}

/** Focus inside overlays that must not shrink the shell when iOS keyboard opens. */
function isSalonxKeyboardLockActive() {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  if (!active || !(active instanceof HTMLElement)) return false
  return Boolean(active.closest('[data-salonx-keyboard-lock]'))
}

function looksLikeIosKeyboardViewport(h) {
  if (cachedPortraitShellHeight == null || h <= 0) return false
  return h < cachedPortraitShellHeight - 120
}

/** Lock shell to portrait viewport — prevents landscape resize + stuck layout on rotate back. */
export function syncSalonxShellHeight() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const { w, h } = readViewportSize()
  const isLandscape = isLandscapeViewport(w, h)
  const usePortraitLock = shouldUsePortraitLock()

  if (usePortraitLock) {
    document.documentElement.classList.add('salonx-portrait-lock')
    document.documentElement.classList.toggle('salonx-is-landscape', isLandscape)
  } else {
    document.documentElement.classList.remove(
      'salonx-portrait-lock',
      'salonx-is-landscape',
      'salonx-landscape-blocked',
    )
    updateLandscapeGuard(false)
  }

  if (!usePortraitLock) {
    if (h > 0) applyShellDimensions(w, h)
    return
  }

  const portraitDims = resolvePortraitShellDims(w, h, isLandscape)
  const keyboardLock = isSalonxKeyboardLockActive()
  const keyboardOpen = looksLikeIosKeyboardViewport(h)

  if (!isLandscape && h > 0 && !keyboardLock && !keyboardOpen) {
    cachedPortraitShellHeight = portraitDims.h
    cachedPortraitShellWidth = portraitDims.w
    saveCachedPortraitToStorage(portraitDims.w, portraitDims.h)
  }

  let shellW = portraitDims.w
  let shellH = portraitDims.h
  if ((keyboardLock || keyboardOpen) && cachedPortraitShellHeight != null) {
    shellH = cachedPortraitShellHeight
    shellW = cachedPortraitShellWidth ?? portraitDims.w
  }

  applyShellDimensions(shellW, shellH)
  updateLandscapeGuard(isLandscape)
}

export function tryLockPortraitOrientation() {
  if (orientationLockAttempted) return
  if (typeof screen === 'undefined' || !screen.orientation?.lock) return
  if (!isStandalonePwa()) return

  orientationLockAttempted = true
  screen.orientation.lock('portrait-primary').catch(() => {
    orientationLockAttempted = false
  })
}

function scheduleShellHeightRetries() {
  syncSalonxShellHeight()
  requestAnimationFrame(syncSalonxShellHeight)
  return [
    window.setTimeout(syncSalonxShellHeight, 50),
    window.setTimeout(syncSalonxShellHeight, 250),
    window.setTimeout(syncSalonxShellHeight, 800),
    window.setTimeout(syncSalonxShellHeight, 1500),
  ]
}

function scheduleOrientationRecovery() {
  const ids = scheduleShellHeightRetries()
  for (const delay of [100, 300, 600, 1200, 2000]) {
    ids.push(
      window.setTimeout(() => {
        syncSalonxShellHeight()
        requestAnimationFrame(syncSalonxShellHeight)
      }, delay),
    )
  }
  return ids
}

/** @returns {() => void} */
export function startSalonxViewportShellSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  const shouldSync = shouldUsePortraitLock()
  if (!shouldSync) return () => {}

  const delayed = scheduleShellHeightRetries()
  tryLockPortraitOrientation()

  const onUserGesture = () => {
    tryLockPortraitOrientation()
    syncSalonxShellHeight()
    window.removeEventListener('pointerdown', onUserGesture, true)
    window.removeEventListener('touchstart', onUserGesture, true)
  }
  window.addEventListener('pointerdown', onUserGesture, true)
  window.addEventListener('touchstart', onUserGesture, true)

  const onViewportChange = () => {
    syncSalonxShellHeight()
    requestAnimationFrame(syncSalonxShellHeight)
  }

  const onOrientationChange = () => {
    scheduleOrientationRecovery()
  }

  const landscapeMq = window.matchMedia('(orientation: landscape)')
  const onLandscapeMq = () => scheduleOrientationRecovery()
  landscapeMq.addEventListener?.('change', onLandscapeMq)
  landscapeMq.addListener?.(onLandscapeMq)

  window.addEventListener('resize', onViewportChange)
  window.addEventListener('orientationchange', onOrientationChange)
  window.addEventListener('pageshow', onViewportChange)
  window.addEventListener('focus', onViewportChange)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleOrientationRecovery()
  })
  window.visualViewport?.addEventListener('resize', syncSalonxShellHeight)
  window.visualViewport?.addEventListener('scroll', syncSalonxShellHeight)

  const onFocusChange = () => {
    syncSalonxShellHeight()
    requestAnimationFrame(syncSalonxShellHeight)
  }
  document.addEventListener('focusin', onFocusChange, true)
  document.addEventListener('focusout', onFocusChange, true)

  return () => {
    delayed.forEach((id) => window.clearTimeout(id))
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('orientationchange', onOrientationChange)
    window.removeEventListener('pageshow', onViewportChange)
    window.removeEventListener('focus', onViewportChange)
    window.removeEventListener('pointerdown', onUserGesture, true)
    window.removeEventListener('touchstart', onUserGesture, true)
    landscapeMq.removeEventListener?.('change', onLandscapeMq)
    landscapeMq.removeListener?.(onLandscapeMq)
    window.visualViewport?.removeEventListener('resize', syncSalonxShellHeight)
    window.visualViewport?.removeEventListener('scroll', syncSalonxShellHeight)
    document.removeEventListener('focusin', onFocusChange, true)
    document.removeEventListener('focusout', onFocusChange, true)
  }
}
